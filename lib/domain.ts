import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  Action,
  Draft,
  Issue,
  Line,
  Product,
  Project,
  Review,
  Version,
  Workspace,
  id,
  stamp,
  workspaceSchema,
} from "./model";
export const money = (v: number | null) =>
  v === null
    ? "Unknown"
    : new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
      }).format(v / 100);
export const hash = (v: unknown) =>
  bytesToHex(sha256(new TextEncoder().encode(JSON.stringify(v))));
export const reviewInput = (p: Project) => ({
  reviews: p.reviews
    .filter((r) => !r.excluded)
    .map(({ id, text, source, date }) => ({ id, text, source, date }))
    .sort((a, b) => a.id.localeCompare(b.id)),
  observations: p.observations,
});
export const canEdit = (w: Workspace) => w.actor.role !== "approver";
export const canApprove = (w: Workspace, propertyId: string) =>
  w.actor.approvalProperties.includes(propertyId);
export function authorize(w: Workspace, propertyId: string, edit = false) {
  if (
    !w.properties.some((p) => p.id === propertyId) ||
    (w.actor.role === "approver" && !canApprove(w, propertyId)) ||
    (edit && !canEdit(w))
  )
    throw Error("You do not have permission for this property.");
}
export function validateEvidence(issues: Issue[], p: Project) {
  const active = new Map(
    p.reviews.filter((r) => !r.excluded).map((r) => [r.id, r.text]),
  );
  const observations = new Map(p.observations.map((o) => [o.id, o.text]));
  for (const issue of issues) {
    if (issue.roomId && !p.draft.rooms.some((r) => r.id === issue.roomId))
      throw Error("Unknown room reference.");
    for (const e of issue.evidence) {
      const source = (e.source_type === "review" ? active : observations).get(
        e.source_id,
      );
      if (!source || !source.includes(e.excerpt))
        throw Error("Unsupported evidence reference or quotation.");
    }
  }
  return issues;
}
export const supportingCount = (i: Issue) =>
  new Set(
    i.evidence
      .filter((e) => e.source_type === "review")
      .map((e) => e.source_id),
  ).size;
export function fit(line: Line, draft: Draft, product?: Product) {
  if (line.action !== "buy")
    return {
      status: "not_applicable",
      details: ["No physical purchase check applies."],
    };
  const room = draft.rooms.find((r) => r.id === line.roomId);
  const details: string[] = [];
  let missing = false,
    failed = false;
  if (!product) {
    missing = true;
    details.push("Select a catalog offer for product checks.");
  }
  const required =
    product?.category === "curtains"
      ? ["window_width"]
      : ["available_width", "available_depth"];
  const requirements = [
    ...new Set([...required, ...line.requiredMeasurements]),
  ];
  for (const name of requirements) {
    const m = room?.measurements.find(
      (m) => m.name === name && m.confirmed && m.actor && m.confirmedAt,
    );
    const dimension = name.includes("depth")
      ? product?.depthMm
      : product?.widthMm;
    if (!m || !dimension) {
      missing = true;
      details.push(
        `${name}: confirmed measurement or product dimension missing.`,
      );
      continue;
    }
    const coverage =
      name === "window_width" && product?.category === "curtains";
    const pass = coverage ? dimension >= m.mm : dimension <= m.mm;
    failed ||= !pass;
    details.push(
      `${name}: product ${dimension} mm ${coverage ? "≥" : "≤"} recorded ${m.mm} mm: ${pass ? "passes" : "fails"}.`,
    );
  }
  if (line.manualFit)
    details.push(
      `Additional compatibility confirmed by ${line.manualFit.actor}: ${line.manualFit.note}`,
    );
  return {
    status: failed
      ? "fails_recorded_checks"
      : missing
        ? "needs_information"
        : "passes_recorded_checks",
    details,
  };
}
export function budget(draft: Draft) {
  const missing: string[] = [];
  let items = 0;
  for (const l of draft.lines.filter((l) => l.action === "buy")) {
    if (l.unit === null || l.basis === "unknown") missing.push(l.title);
    if (l.unit !== null) items += l.unit * l.quantity;
  }
  const c = draft.costs;
  for (const k of ["delivery", "installation", "tax"] as const)
    if (c[k] === null) missing.push(k);
  const subtotal =
    items +
    (c.delivery ?? 0) +
    (c.installation ?? 0) +
    (c.tax ?? 0) -
    c.discount;
  if (subtotal < 0) missing.push("Discount exceeds subtotal");
  const contingency =
    c.contingency.kind === "fixed"
      ? c.contingency.value
      : Math.round((Math.max(0, subtotal) * c.contingency.value) / 10000);
  const known = subtotal + contingency;
  const total = missing.length ? null : known;
  return {
    items,
    subtotal,
    contingency,
    known,
    total,
    remaining: total === null ? null : draft.budget - total,
    missing,
    estimated: draft.lines.some((l) => l.basis === "allowance") || !!c.notes,
  };
}
// Unit plan prices are gross EUR: excluded VAT is added once when known.
export const offerUnit = (p: Product) =>
  p.price === null ||
  p.tax === "unknown" ||
  (p.tax === "excluded" && p.additionalTax === null)
    ? null
    : p.price + (p.tax === "excluded" ? (p.additionalTax ?? 0) : 0);
