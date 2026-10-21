import { describe, it, expect, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import SeeAllEventsLink from "./SeeAllEventsLink";
import { setChosenChapter } from "../../utils/chapterChoice";

const SLUGS = ["trieste", "online"];

describe("SeeAllEventsLink", () => {
  beforeEach(() => localStorage.clear());

  it("falls back to the default chapter when none is chosen", () => {
    render(<SeeAllEventsLink chapterSlugs={SLUGS} />);
    expect(screen.getByRole("link", { name: "See all events" })).toHaveAttribute("href", "/trieste/events");
  });

  it("links to the chosen chapter", async () => {
    setChosenChapter("online");
    render(<SeeAllEventsLink chapterSlugs={SLUGS} />);
    expect(await screen.findByRole("link", { name: "See all events" })).toHaveAttribute("href", "/online/events");
  });

  it("ignores a malformed stored value", () => {
    localStorage.setItem("cnf-chosen-chapter", "../evil");
    render(<SeeAllEventsLink chapterSlugs={SLUGS} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/trieste/events");
  });

  it("falls back when the stored slug is not a current chapter", () => {
    setChosenChapter("atlantis");
    render(<SeeAllEventsLink chapterSlugs={SLUGS} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/trieste/events");
  });
});
