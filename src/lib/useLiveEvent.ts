import { useEffect, useState } from "react";
import { actions } from "astro:actions";
import type { LiveEvent } from "./liveEvent";

// #197: one getEventLive call per page, shared by every island that needs it
// (the "Online" link and the action buttons are separate islands).
// "gone" = the event no longer exists (deleted since the build); null =
// transient failure, callers keep their build-time values.
type LiveResult = LiveEvent | "gone" | null;

const inflight = new Map<string, Promise<LiveResult>>();

export function resetLiveEventCache() {
  inflight.clear();
}

function load(slug: string): Promise<LiveResult> {
  let p = inflight.get(slug);
  if (!p) {
    p = actions
      .getEventLive({ slug })
      .then(({ data, error }) => {
        if (error) return error.code === "NOT_FOUND" ? ("gone" as const) : null;
        return data ? (data as LiveEvent) : null;
      })
      .catch(() => null);
    inflight.set(slug, p);
  }
  return p;
}

// live is null until loaded, and for good if the call fails transiently —
// callers fall back to their build-time props in both cases. gone means the
// event was deleted: callers hide.
export function useLiveEvent(slug: string): { live: LiveEvent | null; gone: boolean } {
  const [result, setResult] = useState<LiveResult>(null);
  useEffect(() => {
    let cancelled = false;
    load(slug).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return result === "gone" ? { live: null, gone: true } : { live: result, gone: false };
}
