import "server-only";
import {
  Action,
  Project,
  projectSchema,
  workspaceSchema,
  productSchema,
  reviewSchema,
  id,
} from "@/lib/model";
import { applyAction, authorize } from "@/lib/domain";
import { authenticated } from "./supabase";
export async function loadWorkspace(workspaceId?: string) {
  const ctx = await authenticated();
  const { data: choices, error } = await ctx.db
    .from("workspaces")
    .select("id,name,settings");
  if (error) throw Error(error.message);
  const selected =
    choices?.find((w) => w.id === workspaceId) ??
    (!workspaceId ? choices?.[0] : null);
  if (!selected) return { ...ctx, workspace: null, choices: choices ?? [] };
  const wid = selected.id;
  const results = await Promise.all([
    ctx.db.from("memberships").select("*").eq("workspace_id", wid),
    ctx.db.from("property_access").select("*").eq("workspace_id", wid),
    ctx.db.from("properties").select("*").eq("workspace_id", wid),
    ctx.db.from("projects").select("*").eq("workspace_id", wid),
    ctx.db.from("catalog_items").select("data").eq("workspace_id", wid),
    ctx.db
      .from("analysis_runs")
      .select(
        "id,project_id,stage,status,input_hash,provider,model,prompt_version,created_at,finished_at,error,usage",
      )
      .eq("workspace_id", wid),
  ]);
  for (const r of results) if (r.error) throw Error(r.error.message);
  const [members, access, properties, projects, catalog, runs] = results;
  const mapped = (members.data ?? []).map((m) => ({
    id: m.user_id,
    name: m.display_name,
    role: m.role,
    approvalProperties: (access.data ?? [])
      .filter((a) => a.user_id === m.user_id && a.can_approve)
      .map((a) => a.property_id),
  }));
  const actor = mapped.find((m) => m.id === ctx.user.id);
  if (!actor) throw Error("Workspace access required.");
  const parsedProjects = (projects.data ?? []).map((row) => {
    const p = projectSchema.parse(row.data);
    p.runs = (runs.data ?? [])
      .filter((r) => r.project_id === p.id)
      .map((r) => ({
        id: r.id,
        stage: r.stage,
        status: r.status,
        inputHash: r.input_hash,
        provider: r.provider,
        model: r.model,
        promptVersion: r.prompt_version,
        at: r.created_at,
        finishedAt: r.finished_at,
        error: r.error,
        usage: r.usage,
      }));
    return p;
  });
  const offers = (catalog.data ?? []).map((row) =>
    productSchema.parse(row.data),
  );
  if (actor.role === "approver")
    for (const p of parsedProjects)
      for (const v of p.versions)
        for (const item of v.products)
          if (!offers.some((c) => c.id === item.id)) offers.push(item);
  const { data: library, error: libraryError } = await ctx.db
    .from("reviews")
    .select("property_id,data")
    .eq("workspace_id", wid);
  if (libraryError) throw Error(libraryError.message);
  const workspace = workspaceSchema.parse({
    id: wid,
    name: selected.name,
    settings: selected.settings,
    actor,
    members: mapped,
    properties: (properties.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      city: p.city,
      country: p.country,
      projects: parsedProjects.filter((x) => x.propertyId === p.id),
      library: (library ?? [])
        .filter((r) => r.property_id === p.id)
        .map((r) => reviewSchema.parse(r.data)),
    })),
    catalog: offers,
    demo: false,
  });
  return { ...ctx, workspace, choices: choices ?? [] };
}
export async function quota(
  ctx: Awaited<ReturnType<typeof authenticated>>,
  bucket = "writes",
  max = 60,
) {
  const { data, error } = await ctx.admin.rpc("rate_limit", {
    u: ctx.user.id,
    b: bucket,
    max_count: max,
  });
  if (error) throw Error(error.message);
  if (!data) throw Error("Request limit reached. Please wait a minute.");
}
export async function saveProject(
  ctx: Awaited<ReturnType<typeof loadWorkspace>>,
  p: Project,
  expected: number,
  operation: string,
) {
  const { error } = await ctx.admin.rpc("commit_project", {
    actor: ctx.user.id,
    project: p.id,
    expected,
    payload: p,
    operation,
  });
  if (error) throw Error(error.message);
}
export async function runAction(workspaceId: string, action: Action) {
  const ctx = await loadWorkspace(workspaceId);
  if (!ctx.workspace) throw Error("Workspace not found.");
  await quota(ctx);
  if (
    action.type === "persona" ||
    action.type === "analyzeDemo" ||
    action.type === "suggestDemo"
  )
    throw Error("Demo actions are unavailable in live workspaces.");
  const before = ctx.workspace;
  const next = applyAction(before, action);
  let error;
  if (action.type === "addProperty") {
    const p = next.properties.find(
      (p) => !before.properties.some((x) => x.id === p.id),
    )!;
    ({ error } = await ctx.admin.from("properties").insert({
      id: p.id,
      workspace_id: before.id,
      name: p.name,
      city: p.city,
      country: p.country,
    }));
  } else if (action.type === "addProject") {
    const p = next.properties
      .find((p) => p.id === action.propertyId)!
      .projects.at(-1)!;
    ({ error } = await ctx.admin.from("projects").insert({
      id: p.id,
      workspace_id: before.id,
      property_id: action.propertyId,
      revision: 0,
      data: p,
    }));
  } else if (action.type === "settings") {
    ({ error } = await ctx.admin
      .from("workspaces")
      .update({ settings: next.settings })
      .eq("id", before.id));
  } else if (action.type === "deleteProperty") {
    const { data: assets, error: readError } = await ctx.admin
      .from("assets")
      .select("path")
      .eq("workspace_id", before.id)
      .eq("property_id", action.propertyId);
    if (readError) throw Error(readError.message);
    if (assets?.length) {
      const { error: e } = await ctx.admin.storage
        .from("property-private")
        .remove(assets.map((a) => a.path));
      if (e) throw Error("Private asset cleanup failed; property retained.");
    }
    ({ error } = await ctx.admin
      .from("properties")
      .delete()
      .eq("workspace_id", before.id)
      .eq("id", action.propertyId));
  } else if (action.type === "deleteProject") {
    const p = before.properties
      .flatMap((x) => x.projects)
      .find((x) => x.id === action.projectId)!;
    const { data: assets, error: e } = await ctx.admin
      .from("assets")
      .select("path")
      .eq("project_id", p.id)
      .eq("workspace_id", before.id);
    if (e) throw Error(e.message);
    if (assets?.length) {
      const { error: cleanup } = await ctx.admin.storage
        .from("property-private")
        .remove(assets.map((a) => a.path));
      if (cleanup)
        throw Error("Private asset cleanup failed; project retained.");
    }
    const result = await ctx.admin
      .from("projects")
      .delete()
      .eq("workspace_id", before.id)
      .eq("id", p.id)
      .eq("revision", action.expected)
      .select("id");
    if (result.error) throw Error(result.error.message);
    if (!result.data?.length)
      throw Error("Project changed. Reload before deleting.");
  } else if (action.type === "saveProduct") {
    const p = next.catalog.find((c) => c.id === action.product.id)!;
    const { data: existing } = await ctx.admin
      .from("catalog_items")
      .select("workspace_id")
      .eq("id", p.id)
      .maybeSingle();
    if (existing && existing.workspace_id !== before.id)
      throw Error("Catalog item access required.");
    if (existing)
      ({ error } = await ctx.admin
        .from("catalog_items")
        .update({ data: p })
        .eq("id", p.id)
        .eq("workspace_id", before.id));
    else
      ({ error } = await ctx.admin
        .from("catalog_items")
        .insert({ id: p.id, workspace_id: before.id, data: p }));
  } else {
    const p = next.properties
      .flatMap((p) => p.projects)
      .find((p) => p.id === action.projectId)!;
    if (
      p.revision ===
      before.properties.flatMap((x) => x.projects).find((x) => x.id === p.id)
        ?.revision
    )
      return before;
    const beforeProjects = before.properties.flatMap((x) => x.projects);
    const changes = next.properties
      .flatMap((x) => x.projects)
      .filter((item) =>
        beforeProjects.some(
          (old) => old.id === item.id && old.revision !== item.revision,
        ),
      );
    if (changes.length > 1) {
      const payloads = changes
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((item) => ({
          expected: beforeProjects.find((old) => old.id === item.id)!.revision,
          payload: item,
        }));
      const { error: e } = await ctx.admin.rpc("commit_project_bundle", {
        actor: ctx.user.id,
        payloads,
        operation: action.type,
      });
      if (e) throw Error(e.message);
    } else await saveProject(ctx, p, action.expected, action.type);
  }
  if (error) throw Error(error.message);
  return (await loadWorkspace(before.id)).workspace;
}
export async function getProject(workspaceId: string, projectId: string) {
  const ctx = await loadWorkspace(workspaceId);
  if (!ctx.workspace) throw Error("Workspace not found.");
  const p = ctx.workspace.properties
    .flatMap((p) => p.projects)
    .find((p) => p.id === projectId);
  if (!p) throw Error("Project not found.");
  authorize(ctx.workspace, p.propertyId);
  return { ...ctx, workspace: ctx.workspace, project: p };
}
export async function createWorkspace(name: string) {
  const ctx = await authenticated();
  await quota(ctx, "workspaces", 5);
  const { data, error } = await ctx.admin.rpc("create_workspace", {
    actor: ctx.user.id,
    title: name,
    display: ctx.user.email ?? "Member",
  });
  if (error) throw Error(error.message);
  return data as string;
}
export const newToken = () => id() + id();
