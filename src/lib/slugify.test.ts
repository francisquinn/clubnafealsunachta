import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Philosophy Night')).toBe('philosophy-night');
  });

  it('strips accents', () => {
    expect(slugify('Café Résumé')).toBe('cafe-resume');
  });

  it('collapses punctuation and repeated separators into single hyphens', () => {
    expect(slugify("What Is Truth?! (A Discussion)")).toBe('what-is-truth-a-discussion');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Hello World--  ')).toBe('hello-world');
  });

  it('leaves an already-valid slug unchanged', () => {
    expect(slugify('already-a-slug-2')).toBe('already-a-slug-2');
  });
});
