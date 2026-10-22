"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  House,
  LayoutDashboard,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Settings as SettingsIcon,
  Package,
  ChevronRight,
  LogOut,
  Check,
  MessageSquareText,
  CalendarDays,
  Menu,
  RotateCcw,
  X,
  Leaf,
  FolderOpen,
} from "lucide-react";
import { Workspace, Action, workspaceSchema, Project } from "@/lib/model";
import { applyAction, budget, canEdit, readiness } from "@/lib/domain";
import { DEMO_STORAGE, demoWorkspace } from "@/lib/demo";
import { browserClient } from "@/lib/supabase-browser";
import { authPath, invitationFromSearch } from "@/lib/auth-navigation";
import { getProjectGuidance } from "@/lib/project-guidance";
import { ProjectGuidance } from "./project-guidance";
import { Badge, Empty, Field, Modal, text } from "./ui";
import { Form, confirmDiscard } from "./ui";
import {
  Brief,
  Evidence,
  Options,
  Approval,
  Completion,
  ProjectProps,
} from "./project";
import { Catalog, Settings } from "./workspace";
const stages = ["Brief", "Evidence", "Options", "Approval", "Completion"];
export default function Planner({ mode }: { mode: "demo" | "live" }) {
  const router = useRouter();
  const [w, setW] = useState<Workspace | null>(null);
  const wr = useRef<Workspace | null>(null);
  const [view, setView] = useState("overview");
  const [stage, setStage] = useState(0);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState<"property" | "project" | "reset" | null>(
    null,
  );
  const [choices, setChoices] = useState<{ id: string; name: string }[]>([]);
  const [newWorkspace, setNewWorkspace] = useState(false);
  const [invitation, setInvitation] = useState<string | null>(null);
  const notify = (msg: string) => {
    setMessage(msg);
    setError("");
  };
  function install(next: Workspace) {
    wr.current = next;
    setW(next);
    if (mode === "demo")
      try {
        localStorage.setItem(DEMO_STORAGE, JSON.stringify(next));
      } catch {
        setError(
          "Browser storage is full or unavailable. Export your work before leaving.",
        );
      }
  }
  async function reload(wid?: string) {
    const r = await fetch(
      "/api/workspace" + (wid ? "?id=" + encodeURIComponent(wid) : ""),
    );
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 401) {
        router.replace(authPath(invitationFromSearch(window.location.search)));
        return;
      }
      throw Error(data.error);
    }
    setChoices(data.choices);
    if (data.workspace) install(workspaceSchema.parse(data.workspace));
    else {
      wr.current = null;
      setW(null);
      setNewWorkspace(true);
    }
  }
  useEffect(() => {
    queueMicrotask(() => {
      if (mode === "demo") {
        try {
          const saved = localStorage.getItem(DEMO_STORAGE);
          install(
            saved ? workspaceSchema.parse(JSON.parse(saved)) : demoWorkspace(),
          );
        } catch {
          setError(
            "Saved demo data could not be loaded. A new synthetic demo has been opened.",
          );
          install(demoWorkspace());
        }
      } else {
        setInvitation(invitationFromSearch(window.location.search));
        reload().catch((e) => setError(e.message));
      }
    });
    // Initial adapter selection is intentionally fixed for this mounted page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (document.querySelector('form[data-dirty="true"]'))
        event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  async function dispatch(action: Action) {
    if (!wr.current) return false;
    setBusy(true);
    setError("");
    try {
      if (mode === "demo") install(applyAction(wr.current, action));
      else {
        const r = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: wr.current.id, action }),
        });
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        install(workspaceSchema.parse(data.workspace));
      }
      notify(
        action.type === "submit"
          ? "Revision submitted for approval."
          : action.type === "decide"
            ? "Decision recorded against this revision."
            : "Changes saved.",
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function ai(
    stageName: "issues" | "interventions" | "options",
    p: Project,
  ) {
    if (!w) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "demo") {
        if (stageName === "issues") {
          install(
            applyAction(wr.current!, {
              type: "analyzeDemo",
              projectId: p.id,
              expected: p.revision,
            }),
          );
          notify("Synthetic evidence reanalyzed from current reviews.");
        } else if (stageName === "interventions") {
          if (
            p.draft.lines.length &&
            !window.confirm(
              "Replace current draft interventions with suggestions based on the current synthetic evidence?",
            )
          )
            return;
          install(
            applyAction(wr.current!, {
              type: "suggestDemo",
              projectId: p.id,
              expected: p.revision,
            }),
          );
          notify(
            "Synthetic suggestions recomputed from current issues. Confirm assumptions and costs.",
          );
        } else
          notify(
            "These offers are synthetic. Review the dimensions, stock status and allowances in each option card; no retailer facts have been verified.",
          );
        return;
      }
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: w.id,
          projectId: p.id,
          expected: p.revision,
          stage: stageName,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      install(data.workspace);
      notify(
        stageName === "options"
          ? data.result.options
              .map((o: { explanation: string }) => o.explanation)
              .join(" · ") || "No suitable catalog options found."
          : "Analysis saved. Review the evidence and assumptions.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Analysis failed. Inputs retained.",
      );
    } finally {
      setBusy(false);
    }
  }
  function navigate(nextView: string) {
    if (busy || (nextView !== view && !confirmDiscard())) return;
    setView(nextView);
    setMobile(false);
  }
  function openProject(p: Project, nextStage = 0) {
    if (busy || !confirmDiscard()) return;
    setProjectId(p.id);
    setView("project");
    setStage(nextStage);
    setMobile(false);
    setMessage("");
  }
  const visible =
    w?.properties.filter(
      (p) =>
        w.actor.role !== "approver" ||
        w.actor.approvalProperties.includes(p.id),
    ) ?? [];
  const projects = visible.flatMap((p) => p.projects);
  const p = projects.find((p) => p.id === projectId) ?? projects[0];
  const property = visible.find((x) => x.id === p?.propertyId);
  const props: ProjectProps | undefined =
    w && p && property
      ? { w, p, property, dispatch, busy, notify, ai }
      : undefined;
  if (!w)
    return (
      <main className="setup-page">
        <Link href="/" className="eyebrow">
          HOST UPGRADE PLANNER
        </Link>
        <h1>
          {newWorkspace ? "Your first workspace." : "Opening your workspace…"}
        </h1>
        {error && (
          <p role="alert" className="notice danger">
            {error}
          </p>
        )}
        {newWorkspace && (
          <Form
            action={async (f) => {
              setBusy(true);
              try {
                const r = await fetch("/api/workspace", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ op: "create", name: text(f, "name") }),
                });
                const data = await r.json();
                if (!r.ok) throw Error(data.error);
                await reload(data.workspaceId);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not create workspace.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field
              name="name"
              label="Workspace name"
              required
              placeholder="Your property portfolio"
            />
            <button disabled={busy} className="primary">
              Create workspace
            </button>
          </Form>
        )}
        {invitation && (
          <button
            className="secondary"
            onClick={async () => {
              try {
                const r = await fetch("/api/workspace", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ op: "accept", token: invitation }),
                });
                const d = await r.json();
                if (!r.ok) throw Error(d.error);
                setInvitation(null);
                history.replaceState({}, "", "/app");
                await reload(d.workspaceId);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not accept invitation.",
                );
              }
            }}
          >
            Accept invitation
          </button>
        )}
      </main>
    );
  const awaiting = projects.filter((p) =>
    p.versions.some(
      (v) => v.id === p.currentVersionId && v.status === "submitted",
    ),
  ).length;
  const tasks = projects
    .flatMap((p) =>
      p.tasks
        .filter((t) => t.status !== "done")
        .map((t) => ({ ...t, project: p })),
    )
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  return (
    <div className="app-shell">
      {mode === "demo" && (
        <div className="demo-banner">
          <span>
            <span className="dot" />
            Demo — synthetic data{" "}
            <span className="banner-extra">
              · Explore freely. Changes stay in this browser.
            </span>
          </span>
          <button onClick={() => setModal("reset")}>
            <RotateCcw size={12} /> Reset demo
          </button>
        </div>
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link
          href="/"
          className="brand"
          onNavigate={(event) => {
            if (busy || !confirmDiscard()) event.preventDefault();
          }}
        >
          <span className="brand-mark">
            <House size={22} />
          </span>
          <span>
            Host Upgrade<span className="brand-sub">PLANNER</span>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">{w.name.slice(0, 1)}</span>
          <div>
            <strong>{w.name}</strong>
            <small>
              {mode === "demo" ? "DEMO WORKSPACE" : "YOUR WORKSPACE"}
            </small>
          </div>
        </div>
        {mode === "live" && choices.length > 1 && (
          <label className="sr-only-label">
            Workspace
            <select
              aria-label="Workspace"
              value={w.id}
              disabled={busy}
              onChange={(e) => {
                if (confirmDiscard())
                  reload(e.target.value)
                    .then(() => {
                      setView("overview");
                      setProjectId("");
                      setStage(0);
                    })
                    .catch((e) => setError(e.message));
              }}
            >
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <nav aria-label="Main navigation">
          <button
            className={view === "overview" ? "nav-item active" : "nav-item"}
            onClick={() => navigate("overview")}
          >
            <LayoutDashboard size={18} />
            Overview
          </button>
          <p className="nav-label">
            YOUR PROPERTIES <span>{visible.length}</span>
          </p>
          {visible.map((property) => (
            <div key={property.id}>
              <button
                className={`nav-item property-nav ${view === "project" && p?.propertyId === property.id ? "selected" : ""}`}
                onClick={() => {
                  if (property.projects[0]) openProject(property.projects[0]);
                  else {
                    if (!confirmDiscard()) return;
                    setView("overview");
                    setMobile(false);
                    notify(
                      `${property.name} has no projects. Choose New project to begin.`,
                    );
                  }
                }}
              >
                <House size={17} />
                <span>{property.name}</span>
                <ChevronRight size={13} />
              </button>
              {view === "project" &&
                p?.propertyId === property.id &&
                property.projects.map((proj) => (
                  <button
                    key={proj.id}
                    className={`project-sub ${proj.id === p.id ? "selected" : ""}`}
                    onClick={() => openProject(proj)}
                  >
                    <span className="dot" />
                    {proj.name}
                  </button>
                ))}
            </div>
          ))}
          {canEdit(w) && (
            <button
              className="nav-item add-property"
              onClick={() => setModal("property")}
            >
              <Plus size={16} />
              Add property
            </button>
          )}
          <div className="nav-divider" />
          <button
            className={`nav-item ${view === "catalog" ? "active" : ""}`}
            onClick={() => navigate("catalog")}
          >
            <Package size={18} />
            Product catalog
          </button>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <SettingsIcon size={18} />
            Workspace settings
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="tip-card">
            <Leaf size={20} />
            <strong>Keep what works.</strong>
            <p>
              A thoughtful refresh starts with the useful things you already
              have.
            </p>
          </div>
          <div className="actor">
            <span className="avatar">{w.actor.name.slice(0, 1)}</span>
            <div>
              <strong>{w.actor.name}</strong>
              <small>{w.actor.role}</small>
            </div>
            {mode === "live" && (
              <button
                className="icon-button"
                title="Sign out"
                aria-label="Sign out"
                disabled={busy}
                onClick={async () => {
                  if (!confirmDiscard()) return;
                  await browserClient().auth.signOut();
                  router.replace("/");
                }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="row">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {view === "project"
                ? property?.name
                : view === "catalog"
                  ? "Product catalog"
                  : view === "settings"
                    ? "Settings"
                    : "Overview"}
            </strong>
          </div>
          <div className="row">
            {mode === "demo" && (
              <label className="persona-label">
                <span>Viewing as</span>
                <select
                  aria-label="Demo persona"
                  value={w.actor.id}
                  disabled={busy}
                  onChange={(e) => {
                    if (confirmDiscard())
                      dispatch({ type: "persona", memberId: e.target.value });
                  }}
                >
                  {w.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="top-avatar">{w.actor.name.slice(0, 1)}</span>
          </div>
        </header>
        <main className="workspace-main">
          {(message || error) && (
            <div
              role={error ? "alert" : "status"}
              className={`notice ${error ? "danger" : "success"}`}
            >
              <span>{error || message}</span>
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => {
                  setError("");
                  setMessage("");
                }}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {busy && (
            <div className="saving" role="status">
              Saving / processing…
            </div>
          )}
          {invitation && (
            <div className="notice amber">
              <span>
                You have an invitation. Accept it with the intended, verified
                email account.
              </span>
              <button
                onClick={async () => {
                  try {
                    const r = await fetch("/api/workspace", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ op: "accept", token: invitation }),
                    });
                    const d = await r.json();
                    if (!r.ok) throw Error(d.error);
                    setInvitation(null);
                    history.replaceState({}, "", "/app");
                    await reload(d.workspaceId);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "Invitation failed.",
                    );
                  }
                }}
              >
                Accept invitation
              </button>
            </div>
          )}
          {view === "overview" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    YOUR PORTFOLIO, THOUGHTFULLY IMPROVED
                  </p>
                  <h1>
                    A little better, every stay<span className="green">.</span>
                  </h1>
                  <p>Turn what guests tell you into a clear plan of action.</p>
                </div>
                {canEdit(w) && (
                  <button
                    className="primary"
                    onClick={() => setModal("project")}
                  >
                    <Plus size={17} />
                    New project
                  </button>
                )}
              </div>
              <div className="stats-grid">
                <div className="stat">
                  <span>Properties</span>
                  <House size={18} />
                  <strong>{visible.length.toString().padStart(2, "0")}</strong>
                  <small>In your portfolio</small>
                </div>
                <div className="stat">
                  <span>Active projects</span>
                  <FolderOpen size={18} />
                  <strong>
                    {projects
                      .filter(
                        (p) =>
                          !p.tasks.length ||
                          p.tasks.some((t) => t.status !== "done"),
                      )
                      .length.toString()
                      .padStart(2, "0")}
                  </strong>
                  <small>One practical step at a time</small>
                </div>
                <div className="stat">
                  <span>Awaiting approval</span>
                  <Check size={18} />
                  <strong>{awaiting.toString().padStart(2, "0")}</strong>
                  <small>
                    {awaiting
                      ? "Ready for a decision"
                      : "Nothing waiting right now"}
                  </small>
                </div>
                <div className="stat">
                  <span>Open tasks</span>
                  <CalendarDays size={18} />
                  <strong>{tasks.length.toString().padStart(2, "0")}</strong>
                  <small>Across your projects</small>
                </div>
              </div>
              <div className="overview-columns">
                <section>
                  <div className="section-head">
                    <h2>Your improvement projects</h2>
                    <Badge>
                      {projects.length}{" "}
                      {projects.length === 1 ? "project" : "projects"}
                    </Badge>
                  </div>
                  {!projects.length ? (
                    <Empty title="A good place to begin">
                      <p>
                        Add a property and create its first improvement project.
                      </p>
                      {canEdit(w) && (
                        <button
                          className="primary"
                          onClick={() =>
                            setModal(visible.length ? "project" : "property")
                          }
                        >
                          Get started
                        </button>
                      )}
                    </Empty>
                  ) : (
                    projects.map((proj) => {
                      const property = visible.find(
                        (x) => x.id === proj.propertyId,
                      )!;
                      const b = budget(proj.draft);
                      const r = readiness(proj, w);
                      const decision = proj.versions.find(
                        (version) => version.id === proj.currentVersionId,
                      )?.status;
                      return (
                        <button
                          key={proj.id}
                          className="project-card"
                          onClick={() => openProject(proj)}
                        >
                          <div className="property-thumb">
                            <House size={29} />
                            <span>{property.city}</span>
                          </div>
                          <div className="project-card-content">
                            <div className="row between">
                              <span className="eyebrow">{property.name}</span>
                              <Badge tone={r.approved ? "green" : "amber"}>
                                {r.approved
                                  ? "Approved"
                                  : decision === "submitted"
                                    ? "Awaiting decision"
                                    : decision === "changes_requested"
                                      ? "Changes requested"
                                      : decision === "rejected"
                                        ? "Rejected"
                                        : "Draft plan"}
                              </Badge>
                            </div>
                            <h3>{proj.name}</h3>
                            <p>
                              {proj.draft.problems ||
                                "Start with the brief, then build your improvement plan."}
                            </p>
                            <div className="project-card-bottom">
                              <span>
                                <MessageSquareText size={14} />
                                {
                                  proj.reviews.filter((r) => !r.excluded).length
                                }{" "}
                                reviews
                              </span>
                              <span>
                                {b.total === null
                                  ? "Budget incomplete"
                                  : `${Math.round(b.total / 100)} / ${Math.round(proj.draft.budget / 100)} EUR`}
                              </span>
                              <ArrowUpRight size={18} />
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                  <div className="workflow-note">
                    <span className="icon-soft">
                      <Leaf size={20} />
                    </span>
                    <div>
                      <strong>Better decisions, before you buy.</strong>
                      <p>
                        Evidence first. Measured options. A budget everyone
                        understands.
                      </p>
                    </div>
                  </div>
                </section>
                <aside className="overview-aside">
                  <div className="card next-card">
                    <p className="eyebrow">A SIMPLE WAY FORWARD</p>
                    <h2>
                      From guest feedback
                      <br />
                      to a finished refresh.
                    </h2>
                    <ol>
                      {[
                        "Set a clear brief",
                        "Listen to the evidence",
                        "Choose practical options",
                        "Agree on the plan",
                        "Complete & follow up",
                      ].map((s, i) => (
                        <li key={s}>
                          <span>{i + 1}</span>
                          {s}
                        </li>
                      ))}
                    </ol>
                    {p && (
                      <button
                        className="secondary"
                        onClick={() =>
                          openProject(p, getProjectGuidance(p, w).stage)
                        }
                      >
                        Continue your project <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                  <div className="section-head">
                    <h3>Coming up</h3>
                    <CalendarDays size={17} />
                  </div>
                  {tasks.length ? (
                    tasks.slice(0, 4).map((t) => (
                      <button
                        className="deadline"
                        key={t.id}
                        onClick={() => openProject(t.project, 4)}
                      >
                        <strong>{t.title}</strong>
                        <span>
                          {t.due || "No date set"} · {t.project.name}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="muted small">
                      No upcoming tasks. Your implementation checklist appears
                      after approval.
                    </p>
                  )}
                </aside>
              </div>
            </>
          )}
          {/* The object contains event callbacks; none reads a ref during rendering. */}
          {/* eslint-disable-next-line react-hooks/refs */}
          {view === "project" && props && (
            <>
              <div className="page-heading project-heading">
                <div>
                  <button
                    className="back-link"
                    onClick={() => navigate("overview")}
                  >
                    ← All projects
                  </button>
                  <h1>{p.name}</h1>
                  <p>
                    {property?.name} <span className="middot">·</span>{" "}
                    {property?.city} <span className="middot">·</span>{" "}
                    {mode === "demo"
                      ? "Synthetic example"
                      : "Private workspace"}
                  </p>
                </div>
                <Badge tone={readiness(p, w).approved ? "green" : "amber"}>
                  {readiness(p, w).approved
                    ? "Current plan approved"
                    : p.versions.some(
                          (version) =>
                            version.id === p.currentVersionId &&
                            version.status === "submitted",
                        )
                      ? "Submitted for decision"
                      : "Needs approval"}
                </Badge>
              </div>
              <ProjectGuidance
                guidance={getProjectGuidance(p, w)}
                disabled={busy}
                onNavigate={(nextStage) => {
                  if (stage !== nextStage && confirmDiscard())
                    setStage(nextStage);
                }}
              />
              <nav className="stage-nav" aria-label="Project stages">
                {stages.map((s, i) => (
                  <button
                    key={s}
                    disabled={busy}
                    onClick={() => {
                      if (stage !== i && confirmDiscard()) setStage(i);
                    }}
                    className={stage === i ? "active" : ""}
                    aria-current={stage === i ? "step" : undefined}
                  >
                    <span>{i + 1}</span>
                    {s}
                  </button>
                ))}
              </nav>
              <div
                className="stage-content"
                key={`${w.id}:${w.actor.id}:${p.id}:${stage}`}
              >
                {stage === 0 ? (
                  <Brief {...props} />
                ) : stage === 1 ? (
                  <Evidence {...props} />
                ) : stage === 2 ? (
                  <Options {...props} />
                ) : stage === 3 ? (
                  <Approval {...props} />
                ) : (
                  <Completion {...props} />
                )}
              </div>
              <div className="stage-footer">
                <span>
                  {stage + 1} of 5 · {stages[stage]}
                </span>
                {stage < 4 && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      if (confirmDiscard()) setStage(stage + 1);
                    }}
                  >
                    Continue to {stages[stage + 1].toLowerCase()}{" "}
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </>
          )}
          {view === "catalog" && (
            <Catalog
              key={`${w.id}:${w.actor.id}`}
              w={w}
              dispatch={dispatch}
              busy={busy}
              notify={notify}
            />
          )}
          {view === "settings" && (
            <Settings
              key={`${w.id}:${w.actor.id}`}
              w={w}
              dispatch={dispatch}
              busy={busy}
              notify={notify}
              reload={() => reload(w.id)}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>Small changes. Thoughtful stays.</span>
          <span>
            {mode === "demo"
              ? "Synthetic demo · Local browser storage"
              : "Private workspace · Europe/Rome"}
          </span>
        </footer>
      </div>
      {modal === "property" && (
        <Modal title="Add property" onClose={() => setModal(null)}>
          <Form
            action={async (f) => {
              if (
                await dispatch({
                  type: "addProperty",
                  name: text(f, "name"),
                  city: text(f, "city"),
                })
              )
                setModal(null);
            }}
          >
            <Field
              name="name"
              label="Property name"
              required
              placeholder="e.g. Santa Croce Studio"
            />
            <Field name="city" label="City" placeholder="Florence" />
            <p className="muted small">
              No street address or guest details needed.
            </p>
            <button disabled={busy} className="primary">
              Add property
            </button>
          </Form>
        </Modal>
      )}
      {modal === "project" && (
        <Modal title="New improvement project" onClose={() => setModal(null)}>
          {!visible.length ? (
            <>
              <p>Add your first property before creating a project.</p>
              <button className="primary" onClick={() => setModal("property")}>
                Add property
              </button>
            </>
          ) : (
            <Form
              action={async (f) => {
                if (
                  await dispatch({
                    type: "addProject",
                    propertyId: text(f, "property"),
                    name: text(f, "name"),
                  })
                ) {
                  setModal(null);
                  setView("overview");
                }
              }}
            >
              <label>
                Property
                <select name="property">
                  {visible.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                name="name"
                label="Project name"
                required
                placeholder="A more comfortable bedroom"
              />
              <button disabled={busy} className="primary">
                Create project
              </button>
            </Form>
          )}
        </Modal>
      )}
      {modal === "reset" && (
        <Modal title="Reset the synthetic demo?" onClose={() => setModal(null)}>
          <p>
            This removes your changes to the demo in this browser. Export
            anything you want to keep first.
          </p>
          <button
            className="primary"
            onClick={() => {
              for (const key of Object.keys(localStorage))
                if (key.startsWith(DEMO_STORAGE + ":assets:"))
                  localStorage.removeItem(key);
              install(demoWorkspace());
              setView("overview");
              setProjectId("");
              setModal(null);
              notify("Synthetic demo reset.");
            }}
          >
            Reset demo
          </button>
        </Modal>
      )}
    </div>
  );
}
