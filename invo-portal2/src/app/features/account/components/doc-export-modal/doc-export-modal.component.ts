import '../../account-i18n';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as XLSX from 'xlsx';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { DateRange } from '@shared/components/datepicker/date-picker.types';
import { ToastService } from '@shared/components/toast/toast.service';

export interface DocExportFilter { status: string[]; fromDate: string | null; toDate: string | null; }

export interface DocExportData {
  /** The document's plural name, already translated ("Invoices") — spliced into the dialog's texts. */
  moduleLabel: string;
  /** Status values the picker offers (besides "All") with their labels; leave out for documents without a status. */
  statuses?: { value: string; label: string }[];
  /** Pre-selected status (the rail's current filter). */
  status?: string | null;
  /** File / sheet name stem: `<fileStem>-<date>.<ext>`. */
  fileStem: string;
  /** One page of the document's own list endpoint for the chosen filter. */
  fetchPage: (filter: DocExportFilter, page: number, limit: number) => Promise<{ list?: any[]; pageCount?: number } | null | undefined>;
  /** A list record → one export row (headers already translated). Customer columns belong behind `ctx.pii`; money goes through `ctx.amount`. */
  toRow: (record: any, ctx: { pii: boolean; amount: (n: unknown) => string | number }) => Record<string, string | number>;
}

type ExportFormat = 'csv' | 'xls' | 'xlsx';
interface Option { value: string | null; label: string; }

const DECIMALS: Option[] = [
  { value: 'plain', label: '1234567.89' },
  { value: 'comma-dot', label: '1,234,567.89' },
  { value: 'dot-comma', label: '1.234.567,89' },
];
const PAGE_LIMIT = 999;
const MAX_ROWS = 25000;

const ymd = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null);

/**
 * "Export <documents>" — optional status + date range, decimal format and file format (CSV / XLS / XLSX), shared by every
 * sales document. Rows come from the document's own list endpoint, paged until everything matching is loaded (up to 25,000).
 * Customer columns are left out unless "Include sensitive personally identifiable information" is ticked.
 */
@Component({
  selector: 'app-doc-export-modal',
  standalone: true,
  imports: [FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, SearchDropdownComponent, DatePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './doc-export-modal.component.html',
  styleUrl: './doc-export-modal.component.scss',
})
export class DocExportModalComponent {
  readonly data = inject<DocExportData>(MODAL_DATA);
  private readonly ref = inject<ModalRef<boolean>>(MODAL_REF);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);

  readonly params = { module: this.data.moduleLabel };
  readonly hasStatus = !!this.data.statuses?.length;
  readonly statusOptions: Option[] = [
    { value: null, label: this.translate.instant('DOC_EXPORT.ALL') },
    ...(this.data.statuses ?? []),
  ];
  readonly decimalOptions = DECIMALS;

  readonly status = signal<Option>(this.statusOptions.find((o) => o.value === (this.data.status ?? null)) ?? this.statusOptions[0]);
  readonly range = signal<DateRange | null>(null);
  readonly decimal = signal<Option>(DECIMALS[0]);
  readonly format = signal<ExportFormat>('csv');
  readonly pii = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  readonly formats: { value: ExportFormat; label: string }[] = [
    { value: 'csv', label: 'DOC_EXPORT.FMT_CSV' },
    { value: 'xls', label: 'DOC_EXPORT.FMT_XLS' },
    { value: 'xlsx', label: 'DOC_EXPORT.FMT_XLSX' },
  ];

  readonly display = (o: Option) => o.label;
  readonly same = (a: Option, b: Option) => a?.value === b?.value;
  readonly canExport = computed(() => !this.busy());

  pickStatus(o: Option | null): void { this.status.set(o ?? this.statusOptions[0]); }
  pickDecimal(o: Option | null): void { this.decimal.set(o ?? DECIMALS[0]); }

  async export(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const rows = await this.load();
      if (!rows.length) { this.error.set(this.translate.instant('DOC_EXPORT.NOTHING', this.params)); return; }
      const ctx = { pii: this.pii(), amount: (n: unknown) => this.amount(n) };
      this.write(rows.map((r) => this.data.toRow(r, ctx)));
      this.toast.success(this.translate.instant('DOC_EXPORT.DONE', { ...this.params, count: rows.length }));
      this.ref.close(true);
    } catch (e: any) {
      this.error.set(e?.message || this.translate.instant('DOC_EXPORT.FAILED'));
    } finally {
      this.busy.set(false);
    }
  }

  cancel(): void { this.ref.dismiss(); }

  /** Pages through the list endpoint with the chosen status + date range. */
  private async load(): Promise<any[]> {
    const status = this.status().value;
    const filter: DocExportFilter = { status: status ? [status] : [], fromDate: ymd(this.range()?.start ?? null), toDate: ymd(this.range()?.end ?? this.range()?.start ?? null) };
    const out: any[] = [];
    for (let page = 1; out.length < MAX_ROWS; page++) {
      const res = await this.data.fetchPage(filter, page, PAGE_LIMIT);
      out.push(...(res?.list ?? []));
      if (page >= (res?.pageCount ?? 1)) break;
    }
    return out.slice(0, MAX_ROWS);
  }

  private amount(n: unknown): string | number {
    const v = Number(n ?? 0);
    const mode = this.decimal().value;
    if (mode === 'plain') return v;
    const fixed = v.toFixed(3).replace(/0$/, '');
    const [int, frac] = fixed.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, mode === 'comma-dot' ? ',' : '.');
    return frac ? grouped + (mode === 'comma-dot' ? '.' : ',') + frac : grouped;
  }

  private write(rows: Record<string, string | number>[]): void {
    const stem = `${this.data.fileStem}-${new Date().toISOString().slice(0, 10)}`;
    const fmt = this.format();
    if (fmt === 'csv') {
      const headers = Object.keys(rows[0]);
      const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [headers.map(cell).join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))].join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `${stem}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), this.data.moduleLabel.slice(0, 31));
    XLSX.writeFile(wb, `${stem}.${fmt}`, { bookType: fmt === 'xls' ? 'biff8' : 'xlsx' });
  }
}
