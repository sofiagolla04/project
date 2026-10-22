import { actionSchema } from "@/lib/model";
import { runAction } from "@/server/repository";
import { body, checkOrigin, errorResponse } from "@/server/http";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const data = z
      .object({ workspaceId: z.string().uuid(), action: actionSchema })
      .parse(await body(req));
    return Response.json({
      workspace: await runAction(data.workspaceId, data.action),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
