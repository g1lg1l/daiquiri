// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * WCAG 2.2 contrast checks for the design tokens in both themes, computed from
 * the OKLCH values in styles.css (OKLCH → OKLab → linear sRGB → luminance).
 */

const css = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8');

function tokens(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  return new Map([...block.matchAll(/--([\w-]+):\s*(oklch\([^)]*\))/g)].map((m) => [m[1]!, m[2]!]));
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

function luminance(oklch: string): number {
  const [l = 0, c = 0, h = 0] = oklch
    .replace(/oklch\(|\)/g, '')
    .trim()
    .split(/\s+/)
    .map(Number);
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = clamp(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc);
  const g = clamp(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc);
  const bl = clamp(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const light = tokens(':root');
const dark = new Map([...light, ...tokens(":root[data-theme='dark']")]);

// [foreground, background, minimum ratio]
const pairs: [string, string, number][] = [
  ['fg', 'surface', 4.5],
  ['fg', 'surface-emphasis', 4.5],
  ['fg-muted', 'surface', 4.5],
  ['fg-muted', 'surface-subtle', 4.5],
  ['fg-muted', 'surface-muted', 4.5],
  ['fg', 'overlay', 4.5],
  ['accent-fg', 'accent', 4.5],
  ['accent-text', 'surface', 4.5],
  ['danger', 'surface', 4.5],
  ['fg-subtle', 'surface', 3],
  ['focus', 'surface', 3],
  ['status-started', 'surface', 2.2],
  ['status-completed', 'surface', 3],
  ['status-unstarted', 'surface', 3],
  ['priority-urgent', 'surface', 3],
];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_name, theme) => {
  it.each(pairs)('%s on %s ≥ %s', (fg, bg, min) => {
    const ratio = contrast(theme.get(fg)!, theme.get(bg)!);
    expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
  });
});
