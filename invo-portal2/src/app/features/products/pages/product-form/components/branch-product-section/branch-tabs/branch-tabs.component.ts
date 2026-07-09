import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  isDevMode,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';
import { TranslateModule } from '@ngx-translate/core';

import { FindBranchPopoverComponent } from '../find-branch-popover/find-branch-popover.component';
import { BranchStatusIconComponent } from './branch-status-icon.component';
import { BranchTabRef, BranchTabsService } from './branch-tabs.service';
import {
  BranchCompletion,
  BranchTabsMode,
  CompletionMap,
  matchesQuery,
  progressCounts,
  resolveBranchMode,
} from './branch-tabs.util';

export type { BranchTabsMode, BranchCompletion, CompletionMap } from './branch-tabs.util';

const VISIBLE_TABS = 5;

/**
 * branch-tabs
 * ───────────
 * Horizontal tab strip for the branch selector — replaces the previous
 * dropdown picker. Up to 5 tabs render side-by-side; everything beyond
 * that lives behind the right-side "Find branch" trigger which opens a
 * searchable popover (pinned + recent + all sections).
 *
 * Selection state is owned by `BranchTabsService` so it survives across
 * navigations and (selectively) page reloads. The parent passes the live
 * branch directory via `[branches]` and reacts to `(activeChange)` to
 * sync its own per-branch FormGroup focus.
 */
