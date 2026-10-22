import { getProject } from "@/server/repository";
import { exportProject, shoppingCSV } from "@/lib/domain";
import { errorResponse } from "@/server/http";
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const ctx = await getProject(
      q.get("workspace") ?? "",
      q.get("project") ?? "",
    );
    const data = exportProject(ctx.workspace, ctx.project, q.get("version"));
    const csv = q.get("format") === "csv";
    return new Response(
      csv ? shoppingCSV(data) : JSON.stringify(data, null, 2),
      {
        headers: {
          "Content-Type": csv ? "text/csv; charset=utf-8" : "application/json",
          "Content-Disposition": `attachment; filename="host-plan-${csv ? "budget.csv" : "project.json"}"`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
