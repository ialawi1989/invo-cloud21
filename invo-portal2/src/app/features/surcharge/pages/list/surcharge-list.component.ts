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
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import {
  QueryParamsService,
  ParamDef,
  IntCodec,
  intCodec,
  StringCodec,
} from '@shared/services/query-params.service';

import { SurchargeService } from '../../services/surcharge.service';
import { Surcharge } from '../../services/surcharge.types';

const QP = {
  page:     { key: 'page',  codec: IntCodec }       as ParamDef<number>,
  pageSize: { key: 'limit', codec: intCodec(15) }   as ParamDef<number>,
  search:   { key: 'q',     codec: StringCodec }    as ParamDef<string>,
};

/**
 * Surcharge list — paginated, searchable table of named surcharges.
 * Each row is a surcharge that gets applied to invoices/receipts;
 * row click opens the editor (separate route).
 *
 * Same conventions as price-label-list — signals + OnPush, 300ms-
 * debounced server-side search, `<app-dropdown-menu-btn>` for
 * per-row Edit / Delete, ConfirmModal-driven destructive actions,
 * Toast on save/delete result.
 */
@Component({
  selector: 'app-surcharge-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    BreadcrumbsComponent,
    LoadingOverlayComponent,
    SkeletonComponent,
    DropdownMenuBtnComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './surcharge-list.component.html',
  styleUrl:    './surcharge-list.component.scss',
})
export class SurchargeListComponent implements OnInit {
  private service    = inject(SurchargeService);
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);
  private qp         = inject(QueryParamsService);

  loading = signal<boolean>(false);
  rows    = signal<Surcharge[]>([]);

  search   = signal<string>('');
  page     = signal<number>(1);
  pageSize = signal<number>(15);
  total    = signal<number>(0);

  private searchDebounce?: ReturnType<typeof setTimeout>;
  private i18nTick = signal(0);

  pageCount = computed<number>(() => {
    const t = this.total();
    const lim = this.pageSize();
    return t > 0 ? Math.ceil(t / lim) : 1;
  });

  rangeLabel = computed<string>(() => {
    this.i18nTick();
    const t = this.total();
    if (t === 0) return '';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end   = Math.min(this.page() * this.pageSize(), t);
    return this.translate.instant('COMMON.PAGINATION_RANGE', { start, end, total: t });
  });

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('SETTINGS.TITLE'),    routerLink: '/settings' },
      { label: this.translate.instant('SURCHARGE.LIST.TITLE') },
    ];
  });

  /** Items rendered in each row's `…` overflow menu. Backend
   *  doesn't support deleting surcharges, so the menu is just
   *  Edit for now — kept as a dropdown rather than a single icon
   *  button so future actions (Duplicate, Set default, etc.) can
   *  drop in without restructuring the row chrome. */
  rowMenuItems(row: Surcharge): DropdownMenuBtnItem[] {
    return [
      { label: 'COMMON.EDIT', click: () => this.edit(row) },
    ];
  }

  constructor() {
    withTranslations('surcharge');
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
    this.translate.onTranslationChange.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update(n => n + 1));
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

  // ─── Search + paging ────────────────────────────────────────────
  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.page.set(1);
      this.syncUrl();
      this.load();
    }, 300);
  }
  clearSearch(): void { this.search.set(''); this.page.set(1); this.syncUrl(); this.load(); }
  goPrev(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.syncUrl(); this.load(); } }
  goNext(): void { if (this.page() < this.pageCount()) { this.page.update(p => p + 1); this.syncUrl(); this.load(); } }

  // ─── Row actions ────────────────────────────────────────────────
  edit(row: Surcharge): void {
    void this.router.navigate(['/settings/surcharge', row.id || 'new']);
  }

  add(): void {
    void this.router.navigate(['/settings/surcharge', 'new']);
  }

  /** Format the amount cell — appends `%` when the surcharge is a
   *  percentage, otherwise renders as the company currency. */
  formatAmount(s: Surcharge): string {
    if (s.percentage) return `${s.amount}%`;
    // Match other lists' currency formatting (3 decimals BHD).
    return `BHD ${s.amount.toFixed(3)}`;
  }
}
