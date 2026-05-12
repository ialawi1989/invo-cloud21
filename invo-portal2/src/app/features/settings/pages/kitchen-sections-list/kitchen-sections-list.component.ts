import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import {
  QueryParamsService,
  ParamDef,
  IntCodec,
  intCodec,
  StringCodec,
} from '@shared/services/query-params.service';

import {
  KitchenSectionService,
  KitchenSectionSummary,
} from '../../services/kitchen-section.service';

const QP = {
  page:     { key: 'page',  codec: IntCodec }     as ParamDef<number>,
  pageSize: { key: 'limit', codec: intCodec(20) } as ParamDef<number>,
  search:   { key: 'q',     codec: StringCodec }  as ParamDef<string>,
};

/**
 * Settings → Kitchen Sections (list)
 *
 * Searchable / paginated table of kitchen sections. Header has
 * breadcrumbs + page title + "Add new" button (matches the
 * `kitchenSectionSecurity.actions.add` privilege). Row click opens
 * the editor for that section.
 */
@Component({
  selector: 'app-kitchen-sections-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, ListShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kitchen-sections-list.component.html',
  styleUrl: './kitchen-sections-list.component.scss',
})
export class KitchenSectionsListComponent implements OnInit {
  private service    = inject(KitchenSectionService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);
  private qp         = inject(QueryParamsService);

  loading  = signal<boolean>(false);
  rows     = signal<KitchenSectionSummary[]>([]);
  total    = signal<number>(0);

  // Search + paging.
  search   = signal<string>('');
  page     = signal<number>(1);
  pageSize = signal<number>(20);

  /** Re-translate labels after ngx-translate finishes loading. */
  private i18nTick = signal(0);

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('SETTINGS.ITEMS.KITCHEN_SECTION') },
    ];
  });

  pageCount = computed<number>(() => {
    const total = this.total();
    const limit = this.pageSize();
    return total > 0 ? Math.ceil(total / limit) : 1;
  });

  rangeLabel = computed<string>(() => {
    this.i18nTick();
    const total = this.total();
    if (total === 0) return '';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end   = Math.min(this.page() * this.pageSize(), total);
    return this.translate.instant('COMMON.PAGINATION_RANGE', { start, end, total });
  });

  constructor() {
    withTranslations('settings');
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    const p = this.qp.read(QP);
    this.page.set(p.page);
    this.pageSize.set(p.pageSize);
    this.search.set(p.search);
    await this.load();
  }

  private syncUrl(): void {
    this.qp.write(QP, {
      page:     this.page(),
      pageSize: this.pageSize(),
      search:   this.search(),
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.service.getList({
        page:       this.page(),
        limit:      this.pageSize(),
        searchTerm: this.search().trim(),
      });
      this.rows.set(res.list);
      this.total.set(res.count);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Search + paging ───────────────────────────────────────────────────
  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    this.syncUrl();
    void this.load();
  }

  clearSearch(): void {
    this.search.set('');
    this.page.set(1);
    this.syncUrl();
    void this.load();
  }

  goPrev(): void {
    if (this.page() <= 1) return;
    this.page.update((p) => p - 1);
    this.syncUrl();
    this.load();
  }

  goNext(): void {
    if (this.page() >= this.pageCount()) return;
    this.page.update((p) => p + 1);
    this.syncUrl();
    this.load();
  }

  // ─── Navigation ────────────────────────────────────────────────────────
  edit(row: KitchenSectionSummary): void {
    this.router.navigate(['/settings/kitchen', row.id]);
  }

  addNew(): void {
    this.router.navigate(['/settings/kitchen', 'new']);
  }
}
