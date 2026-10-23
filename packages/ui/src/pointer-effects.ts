/*
 * Two pointer effects for the whole app, from one pair of listeners:
 * - sparks: a short burst of lines where something interactive is pressed;
 * - spotlight: `.spotlight` cards get the pointer position as --spot-x/--spot-y.
 * Both stand down under prefers-reduced-motion. Returns the uninstall function.
 */

const INTERACTIVE =
  'button, a[href], summary, label, input[type="checkbox"], input[type="radio"], [role="button"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="radio"], [role="tab"], [role="switch"]';
const SPARKS = 8;
const DURATION = 380;
const RADIUS = 16;
const LENGTH = 9;

interface Burst {
  x: number;
  y: number;
  start: number;
  color: string;
}

export function installPointerEffects(): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const bursts: Burst[] = [];
  let canvas: HTMLCanvasElement | null = null;
  let frame = 0;

  const draw = (now: number) => {
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = bursts.length - 1; i >= 0; i--) {
      const burst = bursts[i]!;
      const p = (now - burst.start) / DURATION;
      if (p >= 1) {
        bursts.splice(i, 1);
        continue;
      }
      const travel = 1 - (1 - p) ** 3;
      context.strokeStyle = burst.color;
      context.globalAlpha = 1 - Math.max(0, (p - 0.5) / 0.5) ** 2;
      context.lineWidth = 1.6;
      context.lineCap = 'round';
      context.beginPath();
      for (let s = 0; s < SPARKS; s++) {
        const angle = (s / SPARKS) * Math.PI * 2 + Math.PI / SPARKS;
        const from = RADIUS * travel * 0.55;
        const to = from + LENGTH * (1 - p) ** 1.6;
        context.moveTo(burst.x + Math.cos(angle) * from, burst.y + Math.sin(angle) * from);
        context.lineTo(burst.x + Math.cos(angle) * to, burst.y + Math.sin(angle) * to);
      }
      context.stroke();
    }
    frame = bursts.length ? requestAnimationFrame(draw) : 0;
  };

  const ensureCanvas = () => {
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
    document.body.append(canvas);
    return canvas;
  };

  const resize = () => {
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * ratio;
    canvas.height = window.innerHeight * ratio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (reduced.matches || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target.closest(INTERACTIVE) : null;
    if (!target || target.closest('[aria-disabled="true"], :disabled')) return;
    if (!canvas) {
      ensureCanvas();
      resize();
    }
    const color = getComputedStyle(document.documentElement).getPropertyValue('--spark').trim();
    bursts.push({ x: event.clientX, y: event.clientY, start: performance.now(), color });
    if (!frame) frame = requestAnimationFrame(draw);
  };

  let lit: HTMLElement | null = null;
  const onPointerMove = (event: PointerEvent) => {
    if (reduced.matches || event.pointerType !== 'mouse') return;
    const card =
      event.target instanceof Element ? event.target.closest<HTMLElement>('.spotlight') : null;
    if (lit && lit !== card) {
      lit.style.removeProperty('--spot-x');
      lit.style.removeProperty('--spot-y');
    }
    lit = card;
    if (!card) return;
    const box = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', `${event.clientX - box.left}px`);
    card.style.setProperty('--spot-y', `${event.clientY - box.top}px`);
  };

  document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  document.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('resize', resize);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, { capture: true });
    document.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('resize', resize);
    cancelAnimationFrame(frame);
    canvas?.remove();
  };
}
