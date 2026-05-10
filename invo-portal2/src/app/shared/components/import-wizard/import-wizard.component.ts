import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

import { parseCsv } from './csv-parser';
import { readXlsx } from './xlsx-reader';
import { buildXlsxBlob } from './xlsx-writer';
import {
  AnnotatedRow,
  ImportRow,
  ImportSubmitResult,
  ImportSummaryCounts,
  ImportWizardConfig,
} from './import-wizard.types';

type WizardStep = 'upload' | 'preview' | 'options' | 'importing' | 'complete';

/**
 * Generic Import wizard.
 *
 * Configured at open-time via `MODAL_DATA` (an `ImportWizardConfig`).
 * Owns the UI for the five-step flow:
 *
 *     upload  →  preview  →  options?  →  importing  →  complete
 *
 * The Options step is skipped when the caller doesn't pass any
 * `modes`. Validation, submit, and pre-flight are caller-owned —
 * the wizard only orchestrates.
 *
 * Returns `ImportSummaryCounts | undefined` via `afterClosed()`
 * (undefined when the user cancels before the import finishes).
 */
@Component({
  selector: 'app-import-wizard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ModalHeaderComponent,
    ModalFooterComponent,
    DropdownMenuBtnComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import-wizard.component.html',
  styleUrl:    './import-wizard.component.scss',
})
export class ImportWizardComponent {
  data = inject<ImportWizardConfig>(MODAL_DATA);
  ref  = inject<ModalRef<ImportSummaryCounts | undefined>>(MODAL_REF);

  // ─── State ──────────────────────────────────────────────────────────
  step      = signal<WizardStep>('upload');
  loading   = signal<boolean>(false);
  errorMsg  = signal<string>('');

  pasted    = signal<string>('');
  fileName  = signal<string>('');

  /** Annotated rows after parse + validate. Recomputed from
   *  `pasted` whenever the user pastes or picks a file. */
  rows = signal<AnnotatedRow[]>([]);

  validCount     = computed<number>(() => this.rows().filter(r => r.status === 'valid').length);
  invalidCount   = computed<number>(() => this.rows().filter(r => r.status === 'invalid').length);
  duplicateCount = computed<number>(() => this.rows().filter(r => r.status === 'duplicate').length);

  /** Submittable rows: everything that passed validation. Duplicates
   *  are included unless `skipDuplicates` is on. */
  submittable = computed<ImportRow[]>(() => {
    const skip = this.skipDuplicates();
    return this.rows()
      .filter(r => r.status === 'valid' || (r.status === 'duplicate' && !skip))
      .map(r => r.cells);
  });

  mode             = signal<string>('');
  skipDuplicates   = signal<boolean>(false);

  result = signal<ImportSummaryCounts | null>(null);

  // ─── Derived flags ──────────────────────────────────────────────────
  hasModes = computed<boolean>(() => (this.data.modes?.length ?? 0) > 0);

  /** Translation key for the currently-picked mode's label, or empty
   *  when no modes are configured. Drives the "Import mode: …" line
   *  in the Options summary box. */
  selectedModeLabel = computed<string>(() => {
    const m = this.data.modes?.find(x => x.value === this.mode());
    return m?.label ?? '';
  });

  /** Step indices used by the stepper. We display the Options step
   *  only when `modes` are configured, so the indices need to shift. */
  stepperItems = computed<{ key: WizardStep; label: string }[]>(() => {
    const items: { key: WizardStep; label: string }[] = [
      { key: 'upload',    label: 'COMMON.IMPORT_WIZARD.STEP_UPLOAD' },
      { key: 'preview',   label: 'COMMON.IMPORT_WIZARD.STEP_PREVIEW' },
    ];
    if (this.hasModes()) items.push({ key: 'options', label: 'COMMON.IMPORT_WIZARD.STEP_OPTIONS' });
    items.push(
      { key: 'importing', label: 'COMMON.IMPORT_WIZARD.STEP_IMPORT' },
      { key: 'complete',  label: 'COMMON.IMPORT_WIZARD.STEP_DONE' },
    );
    return items;
  });

