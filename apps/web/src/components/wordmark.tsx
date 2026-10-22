import { cn } from '@daiq/ui';
import { useEffect, useState } from 'react';

/** "daiq" is a prefix of "daiquiri": the wordmark compiles the rest in, then decompiles it. */
const SUFFIX = 'uiri';
const GLYPHS = '01{}<>/=+*#';
const STEP_MS = 90;
const SCRAMBLE_MS = 300;
const FRAME_MS = 45;
const FIRST_DELAY_MS = 2_500;
const FULL_HOLD_MS = 3_500;
const SHORT_HOLD_MS = 14_000;

export const COMPILE_MS = (SUFFIX.length - 1) * STEP_MS + SCRAMBLE_MS;

export interface Cell {
  char: string;
  final: boolean;
}

/**
 * The suffix `ms` into a compile (expanding) or decompile. Each letter scrambles
 * through code glyphs for SCRAMBLE_MS; letters start STEP_MS apart, the last one
 * first when decompiling.
 */
export function suffixAt(ms: number, expanding: boolean): Cell[] {
  const frame = Math.floor(ms / FRAME_MS);
  const cells: Cell[] = [];
  for (let i = 0; i < SUFFIX.length; i++) {
    const t = ms - (expanding ? i : SUFFIX.length - 1 - i) * STEP_MS;
    // Later letters start later when compiling and vanish earlier when decompiling.
    if (expanding ? t < 0 : t >= SCRAMBLE_MS) break;
    const scrambling = t >= 0 && t < SCRAMBLE_MS;
    cells.push(
      scrambling
        ? { char: GLYPHS[(frame * 7 + i * 3) % GLYPHS.length] ?? '#', final: false }
        : { char: SUFFIX.charAt(i), final: true },
    );
  }
  return cells;
}

function useCompileCycle(): Cell[] {
  const [cells, setCells] = useState<Cell[]>([]);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = 0;
    let frame = 0;
    const run = (expanding: boolean) => {
      const start = performance.now();
      const tick = (now: number) => {
        const ms = now - start;
        setCells(suffixAt(ms, expanding));
        if (ms < COMPILE_MS) frame = requestAnimationFrame(tick);
        else
          timer = window.setTimeout(
            () => run(!expanding),
            expanding ? FULL_HOLD_MS : SHORT_HOLD_MS,
          );
      };
      frame = requestAnimationFrame(tick);
    };
    timer = window.setTimeout(() => run(true), FIRST_DELAY_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, []);
  return cells;
}

/**
 * The Daiquiri lockup: app icon plus expanded Mona Sans with a lime "drop" over
 * the i. Shows the short name "daiq" and every so often compiles it out to
 * "daiquiri" and back.
 */
export function Wordmark({ className }: { className?: string }) {
  const suffix = useCompileCycle();
  return (
    <span
      className={cn(
        'relative inline-flex items-baseline text-[1.375rem] font-[680] font-display tracking-tight text-fg',
        className,
      )}
    >
      <img
        src={`${import.meta.env.BASE_URL}favicon.svg`}
        alt=""
        className="mr-[0.4em] size-[1.3em] self-center"
      />
      <span className="sr-only">Daiquiri</span>
      <span aria-hidden>da</span>
      <span aria-hidden className="relative">
        ı
        <span className="absolute -top-[0.06em] left-1/2 size-[0.3em] -translate-x-1/2 rounded-full bg-brand-lime ring-[0.06em] ring-surface" />
      </span>
      <span aria-hidden>q</span>
      {suffix.map((cell, index) => (
        <span
          // Positions are stable: index i is always the i-th suffix letter.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          aria-hidden
          className={cell.final ? undefined : 'text-accent-text'}
        >
          {cell.char}
        </span>
      ))}
    </span>
  );
}
