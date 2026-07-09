import {
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  ElementRef,
  HostListener,
  TemplateRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OverlayModule } from '@angular/cdk/overlay';
import { TranslateModule } from '@ngx-translate/core';

import { FindEntityPopoverComponent } from './find-entity-popover/find-entity-popover.component';
import { EntityStatusIconComponent } from './entity-status-icon.component';
import { EntityRef, EntitySelectorService } from './entity-selector.service';
import {
  EntityCompletion,
  SelectorMode,
  CompletionMap,
  matchesQuery,
  progressCounts,
} from './entity-selector.util';

export type { SelectorMode, EntityCompletion, CompletionMap } from './entity-selector.util';

const VISIBLE_TABS = 5;

/** Context passed to the projected `#status` template so the host can render
 *  differently per location (e.g. a dot in tabs, a text pill in popover rows). */
export type StatusContextKind = 'tab' | 'dropdown' | 'sidebar-row' | 'popover-row';

/**
 * entity-selector
 * ───────────────
 * Domain-agnostic item selector with three display modes (tabs / dropdown /
 * sidebar), a searchable overflow popover, pin/recent, grouping, completion
 * indicators and bulk-action affordances. Owns no domain strings — every label
 * is a host-supplied translation key, and the status indicator is projected via
 * a `#status` template (with a context kind). Selection state lives in the
 * host-provided `EntitySelectorService` (`provideEntitySelector(namespace)`).
 */
