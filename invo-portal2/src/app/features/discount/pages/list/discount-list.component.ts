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
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import {
  QueryParamsService,
  ParamDef,
  IntCodec,
  intCodec,
  StringCodec,
  enumCodec,
} from '@shared/services/query-params.service';

import { DiscountService } from '../../services/discount.service';
import { Discount } from '../../services/discount.types';

const SORT_FIELDS = ['name', 'type', 'amount'] as const;
const SORT_DIRS = ['asc', 'desc'] as const;
type SortField = typeof SORT_FIELDS[number] | '';
type SortDir   = typeof SORT_DIRS[number] | '';

const QP = {
  page:     { key: 'page',   codec: IntCodec }                              as ParamDef<number>,
  pageSize: { key: 'limit',  codec: intCodec(15) }                          as ParamDef<number>,
  search:   { key: 'q',      codec: StringCodec }                           as ParamDef<string>,
  sortBy:   { key: 'sortBy', codec: enumCodec([...SORT_FIELDS, ''] as const, '') } as ParamDef<SortField>,
  sortDir:  { key: 'dir',    codec: enumCodec([...SORT_DIRS, ''] as const, '') }   as ParamDef<SortDir>,
};

/**
 * Discount list — paginated, searchable table of named discounts.
 * Row click opens the editor (separate route). Same conventions as
 * `<app-surcharge-list>`: signals + OnPush, 300ms debounced search,
 * `<app-dropdown-menu-btn>` for per-row Edit.
 */
@Component({
  selector: 'app-discount-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslateModule,
    LoadingOverlayComponent,
    SkeletonComponent,
    DropdownMenuBtnComponent,
    ListShellComponent,
    MycurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './discount-list.component.html',
  styleUrl:    './discount-list.component.scss',
})
export class DiscountListComponent implements OnInit {
  private service    = inject(DiscountService);
  private translate  = inject(TranslateService);
  private router     = inject(Router);
  private destroyRef = inject(DestroyRef);
  private qp         = inject(QueryParamsService);

  loading = signal<boolean>(false);
  rows    = signal<Discount[]>([]);

  search   = signal<string>('');
  page     = signal<number>(1);
  pageSize = signal<number>(15);
  total    = signal<number>(0);

  /** Sort state — keys match the wire format (`name`, `type`, `amount`).
   *  Click cycles asc → desc → off, matching the legacy table. */
  sortValue     = signal<string | null>(null);
  sortDirection = signal<'asc' | 'desc' | null>(null);

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
      { label: this.translate.instant('SETTINGS.TITLE'),   routerLink: '/settings' },
      { label: this.translate.instant('DISCOUNT.LIST.TITLE') },
    ];
  });

  /** Per-row overflow menu. Just Edit for now — backend doesn't
   *  expose a delete verb, so we don't pretend to. Kept as a
   *  dropdown so future actions can drop in without restructuring. */
  rowMenuItems(row: Discount): DropdownMenuBtnItem[] {
    return [
      { label: 'COMMON.EDIT', click: () => this.edit(row) },
    ];
  }

  constructor() {
    withTranslations('discount');
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
    this.sortValue.set(p.sortBy || null);
    this.sortDirection.set((p.sortDir || null) as 'asc' | 'desc' | null);
    await this.load();
  }

  private syncUrl(): void {
    this.qp.write(QP, {
      page:     this.page(),
      pageSize: this.pageSize(),
      search:   this.search(),
      sortBy:   (this.sortValue() ?? '') as SortField,
      sortDir:  (this.sortDirection() ?? '') as SortDir,
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const sv = this.sortValue();
      const sd = this.sortDirection();
      const res = await this.service.getList({
        page:       this.page(),
        limit:      this.pageSize(),
        searchTerm: this.search().trim(),
        sortBy:     sv && sd ? { sortValue: sv, sortDirection: sd } : undefined,
      });
      this.rows.set(res.list);
      this.total.set(res.count);
    } finally {
      this.loading.set(false);
    }
  }

  /** Cycle the sort state for a column: none → asc → desc → none.
   *  Returns to page 1 on change so the user sees the new order
   *  from the top. */
  toggleSort(value: string): void {
    if (this.sortValue() !== value) {
      this.sortValue.set(value);
      this.sortDirection.set('asc');
    } else {
      const dir = this.sortDirection();
      if (dir === 'asc')       this.sortDirection.set('desc');
      else if (dir === 'desc') { this.sortValue.set(null); this.sortDirection.set(null); }
      else                     this.sortDirection.set('asc');
    }
    this.page.set(1);
    this.syncUrl();
    void this.load();
  }

  sortDirOf(value: string): 'asc' | 'desc' | null {
    return this.sortValue() === value ? this.sortDirection() : null;
  }

  // ─── Search + paging ────────────────────────────────────────────
  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    this.syncUrl();
    void this.load();
  }
  clearSearch(): void { this.search.set(''); this.page.set(1); this.syncUrl(); void this.load(); }
  goPrev(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.syncUrl(); this.load(); } }
  goNext(): void { if (this.page() < this.pageCount()) { this.page.update(p => p + 1); this.syncUrl(); this.load(); } }

  // ─── Row actions ────────────────────────────────────────────────
  edit(row: Discount): void {
    void this.router.navigate(['/settings/discounts', row.id || 'new']);
  }

  add(): void {
    void this.router.navigate(['/settings/discounts', 'new']);
  }

  /** True when this discount is percentage-based — drives a
   *  different format hint in the template (`%` suffix vs the
   *  company currency). */
  isPercent(d: Discount): boolean { return d.percentage; }

  /** Compact human description of the discount's scope. Returns
   *  `"All products · All branches"` when both lists are empty,
   *  otherwise pluralised counts joined by `·`. Translated with
   *  i18n keys so plural rules can be language-specific. */
  scopeLabel(d: Discount): string {
    this.i18nTick();
    const products = d.items.length === 0
      ? this.translate.instant('DISCOUNT.LIST.SCOPE_ALL_PRODUCTS')
      : this.translate.instant('DISCOUNT.LIST.SCOPE_N_PRODUCTS', { count: d.items.length });
    const branches = d.branches.length === 0
      ? this.translate.instant('DISCOUNT.LIST.SCOPE_ALL_BRANCHES')
      : this.translate.instant('DISCOUNT.LIST.SCOPE_N_BRANCHES', { count: d.branches.length });
    return `${products} · ${branches}`;
  }

  /** Format the automatic-discount date window. Returns `null`
   *  when the row is `manual` or doesn't have a start date set,
   *  so the template can hide the chip cleanly. */
  scheduleLabel(d: Discount): string | null {
    if (d.type !== 'automatic' || !d.startDate) return null;
    const start = this.formatDate(d.startDate);
    const end   = d.expireDate ? this.formatDate(d.expireDate) : '∞';
    return `${start} → ${end}`;
  }

  private formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '';
    return new Date(t).toISOString().slice(0, 10);
  }
}
