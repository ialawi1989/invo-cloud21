import { ChangeDetectionStrategy, Component, DestroyRef, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import type { ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';

import { BranchSettingsService, BranchSummary } from '../../services/branch-settings.service';

/**
 * Settings > Branch Settings (`/settings/branches`): the company's branches in the shared list page (search, sort and
 * paging live in the URL). A row opens the branch form; the row's "Set as default" button sets the default branch of the storefront.
 * Branches are created in a separate flow, so there is no Add button here.
 */
@Component({
  selector: 'app-branches-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './branches-list.component.html',
})
export class BranchesListComponent {
  private service    = inject(BranchSettingsService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  private i18nTick = signal(0);

  constructor() {
    withTranslations('settings');
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.i18nTick.update(n => n + 1));
  }

  private t = (k: string) => this.translate.instant(k);

  columns = computed<TableColumn[]>(() => {
    this.i18nTick();
    return [
      { key: 'name', label: this.t('SETTINGS.BRANCHES.NAME'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'phoneNumber', label: this.t('SETTINGS.BRANCHES.PHONE'), customTemplate: true, visible: true, order: 1 },
      { key: 'address', label: this.t('SETTINGS.BRANCHES.ADDRESS'), customTemplate: true, visible: true, order: 2 },
    ];
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: this.t('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.t('SETTINGS.ITEMS.BRANCH_SETTINGS') },
    ] as BreadcrumbItem[];
  });

  readonly paginationConfig = { enabled: true, pageLimits: [20, 50, 100], default: 20 };
  readonly sortingConfig = { enabled: true };
  searchConfig = computed(() => { this.i18nTick(); return { enabled: true, placeholder: this.t('SETTINGS.BRANCHES.SEARCH_PLACEHOLDER'), debounceMs: 500 }; });
  emptyState = computed(() => { this.i18nTick(); return { title: this.t('SETTINGS.BRANCHES.EMPTY'), message: '', icon: 'box' }; });

  load = async (params: ListQueryParams) => {
    const res = await this.service.getList({
      page: params.page,
      limit: params.limit,
      searchTerm: (params.searchTerm || '').trim(),
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection } : undefined,
    });
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  edit(b: BranchSummary): void { void this.router.navigate(['/settings/branches', b.id]); }

  async setDefault(b: BranchSummary): Promise<void> {
    const res = await this.service.setDefault(b.id);
    if (res?.success) this.listPage?.refresh();
  }
}
