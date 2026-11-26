import { AfterViewInit, Component, ElementRef, ViewChild, computed, inject, output, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SafeHtmlPipe } from '../../../pipes/safe-html.pipe';
import { withTranslations } from '../../../i18n/with-translations';
import { SettingGroup, SettingItem } from '../../../../features/settings/settings.catalog';
import { SettingsAccessService } from '../../../../features/settings/services/settings-access.service';
import { SettingsSearchService } from '../../../../features/settings/services/settings-search.service';
import { SettingsModeService } from '../../services/settings-mode.service';
import { SETTINGS_SIDEBAR_FOOTER_ITEMS } from '../../../../features/settings/settings-sidebar-footer';

interface NavSection { key: string; groups: NavGroup[]; }
interface NavGroup  { group: SettingGroup; target: SettingItem; matches: number; }

/**
 * The settings menu that takes the app sidebar's place while in settings mode: Back, title,
 * search, "All settings", then every group (icon + title) under its section heading. No accordion;
 * a group's tiles live in the in-page sub-menu, not here. Lives inside `<aside class="sidebar">`,
 * so it inherits the sidebar's colours and its drawer behaviour on phones.
 */
@Component({
  selector: 'app-settings-nav',
  standalone: true,
  imports: [RouterModule, TranslateModule, SafeHtmlPipe],
  template: `
    <nav class="snav" [attr.aria-label]="'SETTINGS.NAV_LABEL' | translate">
      <div class="snav-head">
        <button #backBtn type="button" class="snav-back" (click)="back()">
          <svg class="flip" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span>{{ 'SETTINGS.BACK' | translate }}</span>
        </button>

        <h2 class="snav-title">{{ 'SETTINGS.TITLE' | translate }}</h2>

        <div class="snav-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" class="snav-input"
                 [value]="query()" (input)="onInput($event)"
                 [placeholder]="'SETTINGS.SEARCH_PLACEHOLDER' | translate"
                 [attr.aria-label]="'SETTINGS.SEARCH_PLACEHOLDER' | translate"/>
          @if (query()) {
            <button type="button" class="snav-clear" (click)="query.set('')"
                    [attr.aria-label]="'SETTINGS.CLEAR_SEARCH' | translate">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          }
        </div>

        @if (query()) {
          <p class="snav-count" role="status" aria-live="polite">
            {{ (matchCount() === 1 ? 'SETTINGS.MATCH_ONE' : 'SETTINGS.MATCH_MANY') | translate: { count: matchCount() } }}
          </p>
        }
      </div>

      <div class="snav-scroll">
        <a class="snav-row" routerLink="/settings"
           [class.active]="mode.isAllSettings()"
           [attr.aria-current]="mode.isAllSettings() ? 'page' : null"
           (click)="mode.activeGroupId.set(null); navigated.emit()">
          <span class="snav-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                 stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </span>
          <span class="snav-label">{{ 'SETTINGS.ALL_SETTINGS' | translate }}</span>
        </a>

        @for (sec of sections(); track sec.key) {
          @if (sec.key) { <h3 class="snav-section">{{ sec.key | translate }}</h3> }
          <ul class="snav-list">
            @for (g of sec.groups; track g.group.id) {
              <li>
                <a class="snav-row"
                   [routerLink]="g.target.link" [queryParams]="g.target.queryParams ?? null"
                   [class.active]="g.group.id === mode.activeGroupId()"
                   [attr.aria-current]="g.group.id === mode.activeGroupId() ? 'page' : null"
                   (click)="mode.choose(g.group.id); navigated.emit()">
                  <span class="snav-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                         stroke-linejoin="round" aria-hidden="true" [innerHTML]="g.group.icon | safeHtml"></svg>
                  </span>
                  <span class="snav-label">{{ g.group.title | translate }}</span>
                  @if (query()) { <span class="snav-badge">{{ g.matches }}</span> }
                </a>
              </li>
            }
          </ul>
        }

        @if (query() && !sections().length) {
          <div class="snav-empty">
            <p>{{ 'SETTINGS.NO_RESULTS' | translate }}</p>
            @if (suggestion(); as s) {
              <p class="snav-hint">
                {{ 'SETTINGS.SEARCH_DID_YOU_MEAN' | translate }}<button type="button" class="snav-hint__link"
                  (click)="query.set(s)">{{ s }}</button>?
              </p>
            }
          </div>
        }
      </div>

      <!-- Zone 3 — pinned footer. Data-driven (SETTINGS_SIDEBAR_FOOTER_ITEMS); renders nothing, not even the hairline, when the list is empty. -->
      @if (footerItems.length) {
        <div class="snav-footer">
          @for (it of footerItems; track it.id) {
            @if (it.link) {
              <a class="snav-frow" [routerLink]="it.link" (click)="navigated.emit()">
                <span class="snav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" [innerHTML]="it.icon | safeHtml"></svg></span>
                <span class="snav-label">{{ it.labelKey | translate }}</span>
                @if (it.trailingText) { <span class="snav-trailing">{{ it.trailingText }}</span> }
              </a>
            } @else {
              <button type="button" class="snav-frow" (click)="it.action?.()">
                <span class="snav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" [innerHTML]="it.icon | safeHtml"></svg></span>
                <span class="snav-label">{{ it.labelKey | translate }}</span>
                @if (it.trailingText) { <span class="snav-trailing">{{ it.trailingText }}</span> }
              </button>
            }
          }
        </div>
      }
    </nav>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; }
    .snav { display: flex; flex-direction: column; flex: 1; min-height: 0; color: var(--text); }

    .snav-head { padding: 12px 12px 8px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .snav-back {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px 6px 6px;
      background: transparent; border: 0; border-radius: 6px; cursor: pointer;
      color: var(--text); font: inherit; font-size: 13px;
    }
    .snav-back:hover { background: var(--bg-hover); color: var(--text-on); }
    .snav-title { margin: 10px 4px 10px; font-size: 16px; font-weight: 700; color: var(--text-on); }

    .snav-search {
      display: flex; align-items: center; gap: 8px; padding: 7px 10px;
      background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12); border-radius: 8px; /* theme-ok: lives in the always-dark sidebar */
      color: var(--text-muted);
    }
    .snav-search:focus-within { border-color: var(--accent); }
    .snav-input {
      flex: 1; min-width: 0; background: transparent; border: 0; outline: 0;
      color: var(--text-on); font: inherit; font-size: 13px;
    }
    .snav-input::placeholder { color: var(--text-muted); }
    .snav-clear {
      display: inline-flex; padding: 3px; background: transparent; border: 0; border-radius: 4px;
      color: var(--text-muted); cursor: pointer;
    }
    .snav-clear:hover { color: var(--text-on); background: var(--bg-hover); }
    .snav-count { margin: 8px 4px 0; font-size: 12px; color: var(--text-muted); }

    .snav-scroll {
      flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 6px 0 12px;
      overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.07) transparent; /* theme-ok: lives in the always-dark sidebar */
    }
    .snav-section {
      margin: 14px 0 4px; padding: 0 16px; font-size: 11px; font-weight: 700;
      letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted);
    }
    .snav-list { list-style: none; margin: 0; padding: 0; }

    .snav-row {
      display: flex; align-items: center; gap: 12px; width: 100%;
      padding: 9px 12px 9px 14px; box-sizing: border-box;
      color: var(--text); text-decoration: none; font-size: 13.5px;
      transition: background .12s, color .12s;
    }
    .snav-row:hover { background: var(--bg-hover); color: var(--text-on); }
    .snav-row.active { background: var(--bg-active); color: var(--text-on); }
    .snav-icon { width: 18px; height: 18px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .snav-icon svg { width: 18px; height: 18px; display: block; }
    .snav-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .snav-badge {
      padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 700;
      background: rgba(50,172,193,.22); color: #7ad3df; /* theme-ok: lives in the always-dark sidebar */
    }

    /* Footer: always visible under the scrolling list (the list is the only zone that scrolls). */
    .snav-footer { flex: 0 0 auto; border-top: 1px solid var(--border); padding: 6px; }
    .snav-frow {
      display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box;
      padding: 8px 10px; border: 0; border-radius: 6px; background: transparent; cursor: pointer;
      color: var(--text); text-decoration: none; font: inherit; font-size: 13px; text-align: start;
    }
    .snav-frow:hover { background: var(--bg-hover); color: var(--text-on); }
    .snav-frow:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    .snav-trailing { margin-inline-start: auto; font-size: 12px; color: var(--text-muted); }
    .snav-empty { padding: 16px; font-size: 13px; color: var(--text-muted); }
    .snav-empty p { margin: 0 0 6px; }
    .snav-hint__link {
      background: none; border: 0; padding: 0; cursor: pointer; font: inherit;
      color: var(--accent); font-weight: 700; font-style: italic;
    }

    .snav-back:focus-visible, .snav-row:focus-visible, .snav-clear:focus-visible, .snav-hint__link:focus-visible {
      outline: 2px solid var(--accent); outline-offset: -2px;
    }

    :host-context([dir='rtl']) .flip { transform: scaleX(-1); }
    :host-context([dir='rtl']) .snav-back { padding: 6px 6px 6px 10px; }

    @media print { :host { display: none !important; } }
  `]
})
export class SettingsNavComponent implements AfterViewInit {
  readonly mode = inject(SettingsModeService);
  /** Rows of the pinned footer zone; empty for now. */
  readonly footerItems = SETTINGS_SIDEBAR_FOOTER_ITEMS;
  private readonly access = inject(SettingsAccessService);
  private readonly search = inject(SettingsSearchService);

