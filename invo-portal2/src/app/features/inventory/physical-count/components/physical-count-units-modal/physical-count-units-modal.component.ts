import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import '../../physical-count-i18n';
import { CountBatch, CountLine, CountSerial, r3 } from '../../models/physical-count.model';

export interface CountUnitsData {
  line: CountLine;
  /** Counted lines of a calculated count are read-only. */
  readOnly: boolean;
}

/** What the dialog hands back: the serials or the batches of the line, as edited. */
export interface CountUnitsResult { serials: CountSerial[]; batches: CountBatch[] }

/**
 * Serial / batch dialog of a count line (legacy `serialize-availablity` and `batch-availability`, in physical-count mode).
 * A serialized product is counted by ticking the serials found; a batch product by typing the quantity found of each batch.
 */
@Component({
  selector: 'app-physical-count-units-modal',
  standalone: true,
  imports: [FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="(isSerial ? 'PHYSICAL_COUNT.SERIALS' : 'PHYSICAL_COUNT.BATCHES') | translate"/>
    <div class="pcu">
      <div class="pcu__sub">
        <strong>{{ data.line.productName }}</strong>
        <span class="pcu__sum">{{ 'PHYSICAL_COUNT.COUNTED' | translate }}: {{ counted() }} / {{ system() }}</span>
      </div>

      @if (isSerial) {
        <div class="pcu__tools">
          <input class="pcu__input" type="text" [value]="term()" (input)="term.set($any($event.target).value)"
            [placeholder]="'PHYSICAL_COUNT.SEARCH_SERIAL' | translate" autocomplete="off"/>
          @if (!data.readOnly) {
            <button type="button" class="pcu__btn" (click)="tickAll(true)">{{ 'PHYSICAL_COUNT.TICK_ALL' | translate }}</button>
            <button type="button" class="pcu__btn" (click)="tickAll(false)">{{ 'PHYSICAL_COUNT.UNTICK_ALL' | translate }}</button>
          }
        </div>
        <ul class="pcu__list">
          @for (s of shownSerials(); track $index) {
            <li class="pcu__row" (click)="toggle(s)">
              <input type="checkbox" [checked]="s.isAvailable" [disabled]="data.readOnly" (click)="$event.stopPropagation()" (change)="toggle(s)"/>
              <span class="pcu__name">{{ s.serial }}</span>
            </li>
          } @empty {
            <li class="pcu__empty">{{ 'PHYSICAL_COUNT.NO_UNITS' | translate }}</li>
          }
        </ul>
      } @else {
        <table class="pcu__table">
          <thead>
            <tr>
              <th>{{ 'PHYSICAL_COUNT.BATCH' | translate }}</th>
              <th class="end">{{ 'PHYSICAL_COUNT.SYSTEM_QTY' | translate }}</th>
              <th class="end">{{ 'PHYSICAL_COUNT.COUNTED' | translate }}</th>
              <th class="end">{{ 'PHYSICAL_COUNT.DIFFERENCE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (b of batches(); track $index) {
              <tr>
                <td>{{ b.batch }}</td>
                <td class="end">{{ b.expectedQty }}</td>
                <td class="end">
                  <input class="pcu__num" type="number" min="0" [ngModel]="b.enteredQty" [disabled]="data.readOnly" (ngModelChange)="setQty(b, $event)"/>
                </td>
                <td class="end" [class.pcu__neg]="diff(b) < 0" [class.pcu__pos]="diff(b) > 0">{{ diff(b) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="pcu__empty">{{ 'PHYSICAL_COUNT.NO_UNITS' | translate }}</td></tr>
            }
          </tbody>
        </table>
      }
    </div>
    <app-modal-footer>
      <button type="button" class="pcu__btn" (click)="ref.close(null)">{{ (data.readOnly ? 'PHYSICAL_COUNT.CLOSE' : 'COMMON.CANCEL') | translate }}</button>
      @if (!data.readOnly) {
        <button type="button" class="pcu__btn pcu__btn--primary" (click)="apply()">{{ 'PHYSICAL_COUNT.APPLY' | translate }}</button>
      }
    </app-modal-footer>
  `,
  styles: [`
    .pcu { padding: 16px 20px; min-width: min(560px, 92vw); display: flex; flex-direction: column; gap: 12px; }
    .pcu__sub { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .pcu__sum { color: #64748b; font-size: 13px; }
    .pcu__tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .pcu__input { flex: 1; min-width: 160px; height: 36px; padding: 0 12px; border: 1px solid #d0d5dd; border-radius: 8px; font: inherit; font-size: 14px; outline: none; }
    .pcu__input:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.12); }
    .pcu__list { list-style: none; margin: 0; padding: 0; max-height: 360px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
    .pcu__row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .pcu__row:hover { background: #f1f5f9; }
    .pcu__name { flex: 1; min-width: 0; word-break: break-all; }
    .pcu__empty { padding: 18px; text-align: center; color: #94a3b8; }
    .pcu__table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .pcu__table th { background: #f8fafc; color: #64748b; font-size: 12px; text-transform: uppercase; text-align: start; padding: 8px 10px; }
    .pcu__table td { padding: 6px 10px; border-top: 1px solid #f1f5f9; }
    .pcu__table .end { text-align: end; }
    .pcu__num { width: 100px; height: 34px; padding: 0 8px; border: 1px solid #d0d5dd; border-radius: 8px; font: inherit; text-align: end; }
    .pcu__num:disabled { background: #f8fafc; color: #64748b; }
    .pcu__neg { color: #b91c1c; font-weight: 600; }
    .pcu__pos { color: #15803d; font-weight: 600; }
    .pcu__btn { padding: 8px 14px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .pcu__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
  `],
})
export class PhysicalCountUnitsModalComponent {
  readonly data = inject<CountUnitsData>(MODAL_DATA);
  readonly ref = inject<ModalRef<CountUnitsResult | null>>(MODAL_REF);

  readonly isSerial = this.data.line.productType === 'serialized';
  readonly term = signal('');
  // Edited on copies: cancelling must leave the line untouched.
  readonly serials = signal<CountSerial[]>(this.data.line.serials.map(s => ({ ...s })));
  readonly batches = signal<CountBatch[]>(this.data.line.batches.map(b => ({ ...b })));

  readonly shownSerials = computed(() => {
    const q = this.term().trim().toLowerCase();
    return q ? this.serials().filter(s => s.serial.toLowerCase().includes(q)) : this.serials();
  });
  readonly counted = computed(() => this.isSerial
    ? this.serials().filter(s => s.isAvailable).length
    : r3(this.batches().reduce((t, b) => t + (Number(b.enteredQty) || 0), 0)));
  readonly system = computed(() => this.isSerial
    ? this.serials().length
    : r3(this.batches().reduce((t, b) => t + (Number(b.expectedQty) || 0), 0)));

  diff = (b: CountBatch): number => r3((Number(b.enteredQty) || 0) - (Number(b.expectedQty) || 0));

  toggle(s: CountSerial): void {
    if (this.data.readOnly) return;
    s.isAvailable = !s.isAvailable;
    this.serials.update(l => [...l]);
  }

  tickAll(on: boolean): void {
    const q = this.term().trim().toLowerCase();
    this.serials.update(l => l.map(s => (!q || s.serial.toLowerCase().includes(q)) ? { ...s, isAvailable: on } : s));
  }

  setQty(b: CountBatch, v: unknown): void {
    b.enteredQty = Math.max(0, Number(v) || 0);
    this.batches.update(l => [...l]);
  }

  apply(): void { this.ref.close({ serials: this.serials(), batches: this.batches() }); }
}
