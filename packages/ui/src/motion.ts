import type { Transition } from 'motion/react';

/** Motion tokens shared by CSS (styles.css) and Motion for React. Keep in sync. */
export const duration = { fast: 0.12, base: 0.18, slow: 0.24 } as const;

export const ease = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.3, 0, 0, 1.15],
} as const;

export const transitions = {
  base: { duration: duration.base, ease: ease.standard },
  fast: { duration: duration.fast, ease: ease.standard },
  /** Layout moves (list reorder, board card moves). */
  layout: { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 },
} satisfies Record<string, Transition>;
