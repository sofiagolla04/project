"use client";
import { useState } from "react";
import {
  Plus,
  Upload,
  Download,
  Package,
  ShieldCheck,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Workspace, Action, Product, id, productSchema } from "@/lib/model";
import { money, canEdit, offerStatus } from "@/lib/domain";
import { catalogRows, parseCSV, download, catalogTemplate } from "@/lib/csv";
import { Badge, Empty, Field, Modal, SectionHead, cost, text, num } from "./ui";
import { Form } from "./ui";
type Props = {
  w: Workspace;
  dispatch: (action: Action) => Promise<boolean>;
  busy: boolean;
  notify: (message: string) => void;
};
function blankProduct(demo: boolean): Product {
  return {
    id: id(),
    name: "",
    retailer: "",
    sku: "",
    url: "",
    category: "other",
    widthMm: null,
    depthMm: null,
    price: null,
    currency: "EUR",
    tax: "unknown",
    additionalTax: null,
    stock: "unknown",
    deliveryArea: "",
    deliveryDays: null,
    priceAt: null,
    stockAt: null,
    verifiedBy: null,
    verificationSource: "",
    notes: "",
    synthetic: demo,
  };
}
export function Catalog({ w, dispatch, busy }: Props) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [csv, setCsv] = useState<{
    valid: Product[];
    invalid: string[];
  } | null>(null);
  const [error, setError] = useState("");
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">CONSIDERED CHOICES, RECORDED FACTS</p>
          <h1>
            Your product catalog<span className="green">.</span>
          </h1>
          <p>
            Specific offers, checked by a person. A link alone is not
            verification.
          </p>
        </div>
        {canEdit(w) && (
          <button
            className="primary"
            onClick={() => setEditing(blankProduct(w.demo))}
          >
            <Plus size={15} />
            Add product
          </button>
        )}
      </div>
      <div className="notice">
        <ShieldCheck size={19} />
        <span>
          Price freshness: {w.settings.priceDays} days. Stock & delivery
          freshness: {w.settings.stockHours} hours. These are application
          policies, not retailer guarantees.
          {w.demo ? " All demo offers are synthetic." : ""}
        </span>
      </div>
      <div className="row wrap catalog-tools">
        <button
          className="secondary"
          onClick={() =>
            download("catalog-template.csv", catalogTemplate, "text/csv")
          }
        >
          <Download size={14} />
          Catalog CSV template
        </button>
        {canEdit(w) && (
          <label className="file-label">
            <Upload size={14} />
            Import catalog CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 3000000) throw Error("CSV limit: 3 MB.");
                  const parsed = parseCSV(await file.text());
                  const valid: Product[] = [],
                    invalid: string[] = [];
                  catalogRows(parsed.rows, w.demo).forEach((row, i) => {
                    const result = productSchema.safeParse(row);
                    if (result.success) valid.push(result.data);
                    else
                      invalid.push(
                        `Row ${i + 1}: ${result.error.issues.map((x) => x.message).join("; ")}`,
                      );
                  });
                  setCsv({ valid, invalid });
                  setError("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Invalid CSV.");
                } finally {
                  e.target.value = "";
                }
              }}
            />
          </label>
        )}
      </div>
      {error && (
        <p className="notice danger" role="alert">
          {error}
        </p>
      )}
      {!w.catalog.length ? (
        <Empty
          title={
            w.actor.role === "approver"
              ? "Offers are included in your assigned plans"
              : "A catalog that starts with your choices"
          }
        >
          <p>
            {w.actor.role === "approver"
              ? "Workspace-wide catalog access is reserved for editors."
              : "Add a product offer manually or import a validated CSV. No demo items are added to live workspaces."}
          </p>
        </Empty>
      ) : (
        <div className="catalog-grid">
          {w.catalog.map((item) => (
            <article className="card catalog-card" key={item.id}>
              <div className="row between">
                <span className="catalog-symbol">
                  <Package size={25} />
                </span>
                <Badge
                  tone={
                    offerStatus(item, w.settings) === "verified"
                      ? "green"
                      : "amber"
                  }
                >
                  {item.synthetic ? "Synthetic · " : ""}
                  {offerStatus(item, w.settings)}
                </Badge>
              </div>
              <p className="eyebrow">
                {item.retailer || "Retailer not recorded"}
              </p>
              <h3>{item.name}</h3>
              <strong className="catalog-price">{money(item.price)}</strong>
              <dl className="catalog-details">
                <div>
                  <dt>Dimensions</dt>
                  <dd>
                    {item.widthMm ?? "?"} × {item.depthMm ?? "?"} mm
                  </dd>
                </div>
                <div>
                  <dt>Stock</dt>
                  <dd>{item.stock.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>VAT</dt>
                  <dd>{item.tax}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>
                    {item.deliveryArea || "Unknown"} ·{" "}
                    {item.deliveryDays === null
                      ? "Estimate unknown"
                      : item.deliveryDays + " days"}
                  </dd>
                </div>
              </dl>
              {item.priceAt && (
                <p className="small muted">
                  Price checked{" "}
                  {new Date(item.priceAt).toLocaleString("en-GB", {
                    timeZone: w.settings.timezone,
                  })}
                  <br />
                  Stock checked{" "}
                  {item.stockAt
                    ? new Date(item.stockAt).toLocaleString("en-GB", {
                        timeZone: w.settings.timezone,
                      })
                    : "never"}
                  <br />
                  {item.verifiedBy} · {item.verificationSource}
                </p>
              )}
              <div className="row between">
                {canEdit(w) && (
                  <button
                    className="secondary"
                    onClick={() => setEditing(item)}
                  >
                    Edit / recheck
                  </button>
                )}
                {item.url && (
                  <a
                    className="text-link"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Source <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <Modal
          title={editing.name ? "Edit / verify offer" : "Add a product offer"}
          onClose={() => setEditing(null)}
        >
          <Form
            action={async (f) => {
              setError("");
              const next = {
                ...editing,
                name: text(f, "name"),
                retailer: text(f, "retailer"),
                sku: text(f, "sku"),
                url: text(f, "url"),
                category: text(f, "category"),
                price: cost(f, "price"),
                widthMm: text(f, "width") ? num(f, "width") * 10 : null,
                depthMm: text(f, "depth") ? num(f, "depth") * 10 : null,
                tax: text(f, "tax"),
                additionalTax: cost(f, "additionalTax"),
                stock: text(f, "stock"),
                deliveryArea: text(f, "area"),
                deliveryDays: text(f, "days") ? num(f, "days") : null,
                verificationSource: text(f, "verification"),
                notes: text(f, "notes"),
              };
              const parsed = productSchema.safeParse(next);
              if (!parsed.success) {
                setError(parsed.error.issues.map((x) => x.message).join("; "));
                return;
              }
              if (
                await dispatch({
                  type: "saveProduct",
                  product: parsed.data,
                  verify: f.get("verify") === "on",
                })
              )
                setEditing(null);
            }}
          >
            <Field
              name="name"
              label="Product name"
              required
              value={editing.name}
            />
            <div className="form-grid">
              <Field
                name="retailer"
                label="Retailer"
                value={editing.retailer}
              />
              <Field name="sku" label="SKU · optional" value={editing.sku} />
            </div>
            <Field
              name="url"
              label="HTTPS source URL · optional"
              value={editing.url}
              type="url"
            />
            <p className="small muted">
              URLs are stored only. No scraping or automatic URL fetching.
            </p>
            <label>
              Category
              <select name="category" defaultValue={editing.category}>
                {["curtains", "bedside", "storage", "other"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <Field
                name="width"
                label="Width · cm"
                type="number"
                min="0.1"
                step="0.1"
                value={editing.widthMm === null ? "" : editing.widthMm / 10}
              />
              <Field
                name="depth"
                label="Depth · cm"
                type="number"
                min="0.1"
                step="0.1"
                value={editing.depthMm === null ? "" : editing.depthMm / 10}
              />
            </div>
            <Field
              name="price"
              label="Unit price · EUR"
              type="number"
              step="0.01"
              min="0"
              value={editing.price === null ? "" : editing.price / 100}
            />
            <div className="form-grid">
              <label>
                Tax treatment
                <select name="tax" defaultValue={editing.tax}>
                  <option value="included">VAT included</option>
                  <option value="excluded">VAT excluded</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
              <Field
                name="additionalTax"
                label="Additional tax · EUR per unit"
                type="number"
                step="0.01"
                min="0"
                value={
                  editing.additionalTax === null
                    ? ""
                    : editing.additionalTax / 100
                }
              />
            </div>
            <label>
              Stock
              <select name="stock" defaultValue={editing.stock}>
                <option value="unknown">Unknown</option>
                <option value="in_stock">In stock</option>
                <option value="out_of_stock">Out of stock</option>
              </select>
            </label>
            <div className="form-grid">
              <Field
                name="area"
                label="Delivery area"
                value={editing.deliveryArea}
              />
              <Field
                name="days"
                label="Delivery estimate · days"
                type="number"
                min="0"
                value={editing.deliveryDays ?? ""}
              />
            </div>
            <Field
              name="verification"
              label="Verification source / how you checked"
              value={editing.verificationSource}
            />
            <label>
              Notes
              <textarea
                name="notes"
                defaultValue={editing.notes}
                maxLength={3000}
              />
            </label>
            <label className="check-label">
              <input name="verify" type="checkbox" />I have checked price, stock
              and delivery information
              {w.demo ? " (synthetic demo confirmation)" : ""}
            </label>
            <p className="small muted">
              Confirmation records {w.actor.name} and the current timestamp.
              Editing verified facts without rechecking removes verification.
              Approved snapshots remain unchanged.
            </p>
            {error && (
              <p role="alert" className="notice danger">
                {error}
              </p>
            )}
            <button disabled={busy} className="primary">
              Save offer
            </button>
          </Form>
        </Modal>
      )}
      {csv && (
        <Modal title="Confirm catalog import" onClose={() => setCsv(null)}>
          <p>
            {csv.valid.length} valid offers · {csv.invalid.length} rejected
            rows. Imported offers remain unverified.
          </p>
          {csv.invalid.map((r, i) => (
            <p className="small danger-text" key={i}>
              {r}
            </p>
          ))}
          {csv.valid.slice(0, 10).map((p) => (
            <p key={p.id}>
              {p.name} · {money(p.price)}
            </p>
          ))}
          <button
            disabled={busy || !csv.valid.length}
            className="primary"
            onClick={async () => {
              for (const product of csv.valid)
                if (
                  !(await dispatch({
                    type: "saveProduct",
                    product,
                    verify: false,
                  }))
                )
                  return;
              setCsv(null);
            }}
          >
            Confirm import
          </button>
        </Modal>
      )}
    </>
  );
}
export function Settings({
  w,
  dispatch,
  busy,
  notify,
  reload,
}: Props & { reload: () => Promise<void> }) {
  const [invite, setInvite] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [member, setMember] = useState<Workspace["members"][number] | null>(
    null,
  );
  const [deleteProject, setDeleteProject] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const admin = w.actor.role === "administrator";
  async function post(data: unknown) {
    const r = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE WAY YOU WORK</p>
          <h1>
            Workspace settings<span className="green">.</span>
          </h1>
          <p>People, permissions and the policies behind your plans.</p>
        </div>
      </div>
      <div className="two-columns">
        <section className="card">
          <h3>Locale & freshness policies</h3>
          <Form
            action={async (f) => {
              await dispatch({
                type: "settings",
                settings: {
                  ...w.settings,
                  locale: text(f, "locale"),
                  timezone: "Europe/Rome",
                  priceDays: num(f, "price"),
                  stockHours: num(f, "stock"),
                  pilotFee: cost(f, "fee") ?? 0,
                },
              });
            }}
          >
            <fieldset disabled={!admin || busy}>
              <label>
                Locale
                <select name="locale" defaultValue={w.settings.locale}>
                  <option value="en-IE">English · EUR</option>
                  <option value="it-IT">Italian · EUR formatting</option>
                </select>
              </label>
              <p className="small muted">Workspace timezone: Europe/Rome</p>
              <div className="form-grid">
                <Field
                  name="price"
                  label="Price freshness · days"
                  value={w.settings.priceDays}
                  type="number"
                  min="1"
                  required
                />
                <Field
                  name="stock"
                  label="Stock / delivery freshness · hours"
                  value={w.settings.stockHours}
                  type="number"
                  min="1"
                  required
                />
              </div>
              <Field
                name="fee"
                label="Pilot fee hypothesis · EUR"
                value={w.settings.pilotFee / 100}
                type="number"
                min="0"
                step="0.01"
              />
              <p className="small muted">
                Internal business hypothesis only. Billing is outside this
                release. No checkout or charges.
              </p>
              <button className="primary">Save settings</button>
            </fieldset>
          </Form>
        </section>
        <aside className="card sage-card">
          <ShieldCheck size={25} />
          <h3>Access follows the property.</h3>
          <p>
            Operators can edit. Approvers can view and decide only on assigned
            properties. Administrators manage membership; approval rights are
            granted separately.
          </p>
          <p className="small">
            {w.demo
              ? "Demo persona switching is isolated to the demo. It does not sign you into a live account."
              : "Invitations are email-bound, single-use links that expire after 48 hours. No invitation emails are sent by this application."}
          </p>
          <p className="small">
            Selected review content is processed by your configured AI provider
            only when an editor requests analysis. Manual planning remains
            available.
          </p>
        </aside>
      </div>
      <SectionHead title="Workspace members">
        {admin && !w.demo && (
          <button className="primary" onClick={() => setInvite(true)}>
            <Plus size={15} />
            Create invitation link
          </button>
        )}
      </SectionHead>
      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Property approval rights</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {w.members.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>{m.name}</strong>
                  {m.id === w.actor.id && <small>You</small>}
                </td>
                <td>{m.role}</td>
                <td>
                  {m.approvalProperties
                    .map(
                      (pid) =>
                        w.properties.find((p) => p.id === pid)?.name ??
                        "Assigned property",
                    )
                    .join(", ") || "None"}
                </td>
                <td>
                  {admin && !w.demo && (
                    <button className="secondary" onClick={() => setMember(m)}>
                      Manage access
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {w.demo && (
        <p className="small muted">
          These are synthetic members. Use the persona selector to explore
          operator and approver behavior. Live membership changes require
          authenticated accounts.
        </p>
      )}
      {admin && (
        <>
          <SectionHead title="Property data & deletion" />
          <div className="card">
            {w.properties.map((p) => (
              <div className="history-row" key={p.id}>
                <strong>{p.name}</strong>
                <span className="muted">{p.projects.length} projects</span>
                <button
                  className="secondary danger-text"
                  onClick={() => setDeleting(p.id)}
                >
                  <Trash2 size={13} />
                  Delete property
                </button>
              </div>
            ))}
            {w.properties.flatMap((property) =>
              property.projects.map((project) => (
                <div className="history-row" key={project.id}>
                  <span>
                    {property.name} / {project.name}
                  </span>
                  <button
                    className="secondary danger-text"
                    onClick={() => setDeleteProject(project.id)}
                  >
                    Delete project
                  </button>
                </div>
              )),
            )}
            <p className="small muted">
              Deleting removes the property, associated plans, reviews, private
              assets and historical decisions. Export anything you need first.
            </p>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="notice danger">
          {error}
        </p>
      )}
      {(invite || member) && (
        <Modal
          title={invite ? "Create invitation link" : "Manage member access"}
          onClose={() => {
            setInvite(false);
            setMember(null);
            setLink("");
            setError("");
          }}
        >
          <Form
            action={async (f) => {
              setError("");
              try {
                const data = {
                  workspaceId: w.id,
                  role: text(f, "role"),
                  propertyIds: f.getAll("properties").map(String),
                };
                if (invite) {
                  const result = await post({
                    ...data,
                    op: "invite",
                    email: text(f, "email"),
                  });
                  setLink(result.link);
                } else {
                  await post({
                    ...data,
                    op: "permissions",
                    userId: member!.id,
                  });
                  await reload();
                  setMember(null);
                  notify("Member access updated.");
                }
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Membership update failed",
                );
              }
            }}
          >
            {invite ? (
              <Field
                name="email"
                label="Recipient email"
                type="email"
                required
              />
            ) : (
              <h3>{member?.name}</h3>
            )}
            <label>
              Role
              <select name="role" defaultValue={member?.role ?? "operator"}>
                <option>operator</option>
                <option>approver</option>
                <option>administrator</option>
              </select>
            </label>
            <fieldset>
              <legend>Property approval rights</legend>
              {w.properties.map((p) => (
                <label className="check-label" key={p.id}>
                  <input
                    type="checkbox"
                    name="properties"
                    value={p.id}
                    defaultChecked={member?.approvalProperties.includes(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </fieldset>
            <p className="small muted">
              An approver can see only assigned properties. Operators and
              administrators still need explicit property approval rights to
              decide.
            </p>
            <button className="primary" disabled={busy}>
              {invite ? "Create link" : "Save access"}
            </button>
            {link && (
              <>
                <label>
                  Single-use link · expires in 48 hours
                  <input
                    readOnly
                    value={link}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(link)
                      .then(() => notify("Invitation link copied."))
                      .catch(() =>
                        setError("Select the link and copy it manually."),
                      )
                  }
                >
                  Copy invitation link
                </button>
              </>
            )}
            {error && (
              <p className="notice danger" role="alert">
                {error}
              </p>
            )}
          </Form>
        </Modal>
      )}
      {deleteProject && (
        <Modal
          title="Delete this project permanently?"
          onClose={() => setDeleteProject(null)}
        >
          <p>
            This removes its reviews, plans, decisions, tasks and private
            assets. The property is retained.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              const project = w.properties
                .flatMap((p) => p.projects)
                .find((p) => p.id === deleteProject)!;
              if (
                await dispatch({
                  type: "deleteProject",
                  projectId: project.id,
                  expected: project.revision,
                })
              )
                setDeleteProject(null);
            }}
          >
            Delete project and its data
          </button>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete this property permanently?"
          onClose={() => setDeleting(null)}
        >
          <p>
            All associated project data and private files will be removed. This
            cannot be undone.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              if (
                await dispatch({ type: "deleteProperty", propertyId: deleting })
              )
                setDeleting(null);
            }}
          >
            Delete property and its data
          </button>
        </Modal>
      )}
    </>
  );
}