@Component({
  selector: 'app-pf-branch-tabs',
  standalone: true,
  imports: [CommonModule, OverlayModule, TranslateModule, FindBranchPopoverComponent, BranchStatusIconComponent],
  templateUrl: './branch-tabs.component.html',
  styleUrl: './branch-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchTabsComponent {
  private store = inject(BranchTabsService);

  /** Live branch directory pushed from the parent. */
  branches = input.required<ReadonlyArray<BranchTabRef>>();

  /** Emits whenever the active branch changes — parent uses it to swap FormGroups. */
  activeChange = output<string>();

  /** Show the bulk-action affordances (Apply to all / Copy from branch…). */
  showBulkActions = input<boolean>(false);

  /** Host implements "fill once, apply everywhere". */
  applyToAll = output<void>();
  /** Emits the picked source branch id (pick-once; active branch unchanged). */
  copyFrom = output<string>();

  /** Copy-from popover open state (separate overlay, pick-once mode). */
  copyOpen = signal<boolean>(false);
  onCopyPicked(id: string): void {
    this.copyFrom.emit(id);
    this.copyOpen.set(false);
  }

  /** Whether tabs show a close (×) button. Off for pure selectors
   *  (e.g. ZATCA branch registration) where tabs aren't dismissible. */
  closable = input<boolean>(true);

  /** Max tabs rendered inline before the rest fold behind "Find branch".
   *  Defaults to 5 (product form). */
  maxVisible = input<number>(VISIBLE_TABS);

  /**
   * Display mode:
   *   • `'tabs'`     — horizontal tab strip (default; product form)
   *   • `'dropdown'` — single-select showing the active branch (matrix form)
   *   • `'sidebar'`  — vertical master–detail list (fleets, 15+ branches)
   */
  mode = input<BranchTabsMode | undefined>(undefined);

  /**
   * @deprecated Use `[mode]="'dropdown'"`. Kept as an alias: when set and
   * `mode` is not provided, `true` maps to `'dropdown'`.
   */
  dropdown = input<boolean>(false);

  /** Effective mode after applying the `dropdown` deprecation alias. */
  resolvedMode = computed<BranchTabsMode>(() =>
    resolveBranchMode(this.mode(), this.dropdown()),
  );
  isTabs     = computed<boolean>(() => this.resolvedMode() === 'tabs');
  isDropdown = computed<boolean>(() => this.resolvedMode() === 'dropdown');
  isSidebar  = computed<boolean>(() => this.resolvedMode() === 'sidebar');

  /** Per-branch fill state from the host form. `null` = indicator off. */
  completion = input<CompletionMap | null>(null);

  /** Completion status for one branch (`'empty'` when unknown / off). */
  completionOf(id: string): BranchCompletion {
    return this.completion()?.[id] ?? 'empty';
  }

  /** Sidebar footer counts — done / total over the live directory. */
  progress = computed(() =>
    progressCounts(this.completion(), this.branches().map((b) => b.id)),
  );

  /** Whether to render the sidebar progress footer. Sidebar mode only. */
  showProgress = input<boolean>(true);

  // ── Sidebar mode ─────────────────────────────────────────────────
  @ViewChild('sbSearchInput') sidebarSearchEl?: ElementRef<HTMLInputElement>;
  sidebarSearch = signal<string>('');
  onSidebarSearch(v: string): void { this.sidebarSearch.set(v); }

  private sbFilter(list: BranchTabRef[]): BranchTabRef[] {
    const q = this.sidebarSearch();
    return list.filter((b) => matchesQuery(b.name, q));
  }

  /** Starred branches, filtered by the sidebar search. */
  sbPinned = computed<BranchTabRef[]>(() => {
    const pins = this.store.pinnedIds();
    return this.sbFilter(this.branches().filter((b) => pins.has(b.id)));
  });

  /** Non-pinned branches, filtered. */
  private sbRest = computed<BranchTabRef[]>(() => {
    const pins = this.store.pinnedIds();
    return this.sbFilter(this.branches().filter((b) => !pins.has(b.id)));
  });

  /** True when at least one branch declares a `group` → render group headers. */
  hasGroups = computed<boolean>(() => this.branches().some((b) => !!b.group?.trim()));

  /** Flat, alphabetically-sorted non-pinned list (ungrouped rendering). */
  sbFlat = computed<BranchTabRef[]>(() =>
    [...this.sbRest()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  /** Grouped non-pinned list: named groups A→Z, ungrouped ('') last. */
  sbGroups = computed<{ group: string; branches: BranchTabRef[] }[]>(() => {
    const map = new Map<string, BranchTabRef[]>();
    for (const b of this.sbRest()) {
      const g = b.group?.trim() || '';
      const bucket = map.get(g) ?? (map.set(g, []), map.get(g)!);
      bucket.push(b);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
      .map(([group, branches]) => ({
        group,
        branches: branches.sort((x, y) => x.name.localeCompare(y.name)),
      }));
  });

  sbHasAnyMatch = computed<boolean>(() => this.sbPinned().length + this.sbRest().length > 0);

  // Pin + group-collapse pass-throughs for the sidebar template.
  isPinned(id: string): boolean { return this.store.isPinned(id); }
  togglePin(ev: Event, id: string): void { ev.stopPropagation(); this.store.togglePin(id); }
  isGroupCollapsed(g: string): boolean { return this.store.isGroupCollapsed(g); }
  toggleGroup(g: string): void { this.store.toggleGroup(g); }

  /** Optional narrower cap applied on small viewports (< 640px). Null
   *  keeps `maxVisible` at all sizes. */
  maxVisibleMobile = input<number | null>(null);

  popoverOpen = signal<boolean>(false);
  private narrow = signal<boolean>(
    typeof window !== 'undefined' && window.innerWidth < 640,
  );

  @HostListener('window:resize')
  onResize(): void {
    if (typeof window !== 'undefined') this.narrow.set(window.innerWidth < 640);
  }

  @ViewChild('findTrigger') findTrigger?: ElementRef<HTMLButtonElement>;

  private warnedDropdown = false;

  constructor() {
    // One-time dev warning when the deprecated `dropdown` alias is used.
    effect(() => {
      if (isDevMode() && this.dropdown() && this.mode() == null && !this.warnedDropdown) {
        this.warnedDropdown = true;
        console.warn(
          '[app-pf-branch-tabs] `dropdown` is deprecated — use `mode="dropdown"` instead.',
        );
      }
    });

    // Push the directory into the store whenever the input changes. The
    // store handles eviction of stale ids and first-load seeding internally.
    effect(() => {
      const list = this.branches();
      this.store.setDirectory(list ?? []);
    });

    // Bridge: emit the active id every time it changes so the parent can
    // swap its active FormGroup. Skipping null avoids spurious emissions
    // during the brief window between directory replace + reseed.
    effect(() => {
      const id = this.store.activeTabId();
      if (id) this.activeChange.emit(id);
    });
  }

  // ── Derived state ────────────────────────────────────────────────
  openTabs = this.store.openTabs;
  activeId = this.store.activeTabId;

  /** Effective inline cap — honours the mobile override on narrow screens. */
  private effectiveMax = computed<number>(() => {
    const m = this.narrow() && this.maxVisibleMobile() != null
      ? (this.maxVisibleMobile() as number)
      : this.maxVisible();
    return Math.max(1, m);
  });

  visibleTabs = computed<BranchTabRef[]>(() => this.openTabs().slice(0, this.effectiveMax()));
  hiddenCount = computed<number>(() => Math.max(0, this.branches().length - this.visibleTabs().length));

  /** The currently-active branch — drives the dropdown trigger label. */
  activeBranch = computed<BranchTabRef | null>(
    () => this.branches().find((b) => b.id === this.activeId()) ?? null,
  );

  /** Compact mode flag — when more tabs are open than fit inline, names ellipsize and shrink. */
  compact = computed<boolean>(() => this.openTabs().length > this.effectiveMax());

  // ── Actions ──────────────────────────────────────────────────────
  selectTab(id: string): void { this.store.setActive(id); }

  closeTab(ev: Event, id: string): void {
    ev.stopPropagation();
    this.store.closeTab(id);
  }

  togglePopover(): void { this.popoverOpen.update((v) => !v); }
  closePopover(): void { this.popoverOpen.set(false); }

  isActive(id: string): boolean { return this.activeId() === id; }

  // ── Keyboard shortcuts ──────────────────────────────────────────
  /**
   * Globally-bound shortcuts. Skipped when the user is typing into a form
   * input / textarea / contenteditable — otherwise typing branch names
   * elsewhere on the page would steal Cmd+K and friends.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (this.shouldSkipShortcut(ev.target)) return;

    const cmd = ev.metaKey || ev.ctrlKey;
    if (!cmd) return;

    // Cmd/Ctrl + K — sidebar: focus its search; tabs/dropdown: open the popover.
    if (ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (this.isSidebar()) this.sidebarSearchEl?.nativeElement.focus();
      else this.popoverOpen.set(true);
      return;
    }

    // The tab shortcuts don't apply to the sidebar (no open-tabs concept).
    if (this.isSidebar()) return;

    // Cmd/Ctrl + 1..5 — jump to tab N.
    if (ev.key >= '1' && ev.key <= '5') {
      const idx = Number(ev.key) - 1;
      const tab = this.openTabs()[idx];
      if (tab) {
        ev.preventDefault();
        this.store.setActive(tab.id);
      }
      return;
    }

    // Cmd/Ctrl + W — close active tab. Browsers intercept this in regular
    // tabs; the handler still runs in PWA / standalone mode where the
    // browser yields the shortcut.
    if (ev.key.toLowerCase() === 'w') {
      const active = this.activeId();
      if (active) {
        ev.preventDefault();
        this.store.closeTab(active);
      }
    }
  }

  private shouldSkipShortcut(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    // Don't fire when focus is inside the popover's own search field either.
    if (target.closest('.cdk-overlay-pane')) return true;
    return false;
  }
}
