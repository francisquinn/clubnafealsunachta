import { defineMiddleware } from "astro:middleware";
import { requireAdmin } from "./lib/auth";
import { isTrustedOrigin } from "./lib/csrf";
import { findMovedEventPath } from "./lib/movedEventRedirect";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const onRequest = defineMiddleware(async (context, next) => {
  if (!SAFE_METHODS.has(context.request.method) && !isTrustedOrigin(context.request)) {
    return new Response("Invalid origin", { status: 403 });
  }

  if (!context.url.pathname.startsWith("/admin")) {
    const response = await next();
    // #195: event pages are prerendered under their chapter, so a request that
    // reaches the SSR function and 404s is a path nothing was built for. If it
    // is an event that moved chapter, redirect to its current URL. 302, not
    // 301: admins can move an event back and forth, and a cached permanent
    // redirect would then point the wrong way. Only runs on GET/HEAD 404s, so
    // real pages never pay for the lookup.
    // UNVERIFIED: that middleware runs on Astro's default 404 render on a real
    // Netlify build has not been confirmed (previews are skipped, so it needs a
    // manual check on production after deploy).
    if (response.status === 404 && (context.request.method === "GET" || context.request.method === "HEAD")) {
      try {
        const moved = await findMovedEventPath(context.url.pathname);
        if (moved) return context.redirect(moved + context.url.search, 302);
      } catch (error) {
        // A failed lookup must never turn a 404 into a 500.
        console.error("Moved-event redirect lookup failed:", error);
      }
    }
    return response;
  }

  if (await requireAdmin(context.request)) return next();

  return context.redirect("/?login=1");
});
