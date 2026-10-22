"use client";
import { useState, useEffect } from "react";
import {
  Plus,
  ArrowRight,
  MessageSquareText,
  Check,
  Download,
  Upload,
  Trash2,
  ChevronDown,
  ClipboardCheck,
  Ruler,
  Printer,
  FileJson,
  Leaf,
} from "lucide-react";
import {
  Action,
  Workspace,
  Project,
  Property,
  Draft,
  Issue,
  Line,
  id,
  stamp,
} from "@/lib/model";
import {
  budget,
  money,
  supportingCount,
  canEdit,
  canApprove,
  readiness,
  fit,
  offerStatus,
  offerUnit,
  previewReviews,
  exportProject,
  shoppingCSV,
  followup,
} from "@/lib/domain";
import { parseCSV, download, reviewTemplate } from "@/lib/csv";
import { Badge, Empty, Field, Modal, SectionHead, cost, text, num } from "./ui";
import { Form } from "./ui";
export type ProjectProps = {
  w: Workspace;
  p: Project;
  property: Property;
  dispatch: (action: Action) => Promise<boolean>;
  busy: boolean;
  notify: (message: string) => void;
  ai: (
    stage: "issues" | "interventions" | "options",
    p: Project,
  ) => Promise<void>;
};
const dateLabel = (date: string, w: Workspace) =>
  new Intl.DateTimeFormat(w.settings.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: w.settings.timezone,
  }).format(new Date(date));
