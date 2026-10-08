// Shared chainable Supabase query stub. Any method chain
// (`.select().eq().single()`, `.upsert()`, `.delete().eq().not()`, ...) is
// accepted and recorded, and awaiting it resolves to whatever `result`
// returns, same as the real supabase-js builder. `result` runs at await time
// and receives the recorded calls, so a test can return fixed rows, shift an
// error off a queue, or branch on what was called (e.g. the `select` fields).
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

// Build a `from(table)` that throws on tables the test didn't configure.
export function stubFrom(tables: Record<string, () => unknown>) {
  return (table: string) => {
    const make = tables[table];
    if (!make) throw new Error(`unexpected table: ${table}`);
    return make();
  };
}
