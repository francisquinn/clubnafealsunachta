import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware((context, next) => {
  if (context.url.pathname !== "/create-event") {
    return next();
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return new Response("Forbidden", { status: 403 });
  }

  const auth = context.request.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const [, password] = atob(encoded).split(":");
      if (password === adminPassword) {
        return next();
      }
    }
  }

  return new Response("Unauthorised", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin"',
    },
  });
});
