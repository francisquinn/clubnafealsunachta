// Shared `astro:actions` mocks. `vi.mock` is hoisted above imports, so
// factories must load this file with `await import()` rather than a normal
// import:
//
//   vi.mock("astro:actions", async () => (await import("../../test/astroActions")).mockActions(() => ({ ... })));
//   vi.mock("astro:actions", async () => (await import("../../test/astroActions")).mockActionModule());

// Stand-in for Astro's ActionError, with the same shape the real class
// throws (`code` + `message`).
export class MockActionError extends Error {
  code: string;
  constructor(params: { message?: string; code: string }) {
    super(params.message);
    this.name = "ActionError";
    this.code = params.code;
  }
}

// For handler-level tests: Astro actions don't expose their `handler` in
// tests, so `defineAction` returns the definition as-is (giving the raw
// handler to invoke).
export function mockActionModule() {
  return {
    defineAction: (definition: unknown) => definition,
    ActionError: MockActionError,
  };
}

// For component tests: `actions.<name>(...args)` forwards to the mock
// `getMocks()` returns for that name. `getMocks` is read at call time, so it
// can reference per-file `vi.fn()` consts declared after the hoisted mock.
export function mockActions(getMocks: () => Record<string, (...args: never[]) => unknown>) {
  const actions = new Proxy(
    {},
    {
      get: (_target, name) => {
        // Symbols, `then` and `toJSON` are probed by the runtime (await,
        // spread, serialisation), not called as actions.
        if (typeof name === "symbol" || name === "then" || name === "toJSON") return undefined;
        return (...args: unknown[]) => {
          const mock = getMocks()[name];
          if (!mock) throw new Error(`unmocked action: ${name}`);
          return (mock as (...a: unknown[]) => unknown)(...args);
        };
      },
    },
  );
  return { actions };
}
