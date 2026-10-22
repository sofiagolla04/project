import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoWorkspace } from "../lib/demo";
import {
  reconcileAnalyzedIssues,
  retainedIssuesForAnalysis,
} from "../lib/reconcile-analysis";
import type { Issue } from "../lib/model";

const mocks = vi.hoisted(() => ({
  getProject: vi.fn(),
  quota: vi.fn(),
  saveProject: vi.fn(),
  callAI: vi.fn(),
}));
vi.mock("@/server/repository", () => ({
  getProject: mocks.getProject,
  quota: mocks.quota,
  saveProject: mocks.saveProject,
}));
vi.mock("@/server/ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../server/ai")>()),
  callAI: mocks.callAI,
}));
import { POST } from "../app/api/ai/route";

function fixture() {
  const workspace = demoWorkspace();
  const project = workspace.properties[0].projects[0];
  workspace.id = crypto.randomUUID();
  project.id = crypto.randomUUID();
  return { workspace, project };
}

describe("issue reanalysis reconciliation", () => {
  it("preserves every intervention, cost and referenced issue when the model returns new IDs", () => {
    const { project } = fixture();
    const before = structuredClone(project);
    const extracted = [{ ...project.draft.issues[0], id: "new-finding" }];
    const issues = reconcileAnalyzedIssues(project, extracted);
    expect(issues).toEqual([...before.draft.issues, ...extracted]);
    for (const line of project.draft.lines)
      for (const id of line.issueIds)
        expect(issues.some((issue) => issue.id === id)).toBe(true);
    expect(project).toEqual(before);
  });

  it("does not replace operator observations, manual assessments or human decisions", () => {
    const { project } = fixture();
    project.draft.lines = [];
    project.observations.push({ id: "operator-note", text: "Check the lock." });
    const observation: Issue = {
      ...project.draft.issues[0],
      id: "manual-observation",
      title: "Inspect the lock",
      evidence: [
        {
          source_type: "operator_observation",
          source_id: "operator-note",
          excerpt: "Check the lock.",
        },
      ],
    };
    const assessment: Issue = {
      ...observation,
      id: "manual-assessment",
      evidence: [],
    };
    const dismissed: Issue = {
      ...project.draft.issues[1],
      status: "dismissed",
      resolution: "Owner reviewed this and chose to retain the existing item.",
    };
    project.draft.issues = [observation, assessment, dismissed];
    const overwritten = project.draft.issues.map((issue) => ({
      ...issue,
      title: "Model replacement",
      status: "open" as const,
      resolution: "",
    }));
    expect(reconcileAnalyzedIssues(project, overwritten)).toEqual(
      project.draft.issues,
    );
  });

  it("rejects invalid retained citations atomically and explains the manual repair", () => {
    const { project } = fixture();
    const source = project.draft.issues[0].evidence[0].source_id;
    project.reviews.find((review) => review.id === source)!.excluded = true;
    const before = structuredClone(project);
    expect(() => reconcileAnalyzedIssues(project, [])).toThrow(
      "Edit classification",
    );
    expect(() => retainedIssuesForAnalysis(project)).toThrow(
      "Your current plan has not been changed",
    );
    expect(project).toEqual(before);
  });

  it("allows the model to replace unreferenced issues even when their old evidence is stale", () => {
    const { project } = fixture();
    project.draft.lines = [];
    const fresh = { ...project.draft.issues[1], id: "fresh-finding" };
    project.draft.issues[0].evidence[0].source_id = "removed-source";
    expect(reconcileAnalyzedIssues(project, [fresh])).toEqual([fresh]);
  });

  it("rejects duplicate or empty model IDs instead of storing ambiguous issue links", () => {
    const { project } = fixture();
    const issue = project.draft.issues[0];
    expect(() => reconcileAnalyzedIssues(project, [issue, issue])).toThrow(
      "duplicate issue IDs",
    );
    expect(() =>
      reconcileAnalyzedIssues(project, [{ ...issue, id: " " }]),
    ).toThrow("empty or duplicate issue IDs");
  });

  it("rejects an intervention whose issue is already missing", () => {
    const { project } = fixture();
    project.draft.lines[0].issueIds = ["missing-issue"];
    expect(() => reconcileAnalyzedIssues(project, [])).toThrow(
      "Review its issue links in Options",
    );
  });
});

describe("live issue reanalysis route", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ORIGIN", "https://planner.example");
    vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
  });
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
  });

  function request(workspaceId: string, projectId: string, expected: number) {
    return new Request("https://planner.example/api/ai", {
      method: "POST",
      headers: {
        origin: "https://planner.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspaceId,
        projectId,
        expected,
        stage: "issues",
      }),
    });
  }

  function adapter() {
    const query = {
      error: null,
      select: vi.fn(),
      eq: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "run" }, error: null }),
    };
    for (const key of ["select", "eq", "insert", "update"] as const)
      query[key].mockReturnValue(query);
    return { from: vi.fn().mockReturnValue(query), query };
  }

  it("checks changed retained sources before a provider request or saved mutation", async () => {
    const { workspace, project } = fixture();
    const source = project.draft.issues[0].evidence[0].source_id;
    project.reviews.find((review) => review.id === source)!.excluded = true;
    const admin = adapter();
    const before = structuredClone(project);
    mocks.getProject.mockResolvedValue({ workspace, project, admin });
    const response = await POST(
      request(workspace.id, project.id, project.revision),
    );
    expect(response.ok).toBe(false);
    expect((await response.json()).error).toContain("Edit classification");
    expect(mocks.callAI).not.toHaveBeenCalled();
    expect(mocks.saveProject).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
    expect(project).toEqual(before);
  });

  it("saves reconciled issues while retaining the existing intervention budget", async () => {
    const { workspace, project } = fixture();
    const admin = adapter();
    mocks.getProject.mockResolvedValue({
      workspace,
      project,
      admin,
      user: { id: workspace.actor.id },
    });
    mocks.callAI.mockResolvedValue({
      result: { issues: [{ ...project.draft.issues[0], id: "new-finding" }] },
      usage: null,
    });
    const response = await POST(
      request(workspace.id, project.id, project.revision),
    );
    expect(response.status).toBe(200);
    const saved = mocks.saveProject.mock.calls[0][1];
    expect(saved.draft.lines).toEqual(project.draft.lines);
    expect(saved.draft.costs).toEqual(project.draft.costs);
    expect(saved.observations).toEqual(project.observations);
    expect(saved.draft.issues).toHaveLength(project.draft.issues.length + 1);
    expect(saved.currentVersionId).toBeNull();
  });

  it("marks malformed new model results failed and does not save a corrupt draft", async () => {
    const { workspace, project } = fixture();
    const admin = adapter();
    mocks.getProject.mockResolvedValue({ workspace, project, admin });
    mocks.callAI.mockResolvedValue({
      result: { issues: [project.draft.issues[0], project.draft.issues[0]] },
      usage: null,
    });
    const response = await POST(
      request(workspace.id, project.id, project.revision),
    );
    expect(response.ok).toBe(false);
    expect((await response.json()).error).toContain("duplicate issue IDs");
    expect(mocks.saveProject).not.toHaveBeenCalled();
    expect(admin.query.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    expect(admin.query.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
  });
});
