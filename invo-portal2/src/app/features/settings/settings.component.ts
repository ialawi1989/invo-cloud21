import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SafeHtmlPipe } from '../../core/pipes/safe-html.pipe';
import { withTranslations } from '../../core/i18n/with-translations';
import { SegmentedToggleComponent, SegmentedToggleOption } from '../../shared/components/segmented-toggle/segmented-toggle.component';
import { SettingsAccessService } from './services/settings-access.service';
import { SettingsSearchService } from './services/settings-search.service';
import { SETTINGS_GROUPS, SettingGroup, SettingItem } from './settings.catalog';


@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [PageHeaderComponent, CommonModule, RouterModule, TranslateModule, SafeHtmlPipe, SegmentedToggleComponent],
  template: `
    <div class="settings-page">

      <app-page-header [title]="'SETTINGS.TITLE' | translate" [description]="'SETTINGS.SUBTITLE' | translate"/>

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

    .page-header { margin-bottom: 20px; }

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
  private access = inject(SettingsAccessService);
  private search = inject(SettingsSearchService);

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
    return this.allGroups.map(g => ({
      ...g,
      items: g.items.filter(i => this.canAccess(i) && (!q || this.search.matches(i, q)))
    })).filter(g => !q || g.items.length > 0);
  });

  /** "Did you mean …" suggestion shown when the search returns zero results. */
  searchSuggestion = computed<string | null>(() => {
    const q = this.searchQuery().trim();
    if (!q || this.filteredGroups().some(g => g.items.length > 0)) return null;
    return this.search.suggest(q, this.allGroups.flatMap(g => g.items).filter(i => this.canAccess(i)));
  });

  /** Accept the current "Did you mean …" suggestion. */
  applySearchSuggestion(): void {
    const s = this.searchSuggestion();
    if (s) this.searchQuery.set(s);
  }

  canAccess(item: SettingItem): boolean { return this.access.canAccess(item); }

  onSearch(e: Event): void {
    this.searchQuery.set((e.target as HTMLInputElement).value);
  }

  /** Wipe the search input. The `[value]` binding on the input is
   *  signal-driven, so resetting `searchQuery` immediately empties
   *  the DOM field too. */
  clearSearch(): void {
    this.searchQuery.set('');
  }

  openPopup(popup: { component: any; size?: string }): Promise<void> {
    return this.access.openPopup(popup);
  }
}
