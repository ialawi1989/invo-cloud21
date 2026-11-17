import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ListCellTemplateDirective, ListRowActionsDirective } from '@shared/components/list-page/directives/list-template.directives';
import type { ListQueryParams, TableColumn } from '@shared/components/list-page/interfaces/list-page.types';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';

import { KitchenSectionService, KitchenSectionSummary } from '../../services/kitchen-section.service';

/**
 * Settings > Kitchen Sections: the kitchen sections in the shared list page (search, sort and paging live in the URL).
 * A row opens the section's editor; "Add kitchen section" opens an empty one.
 */
@Component({
  selector: 'app-kitchen-sections-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, ListPageComponent, ListCellTemplateDirective, ListRowActionsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kitchen-sections-list.component.html',
})
export class KitchenSectionsListComponent {
  private service    = inject(KitchenSectionService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);

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
      { key: 'name', label: this.t('SETTINGS.KITCHEN.NAME'), sortable: true, primary: true, locked: true, customTemplate: true, visible: true, order: 0 },
      { key: 'productCount', label: this.t('SETTINGS.KITCHEN.PRODUCT_COUNT'), customTemplate: true, visible: true, order: 1 },
    ];
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: this.t('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.t('SETTINGS.ITEMS.KITCHEN_SECTION') },
    ] as BreadcrumbItem[];
  });

  readonly paginationConfig = { enabled: true, pageLimits: [20, 50, 100], default: 20 };
  readonly sortingConfig = { enabled: true };
  searchConfig = computed(() => { this.i18nTick(); return { enabled: true, placeholder: this.t('SETTINGS.KITCHEN.SEARCH_PLACEHOLDER'), debounceMs: 500 }; });
  emptyState = computed(() => { this.i18nTick(); return { title: this.t('SETTINGS.KITCHEN.EMPTY'), message: '', icon: 'box' }; });

  load = async (params: ListQueryParams) => {
    const res = await this.service.getList({
      page: params.page,
      limit: params.limit,
      searchTerm: (params.searchTerm || '').trim(),
      sortBy: params.sortBy ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection as 'asc' | 'desc' } : undefined,
    });
    return { list: res.list, count: res.count, pageCount: res.pageCount };
  };

  edit(row: KitchenSectionSummary): void { void this.router.navigate(['/settings/kitchen', row.id]); }
  addNew(): void { void this.router.navigate(['/settings/kitchen', 'new']); }
}
