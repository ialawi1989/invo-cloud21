import {
  ChangeDetectionStrategy,
  Component,
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
import { TranslateModule } from '@ngx-translate/core';

import { EntityRef, EntitySelectorService } from '../entity-selector.service';
import { EntityStatusIconComponent } from '../entity-status-icon.component';
import { EntityCompletion, CompletionMap, matchesQuery } from '../entity-selector.util';

/**
 * find-entity-popover
 * ───────────────────
 * Searchable list of every item with three sections (Pinned / Recent / All).
 * Hosted inside a CDK overlay by the parent `<app-entity-selector>` — this
 * component only renders the panel and emits `closed` when the user picks an
 * item or hits Escape.
 *
 * Every user-facing string is a host-supplied translation key, and the status
 * indicator is a projected template (context `'popover-row'`), so the popover
 * owns no domain concepts.
 */
@Component({
  selector: 'app-entity-find-popover',
  standalone: true,
  imports: [CommonModule, TranslateModule, EntityStatusIconComponent],
  templateUrl: './find-entity-popover.component.html',
  styleUrl: './find-entity-popover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FindEntityPopoverComponent {
  private store = inject(EntitySelectorService);

  itemPicked = output<string>();
  closed     = output<void>();

  /** Per-item fill state — drives the row completion icon. */
  completion = input<CompletionMap | null>(null);

  /**
   * `'open'` (default): picking opens/activates the item via the store.
   * `'select'`: pick-once — emit `itemPicked` WITHOUT touching the store.
   */
  pickMode = input<'open' | 'select'>('open');

  /** Projected status template (rendered per row with context `'popover-row'`). */
  statusTpl = input<TemplateRef<unknown> | null>(null);

  // ── Host-supplied label keys ─────────────────────────────────────
  searchLabel  = input<string>('PF.ENTITY_SELECTOR.SEARCH');
  pinnedLabel  = input<string>('PF.ENTITY_SELECTOR.PINNED');
  recentLabel  = input<string>('PF.ENTITY_SELECTOR.RECENT');
  allLabel     = input<string>('PF.ENTITY_SELECTOR.ALL');
  noMatchLabel = input<string>('PF.ENTITY_SELECTOR.NO_MATCH');
  pinLabel     = input<string>('PF.ENTITY_SELECTOR.PIN');
  unpinLabel   = input<string>('PF.ENTITY_SELECTOR.UNPIN');
  doneLabel    = input<string>('PF.ENTITY_SELECTOR.STATUS_DONE');
  partialLabel = input<string>('PF.ENTITY_SELECTOR.STATUS_PARTIAL');

  completionOf(id: string): EntityCompletion {
    return this.completion()?.[id] ?? 'empty';
  }

  search = signal<string>('');

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  constructor() {
    effect(() => {
      void this.search();
      queueMicrotask(() => this.searchInput?.nativeElement.focus());
    });
  }

  /** Case- and diacritic-insensitive substring match (shared with the sidebar). */
  private filtered(items: readonly EntityRef[]): EntityRef[] {
    const q = this.search();
    return items.filter((b) => matchesQuery(b.label, q));
  }

  /** Pinned items that exist in the directory and match the search query. */
  pinned = computed<EntityRef[]>(() => {
    const pins = this.store.pinnedIds();
    if (pins.size === 0) return [];
    const dir = this.store.directoryList();
    return this.filtered(dir.filter((b) => pins.has(b.id)));
  });

  /** Last 5 opened, most-recent first, matching the query. Excludes pinned. */
  recent = computed<EntityRef[]>(() => {
    const ids = this.store.recentIds();
    if (ids.length === 0) return [];
    const dir = this.store.directoryList();
    const pins = this.store.pinnedIds();
    const map = new Map(dir.map((b) => [b.id, b]));
    const ordered: EntityRef[] = [];
    for (const id of ids) {
      const b = map.get(id);
      if (b && !pins.has(b.id)) ordered.push(b);
    }
    return this.filtered(ordered);
  });

  /** Alphabetical, with pinned + recent excluded so each item appears once. */
  all = computed<EntityRef[]>(() => {
    const dir = this.store.directoryList();
    const pins = this.store.pinnedIds();
    const recents = new Set(this.store.recentIds());
    const rest = dir
      .filter((b) => !pins.has(b.id) && !recents.has(b.id))
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label));
    return this.filtered(rest);
  });

  hasAnyMatch = computed<boolean>(() =>
    this.pinned().length + this.recent().length + this.all().length > 0,
  );

  // ── Actions ──────────────────────────────────────────────────────
  pick(b: EntityRef): void {
    if (this.pickMode() === 'open') this.store.open(b.id);
    this.itemPicked.emit(b.id);
    this.closed.emit();
  }

  togglePin(ev: Event, id: string): void {
    ev.stopPropagation();
    this.store.togglePin(id);
  }

  isPinned(id: string): boolean {
    return this.store.isPinned(id);
  }

  onSearchInput(value: string): void {
    this.search.set(value);
  }

  @HostListener('keydown.escape', ['$event'])
  onEscape(ev: Event): void {
    ev.stopPropagation();
    this.closed.emit();
  }
}
