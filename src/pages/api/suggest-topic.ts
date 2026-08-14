import type { APIRoute } from "astro";
import { createTransport, CLUB_FROM, isEmailConfigured } from "../../lib/email";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.EMAIL_INFO || !isEmailConfigured()) {
    console.error("Missing email configuration");
    return new Response(
      JSON.stringify({ message: "Server configuration error." }),
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const topics = body?.topics;

    if (!Array.isArray(topics) || topics.length === 0 || !topics.every((t: unknown) => typeof t === "string" && t.trim())) {
      return new Response(
        JSON.stringify({ message: "Please provide valid topic suggestions." }),
        { status: 400 }
      );
    }

    const transporter = createTransport();

    await transporter.sendMail({
      from: CLUB_FROM,
      to: import.meta.env.EMAIL_INFO,
      subject: "New topic suggestion(s)",
      text: `Suggested topics: ${topics.join(', ')}`,
    });

    return new Response(
      JSON.stringify({ message: "Thanks for your suggestion(s)! Consider it added to my list :)" }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ message: "Whoops, something went wrong :(" }),
      { status: 500 }
    );
  }
};