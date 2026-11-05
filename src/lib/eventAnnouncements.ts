import { ANNOUNCEMENT_CONNECTIONS, CLUB_FROM, createPooledTransport, isEmailConfigured } from "./email";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "./emailLinks";
import {
  eventAnnouncementSubject,
  renderEventAnnouncementEmail,
  renderEventAnnouncementText,
  type EventAnnouncement,
} from "./emailTemplate";
import { supabaseAdmin } from "./supabase";
import { unwrapRelation } from "./supabaseRelations";

// #205: emails each newly live event to its chapter's opted-in members.
// Runs after every successful deploy (netlify/functions/deploy-succeeded), so
// an event's page and .ics exist by the time the email lands. Imported
// outside Astro's build, so no astro:* imports here or in what it imports.

// The Netlify function gets 60 seconds. No new send starts after this much
// time, so the run ends cleanly and logs who wasn't emailed instead of
// being cut off mid-send.
const SEND_BUDGET_MS = 50_000;

type ClaimedEvent = {
  id: number;
  name: string;
  slug: string;
  date: string;
  end_date: string | null;
  is_online: boolean;
  meeting_url: string | null;
  description: string | null;
  created_by: string | null;
  chapter_id: number;
  venues: { name: string; url: string | null } | { name: string; url: string | null }[] | null;
  chapters: { name: string; slug: string; timezone: string } | { name: string; slug: string; timezone: string }[] | null;
};

type Recipient = { id: string; email: string };

// skipped: members not emailed because the time budget ran out.
export type AnnounceResult = { events: number; sent: number; failed: number; skipped: number };

// "Thursday 6 November @ 18:30", in the chapter's own time zone.
export function formatAnnouncementWhen(start: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone }).format(start);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(start);
  return `${day} @ ${time}`;
}

// Stamps every not-yet-announced event as announced and returns them, in
// one update, so two overlapping deploys can't both claim (and email) the
// same event. Events that have already ended are claimed too, and skipped
// below, so they're never emailed later. Only events saved before this
// deploy started: one saved mid-build isn't in it (no page yet), so it waits
// for the build its own save triggered.
async function claimUnannouncedEvents(builtBefore: Date): Promise<ClaimedEvent[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("events")
    .update({ announced_at: new Date().toISOString() })
    .is("announced_at", null)
    .lte("created_at", builtBefore.toISOString())
    .select(
      "id, name, slug, date, end_date, is_online, meeting_url, description, created_by, chapter_id, venues(name, url), chapters(name, slug, timezone)",
    );
  if (error) throw new Error(`Failed to claim events to announce: ${error.message}`);
  return (data ?? []) as ClaimedEvent[];
}

// Members of the chapter who opted in to its event emails and have a
// verified address, minus the event's host.
async function findRecipients(event: ClaimedEvent): Promise<Recipient[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from("chapter_members")
    .select("members(id, email, email_verified_at)")
    .eq("chapter_id", event.chapter_id)
    .eq("emails_enabled", true);
  if (error) throw new Error(`Failed to load recipients for event "${event.slug}": ${error.message}`);

  return (data ?? [])
    .map((row) => unwrapRelation<{ id: string; email: string | null; email_verified_at: string | null }>(row.members))
    .filter((member): member is { id: string; email: string; email_verified_at: string } =>
      Boolean(member?.email && member.email_verified_at && member.id !== event.created_by),
    )
    .map(({ id, email }) => ({ id, email }));
}

function toAnnouncement(event: ClaimedEvent, origin: string): Omit<EventAnnouncement, "unsubscribeUrl"> | null {
  const chapter = unwrapRelation(event.chapters);
  if (!chapter) return null;
  const venue = unwrapRelation(event.venues);
  const eventPath = `/${chapter.slug}/events/${event.slug}`;

  return {
    chapterName: chapter.name,
    eventName: event.name,
    when: formatAnnouncementWhen(new Date(event.date), chapter.timezone),
    place: event.is_online
      ? { kind: "online", meetingUrl: event.meeting_url }
      : venue
        ? { kind: "venue", name: venue.name, url: venue.url }
        : null,
    description: event.description,
    eventUrl: `${origin}${eventPath}`,
    settingsUrl: `${origin}/profile/edit#email-notifications`,
  };
}

