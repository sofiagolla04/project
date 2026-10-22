// Auth can return only to the application and optionally carry an invitation.
// Never accept a general-purpose next/redirect URL from the query string.
const invitationPattern = /^[A-Za-z0-9_-]{50,100}$/;

function validInvitation(value?: string | null) {
  return value && invitationPattern.test(value) ? value : null;
}

export function invitationFromSearch(search: string | URLSearchParams) {
  return validInvitation(new URLSearchParams(search).get("invitation"));
}

function path(
  pathname: "/app" | "/auth" | "/auth/callback",
  invitation?: string | null,
  recovery = false,
) {
  const query = new URLSearchParams();
  const token = validInvitation(invitation);
  if (token) query.set("invitation", token);
  if (recovery) query.set("recovery", "1");
  return pathname + (query.size ? `?${query}` : "");
}

export const appPath = (invitation?: string | null) => path("/app", invitation);

export const authPath = (invitation?: string | null, recovery = false) =>
  path("/auth", invitation, recovery);

export const authCallbackPath = (
  invitation?: string | null,
  recovery = false,
) => path("/auth/callback", invitation, recovery);
