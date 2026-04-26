import {
  Injectable,
  InjectionToken,
  Provider,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  BranchTabsPreference,
  EmployeeOptionsService,
} from '@core/layout/services/employee-options.service';

/**
 * Reference shape used by the tabs UI. The store holds ids only; consumers
 * (the parent product form) plug in the live directory via `setDirectory()`
 * so the store can resolve ids → display name + status without owning the
 * underlying data source.
 */
export interface BranchTabRef {
  id:       string;
  name:     string;
  isOnline: boolean;
}

const SOFT_CAP = 8;
const RECENT_CAP = 5;
const PERSIST_DEBOUNCE_MS = 300;

/**
 * DI token holding the namespace this service instance writes under inside
 * `EmployeeOptions.branchTabs`. Provided via `provideBranchTabs(namespace)`
 * on the parent component — every call site that mounts the tabs UI passes
 * its own namespace so independent instances don't share state.
 */
export const BRANCH_TABS_NAMESPACE = new InjectionToken<string>('BRANCH_TABS_NAMESPACE');

/**
 * Provider helper. Drop on the host component:
 *   `providers: [provideBranchTabs('productForm.branches')]`
 * Each unique namespace gets its own independently-persisted state.
 */
export function provideBranchTabs(namespace: string): Provider[] {
  return [
    { provide: BRANCH_TABS_NAMESPACE, useValue: namespace },
    BranchTabsService,
  ];
}

/**
 * BranchTabsService
 * ─────────────────
 * Source of truth for the branch-tabs UX:
 *   • `openTabs` — ordered list of currently-open tabs (resolved from ids
 *     against the directory plugged in by the consumer)
 *   • `activeTabId` — currently focused tab
 *   • `pinnedIds` — user-starred branches (persisted)
 *   • `recentIds` — last 5 branches the user touched (session-only)
 *
 * Persistence: open-tab ids, active tab, and pinned ids are written to
 * `EmployeeOptions.branchTabs[namespace]` via `setEmployeeOptions`, so the
 * state survives across devices, not just localStorage. `recentIds` is
 * intentionally session-only — recent-history shouldn't cross-pollute
 * sessions.
 *
 * The store is NOT `providedIn: 'root'`. Each call site provides it via
 * `provideBranchTabs(namespace)` so independent uses (different forms,
 * different pages) get their own state slice.
 */
@Injectable()
export class BranchTabsService {
  private readonly employeeOptions = inject(EmployeeOptionsService);
  private readonly namespace = inject(BRANCH_TABS_NAMESPACE);

  // ── Internal state ──────────────────────────────────────────────
  private readonly directory_ = signal<ReadonlyMap<string, BranchTabRef>>(new Map());
  private readonly openTabIds_ = signal<readonly string[]>([]);
  private readonly activeTabId_ = signal<string | null>(null);
  private readonly pinnedIds_ = signal<ReadonlySet<string>>(new Set());
  private readonly recentIds_ = signal<readonly string[]>([]);

  /** True once we've hydrated from `EmployeeOptionsService` (or the call failed). */
  private readonly hydrated_ = signal(false);
  /** Directory queued before hydration finished — applied once hydration lands. */
  private pendingDirectory: ReadonlyArray<BranchTabRef> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Public read-only signals ────────────────────────────────────
  /** Resolved ordered list of open tabs. Tabs whose branch was deleted are filtered out. */
  readonly openTabs: Signal<BranchTabRef[]> = computed(() => {
    const dir = this.directory_();
    const ids = this.openTabIds_();
    const out: BranchTabRef[] = [];
    for (const id of ids) {
      const hit = dir.get(id);
      if (hit) out.push(hit);
    }
    return out;
  });
  readonly activeTabId: Signal<string | null> = this.activeTabId_.asReadonly();
  readonly pinnedIds:   Signal<ReadonlySet<string>> = this.pinnedIds_.asReadonly();
  readonly recentIds:   Signal<readonly string[]> = this.recentIds_.asReadonly();
  readonly hydrated:    Signal<boolean> = this.hydrated_.asReadonly();

  /** All known branches in the order the directory provided them. */
  readonly directoryList: Signal<BranchTabRef[]> = computed(() =>
    Array.from(this.directory_().values()),
  );

  constructor() {
    void this.hydrate();
  }

  // ── Setup ───────────────────────────────────────────────────────
  /**
   * Plug in (or refresh) the branch directory. Call whenever the underlying
   * branch list changes — e.g. once `BranchConnectionService.load()` settles
   * and again if `availableOnline` flags flip on the form. The store will
   * drop any open-tab ids whose branch is no longer present.
   *
   * If hydration from the backend hasn't finished yet, the directory is
   * queued and re-applied once we know our persisted state — otherwise we'd
   * seed defaults that the backend would then immediately overwrite.
   */
  setDirectory(branches: ReadonlyArray<BranchTabRef>): void {
    if (!this.hydrated_()) {
      this.pendingDirectory = branches;
      return;
    }
    this.applyDirectory(branches);
  }

  // ── Mutations ───────────────────────────────────────────────────
  /** Append the branch if not already open, set it active, push to recents. */
  openBranch(id: string): void {
    if (!id || !this.directory_().has(id)) return;

    const ids = this.openTabIds_().slice();
    if (!ids.includes(id)) {
      ids.push(id);
      // Soft-cap: evict oldest non-pinned non-active tab.
      while (ids.length > SOFT_CAP) {
        const evictIdx = this.findEvictIdx(ids, id);
        if (evictIdx < 0) break;
        ids.splice(evictIdx, 1);
      }
      this.openTabIds_.set(ids);
    }
    this.activeTabId_.set(id);
    this.pushRecent(id);
    this.schedulePersist();
  }

