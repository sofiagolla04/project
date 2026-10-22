import Papa from "papaparse";
import { Product, id } from "./model";
export function parseCSV(text: string) {
  if (new TextEncoder().encode(text).length > 3_000_000)
    throw Error("CSV limit: 3 MB.");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  if (result.errors.filter((e) => e.code !== "UndetectableDelimiter").length)
    throw Error(
      `CSV row ${result.errors[0].row ?? 0}: ${result.errors[0].message}`,
    );
  if (result.data.length > 500) throw Error("Import limit: 500 rows.");
  return { rows: result.data, fields: result.meta.fields ?? [] };
}
export function catalogRows(
  rows: Record<string, string>[],
  synthetic: boolean,
) {
  return rows.map((r, index) => {
    const product: Product = {
      id: id(),
      name: r.name ?? "",
      retailer: r.retailer ?? "",
      sku: r.sku ?? "",
      url: r.url ?? "",
      category: (r.category || "other") as Product["category"],
      widthMm: r.width_mm ? Number(r.width_mm) : null,
      depthMm: r.depth_mm ? Number(r.depth_mm) : null,
      price: r.price_eur ? Math.round(Number(r.price_eur) * 100) : null,
      currency: "EUR",
      tax: (r.tax || "unknown") as Product["tax"],
      additionalTax: null,
      stock: "unknown",
      deliveryArea: r.delivery_area ?? "",
      deliveryDays: null,
      priceAt: null,
      stockAt: null,
      verifiedBy: null,
      verificationSource: "",
      notes: `CSV row ${index + 1}; requires human verification.`,
      synthetic,
    };
    return product;
  });
}
export const reviewTemplate =
  'review_text,external_review_id,review_date,source,rating,language\r\n"The bedroom was comfortable.",example-1,2026-09-01,direct,8,en\r\n';
export const catalogTemplate =
  "name,retailer,sku,url,category,width_mm,depth_mm,price_eur,tax,delivery_area\r\n";
export function download(name: string, body: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
