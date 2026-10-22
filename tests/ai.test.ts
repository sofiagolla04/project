import { it, expect, vi, afterEach } from "vitest";
import { demoWorkspace } from "../lib/demo";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));
import { callAI, validateAI } from "../server/ai";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("missing AI configuration preserves inputs and never falls back to fixtures", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const w = demoWorkspace(),
    p = w.properties[0].projects[0];
  const before = JSON.stringify(p);
  await expect(callAI(w, p, "issues")).rejects.toThrow("continue manually");
  expect(JSON.stringify(p)).toBe(before);
  expect(parse).not.toHaveBeenCalled();
});
it("refusal or incomplete provider output is a failure", async () => {
  vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
  parse.mockResolvedValue({ output_parsed: null });
  const w = demoWorkspace();
  await expect(
    callAI(w, w.properties[0].projects[0], "issues"),
  ).rejects.toThrow("declined");
});
it("malformed structured provider output is rejected", async () => {
  vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
  parse.mockResolvedValue({
    output_parsed: { issues: [{ title: "invented" }] },
  });
  const w = demoWorkspace();
  await expect(
    callAI(w, w.properties[0].projects[0], "issues"),
  ).rejects.toThrow();
});
it("well-formed but false quotations are rejected after parsing", async () => {
  vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
  const w = demoWorkspace(),
    p = w.properties[0].projects[0],
    issue = structuredClone(p.draft.issues[0]);
  issue.evidence[0].excerpt = "Invented fact";
  parse.mockResolvedValue({ output_parsed: { issues: [issue] } });
  await expect(callAI(w, p, "issues")).rejects.toThrow("Unsupported");
});
it("timeout errors propagate and preserve saved evidence", async () => {
  vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
  parse.mockRejectedValue(Error("Timed out"));
  const w = demoWorkspace(),
    p = w.properties[0].projects[0];
  await expect(callAI(w, p, "issues")).rejects.toThrow("Timed out");
  expect(p.reviews).toHaveLength(40);
});
it("AI may correctly extract no issues from positive feedback", async () => {
  vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
  parse.mockResolvedValue({
    output_parsed: { issues: [] },
    usage: { input_tokens: 20, output_tokens: 3 },
  });
  const w = demoWorkspace();
  const r = await callAI(w, w.properties[0].projects[0], "issues");
  expect(r.result).toEqual({ issues: [] });
  expect(parse.mock.calls[0][0].store).toBe(false);
});
it("catalog hallucinations are rejected and unknown candidates are not authorized", () => {
  const w = demoWorkspace();
  expect(() =>
    validateAI(
      "options",
      {
        options: [
          { catalogId: "other-workspace-product", explanation: "Buy this" },
        ],
      },
      w.properties[0].projects[0],
      w,
    ),
  ).toThrow("unauthorized");
});
it("server candidates respect known category, city, budget and confirmed dimensions", async () => {
  const { candidates } = await import("../server/ai");
  const w = demoWorkspace(),
    p = w.properties[0].projects[0];
  w.catalog.forEach((c) => (c.deliveryArea = "Florence"));
  p.draft.issues = p.draft.issues.filter((i) => i.category === "storage");
  expect(candidates(w, p).map((c) => c.category)).toEqual(["storage"]);
  p.draft.rooms[0].measurements = [
    {
      id: "m",
      name: "available_width",
      mm: 100,
      confirmed: true,
      actor: "Host",
      confirmedAt: new Date().toISOString(),
      source: "tape",
    },
  ];
  expect(candidates(w, p)).toHaveLength(0);
});
