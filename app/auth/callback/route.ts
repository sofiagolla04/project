import { userClient } from "@/server/supabase";
import { NextResponse } from "next/server";
export async function GET(req: Request) {
  const url = new URL(req.url),
    code = url.searchParams.get("code");
  if (code) {
    const db = await userClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          url.searchParams.get("recovery") === "1"
            ? "/auth?recovery=1"
            : "/app",
          url.origin,
        ),
      );
  }
  return NextResponse.redirect(
    new URL("/auth?error=Unable%20to%20complete%20authentication", url.origin),
  );
}