// Best effort throughout: a failed send is logged and the rest carry on.
// An event is never retried, since retrying could email some members twice.
export async function announcePendingEvents(
  origin: string,
  builtBefore: Date,
  { now = new Date(), clock = Date.now, budgetMs = SEND_BUDGET_MS }: { now?: Date; clock?: () => number; budgetMs?: number } = {},
): Promise<AnnounceResult> {
  const result: AnnounceResult = { events: 0, sent: 0, failed: 0, skipped: 0 };
  // Without a transport, claiming would mark events announced that nobody
  // was emailed about. Leave them for a deploy that can send.
  if (!isEmailConfigured() || !supabaseAdmin) {
    console.warn("Email or Supabase not configured — skipping event announcements");
    return result;
  }

  const startedAt = clock();
  const events = await claimUnannouncedEvents(builtBefore);
  const transport = createPooledTransport();

  try {
    for (const event of events) {
      const ends = new Date(event.end_date ?? event.date);
      if (ends <= now) continue;

      const announcement = toAnnouncement(event, origin);
      if (!announcement) {
        console.error(`Event "${event.slug}" has no chapter — not announced`);
        continue;
      }

      let recipients: Recipient[];
      try {
        recipients = await findRecipients(event);
      } catch (error) {
        console.error(error);
        continue;
      }
      result.events += 1;

      const send = async (recipient: Recipient) => {
        const token = createUnsubscribeToken(recipient.id, event.chapter_id);
        const email: EventAnnouncement = { ...announcement, unsubscribeUrl: `${origin}/email/unsubscribe?t=${token}` };
        try {
          await transport.sendMail({
            from: CLUB_FROM,
            to: recipient.email,
            subject: eventAnnouncementSubject(email),
            text: renderEventAnnouncementText(email),
            html: renderEventAnnouncementEmail(email),
            list: { unsubscribe: `${origin}/api/unsubscribe?t=${token}` },
            headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
          });
          result.sent += 1;
        } catch (error) {
          result.failed += 1;
          console.error(`Failed to email event "${event.slug}" to member ${recipient.id}:`, error);
        }
      };

      // A few workers share the queue, one per pooled connection. Each stops
      // taking new recipients once the budget is spent.
      const queue = [...recipients];
      const notSent: string[] = [];
      const worker = async () => {
        for (let recipient = queue.shift(); recipient; recipient = queue.shift()) {
          if (clock() - startedAt >= budgetMs) {
            notSent.push(recipient.id);
            continue;
          }
          await send(recipient);
        }
      };
      await Promise.all(Array.from({ length: ANNOUNCEMENT_CONNECTIONS }, worker));

      if (notSent.length > 0) {
        result.skipped += notSent.length;
        console.error(`Out of time announcing event "${event.slug}"; not emailed: ${notSent.join(", ")}`);
      }
    }
  } finally {
    transport.close();
  }

  return result;
}

// Turns off one chapter's event emails for one member. Shared by the
// unsubscribe page's button and the one-click List-Unsubscribe endpoint. A
// member who has since left the chapter has nothing to turn off, which
// still counts as unsubscribed.
export async function unsubscribeFromChapter(memberId: string, chapterId: number): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { error } = await supabaseAdmin
    .from("chapter_members")
    .update({ emails_enabled: false })
    .eq("member_id", memberId)
    .eq("chapter_id", chapterId);
  if (error) console.error("Unsubscribe failed:", error.message);
  return !error;
}

export type UnsubscribePage = { state: "confirm" | "done" | "invalid" | "error"; chapterName: string | null };

// The /email/unsubscribe page. Opening the link (GET) only asks: mail
// scanners open every link in an email, so a link that unsubscribed on its
// own could switch members' emails off without them knowing. Pressing the
// button (a same-origin POST) does it.
export async function resolveUnsubscribePage(token: string | null, method: string): Promise<UnsubscribePage> {
  const payload = token ? verifyUnsubscribeToken(token) : null;
  if (!payload) return { state: "invalid", chapterName: null };
  if (!supabaseAdmin) return { state: "error", chapterName: null };

  const { data, error } = await supabaseAdmin.from("chapters").select("name").eq("id", payload.chapterId).maybeSingle();
  if (error) {
    console.error("Unsubscribe chapter lookup failed:", error.message);
    return { state: "error", chapterName: null };
  }
  if (!data) return { state: "invalid", chapterName: null };

  if (method !== "POST") return { state: "confirm", chapterName: data.name };
  const done = await unsubscribeFromChapter(payload.memberId, payload.chapterId);
  return { state: done ? "done" : "error", chapterName: data.name };
}
