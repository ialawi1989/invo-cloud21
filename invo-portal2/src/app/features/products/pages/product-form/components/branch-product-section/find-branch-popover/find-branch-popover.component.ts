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
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { BranchTabRef, BranchTabsService } from '../branch-tabs/branch-tabs.service';
import { BranchStatusIconComponent } from '../branch-tabs/branch-status-icon.component';
import { BranchCompletion, CompletionMap, matchesQuery } from '../branch-tabs/branch-tabs.util';

/**
 * find-branch-popover
 * ───────────────────
 * Searchable list of every branch with three sections (Pinned / Recent /
 * All). Hosted inside a CDK overlay by the parent `<app-pf-branch-tabs>`
 * — this component only renders the panel and emits `closed` when the
 * user picks a branch or hits Escape.
 *
 * Selection emits via `branchPicked` and (for the parent's convenience)
 * also opens the branch directly through the shared store, so callers
 * don't have to duplicate that step.
 */
@Component({
  selector: 'app-pf-find-branch-popover',
  standalone: true,
  imports: [CommonModule, TranslateModule, BranchStatusIconComponent],
  templateUrl: './find-branch-popover.component.html',
  styleUrl: './find-branch-popover.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FindBranchPopoverComponent {
  private store = inject(BranchTabsService);

  branchPicked = output<string>();
  closed       = output<void>();

  /** Per-branch fill state from the host — drives the row completion icon. */
  completion = input<CompletionMap | null>(null);

  /**
   * `'open'` (default): picking opens/activates the branch via the store.
   * `'select'`: pick-once — emit `branchPicked` WITHOUT touching the store, so
   * the active branch is unchanged (used by "Copy from branch…").
   */
  pickMode = input<'open' | 'select'>('open');

  completionOf(id: string): BranchCompletion {
    return this.completion()?.[id] ?? 'empty';
  }

  search = signal<string>('');

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  constructor() {
    // Autofocus the search input as soon as the panel mounts.
    effect(() => {
      void this.search();
      queueMicrotask(() => this.searchInput?.nativeElement.focus());
    });
  }

  /** Case- and diacritic-insensitive substring match (shared with the sidebar). */
  private filtered(items: readonly BranchTabRef[]): BranchTabRef[] {
    const q = this.search();
    return items.filter((b) => matchesQuery(b.name, q));
  }

  /** Pinned branches that exist in the directory and match the search query. */
  pinned = computed<BranchTabRef[]>(() => {
    const pins = this.store.pinnedIds();
    if (pins.size === 0) return [];
    const dir = this.store.directoryList();
    return this.filtered(dir.filter((b) => pins.has(b.id)));
  });

  /** Last 5 opened, most-recent first, matching the search query. Excludes pinned to avoid duplication. */
  recent = computed<BranchTabRef[]>(() => {
    const ids = this.store.recentIds();
    if (ids.length === 0) return [];
    const dir = this.store.directoryList();
    const pins = this.store.pinnedIds();
    const map = new Map(dir.map((b) => [b.id, b]));
    const ordered: BranchTabRef[] = [];
    for (const id of ids) {
      const b = map.get(id);
      if (b && !pins.has(b.id)) ordered.push(b);
    }
    return this.filtered(ordered);
  });

  /** Alphabetical, with pinned + recent excluded so each branch appears once. */
  all = computed<BranchTabRef[]>(() => {
    const dir = this.store.directoryList();
    const pins = this.store.pinnedIds();
    const recents = new Set(this.store.recentIds());
    const rest = dir
      .filter((b) => !pins.has(b.id) && !recents.has(b.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    return this.filtered(rest);
  });

  hasAnyMatch = computed<boolean>(() =>
    this.pinned().length + this.recent().length + this.all().length > 0,
  );

  // ── Actions ──────────────────────────────────────────────────────
  pick(b: BranchTabRef): void {
    // Pick-once ('select'): never mutate the store so the active branch stays
    // put; the host consumes `branchPicked` (e.g. as a copy-from source).
    if (this.pickMode() === 'open') this.store.openBranch(b.id);
    this.branchPicked.emit(b.id);
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
