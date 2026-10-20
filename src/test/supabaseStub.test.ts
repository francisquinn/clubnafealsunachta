import { describe, expect, it } from "vitest";
import { stubFrom, stubQuery } from "./supabaseStub";

describe("stubFrom", () => {
  it("throws on a table the test did not configure", () => {
    const from = stubFrom({ members: () => stubQuery(() => ({ data: [] })) });
    expect(() => from("chapters")).toThrow("unexpected table: chapters");
  });
});

describe("stubQuery", () => {
  it("resolves to result() with the recorded calls", async () => {
    const query = stubQuery((calls) => ({ data: calls.map((call) => call.method) }));
    const res = await (query as { select: () => { eq: () => unknown } }).select().eq();
    expect(res).toEqual({ data: ["select", "eq"] });
  });

  type Method = "select" | "eq" | "update" | "single" | "maybeSingle";
  type Chain = { [M in Method]: (...args: unknown[]) => Chain } & PromiseLike<unknown>;
  const query = (data: unknown) => stubQuery(() => ({ data, error: null })) as Chain;
  const row = { id: "m1" };

  it("returns an array unless the chain ends in .single() or .maybeSingle()", async () => {
    expect(await query(row).select().eq()).toEqual({ data: [row], error: null });
    expect(await query([row]).select().eq().single()).toEqual({ data: row, error: null });
    expect(await query(row).select().eq().maybeSingle()).toEqual({ data: row, error: null });
  });

  it("errors from .single() unless exactly one row matches, like PostgREST", async () => {
    expect(await query([]).select().single()).toMatchObject({ data: null, error: { code: "PGRST116" } });
    expect(await query([row, row]).select().single()).toMatchObject({ data: null, error: { code: "PGRST116" } });
    expect(await query([]).select().maybeSingle()).toEqual({ data: null, error: null });
  });

  it("returns no rows from a write without .select()", async () => {
    expect(await query([row]).update({}).eq()).toEqual({ data: null, error: null });
    expect(await query([row]).update({}).eq().select("id")).toEqual({ data: [row], error: null });
  });

  it("passes errors through untouched", async () => {
    const error = { code: "500" };
    expect(await (stubQuery(() => ({ data: null, error })) as Chain).select().single()).toEqual({ data: null, error });
  });
});
