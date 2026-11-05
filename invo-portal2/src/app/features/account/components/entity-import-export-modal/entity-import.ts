import { ImportSummaryCounts, ImportWizardConfig } from '@shared/components/import-wizard/import-wizard.types';
import { ImportWizardComponent } from '@shared/components/import-wizard/import-wizard.component';
import { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ModalService } from '@shared/modal/modal.service';

/** What one entity (suppliers, customers …) plugs into the shared import wizard + export menu. */
export interface EntityImportExportData {
  /** Header row + one example row of the downloadable template. */
  template: any[][];
  templateFile: string;
  /** Maps one data row (columns by index) to the import payload; return null to flag the row invalid. */
  mapRow: (row: any[], header?: any[]) => any | null;
  /** The import's progress probe: `success: true` means no import is running. */
  progress: () => Promise<any>;
  import: (rows: any[]) => Promise<any>;
  export: (type: 'csv' | 'xlsx') => Promise<void>;
  /** Wizard title + guideline i18n keys. */
  title: string;
  requiredNotes: string[];
}

/** Opens the shared upload → preview → validate → import wizard (same one product/option import use). Resolves true after a successful import. */
export async function openEntityImport(modal: ModalService, data: EntityImportExportData): Promise<boolean> {
  const header = data.template[0].map(h => String(h));
  const toRow = (cells: Record<string, string>) => header.map((_, i) => cells['c' + i] ?? '');
  const cfg: ImportWizardConfig = {
    title: data.title,
    hint: 'DOC_IMPORT.IMPORT_HINT',
    columns: header.map((h, i) => ({ key: 'c' + i, label: h })),
    templateRows: data.template,
    templateName: data.templateFile,
    validate: cells => ({ errors: data.mapRow(toRow(cells), header) ? [] : ['Missing required value'] }),
    duplicateKey: () => '',
    notes: {
      sections: [{ title: 'DOC_IMPORT.REQUIRED_FIELDS', items: data.requiredNotes }],
      tip: 'DOC_IMPORT.TEMPLATE_TIP',
    },
    preflight: async () => {
      const p = await data.progress();
      return p && !p.success ? (p.msg || null) : null;
    },
    submit: async rows => {
      const payload = rows.map(r => data.mapRow(toRow(r), header)).filter(x => x != null);
      if (!payload.length) return { ok: false, msg: 'No rows to import' };
      try {
        const res = await data.import(payload);
        if (res?.success) return { ok: true };
        return { ok: false, msg: typeof res === 'string' ? res : (res?.msg ?? '') };
      } catch (e: any) {
        return { ok: false, msg: e?.error?.msg ?? e?.message ?? '' };
      }
    },
  };
  const counts = await modal.open<ImportWizardComponent, ImportWizardConfig, ImportSummaryCounts | undefined>(
    ImportWizardComponent, { size: 'lg', data: cfg, closeOnBackdrop: false },
  ).afterClosed();
  return !!counts && counts.successful > 0;
}

/** The three "⋮" menu entries: Import (wizard), Export as CSV, Export as Excel. */
export function entityImportExportMenu(
  t: (k: string) => string, importLabel: string, run: () => void, data: () => EntityImportExportData,
): DropdownMenuBtnItem[] {
  return [
    { label: importLabel, click: run, disabled: false, danger: false },
    { label: t('DOC_IMPORT.EXPORT_CSV'), click: () => void data().export('csv'), disabled: false, danger: false },
    { label: t('DOC_IMPORT.EXPORT_XLSX'), click: () => void data().export('xlsx'), disabled: false, danger: false },
  ];
}