  currentStepIdx = computed<number>(() => {
    const items = this.stepperItems();
    const idx = items.findIndex(i => i.key === this.step());
    return idx < 0 ? 0 : idx;
  });

  constructor() {
    // Seed the import-mode default once on open. Once the user
    // changes it we never overwrite it.
    const m = this.data.modes ?? [];
    this.mode.set(this.data.defaultMode ?? m[0]?.value ?? '');
  }

  // ─── Parse + validate pipeline ──────────────────────────────────────

  /** Parse the current paste, run the validator, mark duplicates,
   *  and store on `rows`. Called whenever the textarea changes or a
   *  file is loaded. */
  private reparse(): void {
    const records = parseCsv(this.pasted(), this.data.columns);
    const seeded: AnnotatedRow[] = records.map((cells, i) => ({
      cells, line: i + 1, status: 'valid', errors: [],
    }));
    this.rows.set(this.revalidate(seeded));
  }

  /** Re-run validation + duplicate detection across all rows.
   *  Used both by `reparse` and after inline cell edits — editing
   *  one row's primary key can flip another row's `duplicate`
   *  status, so we always recompute the whole set. */
  private revalidate(rows: AnnotatedRow[]): AnnotatedRow[] {
    const validate = this.data.validate ?? (() => ({ errors: [] }));
    const dupKey = this.data.duplicateKey
      ?? ((cells: ImportRow) => cells[this.data.columns[0].key] ?? '');
    const seen = new Set<string>();
    return rows.map(r => {
      const errors = validate(r.cells).errors ?? [];
      let status: AnnotatedRow['status'] = errors.length ? 'invalid' : 'valid';
      if (status === 'valid') {
        // Only valid rows participate in dedup — an invalid row's
        // primary-key collision is bad data, not a duplicate.
        const key = dupKey(r.cells);
        if (key) {
          if (seen.has(key)) status = 'duplicate';
          else               seen.add(key);
        }
      }
      return { ...r, status, errors };
    });
  }

  /** Inline-edit a cell from the Preview table. Trims whitespace
   *  and re-runs validation across the whole set so status badges
   *  and duplicate flags update live. */
  editCell(row: AnnotatedRow, key: string, value: string): void {
    const trimmed = value.trim();
    this.rows.update(list => {
      const next = list.map(r =>
        r.line === row.line
          ? { ...r, cells: { ...r.cells, [key]: trimmed } }
          : r,
      );
      return this.revalidate(next);
    });
  }

  /** Drop a row from the preview entirely — useful for getting rid
   *  of stray invalid rows the user doesn't want to fix. */
  removeRow(row: AnnotatedRow): void {
    this.rows.update(list => {
      const next = list.filter(r => r.line !== row.line);
      return this.revalidate(next);
    });
  }

  // ─── Upload step ────────────────────────────────────────────────────

  onPasteChange(value: string): void {
    this.pasted.set(value);
    this.reparse();
  }

  async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    this.errorMsg.set('');

    const isXlsx = /\.xlsx$/i.test(file.name);
    let text = '';
    try {
      text = isXlsx
        ? await this.xlsxToCsvText(file)
        : await file.text();
    } catch (err: any) {
      this.errorMsg.set(err?.message || 'Could not read the file.');
      input.value = '';
      return;
    }

