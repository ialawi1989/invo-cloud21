/**
 * The "on-demand total" of a list (`countMode: 'onDemand'`): NO count request is made until the user asks for it.
 *
 * States, per signature (search + filters + type):
 *   unknown  - nothing requested; the list loaded with `skipCount: true` only;
 *   counting - a count request is in flight;
 *   known    - `total` is available;
 *   failed   - the request failed, answered `success: false` / a non-number, or took longer than `timeoutMs`.
 *
 * Transitions: unknown -> counting on `request()`; counting -> known | failed; failed -> counting on `request()`
 * (Retry); any state -> unknown when the signature changes, unless sticky applies; page / per-page / sort changes
 * keep the state and the total. A refresh resets to unknown (or, with sticky active, counts again).
 *
 * Sticky (`sticky()` true): after the user's first request in this visit, a changed signature counts automatically
 * (debounced, skeleton shown). The "has asked" flag lives in this object only: nothing is persisted.
 *
 * One in-flight request per signature. The answer of a request whose signature is no longer current is ignored
 * (and its HTTP call is aborted when the transport supports it).
 *
 * Kept free of Angular so every rule is unit-testable.
 */
export type OnDemandStatus = 'unknown' | 'counting' | 'known' | 'failed';

export interface OnDemandState {
  status: OnDemandStatus;
  total?: number;
  sig: string;
}

export type CountTrigger = 'click' | 'sticky';

export interface OnDemandOptions<P> {
  /** Fetches the total. Abort `signal` to cancel the HTTP request (best effort). */
  fetch: (params: P, signal: AbortSignal) => Promise<number>;
  /** Identity of a request: search + filters + type only (page, per-page and sort do not change the total). */
  signature: (params: P) => string;
  /** Signature of the list's CURRENT state, to drop an answer that arrives after the list moved on. */
  currentSignature: () => string;
  onChange: (state: OnDemandState) => void;
  /** `countStickyPerVisit`. */
  sticky: () => boolean;
  timeoutMs?: number;
  /** Debounce of an automatic (sticky) request. Default 300ms. */
  debounceMs?: number;
  /** One call per finished request, for measurement. */
  onMetric?: (m: { ms: number; ok: boolean; trigger: CountTrigger; reason?: 'error' | 'timeout' }) => void;
  now?: () => number;
}

const isAbort = (e: unknown): boolean => (e as { name?: string } | null)?.name === 'AbortError';

export class OnDemandCount<P> {
  private state: OnDemandState = { status: 'unknown', sig: '' };
  private req = 0;
  private abort: AbortController | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  /** The user has asked for a count during this visit (sticky mode). */
  private asked = false;

  constructor(private readonly o: OnDemandOptions<P>) {}

  get current(): OnDemandState { return this.state; }
  get hasAsked(): boolean { return this.asked; }

  /**
   * Called after every list load with the list's params. Decides whether the state is kept, reset or (sticky) refreshed.
   * `refresh` = the user pressed Refresh.
   */
  observe(params: P, refresh = false): void {
    const sig = this.o.signature(params);
    const st = this.state;
    const sigChanged = st.sig !== '' && st.sig !== sig;

    if (st.sig === '' && st.status === 'unknown') {
      // First load of the visit: nothing was asked yet.
      this.state = { status: 'unknown', sig };
      this.o.onChange(this.state);
      return;
    }

    if (!sigChanged && !refresh) return;   // page / per-page / sort: keep the state and the total

    if (this.o.sticky() && this.asked) {
      // Automatic request for the new signature (or the refreshed one), with the skeleton shown at once.
      this.start(params, sig, 'sticky', sigChanged && !refresh ? (this.o.debounceMs ?? 300) : 0);
      return;
    }
    this.cancel();
    this.set({ status: 'unknown', sig });
  }

  /** User click on "Count" / "Show total" / "Retry". A second click while counting does nothing. */
  request(params: P): void {
    const sig = this.o.signature(params);
    const st = this.state;
    if (st.status === 'counting' && st.sig === sig) return;
    if (st.status === 'known' && st.sig === sig) return;
    if (this.o.sticky()) this.asked = true;
    this.start(params, sig, 'click', 0);
  }

  dispose(): void { this.cancel(); this.req++; }

  private start(params: P, sig: string, trigger: CountTrigger, delay: number): void {
    this.cancel();
    const id = ++this.req;
    this.set({ status: 'counting', sig });

    const run = () => {
      this.debounceTimer = null;
      const ac = new AbortController();
      this.abort = ac;
      const now = this.o.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
      const t0 = now();
      const finish = (next: OnDemandState, ok: boolean, reason?: 'error' | 'timeout') => {
        this.clearTimeout();
        this.o.onMetric?.({ ms: now() - t0, ok, trigger, reason });
        this.set(next);
      };

      this.timeoutTimer = setTimeout(() => {
        if (id !== this.req) return;
        this.abort?.abort();
        this.req++;   // a late answer must not overturn "failed"
        finish({ status: 'failed', sig }, false, 'timeout');
      }, this.o.timeoutMs ?? 30_000);

      this.o.fetch(params, ac.signal).then(total => {
        if (id !== this.req || sig !== this.o.currentSignature()) return;   // superseded or the list moved on
        const n = Number(total);
        if (Number.isFinite(n)) finish({ status: 'known', total: n, sig }, true);
        else finish({ status: 'failed', sig }, false, 'error');
      }).catch(err => {
        if (id !== this.req || isAbort(err)) return;
        console.warn('[list-page] on-demand total failed', err);
        finish({ status: 'failed', sig }, false, 'error');
      });
    };

    if (delay > 0) this.debounceTimer = setTimeout(run, delay);
    else run();
  }

  private cancel(): void {
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
    this.clearTimeout();
    this.abort?.abort();
    this.abort = null;
    this.req++;   // anything still in flight is now stale
  }

  private clearTimeout(): void {
    if (this.timeoutTimer) { clearTimeout(this.timeoutTimer); this.timeoutTimer = null; }
  }

  private set(s: OnDemandState): void { this.state = s; this.o.onChange(s); }
}
