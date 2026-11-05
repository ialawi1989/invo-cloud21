import '../../account-i18n';
import { Component, computed, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';

export interface SerialBatchOption { value: string; hint?: string; disabled: boolean; }
export interface SerialBatchData {
  kind: 'serial' | 'batch';
  options: SerialBatchOption[];
  selected: string;
}

/**
 * Picker for a serialized / batch line (legacy SerialListComponent + BatchListComponent in one):
 * one value per line; values already taken by another line are shown disabled.
 */
@Component({
  selector: 'app-doc-serial-batch-modal',
  standalone: true,
  imports: [TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="(data.kind === 'serial' ? 'DOC_LINES.CHOOSE_SERIAL' : 'DOC_LINES.CHOOSE_BATCH') | translate"/>
    <div class="sb">
      <input class="sb__search" type="text" [value]="term()" (input)="term.set($any($event.target).value)"
        [placeholder]="'DOC_LINES.SEARCH' | translate" autocomplete="off"/>
      <ul class="sb__list">
        @for (o of shown(); track o.value) {
          <li class="sb__item" [class.sb__item--on]="picked() === o.value" [class.sb__item--off]="o.disabled"
            (click)="!o.disabled && picked.set(picked() === o.value ? '' : o.value)">
            <strong>{{ o.value }}</strong>
            @if (o.hint) { <small>{{ o.hint }}</small> }
          </li>
        } @empty {
          <li class="sb__empty">{{ (data.kind === 'serial' ? 'DOC_LINES.NO_SERIAL_FOUND' : 'DOC_LINES.NO_BATCH_FOUND') | translate }}</li>
        }
      </ul>
    </div>
    <app-modal-footer>
      <button type="button" class="sb__btn sb__btn--primary" [disabled]="!picked()" (click)="ref.close(picked())">{{ 'DOC_LINES.SELECT' | translate }}</button>
      <button type="button" class="sb__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .sb { padding: 16px 20px; min-width: min(460px, 90vw); display: flex; flex-direction: column; gap: 10px; }
    .sb__search { height: 38px; padding: 0 12px; border: 1px solid #d0d5dd; border-radius: 8px; font: inherit; font-size: 14px; outline: none; }
    .sb__search:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.12); }
    .sb__list { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
    .sb__item { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .sb__item small { color: #64748b; }
    .sb__item:hover:not(.sb__item--off) { background: #f1f5f9; }
    .sb__item--on { border-color: #2691a4; background: #e8f4f7; }
    .sb__item--off { opacity: .45; cursor: not-allowed; }
    .sb__empty { padding: 18px; text-align: center; color: #94a3b8; }
    .sb__btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .sb__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
    .sb__btn--primary:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class DocSerialBatchModalComponent {
  data = inject<SerialBatchData>(MODAL_DATA);
  ref = inject<ModalRef<string | null>>(MODAL_REF);

  term = signal('');
  picked = signal(this.data.selected || '');
  shown = computed(() => {
    const t = this.term().trim().toLowerCase();
    return t ? this.data.options.filter(o => o.value.toLowerCase().includes(t)) : this.data.options;
  });
}
