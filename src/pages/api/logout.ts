import type { APIRoute } from "astro";
import { clearedLoggedInHintCookie, clearedAvatarHintCookie, SECURE_COOKIE } from "../../lib/auth";

export const prerender = false;

export const POST: APIRoute = () => {
  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", `session=; HttpOnly; ${SECURE_COOKIE}SameSite=Strict; Path=/; Max-Age=0`);
  headers.append("Set-Cookie", clearedLoggedInHintCookie());
  headers.append("Set-Cookie", clearedAvatarHintCookie());

  return new Response(null, { status: 302, headers });
};
