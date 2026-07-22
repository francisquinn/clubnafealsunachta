import { defineMiddleware } from "astro:middleware";
import { getSessionToken, verifySessionToken } from "./lib/auth";
import { isTrustedOrigin } from "./lib/csrf";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const onRequest = defineMiddleware(async (context, next) => {
  if (!SAFE_METHODS.has(context.request.method) && !isTrustedOrigin(context.request)) {
    return new Response("Invalid origin", { status: 403 });
  }

  if (!context.url.pathname.startsWith("/admin")) {
    return next();
  }

  const token = getSessionToken(context.request);

  if (token) {
    const payload = verifySessionToken(token);
    if (payload?.isAdmin) return next();
  }

  return context.redirect("/login");
});
