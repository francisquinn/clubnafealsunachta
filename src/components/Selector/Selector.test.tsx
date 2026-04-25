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
        options={["Trieste", "Dublin"]}
        value="Trieste"
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText("City")).toBeInTheDocument();
    expect(screen.getByText("Trieste")).toBeInTheDocument();
    expect(screen.getByText("Select city")).toBeInTheDocument();
  });

  it("renders without label when not provided", () => {
    const onChange = vi.fn();
    render(
      <Selector
        options={["Trieste"]}
        value="Trieste"
        onChange={onChange}
      />
    );

    expect(screen.getByText("Select a location")).toBeInTheDocument();
  });

  it("calls onChange when value changes", () => {
    const onChange = vi.fn();
    render(
      <Selector
        label="City"
        options={["Trieste", "Dublin"]}
        value="Trieste"
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: "Dublin" },
    });

    expect(onChange).toHaveBeenCalledWith("Dublin");
  });
});