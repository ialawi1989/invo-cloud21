import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PrivilegeService } from '../../core/auth/privileges/privilege.service';
import { FeatureService } from '../../core/auth/feature.service';
import { SafeHtmlPipe } from '../../core/pipes/safe-html.pipe';
import { ModalService } from '../../shared/modal/modal.service';
import { withTranslations } from '../../core/i18n/with-translations';
import { SegmentedToggleComponent, SegmentedToggleOption } from '../../shared/components/segmented-toggle/segmented-toggle.component';
import { SETTINGS_GROUPS, SettingGroup, SettingItem } from './settings.catalog';


/**
 * Bounded Levenshtein distance — returns `-1` as soon as the cost
 * exceeds `budget`, which lets the caller skip the inner allocation
 * for obviously-too-different word pairs. Used by the settings
 * search "Did you mean …" suggestion; an unbounded variant would
 * be wasteful when we already know we'll reject anything > N edits.
 */
function levenshtein(a: string, b: string, budget: number): number {
  if (Math.abs(a.length - b.length) > budget) return -1;
  if (a === b) return 0;
  const m = a.length, n = b.length;
  // Two-row buffer is enough — classic space-optimised LD.
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost, // substitution
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    // Early exit — if every cell in this row already exceeds the
    // budget, no later row can drop back below it.
    if (rowMin > budget) return -1;
    [prev, curr] = [curr, prev];
  }
  return prev[n] <= budget ? prev[n] : -1;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, SafeHtmlPipe, SegmentedToggleComponent],
  template: `
    <div class="settings-page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ 'SETTINGS.TITLE' | translate }}</h1>
          <p class="page-sub">{{ 'SETTINGS.SUBTITLE' | translate }}</p>
        </div>
      </div>

      <!-- Search + view switch -->
      <div class="toolbar">
      <div class="search-bar">
        <svg class="search-bar__icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input type="text" [placeholder]="'SETTINGS.SEARCH_PLACEHOLDER' | translate"
               class="search-input"
               [value]="searchValue()"
               (input)="onSearch($event)"/>
        @if (searchValue()) {
          <button type="button" class="search-bar__clear"
                  (click)="clearSearch()"
                  [attr.aria-label]="'COMMON.CLEAR' | translate">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6"  y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        }
      </div>
      <app-segmented-toggle [options]="viewOptions" [value]="viewMode()" (valueChange)="setView($event)" size="sm"/>
      </div>

      <!-- Did-you-mean hint — rendered only when the typed query
           returned no results AND we found a similar word in the
           settings corpus within a small edit-distance budget. -->
      @if (searchSuggestion(); as s) {
        <p class="search-hint">
          <span class="search-hint__prefix">{{ 'SETTINGS.SEARCH_DID_YOU_MEAN' | translate }}</span>
          <button type="button" class="search-hint__link" (click)="applySearchSuggestion()">{{ s }}</button><span class="search-hint__q">?</span>
        </p>
      }

      <!-- One row template shared by both views -->
      <ng-template #rows let-group>
        @for (item of group.items; track item.label) {
          @if (canAccess(item)) {
            @if (item.link) {
              <a [routerLink]="item.link" [queryParams]="item.queryParams ?? null" class="setting-item">
                <div class="item-text">
                  <span class="item-label">{{ item.label | translate }}</span>
                  <span class="item-desc">{{ item.description | translate }}</span>
                </div>
                <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
            } @else if (item.popup) {
              <button class="setting-item setting-item--btn" (click)="openPopup(item.popup)">
                <div class="item-text">
                  <span class="item-label">{{ item.label | translate }}</span>
                  <span class="item-desc">{{ item.description | translate }}</span>
                </div>
                <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            }
          }
        }
      </ng-template>

      @if (viewMode() === 'grid') {
      <!-- Groups grid -->
      <div class="groups-grid">
        @for (group of filteredGroups(); track group.id) {
          @if (group.items.length > 0) {
            <div class="group-card">
              <div class="group-header">
                <div class="group-icon" [style.background]="group.color + '18'">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                       [style.stroke]="group.color" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round"
                       [innerHTML]="group.icon | safeHtml"></svg>
                </div>
                <h3 class="group-title">{{ group.title | translate }}</h3>
              </div>
              <div class="group-items">
                <ng-container *ngTemplateOutlet="rows; context: { $implicit: group }"/>
              </div>
            </div>
          }
        }
      </div>
      } @else {
      <!-- Groups list: a heading per group, then one card of rows -->
      <div class="groups-list">
        @for (group of filteredGroups(); track group.id) {
          @if (group.items.length > 0) {
            <section class="list-group">
              <div class="list-group__head">
                <div class="group-icon" [style.background]="group.color + '18'">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                       [style.stroke]="group.color" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round"
                       [innerHTML]="group.icon | safeHtml"></svg>
                </div>
                <h2 class="list-group__title">{{ group.title | translate }}</h2>
              </div>
              <div class="list-group__card">
                <ng-container *ngTemplateOutlet="rows; context: { $implicit: group }"/>
              </div>
            </section>
          }
        }
      </div>
      }

    </div>
  `,
  styles: [`
    .settings-page { max-width: 1100px; }

    .page-header { margin-bottom: 20px; }
    .page-title  { font-size: 22px; font-weight: 700; color: var(--ui-text-2); margin: 0 0 4px; }
    .page-sub    { font-size: 14px; color: var(--ui-muted); margin: 0; }

    .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
    .toolbar .search-bar { flex: 1 1 280px; margin-bottom: 0; }

    .search-bar {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; background: var(--ui-surface);
      border: 1px solid var(--ui-line); border-radius: 10px;
      margin-bottom: 8px; color: var(--ui-faint);
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }
    .search-bar:focus-within {
      border-color: var(--color-brand-400, #7dd3fc);
      box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.12);
    }
    .search-bar__icon { flex-shrink: 0; }
    .search-bar__clear {
      flex-shrink: 0;
      appearance: none;
      background: transparent;
      border: 0;
      padding: 4px;
      border-radius: 6px;
      color: var(--ui-faint);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 120ms ease, color 120ms ease;
    }
    .search-bar__clear:hover { background: var(--ui-surface-2); color: var(--ui-text); }

    .search-input {
      border: none; outline: none; font-size: 16px;
      color: var(--ui-text-2); background: transparent; width: 100%;
      &::placeholder { color: var(--ui-faint); }
    }

    /* "Did you mean …" — gray prefix + bold italic brand-coloured
       suggestion link. Matches the second design reference. */
    .search-hint {
      margin: 0 0 24px;
      font-size: 14px;
      color: var(--ui-muted);
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .search-hint__prefix { color: var(--ui-muted); }
    .search-hint__q      { color: var(--ui-muted); }
    .search-hint__link {
      appearance: none;
      background: transparent;
      border: 0;
      padding: 0;
      font: inherit;
      font-style: italic;
      font-weight: 700;
      color: var(--ui-brand-t700);
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 3px;
      text-decoration-thickness: 1.5px;
      transition: color 120ms ease;
    }
    .search-hint__link:hover { color: var(--ui-brand-t800); }

    .groups-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    .group-card {
      background: var(--ui-surface); border-radius: 14px;
      border: 1px solid var(--ui-line); overflow: hidden;
    }
    .group-header {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 18px 12px; border-bottom: 1px solid var(--ui-surface-2);
    }
    .group-icon {
      width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .group-title { font-size: 14px; font-weight: 600; color: var(--ui-text-2); margin: 0; }

    .group-items { padding: 4px 0 8px; }

    /* List view */
    .groups-list { display: flex; flex-direction: column; gap: 28px; margin-top: 16px; }
    .list-group__head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .list-group__title { font-size: 17px; font-weight: 600; color: var(--ui-text); margin: 0; }
    .list-group__card {
      background: var(--ui-surface); border-radius: 14px; padding: 6px 0;
      box-shadow: 0 1px 3px rgba(15, 23, 42, .06), 0 4px 14px rgba(15, 23, 42, .04);
    }
    .list-group__card .setting-item { padding: 14px 22px; }
    .list-group__card .item-label { font-size: 14px; color: var(--ui-text); }
    .list-group__card .item-desc  { font-size: 13px; color: var(--ui-muted); white-space: normal; }
    :host-context([dir='rtl']) .chev { transform: scaleX(-1); }
    .setting-item {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 18px; text-decoration: none;
      transition: background .15s; cursor: pointer;
      &:hover { background: var(--ui-surface-1); }
      &:hover svg { stroke: #32acc1; }
    }
    .setting-item--btn {
      width: 100%; background: transparent; border: none;
      font-family: inherit; text-align: left;
    }
    .item-text { flex: 1; min-width: 0; }
    .item-label {
      display: block; font-size: 13px; font-weight: 500;
      color: var(--ui-text-3); margin-bottom: 2px;
    }
    .item-desc {
      display: block; font-size: 12px; color: var(--ui-faint);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
  `]
})
export class SettingsComponent {
  private privilegeService = inject(PrivilegeService);
  private featureService   = inject(FeatureService);
  private modalService     = inject(ModalService);
  private translateSvc     = inject(TranslateService);

