import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabase";
import { verifyPassword, createSessionToken, SESSION_DURATION_MS, loggedInHintCookie, SECURE_COOKIE } from "../../lib/auth";
import { escapeLikePattern } from "../../lib/username";

export const prerender = false;

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const identifier = form.get("identifier")?.toString().trim() ?? "";
  const password = form.get("password")?.toString() ?? "";

  if (!identifier || !password) {
    return json({ error: "Invalid username/email or password" }, 401);
  }

  if (!supabaseAdmin) {
    return json({ error: "Server misconfiguration" }, 500);
  }

  const { data: byEmail } = await supabaseAdmin
    .from("members")
    .select("id, email, password_hash, is_admin, email_verified_at")
    .eq("email", identifier.toLowerCase())
    .single();

  const user =
    byEmail ??
    (
      await supabaseAdmin
        .from("members")
        .select("id, email, password_hash, is_admin, email_verified_at")
        .ilike("username", escapeLikePattern(identifier))
        .single()
    ).data;

  if (!user) {
    return json({ error: "Invalid username/email or password" }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return json({ error: "Invalid username/email or password" }, 401);
  }

  if (!user.email_verified_at) {
    return json({ error: "Please confirm your email before logging in — check your inbox for the confirmation link." }, 403);
  }

  const token = createSessionToken(user.id, user.is_admin);
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000);
  const cookie = `session=${token}; HttpOnly; ${SECURE_COOKIE}SameSite=Strict; Path=/; Max-Age=${maxAge}`;

  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", cookie);
  headers.append("Set-Cookie", loggedInHintCookie());

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
};
