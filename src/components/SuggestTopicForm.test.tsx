import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SuggestTopicForm from "./SuggestTopicForm";

// #140: members-only suggestions, for one of their chapters, anonymous
// unless they tick the box.
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const TWO_CHAPTERS = [
  { id: 2, name: "Online" },
  { id: 1, name: "Trieste" },
];

function addTopic(topic: string) {
  fireEvent.click(screen.getByRole("button", { name: "Add a topic" }));
  const input = screen.getByLabelText("Topic");
  fireEvent.change(input, { target: { value: topic } });
  fireEvent.keyDown(input, { key: "Enter" });
}

function sentBody() {
  return JSON.parse(mockFetch.mock.calls[0]![1].body);
}

beforeEach(() => {
  mockFetch.mockReset();
  sessionStorage.clear();
  document.body.innerHTML = "";
});

describe("SuggestTopicForm", () => {
  it("adds a topic on Enter and hands focus back to 'Add a topic'", () => {
    render(<SuggestTopicForm chapters={TWO_CHAPTERS} displayName="aoife" />);
    addTopic("Stoicism");

    expect(screen.getByRole("list", { name: "Suggested topics" })).toHaveTextContent("Stoicism");
    expect(screen.queryByLabelText("Topic")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a topic" })).toHaveFocus();
  });

  it("closes the input on Escape without adding anything", () => {
    render(<SuggestTopicForm chapters={TWO_CHAPTERS} displayName="aoife" />);
    fireEvent.click(screen.getByRole("button", { name: "Add a topic" }));
    const input = screen.getByLabelText("Topic");
    fireEvent.change(input, { target: { value: "Stoicism" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByLabelText("Topic")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Suggested topics" })).not.toHaveTextContent("Stoicism");
    expect(screen.getByRole("button", { name: "Add a topic" })).toHaveFocus();
  });

  it("keeps Send disabled until a chapter is chosen when there are several", () => {
    render(<SuggestTopicForm chapters={TWO_CHAPTERS} displayName="aoife" />);
    addTopic("Stoicism");
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Chapter"), { target: { value: "1" } });
    expect(send).toBeEnabled();
  });

  it("pre-selects the chapter when the member is in only one", () => {
    render(<SuggestTopicForm chapters={[{ id: 1, name: "Trieste" }]} displayName="aoife" />);
    expect(screen.getByLabelText("Chapter")).toHaveValue("1");
  });

  it("sends anonymously by default", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: "Thanks" }) });
    render(<SuggestTopicForm chapters={[{ id: 1, name: "Trieste" }]} displayName="aoife" />);
    expect(screen.getByLabelText("Include my name (aoife)")).not.toBeChecked();

    addTopic("Stoicism");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(sentBody()).toEqual({ topics: ["Stoicism"], chapterId: 1, includeName: false });
  });

  it("sends includeName when the box is ticked", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: "Thanks" }) });
    render(<SuggestTopicForm chapters={[{ id: 1, name: "Trieste" }]} displayName="aoife" />);
    addTopic("Stoicism");
    fireEvent.click(screen.getByLabelText("Include my name (aoife)"));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(sentBody().includeName).toBe(true);
  });

  it("on an expired session, saves the topics and opens the login modal", async () => {
    const trigger = document.createElement("button");
    trigger.id = "cnf-login-trigger";
    const openLogin = vi.fn();
    trigger.addEventListener("click", openLogin);
    document.body.appendChild(trigger);
    mockFetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: "Please log in to suggest a topic." }) });

    render(<SuggestTopicForm chapters={[{ id: 1, name: "Trieste" }]} displayName="aoife" />);
    addTopic("Stoicism");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(openLogin).toHaveBeenCalled());
    expect(JSON.parse(sessionStorage.getItem("cnf-suggest-topics")!)).toEqual(["Stoicism"]);
  });

  it("puts saved topics back after logging in again, once", async () => {
    sessionStorage.setItem("cnf-suggest-topics", JSON.stringify(["Stoicism", "Free will"]));
    render(<SuggestTopicForm chapters={TWO_CHAPTERS} displayName="aoife" />);

    const list = screen.getByRole("list", { name: "Suggested topics" });
    await waitFor(() => expect(list).toHaveTextContent("Free will"));
    expect(list).toHaveTextContent("Stoicism");
    expect(sessionStorage.getItem("cnf-suggest-topics")).toBeNull();
  });
});
