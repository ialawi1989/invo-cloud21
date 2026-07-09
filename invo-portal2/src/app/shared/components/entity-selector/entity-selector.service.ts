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
  EntitySelectorPreference,
  EmployeeOptionsService,
} from '@core/layout/services/employee-options.service';

/**
 * Reference shape used by the selector UI. The store holds ids only; consumers
 * plug in the live directory via `setDirectory()` so the store can resolve
 * ids → label + status without owning the underlying data source.
 */
export interface EntityRef {
  id:       string;
  /** Display label. */
  label:    string;
  /** Opaque status token — the renderer (via a projected template) decides
   *  how to show it, if at all. */
  status?:  string | null;
  /** Optional grouping label for sidebar mode (e.g. "Stores", "Trucks"). */
  group?:   string;
  /** Rendered but not selectable. */
  disabled?: boolean;
}

const SOFT_CAP = 8;
const RECENT_CAP = 5;
const PERSIST_DEBOUNCE_MS = 300;

/**
 * DI token holding the namespace this service instance writes under inside
 * `EmployeeOptions.entitySelector`. Provided via `provideEntitySelector(namespace)`
 * on the host component — every call site that mounts the selector passes its
 * own namespace so independent instances don't share state.
 */
export const ENTITY_SELECTOR_NAMESPACE = new InjectionToken<string>('ENTITY_SELECTOR_NAMESPACE');

/**
 * Provider helper. Drop on the host component:
 *   `providers: [provideEntitySelector('productForm.items')]`
 * Each unique namespace gets its own independently-persisted state.
 */
export function provideEntitySelector(namespace: string): Provider[] {
  return [
    { provide: ENTITY_SELECTOR_NAMESPACE, useValue: namespace },
    EntitySelectorService,
  ];
}

/**
 * EntitySelectorService
 * ─────────────────────
 * Source of truth for the entity-selector UX:
 *   • `openTabs` — ordered list of currently-open tabs (resolved from ids
 *     against the directory plugged in by the consumer)
 *   • `activeTabId` — currently focused item
 *   • `pinnedIds` — user-starred items (persisted)
 *   • `recentIds` — last 5 items the user touched (session-only)
 *   • `collapsedGroups` — collapsed sidebar groups (persisted)
 *
 * Persistence: open-tab ids, active id, pinned ids and collapsed groups are
 * written to `EmployeeOptions.entitySelector[namespace]`, so the state survives
 * across devices, not just localStorage. `recentIds` is intentionally
 * session-only — recent-history shouldn't cross-pollute sessions.
 *
 * The store is NOT `providedIn: 'root'`. Each call site provides it via
 * `provideEntitySelector(namespace)` so independent uses get their own slice.
 */
@Injectable()
export class EntitySelectorService {
  private readonly employeeOptions = inject(EmployeeOptionsService);
  private readonly namespace = inject(ENTITY_SELECTOR_NAMESPACE);

  // ── Internal state ──────────────────────────────────────────────
  private readonly directory_ = signal<ReadonlyMap<string, EntityRef>>(new Map());
  private readonly openTabIds_ = signal<readonly string[]>([]);
  private readonly activeTabId_ = signal<string | null>(null);
  private readonly pinnedIds_ = signal<ReadonlySet<string>>(new Set());
  private readonly recentIds_ = signal<readonly string[]>([]);
  private readonly collapsedGroups_ = signal<ReadonlySet<string>>(new Set());

  /** True once we've hydrated from `EmployeeOptionsService` (or the call failed). */
  private readonly hydrated_ = signal(false);
  /** Directory queued before hydration finished — applied once hydration lands. */
  private pendingDirectory: ReadonlyArray<EntityRef> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Public read-only signals ────────────────────────────────────
  /** Resolved ordered list of open tabs. Tabs whose item was deleted are filtered out. */
  readonly openTabs: Signal<EntityRef[]> = computed(() => {
    const dir = this.directory_();
    const ids = this.openTabIds_();
    const out: EntityRef[] = [];
    for (const id of ids) {
      const hit = dir.get(id);
      if (hit) out.push(hit);
    }
    return out;
  });
  readonly activeTabId: Signal<string | null> = this.activeTabId_.asReadonly();
  readonly pinnedIds:   Signal<ReadonlySet<string>> = this.pinnedIds_.asReadonly();
  readonly recentIds:   Signal<readonly string[]> = this.recentIds_.asReadonly();
  readonly collapsedGroups: Signal<ReadonlySet<string>> = this.collapsedGroups_.asReadonly();
  readonly hydrated:    Signal<boolean> = this.hydrated_.asReadonly();

