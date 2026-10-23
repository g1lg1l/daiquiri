import { describe, expect, it } from 'vitest';
import { initials } from './avatar';

describe('avatar initials', () => {
  it('uses the first and last words', () => {
    expect(initials('Priya Shah')).toBe('PS');
    expect(initials('ana maria ruiz')).toBe('AR');
  });

  it('skips words that do not start with a letter or digit', () => {
    expect(initials('You (demo)')).toBe('Y');
    expect(initials('— Team Ops')).toBe('TO');
  });

  it('falls back when there is nothing to use', () => {
    expect(initials('  ')).toBe('?');
  });
});
