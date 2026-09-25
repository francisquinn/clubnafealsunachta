import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const formCssPath = join(__dirname, "form.css");
const formCss = readFileSync(formCssPath, "utf-8");

describe("form.css mobile textarea styles", () => {
  it("has textarea font-size >= 16px to avoid iOS zoom", () => {
    // The base .cnf-form__input has font-size: 1.125rem (18px at 16px base)
    // This should be present for textarea as well
    expect(formCss).toMatch(/\.cnf-form__input\s*\{[^}]*font-size\s*:\s*1\.125rem/);
  });

  it("ensures textarea is full-width on small screens", () => {
    // Should have width: 100% or similar for textarea on mobile
    // The grid layout should handle this, but let's verify
    expect(formCss).toMatch(/textarea\.cnf-form__input\s*\{[^}]*width\s*:\s*100%/);
  });

  it("has adequate padding/spacing for mobile touch targets", () => {
    // Should have sufficient padding for mobile usability
    expect(formCss).toMatch(/\.cnf-form__input\s*\{[^}]*padding\s*:\s*1rem/);
  });
});
