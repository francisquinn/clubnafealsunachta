export const prerender = false;
import type { APIRoute } from "astro";
import { getSessionToken, verifySessionToken } from "../../lib/auth";

export const GET: APIRoute = ({ request }) => {
  const token = getSessionToken(request);
  const payload = token ? verifySessionToken(token) : null;

  return new Response(JSON.stringify({ isAdmin: !!payload }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};
