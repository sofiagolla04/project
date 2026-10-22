import { z } from "zod";
import { getProject, quota, saveProject } from "@/server/repository";
import { authorize, hash, reviewInput } from "@/lib/domain";
import type { Issue } from "@/lib/model";
import {
  reconcileAnalyzedIssues,
  retainedIssuesForAnalysis,
} from "@/lib/reconcile-analysis";
import {
  aiInput,
  callAI,
  promptVersion,
  extractionSchema,
  interventionsSchema,
  rankingSchema,
  validateAI,
} from "@/server/ai";
import { body, checkOrigin, errorResponse } from "@/server/http";
export const maxDuration = 60;
const schema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid(),
  expected: z.number().int(),
  stage: z.enum(["issues", "interventions", "options"]),
});
export async function POST(req: Request) {
  let runId: string | undefined;
  let ctx: Awaited<ReturnType<typeof getProject>> | undefined;
  try {
    checkOrigin(req);
    const input = schema.parse(await body(req));
    ctx = await getProject(input.workspaceId, input.projectId);
    authorize(ctx.workspace, ctx.project.propertyId, true);
    if (ctx.project.revision !== input.expected)
      throw Error("Project changed. Reload first.");
    // Reject invalid retained citations before requesting or billing AI work.
    if (input.stage === "issues") retainedIssuesForAnalysis(ctx.project);
    await quota(ctx, "ai", 3);
    if (!(process.env.OPENAI_API_KEY || process.env.HUP_AI_KEY))
      throw Error(
        "AI is unavailable. Your reviews are saved; continue with manual observations and interventions.",
      );
    const inputHash = hash(aiInput(ctx.workspace, ctx.project, input.stage));
    const { data: existing, error: lookup } = await ctx.admin
      .from("analysis_runs")
      .select("*")
      .eq("project_id", ctx.project.id)
      .eq("stage", input.stage)
      .eq("input_hash", inputHash)
      .maybeSingle();
    if (lookup) throw Error(lookup.message);
    let result: unknown;
    let nextIssues: Issue[] | undefined;
    if (existing?.status === "completed") {
      result = validateAI(
        input.stage,
        existing.result,
        ctx.project,
        ctx.workspace,
      );
      if (input.stage === "issues")
        nextIssues = reconcileAnalyzedIssues(
          ctx.project,
          extractionSchema.parse(result).issues,
        );
    } else {
      if (
        existing?.status === "running" &&
        Date.now() - Date.parse(existing.created_at) < 120000
      )
        throw Error("This analysis is already running. Refresh shortly.");
      const now = new Date().toISOString();
      if (existing) {
        const { data: claimed, error } = await ctx.admin
          .from("analysis_runs")
          .update({
            status: "running",
            error: null,
            created_at: now,
            finished_at: null,
          })
          .eq("id", existing.id)
          .eq("status", existing.status)
          .eq("created_at", existing.created_at)
          .select("id")
          .maybeSingle();
        if (error || !claimed) throw Error("Analysis already claimed.");
        runId = claimed.id;
      } else {
        const { data: run, error } = await ctx.admin
          .from("analysis_runs")
          .insert({
            workspace_id: ctx.workspace.id,
            property_id: ctx.project.propertyId,
            project_id: ctx.project.id,
            stage: input.stage,
            input_hash: inputHash,
            model:
              process.env.OPENAI_MODEL ||
              process.env.HUP_AI_MODEL ||
              "gpt-4.1-mini",
            prompt_version: promptVersion,
            status: "running",
          })
          .select("id")
          .single();
        if (error)
          throw Error(
            "This analysis is already registered. Refresh before retrying.",
          );
        runId = run.id;
      }
      const output = await callAI(ctx.workspace, ctx.project, input.stage);
      result = output.result;
      if (input.stage === "issues")
        nextIssues = reconcileAnalyzedIssues(
          ctx.project,
          extractionSchema.parse(result).issues,
        );
      const { error } = await ctx.admin
        .from("analysis_runs")
        .update({
          status: "completed",
          result,
          usage: output.usage,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
      if (error) throw Error(error.message);
      runId = undefined;
    }
    if (input.stage !== "options") {
      const p = structuredClone(ctx.project);
      if (input.stage === "issues") {
        p.draft.issues = nextIssues!;
        p.analysis = {
          inputHash: hash(reviewInput(p)),
          reviewIds: p.reviews.filter((r) => !r.excluded).map((r) => r.id),
          stale: false,
          at: new Date().toISOString(),
        };
      } else p.draft.lines = interventionsSchema.parse(result).lines;
      p.currentVersionId = null;
      p.revision++;
      p.events.push({
        at: new Date().toISOString(),
        actor: ctx.workspace.actor.name,
        action: `AI ${input.stage}`,
      });
      await saveProject(ctx, p, input.expected, "ai");
    } else rankingSchema.parse(result);
    return Response.json({
      result,
      workspace: (await getProject(input.workspaceId, input.projectId))
        .workspace,
    });
  } catch (e) {
    if (runId && ctx)
      await ctx.admin
        .from("analysis_runs")
        .update({
          status: "failed",
          error:
            "Analysis failed. Inputs retained; retry or continue manually.",
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    return errorResponse(e);
  }
}
