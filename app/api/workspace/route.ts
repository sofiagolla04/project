import { z } from "zod";
import { hash } from "@/lib/domain";
import {
  loadWorkspace,
  createWorkspace,
  newToken,
  quota,
} from "@/server/repository";
import { authenticated } from "@/server/supabase";
import { body, checkOrigin, errorResponse } from "@/server/http";
export async function GET(req: Request) {
  try {
    const ctx = await loadWorkspace(
      new URL(req.url).searchParams.get("id") ?? undefined,
    );
    return Response.json({
      workspace: ctx.workspace,
      choices: ctx.choices,
      user: { id: ctx.user.id, email: ctx.user.email },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
const schema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create"),
    name: z.string().trim().min(1).max(150),
  }),
  z.object({
    op: z.literal("invite"),
    workspaceId: z.string().uuid(),
    email: z.email(),
    role: z.enum(["administrator", "operator", "approver"]),
    propertyIds: z.array(z.string().uuid()).max(100),
  }),
  z.object({ op: z.literal("accept"), token: z.string().min(50).max(100) }),
  z.object({
    op: z.literal("permissions"),
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.enum(["administrator", "operator", "approver"]),
    propertyIds: z.array(z.string().uuid()).max(100),
  }),
]);
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const data = schema.parse(await body(req));
    if (data.op === "create")
      return Response.json({ workspaceId: await createWorkspace(data.name) });
    if (data.op === "accept") {
      const ctx = await authenticated();
      await quota(ctx, "invitations", 10);
      const { data: wid, error } = await ctx.admin.rpc("accept_invitation", {
        actor: ctx.user.id,
        digest: hash(data.token),
      });
      if (error) throw Error(error.message);
      return Response.json({ workspaceId: wid });
    }
    const ctx = await loadWorkspace(data.workspaceId);
    if (ctx.workspace?.actor.role !== "administrator")
      throw Error("Administrator access required.");
    await quota(ctx, "members", 20);
    if (
      data.propertyIds.some(
        (pid) => !ctx.workspace!.properties.some((p) => p.id === pid),
      )
    )
      throw Error("Property access required.");
    if (data.op === "invite") {
      const token = newToken();
      const { error } = await ctx.admin
        .from("invitations")
        .insert({
          workspace_id: data.workspaceId,
          email: data.email.toLowerCase(),
          role: data.role,
          property_ids: data.propertyIds,
          token_hash: hash(token),
          expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
          created_by: ctx.user.id,
        });
      if (error) throw Error(error.message);
      return Response.json({
        link: `${process.env.APP_ORIGIN}/app?invitation=${encodeURIComponent(token)}`,
        expiresHours: 48,
      });
    }
    const { error } = await ctx.admin.rpc("set_member_permissions", {
      actor: ctx.user.id,
      wid: data.workspaceId,
      member: data.userId,
      new_role: data.role,
      property_ids: data.propertyIds,
    });
    if (error) throw Error(error.message);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
