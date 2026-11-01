import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { ProductListService } from '../../../../services/product-list.service';
import {
  ProductSheetColumn,
  ProductSheetExportRequest,
  ProductSheetPreset,
  ProductSheetRegistry,
  SheetFormat,
} from '../../../../models/product-sheet/product-sheet.types';
import { groupColumns } from '../../../../utils/product-sheet-parser';
import { downloadBlob } from '../../../../utils/download-blob';
import { TooltipDirective } from '@shared/directives/tooltip.directive';

const STORAGE_KEY = 'productSheetExport';

interface SavedChoice { columns: string[]; branchId: string | null; format: SheetFormat; }
interface Item { label: string; value: any; }

/**
 * The Export tab: pick columns (or a preset), a branch for the branch columns
 * and a format. The file comes back in the layout the Import tab reads, so it
 * can be edited in Excel and imported unchanged. Port of legacy
 * `product-sheet-export`.
 */
@Component({
  selector: 'app-product-sheet-export',
  standalone: true,
  imports: [TranslateModule, SearchDropdownComponent, SegmentedToggleComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-sheet-export.component.html',
})
export class ProductSheetExportComponent {
  private readonly list = inject(ProductListService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  registry = input.required<ProductSheetRegistry>();
  branches = input<{ id: string; name: string }[]>([]);

  selected = signal<Set<string>>(new Set());
  branchId = signal<string | null>(null);
  format = signal<SheetFormat>('xlsx');
  busy = signal(false);
  error = signal<string | null>(null);

  readonly formatOptions: SegmentedToggleOption<SheetFormat>[] = [
    { value: 'xlsx', label: 'PRODUCTS.PRODUCT_SHEET.FORMAT_XLSX' },
    { value: 'csv',  label: 'PRODUCTS.PRODUCT_SHEET.FORMAT_CSV' },
  ];

  columnGroups = computed(() => groupColumns(this.registry()));

  presetItems = computed<Item[]>(() => this.registry().presets.map(p => ({ label: p.name, value: p.key })));
  branchItems = computed<Item[]>(() => this.branches().map(b => ({ label: b.name || '—', value: b.id })));

  /** The preset whose columns are exactly the ticked ones, if any. */
  presetKey = computed<string | null>(() =>
    this.registry().presets.find(p => this.sameSet(this.presetColumns(p)))?.key ?? null);
  selectedPresetItem = computed(() => this.presetItems().find(i => i.value === this.presetKey()) ?? null);
  selectedBranchItem = computed(() => this.branchItems().find(i => i.value === this.branchId()) ?? null);

  hasBranchColumn = computed(() =>
    this.registry().columns.some(c => c.target === 'branch' && this.selected().has(c.key)));
  /** One branch is exported; the server needs it named when there is a choice. */
  needsBranch = computed(() => this.hasBranchColumn() && this.branches().length > 1);
  canExport = computed(() => !this.busy() && (!this.needsBranch() || !!this.branchId()));

  display = (i: any) => i?.label ?? '';
  compare = (a: any, b: any) => (a?.value ?? a) === (b?.value ?? b);
  toValue = (i: any) => i?.value ?? i;

  constructor() {
    effect(() => {
      const reg = this.registry();
      if (reg) this.restore(reg);
    });
    effect(() => {
      const b = this.branches();
      if (b.length === 1) this.branchId.set(b[0].id);
    });
  }

  isLocked(key: string): boolean { return this.registry().alwaysExported.includes(key); }

  toggle(key: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) next.add(key);
    else if (!this.isLocked(key)) next.delete(key);
    this.selected.set(next);
    this.save();
  }

  groupState(columns: ProductSheetColumn[]): 'all' | 'some' | 'none' {
    const n = columns.filter(c => this.selected().has(c.key)).length;
    return n === columns.length ? 'all' : n ? 'some' : 'none';
  }

  toggleGroup(columns: ProductSheetColumn[], checked: boolean): void {
    const next = new Set(this.selected());
    columns.forEach(c => { if (checked) next.add(c.key); else if (!this.isLocked(c.key)) next.delete(c.key); });
    this.selected.set(next);
    this.save();
  }

  /** Which product types a column applies to, and whether it only counts on create. */
  columnHint(column: ProductSheetColumn): string {
    const parts: string[] = [];
    if (column.types !== 'all') parts.push(this.translate.instant('PRODUCTS.PRODUCT_SHEET.APPLIES_TO', { types: column.types.join(', ') }));
    if (column.createOnly) parts.push(this.translate.instant('PRODUCTS.PRODUCT_SHEET.CREATE_ONLY'));
    return parts.join(' ');
  }

  applyPreset(ev: any): void {
    const key = ev && typeof ev === 'object' ? ev.value : ev;
    const preset = this.registry().presets.find(p => p.key === key);
    if (preset) { this.selected.set(new Set(this.presetColumns(preset))); this.save(); }
  }

  onBranchChange(ev: any): void {
    const id = ev && typeof ev === 'object' ? ev.value : ev;
    this.branchId.set(id ?? null);
    this.save();
  }

  setFormat(f: SheetFormat): void { this.format.set(f); this.save(); }

  async export(): Promise<void> {
    if (!this.canExport()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const { blob, fileName } = await this.list.exportProductSheet(this.request());
      downloadBlob(blob, fileName);
      this.toast.success('PRODUCTS.PRODUCT_SHEET.EXPORT_DONE');
    } catch (err: any) {
      this.error.set(err?.error?.msg || err?.message || this.translate.instant('PRODUCTS.PRODUCT_SHEET.EXPORT_FAILED'));
    } finally {
      this.busy.set(false);
    }
  }

  private request(): ProductSheetExportRequest {
    const preset = this.presetKey();
    return {
      ...(preset
        ? { preset }
        // Registry order, which is also the order the file's columns come in.
        : { columns: this.registry().columns.map(c => c.key).filter(k => this.selected().has(k)) }),
      branchId: this.hasBranchColumn() && this.branchId() ? this.branchId()! : undefined,
      format: this.format(),
    };
  }

  // ── Last choice (per-viewer convenience only) ────────────────
  private presetColumns(p: ProductSheetPreset): string[] {
    return [...new Set([...this.registry().alwaysExported, ...p.columns])];
  }

  private sameSet(keys: string[]): boolean {
    const sel = this.selected();
    return keys.length === sel.size && keys.every(k => sel.has(k));
  }

  private restore(reg: ProductSheetRegistry): void {
    let saved: SavedChoice | null = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); } catch { saved = null; }

    const known = new Set(reg.columns.map(c => c.key));
    const columns = (saved?.columns ?? []).filter(k => known.has(k));
    if (columns.length) this.selected.set(new Set([...reg.alwaysExported, ...columns]));
    else if (reg.presets.length) this.selected.set(new Set([...new Set([...reg.alwaysExported, ...reg.presets[0].columns])]));
    else this.selected.set(new Set(reg.alwaysExported));

    this.format.set(saved?.format === 'csv' ? 'csv' : 'xlsx');
    const b = this.branches();
    if (saved?.branchId && (!b.length || b.some(x => x.id === saved!.branchId))) this.branchId.set(saved.branchId);
  }

  private save(): void {
    try {
      const choice: SavedChoice = { columns: [...this.selected()], branchId: this.branchId(), format: this.format() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch { /* remembering the choice is a convenience only */ }
  }
}
