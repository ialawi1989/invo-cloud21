import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';

import { DashboardScope } from './dashboard.types';

export interface ScopedResource<T> {
  data: Signal<T>;
  loading: Signal<boolean>;
  failed: Signal<boolean>;
  /** Refetch without changing the scope. */
  retry: () => void;
}

/**
 * Binds a widget's data to the page scope, with cancellation built in.
 *
 * Every widget needs the identical lifecycle — refetch on scope change, cancel
 * the previous request, abort on navigate-away, survive an error — so it lives
 * here once rather than being re-typed (and subtly varied) per widget.
 *
 * The three operators are the whole point:
 *
 * - `switchMap` cancels the in-flight request when the scope changes. Without
 *   it the requests race, and a slow response for last month can land after a
 *   fast one for today and overwrite it.
 * - `takeUntilDestroyed` unsubscribes on destroy; HttpClient then aborts the
 *   XHR. This is why the service returns Observables — a Promise can't be
 *   cancelled, so navigating away would leave the request running to completion.
 * - `catchError` → empty keeps the stream alive. A stream that errors is dead,
 *   and a dead stream means the widget never loads again for the whole session.
 *
 * MUST be called from an injection context (field initialiser or constructor).
 */
export function loadOnScope<T>(
  scope: Signal<DashboardScope>,
  load: (s: DashboardScope) => Observable<T>,
  empty: T,
): ScopedResource<T> {
  const destroyRef = inject(DestroyRef);

  const data = signal<T>(empty);
  const loading = signal(true);
  const failed = signal(false);
  const nonce = signal(0);

  toObservable(computed(() => ({ scope: scope(), nonce: nonce() })))
    .pipe(
      tap(() => { loading.set(true); failed.set(false); }),
      switchMap(({ scope: s }) =>
        load(s).pipe(catchError(() => { failed.set(true); return of(empty); })),
      ),
      takeUntilDestroyed(destroyRef),
    )
    .subscribe((value) => {
      data.set(value);
      loading.set(false);
    });

  return {
    data: data.asReadonly(),
    loading: loading.asReadonly(),
    failed: failed.asReadonly(),
    retry: () => nonce.update((n) => n + 1),
  };
}
