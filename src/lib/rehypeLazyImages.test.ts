import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import rehypeLazyImages from '../lib/rehypeLazyImages';

describe('rehypeLazyImages', () => {
  it('adds loading="lazy" to img tags', async () => {
    const html = '<p><img src="https://example.com/image.jpg" alt="Test" /></p>';
    const processor = unified().use(rehypeParse, { fragment: true }).use(rehypeLazyImages).use(rehypeStringify);
    const result = await processor.process(html);
    expect(String(result)).toContain('loading="lazy"');
  });

  it('adds loading="lazy" to multiple img tags', async () => {
    const html = '<p><img src="https://example.com/first.jpg" alt="First" /></p><p><img src="https://example.com/second.jpg" alt="Second" /></p>';
    const processor = unified().use(rehypeParse, { fragment: true }).use(rehypeLazyImages).use(rehypeStringify);
    const result = await processor.process(html);
    const matches = String(result).match(/loading="lazy"/g);
    expect(matches).toHaveLength(2);
  });

  it('does not add loading="lazy" if already present', async () => {
    const html = '<p><img src="https://example.com/image.jpg" alt="Test" loading="eager" /></p>';
    const processor = unified().use(rehypeParse, { fragment: true }).use(rehypeLazyImages).use(rehypeStringify);
    const result = await processor.process(html);
    expect(String(result)).toContain('loading="eager"');
    expect(String(result)).not.toContain('loading="lazy"');
  });

  it('preserves other img attributes', async () => {
    const html = '<p><img src="https://example.com/image.jpg" alt="Test" class="custom-class" id="my-image" /></p>';
    const processor = unified().use(rehypeParse, { fragment: true }).use(rehypeLazyImages).use(rehypeStringify);
    const result = await processor.process(html);
    const output = String(result);
    expect(output).toContain('loading="lazy"');
    expect(output).toContain('class="custom-class"');
    expect(output).toContain('id="my-image"');
    expect(output).toContain('alt="Test"');
    expect(output).toContain('src="https://example.com/image.jpg"');
  });
});