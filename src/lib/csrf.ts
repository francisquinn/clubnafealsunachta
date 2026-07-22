export function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin") ?? refererOrigin(request);
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function refererOrigin(request: Request): string | null {
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
