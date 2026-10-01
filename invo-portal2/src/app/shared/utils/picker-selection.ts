import { computed, signal, Signal } from '@angular/core';

export interface PickerSelectionOptions<T> {
  idOf: (item: T) => string;
  isDisabled?: (item: T) => boolean;
  /** One page of the chunked "fetch every matching id" run. */
  fetchPage: (page: number, limit: number) => Promise<{ list: T[]; count: number }>;
  /** Called once with every item fetched during a chunked select-all run,
   *  e.g. to populate a component-level cache. */
  onItemsFetched?: (items: T[]) => void;
  /** Page size for the chunked fetch. Default 200. */
  chunkSize?: number;
  /** Concurrent in-flight chunk requests. Default 2. */
  concurrency?: number;
}

/**
 * Selection state + the chunked/concurrent/retrying "select all N matching"
 * fetch for a picker modal. Ported from InvoCloudFront2's
 * `core/helpers/picker/picker-selection.ts` (signals instead of plain
 * mutable fields, since this app renders with OnPush everywhere) — UI
 * agnostic, works for any item type via `idOf`/`isDisabled`.
 *
 * The legacy version also supports a "rule" selection mode (every row
 * matching the filter, resolved server-side) for catalogs too large to
 * fetch. It's dropped here: every caller in this app needs concrete rows
 * back to merge into its own in-memory list, and no bulk-by-filter backend
 * endpoint exists for any of them. "Select all matching" always runs the
 * chunked fetch, however large the result set.
 */
export class PickerSelection<T> {
  private readonly idsState = signal<Set<string>>(new Set());
  private readonly selectingAllState = signal(false);

  readonly ids: Signal<Set<string>> = this.idsState.asReadonly();
  readonly selectingAll: Signal<boolean> = this.selectingAllState.asReadonly();
  readonly selectedCount = computed(() => this.idsState().size);

  private readonly idOf: (item: T) => string;
  private readonly isDisabledFn: (item: T) => boolean;
  private readonly fetchPage: (page: number, limit: number) => Promise<{ list: T[]; count: number }>;
  private readonly onItemsFetched?: (items: T[]) => void;
  private readonly chunkSize: number;
  private readonly concurrency: number;
  private version = 0;

  constructor(opts: PickerSelectionOptions<T>) {
    this.idOf = opts.idOf;
    this.isDisabledFn = opts.isDisabled ?? (() => false);
    this.fetchPage = opts.fetchPage;
    this.onItemsFetched = opts.onItemsFetched;
    this.chunkSize = opts.chunkSize ?? 200;
    this.concurrency = opts.concurrency ?? 2;
  }

  /** Seed the selection from a caller-supplied set of already-picked ids
   *  (e.g. ids already in the parent form's list). */
  seed(ids: Iterable<string>): void {
    this.idsState.set(new Set(ids));
  }

  isPicked(item: T): boolean {
    return !this.isDisabledFn(item) && this.isPickedId(this.idOf(item));
  }

  /** Same as `isPicked`, but by id directly — for templates that only have
   *  the row's id on hand (e.g. a track-by loop var). Does not consult
   *  `isDisabled`; callers checking a disabled row should use `isPicked`. */
  isPickedId(id: string): boolean {
    return this.idsState().has(id);
  }

  toggleItem(item: T): void {
    if (this.isDisabledFn(item)) return;
    this.toggleId(this.idOf(item));
  }

  toggleId(id: string): void {
    this.idsState.update((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  unpick(id: string): void {
    this.idsState.update((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  clearSelection(): void {
    this.idsState.set(new Set());
  }

  private selectableOf(loadedItems: T[]): T[] {
    return loadedItems.filter((item) => !this.isDisabledFn(item));
  }

  allLoadedPicked(loadedItems: T[]): boolean {
    const selectable = this.selectableOf(loadedItems);
    return selectable.length > 0 && selectable.every((item) => this.isPicked(item));
  }

  /** Bulk-toggle every currently-loaded, non-disabled item. */
  toggleLoaded(loadedItems: T[]): void {
    const selectable = this.selectableOf(loadedItems);
    const selectAll = !this.allLoadedPicked(loadedItems);
    this.idsState.update((prev) => {
      const next = new Set(prev);
      selectable.forEach((item) => {
        const id = this.idOf(item);
        selectAll ? next.add(id) : next.delete(id);
      });
      return next;
    });
  }

  get pickedIds(): string[] {
    return [...this.idsState()];
  }

  /** Call on any filter/search change. Cancels an in-flight chunked
   *  select-all fetch — its running `selectAllMatching` version check sees
   *  the bump and discards its results instead of overwriting the new
   *  filter's selection. Does NOT clear the current selection; picks made
   *  under a previous filter are still meaningful rows the user chose. */
  reset(): void {
    this.version++;
    this.selectingAllState.set(false);
  }

  cancelSelectAll(): void {
    this.selectingAllState.set(false);
  }

  /** Fetches every id matching the picker's current filter, in concurrent
   *  retrying chunks, then adds them all to the selection. */
  async selectAllMatching(total: number, onFailed?: (err: unknown) => void): Promise<void> {
    if (this.selectingAllState() || !total) return;

    const version = this.version;
    const pages = Math.ceil(total / this.chunkSize);
    this.selectingAllState.set(true);

    const collected: T[] = [];
    let nextPage = 1;
    let failed = false;
    let lastError: unknown;

    const fetchChunkWithRetry = async (page: number): Promise<{ list: T[]; count: number }> => {
      const delays = [500, 1000];
      for (let attempt = 0; ; attempt++) {
        try {
          return await this.fetchPage(page, this.chunkSize);
        } catch (err) {
          if (attempt >= delays.length) throw err;
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
        }
      }
    };

    const worker = async (): Promise<void> => {
      while (!failed && this.selectingAllState() && version === this.version) {
        const page = nextPage++;
        if (page > pages) return;
        try {
          const res = await fetchChunkWithRetry(page);
          if (failed || !this.selectingAllState() || version !== this.version) return;
          collected.push(...res.list);
        } catch (err) {
          failed = true;
          lastError = err;
        }
      }
    };

    await Promise.all(Array.from({ length: this.concurrency }, () => worker()));

    if (version !== this.version || !this.selectingAllState()) {
      this.selectingAllState.set(false);
      return;
    }

    if (failed) {
      this.selectingAllState.set(false);
      onFailed?.(lastError);
      return;
    }

    this.onItemsFetched?.(collected);

    this.idsState.update((prev) => {
      const next = new Set(prev);
      collected.forEach((item) => next.add(this.idOf(item)));
      return next;
    });
    this.selectingAllState.set(false);
  }
}