  /** All known items in the order the directory provided them. */
  readonly directoryList: Signal<EntityRef[]> = computed(() =>
    Array.from(this.directory_().values()),
  );

  constructor() {
    void this.hydrate();
  }

  // ── Setup ───────────────────────────────────────────────────────
  /**
   * Plug in (or refresh) the item directory. Call whenever the underlying list
   * changes. The store drops any open-tab ids whose item is no longer present.
   *
   * If hydration hasn't finished yet, the directory is queued and re-applied
   * once we know our persisted state — otherwise we'd seed defaults that the
   * backend would then immediately overwrite.
   */
  setDirectory(items: ReadonlyArray<EntityRef>): void {
    if (!this.hydrated_()) {
      this.pendingDirectory = items;
      return;
    }
    this.applyDirectory(items);
  }

  // ── Mutations ───────────────────────────────────────────────────
  /** Append the item if not already open, set it active, push to recents. */
  open(id: string): void {
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

  /** Remove a tab. If it was active, focus right neighbour → left → most-recent.
   *  Keeps at least one item open — closing the last remaining tab is a no-op
   *  (a form section must always have an active item to bind to). */
  closeTab(id: string): void {
    const ids = this.openTabIds_().slice();
    const idx = ids.indexOf(id);
    if (idx < 0) return;
    if (ids.length <= 1) return;

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
        if (seed) this.open(seed);
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
      this.open(id);
      return;
    }
    this.activeTabId_.set(id);
    this.pushRecent(id);
    this.schedulePersist();
  }

  /** Toggle pinned state for an item and persist. */
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

  /** Toggle a sidebar group's collapsed state and persist. */
  toggleGroup(group: string): void {
    if (!group) return;
    const next = new Set(this.collapsedGroups_());
    if (next.has(group)) next.delete(group);
    else next.add(group);
    this.collapsedGroups_.set(next);
    this.schedulePersist();
  }

  isGroupCollapsed(group: string): boolean {
    return this.collapsedGroups_().has(group);
  }

  // ── Hydration / persistence ─────────────────────────────────────
  private async hydrate(): Promise<void> {
    try {
      const opts = await this.employeeOptions.get();
      const slice = opts?.entitySelector?.[this.namespace];
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
        if (Array.isArray(slice.collapsedGroups)) {
          this.collapsedGroups_.set(new Set(slice.collapsedGroups.filter((x) => typeof x === 'string')));
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
    const slice: EntitySelectorPreference = {
      openTabIds:  [...this.openTabIds_()],
      activeTabId: this.activeTabId_(),
      pinnedIds:   Array.from(this.pinnedIds_()),
      collapsedGroups: Array.from(this.collapsedGroups_()),
    };
    // Read current options first so we preserve sibling namespaces when
    // writing back. EmployeeOptionsService caches the response so this is
    // typically free after the first hit.
    const cur = (await this.employeeOptions.get()) ?? {};
    const entitySelector = { ...(cur.entitySelector ?? {}), [this.namespace]: slice };
    await this.employeeOptions.set({ ...cur, entitySelector });
  }

  // ── Internals ───────────────────────────────────────────────────
  private applyDirectory(items: ReadonlyArray<EntityRef>): void {
    const map = new Map<string, EntityRef>();
    for (const b of items) {
      if (b?.id) map.set(b.id, { ...b });
    }
    this.directory_.set(map);

    // Drop open-tab ids that point at a now-missing item.
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

    // First-load fallback: nothing open yet → open the user's most-recent item,
    // or fall back to the first directory entry.
    if (ids.length === 0 && map.size > 0) {
      const seed = this.recentIds_().find((id) => map.has(id))
                ?? Array.from(map.keys())[0];
      if (seed) this.open(seed);
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
   * when every remaining tab is pinned (or the new tab itself) — in which case
   * we leave the cap exceeded rather than evicting something the user starred.
   */
  private findEvictIdx(ids: readonly string[], protectedId: string): number {
    const pinned = this.pinnedIds_();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] !== protectedId && !pinned.has(ids[i])) return i;
    }
    return -1;
  }
}
