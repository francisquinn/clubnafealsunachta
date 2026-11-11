import type { APIRoute } from "astro";
import { createTransport, CLUB_FROM, isEmailConfigured } from "../../lib/email";
import { renderTopicSuggestionEmail, topicSuggestionFrom } from "../../lib/emailTemplate";
import { getSessionToken, verifySession } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabase";
import { unwrapRelation } from "../../lib/supabaseRelations";
import { getDisplayName, type DisplayableMember } from "../../lib/memberDisplay";

export const prerender = false;

function json(message: string, status: number): Response {
  return new Response(JSON.stringify({ message }), { status });
}

// #140: members only, and only for a chapter they're in. The name the
// suggestion carries is the one they show publicly, and only if they ticked
// the box; otherwise it reads as from "a member of" the chapter.
export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.EMAIL_INFO || !isEmailConfigured() || !supabaseAdmin) {
    console.error("Missing email configuration");
    return json("Server configuration error.", 500);
  }

  const session = await verifySession(getSessionToken(request));
  if (!session) {
    return json("Please log in to suggest a topic.", 401);
  }

  try {
    const body = await request.json().catch(() => null);
    const topics = body?.topics;
    const chapterId = body?.chapterId;
    const includeName = body?.includeName === true;

    if (!Array.isArray(topics) || topics.length === 0 || !topics.every((t: unknown) => typeof t === "string" && t.trim())) {
      return json("Please provide valid topic suggestions.", 400);
    }
    if (!Number.isInteger(chapterId)) {
      return json("Please choose a chapter.", 400);
    }

    const [membership, member] = await Promise.all([
      supabaseAdmin
        .from("chapter_members")
        .select("chapters(name)")
        .eq("member_id", session.memberId)
        .eq("chapter_id", chapterId)
        .maybeSingle(),
      includeName
        ? supabaseAdmin.from("members").select("username, full_name, display_full_name").eq("id", session.memberId).single()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (membership.error || member.error) {
      console.error("Topic suggestion lookup failed:", membership.error?.message ?? member.error?.message);
      return json("Whoops, something went wrong :(", 500);
    }

    const chapterName = unwrapRelation<{ name: string }>(membership.data?.chapters)?.name;
    if (!chapterName) {
      return json("You can only suggest topics for a chapter you're in.", 403);
    }
    const name = member.data ? getDisplayName(member.data as DisplayableMember) : null;

    const transporter = createTransport();

    await transporter.sendMail({
      from: CLUB_FROM,
      to: import.meta.env.EMAIL_INFO,
      subject: `New topic suggestion(s) for ${chapterName}`,
      text: `${topicSuggestionFrom({ chapterName, name })}\n\nSuggested topics: ${topics.join(", ")}`,
      html: renderTopicSuggestionEmail({ topics, chapterName, name }),
    });

    return json("Thanks for your suggestion(s)! Consider it added to my list :)", 200);
  } catch (error) {
    return json("Whoops, something went wrong :(", 500);
  }
};