    // Append to anything the user has already pasted so the two
    // inputs are additive. Most users only use one or the other.
    const merged = this.pasted() ? this.pasted() + '\n' + text : text;
    this.pasted.set(merged);
    this.reparse();
    input.value = '';
  }

  /** Read an .xlsx file's first worksheet and serialize to CSV.
   *  Goes through the same `parseCsv` path the textarea uses, so
   *  the user gets identical preview/edit semantics for both
   *  upload sources. */
  private async xlsxToCsvText(file: File): Promise<string> {
    const rows = await readXlsx(file);
    return rows
      .map(row => row.map(cellToCsv).join(','))
      .join('\n');
  }

  // ─── Template downloads (CSV / XLSX) ────────────────────────────────

  /** Items rendered by the Download-Template `<app-dropdown-menu-btn>`. */
  templateMenuItems(): DropdownMenuBtnItem[] {
    return [
      {
        label: 'COMMON.IMPORT_WIZARD.DOWNLOAD_TEMPLATE_CSV',
        tag:   { label: 'CSV', variant: 'cyan' },
        click: () => this.downloadTemplateCsv(),
      },
      {
        label: 'COMMON.IMPORT_WIZARD.DOWNLOAD_TEMPLATE_XLSX',
        tag:   { label: 'XLSX', variant: 'green' },
        click: () => this.downloadTemplateXlsx(),
      },
    ];
  }

  private saveBlob(blob: Blob, filename: string): void {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** Build a CSV from `templateRows`. The first row is treated as the
   *  header so it ends up on its own line at the top of the file. */
  downloadTemplateCsv(): void {
    const csv = this.data.templateRows
      .map(r => r.map(cellToCsv).join(','))
      .join('\n') + '\n';
    this.saveBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      `${this.data.templateName}.csv`,
    );
  }

  /** Same source rows, packaged as a real .xlsx. Built by the
   *  in-tree minimal writer — no SheetJS dep. */
  downloadTemplateXlsx(): void {
    const blob = buildXlsxBlob(this.data.templateRows);
    this.saveBlob(blob, `${this.data.templateName}.xlsx`);
  }

  // ─── Step navigation ────────────────────────────────────────────────

  /** Continue from Preview. If modes are configured, route through
   *  Options; otherwise go straight to Importing. */
  continueFromPreview(): void {
    if (this.submittable().length === 0) return;
    this.step.set(this.hasModes() ? 'options' : 'importing');
    if (!this.hasModes()) this.runImport();
  }

  startImport(): void {
    if (this.submittable().length === 0) return;
    this.step.set('importing');
    this.runImport();
  }

  reset(): void {
    this.pasted.set('');
    this.fileName.set('');
    this.rows.set([]);
    this.errorMsg.set('');
    this.result.set(null);
    this.step.set('upload');
  }

  cancel(): void { this.ref.dismiss(); }
  done():   void { this.ref.close(this.result() ?? undefined); }

  // ─── Submit ─────────────────────────────────────────────────────────

  private async runImport(): Promise<void> {
    const rows = this.submittable();
    this.loading.set(true);
    this.errorMsg.set('');
    try {
      if (this.data.preflight) {
        const blockMsg = await this.data.preflight();
        if (blockMsg) {
          this.errorMsg.set(blockMsg);
          // Drop back to Preview so the user can read the message
          // alongside the rows; importing-step is a dead end here.
          this.step.set(this.hasModes() ? 'options' : 'preview');
          return;
        }
      }

      const res: ImportSubmitResult = await this.data.submit(rows, {
        mode:           this.mode(),
        skipDuplicates: this.skipDuplicates(),
      });

      if (!res.ok) {
        this.errorMsg.set(res.msg || 'Import failed.');
        this.step.set(this.hasModes() ? 'options' : 'preview');
        return;
      }

      const counts: ImportSummaryCounts = res.result ?? {
        total:      this.rows().length,
        successful: rows.length,
        failed:     this.invalidCount(),
        skipped:    this.skipDuplicates() ? this.duplicateCount() : 0,
      };
      this.result.set(counts);
      // Pre-set the modal result so backdrop-dismiss after this
      // point still surfaces the import counts to the caller.
      this.ref.setResult(counts);
      this.step.set('complete');
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Template helpers used by the html ──────────────────────────────

  /** Cells the preview table renders in column order. Used by the
   *  template's `*ngFor` so the column iteration stays in sync with
   *  the configured schema. */
  cellsFor(row: AnnotatedRow): string[] {
    return this.data.columns.map(c => row.cells[c.key] ?? '');
  }

  /** Single-string error summary for the preview table's "Issues"
   *  column. */
  errorsLine(row: AnnotatedRow): string {
    return row.errors.length ? row.errors.join(', ') : '—';
  }
}

/** CSV-escape a cell. Wraps in quotes (and doubles inner quotes) if
 *  the value contains a delimiter, quote, or newline. */
function cellToCsv(v: string | number): string {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
