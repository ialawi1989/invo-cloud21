import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ReportColumn, ReportTable } from '../../models/report.model';

/**
 * Generic renderer for a normalized `ReportTable`. Handles value formatting
 * (currency via `mycurrency`, numbers, percent, date), an optional totals
 * footer, client-side sorting, and RTL-safe alignment. One table for every
 * report — replaces ~90 bespoke tables in the legacy system.
 */
@Component({
  selector: 'app-report-data-table',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe],
  templateUrl: './report-data-table.component.html',
  styleUrl: './report-data-table.component.scss',
})
export class ReportDataTableComponent {
  table = input.required<ReportTable>();

  /** Emits when the user sorts (report-view may push it to the URL/backend). */
  sortChange = output<{ key: string; direction: 'asc' | 'desc' } | null>();

  sortKey = signal<string | null>(null);
  sortDir = signal<'asc' | 'desc'>('asc');

  columns = computed(() => this.table().columns);

  /** Client-side sorted rows (backend sort can override by pre-sorting). */
  rows = computed(() => {
    const key = this.sortKey();
    const rows = this.table().rows;
    if (!key) return rows;
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[key], bv = b[key];
      const an = Number(av), bn = Number(bv);
      const numeric = !isNaN(an) && !isNaN(bn) && av !== '' && bv !== '';
      if (numeric) return (an - bn) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  });

  onSort(col: ReportColumn): void {
    if (this.sortKey() === col.key) {
      if (this.sortDir() === 'asc') {
        this.sortDir.set('desc');
      } else {
        this.sortKey.set(null); // third click clears
        this.sortChange.emit(null);
        return;
      }
    } else {
      this.sortKey.set(col.key);
      this.sortDir.set('asc');
    }
    this.sortChange.emit({ key: col.key, direction: this.sortDir() });
  }

  cellValue(row: Record<string, any>, col: ReportColumn): any {
    return row[col.key];
  }

  isEmpty = computed(() => this.table().rows.length === 0);
}
