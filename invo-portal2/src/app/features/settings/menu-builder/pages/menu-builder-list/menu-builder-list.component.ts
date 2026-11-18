import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ModalService } from '@shared/modal/modal.service';
import { UserPreferencesService } from '@core/preferences/user-preferences.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListMobileChipDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import type { ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';

import { MenuBuilderService } from '../../services/menu-builder.service';
import { MenuListItem, MenuStatus } from '../../services/menu-builder.types';
import { ArrangeMenusModalComponent } from '../../components/arrange-menus-modal/arrange-menus-modal.component';
import { MenuStatusBadgeComponent } from '../../components/menu-status-badge/menu-status-badge.component';
import { MenuStatusFilterComponent } from '../../components/menu-status-filter/menu-status-filter.component';
import { HoursView, formatHours } from '../../utils/menu-hours';

/**
 * Menu Builder list, on the shared list page (search and paging live in the URL).
 * A row opens the full-page builder; "Add menu" opens an empty one.
 */
@Component({
  selector: 'app-menu-builder-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective, ListMobileChipDirective, MenuStatusBadgeComponent, MenuStatusFilterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-builder-list.component.html',
})
export class MenuBuilderListComponent {
  private service    = inject(MenuBuilderService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private prefs      = inject(UserPreferencesService);
  private modal      = inject(ModalService);
  private listPage   = viewChild(ListPageComponent);

  /** The selected tab (null = All). Mirrors the `status` URL param. */
  status = signal<MenuStatus | null>(this.readStatus(this.route.snapshot.queryParamMap.get('status')));
  private lastPageParam = this.route.snapshot.queryParamMap.get('page');

  private i18nTick = signal(0);

  use12h = computed(() => this.prefs.timePattern().includes('a'));
  locale = computed(() => { this.i18nTick(); return this.translate.currentLang || 'en'; });

  constructor() {
    withTranslations('settings/menu-builder');
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));

    // Follow the address bar (back / forward, a pasted link). Subscribed before the list page, so `status` is already
    // current when the list page reloads for the same navigation.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q) => {
      const next = this.readStatus(q.get('status'));
      const page = q.get('page');
      const pageMoved = page !== this.lastPageParam;
      this.lastPageParam = page;
      if (next === this.status()) return;
      this.status.set(next);
      // When the page number changed too, the list page reloads by itself; otherwise reload here.
      if (!pageMoved) queueMicrotask(() => this.listPage()?.refresh());
    });
  }

  private readStatus(v: string | null): MenuStatus | null {
    const up = String(v ?? '').toUpperCase();
    return up === 'ACTIVE' || up === 'SCHEDULED' || up === 'ENDED' ? (up as MenuStatus) : null;
  }

  /** Picking a tab writes it to the URL; `page: null` drops the page, so a new filter starts on page 1. */
  setStatus(next: MenuStatus | null): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { status: next ? next.toLowerCase() : null, page: null }, queryParamsHandling: 'merge' });
  }

  private t = (k: string) => this.translate.instant(k);

  columns = computed<TableColumn[]>(() => {
    this.i18nTick();
    return [
      { key: 'name', label: this.t('MENU_BUILDER.NAME'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'status', label: this.t('MENU_BUILDER.STATUS.COLUMN'), customTemplate: true, visible: true, order: 1 },
      { key: 'hours', label: this.t('MENU_BUILDER.HOURS'), sortable: true, customTemplate: true, visible: true, order: 2 },
      { key: 'availableOnline', label: this.t('MENU_BUILDER.ONLINE'), sortable: true, customTemplate: true, visible: true, order: 3 },
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
  // No default sort here: with none chosen the service asks for the saved priority order (`index`).
  readonly sortingConfig = { enabled: true };
  /** Table column -> database column (the Hours column sorts by its start time). */
  private static readonly SORT_COLUMN: Record<string, string> = { name: 'name', hours: 'startAt', availableOnline: 'availableOnline' };
  searchConfig = computed(() => { this.i18nTick(); return { enabled: true, placeholder: this.t('MENU_BUILDER.SEARCH_PLACEHOLDER'), debounceMs: 500 }; });
  emptyState = computed(() => { this.i18nTick(); return { title: this.t('MENU_BUILDER.EMPTY'), message: '', icon: 'box' }; });

  load = async (params: ListQueryParams) => {
    const col = params.sortBy ? MenuBuilderListComponent.SORT_COLUMN[params.sortBy.sortValue] : undefined;
    const res = await this.service.getList({
      page: params.page, limit: params.limit, search: (params.searchTerm || '').trim(),
      sortBy: col && params.sortBy ? { sortValue: col, sortDirection: params.sortBy.sortDirection } : undefined,
      status: this.status() ? [this.status()!] : undefined,
    });
    return { list: res.list, count: res.total, pageCount: Math.max(1, Math.ceil(res.total / (params.limit || 20))) };
  };

  hours(m: MenuListItem): HoursView { return formatHours(m, { use12h: this.use12h(), locale: this.locale() }); }

  /** Menu priority (the legacy "Arrange"): drag the menus into order; the list reloads once it is saved. */
  async arrange(): Promise<void> {
    const ref = this.modal.open<ArrangeMenusModalComponent, undefined, boolean>(ArrangeMenusModalComponent, { size: 'md' });
    if (await ref.afterClosed()) this.listPage()?.refresh();
  }

  edit(row: MenuListItem): void { void this.router.navigate(['/settings/menu-builder', row.id]); }
  addNew(): void { void this.router.navigate(['/settings/menu-builder', 'new']); }

  // Delete intentionally not wired: the backend exposes no `deleteMenu` route yet.
}
