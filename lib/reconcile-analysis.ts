import { validateEvidence } from "./domain";
import type { Issue, Project } from "./model";

/** Protect work that has already been selected or explicitly assessed. */
export function retainedIssuesForAnalysis(project: Project): Issue[] {
  const linkedIds = new Set(
    project.draft.lines.flatMap((line) => line.issueIds),
  );
  for (const line of project.draft.lines) {
    if (
      line.issueIds.some(
        (issueId) =>
          !project.draft.issues.some((issue) => issue.id === issueId),
      )
    )
      throw Error(
        `The intervention "${line.title}" refers to a missing issue. Review its issue links in Options before analyzing again. Your current plan has not been changed.`,
      );
  }

  const retained = project.draft.issues.filter(
    (issue) =>
      linkedIds.has(issue.id) ||
      !issue.evidence.length ||
      issue.status !== "open" ||
      issue.evidence.some(
        (evidence) => evidence.source_type === "operator_observation",
      ),
  );
  const ids = new Set<string>();
  for (const issue of retained) {
    if (!issue.id.trim() || ids.has(issue.id))
      throw Error(
        "Existing retained issues need distinct IDs before analysis. Your current plan has not been changed.",
      );
    ids.add(issue.id);
    try {
      validateEvidence([issue], project);
    } catch {
      throw Error(
        `Cannot refresh "${issue.title}": an existing intervention or manual assessment still uses evidence or a room that is no longer valid. Restore the changed source review, or use Evidence → Edit classification to correct the room or remove unsupported or outdated citations. Then analyze again. Your current plan has not been changed.`,
      );
    }
  }
  return structuredClone(retained);
}

/** Reanalysis adds findings without deleting work, costs or operator decisions. */
export function reconcileAnalyzedIssues(
  project: Project,
  extracted: Issue[],
): Issue[] {
  const extractedIds = new Set<string>();
  for (const issue of extracted) {
    if (!issue.id.trim() || extractedIds.has(issue.id))
      throw Error(
        "AI returned empty or duplicate issue IDs. Retry the analysis; your current plan has not been changed.",
      );
    extractedIds.add(issue.id);
  }
  validateEvidence(extracted, project);

  const retained = retainedIssuesForAnalysis(project);
  const retainedIds = new Set(retained.map((issue) => issue.id));
  // A model response must not replace a human observation, decision or a
  // finding already used by an intervention, even when it reuses its ID.
  return [
    ...retained,
    ...structuredClone(extracted.filter((issue) => !retainedIds.has(issue.id))),
  ];
}
