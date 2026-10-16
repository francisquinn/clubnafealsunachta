import { useEffect, useState } from "react";
import { actions } from "astro:actions";

// #180: live "N going" for the event cards. The static pages bake in the
// build-time count, and RSVPs don't trigger a rebuild, so one getGoingCounts
// call on hydration refreshes every card on the page. Returns null until it
// resolves, and stays null if it fails (logged, #182), so the cards keep the
// baked-in count.
// An empty list skips the call (UpcomingEvent passes [] when its parent
// already fetched).
export function useGoingCounts(slugs: string[]): Record<string, number> | null {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const key = slugs.join("\n");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const warn = (reason: unknown) =>
      console.warn("Couldn't refresh the going counts; the cards keep their built-in ones.", reason);
    actions
      .getGoingCounts({ slugs: key.split("\n") })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          warn(error);
          return;
        }
        setCounts(data);
      })
      // The action client returns server errors as { error } but lets a
      // network failure (offline, dropped connection) reject.
      .catch((reason) => {
        if (!cancelled) warn(reason);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return counts;
}
