import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalService } from '../../modal/modal.service';
import { SearchDropdownComponent } from '../dropdown/search-dropdown.component';
import {
  FaqEntry,
  ReviewEntry,
  SpecField,
  TabDataMap,
  TabTemplate,
  TableData,
  VehicleFitment,
  VehicleTabData,
  initialTabData,
} from './tab-builder.types';
import { AddVehicleModalComponent } from './add-vehicle-modal.component';
import { TabTypeIconComponent } from './tab-type-icon.component';

/**
 * Per-product data editor. Reads the company `templates` and renders **only
 * active tabs**, swapping the editor body based on each tab's type and
 * template-provided schema (spec fields, vehicle config, etc.).
 *
 * Emits a new `TabDataMap` (`{ [abbr]: content }`) on every edit; caller
 * keeps it on `productInfo.tabBuilder`.
 */
@Component({
  selector: 'app-tab-data-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, SearchDropdownComponent, TabTypeIconComponent],
  templateUrl: './tab-data-editor.component.html',
  styleUrl: './tab-data-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabDataEditorComponent {
  private modal = inject(ModalService);

  templates   = input<TabTemplate[]>([]);
  value       = input<TabDataMap>({});
  /**
   * The product type of the current record. Used to filter templates whose
   * `productTypes[]` restricts them to a subset. When `null` (e.g. the
   * shared settings preview), all active templates are shown.
   */
  productType = input<string | null>(null);
  valueChange = output<TabDataMap>();

  activeAbbrSignal = signal<string>('');

  activeTemplates = computed<TabTemplate[]>(() => {
    const type = this.productType();
    return this.templates()
      .filter(t => t.isActive)
      .filter(t => {
        // No product-type filter on the template → applies everywhere.
        if (!Array.isArray(t.productTypes) || t.productTypes.length === 0) return true;
        // With a filter but no current type (settings preview) → still show.
        if (!type) return true;
        return t.productTypes.includes(type as any);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  });

  activeTemplate = computed<TabTemplate | null>(() => {
    const list = this.activeTemplates();
    if (list.length === 0) return null;
    const abbr = this.activeAbbrSignal();
    return list.find(t => t.abbr === abbr) ?? list[0];
  });

  // ─── Filled-state check (for the left-column checkmark) ─────────────────
  hasData(abbr: string): boolean {
    const v = this.value()?.[abbr];
    if (v == null) return false;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') {
      if ('isUniversal' in v) return !!v.isUniversal || (Array.isArray(v.vehicles) && v.vehicles.length > 0);
      if ('headers' in v && 'rows' in v) return Array.isArray(v.rows) && v.rows.length > 0;
      return Object.values(v).some(x => x !== '' && x != null);
    }
    return false;
  }

  select(abbr: string): void {
    this.activeAbbrSignal.set(abbr);
  }

  private patchValue(abbr: string, data: any): void {
    const next = { ...(this.value() ?? {}), [abbr]: data };
    this.valueChange.emit(next);
  }

  private ensureInitialised(tpl: TabTemplate): any {
    const existing = this.value()?.[tpl.abbr];
    if (existing !== undefined) return existing;
    const init = initialTabData(tpl);
    // Don't emit here — only on edits. Return the initial scaffold for rendering.
    return init;
  }

  // ─── Specs ──────────────────────────────────────────────────────────────
  specsValue(abbr: string): Record<string, any> {
    const v = this.value()?.[abbr];
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  }

  updateSpec(abbr: string, fieldAbbr: string, value: any): void {
    const cur = this.specsValue(abbr);
    this.patchValue(abbr, { ...cur, [fieldAbbr]: value });
  }

  specValue(abbr: string, field: SpecField): any {
    const v = this.specsValue(abbr)[field.abbr];
    if (field.type === 'multiselect') return Array.isArray(v) ? v : [];
    return v ?? '';
  }

  isOptionSelected(abbr: string, field: SpecField, opt: string): boolean {
    const v = this.specValue(abbr, field);
    return Array.isArray(v) && v.includes(opt);
  }

  toggleMulti(abbr: string, field: SpecField, opt: string, checked: boolean): void {
    const cur: string[] = [...(this.specValue(abbr, field) as string[])];
    const idx = cur.indexOf(opt);
    if (checked && idx === -1) cur.push(opt);
    if (!checked && idx !== -1) cur.splice(idx, 1);
    this.updateSpec(abbr, field.abbr, cur);
  }

  // ─── Vehicle ────────────────────────────────────────────────────────────
  vehicleData(tpl: TabTemplate): VehicleTabData {
    const existing = this.value()?.[tpl.abbr];
    if (existing && typeof existing === 'object' && 'vehicles' in existing) {
      return {
        isUniversal: !!existing.isUniversal,
        vehicles: Array.isArray(existing.vehicles) ? existing.vehicles : [],
      };
    }
    return initialTabData(tpl) as VehicleTabData;
  }

  toggleUniversal(tpl: TabTemplate): void {
    const cur = this.vehicleData(tpl);
    this.patchValue(tpl.abbr, { ...cur, isUniversal: !cur.isUniversal });
  }

  async openAddVehicle(tpl: TabTemplate): Promise<void> {
    const ref = this.modal.open<AddVehicleModalComponent, any, VehicleFitment>(
      AddVehicleModalComponent,
      { size: 'sm', data: { config: tpl.vehicleConfig ?? { allowUniversal: true, allowYearRange: true, requireEngine: false } } },
    );
    const v = await ref.afterClosed();
    if (!v) return;
    const cur = this.vehicleData(tpl);
    this.patchValue(tpl.abbr, { ...cur, vehicles: [...cur.vehicles, v] });
  }

  removeVehicle(tpl: TabTemplate, index: number): void {
    const cur = this.vehicleData(tpl);
    this.patchValue(tpl.abbr, { ...cur, vehicles: cur.vehicles.filter((_, i) => i !== index) });
  }

  vehicleYears(v: VehicleFitment): string {
    return v.yearStart === v.yearEnd ? String(v.yearStart) : `${v.yearStart}-${v.yearEnd}`;
  }

  // ─── Richtext / Custom ──────────────────────────────────────────────────
  textValue(abbr: string): string {
    const v = this.value()?.[abbr];
    return typeof v === 'string' ? v : '';
  }

  updateText(abbr: string, value: string): void {
    this.patchValue(abbr, value);
  }

  // ─── FAQ ────────────────────────────────────────────────────────────────
  faqValue(tpl: TabTemplate): FaqEntry[] {
    const v = this.value()?.[tpl.abbr];
    if (Array.isArray(v)) return v;
    // Seed from template questions on first open
    const predefined = tpl.faqFields ?? [];
    return predefined.map(f => ({ question: f.question, answer: '' }));
  }

  updateFaq(abbr: string, index: number, patch: Partial<FaqEntry>): void {
    const cur = [...(this.faqValue(this.getTpl(abbr)))];
    cur[index] = { ...cur[index], ...patch };
    this.patchValue(abbr, cur);
  }

  addFaqEntry(tpl: TabTemplate): void {
    const cur = [...this.faqValue(tpl), { question: '', answer: '' }];
    this.patchValue(tpl.abbr, cur);
  }

  removeFaqEntry(tpl: TabTemplate, index: number): void {
    const cur = this.faqValue(tpl).filter((_, i) => i !== index);
    this.patchValue(tpl.abbr, cur);
  }

  // ─── Table ──────────────────────────────────────────────────────────────
  tableValue(tpl: TabTemplate): TableData {
    const v = this.value()?.[tpl.abbr];
    if (v && typeof v === 'object' && Array.isArray((v as any).headers) && Array.isArray((v as any).rows)) {
      return {
        headers: (v as any).headers.map((h: any) => String(h ?? '')),
        rows: (v as any).rows.map((r: any[]) => Array.isArray(r) ? r.map((c: any) => String(c ?? '')) : []),
      };
    }
    return initialTabData(tpl) as TableData;
  }

  updateHeader(tpl: TabTemplate, i: number, value: string): void {
    const t = this.tableValue(tpl);
    const headers = [...t.headers]; headers[i] = value;
    this.patchValue(tpl.abbr, { headers, rows: t.rows });
  }

  updateCell(tpl: TabTemplate, r: number, c: number, value: string): void {
    const t = this.tableValue(tpl);
    const rows = t.rows.map((row, i) =>
      i === r ? row.map((cell, j) => j === c ? value : cell) : row
    );
    this.patchValue(tpl.abbr, { headers: t.headers, rows });
  }

  addRow(tpl: TabTemplate): void {
    const t = this.tableValue(tpl);
    this.patchValue(tpl.abbr, { headers: t.headers, rows: [...t.rows, new Array(t.headers.length).fill('')] });
  }

  addColumn(tpl: TabTemplate): void {
    const t = this.tableValue(tpl);
    this.patchValue(tpl.abbr, {
      headers: [...t.headers, `Column ${t.headers.length + 1}`],
      rows: t.rows.map(r => [...r, '']),
    });
  }

  removeRow(tpl: TabTemplate, i: number): void {
    const t = this.tableValue(tpl);
    this.patchValue(tpl.abbr, { headers: t.headers, rows: t.rows.filter((_, idx) => idx !== i) });
  }

  removeColumn(tpl: TabTemplate, i: number): void {
    const t = this.tableValue(tpl);
    this.patchValue(tpl.abbr, {
      headers: t.headers.filter((_, idx) => idx !== i),
      rows: t.rows.map(r => r.filter((_, idx) => idx !== i)),
    });
  }

  // ─── Review ─────────────────────────────────────────────────────────────
  readonly REVIEW_STARS = [1, 2, 3, 4, 5];

  reviewValue(tpl: TabTemplate): ReviewEntry[] {
    const v = this.value()?.[tpl.abbr];
    if (Array.isArray(v)) {
      return v.map(r => ({
        author:  String(r?.author ?? ''),
        rating:  Number.isFinite(r?.rating) ? Math.max(0, Math.min(5, Math.round(r.rating))) : 0,
        title:   r?.title  != null ? String(r.title)  : '',
        comment: String(r?.comment ?? ''),
        date:    typeof r?.date === 'string' ? r.date : undefined,
      }));
    }
    return [];
  }

  addReview(tpl: TabTemplate): void {
    const today = new Date().toISOString().slice(0, 10);
    this.patchValue(tpl.abbr, [
      ...this.reviewValue(tpl),
      { author: '', rating: 5, title: '', comment: '', date: today } as ReviewEntry,
    ]);
  }

  updateReview(tpl: TabTemplate, index: number, patch: Partial<ReviewEntry>): void {
    const cur = [...this.reviewValue(tpl)];
    cur[index] = { ...cur[index], ...patch };
    this.patchValue(tpl.abbr, cur);
  }

  removeReview(tpl: TabTemplate, index: number): void {
    this.patchValue(tpl.abbr, this.reviewValue(tpl).filter((_, i) => i !== index));
  }

  averageRating(tpl: TabTemplate): number {
    const list = this.reviewValue(tpl);
    if (list.length === 0) return 0;
    const total = list.reduce((sum, r) => sum + (r.rating || 0), 0);
    return Math.round((total / list.length) * 10) / 10;
  }

  // ─── helpers ────────────────────────────────────────────────────────────
  private getTpl(abbr: string): TabTemplate {
    return this.activeTemplates().find(t => t.abbr === abbr)!;
  }

  typeKey(t: string): string { return `TAB_BUILDER.TYPES.${t.toUpperCase()}`; }
}
