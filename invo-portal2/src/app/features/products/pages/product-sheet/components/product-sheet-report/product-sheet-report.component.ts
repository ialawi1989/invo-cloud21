import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import {
  ProductSheetReport,
  RowReport,
  RowStatus,
  WillCreate,
} from '../../../../models/product-sheet/product-sheet.types';

type RowFilter = 'all' | RowStatus | 'warnings';

const PAGE_SIZE = 50;

/**
 * Report of a product spreadsheet import — a preview (what would happen) or a
 * finished run (what did). Same shape either way, apart from `willCreate`
 * becoming `created`. Port of legacy `product-sheet-report`.
 */
@Component({
  selector: 'app-product-sheet-report',
  standalone: true,
  imports: [FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-sheet-report.component.html',
})
export class ProductSheetReportComponent {
  report = input.required<ProductSheetReport>();
  mode = input<'preview' | 'result'>('preview');

  readonly filters: RowFilter[] = ['all', 'created', 'updated', 'unchanged', 'skipped', 'failed', 'warnings'];
  readonly pageSize = PAGE_SIZE;

  filter = signal<RowFilter>('all');
  search = signal('');
  page = signal(1);
  private userPicked = false;

  counts = computed<Record<RowFilter, number>>(() => {
    const rows = this.report()?.rows ?? [];
    const c: Record<RowFilter, number> = { all: rows.length, created: 0, updated: 0, unchanged: 0, skipped: 0, failed: 0, warnings: 0 };
    rows.forEach(row => {
      c[row.status] = (c[row.status] ?? 0) + 1;
      if (row.warnings?.length) c.warnings++;
    });
    return c;
  });

  /** Things the import creates besides products, as kind → names. */
  creations = computed(() =>
    describeCreations(this.mode() === 'result' ? this.report()?.created : this.report()?.willCreate));

  clears = computed(() =>
    Object.entries(this.report()?.clears ?? {})
      .filter(([, count]) => count > 0)
      .map(([column, count]) => ({ column, count })));

  filteredRows = computed<RowReport[]>(() => {
    const query = this.search().trim().toLowerCase();
    const f = this.filter();
    return (this.report()?.rows ?? []).filter(row => {
      if (f === 'warnings' ? !row.warnings?.length : f !== 'all' && row.status !== f) return false;
      return !query
        || String(row.row) === query
        || (row.barcode ?? '').toLowerCase().includes(query)
        || (row.name ?? '').toLowerCase().includes(query);
    });
  });

  pagedRows = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filteredRows().slice(start, start + PAGE_SIZE);
  });

  pageCount = computed(() => Math.max(1, Math.ceil(this.filteredRows().length / PAGE_SIZE)));

  constructor() {
    // Problems first: a preview with rejected rows is what needs reading. Only
    // until the user picks a filter; a re-run must not undo their choice.
    effect(() => {
      const c = this.counts();
      if (!this.userPicked && (c.skipped || c.failed)) {
        this.filter.set(c.skipped ? 'skipped' : 'failed');
      } else if (this.filter() !== 'all' && !c[this.filter()]) {
        this.filter.set('all');
      }
      this.page.set(1);
    });
  }

  setFilter(f: RowFilter): void {
    this.userPicked = true;
    this.filter.set(f);
    this.page.set(1);
  }

  onSearch(v: string): void {
    this.search.set(v);
    this.page.set(1);
  }

  changesOf(row: RowReport): { column: string; old: string; new: string }[] {
    return Object.entries(row.changes ?? {}).map(([column, change]) => ({
      column, old: formatValue(change?.old), new: formatValue(change?.new),
    }));
  }

  statusClass(status: RowStatus): string {
    return {
      created:   'bg-emerald-50 text-emerald-700',
      updated:   'bg-brand-50 text-brand-700',
      unchanged: 'bg-slate-100 text-slate-500',
      skipped:   'bg-amber-50 text-amber-700',
      failed:    'bg-red-50 text-red-700',
    }[status] ?? 'bg-slate-100';
  }

  filterLabel(f: RowFilter): string {
    return f === 'all' ? 'PRODUCTS.PRODUCT_SHEET.FILTER_ALL'
      : f === 'warnings' ? 'PRODUCTS.PRODUCT_SHEET.FILTER_WARNINGS'
      : 'PRODUCTS.PRODUCT_SHEET.STATUS.' + f;
  }
}

function describeCreations(source: WillCreate | undefined): { kind: string; names: string[] }[] {
  if (!source) return [];
  return Object.entries(source)
    .filter(([, list]) => Array.isArray(list) && list.length)
    .map(([kind, list]) => ({
      kind,
      names: (list as any[]).map(item =>
        typeof item === 'string' ? item : item?.branch ? `${item.name} (${item.branch})` : item?.name ?? String(item)),
    }));
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join('; ') : '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
