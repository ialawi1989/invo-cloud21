import { DestroyRef, Signal, inject, signal } from '@angular/core';

/** Phone below this width, tablet from here, desktop from {@link DESKTOP_MIN}. */
export const TABLET_MIN = 640;
export const DESKTOP_MIN = 1024;

/** Window width as a signal (call in an injection context; cleans up with its owner). */
export function injectViewportWidth(): Signal<number> {
  const width = signal(typeof window === 'undefined' ? DESKTOP_MIN : window.innerWidth);
  if (typeof window !== 'undefined') {
    const onResize = () => width.set(window.innerWidth);
    window.addEventListener('resize', onResize, { passive: true });
    inject(DestroyRef).onDestroy(() => window.removeEventListener('resize', onResize));
  }
  return width;
}
