import { getProject, quota } from "@/server/repository";
import { authorize, canEdit } from "@/lib/domain";
import { checkOrigin, errorResponse } from "@/server/http";
import { id } from "@/lib/model";
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const ctx = await getProject(
      q.get("workspace") ?? "",
      q.get("project") ?? "",
    );
    const { data, error } = await ctx.db
      .from("assets")
      .select("id,name,path,kind")
      .eq("project_id", ctx.project.id);
    if (error) throw Error(error.message);
    const assets = await Promise.all(
      (data ?? []).map(async (a) => {
        const { data: signed, error } = await ctx.admin.storage
          .from("property-private")
          .createSignedUrl(a.path, 120);
        if (error) throw Error(error.message);
        return { ...a, url: signed.signedUrl };
      }),
    );
    return Response.json(
      { assets },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    if (Number(req.headers.get("content-length") ?? 0) > 11_000_000)
      throw Error("Upload limit: 10 MB.");
    const form = await req.formData();
    const ctx = await getProject(
      String(form.get("workspace") ?? ""),
      String(form.get("project") ?? ""),
    );
    authorize(ctx.workspace, ctx.project.propertyId, true);
    await quota(ctx, "assets", 10);
    const file = form.get("file");
    const kind = form.get("kind");
    if (
      !(file instanceof File) ||
      !["room", "completion", "import"].includes(String(kind))
    )
      throw Error("Select a valid file and type.");
    if (file.size > 10_485_760 || file.size === 0)
      throw Error("Upload limit: 10 MB; empty files are invalid.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signatures: Record<string, boolean> = {
      "image/jpeg": bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      "image/png": bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10",
      "image/webp":
        new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP",
      "text/csv": kind === "import" && !bytes.includes(0),
    };
    if (
      !signatures[file.type] ||
      (kind !== "import" && !file.type.startsWith("image/"))
    )
      throw Error(
        "Supported: JPEG, PNG, WebP; CSV for imports only. File signature must match.",
      );
    const assetId = id();
    const path = `${ctx.workspace.id}/${ctx.project.propertyId}/${assetId}`;
    const { error: upload } = await ctx.admin.storage
      .from("property-private")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (upload) throw Error("Upload failed. Please retry.");
    const { error } = await ctx.admin
      .from("assets")
      .insert({
        id: assetId,
        workspace_id: ctx.workspace.id,
        property_id: ctx.project.propertyId,
        project_id: ctx.project.id,
        path,
        kind,
        name: file.name.slice(0, 200),
      });
    if (error) {
      await ctx.admin.storage.from("property-private").remove([path]);
      throw Error("File record failed; uploaded file cleanup requested.");
    }
    return Response.json({ id: assetId });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request) {
  try {
    checkOrigin(req);
    const q = new URL(req.url).searchParams;
    const ctx = await getProject(
      q.get("workspace") ?? "",
      q.get("project") ?? "",
    );
    if (!canEdit(ctx.workspace)) throw Error("Editing access required.");
    const { data, error } = await ctx.db
      .from("assets")
      .select("id,path")
      .eq("id", q.get("asset") ?? "")
      .eq("project_id", ctx.project.id)
      .single();
    if (error || !data) throw Error("Asset not found.");
    const { error: remove } = await ctx.admin.storage
      .from("property-private")
      .remove([data.path]);
    if (remove) throw Error("Could not remove file.");
    const { error: del } = await ctx.admin
      .from("assets")
      .delete()
      .eq("id", data.id);
    if (del) throw Error(del.message);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
