import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ClubSubscriptions from "./ClubSubscriptions";

const mockUpdateClubMemberships = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    updateClubMemberships: (...args: unknown[]) => mockUpdateClubMemberships(...args),
  },
}));

const TRESTE = { id: 1, name: "Trieste" };
const DUBLIN = { id: 2, name: "Dublin" };

function form() {
  return screen.getByRole("form", { name: /club subscriptions form/i });
}

function submittedFormData() {
  return mockUpdateClubMemberships.mock.calls[0]?.[0] as FormData;
}

describe("ClubSubscriptions", () => {
  beforeEach(() => {
    mockUpdateClubMemberships.mockReset();
  });

  it("renders a checkbox per club, reflecting current memberships on load", () => {
    render(<ClubSubscriptions clubs={[TRESTE, DUBLIN]} initialClubIds={[1]} />);

    expect(screen.getByRole("checkbox", { name: "Trieste" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Dublin" })).not.toBeChecked();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("makes clear subscriptions drive per-club updates only, not browsing or RSVP", () => {
    render(<ClubSubscriptions clubs={[TRESTE]} initialClubIds={[]} />);

    expect(
      screen.getByText(/news and updates.*still browse events and RSVP from any club/i)
    ).toBeInTheDocument();
  });

  it("submits the checked clubs to updateClubMemberships and reports success", async () => {
    mockUpdateClubMemberships.mockResolvedValue({ data: { success: true, club_ids: [1, 2] } });
    render(<ClubSubscriptions clubs={[TRESTE, DUBLIN]} initialClubIds={[1]} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Dublin" }));
    fireEvent.submit(form());

    await waitFor(() => {
      expect(screen.getByText(/your club subscriptions have been updated/i)).toBeInTheDocument();
    });
    expect(mockUpdateClubMemberships).toHaveBeenCalledTimes(1);
    expect(submittedFormData().getAll("club_id")).toEqual(["1", "2"]);
  });

  it("submits no club ids when every checkbox is cleared, unregistering from all clubs", async () => {
    mockUpdateClubMemberships.mockResolvedValue({ data: { success: true, club_ids: [] } });
    render(<ClubSubscriptions clubs={[TRESTE, DUBLIN]} initialClubIds={[1, 2]} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Trieste" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Dublin" }));
    fireEvent.submit(form());

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
    expect(submittedFormData().getAll("club_id")).toEqual([]);
  });

  it("surfaces an action error without reporting success", async () => {
    mockUpdateClubMemberships.mockResolvedValue({ error: { message: "One or more selected clubs do not exist" } });
    render(<ClubSubscriptions clubs={[TRESTE]} initialClubIds={[]} />);

    fireEvent.submit(form());

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("One or more selected clubs do not exist");
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("disables the submit button while submitting", async () => {
    mockUpdateClubMemberships.mockReturnValue(new Promise(() => {}));
    render(<ClubSubscriptions clubs={[TRESTE]} initialClubIds={[]} />);

    fireEvent.submit(form());

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save subscriptions/i })).toBeDisabled();
    });
  });
});