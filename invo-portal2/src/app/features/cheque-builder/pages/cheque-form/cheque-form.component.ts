import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { CanLeaveComponent } from '@core/guards/unsaved-changes.guard';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { RangeSliderComponent } from '@shared/components/range-slider/range-slider.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';

import '../../cheque-builder-i18n';
import {
  CHEQUE_DPIS, CHEQUE_FIELD_TYPES, CHEQUE_LANGUAGES, ChequeFieldType, ChequeTemplate, ChequeText,
  newChequeText, newChequeTemplate,
} from '../../models/cheque-template.model';
import { ChequeBuilderService } from '../../services/cheque-builder.service';

const HINDI = '٠١٢٣٤٥٦٧٨٩';
const toHindi = (s: string) => s.replace(/\d/g, d => HINDI[+d]);

/**
 * Cheque template editor (`/settings/cheque-builder/new|:id`). Legacy `ChequeBuilderFormComponent`: template
 * settings (name, size in inches, DPI), a cheque canvas drawn at `inches x dpi` pixels with a zoom, and draggable
 * text blocks (date / payee / amount / statement / crossing / cheque number). The legacy canvas could not actually
 * add or drag a block (its handlers were stubs), so the canvas here is a small pointer-drag one over the same model.
 */
@Component({
  selector: 'app-cheque-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule, SearchDropdownComponent, EmptyStateComponent,
    RangeSliderComponent, SegmentedToggleComponent, ToggleComponent,
  ],
  templateUrl: './cheque-form.component.html',
  styleUrl: './cheque-form.component.scss',
})
export class ChequeFormComponent implements OnInit, CanLeaveComponent {
  private service = inject(ChequeBuilderService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);

  tpl: ChequeTemplate = newChequeTemplate();
  selected: ChequeText | null = null;
  zoom = 55;
  loading = true;
  notFound = false;
  saving = false;
  showErrors = false;
  dirty = false;
  saved = false;

  readonly fieldTypes = CHEQUE_FIELD_TYPES;
  readonly dpis = CHEQUE_DPIS;
  readonly languages = CHEQUE_LANGUAGES;
  weightOptions: SegmentedToggleOption<string>[] = [
    { value: 'normal', label: 'CHEQUE_BUILDER.WEIGHT_NORMAL' },
    { value: 'bold', label: 'CHEQUE_BUILDER.WEIGHT_BOLD' },
  ];
  directionOptions: SegmentedToggleOption<string>[] = [
    { value: 'ltr', label: 'CHEQUE_BUILDER.LTR' },
    { value: 'rtl', label: 'CHEQUE_BUILDER.RTL' },
  ];

  private drag: { el: ChequeText; sx: number; sy: number; ox: number; oy: number } | null = null;

  get isNew(): boolean { return !this.route.snapshot.paramMap.get('id'); }
  get title(): string { return this.lang.instant(this.isNew ? 'CHEQUE_BUILDER.FORM_NEW' : 'CHEQUE_BUILDER.FORM_EDIT'); }
  get canvasW(): number { return Math.round(this.tpl.chequeWidth * this.tpl.dpi); }
  get canvasH(): number { return Math.round(this.tpl.chequeHeight * this.tpl.dpi); }

  hasUnsavedChanges(): boolean { return this.dirty && !this.saved; }

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('cheque-builder');
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const found = await this.service.getById(id);
      if (found) this.tpl = found; else this.notFound = true;
    }
    this.loading = false;
  }

  // ── dropdown helpers (strings) ─────────────────────────────────────────
  langLabel = (c: string) => { const k = 'CHEQUE_BUILDER.LANG.' + c; const v = this.lang.instant(k); return v === k ? c : v; };
  dpiLabel = (d: number) => String(d);
  fieldLabel(t: string): string { return this.lang.instant('CHEQUE_BUILDER.FIELD.' + t); }

  touch(): void { this.dirty = true; }

  // ── canvas ─────────────────────────────────────────────────────────────
  add(type: ChequeFieldType): void {
    const el = newChequeText(type, { x: 10, y: 10 + this.tpl.template.length * 30 });
    this.tpl.template = [...this.tpl.template, el];
    this.selected = el;
    this.touch();
  }

  remove(el: ChequeText): void {
    this.tpl.template = this.tpl.template.filter(e => e !== el);
    if (this.selected === el) this.selected = null;
    this.touch();
  }

  select(el: ChequeText, ev?: Event): void { ev?.stopPropagation(); this.selected = el; }

  startDrag(el: ChequeText, ev: PointerEvent): void {
    this.selected = el;
    this.drag = { el, sx: ev.clientX, sy: ev.clientY, ox: el.position.x, oy: el.position.y };
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  }

  @HostListener('document:pointermove', ['$event'])
  onMove(ev: PointerEvent): void {
    if (!this.drag) return;
    const f = this.zoom / 100 || 1;
    const x = this.drag.ox + (ev.clientX - this.drag.sx) / f;
    const y = this.drag.oy + (ev.clientY - this.drag.sy) / f;
    this.drag.el.position = {
      x: Math.round(Math.min(Math.max(0, x), Math.max(0, this.canvasW - 10))),
      y: Math.round(Math.min(Math.max(0, y), Math.max(0, this.canvasH - 10))),
    };
    this.touch();
  }

  @HostListener('document:pointerup')
  onUp(): void { this.drag = null; }

  /** Sample text of a block on the canvas. */
  preview(el: ChequeText): string {
    const c: any = el.content;
    const t = (k: string) => this.lang.instant('CHEQUE_BUILDER.' + k);
    const num = (s: string) => (c.useHindiNumbers ? toHindi(s) : s);
    switch (c.type) {
      case 'Date': {
        const d = new Date(c.date);
        const p = (n: number) => String(n).padStart(2, '0');
        return num(`${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`);
      }
      case 'Payee': return [c.phraseBefore, c.payeeName || t('SAMPLE_PAYEE'), c.phraseAfter].filter(Boolean).join(' ');
      case 'AmountAndCurrency': {
        const s = c.surroundAmountBy ?? '';
        const amount = Number(c.amount || 0).toLocaleString('en-US', { minimumFractionDigits: c.autoFillDecimalPoints ? 3 : 0, useGrouping: !c.hideThousandComa });
        return `${s}${num(amount)}${s} ${c.currency ?? ''}`.trim();
      }
      case 'Statement': return c.checkStatement || t('SAMPLE_STATEMENT');
      case 'Crossing': return c.text || t('SAMPLE_CROSSING');
      case 'ChequeNumber': return c.text || t('SAMPLE_NUMBER');
    }
    return '';
  }

  isHidden(el: ChequeText): boolean { return (el.content as any).isVisible === false; }
  c(el: ChequeText): any { return el.content as any; }

  // ── save ───────────────────────────────────────────────────────────────
  async save(): Promise<void> {
    this.showErrors = true;
    if (!this.tpl.name.trim()) return;
    this.saving = true;
    try {
      const res = await this.service.save(this.tpl);
      if (res.success) {
        this.saved = true;
        this.toast.success('CHEQUE_BUILDER.SAVED');
        void this.router.navigate(['/settings/cheque-builder']);
      } else {
        this.toast.error('COMMON.OPS', this.lang.instant('CHEQUE_BUILDER.SAVE_FAILED'));
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.message ?? this.lang.instant('CHEQUE_BUILDER.SAVE_FAILED'));
    } finally {
      this.saving = false;
    }
  }

  cancel(): void { void this.router.navigate(['/settings/cheque-builder']); }
}
