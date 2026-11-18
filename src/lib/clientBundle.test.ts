// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

// The React components under src/components are Astro islands, so each one is
// bundled for the browser along with everything it imports by value. A single
// import of the server-only Supabase client (which loads dotenv) there makes
// the whole island crash on hydration with "process is not defined", and the
// page still looks fine because it was rendered on the server. That broke
// every event page's calendar menu for two weeks before anyone noticed
// (EventLiveActions importing liveEvent.ts).
//
// This walks each component's relative value imports (`import type` is erased
// by the build, so it doesn't count) and fails if one reaches the server
// Supabase client, a Node-only package, or a file that reads `process.env` /
// `process.cwd` (client code uses `import.meta.env.PUBLIC_*`). Imports are
// matched with a regex, which covers how this repo writes them: static
// `import` and `export ... from` with relative paths. A relative import it
// can't resolve fails the test, so the walk can't pass by skipping a file.

const SRC = resolve(__dirname, "..");
const COMPONENTS = join(SRC, "components");

const FORBIDDEN_FILES = new Set([join(SRC, "lib", "supabase.ts")]);
const FORBIDDEN_PACKAGES = new Set([
  "dotenv",
  "dotenv/config",
  "jsonwebtoken",
  "nodemailer",
  "crypto",
  "fs",
  "path",
  "os",
  "util",
  "child_process",
]);
const SERVER_ONLY_CODE = /\bprocess\.(env|cwd)\b/;

function isForbiddenPackage(spec: string): boolean {
  return spec.startsWith("node:") || FORBIDDEN_PACKAGES.has(spec);
}

const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function resolveRelative(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function valueImports(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specs: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    if (match[1]) continue; // `import type` / `export type`
    specs.push(match[2]);
  }
  return specs;
}

// Returns the import chain from `entry` to the first forbidden module, or null.
function findForbidden(entry: string): string[] | null {
  const seen = new Set<string>();
  const visit = (file: string, chain: string[]): string[] | null => {
    if (seen.has(file)) return null;
    seen.add(file);
    if (SERVER_ONLY_CODE.test(readFileSync(file, "utf8"))) return [...chain, "process.env / process.cwd"];
    for (const spec of valueImports(file)) {
      if (isForbiddenPackage(spec)) return [...chain, spec];
      if (!spec.startsWith(".")) continue;
      const target = resolveRelative(file, spec);
      if (!target) throw new Error(`Cannot resolve "${spec}" imported by ${relative(SRC, file)}`);
      if (FORBIDDEN_FILES.has(target)) return [...chain, relative(SRC, target)];
      if (!/\.(ts|tsx)$/.test(target)) continue;
      const found = visit(target, [...chain, relative(SRC, target)]);
      if (found) return found;
    }
    return null;
  };
  return visit(entry, [relative(SRC, entry)]);
}

const components = walk(COMPONENTS).filter(
  (f) => f.endsWith(".tsx") && !/\.test\.tsx$/.test(f),
);

describe("client bundles stay free of server-only code", () => {
  it("finds the components to check", () => {
    expect(components.length).toBeGreaterThan(10);
  });

  it.each(components.map((f) => [relative(SRC, f), f]))("%s", (_name, file) => {
    const chain = findForbidden(file);
    expect(chain, chain ? `reaches server-only code: ${chain.join(" -> ")}` : undefined).toBeNull();
  });
});
