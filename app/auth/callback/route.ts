import { userClient } from "@/server/supabase";
import { NextResponse } from "next/server";
import { appPath, authPath, invitationFromSearch } from "@/lib/auth-navigation";
export async function GET(req: Request) {
  const url = new URL(req.url),
    code = url.searchParams.get("code"),
    invitation = invitationFromSearch(url.searchParams);
  if (code) {
    try {
      const db = await userClient();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(
          new URL(
            url.searchParams.get("recovery") === "1"
              ? authPath(invitation, true)
              : appPath(invitation),
            url.origin,
          ),
        );
    } catch {
      // Failed/expired exchanges return to sign-in with the invitation intact.
    }
  }
  const destination = new URL(authPath(invitation), url.origin);
  destination.searchParams.set("error", "Unable to complete authentication");
  return NextResponse.redirect(destination);
}