  constructor() { withTranslations('settings'); }

  /** How the tiles are laid out: a plain list (default) or the card grid. A per-viewer convenience, so it is remembered in the browser only. */
  readonly viewOptions: SegmentedToggleOption<'list' | 'grid'>[] = [
    { value: 'list', label: 'SETTINGS.VIEW_LIST', icon: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>' },
    { value: 'grid', label: 'SETTINGS.VIEW_GRID', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
  ];
  viewMode = signal<'list' | 'grid'>(this.readView());
  setView(v: 'list' | 'grid'): void {
    this.viewMode.set(v);
    try { localStorage.setItem('settings.view', v); } catch { /* private mode: the choice just isn't remembered */ }
  }
  private readView(): 'list' | 'grid' {
    try { return localStorage.getItem('settings.view') === 'grid' ? 'grid' : 'list'; } catch { return 'list'; }
  }

  private searchQuery = signal('');
  /** Public read-only view bound to the search input's `[value]`, so
   *  accepting a "Did you mean …" suggestion updates the visible
   *  text without manually round-tripping through the DOM. */
  readonly searchValue = this.searchQuery.asReadonly();

  private readonly allGroups: SettingGroup[] = SETTINGS_GROUPS;

  filteredGroups = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.allGroups.map(g => ({
      ...g,
      items: g.items.filter(i => this.canAccess(i))
    }));
    return this.allGroups.map(g => ({
      ...g,
      items: g.items.filter(i =>
        this.canAccess(i) && this.matchesItem(i, q)
      )
    })).filter(g => g.items.length > 0);
  });