export const offerScope = (p: Product) => ({
  id: p.id,
  name: p.name,
  retailer: p.retailer,
  sku: p.sku,
  url: p.url,
  category: p.category,
  widthMm: p.widthMm,
  depthMm: p.depthMm,
  price: p.price,
  tax: p.tax,
  additionalTax: p.additionalTax,
  deliveryArea: p.deliveryArea,
});
export function offerStatus(
  p: Product,
  settings: Workspace["settings"],
  now = Date.now(),
) {
  if (!p.priceAt || !p.stockAt || !p.verifiedBy) return "unverified";
  return now - Date.parse(p.priceAt) > settings.priceDays * 86400000 ||
    now - Date.parse(p.stockAt) > settings.stockHours * 3600000
    ? "stale"
    : "verified";
}
export function readiness(p: Project, w: Workspace) {
  const b = budget(p.draft);
  const reasons: string[] = [];
  const buys = p.draft.lines.filter((l) => l.action === "buy");
  if (b.missing.length) reasons.push(`Unknown costs: ${b.missing.join(", ")}`);
  if (b.remaining !== null && b.remaining < 0)
    reasons.push("Plan exceeds the recorded budget.");
  if (!p.draft.lines.length) reasons.push("Add at least one intervention.");
  if (p.analysis?.stale && p.draft.issues.some((i) => i.evidence.length))
    reasons.push("Refresh or review changed evidence before submission.");
  for (const l of buys) {
    const item = w.catalog.find((c) => c.id === l.productId);
    if (fit(l, p.draft, item).status === "fails_recorded_checks")
      reasons.push(`${l.title}: recorded fit check failed.`);
    if (item?.tax === "unknown")
      reasons.push(`${l.title}: tax treatment unknown.`);
  }
  const reviewable = !reasons.length;
  const v = p.versions.find((v) => v.id === p.currentVersionId);
  const currentApproved =
    v?.status === "approved" &&
    hash(v.draft) === hash(p.draft) &&
    v.products.every((snapshot) => {
      const current = w.catalog.find((c) => c.id === snapshot.id);
      return (
        current && hash(offerScope(current)) === hash(offerScope(snapshot))
      );
    });
  const buyReasons = [...reasons];
  if (!currentApproved) buyReasons.push("Current revision needs approval.");
  for (const l of buys) {
    const item = w.catalog.find((c) => c.id === l.productId);
    if (!item || offerStatus(item, w.settings) !== "verified")
      buyReasons.push(`${l.title}: current offer verification required.`);
    if (item?.stock !== "in_stock")
      buyReasons.push(`${l.title}: stock not confirmed.`);
    if (fit(l, p.draft, item).status !== "passes_recorded_checks")
      buyReasons.push(`${l.title}: measurements required.`);
    const snapshot = v?.products.find((c) => c.id === l.productId);
    if (
      snapshot &&
      item &&
      hash(offerScope(snapshot)) !== hash(offerScope(item))
    )
      buyReasons.push(
        `${l.title}: catalog facts changed since approval. Edit the intervention and submit a new revision.`,
      );
    if (!l.deliveryConfirmed)
      buyReasons.push(`${l.title}: confirm delivery feasibility.`);
    if (l.basis !== "verified" || !item || l.unit !== offerUnit(item))
      buyReasons.push(`${l.title}: confirm final quoted unit cost.`);
  }
  return {
    reviewable,
    reasons,
    approved: !!currentApproved,
    readyToBuy: buyReasons.length === 0,
    buyReasons,
  };
}
export function emptyProject(
  propertyId: string,
  name = "Comfort refresh",
): Project {
  return {
    id: id(),
    propertyId,
    name,
    revision: 0,
    draft: {
      budget: 70000,
      targetDate: "",
      problems: "",
      rooms: [{ id: id(), name: "Main room", measurements: [], retained: [] }],
      issues: [],
      lines: [],
      costs: {
        delivery: null,
        installation: null,
        tax: null,
        discount: 0,
        contingency: { kind: "fixed", value: 0 },
        notes: "",
      },
      assumptions: [],
    },
    reviews: [],
    observations: [],
    analysis: null,
    runs: [],
    versions: [],
    currentVersionId: null,
    tasks: [],
    followup: { completedDate: "", from: "", to: "", notes: "" },
    events: [],
  };
}
export function fingerprint(
  propertyId: string,
  row: {
    source: string;
    externalId: string;
    text: string;
    date: string | null;
  },
) {
  return hash(
    row.externalId
      ? [propertyId, row.source.toLowerCase(), row.externalId]
      : [
          propertyId,
          row.source.toLowerCase(),
          row.date,
          row.text.trim().replace(/\s+/g, " "),
        ],
  );
}
export type ImportPreview = {
  valid: Review[];
  rejected: { row: number; reason: string }[];
  duplicates: number;
  nearDuplicates: number;
};
export function previewReviews(
  rows: Record<string, unknown>[],
  p: Project,
  source = "CSV",
): ImportPreview {
  if (rows.length > 500) throw Error("Import limit: 500 rows.");
  const valid: Review[] = [],
    rejected: ImportPreview["rejected"] = [];
  let duplicates = 0,
    nearDuplicates = 0;
  const seen = new Set(p.reviews.map((r) => r.fingerprint));
  rows.forEach((row, index) => {
    const text = String(row.review_text ?? "").trim(),
      date = String(row.review_date ?? "").trim() || null;
    if (
      !text ||
      text.length > 6000 ||
      (date &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(Date.parse(date)) ||
          new Date(date).toISOString().slice(0, 10) !== date))
    ) {
      rejected.push({
        row: index + 1,
        reason:
          "Text required (max 6,000 characters); date must be a valid YYYY-MM-DD.",
      });
      return;
    }
    const rating =
      row.rating === "" || row.rating == null ? null : Number(row.rating);
    if (
      rating !== null &&
      (!Number.isFinite(rating) || rating < 0 || rating > 10)
    ) {
      rejected.push({
        row: index + 1,
        reason: "Rating must be between 0 and 10.",
      });
      return;
    }
    const r: Review = {
      id: id(),
      text,
      source: String(row.source || source).slice(0, 100),
      externalId: String(row.external_review_id ?? "").slice(0, 150),
      date,
      rating,
      language: String(row.language ?? "").slice(0, 20),
      excluded: false,
      fingerprint: "",
      importId: "pending",
      createdAt: stamp(),
    };
    r.fingerprint = fingerprint(p.propertyId, r);
    if (seen.has(r.fingerprint)) {
      duplicates++;
      return;
    }
    if (
      [...p.reviews, ...valid].some(
        (x) =>
          x.text.toLowerCase().replace(/\W/g, "") ===
          text.toLowerCase().replace(/\W/g, ""),
      )
    )
      nearDuplicates++;
    seen.add(r.fingerprint);
    valid.push(r);
  });
  return { valid, rejected, duplicates, nearDuplicates };
}
export function demoAnalysis(p: Project): Issue[] {
  const themes = [
    {
      id: "light",
      title: "Early morning light interrupts sleep",
      category: "sleep" as const,
      terms: /early morning light|luce al mattino|daylight/i,
    },
    {
      id: "charging",
      title: "Make bedside charging easier",
      category: "lighting" as const,
      terms: /bedside charging|ricarica.*letto/i,
    },
    {
      id: "storage",
      title: "Add a place for luggage",
      category: "storage" as const,
      terms: /luggage storage|bagagli/i,
    },
  ];
  return themes.flatMap((t) => {
    const matches = p.reviews.filter(
      (r) => !r.excluded && t.terms.test(r.text),
    );
    if (!matches.length) return [];
    return [
      {
        id: t.id,
        title: t.title,
        category: t.category,
        actionClass: "physical_change" as const,
        roomId: p.draft.rooms[0]?.id ?? null,
        evidence: matches.map((r) => ({
          source_type: "review" as const,
          source_id: r.id,
          excerpt: r.text,
        })),
        explanation:
          "Repeated synthetic feedback indicates a practical comfort issue.",
        priority: matches.length >= 5 ? ("high" as const) : ("medium" as const),
        priorityReason:
          "High when five or more distinct reviews mention the issue; otherwise medium.",
        questions: ["Confirm dimensions before purchasing."],
        assumptions: [],
        status: "open" as const,
        resolution: "",
      },
    ];
  });
}
export function followup(p: Project, issue: Issue) {
  const v = p.versions.find((v) => v.status === "approved");
  const baseline = v?.reviews.filter((r) => !r.excluded) ?? [];
  const baselineIds = new Set(baseline.map((r) => r.id));
  const later = p.reviews.filter(
    (r) =>
      !r.excluded &&
      !baselineIds.has(r.id) &&
      r.date &&
      p.followup.from &&
      p.followup.to &&
      r.date >= p.followup.from &&
      r.date <= p.followup.to &&
      (!p.followup.completedDate || r.date > p.followup.completedDate),
  );
  const baseIssue = v?.draft.issues.find((i) => i.id === issue.id);
  const baselineMentions = baseIssue ? supportingCount(baseIssue) : 0;
  const followEvidence =
    p.analysis && !p.analysis.stale
      ? new Set(
          issue.evidence
            .filter((e) => e.source_type === "review")
            .map((e) => e.source_id),
        )
      : null;
  return {
    baseline: baseline.length,
    baselineMentions,
    baselineFrom:
      baseline
        .map((r) => r.date)
        .filter(Boolean)
        .sort()[0] ?? null,
    baselineTo:
      baseline
        .map((r) => r.date)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
    later: later.length,
    mentions: followEvidence
      ? later.filter((r) => followEvidence.has(r.id)).length
      : null,
  };
}
function ensureDraft(p: Project) {
  p.currentVersionId = null;
}
export function applyAction(input: Workspace, action: Action): Workspace {
  const w = structuredClone(input);
  if (action.type === "persona") {
    if (!w.demo) throw Error("Persona switching is available only in demo.");
    const m = w.members.find((m) => m.id === action.memberId);
    if (!m) throw Error("Unknown member.");
    w.actor = { ...m };
    return w;
  }
  if (action.type === "settings") {
    if (w.actor.role !== "administrator")
      throw Error("Administrator access required.");
    w.settings = action.settings;
    return workspaceSchema.parse(w);
  }
  if (action.type === "addProperty") {
    if (!canEdit(w)) throw Error("Editing access required.");
    const propertyId = id();
    w.properties.push({
      id: propertyId,
      name: action.name,
      city: action.city,
      country: "Italy",
      projects: [],
      library: [],
    });
    return workspaceSchema.parse(w);
  }
  if (action.type === "deleteProperty") {
    authorize(w, action.propertyId, true);
    if (w.actor.role !== "administrator")
      throw Error("Administrator access required.");
    w.properties = w.properties.filter((p) => p.id !== action.propertyId);
    return w;
  }
  if (action.type === "addProject") {
    authorize(w, action.propertyId, true);
    w.properties
      .find((p) => p.id === action.propertyId)!
      .projects.push(emptyProject(action.propertyId, action.name));
    return w;
  }
  if (action.type === "saveProduct") {
    if (!canEdit(w)) throw Error("Editing access required.");
    if (action.product.synthetic !== w.demo)
      throw Error("Demo and live catalog records cannot mix.");
    const old = w.catalog.find((c) => c.id === action.product.id);
    const product = { ...action.product };
    if (action.verify) {
      if (!product.verificationSource.trim())
        throw Error("Record a human verification source.");
      product.verifiedBy = w.actor.name;
      product.priceAt = stamp();
      product.stockAt = stamp();
    } else if (
      !old ||
      hash({ ...product, verifiedBy: null, priceAt: null, stockAt: null }) !==
        hash({ ...old, verifiedBy: null, priceAt: null, stockAt: null })
    ) {
      product.verifiedBy = null;
      product.priceAt = null;
      product.stockAt = null;
    } else if (old) {
      product.verifiedBy = old.verifiedBy;
      product.priceAt = old.priceAt;
      product.stockAt = old.stockAt;
    }
    w.catalog = w.catalog.filter((c) => c.id !== product.id).concat(product);
    return workspaceSchema.parse(w);
  }
  const property = w.properties.find((p) =>
    p.projects.some((p) => p.id === action.projectId),
  );
  const p = property?.projects.find((p) => p.id === action.projectId);
  if (!property || !p) throw Error("Project not found.");
  authorize(w, property.id, action.type !== "decide");
  if (
    action.type === "submit" &&
    p.currentVersionId &&
    p.versions.some(
      (v) =>
        v.id === p.currentVersionId &&
        v.status === "submitted" &&
        v.hash === hash(p.draft),
    )
  )
    return input;
  if (action.type === "decide") {
    const existing = p.versions.find((v) => v.id === action.versionId);
    if (
      existing?.status === action.decision &&
      existing.decision?.actor === w.actor.name &&
      existing.decision.note === action.note
    ) {
      if (!canApprove(w, property.id)) throw Error("Approval rights required.");
      return input;
    }
  }
  if (action.expected !== p.revision)
    throw Error("This project changed. Reload before saving or deciding.");
  if (action.type === "deleteProject") {
    property.projects = property.projects.filter((x) => x.id !== p.id);
    return w;
  }
  if (action.type === "saveDraft") {
    validateEvidence(action.draft.issues, { ...p, draft: action.draft });
    for (const line of action.draft.lines) {
      if (line.productId && !w.catalog.some((c) => c.id === line.productId))
        throw Error("Unknown catalog reference.");
      if (line.roomId && !action.draft.rooms.some((r) => r.id === line.roomId))
        throw Error("Unknown room reference.");
      if (
        line.issueIds.some(
          (id) => !action.draft.issues.some((i) => i.id === id),
        )
      )
        throw Error("Unknown issue reference.");
    }

    const prior = hash(p.draft);
    const draft = structuredClone(action.draft);
    for (const room of draft.rooms)
      for (const measurement of room.measurements) {
        const old = p.draft.rooms
          .find((r) => r.id === room.id)
          ?.measurements.find((m) => m.id === measurement.id);
        if (
          measurement.confirmed &&
          (!old ||
            hash({ ...measurement, actor: null, confirmedAt: null }) !==
              hash({ ...old, actor: null, confirmedAt: null }))
        ) {
          measurement.actor = w.actor.name;
          measurement.confirmedAt = stamp();
        } else if (measurement.confirmed && old) {
          measurement.actor = old.actor;
          measurement.confirmedAt = old.confirmedAt;
        } else {
          measurement.actor = null;
          measurement.confirmedAt = null;
        }
      }
    for (const line of draft.lines)
      if (line.manualFit) {
        const old = p.draft.lines.find((l) => l.id === line.id)?.manualFit;
        line.manualFit =
          old && old.note === line.manualFit.note
            ? old
            : { actor: w.actor.name, at: stamp(), note: line.manualFit.note };
      }
    const current = p.versions.find((v) => v.id === p.currentVersionId);
    const changedOffer = current?.products.some((snapshot) => {
      const item = w.catalog.find((c) => c.id === snapshot.id);
      return !item || hash(offerScope(item)) !== hash(offerScope(snapshot));
    });
    p.draft = draft;
    if (hash(p.draft) !== prior || changedOffer) ensureDraft(p);
  } else if (action.type === "importReviews") {
    const result = previewReviews(action.rows, p, action.source);
    const importId = id();
    for (const row of result.valid) {
      let canonical = property.library.find(
        (r) => r.fingerprint === row.fingerprint,
      );
      if (!canonical) {
        canonical = { ...row, id: "REVIEW-" + row.fingerprint, importId };
        property.library.push(structuredClone(canonical));
      }
      p.reviews.push(structuredClone(canonical));
    }
    if (result.valid.length && p.analysis) {
      p.analysis.stale = true;
      ensureDraft(p);
    }
  } else if (action.type === "attachReviews") {
    for (const reviewId of action.reviewIds) {
      const canonical = property.library.find((r) => r.id === reviewId);
      if (!canonical) throw Error("Property review not found.");
      if (!p.reviews.some((r) => r.id === reviewId))
        p.reviews.push(structuredClone(canonical));
    }
    if (p.analysis) {
      p.analysis.stale = true;
      ensureDraft(p);
    }
  } else if (action.type === "editReview") {
    const old = p.reviews.find((r) => r.id === action.review.id);
    if (!old) throw Error("Review not found.");
    Object.assign(old, action.review, {
      fingerprint: fingerprint(p.propertyId, action.review),
    });
    property.library = property.library.map((r) =>
      r.id === old.id ? structuredClone(old) : r,
    );
    for (const sibling of property.projects) {
      if (sibling.id === p.id || !sibling.reviews.some((r) => r.id === old.id))
        continue;
      sibling.reviews = sibling.reviews.map((r) =>
        r.id === old.id ? structuredClone(old) : r,
      );
      if (sibling.analysis) sibling.analysis.stale = true;
      ensureDraft(sibling);
      sibling.revision++;
      sibling.events.push({
        at: stamp(),
        actor: w.actor.name,
        action: "Shared review edited",
      });
    }
    if (p.analysis) {
      p.analysis.stale = true;
      ensureDraft(p);
    }
  } else if (action.type === "addObservation") {
    const observation = { id: id(), text: action.text };
    p.observations.push(observation);
    p.draft.issues.push({
      id: id(),
      title: action.title,
      category: "other",
      actionClass: action.actionClass,
      roomId: null,
      evidence: [
        {
          source_type: "operator_observation",
          source_id: observation.id,
          excerpt: observation.text,
        },
      ],
      explanation: observation.text,
      priority: "medium",
      priorityReason: "Operator assessment; review before approval.",
      questions: [],
      assumptions: [],
      status: "open",
      resolution: "",
    });
    ensureDraft(p);
  } else if (action.type === "reviewEvidence") {
    validateEvidence(p.draft.issues, p);
    p.analysis = {
      inputHash: hash(reviewInput(p)),
      reviewIds: p.reviews.filter((r) => !r.excluded).map((r) => r.id),
      stale: false,
      at: stamp(),
    };
    ensureDraft(p);
  } else if (action.type === "analyzeDemo") {
    if (!w.demo)
      throw Error("Use the configured AI service or enter issues manually.");
    p.draft.issues = [
      ...demoAnalysis(p),
      ...p.draft.issues.filter((i) =>
        i.evidence.some((e) => e.source_type === "operator_observation"),
      ),
    ];
    p.draft.lines = p.draft.lines.filter(
      (l) =>
        !l.issueIds.length ||
        l.issueIds.some((id) => p.draft.issues.some((i) => i.id === id)),
    );
    p.analysis = {
      inputHash: hash(reviewInput(p)),
      reviewIds: p.reviews.filter((r) => !r.excluded).map((r) => r.id),
      stale: false,
      at: stamp(),
    };
    ensureDraft(p);
  } else if (action.type === "suggestDemo") {
    if (!w.demo) throw Error("Demo suggestions are unavailable in live mode.");
    p.draft.lines = p.draft.issues
      .filter((i) => i.status === "open")
      .map((issue) => {
        const category =
          issue.category === "sleep"
            ? "curtains"
            : issue.category === "lighting"
              ? "bedside"
              : issue.category === "storage"
                ? "storage"
                : "other";
        const product =
          issue.actionClass === "physical_change"
            ? w.catalog.find((c) => c.category === category)
            : undefined;
        const action =
          issue.actionClass === "operational_change"
            ? ("operational_change" as const)
            : issue.actionClass === "inspect_first" ||
                issue.actionClass === "uncertain"
              ? ("inspect" as const)
              : ("buy" as const);
        return {
          id: id(),
          issueIds: [issue.id],
          roomId: issue.roomId,
          action,
          title: product?.name ?? issue.title,
          reason: issue.explanation,
          productId: product?.id ?? null,
          quantity: 1,
          unit: action === "buy" ? (product?.price ?? null) : 0,
          basis:
            action === "buy" ? ("allowance" as const) : ("verified" as const),
          requiredMeasurements:
            action !== "buy"
              ? []
              : category === "curtains"
                ? ["window_width"]
                : ["available_width", "available_depth"],
          retained:
            p.draft.rooms.find((r) => r.id === issue.roomId)?.retained ?? [],
          questions: issue.questions,
          dependencies: [],
          manualFit: null,
          deliveryConfirmed: false,
        };
      });
    ensureDraft(p);
  } else if (action.type === "submit") {
    if (
      p.currentVersionId &&
      p.versions.some(
        (v) => v.id === p.currentVersionId && v.status === "submitted",
      )
    )
      return input;
    const r = readiness(p, w);
    if (!r.reviewable) throw Error(r.reasons.join(" "));
    validateEvidence(p.draft.issues, p);
    const version: Version = {
      id: id(),
      number: p.versions.length + 1,
      createdAt: stamp(),
      actor: w.actor.name,
      draft: structuredClone(p.draft),
      products: w.catalog.filter((c) =>
        p.draft.lines.some((l) => l.productId === c.id),
      ),
      reviews: structuredClone(p.reviews.filter((r) => !r.excluded)),
      observations: structuredClone(p.observations),
      inputHash: hash(reviewInput(p)),
      status: "submitted",
      decision: null,
      hash: hash(p.draft),
    };
    p.versions.push(version);
    p.currentVersionId = version.id;
  } else if (action.type === "decide") {
    if (!canApprove(w, property.id))
      throw Error("You do not have approval rights for this property.");
    const v = p.versions.find((v) => v.id === action.versionId);
    if (
      !v ||
      v.id !== p.currentVersionId ||
      v.status !== "submitted" ||
      hash(p.draft) !== v.hash
    )
      throw Error(
        "Only the current, unchanged submitted revision can be decided.",
      );
    v.status = action.decision;
    v.decision = { actor: w.actor.name, at: stamp(), note: action.note };
    if (action.decision === "approved") {
      p.tasks.push(
        ...v.draft.lines
          .filter((l) => l.action !== "defer" && l.action !== "keep")
          .map((l) => ({
            id: id(),
            versionId: v.id,
            title: l.title,
            assignee: "",
            due: p.draft.targetDate,
            status: "todo" as const,
            kind:
              l.action === "buy" ? ("purchase" as const) : ("work" as const),
            actual: null,
            completedAt: null,
            dependencies: l.dependencies,
          })),
        ...v.draft.lines
          .filter((l) => l.action === "buy")
          .map((l) => ({
            id: id(),
            versionId: v.id,
            title: `Verify measurements and delivery: ${l.title}`,
            assignee: "",
            due: p.draft.targetDate,
            status: "todo" as const,
            kind: "verification" as const,
            actual: null,
            completedAt: null,
            dependencies: [],
          })),
      );
    } else ensureDraft(p);
  } else if (action.type === "saveTask") {
    const task = p.tasks.find((t) => t.id === action.task.id);
    if (!task || task.versionId !== action.task.versionId)
      throw Error("Unknown approved task.");
    const version = p.versions.find((v) => v.id === task.versionId);
    if (version?.status !== "approved")
      throw Error("Task must reference an approved version.");
    if (
      action.task.kind !== task.kind ||
      action.task.title !== task.title ||
      hash(action.task.dependencies) !== hash(task.dependencies)
    )
      throw Error("Scope changes require a new draft.");
    if (
      action.task.status !== "todo" &&
      task.kind === "purchase" &&
      (!readiness(p, w).readyToBuy || task.versionId !== p.currentVersionId)
    )
      throw Error(
        "Complete purchase readiness checks for the current approved version first.",
      );
    if (
      action.task.status === "done" &&
      task.dependencies.some(
        (dep) => !p.tasks.some((t) => t.title === dep && t.status === "done"),
      )
    )
      throw Error("Complete task dependencies first.");
    Object.assign(task, action.task, {
      completedAt:
        action.task.status === "done" ? (task.completedAt ?? stamp()) : null,
    });
  } else if (action.type === "saveFollowup") {
    p.followup = action.followup;
  }
  p.revision++;
  p.events.push({ at: stamp(), actor: w.actor.name, action: action.type });
  return workspaceSchema.parse(w);
}
export function csvSafe(value: unknown) {
  const str = String(value ?? "");
  return (
    '"' +
    (/^[\s]*[=+\-@\t\r]/.test(str) ? "'" + str : str).replaceAll('"', '""') +
    '"'
  );
}
export function exportProject(
  w: Workspace,
  p: Project,
  versionId: string | null,
) {
  authorize(w, p.propertyId);
  const v = versionId ? p.versions.find((v) => v.id === versionId) : null;
  if (versionId && !v) throw Error("Version not found.");
  return {
    label: `${w.demo ? "DEMO — SYNTHETIC DATA · " : ""}${v ? "Revision " + v.number + " · " + v.status : "DRAFT"}`,
    exportedAt: stamp(),
    workspace: w.name,
    property: w.properties.find((x) => x.id === p.propertyId)?.name,
    project: p.name,
    version: v?.number ?? null,
    createdAt: v?.createdAt ?? null,
    draft: v?.draft ?? p.draft,
    products:
      v?.products ??
      w.catalog.filter((c) => p.draft.lines.some((l) => l.productId === c.id)),
    reviews: v?.reviews ?? p.reviews,
    observations: v?.observations ?? p.observations,
    inputHash: v?.inputHash ?? hash(reviewInput(p)),
    decision: v?.decision ?? null,
    budget: budget(v?.draft ?? p.draft),
    tasks: p.tasks.filter((t) => !v || t.versionId === v.id),
  };
}
export function shoppingCSV(data: ReturnType<typeof exportProject>) {
  return [
    [
      "Label",
      "Version",
      "Date",
      "Action",
      "Item",
      "Product URL",
      "Quantity",
      "Unit EUR",
      "Cost basis",
      "Issue IDs",
      "Evidence",
      "Conditions",
      "Delivery EUR (plan)",
      "Installation EUR (plan)",
      "Tax EUR (plan)",
      "Discount EUR (plan)",
      "Contingency EUR (plan)",
      "Budget EUR",
    ],
    ...data.draft.lines.map((l) => [
      data.label,
      data.version ?? "draft",
      data.createdAt ?? data.exportedAt,
      l.action,
      l.title,
      data.products.find((p) => p.id === l.productId)?.url ?? "",
      l.quantity,
      l.unit === null ? "unknown" : (l.unit / 100).toFixed(2),
      l.basis,
      l.issueIds.join("; "),
      data.draft.issues
        .filter((i) => l.issueIds.includes(i.id))
        .flatMap((i) => i.evidence.map((e) => `${e.source_id}: ${e.excerpt}`))
        .join("; "),
      [...l.questions, ...data.draft.assumptions].join("; "),
      data.draft.costs.delivery === null
        ? "unknown"
        : data.draft.costs.delivery / 100,
      data.draft.costs.installation === null
        ? "unknown"
        : data.draft.costs.installation / 100,
      data.draft.costs.tax === null ? "unknown" : data.draft.costs.tax / 100,
      data.draft.costs.discount / 100,
      data.budget.contingency / 100,
      data.draft.budget / 100,
    ]),
  ]
    .map((row) => row.map(csvSafe).join(","))
    .join("\r\n");
}
