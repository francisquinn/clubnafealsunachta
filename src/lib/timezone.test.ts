import { describe, it, expect } from "vitest";
import { localWallTimeToUtc, utcToLocalWallTime } from "./timezone";

const ROME = "Europe/Rome";

describe("localWallTimeToUtc", () => {
  it("converts a CEST (summer) wall-clock time to UTC, 2 hours back", () => {
    // Sep 4 is well within CEST (last Sunday of March to last Sunday of
    // October) — Rome is UTC+2.
    const utc = localWallTimeToUtc("2026-09-04T18:30", ROME);
    expect(utc.toISOString()).toBe("2026-09-04T16:30:00.000Z");
  });

  it("converts a CET (winter) wall-clock time to UTC, 1 hour back", () => {
    const utc = localWallTimeToUtc("2026-02-05T18:00", ROME);
    expect(utc.toISOString()).toBe("2026-02-05T17:00:00.000Z");
  });

  it("resolves correctly on the day right after the CET->CEST switch", () => {
    // DST starts 2026-03-29 in the EU (last Sunday of March).
    const utc = localWallTimeToUtc("2026-03-30T18:30", ROME);
    expect(utc.toISOString()).toBe("2026-03-30T16:30:00.000Z");
  });

  it("resolves correctly on the day right before the CEST->CET switch", () => {
    // DST ends 2026-10-25 in the EU (last Sunday of October).
    const utc = localWallTimeToUtc("2026-10-24T18:30", ROME);
    expect(utc.toISOString()).toBe("2026-10-24T16:30:00.000Z");
  });

  it("resolves a wall-clock time shortly before the spring-forward instant itself (#72)", () => {
    // DST starts 2026-03-29 in the EU: clocks jump from 02:00 CET straight to
    // 03:00 CEST, i.e. the transition instant is 01:00 UTC. 01:30 local is
    // still CET (+1h) — the naive-as-UTC guess (01:30Z) falls just after that
    // instant and would misread it as CEST (+2h) without the correction.
    const utc = localWallTimeToUtc("2026-03-29T01:30", ROME);
    expect(utc.toISOString()).toBe("2026-03-29T00:30:00.000Z");
  });

  it("resolves a wall-clock time shortly before the fall-back instant itself (#72)", () => {
    // DST ends 2026-10-25 in the EU: clocks fall back from 03:00 CEST to
    // 02:00 CET, i.e. the transition instant is 01:00 UTC. 01:30 local is
    // still CEST (+2h), unambiguous (before the 02:00-03:00 hour that then
    // repeats) — the naive-as-UTC guess (01:30Z) falls just after that
    // instant and would misread it as CET (+1h) without the correction.
    const utc = localWallTimeToUtc("2026-10-25T01:30", ROME);
    expect(utc.toISOString()).toBe("2026-10-24T23:30:00.000Z");
  });
});

describe("utcToLocalWallTime", () => {
  it("is the exact inverse of localWallTimeToUtc for a CEST date", () => {
    const naive = "2026-09-04T18:30";
    const utc = localWallTimeToUtc(naive, ROME);
    expect(utcToLocalWallTime(utc, ROME)).toBe(naive);
  });

  it("is the exact inverse of localWallTimeToUtc for a CET date", () => {
    const naive = "2026-02-05T18:00";
    const utc = localWallTimeToUtc(naive, ROME);
    expect(utcToLocalWallTime(utc, ROME)).toBe(naive);
  });

  it("renders a known UTC instant as Rome's CEST wall-clock time", () => {
    expect(utcToLocalWallTime(new Date("2026-09-04T16:30:00.000Z"), ROME)).toBe(
      "2026-09-04T18:30"
    );
  });
});
