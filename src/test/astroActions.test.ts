import { describe, expect, it, vi } from "vitest";
import { mockActions } from "./astroActions";

describe("mockActions", () => {
  it("forwards a call to the action's mock", () => {
    const createBook = vi.fn(() => "created");
    const { actions } = mockActions(() => ({ createBook })) as { actions: { createBook: (...args: unknown[]) => unknown } };
    expect(actions.createBook("x")).toBe("created");
    expect(createBook).toHaveBeenCalledWith("x");
  });

  it("throws on an action the test did not mock", () => {
    const { actions } = mockActions(() => ({})) as { actions: { updateBook: () => unknown } };
    expect(() => actions.updateBook()).toThrow("unmocked action: updateBook");
  });

  it("is not mistaken for a promise", () => {
    const { actions } = mockActions(() => ({})) as { actions: { then?: unknown } };
    expect(actions.then).toBeUndefined();
  });
});
