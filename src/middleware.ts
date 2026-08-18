import { defineMiddleware } from "astro:middleware";
import { requireAdmin } from "./lib/auth";
import { isTrustedOrigin } from "./lib/csrf";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const onRequest = defineMiddleware(async (context, next) => {
  if (!SAFE_METHODS.has(context.request.method) && !isTrustedOrigin(context.request)) {
    return new Response("Invalid origin", { status: 403 });
  }

  if (!context.url.pathname.startsWith("/admin")) {
    return next();
  }

  if (await requireAdmin(context.request)) return next();

  return context.redirect("/login");
});
