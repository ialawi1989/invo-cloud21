import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { FilterConfig, FilterState, FilterOption } from '../interfaces/list-page.types';
import { MODAL_DATA, MODAL_REF } from '../../../modal/modal.tokens';
import { ModalRef } from '../../../modal/modal.service';
import { SearchDropdownComponent } from '../../dropdown';

export interface FilterModalData {
  filters: FilterConfig[];
  activeFilters: FilterState;
  filterLabels?: Record<string, string>;
}

export interface FilterModalResult {
  filters: FilterState;
  labels: Record<string, string>;
}

@Component({
  selector: 'app-filter-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchDropdownComponent, TranslateModule],
  styles: [`
    /* Make the modal a flex column that fills its parent so the body can
       grow and push the footer to the bottom edge. Works for both the
       centered modal layout and the bottom-sheet drawer layout. */
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
    }
  `],
  template: `
    <!-- Header -->
    <div class="px-6 py-5 border-b border-slate-100 shrink-0">
      <h2 class="text-lg font-semibold text-slate-900">{{ 'COMMON.FILTERS' | translate }}</h2>
      <p class="text-sm text-slate-500 mt-0.5">{{ 'COMMON.FILTER_SUBTITLE' | translate }}</p>
    </div>

    <!-- Body (grows to fill, scrolls when overflowing) -->
    <div class="px-6 py-5 space-y-5 flex-1 min-h-0 overflow-y-auto">
      @for (filter of filters; track filter.label) {
        <div>
          <label class="block text-sm font-semibold text-slate-800 mb-2.5">
            {{ filter.label }}
          </label>

          <!-- Checkbox Group — grid layout -->
          @if (filter.type === 'checkbox-group') {
            <div class="grid grid-cols-2 gap-x-4 gap-y-1.5">
              @for (option of filter.options; track option.value) {
                <label class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  [class.bg-brand-50]="isCheckboxChecked(filter.key, option.value)">
                  <input type="checkbox"
                    [checked]="isCheckboxChecked(filter.key, option.value)"
                    (change)="toggleCheckbox(filter.key, option.value)"
                    class="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500 focus:ring-offset-0">
                  <span class="text-sm text-slate-700" [class.text-brand-700]="isCheckboxChecked(filter.key, option.value)"
                    [class.font-medium]="isCheckboxChecked(filter.key, option.value)">{{ option.label }}</span>
                </label>
              }
            </div>
          }

          <!-- Dropdown -->
          @if (filter.type === 'dropdown') {
            <app-search-dropdown
              [items]="filter.loadFn ? $any([]) : ($any(filter.options) || [])"
              [loadFn]="$any(filter.loadFn) || null"
              [displayWith]="$any(optionLabel)"
              [compareWith]="$any(optionCompare)"
              [multiple]="!!filter.multiple"
              [value]="filter.multiple ? getDropdownMultiValue(filter.key) : getDropdownValue(filter.key)"
              (valueChange)="filter.multiple ? setDropdownMultiValue(filter.key, $event) : setDropdownValue(filter.key, $event)"
              [placeholder]="filter.placeholder || 'Select...'"
              [searchable]="true"
              [clearable]="true"
              [preferPosition]="filter.position || 'bottom'" />
          }

          <!-- Date Range -->
          @if (filter.type === 'date-range') {
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">From</label>
                <input type="date" [ngModel]="localFilters()[filter.keyFrom]"
                  (ngModelChange)="setRawFilter(filter.keyFrom, $event)"
                  class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent">
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1">To</label>
                <input type="date" [ngModel]="localFilters()[filter.keyTo]"
                  (ngModelChange)="setRawFilter(filter.keyTo, $event)"
                  class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent">
              </div>
            </div>
          }

          <!-- Date Preset (All / Last 7 / 14 / 30 days / Custom) -->
          @if (filter.type === 'date-preset') {
            <div class="space-y-1">
              @for (opt of datePresetOptions; track opt.code) {
                <label class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  [class.bg-brand-50]="presetChoice(filter.key) === opt.code">
                  <input type="radio" [name]="'dp_' + filter.key"
                    [checked]="presetChoice(filter.key) === opt.code"
                    (change)="setPreset(filter.key, opt.code)"
                    class="w-4 h-4 text-brand-600 border-slate-300 focus:ring-brand-500 focus:ring-offset-0">
                  <span class="text-sm text-slate-700" [class.text-brand-700]="presetChoice(filter.key) === opt.code"
                    [class.font-medium]="presetChoice(filter.key) === opt.code">{{ opt.labelKey | translate }}</span>
                </label>
              }
              @if (presetChoice(filter.key) === 'custom') {
                <div class="grid grid-cols-2 gap-3 pt-2 ps-7">
                  <div>
                    <label class="block text-xs font-medium text-slate-500 mb-1">{{ 'COMMON.FROM' | translate }}</label>
                    <input type="date" [ngModel]="customFrom(filter.key)" (ngModelChange)="setCustom(filter.key, $event, customTo(filter.key))"
                      class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-slate-500 mb-1">{{ 'COMMON.TO' | translate }}</label>
                    <input type="date" [ngModel]="customTo(filter.key)" (ngModelChange)="setCustom(filter.key, customFrom(filter.key), $event)"
                      class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent">
                  </div>
                </div>
              }
            </div>
          }

          <!-- Search Dropdown -->
          @if (filter.type === 'search-dropdown') {
            <input type="text"
              [placeholder]="filter.placeholder || 'Type to search...'"
              class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent">
          }
        </div>
      }
    </div>

    <!-- Footer (pinned to the bottom) -->
    <div class="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
      <button type="button" (click)="onClear()"
        class="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors">
        {{ 'COMMON.CLEAR_ALL' | translate }}
      </button>
      <div class="flex items-center gap-2.5">
        <button type="button" (click)="onCancel()"
          class="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
          {{ 'COMMON.CANCEL' | translate }}
        </button>
        <button type="button" (click)="onApply()"
          class="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-brand-500 to-brand-700 rounded-lg shadow-sm hover:shadow-md transition-all">
          {{ 'COMMON.APPLY' | translate }}
        </button>
      </div>
    </div>
  `
})
export class FilterModalComponent {
  private modalRef = inject(MODAL_REF, { optional: true }) as ModalRef<FilterModalResult> | null;
  private modalData = inject(MODAL_DATA, { optional: true }) as FilterModalData | null;
  private translate = inject(TranslateService);