  /** Build the search corpus for a tile — visible label/description
   *  plus any extra `searchKeys` translated and folded into a single
   *  lowercase haystack. Splitting the check into its own helper
   *  keeps the `filteredGroups` body readable while the corpus grows
   *  with more pages.
   *
   *  Token-AND semantics: every whitespace-separated word in the
   *  query must appear *somewhere* in the corpus. That lets a search
   *  like "branch name" match a tile whose title is "Branch Settings"
   *  and whose searchKey contains "Branch name", even though neither
   *  text contains the exact phrase. */
  private matchesItem(item: SettingItem, q: string): boolean {
    if (!q) return true;
    const corpus = this.itemCorpus(item);
    for (const tok of q.split(/\s+/)) {
      if (tok && !corpus.includes(tok)) return false;
    }
    return true;
  }

  /** Concatenate the tile's translated label + description + every
   *  leaf translation under `i18nPrefix` into one lowercase string.
   *  Built lazily per call — the i18n dictionary is in-memory so
   *  walking a sub-tree is cheap. */
  private itemCorpus(item: SettingItem): string {
    const parts: string[] = [
      this.t(item.label),
      this.t(item.description),
    ];
    if (item.i18nPrefix) {
      this.collectLeaves(this.lookupTree(item.i18nPrefix), parts);
    }
    return parts.join(' ').toLowerCase();
  }

