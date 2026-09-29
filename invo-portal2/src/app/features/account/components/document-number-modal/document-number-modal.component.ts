import '../../account-i18n';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ToastService } from '@shared/components/toast/toast.service';

import {
  DEFAULT_PREFIX_MAP, PrefixMap, PrefixModule, PrefixSettingsService, buildPreview,
} from '../../../settings/services/prefix-settings.service';

export type NumberMode = 'auto' | 'manual';

export interface DocumentNumberData {
  module: PrefixModule;
  /** i18n key of the document name in the title ("Invoice"). */
  nameKey: string;
  mode: NumberMode;
}

/** Closes with the chosen mode and whether the prefix settings changed (caller re-reads the next number). */
export interface DocumentNumberResult { mode: NumberMode; prefixChanged: boolean; }

/**
 * "Configure <Document> Number Preferences": auto-generate from the company prefix, or type numbers
 * manually. Edits the same `company/setPrefixSettings` entry as Settings → Prefix Settings, but only
 * for this one document type.
 */
@Component({
  selector: 'app-document-number-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="'DOC_NUMBER.TITLE' | translate: { name: (data.nameKey | translate) }"/>
    <div class="dn">
      <p>{{ (mode() === 'auto' ? 'DOC_NUMBER.INTRO_AUTO' : 'DOC_NUMBER.INTRO_MANUAL') | translate: { name: (data.nameKey | translate) } }}</p>

      <label class="dn__opt">
        <input type="radio" name="mode" [checked]="mode() === 'auto'" (change)="mode.set('auto')"/>
        <span>{{ 'DOC_NUMBER.AUTO' | translate: { name: (data.nameKey | translate) } }}</span>
      </label>
      @if (mode() === 'auto') {
        <div class="dn__fields">
          <div class="dn__field">
            <label>{{ 'DOC_NUMBER.PREFIX' | translate }}</label>
            <input class="dn__input" [class.dn__input--err]="prefixError()" type="text" [ngModel]="prefix()" (ngModelChange)="prefix.set($event)"/>
            @if (prefixError()) { <small class="dn__err">{{ prefixError() | translate }}</small> }
          </div>
          <div class="dn__field">
            <label>{{ 'DOC_NUMBER.DIGITS' | translate }}</label>
            <input class="dn__input" [class.dn__input--err]="widthError()" type="number" min="1" max="10" [ngModel]="width()" (ngModelChange)="width.set(+$event)"/>
            @if (widthError()) { <small class="dn__err">{{ 'DOC_NUMBER.ERR_WIDTH' | translate }}</small> }
          </div>
          <div class="dn__preview">{{ 'DOC_NUMBER.PREVIEW' | translate }}: <b>{{ preview() }}</b></div>
        </div>
        <small class="dn__hint">{{ 'DOC_NUMBER.HINT' | translate }}</small>
      }

      <label class="dn__opt">
        <input type="radio" name="mode" [checked]="mode() === 'manual'" (change)="mode.set('manual')"/>
        <span>{{ 'DOC_NUMBER.MANUAL' | translate: { name: (data.nameKey | translate) } }}</span>
      </label>
    </div>
    <app-modal-footer>
      <button type="button" class="dn__btn dn__btn--primary" [disabled]="saving() || !valid()" (click)="save()">{{ 'COMMON.SAVE' | translate }}</button>
      <button type="button" class="dn__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .dn { padding: 16px 20px; min-width: min(520px, 90vw); display: flex; flex-direction: column; gap: 10px; }
    .dn p { margin: 0 0 4px; color: #334155; }
    .dn__opt { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    .dn__fields { display: flex; flex-wrap: wrap; gap: 12px; margin-inline-start: 24px; align-items: flex-start; }
    .dn__field { display: flex; flex-direction: column; gap: 4px; label { font-size: 12.5px; color: #475569; } }
    .dn__input { border: 1px solid #d0d5dd; border-radius: 6px; padding: 8px 10px; font: inherit; width: 150px; }
    .dn__input--err { border-color: #f87171; background: #fef2f2; }
    .dn__err { color: #dc2626; }
    .dn__preview { width: 100%; color: #475569; }
    .dn input[type=radio] { accent-color: #2691a4; width: 16px; height: 16px; }
    .dn__hint { margin-inline-start: 24px; color: #64748b; }
    .dn__btn { padding: 8px 18px; border-radius: 6px; border: 1px solid #d0d5dd; background: #f3f4f6; font-weight: 500; cursor: pointer; }
    .dn__btn--primary { background: #2691a4; border-color: #2691a4; color: #fff; }
    .dn__btn:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class DocumentNumberModalComponent implements OnInit {
  data = inject<DocumentNumberData>(MODAL_DATA);
  ref = inject<ModalRef<DocumentNumberResult | null>>(MODAL_REF);
  private prefixes = inject(PrefixSettingsService);
  private toast = inject(ToastService);

  mode = signal<NumberMode>(this.data.mode);
  prefix = signal('');
  width = signal(4);
  saving = signal(false);
  private all: PrefixMap = {};
  private original = { prefix: '', width: 4 };

  preview = computed(() => buildPreview({ prefix: this.prefix(), width: this.width() }));

  prefixError = computed(() => {
    if (this.mode() !== 'auto') return '';
    const p = this.prefix().trim();
    if (!p) return 'DOC_NUMBER.ERR_PREFIX_REQUIRED';
    const clash = Object.entries(this.all).some(([m, e]) => m !== this.data.module && (e?.prefix ?? '').trim().toLowerCase() === p.toLowerCase());
    return clash ? 'DOC_NUMBER.ERR_PREFIX_DUPLICATE' : '';
  });
  widthError = computed(() => this.mode() === 'auto' && !(this.width() >= 1 && this.width() <= 10));
  valid = computed(() => !this.prefixError() && !this.widthError());

  async ngOnInit(): Promise<void> {
    this.all = await this.prefixes.getAll();
    const cur = this.all[this.data.module] ?? DEFAULT_PREFIX_MAP[this.data.module];
    this.original = { prefix: cur.prefix, width: cur.width };
    this.prefix.set(cur.prefix);
    this.width.set(cur.width);
  }

  async save(): Promise<void> {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    try {
      let changed = false;
      if (this.mode() === 'auto') {
        const next = { prefix: this.prefix().trim(), width: this.width() };
        changed = next.prefix !== this.original.prefix || next.width !== this.original.width;
        if (changed && !(await this.prefixes.save({ ...this.all, [this.data.module]: next }))) {
          this.toast.error('COMMON.OPS');
          return;
        }
      }
      this.ref.close({ mode: this.mode(), prefixChanged: changed });
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.saving.set(false);
    }
  }
}
