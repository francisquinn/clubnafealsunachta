import { describe, it, expect } from 'vitest';
import { sortBooksByTitle } from './bookOrder';

const book = (id: string, title: string) => ({ id, data: { title } });
const titles = (books: ReturnType<typeof book>[]) => books.map((b) => b.data.title);

describe('sortBooksByTitle', () => {
  it('sorts case-insensitively', () => {
    const sorted = sortBooksByTitle([book('c', 'cat'), book('b', 'Bat'), book('a', 'ant')]);
    expect(titles(sorted)).toEqual(['ant', 'Bat', 'cat']);
  });

  it('ignores a leading the/a/an', () => {
    const sorted = sortBooksByTitle([
      book('1', 'The Power of Now'),
      book('2', 'A New Earth'),
      book('3', 'An Essay'),
      book('4', 'Meditations'),
    ]);
    expect(titles(sorted)).toEqual(['An Essay', 'Meditations', 'A New Earth', 'The Power of Now']);
  });

  it('only strips whole leading words', () => {
    const sorted = sortBooksByTitle([book('1', 'Theory of Colours'), book('2', 'Anna Karenina'), book('3', 'Zen')]);
    expect(titles(sorted)).toEqual(['Anna Karenina', 'Theory of Colours', 'Zen']);
  });

  it('breaks ties by id and does not mutate the input', () => {
    const input = [book('b', 'Same'), book('a', 'Same')];
    expect(sortBooksByTitle(input).map((b) => b.id)).toEqual(['a', 'b']);
    expect(input.map((b) => b.id)).toEqual(['b', 'a']);
  });

  it('keeps a title that is only an article', () => {
    expect(titles(sortBooksByTitle([book('1', 'The'), book('2', 'Aardvark')]))).toEqual(['Aardvark', 'The']);
  });
});
