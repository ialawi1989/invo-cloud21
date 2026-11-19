/**
 * The "deferred total" of a list: the rows render first and the total arrives from a separate count request.
 *
 * Kept out of the component so its rules are unit-testable without Angular:
 *  - a request is identified by a signature (search + filters). Page and sort changes keep the total, a refresh or a
 *    search / filter change fetches a new one;
 *  - a newer request supersedes the older one: the old HTTP call is aborted and, if its answer still arrives, it is
 *    ignored (also when the list state moved on while it was in flight);
 *  - after the first load, a changed signature is debounced, so rapid search / filter edits fire one count;
 *  - a failed request ends in `failed` (never an endless `pending`); the list then paginates with Previous / Next only.
 */
export type CountStatus = 'idle' | 'pending' | 'ready' | 'failed';

export interface CountState {
  status: CountStatus;
  total?: number;
  sig: string;
}

export interface DeferredCountOptions<P> {
  /** Whether the feature is on and a count source exists. */
  enabled: () => boolean;
  /** Fetches the total. Abort `signal` to cancel the HTTP request. */
  fetch: (params: P, signal: AbortSignal) => Promise<number>;
  /** Identity of a request: search + filters only (page and sort do not change the total). */
  signature: (params: P) => string;
  /** Signature of the list's CURRENT state, to drop an answer that arrives after the list moved on. */
  currentSignature: () => string;
  onChange: (state: CountState) => void;
  /** Debounce for a changed signature after the first load. Default 300ms. */
  debounceMs?: number;
}

const isAbort = (e: unknown): boolean => (e as { name?: string } | null)?.name === 'AbortError';

export class DeferredCount<P> {
  private state: CountState = { status: 'idle', sig: '' };
  private req = 0;
  private abort: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly o: DeferredCountOptions<P>) {}

  get current(): CountState { return this.state; }

  /** Requests the total unless the one we have (or are waiting for) is for the same signature. `force` = refresh. */
  load(params: P, force = false): void {
    if (!this.o.enabled()) return;
    const sig = this.o.signature(params);
    const st = this.state;
    if (!force && st.sig === sig && (st.status === 'ready' || st.status === 'pending')) return;

    const debounce = st.status !== 'idle' && st.sig !== sig && (this.o.debounceMs ?? 300) > 0;
    this.cancelInFlight();
    const req = ++this.req;
    this.set({ status: 'pending', sig });

    const run = () => {
      this.timer = null;
      const ac = new AbortController();
      this.abort = ac;
      this.o.fetch(params, ac.signal).then(total => {
        if (req !== this.req || sig !== this.o.currentSignature()) return;   // superseded or the list moved on
        const n = Number(total);
        this.set(Number.isFinite(n) ? { status: 'ready', total: n, sig } : { status: 'failed', sig });
      }).catch(err => {
        if (req !== this.req || isAbort(err)) return;
        console.warn('[list-page] total unavailable, continuing with Previous / Next only', err);
        this.set({ status: 'failed', sig });
      });
    };

    if (debounce) this.timer = setTimeout(run, this.o.debounceMs ?? 300);
    else run();
  }

  dispose(): void { this.cancelInFlight(); this.req++; }

  private cancelInFlight(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.abort?.abort();
    this.abort = null;
  }

  private set(s: CountState): void { this.state = s; this.o.onChange(s); }
}
