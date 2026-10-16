import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import Selector from "./Selector";

describe("Selector", () => {
  it("renders with label and options", () => {
    const onChange = vi.fn();
    render(
      <Selector
        label="City"
        options={[{ value: "trieste", label: "Trieste" }, { value: "dublin", label: "Dublin" }]}
        value="trieste"
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText("City")).toBeInTheDocument();
    expect(screen.getByText("Trieste")).toBeInTheDocument();
    // Only the real options — no placeholder entry.
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Trieste", "Dublin"]);
  });

  it("links a multi-word label to the select", () => {
    render(
      <Selector
        label="Select a chapter"
        options={[{ value: "trieste", label: "Trieste" }, { value: "online", label: "Online" }]}
        value="online"
        onChange={vi.fn()}
      />
    );

    const select = screen.getByLabelText("Select a chapter");
    expect(select).toHaveAttribute("id", "select-a-chapter-select");
    expect(select).toHaveValue("online");
    expect(screen.getByRole("option", { name: "Online" })).toHaveAttribute("value", "online");
  });

  it("renders without label when not provided", () => {
    const onChange = vi.fn();
    const { container } = render(
      <Selector
        options={[{ value: "trieste", label: "Trieste" }]}
        value="trieste"
        onChange={onChange}
      />
    );

    expect(container.querySelector("label")).toBeNull();
    expect(screen.getByRole("combobox")).toHaveAttribute("id", "cnf-select");
  });

  it("calls onChange when value changes", () => {
    const onChange = vi.fn();
    render(
      <Selector
        label="City"
        options={[{ value: "trieste", label: "Trieste" }, { value: "dublin", label: "Dublin" }]}
        value="trieste"
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: "dublin" },
    });

    expect(onChange).toHaveBeenCalledWith("dublin");
  });
});