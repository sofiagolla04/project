import { z } from "zod";
export const id = () => crypto.randomUUID();
export const stamp = () => new Date().toISOString();
export const cents = z.number().int().min(0).max(100_000_000);
export const nullableCost = cents.nullable();
export const roleSchema = z.enum(["administrator", "operator", "approver"]);
export type Role = z.infer<typeof roleSchema>;
export const reviewSchema = z.object({
  id: z.string(),
  text: z.string().trim().min(1).max(6000),
  source: z.string().max(100),
  date: z.string().nullable(),
  externalId: z.string().max(150),
  rating: z.number().min(0).max(10).nullable(),
  language: z.string().max(20),
  excluded: z.boolean(),
  fingerprint: z.string(),
  importId: z.string(),
  createdAt: z.string(),
});
export type Review = z.infer<typeof reviewSchema>;
export const evidenceSchema = z.object({
  source_type: z.enum(["review", "operator_observation"]),
  source_id: z.string(),
  excerpt: z.string().min(1).max(1500),
});
export const issueSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  category: z.enum([
    "sleep",
    "lighting",
    "storage",
    "workspace",
    "comfort",
    "cleanliness",
    "check_in",
    "maintenance",
    "other",
  ]),
  actionClass: z.enum([
    "physical_change",
    "operational_change",
    "inspect_first",
    "uncertain",
  ]),
  roomId: z.string().nullable(),
  evidence: z.array(evidenceSchema).max(100),
  explanation: z.string().max(2000),
  priority: z.enum(["high", "medium", "low"]),
  priorityReason: z.string().max(500),
  questions: z.array(z.string()),
  assumptions: z.array(z.string()),
  status: z.enum(["open", "dismissed", "resolved"]),
  resolution: z.string(),
});
export type Issue = z.infer<typeof issueSchema>;
export const measurementSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  mm: z.number().positive().max(100000),
  source: z.string(),
  confirmed: z.boolean(),
  actor: z.string().nullable(),
  confirmedAt: z.string().nullable(),
});
export type Measurement = z.infer<typeof measurementSchema>;
export const roomSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  measurements: z.array(measurementSchema),
  retained: z.array(z.string()),
});
export const productSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(150),
  retailer: z.string().max(150),
  sku: z.string().max(100),
  url: z.string().refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Use an HTTPS URL without credentials"),
  category: z.enum(["curtains", "bedside", "storage", "other"]),
  widthMm: z.number().positive().nullable(),
  depthMm: z.number().positive().nullable(),
  price: nullableCost,
  currency: z.literal("EUR"),
  tax: z.enum(["included", "excluded", "unknown"]),
  additionalTax: nullableCost,
  stock: z.enum(["in_stock", "out_of_stock", "unknown"]),
  deliveryArea: z.string(),
  deliveryDays: z.number().int().nonnegative().nullable(),
  priceAt: z.string().nullable(),
  stockAt: z.string().nullable(),
  verifiedBy: z.string().nullable(),
  verificationSource: z.string(),
  notes: z.string(),
  synthetic: z.boolean(),
});
export type Product = z.infer<typeof productSchema>;
export const lineSchema = z.object({
  id: z.string(),
  issueIds: z.array(z.string()),
  roomId: z.string().nullable(),
  action: z.enum([
    "buy",
    "rearrange",
    "keep",
    "operational_change",
    "inspect",
    "defer",
  ]),
  title: z.string().min(1).max(200),
  reason: z.string(),
  productId: z.string().nullable(),
  quantity: z.number().int().min(1).max(100),
  unit: nullableCost,
  basis: z.enum(["verified", "allowance", "unknown"]),
  requiredMeasurements: z.array(z.string()),
  retained: z.array(z.string()),
  questions: z.array(z.string()),
  dependencies: z.array(z.string()),
  manualFit: z
    .object({ actor: z.string(), at: z.string(), note: z.string() })
    .nullable(),
  deliveryConfirmed: z.boolean(),
});
export type Line = z.infer<typeof lineSchema>;
export const costSchema = z.object({
  delivery: nullableCost,
  installation: nullableCost,
  tax: nullableCost,
  discount: cents,
  contingency: z.object({
    kind: z.enum(["fixed", "percent"]),
    value: z.number().int().min(0).max(100000000),
  }),
  notes: z.string(),
});
export const draftSchema = z.object({
  budget: cents,
  targetDate: z.string(),
  problems: z.string(),
  rooms: z.array(roomSchema),
  issues: z.array(issueSchema),
  lines: z.array(lineSchema),
  costs: costSchema,
  assumptions: z.array(z.string()),
});
export type Draft = z.infer<typeof draftSchema>;
export const versionSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  createdAt: z.string(),
  actor: z.string(),
  draft: draftSchema,
  products: z.array(productSchema),
  reviews: z.array(reviewSchema),
  observations: z.array(z.object({ id: z.string(), text: z.string() })),
  inputHash: z.string(),
  status: z.enum(["submitted", "approved", "rejected", "changes_requested"]),
  decision: z
    .object({ actor: z.string(), at: z.string(), note: z.string() })
    .nullable(),
  hash: z.string(),
});
export type Version = z.infer<typeof versionSchema>;
export const taskSchema = z.object({
  id: z.string(),
  versionId: z.string(),
  title: z.string(),
  assignee: z.string(),
  due: z.string(),
  status: z.enum(["todo", "in_progress", "done"]),
  kind: z.enum(["verification", "purchase", "work"]),
  actual: nullableCost,
  completedAt: z.string().nullable(),
  dependencies: z.array(z.string()),
});
export const projectSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  name: z.string().min(1).max(150),
  revision: z.number().int().nonnegative(),
  draft: draftSchema,
  reviews: z.array(reviewSchema).max(3000),
  observations: z.array(
    z.object({ id: z.string(), text: z.string().max(6000) }),
  ),
  analysis: z
    .object({
      inputHash: z.string(),
      reviewIds: z.array(z.string()),
      stale: z.boolean(),
      at: z.string(),
    })
    .nullable(),
  runs: z.array(
    z.object({
      id: z.string(),
      stage: z.string(),
      status: z.enum(["running", "completed", "failed"]),
      inputHash: z.string(),
      provider: z.string(),
      model: z.string(),
      promptVersion: z.string(),
      at: z.string(),
      finishedAt: z.string().nullable(),
      error: z.string().nullable(),
      usage: z.record(z.string(), z.unknown()).nullable(),
    }),
  ),
  versions: z.array(versionSchema),
  currentVersionId: z.string().nullable(),
  tasks: z.array(taskSchema),
  followup: z.object({
    completedDate: z.string(),
    from: z.string(),
    to: z.string(),
    notes: z.string(),
  }),
  events: z
    .array(z.object({ at: z.string(), actor: z.string(), action: z.string() }))
    .max(5000),
});
export type Project = z.infer<typeof projectSchema>;
export const propertySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(150),
  city: z.string().max(100),
  country: z.string().max(100),
  projects: z.array(projectSchema),
  library: z.array(reviewSchema),
});
export type Property = z.infer<typeof propertySchema>;
export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  actor: z.object({
    id: z.string(),
    name: z.string(),
    role: roleSchema,
    approvalProperties: z.array(z.string()),
  }),
  members: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      role: roleSchema,
      approvalProperties: z.array(z.string()),
    }),
  ),
  properties: z.array(propertySchema),
  catalog: z.array(productSchema),
  settings: z.object({
    locale: z.string(),
    timezone: z.string(),
    priceDays: z.number().int().min(1).max(365),
    stockHours: z.number().int().min(1).max(720),
    pilotFee: cents,
  }),
  demo: z.boolean(),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("addProperty"),
    name: z.string().min(1).max(150),
    city: z.string().max(100),
  }),
  z.object({
    type: z.literal("addProject"),
    propertyId: z.string(),
    name: z.string().min(1).max(150),
  }),
  z.object({
    type: z.literal("deleteProject"),
    projectId: z.string(),
    expected: z.number().int(),
  }),
  z.object({
    type: z.literal("saveDraft"),
    projectId: z.string(),
    expected: z.number(),
    draft: draftSchema,
  }),
  z.object({
    type: z.literal("attachReviews"),
    projectId: z.string(),
    expected: z.number().int(),
    reviewIds: z.array(z.string()).max(500),
  }),
  z.object({
    type: z.literal("importReviews"),
    projectId: z.string(),
    expected: z.number(),
    rows: z.array(z.record(z.string(), z.unknown())).max(500),
    source: z.string().max(100),
  }),
  z.object({
    type: z.literal("editReview"),
    projectId: z.string(),
    expected: z.number(),
    review: reviewSchema,
  }),
  z.object({
    type: z.literal("addObservation"),
    projectId: z.string(),
    expected: z.number(),
    text: z.string().trim().min(1).max(6000),
    title: z.string().min(1).max(200),
    actionClass: issueSchema.shape.actionClass,
  }),
  z.object({
    type: z.literal("reviewEvidence"),
    projectId: z.string(),
    expected: z.number(),
  }),
  z.object({
    type: z.literal("suggestDemo"),
    projectId: z.string(),
    expected: z.number().int(),
  }),
  z.object({
    type: z.literal("analyzeDemo"),
    projectId: z.string(),
    expected: z.number(),
  }),
  z.object({
    type: z.literal("submit"),
    projectId: z.string(),
    expected: z.number(),
  }),
  z.object({
    type: z.literal("decide"),
    projectId: z.string(),
    expected: z.number(),
    versionId: z.string(),
    decision: z.enum(["approved", "rejected", "changes_requested"]),
    note: z.string().max(2000),
  }),
  z.object({
    type: z.literal("saveProduct"),
    product: productSchema,
    verify: z.boolean(),
  }),
  z.object({
    type: z.literal("saveTask"),
    projectId: z.string(),
    expected: z.number(),
    task: taskSchema,
  }),
  z.object({
    type: z.literal("saveFollowup"),
    projectId: z.string(),
    expected: z.number(),
    followup: projectSchema.shape.followup,
  }),
  z.object({ type: z.literal("deleteProperty"), propertyId: z.string() }),
  z.object({
    type: z.literal("settings"),
    settings: workspaceSchema.shape.settings,
  }),
  z.object({ type: z.literal("persona"), memberId: z.string() }),
]);
export type Action = z.infer<typeof actionSchema>;
