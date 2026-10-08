import { describe, it, expect } from "vitest";
import { readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Astro turns every file under src/pages into a route unless the file or one
// of its parent directories starts with "_". A test file without that prefix
// gets bundled into the production build and breaks it (see #165), but
// vitest passes locally and in CI. This guard catches it in `npx vitest run`.
// It must live outside src/pages, or it would be built as a route itself.

const pagesDir = join(dirname(fileURLToPath(import.meta.url)), "pages");

describe("src/pages", () => {
  it("contains no test files without a leading underscore", () => {
    const offenders = readdirSync(pagesDir, { recursive: true })
      .map(String)
      .filter((path) => {
        const segments = path.split(/[\\/]/);
        return /\.(test|spec)\./.test(segments.at(-1) ?? "") && !segments.some((s) => s.startsWith("_"));
      });
    const message = offenders
      .map((f) => `src/pages/${f}: add a leading underscore to the file name so Astro skips it`)
      .join("\n");
    expect(offenders, message).toEqual([]);
  });
});
