import { describe, expect, it } from "vitest";
import { demoWorkspace } from "../lib/demo";
import { applyAction, emptyProject } from "../lib/domain";
import { getProjectGuidance } from "../lib/project-guidance";
import type { Workspace } from "../lib/model";

const project = (w: Workspace) => w.properties[0].projects[0];
const guidance = (w: Workspace) => getProjectGuidance(project(w), w);
function submit(w = demoWorkspace()) {
  const p = project(w);
  return applyAction(w, {
    type: "submit",
    projectId: p.id,
    expected: p.revision,
  });
}
function decide(decision: "approved" | "rejected" | "changes_requested") {
  let w = submit();
  w = applyAction(w, { type: "persona", memberId: "demo-owner" });
  const p = project(w);
  return applyAction(w, {
    type: "decide",
    projectId: p.id,
    expected: p.revision,
    versionId: p.currentVersionId!,
    decision,
    note: "Decision recorded for this test.",
  });
}

describe("project guidance", () => {
  it("helps an empty project start with a brief, then feedback", () => {
    const w = demoWorkspace();
    w.properties[0].projects = [emptyProject(w.properties[0].id)];
    expect(guidance(w).stage).toBe(0);
    project(w).draft.problems = "Make arrival instructions clearer.";
    expect(guidance(w).stage).toBe(1);
    expect(guidance(w).description).toContain("without AI");
  });

  it("supports a manual observation without requiring AI analysis", () => {
    let w = demoWorkspace();
    w.properties[0].projects = [emptyProject(w.properties[0].id)];
    const p = project(w);
    w = applyAction(w, {
      type: "addObservation",
      projectId: p.id,
      expected: p.revision,
      title: "Unclear arrival instructions",
      text: "The key-box location is not explained.",
      actionClass: "operational_change",
    });
    expect(project(w).analysis).toBeNull();
    expect(guidance(w).stage).toBe(2);
  });

  it("does not add an AI or review requirement to a valid manual plan", () => {
    const w = demoWorkspace();
    const p = project(w);
    p.reviews = [];
    p.observations = [];
    p.analysis = null;
    p.draft.issues = [];
    p.draft.lines.forEach((line) => (line.issueIds = []));
    expect(guidance(w).stage).toBe(3);
  });

  it("returns changed evidence to manual review before submission", () => {
    const w = demoWorkspace();
    project(w).analysis!.stale = true;
    expect(guidance(w).stage).toBe(1);
    expect(guidance(w).description).toContain("manually");
  });

  it("routes missing costs, exceeded budgets and known failed fit to options", () => {
    const missing = demoWorkspace();
    project(missing).draft.costs.delivery = null;
    expect(guidance(missing).title).toContain("cost information");
    const exceeded = demoWorkspace();
    project(exceeded).draft.budget = 100;
    expect(guidance(exceeded).title).toContain("within its budget");
    const failed = demoWorkspace();
    project(failed).draft.rooms[0].measurements.push({
      id: "window",
      name: "window_width",
      mm: 2000,
      source: "Measured",
      confirmed: true,
      actor: "Operator",
      confirmedAt: new Date().toISOString(),
    });
    expect(guidance(failed).description).toContain("recorded fit check failed");
    for (const w of [missing, exceeded, failed]) {
      expect(guidance(w).stage).toBe(2);
      expect(guidance(w).tone).toBe("amber");
    }
  });

  it("offers submission for a reviewable estimate without claiming purchase readiness", () => {
    const result = guidance(demoWorkspace());
    expect(result.stage).toBe(3);
    expect(result.description).toContain(
      "Purchase readiness is checked separately",
    );
  });

  it("uses property approval rights rather than an administrator title", () => {
    let w = submit();
    expect(guidance(w).title).toContain("waiting for an approver");
    w = applyAction(w, { type: "persona", memberId: "demo-owner" });
    expect(guidance(w).title).toContain("ready for your decision");
    w.actor.approvalProperties = [];
    expect(guidance(w).title).toContain("waiting for an approver");
    expect(guidance(w).stage).toBe(3);
  });

  it("distinguishes declined decisions from pending ones and guides a revised plan back to submission", () => {
    for (const decision of ["rejected", "changes_requested"] as const) {
      const w = decide(decision);
      expect(guidance(w).stage).toBe(2);
      expect(guidance(w).title).not.toContain("waiting");
      project(w).draft.lines[0].reason += " Updated after the decision.";
      expect(guidance(w).stage).toBe(3);
      expect(guidance(w).title).toContain("updated plan");
    }
  });

  it("keeps purchase checks visible after an estimated plan is approved", () => {
    const w = decide("approved");
    expect(guidance(w).stage).toBe(2);
    expect(guidance(w).description).toContain("Purchases remain blocked");
    expect(guidance(w).tone).toBe("amber");
  });

  it("tracks only the current revision's unfinished work, then offers follow-up", () => {
    const w = decide("approved");
    const p = project(w);
    p.tasks.forEach((task) => (task.status = "done"));
    p.tasks.push({
      ...p.tasks[0],
      id: "older-task",
      versionId: "older",
      status: "todo",
    });
    expect(guidance(w).stage).toBe(4);
    expect(guidance(w).title).toContain("after the work");
    p.tasks[0].kind = "work";
    p.tasks[0].status = "todo";
    expect(guidance(w).title).toContain("into practice");
  });

  it("routes changed approved catalog facts to a new revision rather than completion", () => {
    const w = decide("approved");
    w.catalog[0].price! += 100;
    expect(guidance(w).stage).toBe(2);
    expect(guidance(w).description).toContain("submit a new revision");
  });

  it("does not invite read-only approvers to edit drafts or perform tasks", () => {
    let w = applyAction(demoWorkspace(), {
      type: "persona",
      memberId: "demo-approver",
    });
    expect(guidance(w).stage).toBe(3);
    expect(guidance(w).title).toContain("no revision awaiting");
    w = applyAction(decide("changes_requested"), {
      type: "persona",
      memberId: "demo-approver",
    });
    expect(guidance(w).actionLabel).toBe("View decision history");
    w = applyAction(decide("approved"), {
      type: "persona",
      memberId: "demo-approver",
    });
    expect(guidance(w).stage).toBe(4);
    expect(guidance(w).actionLabel).toBe("View implementation");
  });
});
