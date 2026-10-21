import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
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

  describe("keyboard navigation (#196)", () => {
    const options = [
      { value: "trieste", label: "Trieste" },
      { value: "dublin", label: "Dublin" },
      { value: "online", label: "Online" },
    ];
    const setup = (value = "trieste") => {
      const onChange = vi.fn();
      const utils = render(<Selector label="City" options={options} value={value} onChange={onChange} />);
      return { onChange, select: screen.getByLabelText("City") as HTMLSelectElement, ...utils };
    };

    it("does not commit on arrow steps but moves the selection", () => {
      const { onChange, select } = setup();
      fireEvent.keyDown(select, { key: "ArrowDown" });
      fireEvent.change(select, { target: { value: "dublin" } });
      fireEvent.keyUp(select, { key: "ArrowDown" });
      fireEvent.keyDown(select, { key: "ArrowDown" });
      fireEvent.change(select, { target: { value: "online" } });
      fireEvent.keyUp(select, { key: "ArrowDown" });
      expect(onChange).not.toHaveBeenCalled();
      expect(select).toHaveValue("online");
    });

    it("commits a mouse pick after arrowing, with no blur in between", () => {
      const { onChange, select } = setup();
      fireEvent.keyDown(select, { key: "ArrowDown" });
      fireEvent.change(select, { target: { value: "dublin" } });
      fireEvent.keyUp(select, { key: "ArrowDown" });
      fireEvent.change(select, { target: { value: "online" } });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("online");
    });

    it("does not commit on a type-ahead letter", () => {
      const { onChange, select } = setup();
      fireEvent.keyDown(select, { key: "d" });
      fireEvent.change(select, { target: { value: "dublin" } });
      fireEvent.keyUp(select, { key: "d" });
      expect(onChange).not.toHaveBeenCalled();
      expect(select).toHaveValue("dublin");
    });

    it("commits on Enter after arrowing", () => {
      const { onChange, select } = setup();
      fireEvent.keyDown(select, { key: "ArrowDown" });
      fireEvent.change(select, { target: { value: "dublin" } });
      fireEvent.keyUp(select, { key: "ArrowDown" });
      fireEvent.keyDown(select, { key: "Enter" });
      fireEvent.keyUp(select, { key: "Enter" });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("dublin");
    });

    it("never commits on blur: arrow then Tab does not call onChange and reverts the draft", () => {
      const { onChange, select } = setup();
      fireEvent.keyDown(select, { key: "ArrowDown" });
      fireEvent.change(select, { target: { value: "dublin" } });
      fireEvent.keyUp(select, { key: "ArrowDown" });
      fireEvent.keyDown(select, { key: "Tab" });
      fireEvent.blur(select);
      fireEvent.keyUp(select, { key: "Tab" });
      expect(onChange).not.toHaveBeenCalled();
      expect(select).toHaveValue("trieste");
    });

    it("tabbing past a select whose value matches no option does not call onChange", () => {
      const { onChange, select } = setup("nowhere");
      fireEvent.focus(select);
      fireEvent.keyDown(select, { key: "Tab" });
      fireEvent.blur(select);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("a mouse pick followed by blur calls onChange once and keeps the pick", () => {
      const { onChange, select } = setup();
      fireEvent.change(select, { target: { value: "dublin" } });
      fireEvent.blur(select);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(select).toHaveValue("dublin");
    });

    it("Enter after an open-dropdown pick (change already committed) does not commit twice", () => {
      const { onChange, select } = setup();
      fireEvent.keyDown(select, { key: "Enter" });
      fireEvent.change(select, { target: { value: "dublin" } });
      fireEvent.keyUp(select, { key: "Enter" });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("blur clears the keyboard flag", () => {
      const { onChange, select } = setup();
      fireEvent.keyDown(select, { key: "ArrowDown" }); // keyup never arrives
      fireEvent.blur(select);
      fireEvent.change(select, { target: { value: "dublin" } });
      expect(onChange).toHaveBeenCalledWith("dublin");
    });

    it("pointerdown clears the keyboard flag", () => {
      const { onChange, select } = setup();
      fireEvent.keyDown(select, { key: "ArrowDown" }); // key still held
      fireEvent.pointerDown(select);
      fireEvent.change(select, { target: { value: "dublin" } });
      expect(onChange).toHaveBeenCalledWith("dublin");
    });

    it("pageshow re-syncs the draft only when persisted", () => {
      const { select } = setup();
      const pageshow = (persisted: boolean) =>
        act(() => {
          const ev = new Event("pageshow");
          Object.defineProperty(ev, "persisted", { value: persisted });
          window.dispatchEvent(ev);
        });
      fireEvent.keyDown(select, { key: "ArrowDown" });
      fireEvent.change(select, { target: { value: "dublin" } });
      fireEvent.keyUp(select, { key: "ArrowDown" });
      pageshow(false);
      expect(select).toHaveValue("dublin");
      pageshow(true);
      expect(select).toHaveValue("trieste");
    });

    it("does not commit when arrowing back to the current value", () => {
      const { onChange, select } = setup();
      fireEvent.keyDown(select, { key: "ArrowDown" });
      fireEvent.change(select, { target: { value: "dublin" } });
      fireEvent.keyUp(select, { key: "ArrowDown" });
      fireEvent.keyDown(select, { key: "ArrowUp" });
      fireEvent.change(select, { target: { value: "trieste" } });
      fireEvent.keyUp(select, { key: "ArrowUp" });
      fireEvent.keyDown(select, { key: "Enter" });
      fireEvent.keyUp(select, { key: "Enter" });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("re-syncs the draft when the value prop changes", () => {
      const { select, rerender } = setup();
      fireEvent.keyDown(select, { key: "ArrowDown" });
      fireEvent.change(select, { target: { value: "dublin" } });
      fireEvent.keyUp(select, { key: "ArrowDown" });
      rerender(<Selector label="City" options={options} value="online" onChange={vi.fn()} />);
      expect(select).toHaveValue("online");
    });
  });
});
