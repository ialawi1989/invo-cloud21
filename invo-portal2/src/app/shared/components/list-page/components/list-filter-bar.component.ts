import {
  ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, TemplateRef, ViewChild, ViewContainerRef,
  computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, isObservable } from 'rxjs';

import { FilterConfig, FilterOption, FilterState } from '../interfaces/list-page.types';
import { DatePickerComponent } from '../../datepicker/date-picker.component';
import { TooltipDirective } from '@shared/directives/tooltip.directive';

/** What the bar tells the list page when the user finishes editing a filter. */
export interface FilterBarApply { filters: FilterState; labels: Record<string, string>; }

interface EditorState {
  key: string; label: string; kind: 'options' | 'date-range' | 'date-preset' | 'text';
  multi: boolean; options: FilterOption[]; visible: FilterOption[]; canSearch: boolean; search: string;
  selected: Map<any, FilterOption>; loading: boolean; hasMore: boolean; page: number; needsDone: boolean;
  from: string; to: string; preset: string; text: string;
}

type Editable = Extract<FilterConfig, { type: 'dropdown' | 'checkbox-group' | 'date-range' | 'date-preset' | 'search-dropdown' }>;

/**
 * Inline filter builder: one segmented chip per filter — [ field | operator | value | x ] — plus "+" and "Clear filters".
 *
 * It only changes how filters are EDITED. The values it produces have exactly the shape the filter modal produces
 * (`FilterState` + a label map), and the list page applies them through its own `applyFilters`, so the request
 * parameters are untouched. Filter types the modal cannot edit (status / multi-select) are not offered here either.
 *
 * Operators: the list APIs only take membership filters (`type IN (...)`, `brands IN (...)`) and date ranges, so the operator
 * segment shows what the filter really means — "is" (one value), "is any of" (several), "between" (a date range) — and is a
 * menu only for a field that declares more than one operator in `operators`. No "is not" / "greater than" exist server-side.
 */
