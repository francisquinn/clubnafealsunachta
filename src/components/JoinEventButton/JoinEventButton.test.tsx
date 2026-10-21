import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import JoinEventButton from "./JoinEventButton";

describe("JoinEventButton", () => {
  it("renders a Join online link to the meeting url", () => {
    render(<JoinEventButton meetingUrl="https://meet.jit.si/test" />);
    expect(screen.getByRole("link", { name: /join online/i })).toHaveAttribute("href", "https://meet.jit.si/test");
  });
});
