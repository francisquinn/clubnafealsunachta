import { announcePendingEvents } from "../../src/lib/eventAnnouncements";

// #205: Netlify calls this after every successful deploy (the file name
// subscribes it to the deploy-succeeded event). Creating an event triggers
// a rebuild, so this is the moment its page is live: email any events not
// announced yet to their chapters' opted-in members.
//
// The file-name convention, not the typed `deploySucceeded` handler: typed
// event handlers run in the background, and background functions aren't on
// the legacy Free plan. This runs as a normal function, so it has 60
// seconds; announcePendingEvents stops starting sends before that. Netlify
// signs event requests, so outside callers can't trigger it. Repeat runs
// are harmless: each event is claimed once. URL is the site's main address.
type DeployPayload = { id?: string; context?: string; created_at?: string };

export default async (req: Request): Promise<Response> => {
  const body = (await req.json().catch(() => null)) as { payload?: DeployPayload } | null;
  const deploy = body?.payload;

  // Deploy previews and branch deploys use the same database: only the
  // live site announces.
  if (deploy?.context !== "production") {
    if (!deploy?.context) console.error("Event announcements skipped: deploy payload has no context", Object.keys(deploy ?? {}));
    return new Response(null, { status: 204 });
  }

  // When the deploy was created, before its build read the events: the
  // cut-off for which events this deploy has pages for.
  const builtBefore = new Date(deploy.created_at ?? "");
  if (Number.isNaN(builtBefore.getTime())) {
    console.error(`Event announcements skipped: deploy ${deploy.id} has no valid created_at`, Object.keys(deploy));
    return new Response(null, { status: 204 });
  }

  const result = await announcePendingEvents(process.env.URL ?? "https://clubnafealsunachta.com", builtBefore);
  console.log(
    `Event announcements: ${result.events} event(s), ${result.sent} sent, ${result.failed} failed, ${result.skipped} not sent (out of time)`,
  );
  return new Response(null, { status: 204 });
};
