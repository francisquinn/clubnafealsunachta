// Shared chainable Supabase query stub. Any method chain
// (`.select().eq().single()`, `.upsert()`, `.delete().eq().not()`, ...) is
// accepted and recorded, and awaiting it resolves to what `result` returns,
// shaped the way supabase-js shapes it (see `shapeResult`). `result` runs at
// await time and receives the recorded calls, so a test can return fixed rows,
// shift an error off a queue, or branch on what was called (e.g. the `select`
// fields).
//
//   supabaseAdmin: { from: stubFrom({ members: () => stubQuery(() => ({ data: row, error: null })) }) }
//
// Like `vi.mock`, factories using this must `await import()` it (see
// astroActions.ts), or build the stub lazily inside `from`.

export type QueryCall = { method: string; args: unknown[] };
export type QueryResult = { data?: unknown; error?: unknown };

export function stubQuery(result: (calls: QueryCall[]) => QueryResult | Promise<QueryResult>) {
  const calls: QueryCall[] = [];
  const chain: unknown = new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        if (prop === "then") {
          return (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve()
              .then(() => result(calls))
              .then((res) => shapeResult(res, calls))
              .then(resolve, reject);
        }
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return chain;
        };
      },
    },
  );
  return chain;
}

const WRITE_METHODS = ["insert", "update", "upsert", "delete"];

// supabase-js only returns one row when the chain ends in `.single()` or
// `.maybeSingle()`, returns an array otherwise, and returns no rows from a
// write without `.select()`. Shaping `result`'s data the same way means a test
// fails if the code under test drops one of those calls, instead of the stub
// handing back whatever shape the test happened to return.
function shapeResult(res: QueryResult, calls: QueryCall[]): QueryResult {
  if (res.error || res.data === undefined || res.data === null) return res;
  const called = (method: string) => calls.some((call) => call.method === method);
  const rows = Array.isArray(res.data) ? res.data : [res.data];

  if (WRITE_METHODS.some(called) && !called("select")) return { ...res, data: null };
  if (called("single") || called("maybeSingle")) {
    if (rows.length === 1) return { ...res, data: rows[0] };
    if (rows.length === 0 && called("maybeSingle")) return { ...res, data: null };
    return { data: null, error: { code: "PGRST116", message: `expected one row, got ${rows.length}` } };
  }
  return { ...res, data: rows };
}

// Build a `from(table)` that throws on tables the test didn't configure.
export function stubFrom(tables: Record<string, () => unknown>) {
  return (table: string) => {
    const make = tables[table];
    if (!make) throw new Error(`unexpected table: ${table}`);
    return make();
  };
}