@Component({
  selector: 'app-list-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DatePickerComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (chips().length > 0) {
    <div class="lfb" role="group" [attr.aria-label]="'COMMON.ACTIVE_FILTERS' | translate">
      <span class="lfb__label">{{ 'COMMON.ACTIVE_FILTERS' | translate }}</span>

      @for (c of chips(); track c.key) {
      <div class="lfb-chip" role="group" tabindex="0" [attr.data-chip]="c.key"
           [attr.aria-label]="c.fieldLabel + ' ' + c.operator + ' ' + (c.valueText || '')"
           (keydown.backspace)="onChipKey($event, c.key)" (keydown.delete)="onChipKey($event, c.key)">
        <button type="button" class="lfb-seg lfb-seg--field" (click)="openFieldPicker($event, c.key)">{{ c.fieldLabel }}</button>
        @if (c.operators.length > 1) {
          <button type="button" class="lfb-seg lfb-seg--op" (click)="openOperatorMenu($event, c.key)">{{ c.operator }}</button>
        } @else {
          <span class="lfb-seg lfb-seg--op lfb-seg--static">{{ c.operator }}</span>
        }
        <button type="button" class="lfb-seg lfb-seg--value" [class.lfb-seg--empty]="!c.valueText" (click)="openValueEditor($event, c.key)">
          {{ c.valueText || ('COMMON.FILTER_SELECT_VALUE' | translate) }}
        </button>
        <button type="button" class="lfb-seg lfb-seg--x" (click)="removeChip(c.key)"
                [attr.aria-label]="'COMMON.REMOVE_FILTER' | translate" [appTooltip]="'COMMON.REMOVE_FILTER' | translate">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      }

      @if (availableFields().length > 0) {
      <button type="button" #addBtn class="lfb-add" (click)="openFieldPicker($event, null)"
              [attr.aria-label]="'COMMON.ADD_FILTER' | translate" [appTooltip]="'COMMON.ADD_FILTER' | translate">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      }
      <button type="button" class="lfb-clear" (click)="clearAll()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        {{ 'COMMON.CLEAR_FILTERS' | translate }}
      </button>
    </div>
    }

    <!-- ── popovers (rendered in a CDK overlay) ───────────────────────────── -->
    <ng-template #fieldTpl>
      <div class="lfb-pop" role="menu">
        @if (pickerFields().length > 8) {
          <input class="lfb-pop__search" type="text" [ngModel]="pickerSearch()" (ngModelChange)="pickerSearch.set($event)"
                 [placeholder]="'COMMON.FILTER_SEARCH' | translate" [attr.aria-label]="'COMMON.FILTER_SEARCH' | translate"/>
        }
        @for (f of pickerFields(); track f.key) {
          <button type="button" role="menuitem" class="lfb-pop__item" [disabled]="f.used" (click)="chooseField(f.key)">{{ f.label }}</button>
        } @empty {
          <div class="lfb-pop__empty">{{ 'COMMON.FILTER_NO_RESULTS' | translate }}</div>
        }
      </div>
    </ng-template>

    <ng-template #opTpl>
      <div class="lfb-pop" role="menu">
        @for (o of opMenu(); track o.id) {
          <button type="button" role="menuitem" class="lfb-pop__item" [class.lfb-pop__item--on]="o.on" (click)="chooseOperator(o.id)">{{ o.label }}</button>
        }
      </div>
    </ng-template>

    <ng-template #valueTpl>
      @if (editor(); as ed) {
      <div class="lfb-pop lfb-pop--value">
        @switch (ed.kind) {
          @case ('options') {
            @if (ed.canSearch) {
              <input class="lfb-pop__search" type="text" [ngModel]="ed.search" (ngModelChange)="onEditorSearch($event)"
                     [placeholder]="'COMMON.FILTER_SEARCH' | translate" [attr.aria-label]="'COMMON.FILTER_SEARCH' | translate"/>
            }
            <div class="lfb-pop__list" role="listbox" [attr.aria-multiselectable]="ed.multi">
              @for (o of ed.visible; track o.value) {
                <button type="button" role="option" class="lfb-pop__item" [attr.aria-selected]="isSelected(o.value)"
                        [class.lfb-pop__item--on]="isSelected(o.value)" (click)="toggleOption(o)">
                  @if (ed.multi) { <span class="lfb-check" [class.lfb-check--on]="isSelected(o.value)" aria-hidden="true"></span> }
                  {{ o.label }}
                </button>
              } @empty {
                <div class="lfb-pop__empty">{{ ed.loading ? ('COMMON.LOADING' | translate) : ('COMMON.FILTER_NO_RESULTS' | translate) }}</div>
              }
              @if (ed.hasMore) {
                <button type="button" class="lfb-pop__more" (click)="loadMore()">{{ 'COMMON.LOAD_MORE' | translate }}</button>
              }
            </div>
          }
          @case ('date-range') {
            <div class="lfb-pop__dates">
              <label>{{ 'COMMON.FROM' | translate }}<app-date-picker [value]="toDate(ed.from)" (valueChange)="ed.from = fromDate($event)"/></label>
              <label>{{ 'COMMON.TO' | translate }}<app-date-picker [value]="toDate(ed.to)" (valueChange)="ed.to = fromDate($event)"/></label>
            </div>
          }
          @case ('date-preset') {
            <div class="lfb-pop__list">
              @for (o of datePresets; track o.code) {
                <button type="button" class="lfb-pop__item" [class.lfb-pop__item--on]="ed.preset === o.code" (click)="choosePreset(o.code)">{{ o.labelKey | translate }}</button>
              }
              @if (ed.preset === 'custom') {
                <div class="lfb-pop__dates">
                  <label>{{ 'COMMON.FROM' | translate }}<app-date-picker [value]="toDate(ed.from)" (valueChange)="ed.from = fromDate($event)"/></label>
                  <label>{{ 'COMMON.TO' | translate }}<app-date-picker [value]="toDate(ed.to)" (valueChange)="ed.to = fromDate($event)"/></label>
                </div>
              }
            </div>
          }
          @case ('text') {
            <input class="lfb-pop__search" type="text" [ngModel]="ed.text" (ngModelChange)="ed.text = $event" (keydown.enter)="commitEditor()"
                   [placeholder]="'COMMON.FILTER_SEARCH' | translate" [attr.aria-label]="ed.label"/>
          }
        }
        @if (ed.needsDone) {
          <div class="lfb-pop__foot"><button type="button" class="lfb-pop__done" (click)="commitEditor()">{{ 'COMMON.DONE' | translate }}</button></div>
        }
      </div>
      }
    </ng-template>
  `,
  styles: [`
    :host { display: contents; }
    .lfb { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px 16px;
           background: var(--ui-surface-1); border-bottom: 1px solid var(--ui-line); }
    .lfb__label { font-size: 12px; color: var(--ui-muted); margin-inline-end: 2px; }
    .lfb-chip { display: inline-flex; align-items: stretch; height: 28px; font-size: 13px; color: var(--ui-text-3);
                background: var(--ui-surface); border: 1px solid var(--ui-line-strong); border-radius: 8px; overflow: hidden; }
    .lfb-chip:focus-visible { outline: 2px solid var(--ui-brand-t600); outline-offset: 1px; }
    .lfb-seg { display: inline-flex; align-items: center; padding: 0 10px; border: 0; background: transparent; font: inherit; color: inherit;
               cursor: pointer; white-space: nowrap; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
    .lfb-seg + .lfb-seg { border-inline-start: 1px solid var(--ui-line); }
    .lfb-seg:hover:not(.lfb-seg--static) { background: var(--ui-hover); }
    .lfb-seg:focus-visible { outline: 2px solid var(--ui-brand-t600); outline-offset: -2px; }
    .lfb-seg--field { color: var(--ui-muted); }
    .lfb-seg--op { color: var(--ui-muted); }
    .lfb-seg--static { cursor: default; }
    .lfb-seg--value { color: var(--ui-text); font-weight: 500; }
    .lfb-seg--empty { color: var(--ui-faint); font-weight: 400; }
    .lfb-seg--x { padding: 0 8px; color: var(--ui-muted); }
    .lfb-seg--x:hover { color: var(--ui-text); }
    .lfb-add, .lfb-clear { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 28px; cursor: pointer; font: inherit; font-size: 13px; }
    .lfb-add { width: 28px; padding: 0; color: var(--ui-text-3); background: var(--ui-surface); border: 1px dashed var(--ui-line-strong); border-radius: 8px; }
    .lfb-add:hover { background: var(--ui-hover); color: var(--ui-text); }
    .lfb-clear { padding: 0 8px; color: var(--ui-brand-t600); background: transparent; border: 0; border-radius: 8px; }
    .lfb-clear:hover { background: var(--ui-hover); }
    .lfb-add:focus-visible, .lfb-clear:focus-visible { outline: 2px solid var(--ui-brand-t600); outline-offset: 1px; }

    /* popovers live in the CDK overlay container, so their styles are global-safe via ::ng-deep on the panel class */
    :host ::ng-deep .lfb-pop { min-width: 200px; max-width: 320px; background: var(--ui-elevated); color: var(--ui-text);
      border-radius: 10px; box-shadow: 0 0 0 1px var(--ui-elevated-border), 0 12px 32px rgba(0, 0, 0, .28) /* theme-ok: neutral shadow */; padding: 6px; font-size: 13px; }
    :host ::ng-deep .lfb-pop__search { width: 100%; height: 32px; margin-bottom: 6px; padding: 0 10px; border-radius: 8px; font: inherit;
      border: 1px solid var(--ui-field-border); background-color: var(--ui-field); color: var(--ui-text); }
    :host ::ng-deep .lfb-pop__list { max-height: 260px; overflow-y: auto; }
    :host ::ng-deep .lfb-pop__item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: 0; border-radius: 6px;
      background: transparent; color: inherit; font: inherit; text-align: start; cursor: pointer; }
    :host ::ng-deep .lfb-pop__item:hover:not(:disabled) { background: var(--ui-hover); }
    :host ::ng-deep .lfb-pop__item:disabled { color: var(--ui-disabled); cursor: not-allowed; }
    :host ::ng-deep .lfb-pop__item--on { background: var(--ui-selected); }
    :host ::ng-deep .lfb-pop__empty { padding: 10px; color: var(--ui-muted); text-align: center; }
    :host ::ng-deep .lfb-pop__more { width: 100%; padding: 7px; border: 0; background: transparent; color: var(--ui-brand-t600); font: inherit; cursor: pointer; }
    :host ::ng-deep .lfb-check { flex: none; width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid var(--ui-line-strong); background: var(--ui-field); }
    :host ::ng-deep .lfb-check--on { background: var(--color-brand-600); border-color: var(--color-brand-600);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E");
      background-size: 12px; background-position: center; background-repeat: no-repeat; }
    :host ::ng-deep .lfb-pop__dates { display: grid; gap: 8px; padding: 6px; }
    :host ::ng-deep .lfb-pop__dates label { display: grid; gap: 4px; font-size: 12px; color: var(--ui-muted); }
    :host ::ng-deep .lfb-pop__foot { display: flex; justify-content: flex-end; padding: 6px 4px 2px; }
    :host ::ng-deep .lfb-pop__done { height: 30px; padding: 0 14px; border: 0; border-radius: 8px; background: var(--color-brand-600); color: #fff; font: inherit; font-weight: 500; cursor: pointer; } /* theme-ok: white text on the teal button */
    :host ::ng-deep .lfb-pop__done:hover { background: var(--color-brand-700); }
  `],
})
export class ListFilterBarComponent {
  private overlay = inject(Overlay);
  private vcr = inject(ViewContainerRef);
  private translate = inject(TranslateService);
  private host = inject(ElementRef<HTMLElement>);

  /** The page's filter definitions (same objects the filter modal gets). */
  @Input() set filters(v: FilterConfig[]) { this._filters.set((v ?? []).filter(this.isEditable)); }
  /** The applied filters. */
  @Input() set active(v: FilterState) { this._active.set(v ?? {}); }
  /** Chip text for an applied filter (the list page's own `getFilterDisplayValue`). */
  @Input() display: (key: string) => string = k => k;
  /** Labels the page keeps for dropdown selections. */
  @Input() set labels(v: Record<string, string>) { this._labels.set(v ?? {}); }
  get labels(): Record<string, string> { return this._labels(); }
  private _labels = signal<Record<string, string>>({});

  /** One filter finished editing: apply it. */
  @Output() apply = new EventEmitter<FilterBarApply>();
  /** A chip's x (or Backspace): remove that filter (date ranges remove both ends). */
  @Output() remove = new EventEmitter<string>();
  /** "Clear filters". */
  @Output() clear = new EventEmitter<void>();

  @ViewChild('fieldTpl') private fieldTpl!: TemplateRef<unknown>;
  @ViewChild('opTpl') private opTpl!: TemplateRef<unknown>;
  @ViewChild('valueTpl') private valueTpl!: TemplateRef<unknown>;

  private _filters = signal<Editable[]>([]);
  private _active = signal<FilterState>({});
  /** Chips the user added but has not given a value yet (they are not filters until they have one). */
  private drafts = signal<string[]>([]);
  private order = signal<string[]>([]);
  private ref: OverlayRef | null = null;
  private fieldTarget: string | null = null;   // chip whose field is being changed (null = adding)
  private opTarget = '';

  pickerSearch = signal('');
  readonly datePresets = [
    { code: 'all', labelKey: 'COMMON.PERIOD_ALL' }, { code: 'last7', labelKey: 'COMMON.PERIOD_LAST_7' },
    { code: 'last14', labelKey: 'COMMON.PERIOD_LAST_14' }, { code: 'last30', labelKey: 'COMMON.PERIOD_LAST_30' },
    { code: 'custom', labelKey: 'COMMON.PERIOD_CUSTOM' },
  ];

  // ── model helpers ─────────────────────────────────────────────────────────
  private isEditable = (f: FilterConfig): f is Editable =>
    ['dropdown', 'checkbox-group', 'date-range', 'date-preset', 'search-dropdown'].includes(f.type);
  private fkey = (f: Editable): string => (f.type === 'date-range' ? f.keyFrom : f.key);
  private find = (key: string): Editable | undefined => this._filters().find(f => this.fkey(f) === key);
  private isOn = (f: Editable): boolean => {
    const v = this._active()[this.fkey(f)];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '';
  };

  /** Which operators a field offers. Only what the API can express — see the class comment. */
  operatorsFor(f: Editable): { id: string; label: string }[] {
    const t = (k: string) => this.translate.instant(k);
    if (f.type === 'date-range') return [{ id: 'between', label: t('COMMON.FILTER_OP_BETWEEN') }];
    if (f.type === 'date-preset') return [{ id: 'in', label: t('COMMON.FILTER_OP_IN') }];
    const multi = f.type === 'checkbox-group' || (f.type === 'dropdown' && !!f.multiple);
    return [{ id: multi ? 'anyOf' : 'is', label: t(multi ? 'COMMON.FILTER_OP_ANY_OF' : 'COMMON.FILTER_OP_IS') }];
  }

  chips = computed(() => {
    const active = this._filters().filter(this.isOn).map(f => this.fkey(f));
    const keys: string[] = [];
    for (const k of this.order()) if ((active.includes(k) || this.drafts().includes(k)) && !keys.includes(k)) keys.push(k);
    for (const k of active) if (!keys.includes(k)) keys.push(k);
    for (const k of this.drafts()) if (!keys.includes(k)) keys.push(k);
    return keys.map(k => {
      const f = this.find(k)!;
      const ops = this.operatorsFor(f);
      return {
        key: k, fieldLabel: (f as any).label as string, operators: ops, operator: ops[0].label,
        valueText: this.isOn(f) && this._labels() ? this.display(k) : '',
      };
    }).filter(c => !!this.find(c.key));
  });

  /** Fields that can still be added (one chip per field). */
  availableFields = computed(() => {
    const used = new Set(this.chips().map(c => c.key));
    return this._filters().filter(f => !used.has(this.fkey(f)));
  });

  pickerFields = computed(() => {
    const used = new Set(this.chips().map(c => c.key));
    const q = this.pickerSearch().trim().toLowerCase();
    return this._filters()
      .map(f => ({ key: this.fkey(f), label: (f as any).label as string, used: used.has(this.fkey(f)) && this.fkey(f) !== this.fieldTarget }))
      .filter(f => !q || f.label.toLowerCase().includes(q));
  });

  // ── popover plumbing ──────────────────────────────────────────────────────
  private open(origin: HTMLElement, tpl: TemplateRef<unknown>): void {
    this.closePopover();
    const ref = this.overlay.create({
      positionStrategy: this.overlay.position().flexibleConnectedTo(origin).withPush(true).withPositions([
        { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
        { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
        { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
      ]),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true, backdropClass: 'cdk-overlay-transparent-backdrop',
    });
    ref.attach(new TemplatePortal(tpl, this.vcr));
    ref.backdropClick().subscribe(() => this.dismissPopover());
    ref.keydownEvents().subscribe(e => { if (e.key === 'Escape') { e.preventDefault(); this.dismissPopover(); } });
    this.ref = ref;
    setTimeout(() => (ref.overlayElement.querySelector('input,button:not(:disabled)') as HTMLElement | null)?.focus());
  }

  private closePopover(): void { this.ref?.dispose(); this.ref = null; }

  /** Closing a value editor by clicking outside keeps what was picked (multi-select applies on close). */
  private dismissPopover(): void {
    const ed = this.editor();
    this.closePopover();
    if (ed) this.commitEditor(true);
    this.pickerSearch.set('');
  }

  private focusChip(key: string, part = '.lfb-seg--value'): void {
    setTimeout(() => (this.host.nativeElement.parentElement?.querySelector(`[data-chip="${key}"] ${part}`) as HTMLElement | null)?.focus());
  }

  // ── field picker ──────────────────────────────────────────────────────────
  /** Public: the toolbar's "Filter" button calls this to add the first chip. */
  openPicker(origin: HTMLElement): void { this.fieldTarget = null; this.pickerSearch.set(''); this.open(origin, this.fieldTpl); }

  openFieldPicker(ev: Event, replace: string | null): void {
    this.fieldTarget = replace;
    this.pickerSearch.set('');
    this.open(ev.currentTarget as HTMLElement, this.fieldTpl);
  }

  chooseField(key: string): void {
    const replace = this.fieldTarget;
    this.closePopover();
    this.pickerSearch.set('');
    if (replace && replace !== key) {
      const at = this.chips().findIndex(c => c.key === replace);
      if (this.isOn(this.find(replace)!)) this.remove.emit(replace);
      this.drafts.update(d => d.filter(x => x !== replace));
      this.order.update(o => { const n = o.filter(x => x !== replace && x !== key); n.splice(Math.max(at, 0), 0, key); return n; });
    } else if (!replace) {
      this.order.update(o => [...o.filter(x => x !== key), key]);
    }
    if (!this.isOn(this.find(key)!)) this.drafts.update(d => (d.includes(key) ? d : [...d, key]));
    // the chip is rendered on the next tick; then its value editor opens
    setTimeout(() => { const btn = this.host.nativeElement.parentElement?.querySelector(`[data-chip="${key}"] .lfb-seg--value`) as HTMLElement | null; if (btn) btn.click(); });
  }

  // ── operator menu (only fields that declare more than one operator) ───────
  opMenu = signal<{ id: string; label: string; on: boolean }[]>([]);
  openOperatorMenu(ev: Event, key: string): void {
    const f = this.find(key); if (!f) return;
    this.opTarget = key;
    this.opMenu.set(this.operatorsFor(f).map((o, i) => ({ ...o, on: i === 0 })));
    this.open(ev.currentTarget as HTMLElement, this.opTpl);
  }
  chooseOperator(_id: string): void { this.closePopover(); }

  // ── value editor ──────────────────────────────────────────────────────────
  editor = signal<EditorState | null>(null);

  isSelected = (v: any): boolean => !!this.editor()?.selected.has(v);

  async openValueEditor(ev: Event, key: string): Promise<void> {
    const f = this.find(key); if (!f) return;
    const origin = ev.currentTarget as HTMLElement;
    const cur = this._active()[key];
    const base = { key, label: (f as any).label as string, multi: false, options: [] as FilterOption[], visible: [] as FilterOption[], canSearch: false, search: '',
      selected: new Map<any, FilterOption>(), loading: false, hasMore: false, page: 1, needsDone: false, from: '', to: '', preset: 'all', text: '' };

    if (f.type === 'date-range') {
      this.editor.set({ ...base, kind: 'date-range', needsDone: true, from: String(this._active()[f.keyFrom] ?? ''), to: String(this._active()[f.keyTo] ?? '') });
    } else if (f.type === 'date-preset') {
      const s = String(cur ?? '');
      const custom = s.startsWith('custom:') ? s.slice(7).split('..') : ['', ''];
      this.editor.set({ ...base, kind: 'date-preset', needsDone: s.startsWith('custom:'), preset: !s ? 'all' : s.startsWith('custom:') ? 'custom' : s, from: custom[0] || '', to: custom[1] || '' });
    } else if (f.type === 'search-dropdown') {
      this.editor.set({ ...base, kind: 'text', needsDone: true, text: String(cur ?? '') });
    } else {
      const multi = f.type === 'checkbox-group' || (f.type === 'dropdown' && !!f.multiple);
      const ed = { ...base, kind: 'options' as const, multi, needsDone: multi };
      const have = Array.isArray(cur) ? cur : cur !== undefined && cur !== null && cur !== '' ? [cur] : [];
      const names = (this.labels[key] ?? '').split(', ');
      have.forEach((v, i) => ed.selected.set(v, { value: v, label: have.length === names.length ? names[i] : String(v) }));
      this.editor.set(ed);
      if (f.type === 'dropdown' && f.loadFn) {
        await this.fetchOptions(f, 1, '');
      } else {
        let opts: any = (f as any).options ?? [];
        if (isObservable(opts)) opts = await firstValueFrom(opts);
        this.patchEditor({ options: opts, visible: opts, canSearch: opts.length > 8 });
      }
    }
    this.open(origin, this.valueTpl);
  }

  private patchEditor(p: Partial<EditorState>): void {
    this.editor.update(e => (e ? { ...e, ...p } : e));
  }

  private async fetchOptions(f: Editable, page: number, search: string): Promise<void> {
    if (f.type !== 'dropdown' || !f.loadFn) return;
    this.patchEditor({ loading: true, canSearch: true });
    try {
      const r = await f.loadFn({ page, pageSize: 30, search });
      const prev = page > 1 ? (this.editor()?.options ?? []) : [];
      const opts = [...prev, ...(r.items ?? [])];
      this.patchEditor({ options: opts, visible: opts, hasMore: !!r.hasMore, page, loading: false });
    } catch { this.patchEditor({ loading: false }); }
  }

  onEditorSearch(q: string): void {
    const ed = this.editor(); if (!ed) return;
    const f = this.find(ed.key);
    this.patchEditor({ search: q });
    if (f?.type === 'dropdown' && f.loadFn) { void this.fetchOptions(f, 1, q); return; }
    const s = q.trim().toLowerCase();
    this.patchEditor({ visible: ed.options.filter(o => !s || o.label.toLowerCase().includes(s)) });
  }

  loadMore(): void {
    const ed = this.editor(); const f = ed && this.find(ed.key);
    if (ed && f) void this.fetchOptions(f, ed.page + 1, ed.search);
  }

  toggleOption(o: FilterOption): void {
    const ed = this.editor(); if (!ed) return;
    const sel = new Map(ed.selected);
    if (ed.multi) { sel.has(o.value) ? sel.delete(o.value) : sel.set(o.value, o); this.patchEditor({ selected: sel }); return; }
    sel.clear(); sel.set(o.value, o);
    this.patchEditor({ selected: sel });
    this.commitEditor();
  }

  choosePreset(code: string): void {
    if (code === 'custom') { this.patchEditor({ preset: 'custom', needsDone: true }); return; }
    this.patchEditor({ preset: code });
    this.commitEditor();
  }

  /** Turns the editor's state into the same FilterState + labels the modal produces and hands it to the page. */
  commitEditor(fromDismiss = false): void {
    const ed = this.editor(); if (!ed) return;
    const f = this.find(ed.key); if (!f) { this.closePopover(); return; }
    const next: FilterState = { ...this._active() };
    const labels: Record<string, string> = { ...this.labels };
    const k = ed.key;
    if (f.type === 'date-range') {
      if (ed.from) next[f.keyFrom] = ed.from; else delete next[f.keyFrom];
      if (ed.to) next[f.keyTo] = ed.to; else delete next[f.keyTo];
    } else if (f.type === 'date-preset') {
      if (ed.preset === 'all') { delete next[k]; delete labels[k]; }
      else if (ed.preset === 'custom') { if (ed.from || ed.to) next[k] = `custom:${ed.from}..${ed.to}`; else delete next[k]; delete labels[k]; }
      else { next[k] = ed.preset; delete labels[k]; }
    } else if (f.type === 'search-dropdown') {
      if (ed.text.trim()) next[k] = ed.text.trim(); else delete next[k];
    } else {
      const items = [...ed.selected.values()];
      if (ed.multi) {
        if (items.length) { next[k] = items.map(i => i.value); labels[k] = items.map(i => i.label).join(', '); } else { delete next[k]; delete labels[k]; }
      } else if (items[0]) { next[k] = items[0].value; labels[k] = items[0].label; } else { delete next[k]; delete labels[k]; }
    }
    this.closePopover();
    this.editor.set(null);
    // Dismissing with nothing changed (e.g. a new chip that never got a value) keeps the chip as it was.
    if (fromDismiss && JSON.stringify(next) === JSON.stringify(this._active()) && JSON.stringify(labels) === JSON.stringify(this._labels())) return;
    this.drafts.update(d => d.filter(x => x !== k));
    this.apply.emit({ filters: next, labels });
    if (!fromDismiss) this.focusChip(k);
  }

  // ── chip actions ──────────────────────────────────────────────────────────
  removeChip(key: string): void {
    const f = this.find(key);
    this.drafts.update(d => d.filter(x => x !== key));
    this.order.update(o => o.filter(x => x !== key));
    if (f && this.isOn(f)) this.remove.emit(key);
    setTimeout(() => (this.host.nativeElement.parentElement?.querySelector('.lfb-add') as HTMLElement | null)?.focus());
  }

  onChipKey(ev: Event, key: string): void { ev.preventDefault(); this.removeChip(key); }

  clearAll(): void { this.drafts.set([]); this.order.set([]); this.clear.emit(); }

  // ── date helpers (same encoding as the filter modal) ──────────────────────
  toDate(v: unknown): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  fromDate(v: unknown): string {
    if (!(v instanceof Date) || isNaN(v.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
}