  /** Fires after any navigation the menu starts, so the phone drawer can close. */
  readonly navigated = output<void>();

  @ViewChild('backBtn') private backBtn?: ElementRef<HTMLButtonElement>;

  readonly query = signal('');

  constructor() { withTranslations('settings'); }

  /** Groups the user can open, narrowed by the search, each with its landing tile and match count. */
  private readonly navGroups = computed<NavGroup[]>(() => {
    const q = this.query().trim();
    const out: NavGroup[] = [];
    for (const group of this.access.visibleGroups()) {
      const items = this.access.accessibleItems(group);
      const matches = q ? items.filter(i => this.search.matches(i, q)).length : items.length;
      const target = this.access.firstRoutable(group);
      if (matches > 0 && target) out.push({ group, target, matches });
    }
    return out;
  });

  /** The groups bucketed under their section heading, in the order the catalog introduces each section. */
  readonly sections = computed<NavSection[]>(() => {
    const map = new Map<string, NavGroup[]>();
    for (const g of this.navGroups()) {
      const key = g.group.section ?? '';
      (map.get(key) ?? map.set(key, []).get(key)!).push(g);
    }
    return [...map].map(([key, groups]) => ({ key, groups }));
  });

  readonly matchCount = computed(() => this.navGroups().reduce((n, g) => n + g.matches, 0));

  /** "Did you mean …" — only when the search found nothing; same helper as the Settings page. */
  readonly suggestion = computed(() => {
    const q = this.query().trim();
    if (!q || this.navGroups().length) return null;
    const all = this.access.visibleGroups().flatMap(g => this.access.accessibleItems(g));
    return this.search.suggest(q, all);
  });

  ngAfterViewInit(): void {
    // Only when the user just chose to enter settings mode — not on a refresh or deep link, where grabbing focus would be rude.
    if (this.mode.consumeFocusRequest()) this.backBtn?.nativeElement.focus();
  }

  onInput(e: Event): void { this.query.set((e.target as HTMLInputElement).value); }

  back(): void {
    this.mode.back();
    this.navigated.emit();
  }
}
