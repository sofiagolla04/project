import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appPath,
  authCallbackPath,
  authPath,
  invitationFromSearch,
} from "../lib/auth-navigation";

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("@/server/supabase", () => ({
  userClient: async () => ({ auth: { exchangeCodeForSession } }),
}));
import { GET } from "../app/auth/callback/route";

const origin = "https://planner.example";
const invitation =
  "11111111-1111-4111-8111-11111111111122222222-2222-4222-8222-222222222222";

describe("invitation navigation", () => {
  it("carries an invitation through sign-in and email confirmation paths", () => {
    const auth = new URL(
      authPath(invitationFromSearch(`?invitation=${invitation}`)),
      origin,
    );
    const token = invitationFromSearch(auth.searchParams);
    const callback = new URL(authCallbackPath(token), origin);
    const destination = new URL(
      appPath(invitationFromSearch(callback.searchParams)),
      origin,
    );
    expect(auth.pathname).toBe("/auth");
    expect(callback.pathname).toBe("/auth/callback");
    expect(destination.pathname).toBe("/app");
    expect(destination.searchParams.get("invitation")).toBe(invitation);
  });

  it("keeps recovery separate without losing a pending invitation", () => {
    const callback = new URL(authCallbackPath(invitation, true), origin);
    expect(callback.searchParams.get("recovery")).toBe("1");
    const recovery = new URL(
      authPath(invitationFromSearch(callback.searchParams), true),
      origin,
    );
    expect(recovery.pathname).toBe("/auth");
    expect(recovery.searchParams.get("recovery")).toBe("1");
    expect(recovery.searchParams.get("invitation")).toBe(invitation);
  });

  it("does not require an invitation for normal authentication", () => {
    expect(authPath()).toBe("/auth");
    expect(authCallbackPath()).toBe("/auth/callback");
    expect(appPath()).toBe("/app");
  });

  it("rejects malformed tokens and does not forward arbitrary destinations", () => {
    for (const token of [
      "short",
      "a".repeat(101),
      `//evil.example/${"a".repeat(60)}`,
      `${"a".repeat(60)}&next=https://evil.example`,
      `javascript:${"a".repeat(60)}`,
    ]) {
      expect(
        invitationFromSearch(`?invitation=${encodeURIComponent(token)}`),
      ).toBeNull();
      expect(appPath(token)).toBe("/app");
    }
    expect(appPath(invitationFromSearch("?next=https://evil.example"))).toBe(
      "/app",
    );
  });
});

describe("authentication callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
  });
  afterEach(() => vi.resetAllMocks());

  it("returns an authenticated invitee to the pending invitation", async () => {
    const response = await GET(
      new Request(
        `${origin}/auth/callback?code=test-code&invitation=${invitation}&next=https://evil.example`,
      ),
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    expect(response.headers.get("location")).toBe(
      `${origin}/app?invitation=${invitation}`,
    );
  });

  it("keeps an invitation while opening the password recovery form", async () => {
    const response = await GET(
      new Request(
        `${origin}/auth/callback?code=test-code&invitation=${invitation}&recovery=1`,
      ),
    );
    expect(response.headers.get("location")).toBe(
      `${origin}/auth?invitation=${invitation}&recovery=1`,
    );
  });

  it("retains the invitation after a rejected or interrupted exchange", async () => {
    for (const failure of ["rejected", "interrupted"]) {
      if (failure === "rejected")
        exchangeCodeForSession.mockResolvedValueOnce({
          error: new Error("Expired code"),
        });
      else exchangeCodeForSession.mockRejectedValueOnce(Error("Unavailable"));
      const response = await GET(
        new Request(
          `${origin}/auth/callback?code=expired&invitation=${invitation}&recovery=1`,
        ),
      );
      const destination = new URL(response.headers.get("location")!);
      expect(destination.origin).toBe(origin);
      expect(destination.pathname).toBe("/auth");
      expect(destination.searchParams.get("invitation")).toBe(invitation);
      expect(destination.searchParams.has("recovery")).toBe(false);
      expect(destination.searchParams.get("error")).toBeTruthy();
    }
  });

  it("returns missing codes to sign-in without contacting the provider", async () => {
    const response = await GET(
      new Request(`${origin}/auth/callback?invitation=${invitation}`),
    );
    const destination = new URL(response.headers.get("location")!);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(destination.pathname).toBe("/auth");
    expect(destination.searchParams.get("invitation")).toBe(invitation);
    expect(destination.searchParams.has("error")).toBe(true);
  });
});
