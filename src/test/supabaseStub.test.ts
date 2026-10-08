import { describe, expect, it } from "vitest";
import { stubFrom, stubQuery } from "./supabaseStub";

describe("stubFrom", () => {
  it("throws on a table the test did not configure", () => {
    const from = stubFrom({ members: () => stubQuery(() => ({ data: [] })) });
    expect(() => from("clubs")).toThrow("unexpected table: clubs");
  });
});

describe("stubQuery", () => {
  it("resolves to result() with the recorded calls", async () => {
    const query = stubQuery((calls) => ({ data: calls.map((call) => call.method) }));
    const res = await (query as { select: () => { eq: () => unknown } }).select().eq();
    expect(res).toEqual({ data: ["select", "eq"] });
  });
});