  @Input() filters: FilterConfig[] = [];
  @Input() activeFilters: FilterState = {};

  @Output() apply = new EventEmitter<FilterState>();
  @Output() cancel = new EventEmitter<void>();

  localFilters = signal<FilterState>({});

  ngOnInit(): void {
    if (this.modalData) {
      this.filters = this.modalData.filters;
      this.activeFilters = this.modalData.activeFilters;
    }
    // URL-state restore hands back a bare string when a checkbox-
    // group filter has exactly one selected option (e.g.
    // `filter_parentType=Current%20Assets`). Coerce to an array
    // here so `isCheckboxChecked` finds the value and the box
    // shows as ticked when the modal opens. Without this the
    // active filter looks "missing" inside the modal even though
    // it's clearly applied to the list.
    const coerced: FilterState = { ...this.activeFilters };
    for (const filter of this.filters) {
      if (filter.type !== 'checkbox-group' || !('key' in filter)) continue;
      const v = coerced[filter.key];
      if (v != null && !Array.isArray(v)) coerced[filter.key] = [v];
    }
    this.localFilters.set(coerced);

    // Restore dropdown selected items from active filters
    for (const filter of this.filters) {
      if (filter.type === 'dropdown' && 'key' in filter) {
        const val = this.activeFilters[filter.key];
        if (val) {
          // Try to find the label from static options
          const opts = Array.isArray(filter.options) ? filter.options : [];
          const match = opts.find((o: any) => o.value === val);
          this.selectedItems[filter.key] = match || { value: val, label: String(val) };
        }
      }
    }
  }

  toggleCheckbox(key: string, value: any): void {
    this.localFilters.update(filters => {
      const current = filters[key] || [];
      const newValue = current.includes(value)
        ? current.filter((v: any) => v !== value)
        : [...current, value];

      return { ...filters, [key]: newValue.length > 0 ? newValue : undefined };
    });
  }

  setRawFilter(key: string, value: any): void {
    this.localFilters.update(f => ({ ...f, [key]: value }));
  }

  // ── Date-preset filter ──────────────────────────────────────────────
  readonly datePresetOptions = [
    { code: 'all',    labelKey: 'COMMON.PERIOD_ALL' },
    { code: 'last7',  labelKey: 'COMMON.PERIOD_LAST_7' },
    { code: 'last14', labelKey: 'COMMON.PERIOD_LAST_14' },
    { code: 'last30', labelKey: 'COMMON.PERIOD_LAST_30' },
    { code: 'custom', labelKey: 'COMMON.PERIOD_CUSTOM' },
  ];

  /** Custom range is encoded comma-free as `custom:<from>..<to>` so it
   *  survives the URL codec (which splits any value containing a comma). */
  private parseCustom(v: any): { from: string; to: string } {
    const s = String(v ?? '');
    if (!s.startsWith('custom:')) return { from: '', to: '' };
    const [from, to] = s.slice(7).split('..');
    return { from: from || '', to: to || '' };
  }

  /** Which preset radio is active for a given filter key. */
  presetChoice(key: string): string {
    const v = this.localFilters()[key];
    if (v == null || v === '') return 'all';
    const s = String(v);
    return s.startsWith('custom:') ? 'custom' : s;
  }

