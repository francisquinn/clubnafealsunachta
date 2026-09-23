import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import TagPicker from "./TagPicker";
import { EVENT_TAGS } from "../../lib/eventTags";

function chip(name: RegExp) {
  return screen.getByRole("button", { name });
}

function postedTags(): string[] {
  return [...document.querySelectorAll<HTMLInputElement>('input[name="tags"]')].map((i) => i.value);
}

describe("TagPicker", () => {
  it("renders a chip for every tag, none selected by default", () => {
    render(<TagPicker name="tags" />);
    expect(screen.getAllByRole("button")).toHaveLength(EVENT_TAGS.length);
    expect(postedTags()).toEqual([]);
  });

  it("selects and deselects a tag", () => {
    render(<TagPicker name="tags" />);
    fireEvent.click(chip(/^ethics/));
    expect(chip(/^ethics/)).toHaveAttribute("aria-pressed", "true");
    expect(postedTags()).toEqual(["ethics"]);

    fireEvent.click(chip(/^ethics/));
    expect(chip(/^ethics/)).toHaveAttribute("aria-pressed", "false");
    expect(postedTags()).toEqual([]);
  });

  it("posts tags in the list's order, whatever order they were picked in", () => {
    render(<TagPicker name="tags" />);
    fireEvent.click(chip(/^technology/));
    fireEvent.click(chip(/^ethics/));
    expect(postedTags()).toEqual(["ethics", "technology"]);
  });

  it("disables the other chips once two are picked", () => {
    render(<TagPicker name="tags" />);
    fireEvent.click(chip(/^technology/));
    fireEvent.click(chip(/^ethics/));
    expect(chip(/^relationships/)).toBeDisabled();
    expect(chip(/^ethics/)).not.toBeDisabled();
  });

  it("re-enables the other chips when one of two is removed", () => {
    render(<TagPicker name="tags" />);
    fireEvent.click(chip(/^technology/));
    fireEvent.click(chip(/^ethics/));
    fireEvent.click(chip(/^technology/));
    expect(postedTags()).toEqual(["ethics"]);
    expect(chip(/^relationships/)).not.toBeDisabled();
  });

  it("starts from defaultValue, ignoring off-list tags", () => {
    render(<TagPicker name="tags" defaultValue={["workshop", "art-culture"]} />);
    expect(postedTags()).toEqual(["art-culture"]);
  });
});
