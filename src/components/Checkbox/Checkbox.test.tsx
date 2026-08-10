import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import Checkbox from "./Checkbox";

describe("Checkbox", () => {
  it("renders as a real checkbox associated with its label", () => {
    render(<Checkbox id="opt-in" name="opt_in" label="Opt in" />);

    const input = screen.getByLabelText("Opt in") as HTMLInputElement;
    expect(input.type).toBe("checkbox");
    expect(input.checked).toBe(false);
  });

  it("respects defaultChecked", () => {
    render(<Checkbox id="opt-in" name="opt_in" label="Opt in" defaultChecked />);

    expect(screen.getByLabelText("Opt in")).toBeChecked();
  });

  it("toggles when clicked, including via the label text", () => {
    render(<Checkbox id="opt-in" name="opt_in" label="Opt in" />);

    const input = screen.getByLabelText("Opt in");
    fireEvent.click(screen.getByText("Opt in"));
    expect(input).toBeChecked();

    fireEvent.click(input);
    expect(input).not.toBeChecked();
  });

  it("carries the given name and value for FormData-based submission", () => {
    render(<Checkbox id="opt-in" name="opt_in" label="Opt in" value="true" defaultChecked />);

    const input = screen.getByLabelText("Opt in") as HTMLInputElement;
    expect(input.name).toBe("opt_in");
    expect(input.value).toBe("true");
  });

  it("calls onChange when toggled", () => {
    const onChange = vi.fn();
    render(<Checkbox id="opt-in" name="opt_in" label="Opt in" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Opt in"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