@Component({
  selector: 'app-entity-selector',
  standalone: true,
  imports: [CommonModule, OverlayModule, TranslateModule, FindEntityPopoverComponent, EntityStatusIconComponent],
  templateUrl: './entity-selector.component.html',
  styleUrl: './entity-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntitySelectorComponent {
  private store = inject(EntitySelectorService);

  /** Live item directory pushed from the host. */
  items = input.required<ReadonlyArray<EntityRef>>();

  /** Display mode. */
  mode = input<SelectorMode>('tabs');
  isTabs     = computed<boolean>(() => this.mode() === 'tabs');
  isDropdown = computed<boolean>(() => this.mode() === 'dropdown');
  isSidebar  = computed<boolean>(() => this.mode() === 'sidebar');

  /** Emits whenever the active item changes. */
  activeChange = output<string>();

  /** Bulk-action affordances (Apply to all / Copy from…). */
  showBulkActions = input<boolean>(false);
  applyToAll = output<void>();
  /** Emits the picked source id (pick-once; active item unchanged). */
  copyFrom = output<string>();

  /** Show a close (×) on tabs. Off for pure selectors. */
  closable = input<boolean>(true);
  /** Max inline tabs before the rest fold behind the find pill. */
  maxVisible = input<number>(VISIBLE_TABS);
  /** Narrower cap < 640px. Null keeps `maxVisible`. */
  maxVisibleMobile = input<number | null>(null);

  /** Per-item fill state. `null` = indicator off. */
  completion = input<CompletionMap | null>(null);
  completionOf(id: string): EntityCompletion { return this.completion()?.[id] ?? 'empty'; }
  /** Sidebar progress footer toggle. */
  showProgress = input<boolean>(true);
  progress = computed(() => progressCounts(this.completion(), this.items().map((b) => b.id)));

  // ── Host-supplied label keys (13) ────────────────────────────────
  searchLabel       = input<string>('PF.ENTITY_SELECTOR.SEARCH');
  findLabel         = input<string>('PF.ENTITY_SELECTOR.FIND');
  pinnedLabel       = input<string>('PF.ENTITY_SELECTOR.PINNED');
  recentLabel       = input<string>('PF.ENTITY_SELECTOR.RECENT');
  allLabel          = input<string>('PF.ENTITY_SELECTOR.ALL');
  noMatchLabel      = input<string>('PF.ENTITY_SELECTOR.NO_MATCH');
  pinLabel          = input<string>('PF.ENTITY_SELECTOR.PIN');
  unpinLabel        = input<string>('PF.ENTITY_SELECTOR.UNPIN');
  applyToAllLabel   = input<string>('PF.ENTITY_SELECTOR.APPLY_ALL');
  copyFromLabel     = input<string>('PF.ENTITY_SELECTOR.COPY_FROM');
  progressLabel     = input<string>('PF.ENTITY_SELECTOR.PROGRESS');
  statusDoneLabel   = input<string>('PF.ENTITY_SELECTOR.STATUS_DONE');
  statusPartialLabel = input<string>('PF.ENTITY_SELECTOR.STATUS_PARTIAL');

  // ── Projected slots ──────────────────────────────────────────────
  /** Optional status renderer. Rendered with `{ $implicit: item, context }`. */
  @ContentChild('status') statusTpl?: TemplateRef<unknown>;
  /** Optional trailing row content (sidebar/tab). `{ $implicit: item }`. */
  @ContentChild('suffix') suffixTpl?: TemplateRef<unknown>;

  /** Copy-from popover open state (separate overlay, pick-once mode). */
  copyOpen = signal<boolean>(false);
  onCopyPicked(id: string): void {
    this.copyFrom.emit(id);
    this.copyOpen.set(false);
  }

  // ── Sidebar mode ─────────────────────────────────────────────────
  @ViewChild('sbSearchInput') sidebarSearchEl?: ElementRef<HTMLInputElement>;
  sidebarSearch = signal<string>('');
  onSidebarSearch(v: string): void { this.sidebarSearch.set(v); }

  private sbFilter(list: EntityRef[]): EntityRef[] {
    const q = this.sidebarSearch();
    return list.filter((b) => matchesQuery(b.label, q));
  }

  sbPinned = computed<EntityRef[]>(() => {
    const pins = this.store.pinnedIds();
    return this.sbFilter(this.items().filter((b) => pins.has(b.id)));
  });

  private sbRest = computed<EntityRef[]>(() => {
    const pins = this.store.pinnedIds();
    return this.sbFilter(this.items().filter((b) => !pins.has(b.id)));
  });

  hasGroups = computed<boolean>(() => this.items().some((b) => !!b.group?.trim()));

  sbFlat = computed<EntityRef[]>(() =>
    [...this.sbRest()].sort((a, b) => a.label.localeCompare(b.label)),
  );

  sbGroups = computed<{ group: string; items: EntityRef[] }[]>(() => {
    const map = new Map<string, EntityRef[]>();
    for (const b of this.sbRest()) {
      const g = b.group?.trim() || '';
      const bucket = map.get(g) ?? (map.set(g, []), map.get(g)!);
      bucket.push(b);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
      .map(([group, items]) => ({
        group,
        items: items.sort((x, y) => x.label.localeCompare(y.label)),
      }));
  });

  sbHasAnyMatch = computed<boolean>(() => this.sbPinned().length + this.sbRest().length > 0);

  isPinned(id: string): boolean { return this.store.isPinned(id); }
  togglePin(ev: Event, id: string): void { ev.stopPropagation(); this.store.togglePin(id); }
  isGroupCollapsed(g: string): boolean { return this.store.isGroupCollapsed(g); }
  toggleGroup(g: string): void { this.store.toggleGroup(g); }

  popoverOpen = signal<boolean>(false);
  private narrow = signal<boolean>(
    typeof window !== 'undefined' && window.innerWidth < 640,
  );

  @HostListener('window:resize')
  onResize(): void {
    if (typeof window !== 'undefined') this.narrow.set(window.innerWidth < 640);
  }

  @ViewChild('findTrigger') findTrigger?: ElementRef<HTMLButtonElement>;

  constructor() {
    // Push the directory into the store whenever the input changes.
    effect(() => {
      const list = this.items();
      this.store.setDirectory(list ?? []);
    });

    // Bridge: emit the active id every time it changes.
    effect(() => {
      const id = this.store.activeTabId();
      if (id) this.activeChange.emit(id);
    });
  }

  // ── Derived state ────────────────────────────────────────────────
  openTabs = this.store.openTabs;
  activeId = this.store.activeTabId;

  private effectiveMax = computed<number>(() => {
    const m = this.narrow() && this.maxVisibleMobile() != null
      ? (this.maxVisibleMobile() as number)
      : this.maxVisible();
    return Math.max(1, m);
  });

  visibleTabs = computed<EntityRef[]>(() => this.openTabs().slice(0, this.effectiveMax()));
  hiddenCount = computed<number>(() => Math.max(0, this.items().length - this.visibleTabs().length));

  /** The currently-active item — drives the dropdown trigger label. */
  activeEntity = computed<EntityRef | null>(
    () => this.items().find((b) => b.id === this.activeId()) ?? null,
  );

  compact = computed<boolean>(() => this.openTabs().length > this.effectiveMax());

  // ── Actions ──────────────────────────────────────────────────────
  selectTab(id: string): void { this.store.setActive(id); }
  closeTab(ev: Event, id: string): void { ev.stopPropagation(); this.store.closeTab(id); }
  togglePopover(): void { this.popoverOpen.update((v) => !v); }
  closePopover(): void { this.popoverOpen.set(false); }
  isActive(id: string): boolean { return this.activeId() === id; }

  // ── Keyboard shortcuts ──────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (this.shouldSkipShortcut(ev.target)) return;
    const cmd = ev.metaKey || ev.ctrlKey;
    if (!cmd) return;

    if (ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (this.isSidebar()) this.sidebarSearchEl?.nativeElement.focus();
      else this.popoverOpen.set(true);
      return;
    }

    if (this.isSidebar()) return;

    if (ev.key >= '1' && ev.key <= '5') {
      const idx = Number(ev.key) - 1;
      const tab = this.openTabs()[idx];
      if (tab) {
        ev.preventDefault();
        this.store.setActive(tab.id);
      }
      return;
    }

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
    if (target.closest('.cdk-overlay-pane')) return true;
    return false;
  }
}
