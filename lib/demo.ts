import { Workspace, Product, id, stamp } from "./model";
import {
  demoAnalysis,
  emptyProject,
  fingerprint,
  hash,
  reviewInput,
} from "./domain";
export const DEMO_STORAGE = "host-upgrade-planner:demo:v1";
export function demoWorkspace(): Workspace {
  const propertyId = "demo-property";
  const p = emptyProject(propertyId, "A calmer stay · Studio refresh");
  p.id = "demo-project";
  p.draft.rooms[0].id = "demo-studio";
  p.draft.rooms[0].name = "Studio";
  p.draft.rooms[0].retained = ["Oak bed frame", "Dining table", "Wardrobe"];
  p.draft.targetDate = "2026-11-15";
  p.draft.problems =
    "Improve sleep, bedside convenience and luggage storage while keeping the useful furniture.";
  p.reviews = Array.from({ length: 40 }, (_, i) => {
    const n = i + 1;
    const text = [
      `Synthetic stay ${String(n).padStart(2, "0")}. A welcoming studio in a convenient neighbourhood.`,
      ...(n <= 8 ? ["Early morning light made it difficult to sleep."] : []),
      ...(n >= 4 && n <= 8 ? ["Bedside charging was inconvenient."] : []),
      ...(n >= 8 && n <= 10 ? ["Luggage storage was limited."] : []),
      ...(n > 10 ? ["The apartment was clean and the host was helpful."] : []),
    ].join(" ");
    const row = {
      id: `DEMO-R${String(n).padStart(2, "0")}`,
      text,
      source: "Synthetic",
      date: `2026-09-${String(Math.min(n, 28)).padStart(2, "0")}`,
      externalId: `DEMO-R${String(n).padStart(2, "0")}`,
      rating: 8,
      language: "en",
      excluded: false,
      fingerprint: "",
      importId: "demo-seed",
      createdAt: stamp(),
    };
    row.fingerprint = fingerprint(propertyId, row);
    return row;
  });
  p.draft.issues = demoAnalysis(p);
  p.analysis = {
    inputHash: hash(reviewInput(p)),
    reviewIds: p.reviews.map((r) => r.id),
    stale: false,
    at: stamp(),
  };
  const products: Product[] = [
    ["curtains", "Blackout curtains & fittings", "curtains", 15000, 1400, 50],
    ["bedside", "Bedside light & charging point", "bedside", 10000, 180, 160],
    ["luggage", "Folding luggage rack", "storage", 7000, 650, 450],
  ].map(([key, name, category, price, width, depth]) => ({
    id: String(key),
    name: String(name),
    retailer: "Synthetic catalog",
    sku: "DEMO-" + key,
    url: "",
    category: category as Product["category"],
    widthMm: Number(width),
    depthMm: Number(depth),
    price: Number(price),
    currency: "EUR",
    tax: "included",
    additionalTax: 0,
    stock: "unknown",
    deliveryArea: "Florence · synthetic example",
    deliveryDays: null,
    priceAt: null,
    stockAt: null,
    verifiedBy: null,
    verificationSource: "",
    notes:
      "Invented planning allowance. Confirm measurements, stock and delivery before buying.",
    synthetic: true,
  }));
  p.draft.lines = products.map((product, index) => ({
    id: id(),
    issueIds: [p.draft.issues[index].id],
    roomId: "demo-studio",
    action: "buy",
    title: product.name,
    reason: p.draft.issues[index].explanation,
    productId: product.id,
    quantity: 1,
    unit: product.price,
    basis: "allowance",
    requiredMeasurements:
      product.category === "curtains"
        ? ["window_width"]
        : ["available_width", "available_depth"],
    retained: p.draft.rooms[0].retained,
    questions: [
      "Measure the installation space.",
      "Confirm delivery before the next stay.",
    ],
    dependencies: [],
    manualFit: null,
    deliveryConfirmed: false,
  }));
  p.draft.costs = {
    delivery: 9000,
    installation: 0,
    tax: 0,
    discount: 0,
    contingency: { kind: "fixed", value: 9000 },
    notes:
      "Synthetic allowances; delivery and installation are grouped in the €90 delivery allowance. VAT included. Installation has a known zero incremental cost in this example.",
  };
  p.draft.assumptions = [
    "All offers and costs are synthetic.",
    "Measurements and final availability remain unconfirmed.",
  ];
  const members: Workspace["members"] = [
    {
      id: "demo-operator",
      name: "Alex · operator",
      role: "operator",
      approvalProperties: [],
    },
    {
      id: "demo-owner",
      name: "Sofia · owner",
      role: "administrator",
      approvalProperties: [propertyId],
    },
    {
      id: "demo-approver",
      name: "Luca · approver",
      role: "approver",
      approvalProperties: [propertyId],
    },
  ];
  return {
    id: "demo-workspace",
    name: "Oliva Stays",
    actor: members[0],
    members,
    properties: [
      {
        id: propertyId,
        name: "Santa Croce Studio",
        city: "Florence",
        country: "Italy",
        projects: [p],
        library: structuredClone(p.reviews),
      },
      {
        id: "demo-second",
        name: "San Frediano Apartment",
        city: "Florence",
        country: "Italy",
        projects: [],
        library: [],
      },
    ],
    catalog: products,
    settings: {
      locale: "en-IE",
      timezone: "Europe/Rome",
      priceDays: 7,
      stockHours: 24,
      pilotFee: 14900,
    },
    demo: true,
  };
}
