import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PostForm from "./PostForm";

const mockCreatePost = vi.fn();
const mockUpdatePost = vi.fn();

vi.mock("astro:actions", () => ({
  actions: {
    createPost: (...args: unknown[]) => mockCreatePost(...args),
    updatePost: (...args: unknown[]) => mockUpdatePost(...args),
  },
}));

const sampleInitialData = {
  title: "Test Post",
  slug: "test-post",
  author: "Francis Quinn",
  date: "2026-01-01",
  body: "This is the body of the post.",
};

describe("PostForm (create mode)", () => {
  beforeEach(() => {
    mockCreatePost.mockReset();
  });

  it("renders all required form fields", () => {
    render(<PostForm mode="create" />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url slug/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/author/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/body/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();
  });

  it("disables submit button while submitting", async () => {
    mockCreatePost.mockReturnValue(new Promise(() => {}));
    render(<PostForm mode="create" />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
    });
  });

  it("shows error message when action returns an error", async () => {
    mockCreatePost.mockResolvedValue({ error: { message: "Slug already exists" } });
    render(<PostForm mode="create" />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Slug already exists")).toBeInTheDocument();
    });
  });

  it("shows success state when post is created", async () => {
    mockCreatePost.mockResolvedValue({ data: { success: true } });
    render(<PostForm mode="create" />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/post created successfully/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /back to posts/i })).toHaveAttribute(
        "href",
        "/admin/posts"
      );
    });
  });
});

describe("PostForm (edit mode)", () => {
  beforeEach(() => {
    mockUpdatePost.mockReset();
  });

  it("renders 'Save changes' button instead of 'Create'", () => {
    render(<PostForm mode="edit" initialData={sampleInitialData} />);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^create$/i })).not.toBeInTheDocument();
  });

  it("pre-populates all fields from initialData", () => {
    render(<PostForm mode="edit" initialData={sampleInitialData} />);
    expect(screen.getByLabelText(/title/i)).toHaveValue("Test Post");
    expect(screen.getByLabelText(/author/i)).toHaveValue("Francis Quinn");
    expect(screen.getByLabelText(/date/i)).toHaveValue("2026-01-01");
    expect(screen.getByLabelText(/body/i)).toHaveValue("This is the body of the post.");
  });

  it("displays slug as read-only", () => {
    render(<PostForm mode="edit" initialData={sampleInitialData} />);
    const slugInput = screen.getByRole("textbox", { name: /url slug/i });
    expect(slugInput).toHaveAttribute("readOnly");
    expect(slugInput).toHaveValue("test-post");
  });

  it("shows error message when updatePost returns an error", async () => {
    mockUpdatePost.mockResolvedValue({ error: { message: "Update failed" } });
    render(<PostForm mode="edit" initialData={sampleInitialData} />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("Update failed")).toBeInTheDocument();
    });
  });

  it("shows success state with back link after update", async () => {
    mockUpdatePost.mockResolvedValue({ data: { success: true } });
    render(<PostForm mode="edit" initialData={sampleInitialData} />);

    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText(/post updated successfully/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /back to posts/i })).toHaveAttribute(
        "href",
        "/admin/posts"
      );
    });
  });
});
