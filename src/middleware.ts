import { defineMiddleware } from "astro:middleware";
import { getSessionToken, verifySessionToken } from "./lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
  if (!context.url.pathname.startsWith("/admin")) {
    return next();
  }

  const token = getSessionToken(context.request);

  if (token) {
    const payload = verifySessionToken(token);
    if (payload) return next();
  }

  return context.redirect("/login");
});
