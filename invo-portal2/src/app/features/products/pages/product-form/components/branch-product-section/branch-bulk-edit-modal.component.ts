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
import { ToggleComponent } from '@shared/components/toggle/toggle.component';

/** One editable field offered by the bulk editor. The caller decides which
 *  ones exist (visibility + privilege gating lives in the section). */
export interface BulkEditField {
  /** FormGroup control name the value is patched into. */
  key:   string;
  /** i18n key for the row label. */
  label: string;
  type:  'toggle' | 'number';
  /** Value the control starts on when the row is enabled. */
  value: boolean | number;
}

export interface BulkEditData {
  selectedCount: number;
  fields: BulkEditField[];
}

/** Only the rows the user ticked — untouched fields stay untouched. */
export type BulkEditResult = Record<string, boolean | number>;

/**
 * Bulk edit for the selected branches.
 *
 * Same fields the old bulk-edit table exposed as columns (available,
 * available online, reorder point / level, cost + opening balances on new
 * products), except you set each one once and it lands on every selected
 * branch. Every row is opt-in: a field with its checkbox off is not written
 * at all, so a bulk change can't silently reset something you didn't mean
 * to touch.
 */
@Component({
  selector: 'app-branch-bulk-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, ToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'PRODUCTS.FORM.BULK_EDIT_TITLE' | translate"/>

    <div class="be">
      <p class="be__hint">
        {{ 'PRODUCTS.FORM.BULK_EDIT_HINT' | translate: { count: data.selectedCount } }}
      </p>

      @for (f of data.fields; track f.key) {
        <label class="be__row" [class.be__row--on]="isOn(f.key)">
          <input type="checkbox"
                 class="be__check"
                 [checked]="isOn(f.key)"
                 (change)="toggleField(f.key)"/>
          <span class="be__label">{{ f.label | translate }}</span>

          <span class="be__control">
            @if (f.type === 'toggle') {
              <app-toggle
                [checked]="$any(valueOf(f.key))"
                [disabled]="!isOn(f.key)"
                (checkedChange)="setValue(f.key, $event)"/>
            } @else {
              <input type="number"
                     class="be__num"
                     min="0"
                     [disabled]="!isOn(f.key)"
                     [value]="valueOf(f.key)"
                     (input)="setValue(f.key, $any($event.target).value)"/>
            }
          </span>
        </label>
      }
    </div>

    <app-modal-footer>
      <button type="button" class="btn btn-ghost" (click)="ref.close()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button type="button" class="btn btn-primary" [disabled]="!enabled().size" (click)="apply()">
        {{ 'PRODUCTS.FORM.BULK_EDIT_APPLY' | translate: { count: data.selectedCount } }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .be { padding: 16px 18px; display: flex; flex-direction: column; gap: 4px; }
    .be__hint { margin: 0 0 8px; font-size: 12.5px; color: #64748b; }
    .be__row {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; border: 1px solid #eef2f7; border-radius: 8px;
      cursor: pointer; background: #fff;
    }
    .be__row + .be__row { margin-top: 2px; }
    .be__row--on { border-color: #a5dde6; background: #f4fbfc; }
    .be__check { width: 16px; height: 16px; accent-color: #32acc1; cursor: pointer; flex: none; }
    .be__label { flex: 1; min-width: 0; font-size: 13px; color: #1e293b; }
    .be__control { display: inline-flex; align-items: center; }
    .be__num {
      width: 110px; padding: 6px 8px; font-size: 13px;
      border: 1px solid #dbe2ea; border-radius: 6px; background: #fff; color: #1e293b;
    }
    .be__num:focus { outline: 2px solid #32acc1; outline-offset: 1px; }
    .be__num:disabled { background: #f8fafc; color: #94a3b8; }
  `],
})
export class BranchBulkEditModalComponent {
  data = inject<BulkEditData>(MODAL_DATA);
  ref  = inject<ModalRef<BulkEditResult | undefined>>(MODAL_REF);

  /** Control names the user opted into. */
  enabled = signal<Set<string>>(new Set());
  /** Working values, seeded from the field defs. */
  private values = signal<Record<string, boolean | number>>(
    Object.fromEntries(this.data.fields.map(f => [f.key, f.value])),
  );

  isOn(key: string): boolean { return this.enabled().has(key); }
  valueOf(key: string): boolean | number { return this.values()[key]; }

  toggleField(key: string): void {
    this.enabled.update((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  setValue(key: string, value: boolean | string): void {
    const field = this.data.fields.find(f => f.key === key);
    const parsed = field?.type === 'number' ? Number(value) : !!value;
    this.values.update(v => ({ ...v, [key]: parsed as boolean | number }));
    // Touching a control implies you want it applied.
    if (!this.isOn(key)) this.toggleField(key);
  }

  apply(): void {
    const out: BulkEditResult = {};
    for (const key of this.enabled()) {
      const value = this.values()[key];
      const field = this.data.fields.find(f => f.key === key);
      // A blank / non-numeric number field would patch NaN — skip it.
      if (field?.type === 'number' && !Number.isFinite(Number(value))) continue;
      out[key] = value;
    }
    this.ref.close(Object.keys(out).length ? out : undefined);
  }
}
