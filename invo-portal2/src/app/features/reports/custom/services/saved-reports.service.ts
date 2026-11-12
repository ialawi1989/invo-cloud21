import { Injectable } from '@angular/core';

import { CustomReportsService } from './custom-reports.service';
import { ReportV2Service } from './report-v2.service';
import {
  DashboardConfig,
  ReportConfig,
  SheetConfig,
  legacySheetFromConfig,
} from '../shared/models/custom-report.model';
import { CatalogIndex, indexCatalog } from '../shared/v2/catalog-fields';
import { isLegacySheet, legacyPayloadOf, specToSheet, upgradeLegacySheet } from '../shared/v2/spec-adapter';
import { ReportApiError } from '../shared/v2/report-v2.model';

/** A saved report, ready for the builder or a dashboard widget (always on the v2 catalog). */
export interface OpenedReport {
  id: string;
  name: string;
  /** Saved by the previous builder (modules list); saving creates a v2 copy. */
  legacy: boolean;
  isShared: boolean;
  type: 'sheet' | 'dashboard';
  sheets: SheetConfig[];
  activeSheetId: string;
  dashboard: DashboardConfig | null;
  /** Filter conditions that couldn't be represented in the builder. */
  droppedFilters: number;
  catalogIndex: CatalogIndex;
}

export interface SavedReportSummary {
  id: string;
  name: string;
  legacy: boolean;
  updated?: string;
}

/**
 * Saved custom reports across both stores: v2 specs (/v2/specs) and modules
 * from the previous builder (/modules/*). Old modules are converted sheet by
 * sheet through /v2/fromLegacy on open, so every caller runs them on v2.
 */
@Injectable({
  providedIn: 'root',
})
export class SavedReportsService {
  constructor(
    private reportsV2: ReportV2Service,
    private legacy: CustomReportsService
  ) {}

  /** Both lists; one failing doesn't hide the other. */
  async list(): Promise<SavedReportSummary[]> {
    const [specs, modules] = await Promise.allSettled([this.reportsV2.listSpecs(), this.legacy.getModules()]);
    return [
      ...(specs.status === 'fulfilled' ? specs.value : []).map(s => ({ id: s.id, name: s.name, legacy: false, updated: s.updatedAt })),
      ...(modules.status === 'fulfilled' ? modules.value : []).map((m: any) => ({ id: String(m.id), name: m.name, legacy: true, updated: m.updated })),
    ];
  }

  /**
   * Open a saved report by id — a v2 spec first, else an old module. Returns
   * null when neither exists; rejects with the backend's message when an old
   * report can't be moved to v2 (the old module is left untouched).
   */
  async open(id: string): Promise<OpenedReport | null> {
    const catalogIndex = indexCatalog(await this.reportsV2.getCatalog());

    if (ReportV2Service.isSpecId(id)) {
      try {
        const saved = await this.reportsV2.getSpec(id);
        const ui = saved.spec?.ui;
        const base = { id: saved.id, name: saved.name, legacy: false, isShared: saved.isShared !== false, catalogIndex };
        if (ui?.version === 2 && Array.isArray(ui.sheets) && ui.sheets.length) {
          const cfg = ui as ReportConfig;
          const sheets = backfillSheets(cfg.sheets);
          return {
            ...base,
            type: cfg.type || 'sheet',
            sheets,
            activeSheetId: sheets.some(s => s.id === cfg.activeSheetId) ? cfg.activeSheetId : sheets[0].id,
            dashboard: cfg.dashboard || null,
            droppedFilters: 0,
          };
        }
        // Saved by another client (Ask AI elsewhere, an MCP client): one sheet from the spec.
        const { sheet, droppedFilters } = specToSheet(saved.spec, { index: catalogIndex });
        return { ...base, type: 'sheet', sheets: [sheet], activeSheetId: sheet.id, dashboard: null, droppedFilters };
      } catch (err) {
        // "Report not found" — the id may belong to an old module instead.
        if (!(err instanceof ReportApiError)) throw err;
      }
    }

    const mod = await this.legacy.getModule(id);
    if (!mod) return null;
    // `text` arrives as a JSON string (list) or a parsed object (by id).
    const cfg = typeof mod.text === 'string' ? JSON.parse(mod.text) : mod.text;
    const builderCfg = cfg?.version === 2 && Array.isArray(cfg.sheets) ? (cfg as ReportConfig) : null;
    const oldSheets = builderCfg ? backfillSheets(builderCfg.sheets) : [legacySheetFromConfig(cfg, '')];

    let droppedFilters = 0;
    const sheets = await Promise.all(oldSheets.map(async s => {
      if (!isLegacySheet(s, catalogIndex)) return s;
      const spec = await this.reportsV2.fromLegacy(legacyPayloadOf(s));
      const upgraded = upgradeLegacySheet(s, spec, catalogIndex);
      droppedFilters += upgraded.droppedFilters;
      return upgraded.sheet;
    }));

    return {
      id: String(mod.id),
      name: mod.name,
      legacy: true,
      isShared: true,
      type: builderCfg?.type || 'sheet',
      sheets,
      activeSheetId: builderCfg && sheets.some(s => s.id === builderCfg.activeSheetId) ? builderCfg.activeSheetId : sheets[0].id,
      // Dashboard-wide filters name old views; they can't be carried across.
      dashboard: builderCfg?.dashboard ? { ...builderCfg.dashboard, globalFilters: [] } : null,
      droppedFilters,
      catalogIndex,
    };
  }
}

/** Backfill defaults for fields added after a report was first saved. */
export function backfillSheets(sheets: SheetConfig[]): SheetConfig[] {
  return (sheets || []).map(s => ({
    ...s,
    joins: Array.isArray(s.joins) ? s.joins : [],
    // A saved sheet can come back without empty shelves; the builder iterates them.
    rowsShelf: Array.isArray(s.rowsShelf) ? s.rowsShelf : [],
    columnsShelf: Array.isArray(s.columnsShelf) ? s.columnsShelf : [],
    filterGlue: typeof s.filterGlue === 'string' ? s.filterGlue : ' AND ',
    filterRules: Array.isArray(s.filterRules) ? s.filterRules : [],
    sortBy: Array.isArray(s.sortBy) ? s.sortBy : [],
    // showLabels was added later — default matches createDefaultSheet().
    showLabels: typeof s.showLabels === 'boolean' ? s.showLabels : true,
    marks: Array.isArray(s.marks) ? s.marks : [],
    calculatedFields: Array.isArray(s.calculatedFields) ? s.calculatedFields : [],
  }));
}
