import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import Avatar from "./Avatar";
import { getAvatarColor } from "../../lib/avatarColor";

describe("Avatar", () => {
  it("renders the photo when avatarUrl is set", () => {
    render(<Avatar avatarUrl="https://example.com/a.png" alt="Alice" id="alice-id" size="sm" />);

    const img = screen.getByAltText("Alice") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/a.png");
    expect(img.className).toContain("cnf-avatar--sm");
  });

  // #70 follow-up: avatars only ever render at 32-64px, so a Supabase-
  // stored photo goes through the render/image transform (see
  // lib/avatarTransform.ts) instead of serving the full original.
  it("requests a resized image via Supabase's transform endpoint for a Supabase-stored photo", () => {
    render(
      <Avatar
        avatarUrl="https://x.supabase.co/storage/v1/object/public/avatars/member-1"
        alt="Alice"
        id="alice-id"
        size="lg"
      />
    );

    const img = screen.getByAltText("Alice") as HTMLImageElement;
    expect(img.src).toBe("https://x.supabase.co/storage/v1/render/image/public/avatars/member-1?width=128&height=128");
  });

  it("falls back to a letter avatar when there's no photo", () => {
    render(<Avatar avatarUrl={null} alt="Bob" id="bob-id" size="lg" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const fallback = document.querySelector(".cnf-avatar--fallback");
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveClass("cnf-avatar--lg");
    expect(fallback).toHaveTextContent("B");
    expect(fallback).toHaveStyle({ backgroundColor: getAvatarColor("bob-id") });
  });

  // The color comes from the id, not the name — two different people whose
  // names start with the same letter still get their own stable colors.
  it("derives the fallback color from id, not alt", () => {
    render(<Avatar avatarUrl={null} alt="Carol" id="carol-id" size="sm" />);

    const fallback = document.querySelector(".cnf-avatar--fallback");
    expect(fallback).toHaveStyle({ backgroundColor: getAvatarColor("carol-id") });
  });

  // #70 follow-up: a stored avatar_url can outlive its actual Storage
  // object (the file deleted out from under it) — a broken image load
  // should read as "no photo", not bare alt text.
  it("falls back to a letter avatar when the photo fails to load", () => {
    render(<Avatar avatarUrl="https://example.com/missing.png" alt="Dave" id="dave-id" size="sm" />);

    fireEvent.error(screen.getByAltText("Dave"));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const fallback = document.querySelector(".cnf-avatar--fallback");
    expect(fallback).toBeInTheDocument();
    expect(fallback).toHaveTextContent("D");
  });
});
