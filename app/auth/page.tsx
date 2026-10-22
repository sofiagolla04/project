"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/lib/supabase-browser";
export default function Auth() {
 const router=useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "reset" | "recovery">(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("recovery")
        ? "recovery"
        : "signin",
  );
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const configured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  async function submit(form: FormData) {
    setBusy(true);
    setStatus("");
    try {
      const db = browserClient(),
        email = String(form.get("email")),
        password = String(form.get("password"));
      const redirect = window.location.origin + "/auth/callback";
      if (mode === "signin") {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/app");
      } else if (mode === "signup") {
        const { error } = await db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect },
        });
        if (error) throw error;
        setStatus("Check your email to confirm your account, then sign in.");
      } else if (mode === "reset") {
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: redirect + "?recovery=1",
        });
        if (error) throw error;
        setStatus("If an account exists, a recovery email will be sent.");
      } else {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        router.replace("/app");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-wrap">
      <Link href="/" className="brand">
        Host Upgrade Planner
      </Link>
      <div className="card auth-card">
        <p className="eyebrow">A MORE THOUGHTFUL WAY TO HOST</p>
        <h1>
          {mode === "signin"
            ? "Welcome back."
            : mode === "signup"
              ? "Make room for better."
              : mode === "reset"
                ? "Recover your account."
                : "Choose a new password."}
        </h1>
        {!configured ? (
          <>
            <p>Live account services have not been configured yet.</p>
            <Link className="button primary" href="/demo">
              Explore the separate demo
            </Link>
          </>
        ) : (
          <>
            <form action={submit}>
              {mode !== "recovery" && (
                <label>
                  Email
                  <input
                    required
                    type="email"
                    name="email"
                    autoComplete="email"
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label>
                  Password
                  <input
                    required
                    minLength={10}
                    maxLength={100}
                    type="password"
                    name="password"
                    autoComplete={
                      mode === "signin" ? "current-password" : "new-password"
                    }
                  />
                </label>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : mode === "reset"
                        ? "Send recovery email"
                        : "Update password"}
              </button>
            </form>
            <div className="row wrap">
              <button
                className="link-button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setStatus("");
                }}
              >
                {mode === "signup"
                  ? "Already have an account? Sign in"
                  : "Create an account"}
              </button>
              <button
                className="link-button"
                onClick={() => {
                  setMode("reset");
                  setStatus("");
                }}
              >
                Forgot password?
              </button>
            </div>
          </>
        )}
        {status && (
          <p role="status" className="notice">
            {status}
          </p>
        )}
        <Link href="/">← Back to home</Link>
      </div>
    </main>
  );
}
