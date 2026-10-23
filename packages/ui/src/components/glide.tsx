import { useLayoutEffect, useRef } from 'react';
import { cn } from '../cn';

const ACTIVE = '[data-glide-active], [aria-current="page"], :has(> input:checked)';

/**
 * A pill behind the active item of a group (tabs, segmented controls, a nav)
 * that glides to the next one rubber-band style: the leading edge leaves first
 * and the trailing edge catches up with a little overshoot. Put it as the first
 * child of a `relative isolate` container; it finds the active item itself
 * (`data-glide-active`, `aria-current="page"` or a checked radio inside).
 * `activeKey` is anything that changes when the active item does.
 */
export function GlideThumb({ activeKey, className }: { activeKey: unknown; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef<DOMRect | null>(null);

  // After every render (a new `activeKey` re-renders it): follow the active item if it moved.
  useLayoutEffect(() => place(ref.current, last, true));
  useLayoutEffect(() => {
    const thumb = ref.current;
    const group = thumb?.parentElement;
    if (!thumb || !group) return;
    const observer = new ResizeObserver(() => place(thumb, last, false));
    observer.observe(group);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      aria-hidden
      data-glide={String(activeKey)}
      className={cn(
        'pointer-events-none absolute -z-10 rounded-md bg-surface-emphasis opacity-0',
        className,
      )}
    />
  );
}

function place(thumb: HTMLElement | null, last: { current: DOMRect | null }, animate: boolean) {
  const group = thumb?.parentElement;
  if (!thumb || !group) return;
  const active = group.querySelector<HTMLElement>(ACTIVE);
  const box = active?.getBoundingClientRect();
  if (!box || box.width === 0) {
    thumb.style.opacity = '0';
    last.current = null;
    return;
  }
  const previous = last.current;
  const moved =
    !previous ||
    previous.left !== box.left ||
    previous.top !== box.top ||
    previous.width !== box.width ||
    previous.height !== box.height;
  if (animate && !moved) return;
  const frame = group.getBoundingClientRect();
  const left = box.left - frame.left - group.clientLeft + group.scrollLeft;
  const top = box.top - frame.top - group.clientTop + group.scrollTop;
  if (animate && previous) {
    const forward = box.left > previous.left || box.top > previous.top;
    const [lead, trail] = forward ? ['right', 'left'] : ['left', 'right'];
    const [leadY, trailY] = forward ? ['bottom', 'top'] : ['top', 'bottom'];
    thumb.style.transition = [
      `${lead} 220ms var(--ease-out)`,
      `${leadY} 220ms var(--ease-out)`,
      `${trail} 420ms var(--ease-spring) 60ms`,
      `${trailY} 420ms var(--ease-spring) 60ms`,
      'opacity 150ms',
    ].join(', ');
  } else {
    thumb.style.transition = 'none';
  }
  thumb.style.left = `${left}px`;
  thumb.style.top = `${top}px`;
  thumb.style.right = `${group.scrollWidth - left - box.width}px`;
  thumb.style.bottom = `${group.scrollHeight - top - box.height}px`;
  thumb.style.opacity = '1';
  last.current = box;
}