function save(p: Project, draft: Draft): Action {
  return { type: "saveDraft", projectId: p.id, expected: p.revision, draft };
}
export function Brief(props: ProjectProps) {
  const { w, p, dispatch, busy } = props;
  const [measurement, setMeasurement] = useState<string | null>(null);
  const [room, setRoom] = useState(false);
  const edit = canEdit(w);
  return (
    <>
      <SectionHead
        eyebrow="01 / THE STARTING POINT"
        title="A clear brief makes room for better."
      />
      <div className="two-columns">
        <section className="card">
          <h3>What would you like to improve?</h3>
          <p className="muted">
            Start small. You can fill in the details as your plan takes shape.
          </p>
          <Form
            key={p.revision}
            action={async (f) => {
              await dispatch(
                save(p, {
                  ...p.draft,
                  budget: cost(f, "budget") ?? 0,
                  targetDate: text(f, "target"),
                  problems: text(f, "problems"),
                  assumptions: text(f, "assumptions")
                    .split("\n")
                    .filter(Boolean),
                }),
              );
            }}
          >
            <fieldset disabled={!edit || busy}>
              <label>
                Current problems or goals
                <textarea
                  name="problems"
                  defaultValue={p.draft.problems}
                  rows={4}
                  maxLength={4000}
                />
              </label>
              <div className="form-grid">
                <Field
                  name="budget"
                  label="Project budget · EUR"
                  type="number"
                  min="0"
                  step="0.01"
                  value={p.draft.budget / 100}
                  required
                />
                <Field
                  name="target"
                  label="Target completion date"
                  type="date"
                  value={p.draft.targetDate}
                />
              </div>
              <label>
                Assumptions & open questions{" "}
                <span className="muted">(one per line)</span>
                <textarea
                  name="assumptions"
                  rows={3}
                  defaultValue={p.draft.assumptions.join("\n")}
                  maxLength={5000}
                />
              </label>
              <p className="small muted">
                Changing the budget is an explicit edit and requires a fresh
                approval.
              </p>
              <button className="primary">Save brief</button>
            </fieldset>
          </Form>
        </section>
        <aside>
          <div className="card sage-card">
            <Leaf size={25} />
            <h3>Work with what you have.</h3>
            <p>
              Record useful furniture to retain, then measure only what your
              chosen interventions need.
            </p>
            <div className="note-line">
              <Check size={16} />
              No exact address needed
            </div>
            <div className="note-line">
              <Check size={16} />
              Incomplete drafts welcome
            </div>
            <div className="note-line">
              <Check size={16} />
              No booking or revenue promises
            </div>
          </div>
          <div className="card">
            <h3>Authorized decision makers</h3>
            {w.members
              .filter((m) => m.approvalProperties.includes(propertyId(p)))
              .map((m) => (
                <p key={m.id} className="row">
                  <span className="avatar">{m.name[0]}</span>
                  {m.name}
                  <Badge>{m.role}</Badge>
                </p>
              ))}
            {!w.members.some((m) =>
              m.approvalProperties.includes(p.propertyId),
            ) && (
              <p className="muted">
                No visible approver assigned. An administrator can grant
                property approval rights in settings.
              </p>
            )}
            <p className="small muted">
              Editing rights alone do not grant approval rights.
            </p>
          </div>
        </aside>
      </div>
      <SectionHead title="Rooms & recorded measurements">
        {edit && (
          <button className="secondary" onClick={() => setRoom(true)}>
            <Plus size={15} />
            Add room
          </button>
        )}
      </SectionHead>
      <div className="room-grid">
        {p.draft.rooms.map((r) => (
          <article className="card" key={r.id}>
            <div className="row between">
              <h3>{r.name}</h3>
              <Badge>
                {r.measurements.filter((m) => m.confirmed).length} confirmed
              </Badge>
            </div>
            <p className="small muted">
              Keep: {r.retained.join(", ") || "No retained items recorded"}
            </p>
            {r.measurements.length ? (
              <dl className="measurement-list">
                {r.measurements.map((m) => (
                  <div key={m.id}>
                    <dt>{m.name.replaceAll("_", " ")}</dt>
                    <dd>
                      {m.mm / 10} cm{" "}
                      <Badge tone={m.confirmed ? "green" : "amber"}>
                        {m.confirmed ? "Confirmed" : "Unconfirmed"}
                      </Badge>
                      <small>
                        {m.source}
                        {m.actor ? ` · ${m.actor}` : ""}
                      </small>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted small">
                No measurements yet. Missing information stays visible.
              </p>
            )}
            {edit && (
              <button
                className="secondary"
                onClick={() => setMeasurement(r.id)}
              >
                <Ruler size={14} />
                Record a measurement
              </button>
            )}
          </article>
        ))}
      </div>
      <Assets {...props} kind="room" />
      {room && (
        <Modal title="Add room" onClose={() => setRoom(false)}>
          <Form
            action={async (f) => {
              if (
                await dispatch(
                  save(p, {
                    ...p.draft,
                    rooms: [
                      ...p.draft.rooms,
                      {
                        id: id(),
                        name: text(f, "name"),
                        measurements: [],
                        retained: text(f, "retained")
                          .split("\n")
                          .filter(Boolean),
                      },
                    ],
                  }),
                )
              )
                setRoom(false);
            }}
          >
            <Field name="name" label="Room name" required />
            <label>
              Furniture to retain <span className="muted">(one per line)</span>
              <textarea name="retained" rows={3} />
            </label>
            <button className="primary" disabled={busy}>
              Add room
            </button>
          </Form>
        </Modal>
      )}
      {measurement && (
        <Modal
          title="Record a measurement"
          onClose={() => setMeasurement(null)}
        >
          <Form
            action={async (f) => {
              const confirmed = f.get("confirmed") === "on";
              const record = {
                id: id(),
                name: text(f, "name"),
                mm: num(f, "value") * (text(f, "unit") === "cm" ? 10 : 1),
                source: text(f, "source"),
                confirmed,
                actor: confirmed ? w.actor.name : null,
                confirmedAt: confirmed ? stamp() : null,
              };
              const rooms = p.draft.rooms.map((r) =>
                r.id === measurement
                  ? {
                      ...r,
                      measurements: [
                        ...r.measurements.filter((m) => m.name !== record.name),
                        record,
                      ],
                    }
                  : r,
              );
              if (await dispatch(save(p, { ...p.draft, rooms })))
                setMeasurement(null);
            }}
          >
            <label>
              Measurement
              <select name="name">
                <option value="window_width">Window opening width</option>
                <option value="available_width">Available width</option>
                <option value="available_depth">Available depth</option>
              </select>
            </label>
            <div className="form-grid">
              <Field
                name="value"
                label="Value"
                type="number"
                min="0.1"
                step="0.1"
                required
              />
              <label>
                Unit
                <select name="unit">
                  <option>cm</option>
                  <option>mm</option>
                </select>
              </label>
            </div>
            <Field
              name="source"
              label="Source / how it was measured"
              required
              placeholder="Measured on site with a tape"
            />
            <label className="check-label">
              <input type="checkbox" name="confirmed" />I confirm this
              measurement was checked
            </label>
            <p className="small muted">
              Recorded in millimetres. Photos do not establish verified
              dimensions. Confirmation is attributed to {w.actor.name}.
            </p>
            <button className="primary" disabled={busy}>
              Save measurement
            </button>
          </Form>
        </Modal>
      )}
    </>
  );
}
function propertyId(p: Project) {
  return p.propertyId;
}
export function Evidence(props: ProjectProps) {
  const { w, p, dispatch, busy, ai } = props;
  const [importing, setImporting] = useState(false);
  const [observing, setObserving] = useState(false);
  const [editing, setEditing] = useState<Issue | null>(null);
  const [review, setReview] = useState<Project["reviews"][number] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const edit = canEdit(w);
  return (
    <>
      <SectionHead
        eyebrow="02 / LISTEN & UNDERSTAND"
        title="Guest feedback, with its context."
      >
        <div className="row wrap">
          {edit && (
            <>
              <button className="secondary" onClick={() => setImporting(true)}>
                <Upload size={15} />
                Import reviews
              </button>
              <button
                className="primary"
                disabled={busy || !p.reviews.length}
                onClick={() => ai("issues", p)}
              >
                <MessageSquareText size={15} />
                Analyze feedback
              </button>
            </>
          )}
        </div>
      </SectionHead>
      {edit &&
        props.property.library.some(
          (r) => !p.reviews.some((x) => x.id === r.id),
        ) && (
          <div className="notice">
            <span>
              This property has reviews from another project. Reuse their
              original source records.
            </span>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                dispatch({
                  type: "attachReviews",
                  projectId: p.id,
                  expected: p.revision,
                  reviewIds: props.property.library
                    .filter((r) => !p.reviews.some((x) => x.id === r.id))
                    .slice(0, 500)
                    .map((r) => r.id),
                })
              }
            >
              Use property review library
            </button>
          </div>
        )}
      <div className="evidence-summary">
        <span>
          <strong>{p.reviews.filter((r) => !r.excluded).length}</strong>{" "}
          included reviews
        </span>
        <span>
          <strong>
            {p.draft.issues.filter((i) => i.status === "open").length}
          </strong>{" "}
          open priorities
        </span>
        <span>
          <strong>{p.observations.length}</strong> operator observations
        </span>
        <Badge
          tone={p.analysis?.stale ? "amber" : p.analysis ? "green" : "neutral"}
        >
          {p.analysis?.stale
            ? "Evidence changed · refresh needed"
            : p.analysis
              ? "Analysis current"
              : "Not analyzed yet"}
        </Badge>
      </div>
      {p.analysis?.stale && (
        <div className="notice amber">
          <p>
            Reviews changed after analysis. Submitted versions retain their
            historical evidence. Reanalyze, or correct citations and confirm the
            current evidence manually.
          </p>
          {edit && (
            <button
              disabled={busy}
              onClick={() =>
                dispatch({
                  type: "reviewEvidence",
                  projectId: p.id,
                  expected: p.revision,
                })
              }
            >
              Confirm reviewed evidence
            </button>
          )}
        </div>
      )}
      <div className="section-head">
        <h3>What deserves attention</h3>
        {edit && (
          <button className="secondary" onClick={() => setObserving(true)}>
            <Plus size={14} />
            Add observation
          </button>
        )}
      </div>
      {!p.draft.issues.length ? (
        <Empty title="Listen before you choose">
          <p>
            Import reviews and analyze feedback, or add an observation manually.
            Positive feedback can correctly produce no changes.
          </p>
        </Empty>
      ) : (
        <div className="issue-list">
          {p.draft.issues.map((issue) => (
            <article className="card issue-card" key={issue.id}>
              <div className="issue-icon">
                {issue.category === "sleep"
                  ? "☾"
                  : issue.category === "lighting"
                    ? "☼"
                    : issue.category === "storage"
                      ? "▣"
                      : "◇"}
              </div>
              <div className="issue-body">
                <div className="row between wrap">
                  <div className="row wrap">
                    <Badge
                      tone={issue.priority === "high" ? "amber" : "neutral"}
                    >
                      {issue.priority} priority
                    </Badge>
                    <span className="small muted">
                      {issue.category.replaceAll("_", " ")} ·{" "}
                      {issue.actionClass.replaceAll("_", " ")}
                    </span>
                    {issue.status !== "open" && <Badge>{issue.status}</Badge>}
                  </div>
                  <span className="support-count">
                    <strong>{supportingCount(issue)}</strong> /{" "}
                    {p.analysis?.reviewIds.length ??
                      p.reviews.filter((r) => !r.excluded).length}{" "}
                    reviews
                  </span>
                </div>
                <h3>{issue.title}</h3>
                <p>{issue.explanation}</p>
                <p className="small muted">
                  {issue.priorityReason} · Room:{" "}
                  {p.draft.rooms.find((r) => r.id === issue.roomId)?.name ??
                    "Not assigned"}
                </p>
                <div className="row wrap">
                  <button
                    className="link-button"
                    onClick={() =>
                      setExpanded(expanded === issue.id ? null : issue.id)
                    }
                  >
                    View source evidence <ChevronDown size={14} />
                  </button>
                  {edit && (
                    <button
                      className="link-button"
                      onClick={() => setEditing(issue)}
                    >
                      Edit classification
                    </button>
                  )}
                </div>
                {expanded === issue.id && (
                  <div className="quotes">
                    {issue.evidence.map((e, index) => (
                      <blockquote key={index}>
                        <p>“{e.excerpt}”</p>
                        <cite>
                          {e.source_type === "review"
                            ? "Review"
                            : "Operator observation"}{" "}
                          · {e.source_id}
                        </cite>
                      </blockquote>
                    ))}
                    {!issue.evidence.length && (
                      <p>No source citations attached. Manual assessment.</p>
                    )}
                    {issue.questions.length > 0 && (
                      <p className="small">
                        <strong>Open questions:</strong>{" "}
                        {issue.questions.join(" ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <details className="card review-details">
        <summary>
          Source reviews <span className="muted">({p.reviews.length})</span>
        </summary>
        {p.reviews.map((r) => (
          <article className="source-review" key={r.id}>
            <div className="row between">
              <span className="eyebrow">
                {r.id} · {r.source} · {r.date ?? "Undated"}
              </span>
              {edit && (
                <button className="link-button" onClick={() => setReview(r)}>
                  Edit / exclude
                </button>
              )}
            </div>
            <p>{r.text}</p>
            {r.excluded && <Badge tone="amber">Excluded</Badge>}
          </article>
        ))}
      </details>
      {p.runs.length > 0 && (
        <details className="card">
          <summary>Analysis history</summary>
          {p.runs.map((r) => (
            <p key={r.id}>
              {r.stage} · {r.status} · {r.model} · {dateLabel(r.at, w)}
              {r.error ? " · " + r.error : ""}
            </p>
          ))}
        </details>
      )}
      {importing && (
        <ReviewImport {...props} onClose={() => setImporting(false)} />
      )}
      {observing && (
        <Modal
          title="Add an operator observation"
          onClose={() => setObserving(false)}
        >
          <Form
            action={async (f) => {
              if (
                await dispatch({
                  type: "addObservation",
                  projectId: p.id,
                  expected: p.revision,
                  title: text(f, "title"),
                  text: text(f, "observation"),
                  actionClass: text(f, "actionClass") as Issue["actionClass"],
                })
              )
                setObserving(false);
            }}
          >
            <Field name="title" label="Issue title" required />
            <label>
              What did you observe?
              <textarea name="observation" required maxLength={6000} />
            </label>
            <label>
              Action class
              <select name="actionClass">
                <option value="physical_change">Physical change</option>
                <option value="operational_change">Operational change</option>
                <option value="inspect_first">Inspect first</option>
                <option value="uncertain">Uncertain</option>
              </select>
            </label>
            <p className="small muted">
              This appears as an operator observation, not a guest review.
            </p>
            <button disabled={busy} className="primary">
              Save observation
            </button>
          </Form>
        </Modal>
      )}
      {editing && (
        <Modal title="Edit issue" onClose={() => setEditing(null)}>
          <Form
            action={async (f) => {
              const issue = {
                ...editing,
                title: text(f, "title"),
                category: text(f, "category") as Issue["category"],
                actionClass: text(f, "actionClass") as Issue["actionClass"],
                roomId: text(f, "room") || null,
                status: text(f, "status") as Issue["status"],
                resolution: text(f, "resolution"),
                evidence:
                  f.get("removeEvidence") === "on" ? [] : editing.evidence,
              };
              if (
                await dispatch(
                  save(p, {
                    ...p.draft,
                    issues: p.draft.issues.map((i) =>
                      i.id === issue.id ? issue : i,
                    ),
                  }),
                )
              )
                setEditing(null);
            }}
          >
            <Field name="title" label="Title" value={editing.title} required />
            <div className="form-grid">
              <label>
                Category
                <select name="category" defaultValue={editing.category}>
                  {[
                    "sleep",
                    "lighting",
                    "storage",
                    "workspace",
                    "comfort",
                    "cleanliness",
                    "check_in",
                    "maintenance",
                    "other",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Action class
                <select name="actionClass" defaultValue={editing.actionClass}>
                  {[
                    "physical_change",
                    "operational_change",
                    "inspect_first",
                    "uncertain",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Room
              <select name="room" defaultValue={editing.roomId ?? ""}>
                <option value="">Unknown / unassigned</option>
                {p.draft.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue={editing.status}>
                <option>open</option>
                <option>dismissed</option>
                <option>resolved</option>
              </select>
            </label>
            <Field
              name="resolution"
              label="Resolution / dismissal note"
              value={editing.resolution}
            />
            <label className="check-label">
              <input type="checkbox" name="removeEvidence" />
              Remove unsupported or outdated citations
            </label>
            <button disabled={busy} className="primary">
              Save issue
            </button>
          </Form>
        </Modal>
      )}
      {review && (
        <Modal title="Edit source review" onClose={() => setReview(null)}>
          <Form
            action={async (f) => {
              if (
                await dispatch({
                  type: "editReview",
                  projectId: p.id,
                  expected: p.revision,
                  review: {
                    ...review,
                    text: text(f, "text"),
                    excluded: f.get("excluded") === "on",
                  },
                })
              )
                setReview(null);
            }}
          >
            <label>
              Original review
              <textarea
                name="text"
                rows={5}
                required
                maxLength={6000}
                defaultValue={review.text}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                name="excluded"
                defaultChecked={review.excluded}
              />
              Exclude from future analysis
            </label>
            <p className="small muted">
              This invalidates current analysis. Historical submitted snapshots
              remain unchanged.
            </p>
            <button disabled={busy} className="primary">
              Save review
            </button>
          </Form>
        </Modal>
      )}
    </>
  );
}
function ReviewImport({
  p,
  dispatch,
  busy,
  onClose,
}: ProjectProps & { onClose: () => void }) {
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const mapped =
    rows?.map((r) =>
      Object.fromEntries(
        [
          "review_text",
          "external_review_id",
          "review_date",
          "source",
          "rating",
          "language",
        ].map((k) => [k, r[mapping[k] ?? k] ?? ""]),
      ),
    ) ?? [];
  const preview = rows ? previewReviews(mapped, p) : null;
  return (
    <Modal title="Import guest reviews" onClose={onClose}>
      <p className="muted">
        Up to 500 rows, 6,000 characters per review, 3 MB per CSV. No guest
        names or contact information needed.
      </p>
      <div className="row wrap">
        <button
          className="secondary"
          onClick={() =>
            download("reviews-template.csv", reviewTemplate, "text/csv")
          }
        >
          <Download size={14} />
          CSV template
        </button>
        <label className="file-label">
          Choose CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              try {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 3000000) throw Error("CSV limit: 3 MB.");
                const parsed = parseCSV(await file.text());
                setRows(parsed.rows);
                setFields(parsed.fields);
                setMapping(
                  Object.fromEntries(parsed.fields.map((f) => [f, f])),
                );
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Invalid CSV");
              }
            }}
          />
        </label>
      </div>
      <label>
        Or paste reviews <span className="muted">(one per line)</span>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={4}
          maxLength={3_000_000}
        />
      </label>
      <button
        className="secondary"
        onClick={() => {
          try {
            const input = raw
              .split("\n")
              .filter((x) => x.trim())
              .map((t) => ({ review_text: t }));
            if (input.length > 500) throw Error("Import limit: 500 rows.");
            setRows(input);
            setFields([]);
            setMapping({ review_text: "review_text" });
            setError("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Invalid reviews");
          }
        }}
      >
        Preview pasted reviews
      </button>
      {fields.length > 0 && (
        <div className="mapping-grid">
          {[
            "review_text",
            "external_review_id",
            "review_date",
            "source",
            "rating",
            "language",
          ].map((k) => (
            <label key={k}>
              {k}
              {k === "review_text" ? " *" : ""}
              <select
                value={mapping[k] ?? ""}
                onChange={(e) =>
                  setMapping({ ...mapping, [k]: e.target.value })
                }
              >
                <option value="">Not mapped</option>
                {fields.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {preview && (
        <>
          <div className="notice">
            <span>
              <strong>{preview.valid.length}</strong> accepted ·{" "}
              {preview.rejected.length} rejected · {preview.duplicates}{" "}
              duplicates
            </span>
          </div>
          {preview.nearDuplicates > 0 && (
            <p className="notice amber">
              {preview.nearDuplicates} similar texts found with different
              identities/dates. They will be retained; check them before
              confirming.
            </p>
          )}
          {preview.rejected.map((r) => (
            <p className="small" key={r.row}>
              Row {r.row}: {r.reason}
            </p>
          ))}
          <div className="import-preview">
            {preview.valid.slice(0, 5).map((r) => (
              <p key={r.id}>{r.text}</p>
            ))}
          </div>
          <button
            className="primary"
            disabled={busy || !preview.valid.length}
            onClick={async () => {
              if (
                await dispatch({
                  type: "importReviews",
                  projectId: p.id,
                  expected: p.revision,
                  rows: mapped,
                  source: "Pasted / CSV",
                })
              )
                onClose();
            }}
          >
            Confirm import · {preview.valid.length} reviews
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="notice danger">
          {error}
        </p>
      )}
    </Modal>
  );
}
export function Options(props: ProjectProps) {
  const { w, p, dispatch, busy, ai } = props;
  const [editing, setEditing] = useState<Line | null>(null);
  const edit = canEdit(w);
  return (
    <>
      <SectionHead
        eyebrow="03 / PRACTICAL CHANGES"
        title="A few considered improvements."
      >
        <div className="row wrap">
          {edit && (
            <>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => ai("interventions", p)}
              >
                Suggest interventions
              </button>
              <button
                className="primary"
                onClick={() =>
                  setEditing({
                    id: id(),
                    issueIds: [],
                    roomId: p.draft.rooms[0]?.id ?? null,
                    action: "buy",
                    title: "",
                    reason: "",
                    productId: null,
                    quantity: 1,
                    unit: null,
                    basis: "unknown",
                    requiredMeasurements: [
                      "available_width",
                      "available_depth",
                    ],
                    retained: [],
                    questions: [],
                    dependencies: [],
                    manualFit: null,
                    deliveryConfirmed: false,
                  })
                }
              >
                <Plus size={15} />
                Add intervention
              </button>
            </>
          )}
        </div>
      </SectionHead>
      <p className="muted intro-copy">
        Keep useful furniture. Choose a purchase, an operational change, an
        inspection — or no action. Measurements and unknown costs stay visible.
      </p>
      {!p.draft.lines.length ? (
        <Empty title="What is the smallest useful change?">
          <p>
            Add an intervention for a selected issue. Not every problem needs a
            purchase.
          </p>
        </Empty>
      ) : (
        <div className="option-grid">
          {p.draft.lines.map((line, index) => {
            const product = w.catalog.find((c) => c.id === line.productId),
              check = fit(line, p.draft, product);
            return (
              <article className="card option-card" key={line.id}>
                <div
                  className={`option-illustration illustration-${product?.category ?? "other"}`}
                >
                  <span className="option-number">0{index + 1}</span>
                  {product?.category === "curtains" ? (
                    <div className="mini-curtains">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : product?.category === "bedside" ? (
                    <div className="mini-lamp">
                      <span />
                    </div>
                  ) : product?.category === "storage" ? (
                    <div className="mini-rack">
                      <span />
                    </div>
                  ) : (
                    <Leaf size={50} />
                  )}
                  <Badge>
                    {line.action === "buy"
                      ? "Purchase option"
                      : line.action.replaceAll("_", " ")}
                  </Badge>
                </div>
                <div className="option-content">
                  <p className="eyebrow">
                    {p.draft.rooms.find((r) => r.id === line.roomId)?.name ??
                      "Room not assigned"}
                  </p>
                  <h3>{line.title}</h3>
                  <p>{line.reason}</p>
                  <div className="option-price">
                    <strong>
                      {money(
                        line.unit === null ? null : line.unit * line.quantity,
                      )}
                    </strong>
                    <span>
                      {line.basis} · Qty {line.quantity}
                    </span>
                  </div>
                  {product && (
                    <p className="small muted">
                      {product.retailer} ·{" "}
                      {product.synthetic
                        ? "Synthetic offer"
                        : offerStatus(product, w.settings)}{" "}
                      · {product.stock.replaceAll("_", " ")}
                    </p>
                  )}
                  <div
                    className={`fit-state ${check.status === "passes_recorded_checks" ? "green" : "amber"}`}
                  >
                    <Ruler size={15} />
                    {check.status.replaceAll("_", " ")}
                  </div>
                  <details>
                    <summary>Evidence, measurements & conditions</summary>
                    <ul>
                      {line.issueIds.map((i) => (
                        <li key={i}>
                          Issue:{" "}
                          {p.draft.issues.find((x) => x.id === i)?.title ??
                            "Unknown"}
                        </li>
                      ))}
                      {check.details.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                      {line.questions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                      {line.retained.map((r) => (
                        <li key={r}>Keep: {r}</li>
                      ))}
                    </ul>
                    <p className="small muted">
                      Passing recorded checks does not guarantee every
                      installation condition.
                    </p>
                  </details>
                  {edit && (
                    <div className="row between">
                      <button
                        className="secondary"
                        onClick={() => setEditing(line)}
                      >
                        Compare / edit option <ArrowRight size={13} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${line.title}`}
                        onClick={() =>
                          dispatch(
                            save(p, {
                              ...p.draft,
                              lines: p.draft.lines.filter(
                                (l) => l.id !== line.id,
                              ),
                            }),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {edit && w.catalog.length > 0 && (
        <button
          className="secondary"
          disabled={busy}
          onClick={() => ai("options", p)}
        >
          Explain compatible catalog options
        </button>
      )}
      <BudgetPanel {...props} editable />
      {editing && (
        <LineEditor
          {...props}
          line={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
function LineEditor({
  w,
  p,
  line,
  dispatch,
  busy,
  onClose,
}: ProjectProps & { line: Line; onClose: () => void }) {
  const [productId, setProductId] = useState(line.productId ?? "");
  const [unit, setUnit] = useState(
    line.unit === null ? "" : String(line.unit / 100),
  );
  const [action, setAction] = useState(line.action);
  const product = w.catalog.find((p) => p.id === productId);
  return (
    <Modal
      title={line.title ? "Edit intervention" : "Add intervention"}
      onClose={onClose}
    >
      <Form
        action={async (f) => {
          const next: Line = {
            ...line,
            title: text(f, "title"),
            reason: text(f, "reason"),
            action,
            productId: action === "buy" ? productId || null : null,
            roomId: text(f, "room") || null,
            quantity: action === "buy" ? num(f, "quantity") : line.quantity,
            unit: action === "buy" ? cost(f, "unit") : 0,
            basis:
              action === "buy"
                ? (text(f, "basis") as Line["basis"])
                : "verified",
            issueIds: f.getAll("issues").map(String),
            requiredMeasurements:
              action === "buy"
                ? text(f, "measurements")
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean)
                : [],
            questions: text(f, "questions").split("\n").filter(Boolean),
            retained: text(f, "retained").split("\n").filter(Boolean),
            deliveryConfirmed: f.get("delivery") === "on",
            manualFit: text(f, "fitNote").trim()
              ? { actor: w.actor.name, at: stamp(), note: text(f, "fitNote") }
              : null,
          };
          const draft = {
            ...p.draft,
            lines: p.draft.lines.some((l) => l.id === line.id)
              ? p.draft.lines.map((l) => (l.id === line.id ? next : l))
              : [...p.draft.lines, next],
          };
          if (await dispatch(save(p, draft))) onClose();
        }}
      >
        <Field name="title" label="Intervention" value={line.title} required />
        <label>
          Why this helps
          <textarea name="reason" defaultValue={line.reason} maxLength={2000} />
        </label>
        <div className="form-grid">
          <label>
            Action
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as Line["action"])}
            >
              {[
                "buy",
                "rearrange",
                "keep",
                "operational_change",
                "inspect",
                "defer",
              ].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Room
            <select name="room" defaultValue={line.roomId ?? ""}>
              <option value="">Unassigned</option>
              {p.draft.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Issues addressed</legend>
          {p.draft.issues
            .filter((i) => i.status === "open")
            .map((i) => (
              <label key={i.id} className="check-label">
                <input
                  type="checkbox"
                  name="issues"
                  value={i.id}
                  defaultChecked={line.issueIds.includes(i.id)}
                />
                {i.title}
              </label>
            ))}
        </fieldset>
        {action === "buy" && (
          <>
            <label>
              Catalog offer
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  const product = w.catalog.find(
                    (c) => c.id === e.target.value,
                  );
                  if (product)
                    setUnit(
                      offerUnit(product) === null
                        ? ""
                        : String(offerUnit(product)! / 100),
                    );
                }}
              >
                <option value="">Requirements only · no offer selected</option>
                {w.catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {money(c.price)}
                  </option>
                ))}
              </select>
            </label>
            {product && (
              <p className="small muted">
                {product.synthetic
                  ? "Synthetic offer"
                  : offerStatus(product, w.settings)}{" "}
                · {product.widthMm ?? "?"} × {product.depthMm ?? "?"} mm ·{" "}
                {product.stock}
                {product.url && (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={product.url}
                    >
                      Open retailer source ↗
                    </a>
                  </>
                )}
              </p>
            )}
            <div className="form-grid">
              <label>
                Unit cost including known VAT · EUR
                <input
                  name="unit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Unknown"
                />
              </label>
              <Field
                name="quantity"
                label="Quantity"
                value={line.quantity}
                type="number"
                min="1"
                required
              />
            </div>
            <label>
              Cost basis
              <select name="basis" defaultValue={line.basis}>
                <option value="unknown">Unknown</option>
                <option value="allowance">Planning allowance / estimate</option>
                <option value="verified">Quoted / verified amount</option>
              </select>
            </label>
            <Field
              name="measurements"
              label="Required measurement keys · comma separated"
              value={line.requiredMeasurements.join(", ")}
            />
            <Field
              name="fitNote"
              label="Additional manual compatibility note"
              value={line.manualFit?.note}
            />
            <p className="small muted">
              A note cannot override a failed or missing recorded dimension
              check.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                name="delivery"
                defaultChecked={line.deliveryConfirmed}
              />
              Delivery feasibility confirmed for the target date
            </label>
          </>
        )}
        <label>
          Existing items to retain <span className="muted">(one per line)</span>
          <textarea
            name="retained"
            defaultValue={line.retained.join("\n")}
            rows={2}
          />
        </label>
        <label>
          Open questions <span className="muted">(one per line)</span>
          <textarea
            name="questions"
            defaultValue={line.questions.join("\n")}
            rows={2}
          />
        </label>
        <button className="primary" disabled={busy}>
          Save intervention
        </button>
      </Form>
    </Modal>
  );
}
function BudgetPanel({
  w,
  p,
  dispatch,
  busy,
  editable = false,
}: {
  w: Workspace;
  p: Project;
  dispatch: ProjectProps["dispatch"];
  busy: boolean;
  editable?: boolean;
}) {
  const b = budget(p.draft);
  const [edit, setEdit] = useState(false);
  const c = p.draft.costs;
  return (
    <section className="budget-section">
      <SectionHead title="The whole budget.">
        <span className="muted small">Integer cents · EUR</span>
      </SectionHead>
      <div className="budget-layout">
        <div className="card">
          <h3>Cost breakdown</h3>
          <dl className="cost-list">
            <div>
              <dt>Item subtotal</dt>
              <dd>{money(b.items)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{money(c.delivery)}</dd>
            </div>
            <div>
              <dt>Installation</dt>
              <dd>{money(c.installation)}</dd>
            </div>
            <div>
              <dt>
                Other additional tax{" "}
                <small>(unit costs already include known VAT)</small>
              </dt>
              <dd>{money(c.tax)}</dd>
            </div>
            <div>
              <dt>Discount</dt>
              <dd>−{money(c.discount)}</dd>
            </div>
            <div>
              <dt>
                Contingency{" "}
                {c.contingency.kind === "percent"
                  ? `(${c.contingency.value / 100}% of pre-contingency subtotal)`
                  : ""}
              </dt>
              <dd>{money(b.contingency)}</dd>
            </div>
            <div className="total">
              <dt>Total allocated</dt>
              <dd>{money(b.total)}</dd>
            </div>
          </dl>
          {b.missing.length > 0 && (
            <p className="notice amber">
              Missing costs: {b.missing.join(", ")}. Known allocation:{" "}
              {money(b.known)}. Unknown does not mean zero.
            </p>
          )}
          {c.notes && <p className="small muted">{c.notes}</p>}
          {b.estimated && (
            <Badge tone="amber">Includes explicit planning estimates</Badge>
          )}
          {editable && canEdit(w) && (
            <button className="secondary" onClick={() => setEdit(true)}>
              Edit cost components
            </button>
          )}
        </div>
        <div className="budget-balance">
          <span className="eyebrow">YOUR PROJECT BUDGET</span>
          <strong>{money(p.draft.budget)}</strong>
          <div className="budget-bar">
            <span
              style={{
                width: `${Math.min(100, Math.max(0, (b.known / p.draft.budget) * 100))}%`,
              }}
            />
          </div>
          <div className="row between">
            <span>
              {b.remaining !== null && b.remaining < 0
                ? "Over budget"
                : "Budget remaining"}
            </span>
            <b>{money(b.remaining === null ? null : Math.abs(b.remaining))}</b>
          </div>
          <p>
            {b.remaining === null
              ? "Complete unknown cost components to see the full allocation."
              : "Unused budget stays unallocated. It is not a savings forecast."}
          </p>
          <span className="budget-leaf">
            <Leaf size={44} />
          </span>
        </div>
      </div>
      {edit && (
        <Modal title="Edit cost components" onClose={() => setEdit(false)}>
          <Form
            action={async (f) => {
              const value =
                text(f, "kind") === "percent"
                  ? Math.round(num(f, "contingency") * 100)
                  : Math.round(num(f, "contingency") * 100);
              if (
                await dispatch(
                  save(p, {
                    ...p.draft,
                    costs: {
                      delivery: cost(f, "delivery"),
                      installation: cost(f, "installation"),
                      tax: cost(f, "tax"),
                      discount: cost(f, "discount") ?? 0,
                      contingency: {
                        kind: text(f, "kind") as "fixed" | "percent",
                        value,
                      },
                      notes: text(f, "notes"),
                    },
                  }),
                )
              )
                setEdit(false);
            }}
          >
            <p className="muted small">
              Leave required unknown amounts blank. Enter zero only when known
              or genuinely not applicable. Group delivery once, including shared
              shipping.
            </p>
            <div className="form-grid">
              {(["delivery", "installation", "tax", "discount"] as const).map(
                (k) => (
                  <Field
                    key={k}
                    name={k}
                    label={`${k} · EUR`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={c[k] === null ? "" : c[k] / 100}
                  />
                ),
              )}
            </div>
            <label>
              Contingency type
              <select name="kind" defaultValue={c.contingency.kind}>
                <option value="fixed">Fixed EUR</option>
                <option value="percent">Percentage of known subtotal</option>
              </select>
            </label>
            <Field
              name="contingency"
              label="Contingency · EUR or percent"
              type="number"
              min="0"
              step="0.01"
              value={c.contingency.value / 100}
            />
            <label>
              Cost assumptions & allowance labels
              <textarea name="notes" defaultValue={c.notes} maxLength={2000} />
            </label>
            <button className="primary" disabled={busy}>
              Save costs
            </button>
          </Form>
        </Modal>
      )}
    </section>
  );
}
export function Approval(props: ProjectProps) {
  const { w, p, dispatch, busy } = props;
  const [selected, setSelected] = useState<string>("");
  const [deciding, setDeciding] = useState<
    "approved" | "changes_requested" | "rejected" | null
  >(null);
  const r = readiness(p, w);
  const version = p.versions.find(
    (v) => v.id === (selected || p.currentVersionId),
  );
  const data = exportProject(
    w,
    p,
    selected === "draft" ? null : (version?.id ?? null),
  );
  const viewProject = { ...p, draft: data.draft };
  function doExport(format: "json" | "csv") {
    if (w.demo)
      download(
        `DEMO-host-plan.${format}`,
        format === "json" ? JSON.stringify(data, null, 2) : shoppingCSV(data),
        format === "json" ? "application/json" : "text/csv",
      );
    else {
      const q = new URLSearchParams({
        workspace: w.id,
        project: p.id,
        format,
        ...(data.version ? { version: version!.id } : {}),
      });
      const a = document.createElement("a");
      a.href = "/api/export?" + q;
      a.download = "host-plan." + format;
      a.click();
    }
  }
  return (
    <>
      <SectionHead
        eyebrow="04 / AGREE ON THE PLAN"
        title="One clear plan. One recorded decision."
      />
      <div className="approval-status card">
        <span className="icon-soft">
          <ClipboardCheck size={27} />
        </span>
        <div>
          <h3>
            {r.approved
              ? "Current revision approved"
              : p.currentVersionId
                ? "A decision is waiting"
                : "The current draft needs approval"}
          </h3>
          <p>
            {r.approved
              ? "Approval accepts a version. It does not certify current stock, delivery or every installation condition."
              : "Submit a reviewable budget plan, then ask an authorized decision maker to review the exact revision."}
          </p>
          <div className="row wrap">
            <Badge tone={r.reviewable ? "green" : "amber"}>
              {r.reviewable
                ? "Reviewable budget plan"
                : "Budget plan incomplete"}
            </Badge>
            <Badge tone={r.readyToBuy ? "green" : "amber"}>
              {r.readyToBuy ? "Ready to buy" : "Purchases blocked"}
            </Badge>
          </div>
        </div>
      </div>
      {r.reasons.length > 0 && (
        <div className="notice amber">
          <ul>
            {r.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      <details className="readiness-details card">
        <summary>
          Pre-purchase readiness · {r.buyReasons.length} outstanding checks
        </summary>
        <ul>
          {r.buyReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </details>
      <div className="row between wrap approval-actions">
        <div>
          <label>
            Plan to review / export
            <select
              aria-label="Plan revision"
              value={selected || (p.currentVersionId ?? "draft")}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="draft">Current draft</option>
              {p.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  Revision {v.number} · {v.status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row wrap">
          <button className="secondary" onClick={() => window.print()}>
            <Printer size={14} />
            Print / Save as PDF
          </button>
          <button className="secondary" onClick={() => doExport("csv")}>
            <Download size={14} />
            Budget CSV
          </button>
          <button className="secondary" onClick={() => doExport("json")}>
            <FileJson size={14} />
            Project JSON
          </button>
        </div>
      </div>
      <div className="card plan-summary">
        <div className="row between">
          <p className="eyebrow">{data.label}</p>
          {version && (
            <span className="small muted">
              {dateLabel(version.createdAt, w)}
            </span>
          )}
        </div>
        <h2>{p.name}</h2>
        <p>{data.draft.problems}</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Intervention</th>
                <th>Scope</th>
                <th>Cost basis</th>
                <th className="align-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.draft.lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.title}</strong>
                    <small>
                      {data.draft.rooms.find((r) => r.id === l.roomId)?.name ??
                        "Unassigned room"}
                    </small>
                  </td>
                  <td>
                    {l.action.replaceAll("_", " ")} · {l.quantity}
                  </td>
                  <td>{l.basis}</td>
                  <td className="align-right">
                    {money(l.unit === null ? null : l.unit * l.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.draft.assumptions.length > 0 && (
          <div className="assumptions">
            <h4>Assumptions & unresolved conditions</h4>
            <ul>
              {data.draft.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
              {data.draft.lines.flatMap((l) =>
                l.questions.map((q, i) => (
                  <li key={l.id + i}>
                    {l.title}: {q}
                  </li>
                )),
              )}
            </ul>
          </div>
        )}
        {version?.decision && (
          <div className="decision">
            <Check size={18} />
            <div>
              <strong>
                {version.status.replaceAll("_", " ")} by{" "}
                {version.decision.actor}
              </strong>
              <p>
                {dateLabel(version.decision.at, w)} ·{" "}
                {version.decision.note || "No additional note."}
              </p>
            </div>
          </div>
        )}
      </div>
      <BudgetPanel w={w} p={viewProject} dispatch={dispatch} busy={busy} />
      <div className="decision-actions">
        {canEdit(w) && (
          <>
            <button
              className="primary"
              disabled={busy || !r.reviewable || !!p.currentVersionId}
              onClick={() =>
                dispatch({
                  type: "submit",
                  projectId: p.id,
                  expected: p.revision,
                })
              }
            >
              Submit for approval <ArrowRight size={15} />
            </button>
            {p.currentVersionId && (
              <p className="small muted">
                This scope already has a submitted or approved revision. A
                material edit creates a draft requiring a new decision.
              </p>
            )}
          </>
        )}
        {version?.status === "submitted" &&
          version.id === p.currentVersionId && (
            <>
              <div className="row wrap">
                <button
                  className="primary"
                  disabled={busy || !canApprove(w, p.propertyId)}
                  onClick={() => setDeciding("approved")}
                >
                  Approve revision {version.number}
                </button>
                <button
                  className="secondary"
                  disabled={busy || !canApprove(w, p.propertyId)}
                  onClick={() => setDeciding("changes_requested")}
                >
                  Request changes
                </button>
                <button
                  className="secondary danger-text"
                  disabled={busy || !canApprove(w, p.propertyId)}
                  onClick={() => setDeciding("rejected")}
                >
                  Reject
                </button>
              </div>
              {!canApprove(w, p.propertyId) && (
                <p className="small muted">
                  Only members with approval rights for this property can
                  decide.
                  {w.demo
                    ? " Switch to Sofia or Luca using the demo persona selector."
                    : ""}
                </p>
              )}
            </>
          )}
      </div>
      {p.versions.length > 0 && (
        <details className="card">
          <summary>Version & decision history · {p.versions.length}</summary>
          {p.versions.map((v) => (
            <div className="history-row" key={v.id}>
              <strong>Revision {v.number}</strong>
              <Badge tone={v.status === "approved" ? "green" : "neutral"}>
                {v.status.replaceAll("_", " ")}
              </Badge>
              <span>
                {v.decision?.actor ?? v.actor} ·{" "}
                {dateLabel(v.decision?.at ?? v.createdAt, w)}
              </span>
              <button className="link-button" onClick={() => setSelected(v.id)}>
                View revision
              </button>
            </div>
          ))}
        </details>
      )}
      {deciding && version && (
        <Modal
          title={`${deciding.replaceAll("_", " ")} · revision ${version.number}`}
          onClose={() => setDeciding(null)}
        >
          <Form
            action={async (f) => {
              if (
                await dispatch({
                  type: "decide",
                  projectId: p.id,
                  expected: p.revision,
                  versionId: version.id,
                  decision: deciding,
                  note: text(f, "note"),
                })
              )
                setDeciding(null);
            }}
          >
            <p>
              You are deciding as <strong>{w.actor.name}</strong>. This decision
              applies to revision {version.number} only.
            </p>
            <label>
              Decision note
              <textarea name="note" maxLength={2000} />
            </label>
            <button disabled={busy} className="primary">
              Record decision
            </button>
          </Form>
        </Modal>
      )}
      <PrintPlan data={data} />
    </>
  );
}
function PrintPlan({ data }: { data: ReturnType<typeof exportProject> }) {
  return (
    <article className="print-sheet">
      <p>HOST UPGRADE PLANNER · {data.label}</p>
      <h1>{data.project}</h1>
      <p>
        {data.property} · Exported {data.exportedAt} · Revision{" "}
        {data.version ?? "DRAFT"}
      </p>
      <p>{data.draft.problems}</p>
      {data.draft.lines.map((l) => (
        <section key={l.id}>
          <h2>{l.title}</h2>
          <p>
            {l.reason} · {l.action} · Qty {l.quantity} ·{" "}
            {money(l.unit === null ? null : l.unit * l.quantity)} · {l.basis}
          </p>
          <p>
            Offer:{" "}
            {data.products.find((p) => p.id === l.productId)?.url ||
              "No retailer link"}
          </p>
          <p>
            Conditions: {l.questions.join("; ")}. Keep: {l.retained.join(", ")}.
          </p>
          {data.draft.issues
            .filter((i) => l.issueIds.includes(i.id))
            .map((i) => (
              <div key={i.id}>
                <h3>{i.title}</h3>
                {i.evidence.map((e, n) => (
                  <blockquote key={n}>
                    “{e.excerpt}” — {e.source_id}
                  </blockquote>
                ))}
              </div>
            ))}
        </section>
      ))}
      <h2>Budget</h2>
      <p>
        Items {money(data.budget.items)} · Delivery{" "}
        {money(data.draft.costs.delivery)} · Installation{" "}
        {money(data.draft.costs.installation)} · Additional tax{" "}
        {money(data.draft.costs.tax)} · Discount{" "}
        {money(data.draft.costs.discount)} · Contingency{" "}
        {money(data.budget.contingency)}
      </p>
      <p>
        Total {money(data.budget.total)} · Ceiling {money(data.draft.budget)} ·
        Remaining {money(data.budget.remaining)}
      </p>
      <p>Cost basis: {data.draft.costs.notes}</p>
      <h2>Assumptions</h2>
      <ul>
        {data.draft.assumptions.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <h2>Implementation checklist</h2>
      <ul>
        {data.tasks.map((t) => (
          <li key={t.id}>
            {t.title} · {t.status} · {t.assignee || "Unassigned"} ·{" "}
            {t.due || "No date"} · Actual {money(t.actual)}
          </li>
        ))}
      </ul>
      {data.decision && (
        <p>
          Decision by {data.decision.actor} · {data.decision.at} ·{" "}
          {data.decision.note}
        </p>
      )}
      <p>
        Approval is not a guarantee of fit, inventory, delivery or business
        outcomes.
      </p>
    </article>
  );
}
export function Completion(props: ProjectProps) {
  const { w, p, dispatch, busy } = props;
  const [task, setTask] = useState<Project["tasks"][number] | null>(null);
  const [importing, setImporting] = useState(false);
  const actual = p.tasks.reduce((n, t) => n + (t.actual ?? 0), 0);
  return (
    <>
      <SectionHead
        eyebrow="05 / PUT THE PLAN INTO PRACTICE"
        title="Finish the work. Keep listening."
      />
      <div className="evidence-summary">
        <span>
          <strong>
            {p.tasks.filter((t) => t.status === "done").length} /{" "}
            {p.tasks.length}
          </strong>{" "}
          tasks completed
        </span>
        <span>
          <strong>{money(actual)}</strong> recorded actual expenditure
        </span>
        <span className="small muted">
          Unknown task costs remain unreported.
        </span>
      </div>
      {!p.tasks.length ? (
        <Empty title="Your checklist starts with an approved plan">
          <p>
            Approve a revision to create implementation and verification tasks.
            Operational actions can proceed without a purchase.
          </p>
        </Empty>
      ) : (
        <div className="card table-scroll">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Assigned to / due</th>
                <th>Status</th>
                <th>Actual cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {p.tasks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.title}</strong>
                    <small>
                      {t.kind} · Revision{" "}
                      {p.versions.find((v) => v.id === t.versionId)?.number}
                      {t.versionId !== p.currentVersionId
                        ? " · Historical scope"
                        : ""}
                    </small>
                  </td>
                  <td>
                    {t.assignee || "Unassigned"}
                    <small>{t.due || "No date"}</small>
                  </td>
                  <td>
                    <Badge tone={t.status === "done" ? "green" : "neutral"}>
                      {t.status.replaceAll("_", " ")}
                    </Badge>
                  </td>
                  <td>{money(t.actual)}</td>
                  <td>
                    {canEdit(w) && (
                      <button className="secondary" onClick={() => setTask(t)}>
                        Update
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Assets {...props} kind="completion" />
      <SectionHead title="What do later guests tell you?">
        {canEdit(w) && (
          <button className="secondary" onClick={() => setImporting(true)}>
            <Upload size={14} />
            Import follow-up reviews
          </button>
        )}
      </SectionHead>
      <div className="card">
        <p className="muted">
          Compare distinct analyzed reviews in dated windows. These are
          observations, not proof that a change caused an outcome. Operator
          resolution notes stay separate.
        </p>
        <Form
          key={p.revision}
          action={async (f) => {
            await dispatch({
              type: "saveFollowup",
              projectId: p.id,
              expected: p.revision,
              followup: {
                completedDate: text(f, "completed"),
                from: text(f, "from"),
                to: text(f, "to"),
                notes: text(f, "notes"),
              },
            });
          }}
        >
          <fieldset disabled={!canEdit(w) || busy}>
            <div className="form-grid three">
              <Field
                name="completed"
                type="date"
                label="Interventions completed"
                value={p.followup.completedDate}
              />
              <Field
                name="from"
                type="date"
                label="Follow-up from"
                value={p.followup.from}
              />
              <Field
                name="to"
                type="date"
                label="Follow-up to"
                value={p.followup.to}
              />
            </div>
            <label>
              Follow-up observations
              <textarea
                name="notes"
                defaultValue={p.followup.notes}
                rows={2}
                maxLength={2000}
              />
            </label>
            <button className="secondary">Save follow-up window</button>
          </fieldset>
        </Form>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Baseline mentions / reviews</th>
                <th>Follow-up mentions / reviews</th>
                <th>Operator assessment</th>
              </tr>
            </thead>
            <tbody>
              {p.draft.issues.map((i) => {
                const f = followup(p, i);
                return (
                  <tr key={i.id}>
                    <td>{i.title}</td>
                    <td>
                      {f.baselineMentions} / {f.baseline}
                      <small>
                        {f.baselineFrom ?? "—"} – {f.baselineTo ?? "—"}
                      </small>
                    </td>
                    <td>
                      {!f.later
                        ? "No follow-up data yet"
                        : f.mentions === null
                          ? "Analyze follow-up evidence"
                          : `${f.mentions} / ${f.later}`}
                      <small>
                        {p.followup.from} – {p.followup.to}
                      </small>
                      {f.later > 0 && f.later < 20 && (
                        <Badge tone="amber">Small sample</Badge>
                      )}
                    </td>
                    <td>
                      {i.status === "resolved"
                        ? `Resolved: ${i.resolution}`
                        : "Not marked resolved"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {importing && (
        <ReviewImport {...props} onClose={() => setImporting(false)} />
      )}
      {task && (
        <Modal title="Update implementation task" onClose={() => setTask(null)}>
          <Form
            action={async (f) => {
              if (
                await dispatch({
                  type: "saveTask",
                  projectId: p.id,
                  expected: p.revision,
                  task: {
                    ...task,
                    assignee: text(f, "assignee"),
                    due: text(f, "due"),
                    status: text(f, "status") as typeof task.status,
                    actual: cost(f, "actual"),
                  },
                })
              )
                setTask(null);
            }}
          >
            <h3>{task.title}</h3>
            <Field
              name="assignee"
              label="Assignee · member or external name"
              value={task.assignee}
            />
            <p className="small muted">
              External names are labels only. No account or notification is
              created.
            </p>
            <Field
              name="due"
              label="Planned date"
              type="date"
              value={task.due}
            />
            <label>
              Status
              <select name="status" defaultValue={task.status}>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Completed</option>
              </select>
            </label>
            <Field
              name="actual"
              label="Actual expenditure · EUR"
              type="number"
              min="0"
              step="0.01"
              value={task.actual === null ? "" : task.actual / 100}
            />
            <p className="small muted">
              Actual costs do not rewrite the approved estimate. Purchase tasks
              require current purchase readiness.
            </p>
            <button disabled={busy} className="primary">
              Save task
            </button>
          </Form>
        </Modal>
      )}
    </>
  );
}
function Assets({
  w,
  p,
  busy,
  notify,
  kind,
}: ProjectProps & { kind: "room" | "completion" }) {
  const [assets, setAssets] = useState<
    { id: string; name: string; url: string; kind: string }[]
  >([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const storageKey = `host-upgrade-planner:demo:v1:assets:${p.id}`;
  async function refresh() {
    if (w.demo) {
      setAssets(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
      return;
    }
    const q = new URLSearchParams({ workspace: w.id, project: p.id });
    const r = await fetch("/api/assets?" + q);
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    setAssets(d.assets);
  }
  useEffect(() => {
    queueMicrotask(() => refresh().catch((e) => setError(e.message))); // Asset URLs are renewed when entering the stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, kind]);
  return (
    <section className="assets-section">
      <SectionHead
        title={kind === "room" ? "Current room photos" : "Completion photos"}
      />
      <p className="small muted">
        {w.demo
          ? "Synthetic demo: uploads stay in this browser (1 MB each)."
          : "Private JPEG, PNG or WebP images. Maximum 10 MB each. Links expire after two minutes; refresh to renew."}{" "}
        Photos do not verify measurements.
      </p>
      <div className="asset-grid">
        {assets
          .filter((a) => a.kind === kind)
          .map((a) => (
            <div className="asset" key={a.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={a.name} src={a.url} />
              <p>{a.name}</p>
              {canEdit(w) && (
                <button
                  className="link-button"
                  onClick={async () => {
                    try {
                      if (w.demo) {
                        const next = assets.filter((x) => x.id !== a.id);
                        localStorage.setItem(storageKey, JSON.stringify(next));
                        setAssets(next);
                      } else {
                        const q = new URLSearchParams({
                          workspace: w.id,
                          project: p.id,
                          asset: a.id,
                        });
                        const r = await fetch("/api/assets?" + q, {
                          method: "DELETE",
                        });
                        if (!r.ok) throw Error((await r.json()).error);
                        await refresh();
                      }
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Could not delete image",
                      );
                    }
                  }}
                >
                  Remove photo
                </button>
              )}
            </div>
          ))}
      </div>
      <div className="row wrap">
        {canEdit(w) && (
          <label className="file-label">
            {uploading ? "Uploading…" : "Upload private photo"}
            <input
              disabled={busy || uploading}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setError("");
                try {
                  if (
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      file.type,
                    ) ||
                    file.size > (w.demo ? 1_000_000 : 10_485_760)
                  )
                    throw Error(
                      "Choose a supported image within the size limit.",
                    );
                  if (w.demo) {
                    const dataUrl = await new Promise<string>(
                      (resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result));
                        reader.onerror = () =>
                          reject(Error("Unable to read file."));
                        reader.readAsDataURL(file);
                      },
                    );
                    const next = [
                      ...assets,
                      { id: id(), name: file.name, kind, url: dataUrl },
                    ];
                    localStorage.setItem(storageKey, JSON.stringify(next));
                    setAssets(next);
                  } else {
                    const data = new FormData();
                    data.set("file", file);
                    data.set("workspace", w.id);
                    data.set("project", p.id);
                    data.set("kind", kind);
                    const r = await fetch("/api/assets", {
                      method: "POST",
                      body: data,
                    });
                    if (!r.ok) throw Error((await r.json()).error);
                    await refresh();
                  }
                  notify("Photo saved.");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Upload failed.");
                } finally {
                  setUploading(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
        )}
        {!w.demo && (
          <button
            className="secondary"
            onClick={() => refresh().catch((e) => setError(e.message))}
          >
            Refresh private photos
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="notice danger">
          {error}
        </p>
      )}
    </section>
  );
}
