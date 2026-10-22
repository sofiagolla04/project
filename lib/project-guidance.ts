import { budget, canApprove, canEdit, hash, readiness } from "./domain";
import type { Project, Workspace } from "./model";

export type ProjectGuidance = {
  stage: 0 | 1 | 2 | 3 | 4;
  title: string;
  description: string;
  actionLabel: string;
  tone: "neutral" | "amber" | "green";
};

// Navigation advice only: authorization, submission and purchase checks remain
// in the domain layer. Missing optional fields do not become new requirements.
export function getProjectGuidance(p: Project, w: Workspace): ProjectGuidance {
  const current = p.versions.find((v) => v.id === p.currentVersionId);
  const latest = p.versions.at(-1);
  const state = readiness(p, w);
  const editable = canEdit(w);
  const step = (
    stage: ProjectGuidance["stage"],
    title: string,
    description: string,
    actionLabel: string,
    tone: ProjectGuidance["tone"] = "neutral",
  ): ProjectGuidance => ({ stage, title, description, actionLabel, tone });

  if (current?.status === "submitted") {
    return canApprove(w, p.propertyId)
      ? step(
          3,
          "A revision is ready for your decision.",
          `Review revision ${current.number}, including its evidence, budget and open conditions, before recording a decision.`,
          "Review submitted plan",
          "amber",
        )
      : step(
          3,
          "The plan is waiting for an approver.",
          `Revision ${current.number} has been submitted. A member with approval rights for this property can decide.`,
          "View submitted plan",
        );
  }

  if (!editable) {
    if (state.approved)
      return step(
        4,
        "Follow the approved work.",
        "View the implementation checklist and recorded expenditure. Approval does not clear outstanding purchase checks.",
        "View implementation",
      );
    if (latest?.status === "changes_requested" || latest?.status === "rejected")
      return step(
        3,
        latest.status === "rejected"
          ? "The previous revision was rejected."
          : "Changes were requested.",
        "Review the recorded decision. An editor can prepare and submit an updated plan.",
        "View decision history",
        "amber",
      );
    return step(
      3,
      "There is no revision awaiting your decision.",
      "An editor must submit the current plan before you can approve it.",
      "View approval status",
    );
  }

  if (state.approved) {
    const tasks = p.tasks.filter((t) => t.versionId === current?.id);
    const unfinished = tasks.filter((t) => t.status !== "done");
    const pendingPurchase = unfinished.some((t) => t.kind === "purchase");
    if (tasks.length && !unfinished.length)
      return step(
        4,
        "Record what changed after the work.",
        "The current revision's tasks are complete. Record completion and compare distinct later reviews in a dated follow-up.",
        "Review completion & follow-up",
        "green",
      );
    if (!state.readyToBuy && pendingPurchase)
      return step(
        2,
        "Resolve the remaining purchase checks.",
        `Purchases remain blocked. ${state.buyReasons[0] ?? "Review the recorded verification conditions."}`,
        "Review options & checks",
        "amber",
      );
    return step(
      4,
      "Put the approved plan into practice.",
      "Track the current revision's tasks and actual expenditure, then record completion and follow-up.",
      "Open implementation checklist",
      "green",
    );
  }

  // A frozen approval can remain in history while catalog facts change.
  if (current?.status === "approved")
    return step(
      2,
      "The approved plan needs a new review.",
      "The current scope or catalog facts differ from the approved snapshot. Update the affected intervention and submit a new revision.",
      "Review changed options",
      "amber",
    );

  if (p.analysis?.stale)
    return step(
      1,
      "Review the feedback that changed.",
      "Check the current sources and citations, then confirm reviewed evidence manually or run a fresh analysis.",
      "Review current evidence",
      "amber",
    );

  if (
    (latest?.status === "rejected" || latest?.status === "changes_requested") &&
    hash(latest.draft) === hash(p.draft)
  )
    return step(
      2,
      latest.status === "rejected"
        ? "Revise the rejected plan."
        : "Update the plan after the requested changes.",
      "Read the decision note in Approval, then edit the relevant interventions or budget before resubmitting.",
      "Update the options",
      "amber",
    );

  if (!p.draft.lines.length) {
    const hasSources =
      p.reviews.some((r) => !r.excluded) || p.observations.length;
    if (!hasSources && !p.draft.problems.trim())
      return step(
        0,
        "Start with one improvement goal.",
        "Describe the issue you want to address and check the project budget. You can add measurements as the plan develops.",
        "Set the project brief",
      );
    if (!hasSources)
      return step(
        1,
        "Bring in the feedback behind the plan.",
        "Import guest reviews or add your own observation. Manual planning is available without AI.",
        "Add feedback or an observation",
      );
    if (!p.draft.issues.some((i) => i.status === "open"))
      return step(
        1,
        "Decide what deserves attention.",
        "Read the feedback and record an observation, or analyze reviews when available. Keep the project as a draft if no change is justified.",
        "Review feedback",
      );
    return step(
      2,
      "Choose the smallest useful change.",
      "Add an intervention for an identified issue: a purchase, an operational change, an inspection, or keeping what already works.",
      "Choose interventions",
    );
  }

  if (!state.reviewable) {
    const costs = budget(p.draft);
    return step(
      2,
      costs.missing.length
        ? "Complete the plan's cost information."
        : costs.remaining !== null && costs.remaining < 0
          ? "Bring the plan within its budget."
          : "Resolve the plan's open checks.",
      state.reasons.join(" "),
      "Review options & budget",
      "amber",
    );
  }

  return step(
    3,
    latest
      ? "Submit the updated plan for a decision."
      : "Your plan can be reviewed.",
    "Review the exact scope, costs and conditions, then submit a revision. Purchase readiness is checked separately.",
    "Review & submit the plan",
    "green",
  );
}