  /** Remove a tab. If it was active, focus right neighbour → left → most-recent. */
  closeTab(id: string): void {
    const ids = this.openTabIds_().slice();
    const idx = ids.indexOf(id);
    if (idx < 0) return;

    ids.splice(idx, 1);
    this.openTabIds_.set(ids);

    if (this.activeTabId_() === id) {
      const next =
        ids[idx]
        ?? ids[idx - 1]
        ?? this.recentIds_().find((r) => ids.includes(r))
        ?? ids[0]
        ?? null;

      if (next) {
        this.activeTabId_.set(next);
      } else {
        const dir = this.directory_();
        const seed = this.recentIds_().find((r) => dir.has(r) && r !== id)
                  ?? Array.from(dir.keys()).find((k) => k !== id)
                  ?? null;
        this.activeTabId_.set(null);
        if (seed) this.openBranch(seed);
        else this.schedulePersist();
        return;
      }
    }
    this.schedulePersist();
  }

  /** Set active and push to recents (no-op if already active). */
  setActive(id: string): void {
    if (!id || this.activeTabId_() === id) return;
    if (!this.openTabIds_().includes(id)) {
      this.openBranch(id);
      return;
    }
    this.activeTabId_.set(id);
    this.pushRecent(id);
    this.schedulePersist();
  }

  /** Toggle pinned state for a branch and persist. */
  togglePin(id: string): void {
    if (!id) return;
    const next = new Set(this.pinnedIds_());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.pinnedIds_.set(next);
    this.schedulePersist();
  }

  isPinned(id: string): boolean {
    return this.pinnedIds_().has(id);
  }

  // ── Hydration / persistence ─────────────────────────────────────
  private async hydrate(): Promise<void> {
    try {
      const opts = await this.employeeOptions.get();
      const slice = opts?.branchTabs?.[this.namespace];
      if (slice) {
        if (Array.isArray(slice.openTabIds)) {
          this.openTabIds_.set(slice.openTabIds.filter((x) => typeof x === 'string'));
        }
        if (typeof slice.activeTabId === 'string') {
          this.activeTabId_.set(slice.activeTabId);
        }
        if (Array.isArray(slice.pinnedIds)) {
          this.pinnedIds_.set(new Set(slice.pinnedIds.filter((x) => typeof x === 'string')));
        }
      }
    } finally {
      this.hydrated_.set(true);
      // Apply any directory the consumer pushed before hydration finished.
      const queued = this.pendingDirectory;
      if (queued) {
        this.pendingDirectory = null;
        this.applyDirectory(queued);
      }
    }
  }

  /**
   * Coalesce rapid state changes (open + setActive + push-recent during a
   * single click) into one backend write. 300ms is short enough that a user
   * navigating away rarely loses an update, long enough to fold cascades.
   */
  private schedulePersist(): void {
    if (!this.hydrated_()) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  }

  private async flushPersist(): Promise<void> {
    const slice: BranchTabsPreference = {
      openTabIds:  [...this.openTabIds_()],
      activeTabId: this.activeTabId_(),
      pinnedIds:   Array.from(this.pinnedIds_()),
    };
    // Read current options first so we preserve sibling namespaces when
    // writing back. EmployeeOptionsService caches the response so this is
    // typically free after the first hit.
    const cur = (await this.employeeOptions.get()) ?? {};
    const branchTabs = { ...(cur.branchTabs ?? {}), [this.namespace]: slice };
    await this.employeeOptions.set({ ...cur, branchTabs });
  }

  // ── Internals ───────────────────────────────────────────────────
  private applyDirectory(branches: ReadonlyArray<BranchTabRef>): void {
    const map = new Map<string, BranchTabRef>();
    for (const b of branches) {
      if (b?.id) map.set(b.id, { ...b });
    }
    this.directory_.set(map);

    // Drop open-tab ids that point at a now-missing branch.
    const ids = this.openTabIds_().filter((id) => map.has(id));
    let mutated = false;
    if (ids.length !== this.openTabIds_().length) {
      this.openTabIds_.set(ids);
      mutated = true;
    }
    const active = this.activeTabId_();
    if (active && !map.has(active)) {
      this.activeTabId_.set(ids[0] ?? null);
      mutated = true;
    }

    // First-load fallback: nothing open yet → open the user's most-recent
    // branch, or fall back to the first directory entry.
    if (ids.length === 0 && map.size > 0) {
      const seed = this.recentIds_().find((id) => map.has(id))
                ?? Array.from(map.keys())[0];
      if (seed) this.openBranch(seed);
    } else if (!this.activeTabId_() && ids.length > 0) {
      this.activeTabId_.set(ids[0]);
      mutated = true;
    }

    if (mutated) this.schedulePersist();
  }

  private pushRecent(id: string): void {
    const cur = this.recentIds_().filter((r) => r !== id);
    cur.unshift(id);
    if (cur.length > RECENT_CAP) cur.length = RECENT_CAP;
    this.recentIds_.set(cur);
  }

  /**
   * Find the oldest non-pinned tab that isn't the just-added id. Returns -1
   * when every remaining tab is pinned (or the new tab itself) — in which
   * case we leave the cap exceeded rather than evicting something the user
   * explicitly starred.
   */
  private findEvictIdx(ids: readonly string[], protectedId: string): number {
    const pinned = this.pinnedIds_();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] !== protectedId && !pinned.has(ids[i])) return i;
    }
    return -1;
  }
}
