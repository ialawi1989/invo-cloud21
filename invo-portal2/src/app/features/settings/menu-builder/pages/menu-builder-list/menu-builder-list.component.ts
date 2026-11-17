import { ChangeDetectionStrategy, Component, DestroyRef, ViewEncapsulation, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { UserPreferencesService } from '@core/preferences/user-preferences.service';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListMobileChipDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import type { ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';

import { MenuBuilderService } from '../../services/menu-builder.service';
import { MENU_STATUSES, MenuListItem, MenuStatus, MenuStatusCounts, MenuSummary } from '../../services/menu-builder.types';
import { MenuStatusBadgeComponent } from '../../components/menu-status-badge/menu-status-badge.component';
import { MenuStatusFilterComponent } from '../../components/menu-status-filter/menu-status-filter.component';
import { MenuStatusSummaryComponent } from '../../components/menu-status-summary/menu-status-summary.component';
import { HoursView, formatHours } from '../../utils/menu-hours';
import { nextRefreshDelay } from '../../utils/menu-refresh';

const FALLBACK_REFRESH_MS = 60_000;

/**
 * Menu Builder list, on the shared list page. Besides name / hours / sections it shows each menu's LIVE status
 * (computed by the backend in the branch's time zone): a badge per row, filter chips with counts (kept in the URL as `status`),
 * and a strip naming the menus that are active now. The statuses are kept fresh by a timer set for the next start/end,
 * with a 60 s fallback, paused while the tab is hidden.
 */
@Component({
  selector: 'app-menu-builder-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, TranslateModule, TooltipDirective, ListPageComponent,
    ListCellTemplateDirective, ListRowActionsDirective, ListMobileChipDirective,
    MenuStatusBadgeComponent, MenuStatusFilterComponent, MenuStatusSummaryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './menu-builder-list.component.html',
  styleUrl: './menu-builder-list.component.scss',
})
export class MenuBuilderListComponent {
  private service    = inject(MenuBuilderService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private prefs      = inject(UserPreferencesService);

  private listPage = viewChild(ListPageComponent);
  private i18nTick = signal(0);

  // ── Status state ──
  /** Selected chip (null = All). Mirrors the `status` URL param. */
  status = signal<MenuStatus | null>(this.readStatus(this.route.snapshot.queryParamMap.get('status')));
  counts = signal<MenuStatusCounts>({ ACTIVE: 0, SCHEDULED: 0, ENDED: 0, DISABLED: 0 });
  summary = signal<MenuSummary | null>(null);
  timeZone = signal('');
  loaded = signal(false);
  /** Total menus under the current search (all statuses): "2 of 41". */
  totalMenus = computed(() => MENU_STATUSES.reduce((n, s) => n + this.counts()[s], 0));

  use12h = computed(() => this.prefs.timePattern().includes('a'));
  locale = computed(() => { this.i18nTick(); return this.translate.currentLang || 'en'; });

  private timer: ReturnType<typeof setTimeout> | null = null;
  private hiddenWhileDue = false;
  private lastPageParam = this.route.snapshot.queryParamMap.get('page');
  private pendingScrollId: string | null = null;

  constructor() {
    withTranslations('settings/menu-builder');
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));

    // Follow the address bar (back/forward, pasted link). Subscribed BEFORE the list page, so `status` is already
    // current when the list page reloads for the same navigation.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(q => {
      const next = this.readStatus(q.get('status'));
      const page = q.get('page');
      const pageMoved = page !== this.lastPageParam;
      this.lastPageParam = page;
      if (next === this.status()) return;
      this.status.set(next);
      // When the page number also changed the list page reloads by itself; otherwise reload here.
      if (!pageMoved) queueMicrotask(() => this.listPage()?.refresh());
    });

    const onVisible = () => {
      if (document.visibilityState === 'visible' && this.hiddenWhileDue) {
        this.hiddenWhileDue = false;
        this.listPage()?.refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
      this.clearTimer();
    });
  }

  private readStatus(v: string | null): MenuStatus | null {
    const up = String(v ?? '').toUpperCase();
    return (MENU_STATUSES as readonly string[]).includes(up) ? (up as MenuStatus) : null;
  }

  private t = (k: string) => this.translate.instant(k);

  columns = computed<TableColumn[]>(() => {
    this.i18nTick();
    return [
      { key: 'name', label: this.t('MENU_BUILDER.NAME'), primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'status', label: this.t('MENU_BUILDER.STATUS.COLUMN'), customTemplate: true, visible: true, order: 1 },
      { key: 'hours', label: this.t('MENU_BUILDER.HOURS'), customTemplate: true, visible: true, order: 2 },
      { key: 'sectionsCount', label: this.t('MENU_BUILDER.SECTIONS'), customTemplate: true, visible: true, order: 3 },
    ];
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: this.t('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.t('MENU_BUILDER.TITLE') },
    ] as BreadcrumbItem[];
  });

  readonly paginationConfig = { enabled: true, pageLimits: [20, 50, 100], default: 20 };
  readonly sortingConfig = { enabled: false };
  searchConfig = computed(() => { this.i18nTick(); return { enabled: true, placeholder: this.t('MENU_BUILDER.SEARCH_PLACEHOLDER'), debounceMs: 500 }; });
  emptyState = computed(() => {
    this.i18nTick();
    return { title: this.t(this.status() ? 'MENU_BUILDER.STATUS.EMPTY_FILTER' : 'MENU_BUILDER.EMPTY'), message: '', icon: 'box' };
  });

  rowClass = (row: MenuListItem) => (row.status === 'ACTIVE' ? 'menu-row--active' : '');

  load = async (params: ListQueryParams) => {
    const status = this.status();
    const [res, sum] = await Promise.all([
      this.service.getList({ page: params.page, limit: params.limit, search: (params.searchTerm || '').trim(), status: status ? [status] : undefined, sort: 'status' }),
      this.service.getSummary().catch(() => null), // the strip is secondary: a failure must not blank the list
    ]);
    this.counts.set(res.statusCounts);
    this.summary.set(sum);
    this.timeZone.set(res.branchTimeZone || sum?.branchTimeZone || '');
    this.loaded.set(true);
    this.scheduleRefresh(sum?.nextChangeAt ?? this.earliestChange(res.list), res.serverNow);
    if (this.pendingScrollId) { const id = this.pendingScrollId; this.pendingScrollId = null; setTimeout(() => this.scrollToMenu(id), 0); }
    return { list: res.list, count: res.total, pageCount: Math.max(1, Math.ceil(res.total / (params.limit || 20))) };
  };

  private earliestChange(list: MenuListItem[]): string | null {
    return list.map(m => m.nextChangeAt).filter((x): x is string => !!x).sort()[0] ?? null;
  }

  // ── Keeping statuses fresh ──
  /** Re-ask the server just after the next start/end, and at the latest in 60 s. */
  private scheduleRefresh(nextChangeAt: string | null, serverNow: string): void {
    this.clearTimer();
    const delay = nextRefreshDelay({ nextChangeAt, serverNow, clientNow: Date.now(), fallbackMs: FALLBACK_REFRESH_MS });
    this.timer = setTimeout(() => {
      this.timer = null;
      if (document.visibilityState === 'hidden') { this.hiddenWhileDue = true; return; } // paused: refetch when the tab is back
      this.listPage()?.refresh();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // ── Chips / strip ──
  setStatus(next: MenuStatus | null): void {
    // `page: null` drops it from the URL, so a new filter always starts at page 1.
    void this.router.navigate([], { relativeTo: this.route, queryParams: { status: next ? next.toLowerCase() : null, page: null }, queryParamsHandling: 'merge' });
  }

  showMenu(id: string): void {
    if (this.scrollToMenu(id)) return;
    // Not on this page: show the active ones and scroll once they have loaded.
    this.pendingScrollId = id;
    this.setStatus('ACTIVE');
  }

  private scrollToMenu(id: string): boolean {
    const el = document.querySelector<HTMLElement>(`[data-menu-id="${CSS.escape(id)}"]`);
    if (!el) return false;
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    const row = el.closest('tr') ?? el;
    row.classList.add('menu-row--flash');
    setTimeout(() => row.classList.remove('menu-row--flash'), 1600);
    return true;
  }

  // ── Row helpers ──
  hours(m: MenuListItem): HoursView { return formatHours(m, { use12h: this.use12h(), locale: this.locale() }); }

  overlapText(m: MenuListItem): string {
    return this.translate.instant('MENU_BUILDER.STATUS.OVERLAP', { names: m.overlapsWith.map(o => o.name).join(', ') });
  }

  edit(row: MenuListItem): void { void this.router.navigate(['/settings/menu-builder', row.id]); }
  addNew(): void { void this.router.navigate(['/settings/menu-builder', 'new']); }

  // Delete intentionally not wired: the backend exposes no `deleteMenu` route yet.
}
