import { describe, it, expect } from "vitest";
import { demoWorkspace, DEMO_STORAGE } from "../lib/demo";
import {
  applyAction,
  budget,
  fit,
  supportingCount,
  validateEvidence,
  previewReviews,
  readiness,
  offerStatus,
  hash,
  reviewInput,
  exportProject,
  shoppingCSV,
  followup,
  emptyProject,
} from "../lib/domain";
import {
  Workspace,
  Action,
  Product,
  stamp,
  productSchema,
  projectSchema,
  actionSchema,
} from "../lib/model";
import { parseCSV } from "../lib/csv";
const project = (w: Workspace) => w.properties[0].projects[0];
function act(w: Workspace, a: Action) {
  return applyAction(w, a);
}
function submit(w = demoWorkspace()) {
  const p = project(w);
  return act(w, { type: "submit", projectId: p.id, expected: p.revision });
}
function approve(w = submit()) {
  w = act(w, { type: "persona", memberId: "demo-owner" });
  const p = project(w);
  return act(w, {
    type: "decide",
    projectId: p.id,
    expected: p.revision,
    versionId: p.currentVersionId!,
    decision: "approved",
    note: "Scope accepted with conditions.",
  });
}
describe("synthetic fixture and evidence integrity", () => {
  it("computes 8/40, 5/40, 3/40 with overlaps", () => {
    const p = project(demoWorkspace());
    expect(p.reviews).toHaveLength(40);
    expect(p.draft.issues.map(supportingCount)).toEqual([8, 5, 3]);
    expect(
      p.draft.issues.every((i) =>
        i.evidence.some((e) => e.source_id === "DEMO-R08"),
      ),
    ).toBe(true);
  });
  it("rejects nonexistent source IDs", () => {
    const p = project(demoWorkspace());
    p.draft.issues[0].evidence[0].source_id = "invented";
    expect(() => validateEvidence(p.draft.issues, p)).toThrow("Unsupported");
  });
  it("rejects unsupported quotations", () => {
    const p = project(demoWorkspace());
    p.draft.issues[0].evidence[0].excerpt = "A fabricated quotation";
    expect(() => validateEvidence(p.draft.issues, p)).toThrow("Unsupported");
  });
  it("counts distinct reviews, excluding operator observations", () => {
    const issue = project(demoWorkspace()).draft.issues[0];
    issue.evidence.push(issue.evidence[0], {
      source_type: "operator_observation",
      source_id: "o",
      excerpt: "test",
    });
    expect(supportingCount(issue)).toBe(8);
  });
  it("marks evidence stale after editing and preserves submitted snapshots", () => {
    const w = submit();
    const p = project(w);
    const old = JSON.stringify(p.versions[0]);
    const next = act(w, {
      type: "editReview",
      projectId: p.id,
      expected: p.revision,
      review: { ...p.reviews[0], text: "Changed positive feedback." },
    });
    expect(project(next).analysis?.stale).toBe(true);
    expect(JSON.stringify(project(next).versions[0])).toBe(old);
    expect(project(next).currentVersionId).toBeNull();
  });
  it("recomputes changed demo inputs and positive feedback yields no purchase suggestion", () => {
    let w = demoWorkspace();
    const p = project(w);
    p.reviews.forEach((r) => (r.text = "Excellent, comfortable stay."));
    w = act(w, { type: "analyzeDemo", projectId: p.id, expected: p.revision });
    expect(project(w).draft.issues).toEqual([]);
    expect(project(w).analysis?.inputHash).toBe(hash(reviewInput(project(w))));
  });
});
describe("imports", () => {
  it("preserves valid rows and reports invalid dates and text", () => {
    const p = project(demoWorkspace());
    const r = previewReviews(
      [
        { review_text: "A good stay", review_date: "2026-02-30" },
        { review_text: "" },
        { review_text: "Valid review", review_date: "2026-10-01" },
      ],
      p,
    );
    expect(r.valid).toHaveLength(1);
    expect(r.rejected).toHaveLength(2);
  });
  it("is idempotent across imports with stable external identities", () => {
    let w = demoWorkspace();
    let p = project(w);
    const rows = [
      {
        review_text: "New source review",
        source: "direct",
        external_review_id: "id-1",
      },
    ];
    w = act(w, {
      type: "importReviews",
      projectId: p.id,
      expected: p.revision,
      rows,
      source: "CSV",
    });
    p = project(w);
    const r = previewReviews(rows, p);
    expect(r.duplicates).toBe(1);
    expect(r.valid).toHaveLength(0);
  });
  it("fingerprints undated pasted reviews consistently and flags ambiguous distinct stays", () => {
    const p = project(demoWorkspace());
    const r = previewReviews(
      [
        { review_text: "Same text", review_date: "2026-10-01" },
        { review_text: "Same text", review_date: "2026-10-02" },
        { review_text: "Same text", review_date: "2026-10-01" },
      ],
      p,
    );
    expect(r.valid).toHaveLength(2);
    expect(r.duplicates).toBe(1);
    expect(r.nearDuplicates).toBe(1);
  });
  it("rejects limits without truncating", () => {
    expect(() =>
      parseCSV("review_text\n" + Array(501).fill("text").join("\n")),
    ).toThrow("500");
    expect(
      previewReviews(
        [{ review_text: "a".repeat(6001) }],
        project(demoWorkspace()),
      ).rejected,
    ).toHaveLength(1);
  });
  it("parses quoted commas and multiline reviews", () => {
    const result = parseCSV('review_text,source\r\n"Good, but\nbright",direct');
    expect(result.rows[0].review_text).toBe("Good, but\nbright");
  });
});
describe("money and fit", () => {
  it("allocates EUR 500 and leaves EUR 200 from EUR 700", () => {
    const b = budget(project(demoWorkspace()).draft);
    expect(b.total).toBe(50000);
    expect(b.remaining).toBe(20000);
  });
  it("unknown delivery is null, never zero", () => {
    const w = demoWorkspace(),
      p = project(w);
    p.draft.costs.delivery = null;
    expect(budget(p.draft).total).toBeNull();
    expect(readiness(p, w).reviewable).toBe(false);
  });
  it("validates integer cents and quantity server contracts", () => {
    const p = project(demoWorkspace());
    p.draft.lines[0].quantity = 1.5;
    expect(projectSchema.safeParse(p).success).toBe(false);
    expect(
      productSchema.safeParse({ ...demoWorkspace().catalog[0], price: 10.5 })
        .success,
    ).toBe(false);
  });
  it("rounds a basis point contingency deterministically and applies discounts once", () => {
    const p = project(demoWorkspace());
    p.draft.lines = p.draft.lines.slice(0, 1);
    p.draft.lines[0].unit = 101;
    p.draft.lines[0].quantity = 3;
    p.draft.costs = {
      delivery: 0,
      installation: 0,
      tax: 0,
      discount: 1,
      contingency: { kind: "percent", value: 1000 },
      notes: "",
    };
    expect(budget(p.draft).total).toBe(332);
  });
  it("does not add included VAT a second time", () => {
    const p = project(demoWorkspace());
    expect(budget(p.draft).items).toBe(32000);
    expect(budget(p.draft).total).toBe(50000);
  });
  it("blocks overbudget submission without enlarging ceiling", () => {
    const w = demoWorkspace(),
      p = project(w);
    p.draft.budget = 100;
    expect(() => submit(w)).toThrow("exceeds");
    expect(p.draft.budget).toBe(100);
  });
  it("cannot pass missing or unconfirmed measurements", () => {
    const w = demoWorkspace(),
      p = project(w);
    expect(fit(p.draft.lines[0], p.draft, w.catalog[0]).status).toBe(
      "needs_information",
    );
    p.draft.rooms[0].measurements = [
      {
        id: "m",
        name: "window_width",
        mm: 2000,
        source: "photo",
        confirmed: false,
        actor: null,
        confirmedAt: null,
      },
    ];
    expect(fit(p.draft.lines[0], p.draft, w.catalog[0]).status).toBe(
      "needs_information",
    );
  });
  it("a manual note cannot hide a known failed check", () => {
    const w = demoWorkspace(),
      p = project(w);
    p.draft.rooms[0].measurements = [
      {
        id: "m",
        name: "window_width",
        mm: 2000,
        source: "tape",
        confirmed: true,
        actor: "Host",
        confirmedAt: stamp(),
      },
    ];
    p.draft.lines[0].manualFit = {
      actor: "Host",
      at: stamp(),
      note: "Looks okay",
    };
    expect(fit(p.draft.lines[0], p.draft, w.catalog[0]).status).toBe(
      "fails_recorded_checks",
    );
    expect(readiness(p, w).reviewable).toBe(false);
  });
  it("out-of-stock and stale offers cannot be ready to buy", () => {
    const w = approve(),
      p = project(w);
    w.catalog[0].stock = "out_of_stock";
    w.catalog[0].verifiedBy = "Host";
    w.catalog[0].priceAt = "2020-01-01T00:00:00Z";
    w.catalog[0].stockAt = stamp();
    expect(offerStatus(w.catalog[0], w.settings)).toBe("stale");
    expect(readiness(p, w).readyToBuy).toBe(false);
  });
});
describe("permissions, approval and completion", () => {
  it("operator cannot approve", () => {
    const w = submit(),
      p = project(w);
    expect(() =>
      act(w, {
        type: "decide",
        projectId: p.id,
        expected: p.revision,
        versionId: p.currentVersionId!,
        decision: "approved",
        note: "",
      }),
    ).toThrow("approval rights");
  });
  it("an approver cannot read or export an unassigned property", () => {
    const w = act(demoWorkspace(), {
      type: "persona",
      memberId: "demo-approver",
    });
    const p = emptyProject("demo-second");
    w.properties[1].projects = [p];
    expect(() => exportProject(w, p, null)).toThrow("permission");
    expect(() =>
      act(w, {
        type: "saveDraft",
        projectId: p.id,
        expected: 0,
        draft: p.draft,
      }),
    ).toThrow("permission");
  });
  it("material edits preserve historical approval but require a fresh decision", () => {
    const w = approve(),
      p = project(w);
    const next = act(w, {
      type: "saveDraft",
      projectId: p.id,
      expected: p.revision,
      draft: { ...p.draft, budget: 80000 },
    });
    expect(project(next).versions[0].status).toBe("approved");
    expect(project(next).currentVersionId).toBeNull();
    expect(readiness(project(next), next).approved).toBe(false);
  });
  it("rejects concurrent edits at approval", () => {
    const w = submit();
    const owner = act(w, { type: "persona", memberId: "demo-owner" }),
      p = project(owner);
    expect(() =>
      act(owner, {
        type: "decide",
        projectId: p.id,
        expected: p.revision - 1,
        versionId: p.currentVersionId!,
        decision: "approved",
        note: "",
      }),
    ).toThrow("changed");
  });
  it("repeated submit is idempotent", () => {
    const w = submit(),
      p = project(w);
    const next = act(w, {
      type: "submit",
      projectId: p.id,
      expected: p.revision,
    });
    expect(project(next).versions).toHaveLength(1);
  });
  it("operational no-purchase plan can be approved and completed with actual cost", () => {
    let w = demoWorkspace(),
      p = project(w);
    p.draft.lines = [
      {
        ...p.draft.lines[0],
        action: "operational_change",
        productId: null,
        unit: 0,
        title: "Update arrival instructions",
      },
    ];
    p.draft.costs = {
      delivery: 0,
      installation: 0,
      tax: 0,
      discount: 0,
      contingency: { kind: "fixed", value: 0 },
      notes: "",
    };
    w = approve(submit(w));
    p = project(w);
    expect(readiness(p, w).readyToBuy).toBe(true);
    const before = JSON.stringify(p.versions[0]);
    w = act(w, {
      type: "saveTask",
      projectId: p.id,
      expected: p.revision,
      task: { ...p.tasks[0], status: "done", actual: 1200 },
    });
    expect(project(w).tasks[0].actual).toBe(1200);
    expect(JSON.stringify(project(w).versions[0])).toBe(before);
  });
  it("purchase tasks are blocked before recorded readiness", () => {
    const w = approve(),
      p = project(w);
    expect(() =>
      act(w, {
        type: "saveTask",
        projectId: p.id,
        expected: p.revision,
        task: {
          ...p.tasks.find((t) => t.kind === "purchase")!,
          status: "done",
        },
      }),
    ).toThrow("readiness");
  });
  it("blocks demo records and persona actions in live adapter", () => {
    const w = demoWorkspace();
    w.demo = false;
    expect(() => act(w, { type: "persona", memberId: "demo-owner" })).toThrow(
      "demo",
    );
    expect(() =>
      act(w, { type: "saveProduct", product: w.catalog[0], verify: false }),
    ).toThrow("cannot mix");
    expect(DEMO_STORAGE).toContain("demo");
  });
  it("records human verification and invalidates it after offer edits", () => {
    let w = demoWorkspace();
    let product: Product = {
      ...w.catalog[0],
      verificationSource: "Synthetic human check",
      stock: "in_stock" as const,
    };
    w = act(w, { type: "saveProduct", product, verify: true });
    product = w.catalog.find((c) => c.id === product.id)!;
    expect(offerStatus(product, w.settings)).toBe("verified");
    w = act(w, {
      type: "saveProduct",
      product: { ...product, price: 20000 },
      verify: false,
    });
    expect(
      offerStatus(
        w.catalog.find((c) => c.id === product.id)!,
        w.settings,
      ),
    ).toBe("unverified");
  });
});
describe("exports and follow-up", () => {
  it("exports the exact chosen snapshot even after draft changes", () => {
    const w = approve(),
      p = project(w),
      v = p.versions[0];
    p.draft.budget = 90000;
    const data = exportProject(w, p, v.id);
    expect(data.draft.budget).toBe(70000);
    expect(data.label).toContain("DEMO");
    expect(data.label).toContain("approved");
    expect(shoppingCSV(data)).toContain("DEMO-R01");
  });
  it("sanitizes spreadsheet formula injection", () => {
    const w = demoWorkspace(),
      p = project(w);
    p.draft.lines[0].title = '=HYPERLINK("bad")';
    expect(shoppingCSV(exportProject(w, p, null))).toContain("\"'=HYPERLINK");
  });
  it("counts distinct follow-up reviews within the chosen dates and excludes baseline", () => {
    const w = approve(),
      p = project(w);
    p.followup = {
      completedDate: "2026-10-01",
      from: "2026-10-02",
      to: "2026-10-31",
      notes: "",
    };
    p.reviews.push({
      ...p.reviews[0],
      id: "later1",
      date: "2026-10-10",
      fingerprint: "later",
    });
    p.draft.issues[0].evidence.push({
      source_type: "review",
      source_id: "later1",
      excerpt: p.reviews[0].text,
    });
    const f = followup(p, p.draft.issues[0]);
    expect(f.baseline).toBe(40);
    expect(f.baselineMentions).toBe(8);
    expect(f.later).toBe(1);
    expect(f.mentions).toBe(1);
  });
  it("rejects unknown action payloads", () => {
    expect(
      actionSchema.safeParse({ type: "decide", expected: "x" }).success,
    ).toBe(false);
  });
});

