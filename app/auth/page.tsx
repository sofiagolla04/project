"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { browserClient } from "@/lib/supabase-browser";
import {
  appPath,
  authCallbackPath,
  invitationFromSearch,
} from "@/lib/auth-navigation";
export default function Auth() {
  return (
    <Suspense
      fallback={<main className="auth-wrap">Opening account access…</main>}
    >
      <AuthForm />
    </Suspense>
  );
}
function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitation = invitationFromSearch(searchParams.toString());
  const [mode, setMode] = useState<"signin" | "signup" | "reset" | "recovery">(
    () => (searchParams.get("recovery") === "1" ? "recovery" : "signin"),
  );
  const [status, setStatus] = useState(() =>
    searchParams.has("error")
      ? "Unable to complete authentication. Sign in again or request a new recovery email."
      : "",
  );
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
      const redirect = new URL(
        authCallbackPath(invitation),
        window.location.origin,
      ).href;
      if (mode === "signin") {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(appPath(invitation));
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
          redirectTo: new URL(
            authCallbackPath(invitation, true),
            window.location.origin,
          ).href,
        });
        if (error) throw error;
        setStatus("If an account exists, a recovery email will be sent.");
      } else {
        const { error } = await db.auth.updateUser({ password });
        if (error) throw error;
        router.replace(appPath(invitation));
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
            {invitation && (
              <p className="notice">
                Sign in with the email address named in your invitation. Your
                invitation will be waiting after authentication.
              </p>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit(new FormData(event.currentTarget));
              }}
            >
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
                disabled={busy}
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
                disabled={busy}
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
