import { gsap } from 'gsap';

/** Shared motion vocabulary so components stay consistent and tidy. */
export const EASE = 'power3.out';
export const DUR = { fast: 0.4, base: 0.55, slow: 0.9 } as const;

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Count a number up from 0 → `to`, writing the formatted result into `el` on each frame.
 * The underlying value is never touched — this only animates the *display*. Values beyond
 * the safe-integer range (or non-finite) skip the tween and render the final value, since
 * the real amounts are big-int base-unit strings.
 */
export function countUp(
  el: HTMLElement,
  to: number,
  opts: { duration?: number; ease?: string; format?: (n: number) => string } = {},
): gsap.core.Tween | undefined {
  const { duration = DUR.slow, ease = 'power2.out', format = (n) => String(Math.round(n)) } = opts;

  if (!Number.isFinite(to) || to > Number.MAX_SAFE_INTEGER) {
    el.textContent = format(to);
    return undefined;
  }

  const counter = { v: 0 };
  el.textContent = format(0);
  return gsap.to(counter, {
    v: to,
    duration,
    ease,
    onUpdate: () => {
      el.textContent = format(counter.v);
    },
  });
}