  setPreset(key: string, code: string): void {
    this.localFilters.update(f => {
      if (code === 'all') return { ...f, [key]: undefined };
      if (code === 'custom') {
        const cur = String(f[key] ?? '');
        return { ...f, [key]: cur.startsWith('custom:') ? cur : 'custom:..' };
      }
      return { ...f, [key]: code };
    });
  }

  customFrom(key: string): string { return this.parseCustom(this.localFilters()[key]).from; }
  customTo(key: string):   string { return this.parseCustom(this.localFilters()[key]).to; }

  setCustom(key: string, from: string, to: string): void {
    this.localFilters.update(f => ({ ...f, [key]: `custom:${from || ''}..${to || ''}` }));
  }

  isCheckboxChecked(key: string, value: any): boolean {
    const current = this.localFilters()[key];
    return Array.isArray(current) && current.includes(value);
  }

  optionLabel = (item: any): string => item?.label ?? String(item);
  optionCompare = (a: any, b: any): boolean => {
    const aVal = a?.value ?? a;
    const bVal = b?.value ?? b;
    return aVal === bVal;
  };

  // Store full selected items so labels are preserved for display
  private selectedItems: Record<string, FilterOption | null> = {};

  getDropdownValue(key: string): FilterOption | null {
    return this.selectedItems[key] ?? null;
  }

  setDropdownValue(key: string, item: any): void {
    this.selectedItems[key] = item ?? null;
    this.localFilters.update(f => ({
      ...f,
      [key]: item?.value ?? undefined
    }));
  }

  getDropdownMultiValue(key: string): FilterOption[] {
    const val = this.localFilters()[key];
    if (!Array.isArray(val)) return [];
    return val.map((v: any) => {
      const existing = (this.selectedItems[key] as any)?.[v];
      return existing || { value: v, label: String(v) };
    });
  }

  setDropdownMultiValue(key: string, items: any): void {
    const arr = Array.isArray(items) ? items : [];
    const lookup: Record<string, FilterOption> = {};
    arr.forEach((item: any) => { lookup[item.value] = item; });
    (this.selectedItems as any)[key] = lookup;
    this.localFilters.update(f => ({
      ...f,
      [key]: arr.length > 0 ? arr.map((i: any) => i.value) : undefined
    }));
  }

  isFilterOptionArray(options: any): options is FilterOption[] {
    return Array.isArray(options);
  }

  onApply(): void {
    // Drop empty custom date-preset objects ({from:'', to:''}) so they don't
    // count as an active filter.
    const presetKeys = new Set(this.filters.filter(f => f.type === 'date-preset' && 'key' in f).map(f => (f as any).key));
    const cleaned = Object.entries(this.localFilters())
      .filter(([key, value]) => {
        if (Array.isArray(value)) return value.length > 0;
        if (presetKeys.has(key) && typeof value === 'string' && value.startsWith('custom:')) {
          const { from, to } = this.parseCustom(value);
          return !!(from || to);
        }
        return value !== null && value !== undefined && value !== '';
      })
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as FilterState);

    // Build labels map from selectedItems
    const labels: Record<string, string> = {};
    for (const [key, item] of Object.entries(this.selectedItems)) {
      if (!item) continue;
      if (typeof item === 'object' && 'label' in item) {
        labels[key] = item.label;
      } else if (typeof item === 'object') {
        // Multi-select lookup map
        const lookup = item as any as Record<string, FilterOption>;
        const names = Object.values(lookup).map(o => o.label).filter(Boolean);
        if (names.length) labels[key] = names.join(', ');
      }
    }
    // Date-preset labels (e.g. "Last 7 days" or "Jun 1 – Jun 7")
    for (const filter of this.filters) {
      if (filter.type !== 'date-preset' || !('key' in filter)) continue;
      const v = cleaned[(filter as any).key];
      if (!v) continue;
      const s = String(v);
      if (s.startsWith('custom:')) {
        const { from, to } = this.parseCustom(s);
        const fmt = (d: string) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '…';
        labels[(filter as any).key] = `${fmt(from)} – ${fmt(to)}`;
      } else {
        const opt = this.datePresetOptions.find(o => o.code === s);
        labels[(filter as any).key] = opt ? this.translate.instant(opt.labelKey) : s;
      }
    }

    // Also add checkbox-group labels
    for (const filter of this.filters) {
      if (filter.type === 'checkbox-group' && 'key' in filter && cleaned[filter.key]) {
        const vals = cleaned[filter.key] as string[];
        const opts = Array.isArray(filter.options) ? filter.options : [];
        const names = vals.map(v => opts.find(o => o.value === v)?.label || v);
        labels[filter.key] = names.join(', ');
      }
    }

    if (this.modalRef) {
      this.modalRef.close({ filters: cleaned, labels });
    } else {
      this.apply.emit(cleaned);
    }
  }

  onClear(): void {
    this.localFilters.set({});
  }

  onCancel(): void {
    if (this.modalRef) {
      this.modalRef.dismiss();
    } else {
      this.cancel.emit();
    }
  }
}
