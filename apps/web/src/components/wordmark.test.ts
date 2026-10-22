import { describe, expect, it } from 'vitest';
import { COMPILE_MS, suffixAt } from './wordmark';

const text = (ms: number, expanding: boolean) =>
  suffixAt(ms, expanding)
    .map((cell) => (cell.final ? cell.char : '_'))
    .join('');

describe('daiq ↔ daiquiri compile animation', () => {
  it('compiles the suffix in, one scrambling letter at a time', () => {
    expect(text(-1, true)).toBe('');
    expect(text(0, true)).toBe('_');
    expect(text(100, true)).toBe('__');
    expect(text(COMPILE_MS, true)).toBe('uiri');
  });

  it('decompiles from the last letter back to "daiq"', () => {
    expect(text(0, false)).toBe('uir_');
    expect(text(COMPILE_MS - 1, false)).toBe('_');
    expect(text(COMPILE_MS, false)).toBe('');
  });

  it('only ever shows a prefix of the suffix', () => {
    for (let ms = 0; ms <= COMPILE_MS; ms += 15) {
      for (const expanding of [true, false]) {
        const finals = suffixAt(ms, expanding).filter((cell) => cell.final);
        expect('uiri'.startsWith(finals.map((cell) => cell.char).join(''))).toBe(true);
      }
    }
  });
});
