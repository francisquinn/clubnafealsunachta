import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import MembershipBadge from "./MembershipBadge";

describe("MembershipBadge", () => {
  it("renders a single club name as a badge", () => {
    render(<MembershipBadge clubs={["Trieste"]} />);

    expect(screen.getByText("Trieste")).toBeInTheDocument();
    expect(screen.getByText("Trieste").closest("span")).toHaveClass("cnf-membership-badge");
  });

  it("renders multiple clubs as separate badges", () => {
    render(<MembershipBadge clubs={["Trieste", "Dublin"]} />);

    expect(screen.getByText("Trieste")).toBeInTheDocument();
    expect(screen.getByText("Dublin")).toBeInTheDocument();
    const badges = document.querySelectorAll(".cnf-membership-badge");
    expect(badges).toHaveLength(2);
  });

  it("renders nothing when no clubs provided", () => {
    render(<MembershipBadge clubs={[]} />);

    expect(screen.queryByText("Trieste")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".cnf-membership-badge")).toHaveLength(0);
  });

  it("applies the correct size class when size prop is provided", () => {
    render(<MembershipBadge clubs={["Trieste"]} size="sm" />);

    expect(screen.getByText("Trieste").closest("span")).toHaveClass("cnf-membership-badge--sm");
  });

  it("defaults to lg size when no size prop provided", () => {
    render(<MembershipBadge clubs={["Trieste"]} />);

    expect(screen.getByText("Trieste").closest("span")).toHaveClass("cnf-membership-badge--lg");
  });
});