describe("additional purchase and reference safeguards", () => {
  it("a non-null amount with unknown cost basis is not reviewable", () => {
    const w = demoWorkspace(),
      p = project(w);
    p.draft.lines[0].basis = "unknown";
    expect(readiness(p, w).reviewable).toBe(false);
    expect(budget(p.draft).known).toBe(50000);
  });
  it("does not accept foreign catalog, room or issue references in a draft", () => {
    const w = demoWorkspace(),
      p = project(w);
    const draft = structuredClone(p.draft);
    draft.lines[0].productId = "foreign-id";
    expect(() =>
      act(w, { type: "saveDraft", projectId: p.id, expected: 0, draft }),
    ).toThrow("catalog reference");
  });
  it("invalid HTTPS strings fail validation without throwing from URL parsing", () => {
    expect(
      productSchema.safeParse({
        ...demoWorkspace().catalog[0],
        url: "https://",
      }).success,
    ).toBe(false);
  });
  it("metadata cannot be forged by submitting a product without human verification", () => {
    let w = demoWorkspace();
    let product = { ...w.catalog[0], verificationSource: "Checked" };
    w = act(w, { type: "saveProduct", product, verify: true });
    product = w.catalog.find((c) => c.id === product.id)!;
    const at = product.priceAt;
    w = act(w, {
      type: "saveProduct",
      product: { ...product, verifiedBy: "Forged", priceAt: "2099-01-01" },
      verify: false,
    });
    expect(w.catalog.find((c) => c.id === product.id)!.verifiedBy).toBe(
      "Alex · operator",
    );
    expect(w.catalog.find((c) => c.id === product.id)!.priceAt).toBe(at);
  });
  it("authorized deletion removes only the selected project", () => {
    let w = demoWorkspace();
    const p = project(w);
    w = act(w, {
      type: "deleteProject",
      projectId: p.id,
      expected: p.revision,
    });
    expect(w.properties).toHaveLength(2);
    expect(w.properties[0].projects).toHaveLength(0);
  });
});
describe("property-wide review identity and sharing", () => {
  it("reuses the same canonical records across projects and invalidates both analyses on edit", () => {
    let w = demoWorkspace();
    w = act(w, {
      type: "addProject",
      propertyId: w.properties[0].id,
      name: "Second refresh",
    });
    let second = w.properties[0].projects[1];
    w = act(w, {
      type: "attachReviews",
      projectId: second.id,
      expected: 0,
      reviewIds: ["DEMO-R01"],
    });
    second = w.properties[0].projects[1];
    expect(second.reviews[0].id).toBe("DEMO-R01");
    second.analysis = {
      inputHash: hash(reviewInput(second)),
      reviewIds: ["DEMO-R01"],
      stale: false,
      at: stamp(),
    };
    const first = project(w);
    w = act(w, {
      type: "editReview",
      projectId: first.id,
      expected: first.revision,
      review: { ...first.reviews[0], text: "Edited shared source" },
    });
    expect(w.properties[0].projects[1].reviews[0].text).toBe(
      "Edited shared source",
    );
    expect(w.properties[0].projects[1].analysis?.stale).toBe(true);
    expect(w.properties[0].library).toHaveLength(40);
  });
  it("reimporting a file into a second project reuses one property source identity", () => {
    let w = demoWorkspace();
    const first = project(w),
      rows = [
        {
          review_text: "A newly imported shared review",
          external_review_id: "source-shared",
          source: "direct",
        },
      ];
    w = act(w, {
      type: "importReviews",
      projectId: first.id,
      expected: 0,
      rows,
      source: "CSV",
    });
    w = act(w, {
      type: "addProject",
      propertyId: w.properties[0].id,
      name: "Second refresh",
    });
    const second = w.properties[0].projects[1];
    w = act(w, {
      type: "importReviews",
      projectId: second.id,
      expected: 0,
      rows,
      source: "CSV",
    });
    expect(w.properties[0].library).toHaveLength(41);
    expect(w.properties[0].projects[0].reviews.at(-1)!.id).toBe(
      w.properties[0].projects[1].reviews[0].id,
    );
  });
  it("rejects a source ID outside the property library", () => {
    const w = demoWorkspace(),
      p = project(w);
    expect(() =>
      act(w, {
        type: "attachReviews",
        projectId: p.id,
        expected: 0,
        reviewIds: ["foreign-review"],
      }),
    ).toThrow("not found");
  });
});
it("retries of the same submission and decision are idempotent even with the original expected revision", () => {
  let w = submit(),
    p = project(w);
  const same = act(w, { type: "submit", projectId: p.id, expected: 0 });
  expect(project(same).versions).toHaveLength(1);
  w = act(w, { type: "persona", memberId: "demo-owner" });
  p = project(w);
  const a: Action = {
    type: "decide",
    projectId: p.id,
    expected: p.revision,
    versionId: p.currentVersionId!,
    decision: "approved",
    note: "Accepted",
  };
  w = act(w, a);
  const again = act(w, a);
  expect(project(again).tasks).toHaveLength(6);
  expect(project(again).versions[0].decision?.note).toBe("Accepted");
});
it("changed material catalog facts require a fresh version even if the line ID stays the same", () => {
  let w = approve(),
    p = project(w);
  const offer = { ...w.catalog[0], sku: "NEW-SPEC" };
  w = act(w, { type: "saveProduct", product: offer, verify: false });
  p = project(w);
  expect(readiness(p, w).approved).toBe(false);
  w = act(w, {
    type: "saveDraft",
    projectId: p.id,
    expected: p.revision,
    draft: p.draft,
  });
  expect(project(w).currentVersionId).toBeNull();
  expect(project(w).versions[0].status).toBe("approved");
});
it("removing a mandatory dimension from intervention input cannot hide a failed check", () => {
  const w = demoWorkspace(),
    p = project(w),
    line = p.draft.lines[2];
  line.requiredMeasurements = ["available_width"];
  p.draft.rooms[0].measurements = [
    {
      id: "w",
      name: "available_width",
      mm: 1000,
      confirmed: true,
      actor: "Host",
      confirmedAt: stamp(),
      source: "tape",
    },
    {
      id: "d",
      name: "available_depth",
      mm: 100,
      confirmed: true,
      actor: "Host",
      confirmedAt: stamp(),
      source: "tape",
    },
  ];
  expect(fit(line, p.draft, w.catalog[2]).status).toBe("fails_recorded_checks");
});
