import type { LabelColor } from '@daiq/domain';

/** Label dot colours: mid-lightness so they read on both themes (non-text UI, ≥ 3:1). */
export const LABEL_COLOR: Record<LabelColor, string> = {
  gray: 'oklch(0.62 0.015 140)',
  red: 'oklch(0.62 0.19 25)',
  orange: 'oklch(0.68 0.16 50)',
  amber: 'oklch(0.75 0.15 80)',
  lime: 'oklch(0.75 0.17 128)',
  green: 'oklch(0.63 0.14 150)',
  teal: 'oklch(0.64 0.11 190)',
  blue: 'oklch(0.6 0.15 250)',
  indigo: 'oklch(0.56 0.17 275)',
  violet: 'oklch(0.6 0.17 300)',
  pink: 'oklch(0.66 0.17 350)',
};
