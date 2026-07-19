import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import type { DateRange } from '@shared/components/datepicker/date-picker.types';
import { MODAL_DATA } from '@shared/modal/modal.tokens';
import { LogEntry, LogsService } from '@shared/services/logs.service';

export interface LogsDrawerData {
  /** Entity key(s) the backend logs under, e.g. 'MenuRecipe'. */
  sourceTable: string | string[];
  /** Narrow to a single record. */
  sourceId?: string;
  /** Drawer heading; defaults to a generic "Activity log". */
  title?: string;
}

/** Coarse action classes, used only for the badge colour + icon. */
type ActionKind = 'create' | 'edit' | 'delete' | 'other';

const PAGE_SIZE = 15;

/**
 * Activity-log drawer. Open through `ModalService` with `drawer: true` and a
 * `LogsDrawerData` payload — every list page that wants a "Show logs" action
 * uses this one component; only the `sourceTable` key differs.
 *
 * Scope note: search + date range are supported. The legacy panel also had
 * branch and employee multi-selects; those aren't ported yet, and the service
 * already accepts `branchId` / `employeeId` for when they are.
 */
@Component({
  selector: 'app-logs-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DatePipe, DatePickerComponent],
  templateUrl: './logs-drawer.component.html',
  styleUrl: './logs-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogsDrawerComponent implements OnInit, AfterViewInit, OnDestroy {
  private service = inject(LogsService);
  data = inject<LogsDrawerData>(MODAL_DATA);

  logs = signal<LogEntry[]>([]);
  loading = signal(false);
  loadingMore = signal(false);
  hasNext = signal(false);
  showFilters = signal(false);

  search = signal('');
  /** Bound to the range picker; `dateFrom`/`dateTo` are its wire form. */
  dateRange = signal<DateRange | null>(null);
  dateFrom = signal('');
  dateTo = signal('');

  private page = signal(1);
  private debounce?: ReturnType<typeof setTimeout>;

  readonly activeFilterCount = computed(
    () => [this.search(), this.dateFrom(), this.dateTo()].filter(Boolean).length,
  );

  private readonly sourceTable =
    Array.isArray(this.data.sourceTable) ? this.data.sourceTable : [this.data.sourceTable];

  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    void this.load(1);
  }

  ngAfterViewInit(): void {
    const sentinel = this.scrollSentinel();
    if (!sentinel) return;
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && this.hasNext() && !this.loading() && !this.loadingMore()) {
        void this.load(this.page() + 1);
      }
    });
    this.observer.observe(sentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    clearTimeout(this.debounce);
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  toggleFilters(): void { this.showFilters.update((v) => !v); }

  onSearch(v: string): void {
    this.search.set(v);
    // Debounced — the legacy panel refetched on every keystroke.
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.load(1), 350);
  }

  onDateRange(range: DateRange | null): void {
    this.dateRange.set(range);
    this.dateFrom.set(toWireDate(range?.start));
    this.dateTo.set(toWireDate(range?.end));
    void this.load(1);
  }

  clearFilters(): void {
    this.search.set('');
    this.dateRange.set(null);
    this.dateFrom.set('');
    this.dateTo.set('');
    void this.load(1);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  private async load(page: number): Promise<void> {
    const first = page === 1;
    if (first) this.loading.set(true);
    else this.loadingMore.set(true);
    try {
      const res = await this.service.getLogs({
        page,
        limit: PAGE_SIZE,
        sourceTable: this.sourceTable,
        sourceId: this.data.sourceId,
        searchTerm: this.search(),
        dateFrom: this.dateFrom(),
        dateTo: this.dateTo(),
      });
      this.logs.set(first ? res.list : [...this.logs(), ...res.list]);
      this.hasNext.set(res.hasNext);
      this.page.set(page);
    } catch {
      // Keep what's already on screen; stop paging so the observer doesn't spin.
      this.hasNext.set(false);
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
  }

  // ── Presentation ──────────────────────────────────────────────────────────
  actionKind(entry: LogEntry): ActionKind {
    const a = (entry.action || '').toLowerCase();
    if (a.includes('delete') || a.includes('cancel') || a.includes('void')) return 'delete';
    if (a.includes('create') || a.includes('add') || a.includes('new')) return 'create';
    if (a.includes('edit') || a.includes('change') || a.includes('update')) return 'edit';
    return 'other';
  }

  /**
   * Flattens `meta` into label/value pairs for display. Drops ids, booleans and
   * empties — they're plumbing, not something a reader of the log needs.
   */
  metaRows(entry: LogEntry): { label: string; value: string }[] {
    const meta = entry.meta;
    if (!meta) return [];
    return Object.entries(meta)
      .filter(([k, v]) =>
        !/id$/i.test(k) &&
        !k.toLowerCase().includes('id') &&
        typeof v !== 'boolean' &&
        v !== null && v !== undefined && v !== '' &&
        typeof v !== 'object')
      .map(([k, v]) => ({ label: humanizeKey(k), value: String(v) }));
  }

  trackLog = (i: number, l: LogEntry) => `${l.createdAt}-${l.sourceId}-${i}`;
}

/** The endpoint wants plain `YYYY-MM-DD`, in local time — not an ISO instant,
 *  which would shift the day across timezones. */
function toWireDate(d: Date | null | undefined): string {
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `oldPrice` / `old_price` → `Old price`. */
function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
