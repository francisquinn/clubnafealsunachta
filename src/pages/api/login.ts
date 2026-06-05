import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabase";
import { verifyPassword, createSessionToken } from "../../lib/auth";

export const prerender = false;

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const email = form.get("email")?.toString() ?? "";
  const password = form.get("password")?.toString() ?? "";

  if (!email || !password) {
    return json({ error: "Invalid email or password" }, 401);
  }

  if (!supabaseAdmin) {
    return json({ error: "Server misconfiguration" }, 500);
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("password_hash, is_admin")
    .eq("email", email)
    .single();

  if (!user) {
    return json({ error: "Invalid email or password" }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return json({ error: "Invalid email or password" }, 401);
  }

  const token = createSessionToken(email, user.is_admin);
  const cookie = `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`;

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
};
