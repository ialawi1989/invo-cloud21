import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id:       number;
  kind:     ToastKind;
  /** Display text. Can be a translation key or a literal — the
   *  component runs the string through `| translate` either way,
   *  and ngx-translate falls back to the literal when there's no
   *  matching key. */
  message:  string;
  /** Optional secondary line (e.g. error detail). */
  detail?:  string;
  /** ms before auto-dismiss. `0` keeps it open until clicked. */
  timeout:  number;
}

/**
 * Global toast notifications for save success / failure feedback.
 *
 * Forms call `toast.success('SAVED_OK')` (or `.error(...)`) at the
 * end of their save flow; the floating `<app-toast>` mounted in
 * the app root renders them. Toasts stack at the bottom-end of the
 * viewport and auto-dismiss after `timeout` ms.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  /** Live list — the UI subscribes via the signal. */
  items = signal<ToastItem[]>([]);

  /** Monotonic id generator. Used to track auto-dismiss timeouts
   *  without leaking handles when the user dismisses early. */
  private nextId = 1;

  /** Per-toast dismiss timer handles. Keyed by toast id so
   *  `dismiss(id)` can cancel before firing. */
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  /** Default lifetimes by kind. Errors linger longer because the
   *  user may want to copy the message; success toasts go away
   *  on a comfortable 3-second beat so they don't pile up. */
  private defaultTimeouts: Record<ToastKind, number> = {
    success: 3000,
    info:    3500,
    warning: 5000,
    error:   6000,
  };

  success(message: string, detail?: string, timeout?: number): number {
    return this.show('success', message, detail, timeout);
  }
  error(message: string, detail?: string, timeout?: number): number {
    return this.show('error', message, detail, timeout);
  }
  info(message: string, detail?: string, timeout?: number): number {
    return this.show('info', message, detail, timeout);
  }
  warning(message: string, detail?: string, timeout?: number): number {
    return this.show('warning', message, detail, timeout);
  }

  /** Low-level entry point. Returns the toast id so callers can
   *  `dismiss(id)` early (e.g. when the next save kicks off). */
  show(kind: ToastKind, message: string, detail?: string, timeout?: number): number {
    const id = this.nextId++;
    const t = timeout ?? this.defaultTimeouts[kind];
    const item: ToastItem = { id, kind, message, detail, timeout: t };
    this.items.update(list => [...list, item]);
    if (t > 0) {
      this.timers.set(id, setTimeout(() => this.dismiss(id), t));
    }
    return id;
  }

  dismiss(id: number): void {
    const handle = this.timers.get(id);
    if (handle) {
      clearTimeout(handle);
      this.timers.delete(id);
    }
    this.items.update(list => list.filter(t => t.id !== id));
  }

  clear(): void {
    for (const h of this.timers.values()) clearTimeout(h);
    this.timers.clear();
    this.items.set([]);
  }
}
