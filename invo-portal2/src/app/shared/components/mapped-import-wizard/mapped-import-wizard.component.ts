import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as XLSX from 'xlsx';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { WizardStepsComponent } from '@shared/components/wizard-steps/wizard-steps.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { parseCsvTable } from '../import-wizard/csv-parser';
import { buildXlsxBlob } from '../import-wizard/xlsx-writer';
import {
  MappedImportConfig, MappedImportField, MappedImportIssue, MappedImportPreview, MappedImportStep, MappedRow,
} from './mapped-import.types';

export const MAPPED_IMPORT_DATE_FORMATS = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy', 'dd MMM yyyy'];
const ENCODINGS = [
  { value: 'utf-8', label: 'UTF-8 (Unicode)' },
  { value: 'windows-1252', label: 'ISO-8859-1 (Western European)' },
  { value: 'windows-1256', label: 'Windows-1256 (Arabic)' },
];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');

/** `value` written in `format` → `yyyy-MM-dd`, or '' when it doesn't fit. */
export function normaliseDate(value: string, format: string): string {
  const v = value.trim();
  if (!v) return '';
  const parts = v.split(/[\s/.-]+/);
  const tokens = format.split(/[\s/.-]+/);
  if (parts.length < 3 || tokens.length < 3) return '';
  let d = 0, m = 0, y = 0;
  tokens.forEach((t, i) => {
    const p = parts[i];
    if (t === 'dd') d = Number(p);
    else if (t === 'MM') m = Number(p);
    else if (t === 'MMM') m = MONTHS.indexOf(p.slice(0, 3).toLowerCase()) + 1;
    else if (t === 'yyyy') y = Number(p);
  });
  if (!y || !m || !d || m > 12 || d > 31) return '';
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Configure → Map Fields → Preview import. The file's headers are matched onto `config.fields`
 * automatically (and can be changed), the preview is a dry run through `config.run`, and Import
 * runs the same call for real. Closes with the final result (undefined on cancel).
 */
@Component({
  selector: 'app-mapped-import-wizard',
  standalone: true,
  imports: [FormsModule, TranslateModule, ModalHeaderComponent, WizardStepsComponent, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mapped-import-wizard.component.html',
  styleUrl: './mapped-import-wizard.component.scss',
})
export class MappedImportWizardComponent {
  readonly config = inject<MappedImportConfig>(MODAL_DATA);
  private readonly ref = inject<ModalRef<MappedImportPreview | undefined>>(MODAL_REF);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(ToastService);

  readonly encodings = ENCODINGS;
  readonly dateFormats = MAPPED_IMPORT_DATE_FORMATS;
  readonly steps = [
    { key: 'configure', label: 'COMMON.MAPPED_IMPORT.STEP_CONFIGURE' },
    { key: 'map', label: 'COMMON.MAPPED_IMPORT.STEP_MAP' },
    { key: 'preview', label: 'COMMON.MAPPED_IMPORT.STEP_PREVIEW' },
  ];

  readonly step = signal<MappedImportStep>('configure');
  readonly busy = signal(false);
  readonly error = signal('');

  // ── Configure ──
  readonly file = signal<File | null>(null);
  readonly encoding = signal<{ value: string; label: string }>(ENCODINGS[0]);
  readonly optionValues = signal<Record<string, boolean>>(
    Object.fromEntries((this.config.options ?? []).map((o) => [o.key, !!o.default])),
  );

  // ── Map ──
  readonly headers = signal<string[]>([]);
  private readonly table = signal<string[][]>([]);
  /** field key → header (null = unmapped). */
  readonly mapping = signal<Record<string, string | null>>({});
  /** date field key → format. */
  readonly formats = signal<Record<string, string>>({});

  readonly groups = computed(() => {
    const out: { label: string; fields: MappedImportField[] }[] = [];
    for (const f of this.config.fields) {
      let g = out.find((x) => x.label === f.group);
      if (!g) { g = { label: f.group, fields: [] }; out.push(g); }
      g.fields.push(f);
    }
    return out;
  });
  readonly missingRequired = computed(() => this.config.fields.filter((f) => f.required && !this.mapping()[f.key]));
  readonly unmappedHeaders = computed(() => {
    const used = new Set(Object.values(this.mapping()).filter((h): h is string => !!h));
    return this.headers().filter((h) => !used.has(h));
  });

  // ── Preview ──
  readonly preview = signal<MappedImportPreview | null>(null);
  readonly open = signal<Record<string, boolean>>({});
  readonly done = signal(false);
  /** record ref → field → value chosen in the preview's per-record fix pickers. */
  private readonly overrides = signal<Record<string, Record<string, string>>>({});
  /** Corrected records stay in the error list (marked) instead of vanishing: ref → the issue with `fixedTo`. */
  private readonly fixed = signal<Record<string, MappedImportIssue>>({});

  /** Error rows to show: the unresolved ones plus the corrected ones, in file order (the server's result after Import). */
  readonly failedList = computed<MappedImportIssue[]>(() => {
    const p = this.preview();
    if (!p) return [];
    if (this.done()) return p.failed;
    return [...p.failed, ...Object.values(this.fixed())].sort((a, b) => a.row - b.row);
  });
  readonly fixedOption = (i: MappedImportIssue) => i.fix?.options.find((o) => o.value === i.fixedTo) ?? null;

  readonly displayHeader = (h: string) => h;
  readonly displayEncoding = (e: { label: string }) => e.label;
  readonly encodingEq = (a: { value: string }, b: { value: string }) => a?.value === b?.value;

  setOption(key: string, on: boolean): void { this.optionValues.update((o) => ({ ...o, [key]: on })); }
  toggle(section: string): void { this.open.update((o) => ({ ...o, [section]: !o[section] })); }

  // ─── Step 1 ───────────────────────────────────────────────────────
  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.error.set('');
    this.file.set(input.files?.[0] ?? null);
    input.value = '';
  }
  removeFile(): void { this.file.set(null); }
  setEncoding(e: { value: string; label: string } | null): void { this.encoding.set(e ?? ENCODINGS[0]); }

  downloadTemplate(kind: 'csv' | 'xlsx'): void {
    const rows = this.config.templateRows;
    const cell = (c: string | number) => (/[",\n\r]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c));
    const blob = kind === 'xlsx'
      ? buildXlsxBlob(rows)
      : new Blob([rows.map((r) => r.map(cell).join(',')).join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
    this.save(blob, `${this.config.templateName}.${kind}`);
  }

  async next(): Promise<void> {
    this.error.set('');
    if (this.step() === 'configure') await this.toMap();
    else if (this.step() === 'map') await this.toPreview();
  }

  previous(): void {
    this.error.set('');
    if (this.step() === 'preview') this.step.set('map');
    else if (this.step() === 'map') this.step.set('configure');
  }

  private async toMap(): Promise<void> {
    const f = this.file();
    if (!f) { this.error.set(this.translate.instant('COMMON.MAPPED_IMPORT.ERR_NO_FILE')); return; }
    this.busy.set(true);
    try {
      const table = await this.readTable(f);
      if (table.length < 2) { this.error.set(this.translate.instant('COMMON.MAPPED_IMPORT.ERR_EMPTY')); return; }
      const headers = table[0].map((h) => h.trim()).filter((h) => h);
      this.table.set(table);
      this.headers.set(headers);
      this.autoMap(headers);
      this.step.set('map');
    } catch (e: any) {
      this.error.set(e?.message || this.translate.instant('COMMON.MAPPED_IMPORT.ERR_READ'));
    } finally {
      this.busy.set(false);
    }
  }

  /** CSV/TSV are decoded with the picked encoding; xls/xlsx go through SheetJS (dates become `yyyy-MM-dd`). */
  private async readTable(f: File): Promise<string[][]> {
    const buf = await f.arrayBuffer();
    if (/\.(xlsx|xls)$/i.test(f.name)) {
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '', blankrows: false });
      return rows.map((r) => r.map((c) => (c instanceof Date
        ? `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}`
        : String(c ?? '').trim())));
    }
    return parseCsvTable(new TextDecoder(this.encoding().value).decode(buf));
  }

  private autoMap(headers: string[]): void {
    const byNorm = new Map(headers.map((h) => [norm(h), h]));
    const mapping: Record<string, string | null> = {};
    const formats: Record<string, string> = {};
    for (const f of this.config.fields) {
      const candidates = [this.translate.instant(f.label), f.key, ...(f.aliases ?? [])].map(norm);
      mapping[f.key] = candidates.map((c) => byNorm.get(c)).find((h) => !!h) ?? null;
      if (f.type === 'date') formats[f.key] = MAPPED_IMPORT_DATE_FORMATS[0];
    }
    this.mapping.set(mapping);
    this.formats.set(formats);
  }

  setMapping(key: string, header: string | null): void { this.mapping.update((m) => ({ ...m, [key]: header || null })); }
  setFormat(key: string, format: string | null): void { this.formats.update((m) => ({ ...m, [key]: format || MAPPED_IMPORT_DATE_FORMATS[0] })); }

  // ─── Step 2 → 3 ───────────────────────────────────────────────────
  /** File rows → `MappedRow`s (header dropped, mapped columns only, dates normalised). */
  private mappedRows(): MappedRow[] {
    const [head, ...body] = this.table();
    const index = new Map(head.map((h, i) => [h.trim(), i]));
    return body.map((cells) => {
      const row: MappedRow = {};
      for (const f of this.config.fields) {
        const header = this.mapping()[f.key];
        let v = header ? (cells[index.get(header) ?? -1] ?? '').trim() : '';
        if (f.type === 'date' && v) {
          v = /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : normaliseDate(v, this.formats()[f.key] ?? MAPPED_IMPORT_DATE_FORMATS[0]);
        }
        row[f.key] = v;
      }
      const fixes = this.config.recordKey ? this.overrides()[row[this.config.recordKey]] : undefined;
      return fixes ? { ...row, ...fixes } : row;
    });
  }

  private async toPreview(): Promise<void> {
    const missing = this.missingRequired();
    if (missing.length) {
      this.error.set(this.translate.instant('COMMON.MAPPED_IMPORT.ERR_REQUIRED', {
        fields: missing.map((f) => this.translate.instant(f.label)).join(', '),
      }));
      return;
    }
    this.busy.set(true);
    try {
      this.overrides.set({});
      this.fixed.set({});
      await this.refreshPreview();
      this.open.set({});
      this.step.set('preview');
    } catch (e: any) {
      this.error.set(e?.message || this.translate.instant('COMMON.MAPPED_IMPORT.ERR_PREVIEW'));
    } finally {
      this.busy.set(false);
    }
  }

  private async refreshPreview(): Promise<void> {
    const rows = this.mappedRows();
    this.preview.set(this.config.preview
      ? this.config.preview(rows, { options: this.optionValues() })
      : await this.config.run(rows, { dryRun: true, options: this.optionValues() }));
  }

  readonly fixLabel = (o: { label: string }) => this.translate.instant(o.label);
  readonly fixEq = (a: { value: string }, b: { value: string }) => a?.value === b?.value;

  /** Applies the user's correction to every row of the record and re-checks the preview. */
  async applyFix(issue: MappedImportIssue, option: { value: string } | null): Promise<void> {
    if (!issue.fix || !option) return;
    this.setFix(issue, option.value);
    await this.refreshPreview();
  }

  private setFix(issue: MappedImportIssue, value: string): void {
    const fix = issue.fix!;
    this.overrides.update((o) => ({ ...o, [issue.ref]: { ...o[issue.ref], [fix.field]: value } }));
    this.fixed.update((f) => ({ ...f, [issue.ref]: { ...issue, fixedTo: value } }));
  }

  /** The picker offered to the whole list: the first fixable issue's options (all issues of a kind share them). */
  bulkFix(list: MappedImportIssue[]) { return list.find((i) => i.fix)?.fix ?? null; }

  /** Applies one correction to every fixable record in `list` at once. */
  async applyFixAll(list: MappedImportIssue[], option: { value: string } | null): Promise<void> {
    if (!option) return;
    for (const i of list) if (i.fix && i.ref) this.setFix(i, option.value);
    await this.refreshPreview();
  }

  async runImport(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const res = await this.config.run(this.mappedRows(), { dryRun: false, options: this.optionValues() });
      this.preview.set(res);
      this.done.set(true);
      this.ref.setResult(res);
      this.toast.success(this.translate.instant('COMMON.MAPPED_IMPORT.IMPORTED', { count: res.imported ?? 0 }));
    } catch (e: any) {
      this.error.set(e?.message || this.translate.instant('COMMON.MAPPED_IMPORT.ERR_IMPORT'));
    } finally {
      this.busy.set(false);
    }
  }

  downloadIssues(list: MappedImportIssue[], name: string): void {
    const rows: (string | number)[][] = [['Row', 'Reference', 'Reason'], ...list.map((i) => [i.row, i.ref, i.reason])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    this.save(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
  }

  private save(blob: Blob, filename: string): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  cancel(): void { this.ref.dismiss(); }
  finish(): void { this.ref.close(this.preview() ?? undefined); }
}
