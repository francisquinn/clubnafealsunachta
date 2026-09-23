import { describe, it, expect } from "vitest";
import { EVENT_TAGS, normalizeTags } from "./eventTags";

describe("eventTags", () => {
  it("keeps the tag list in alphabetical order by label", () => {
    const labels = EVENT_TAGS.map((t) => t.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it("normalizes tags into alphabetical order, dropping off-list tags and repeats", () => {
    expect(normalizeTags(["technology", "workshop", "ethics", "technology"])).toEqual(["ethics", "technology"]);
  });
});