  /** Resolve a dot-separated i18n prefix to the nested object that
   *  holds its sub-keys. Returns `null` when the path doesn't exist
   *  in the current language (e.g. feature namespace not yet loaded). */
  private lookupTree(prefix: string): unknown {
    const lang = this.translateSvc.currentLang ?? this.translateSvc.getFallbackLang();
    const dict = (this.translateSvc as any).store?.translations?.[lang ?? ''];
    if (!dict || typeof dict !== 'object') return null;
    let node: unknown = dict;
    for (const seg of prefix.split('.')) {
      if (node && typeof node === 'object' && seg in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[seg];
      } else {
        return null;
      }
    }
    return node;
  }

  /** Recursively push every string leaf of `node` into `out`. */
  private collectLeaves(node: unknown, out: string[]): void {
    if (typeof node === 'string') {
      out.push(node);
      return;
    }
    if (node && typeof node === 'object') {
      for (const v of Object.values(node as Record<string, unknown>)) {
        this.collectLeaves(v, out);
      }
    }
  }

  /** "Did you mean …" suggestion shown when the search returns zero
   *  results. Walks every tile's corpus (label + description +
   *  searchKeys), tokenises into individual words, and picks the
   *  closest word to each typed token by Levenshtein distance.
   *  Returns `null` when nothing close enough is found so the
   *  template can hide the suggestion entirely. */
  searchSuggestion = computed<string | null>(() => {
    const q = this.searchQuery().trim();
    if (!q || this.filteredGroups().some(g => g.items.length > 0)) return null;

    // Build the corpus of unique words from every accessible tile.
    // Source: each tile's `itemCorpus` (label + description + every
    // leaf string under `i18nPrefix`) — same haystack the matcher
    // uses, so suggestions can only ever be words that would
    // actually surface a real tile.
    const corpus = new Set<string>();
    for (const g of this.allGroups) {
      for (const i of g.items) {
        if (!this.canAccess(i)) continue;
        for (const w of this.itemCorpus(i).split(/\s+/)) {
          const clean = w.replace(/[^a-z0-9؀-ۿ]/gi, '');
          if (clean.length >= 3) corpus.add(clean);
        }
      }
    }

    // For each typed word, find the closest corpus word within a small
    // edit-distance budget. Threshold scales with word length so short
    // tokens get tighter matching (no point suggesting "bus" for "set").
    const out: string[] = [];
    let changed = false;
    for (const w of q.split(/\s+/)) {
      const lower = w.toLowerCase();
      if (lower.length < 3 || corpus.has(lower)) {
        out.push(w);
        continue;
      }
      const budget = Math.max(1, Math.floor(lower.length / 4));
      let best: { word: string; dist: number } | null = null;
      for (const c of corpus) {
        // Skip words wildly different in length — cheap pre-filter.
        if (Math.abs(c.length - lower.length) > budget) continue;
        const d = levenshtein(lower, c, budget);
        if (d < 0) continue;
        if (!best || d < best.dist) best = { word: c, dist: d };
        if (best.dist === 0) break;
      }
      if (best && best.dist > 0 && best.dist <= budget) {
        out.push(best.word);
        changed = true;
      } else {
        out.push(w);
      }
    }
    return changed ? out.join(' ') : null;
  });

  /** Accept the current "Did you mean …" suggestion. */
  applySearchSuggestion(): void {
    const s = this.searchSuggestion();
    if (s) this.searchQuery.set(s);
  }

  canAccess(item: SettingItem): boolean {
    if (item.feature && !this.featureService.isEnabled(item.feature)) return false;
    if (!item.privilege) return true;
    if (!this.privilegeService.privileges) return true;
    return this.privilegeService.check(item.privilege);
  }

  onSearch(e: Event): void {
    this.searchQuery.set((e.target as HTMLInputElement).value);
  }

  /** Wipe the search input. The `[value]` binding on the input is
   *  signal-driven, so resetting `searchQuery` immediately empties
   *  the DOM field too. */
  clearSearch(): void {
    this.searchQuery.set('');
  }

  async openPopup(popup: { component: any; size?: string }): Promise<void> {
    const component = typeof popup.component === 'function'
      ? await popup.component()
      : popup.component;
    this.modalService.open(component, { size: (popup.size as any) ?? 'md', closeOnBackdrop: true });
  }

  private t(key: string): string {
    return this.translateSvc.instant(key);
  }
}
