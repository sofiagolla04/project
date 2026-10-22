import "server-only";
export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Operation failed.";
  const status = /Sign in required/.test(message)
    ? 401
    : /permission|access required|rights required|not found/i.test(message)
      ? 403
      : /changed|Concurrent|reload/i.test(message)
        ? 409
        : 400;
  return Response.json({ error: message }, { status });
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN;
  if (!origin || !expected || origin !== new URL(expected).origin)
    throw Error("Invalid request origin. Configure APP_ORIGIN.");
}
export async function body(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 4_000_000)
    throw Error("Request limit: 4 MB.");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 4_000_000)
    throw Error("Request limit: 4 MB.");
  return JSON.parse(text);
}
