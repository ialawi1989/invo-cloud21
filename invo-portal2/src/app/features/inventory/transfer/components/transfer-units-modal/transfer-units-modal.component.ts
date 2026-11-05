import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import type { ModalRef } from '@shared/modal/modal.service';

import '../../transfer-i18n';
import { SalesLookupsService } from '../../../../account/services/sales-lookups.service';
import { TransferLine, TransferSubLine } from '../../models/inventory-transfer.model';

export type TransferUnitsMode = 'serial-out' | 'batch-out' | 'serial-in' | 'batch-in';

export interface TransferUnitsData {
  mode: TransferUnitsMode;
  line: TransferLine;
  branchId: string;
  /** Show unit cost fields (the `showProductCost` privilege). */
  showCost: boolean;
}

/** The serials / batches of the line after the dialog: picked ones, plus saved ones that were un-picked or removed. */
export type TransferUnitsResult = TransferSubLine[];

const ymd = (d: Date | string | null): string | null => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return isNaN(x.getTime()) ? null : `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const today = () => ymd(new Date())!;
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d)!; };
const toDate = (s: string | null): Date | null => (s ? new Date(s.slice(0, 10) + 'T00:00:00') : null);

/**
 * Serial / batch dialog of a transfer line (legacy `serialize-availablity`, `batch-availability`, `serialize-transfer-in`
 * and `batch-transfer-in` in one). Transfer out picks from what the branch holds - ticking serials, or ticking batches
 * with a quantity up to their on-hand. Transfer in types the new serials / batches (batches carry quantity, cost and
 * production / expiry dates; expiry must be after production).
 */
@Component({
  selector: 'app-transfer-units-modal',
  standalone: true,
  imports: [FormsModule, TranslateModule, DatePickerComponent, ModalHeaderComponent, ModalFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="title() | translate"/>
    <div class="tum">
      <div class="tum__sub"><strong>{{ data.line.productName }}</strong></div>

      @if (isIn) {
        <div class="tum__add">
          <input class="tum__input" type="text" [value]="newName()" (input)="newName.set($any($event.target).value)" (keydown.enter)="add()"
            [placeholder]="(isSerial ? 'INVENTORY_TRANSFER.NEW_SERIAL' : 'INVENTORY_TRANSFER.NEW_BATCH') | translate" autocomplete="off"/>
          <button type="button" class="tum__btn tum__btn--primary" [disabled]="!canAdd()" (click)="add()">{{ 'INVENTORY_TRANSFER.ADD' | translate }}</button>
        </div>
        @if (duplicate()) { <p class="tum__err">{{ 'INVENTORY_TRANSFER.DUPLICATE' | translate }}</p> }
      } @else {
        <input class="tum__input" type="text" [value]="term()" (input)="term.set($any($event.target).value)"
          [placeholder]="'DOC_LINES.SEARCH' | translate" autocomplete="off"/>
      }

      @if (loading()) {
        <p class="tum__empty">…</p>
      } @else {
        <ul class="tum__list">
          @for (u of shown(); track $index) {
            @if (!u.isDeleted) {
              <li class="tum__row" [class.tum__row--expired]="u.expired">
                @if (!isIn) { <input type="checkbox" [checked]="u.isSelected" (change)="toggle(u)"/> }
                <strong class="tum__name">{{ isSerial ? u.serial : u.batch }}</strong>
                @if (!isSerial) {
                  @if (!isIn) {
                    <small>{{ 'INVENTORY_TRANSFER.ON_HAND' | translate }}: {{ u.onHand }}</small>
                    @if (u.expireDate) { <small [class.tum__bad]="u.expired">{{ 'INVENTORY_TRANSFER.EXPIRY' | translate }}: {{ d10(u.expireDate) }}</small> }
                    <input class="tum__qty" type="number" min="0" [max]="u.onHand" [disabled]="!u.isSelected"
                      [ngModel]="u.qty" (ngModelChange)="setQty(u, $event)"/>
                  } @else {
                    <label class="tum__fld">{{ 'INVENTORY_TRANSFER.QTY' | translate }}
                      <input class="tum__qty" type="number" min="0" [ngModel]="u.qty" (ngModelChange)="setQty(u, $event)"/>
                    </label>
                    <label class="tum__fld">{{ 'INVENTORY_TRANSFER.PRODUCTION' | translate }}
                      <app-date-picker [value]="date(u.prodDate)" (valueChange)="setDate(u, 'prodDate', $event)"/>
                    </label>
                    <label class="tum__fld">{{ 'INVENTORY_TRANSFER.EXPIRY' | translate }}
                      <app-date-picker [value]="date(u.expireDate)" [min]="date(u.prodDate)" (valueChange)="setDate(u, 'expireDate', $event)"/>
                    </label>
                  }
                }
                @if (isIn && data.showCost) {
                  <label class="tum__fld">{{ 'INVENTORY_TRANSFER.UNIT_COST' | translate }}
                    <input class="tum__qty" type="number" min="0" [ngModel]="u.unitCost" (ngModelChange)="setCost(u, $event)"/>
                  </label>
                }
                @if (isIn) {
                  <button type="button" class="tum__x" (click)="remove(u)" [attr.aria-label]="'COMMON.DELETE' | translate">×</button>
                }
              </li>
            }
          } @empty {
            <li class="tum__empty">{{ 'INVENTORY_TRANSFER.NO_UNITS' | translate }}</li>
          }
        </ul>
      }
    </div>
    <app-modal-footer>
      <span class="tum__count">{{ 'INVENTORY_TRANSFER.SELECTED' | translate }}: {{ selectedCount() }}</span>
      <button type="button" class="tum__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
      <button type="button" class="tum__btn tum__btn--primary" [disabled]="!valid()" (click)="done()">{{ 'INVENTORY_TRANSFER.DONE' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .tum { padding: 16px 20px; min-width: min(680px, 94vw); display: flex; flex-direction: column; gap: 10px; }
    .tum__add { display: flex; gap: 8px; }
    .tum__input { flex: 1; height: 38px; padding: 0 12px; border: 1px solid #d0d5dd; border-radius: 8px; font: inherit; font-size: 14px; outline: none; }
    .tum__input:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.12); }
    .tum__list { list-style: none; margin: 0; padding: 0; max-height: 360px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
    .tum__row { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 12px; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; }
    .tum__row--expired { background: #fef2f2; border-color: #fecaca; }
    .tum__name { min-width: 120px; align-self: center; }
    .tum__row small { color: #64748b; align-self: center; }
    .tum__bad { color: #dc2626 !important; font-weight: 600; }
    .tum__fld { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #64748b; }
    .tum__qty { width: 96px; height: 34px; padding: 0 8px; border: 1px solid #d0d5dd; border-radius: 8px; font: inherit; font-size: 14px; }
    .tum__x { margin-inline-start: auto; align-self: center; width: 28px; height: 28px; border: 0; border-radius: 6px; background: #fee2e2; color: #b91c1c; font-size: 18px; cursor: pointer; }
    .tum__err { margin: 0; font-size: 12.5px; color: #dc2626; }
    .tum__empty { padding: 18px; text-align: center; color: #94a3b8; }
    .tum__count { margin-inline-end: auto; color: #64748b; font-size: 13px; }
    .tum__btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .tum__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
    .tum__btn:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class TransferUnitsModalComponent implements OnInit {
  readonly data = inject<TransferUnitsData>(MODAL_DATA);
  readonly ref = inject<ModalRef<TransferUnitsResult | null>>(MODAL_REF);
  private lookups = inject(SalesLookupsService);

  readonly isIn = this.data.mode.endsWith('-in');
  readonly isSerial = this.data.mode.startsWith('serial');

  readonly loading = signal(false);
  readonly term = signal('');
  readonly newName = signal('');
  /** Working copy (never the form's own objects until Done). */
  readonly units = signal<TransferSubLine[]>([]);

  title = () => ({
    'serial-out': 'INVENTORY_TRANSFER.PICK_SERIALS', 'batch-out': 'INVENTORY_TRANSFER.PICK_BATCHES',
    'serial-in': 'INVENTORY_TRANSFER.ENTER_SERIALS', 'batch-in': 'INVENTORY_TRANSFER.ENTER_BATCHES',
  }[this.data.mode]);

  readonly shown = computed(() => {
    const t = this.term().trim().toLowerCase();
    return t ? this.units().filter(u => (this.isSerial ? u.serial : u.batch).toLowerCase().includes(t)) : this.units();
  });

  readonly selectedCount = computed(() => this.units().filter(u => u.isSelected && !u.isDeleted).length);

  private nameOf = (u: TransferSubLine) => (this.isSerial ? u.serial : u.batch).trim().toLowerCase();
  readonly duplicate = computed(() => {
    const n = this.newName().trim().toLowerCase();
    return !!n && this.units().some(u => !u.isDeleted && this.nameOf(u) === n);
  });
  readonly canAdd = computed(() => !!this.newName().trim() && !this.duplicate());

  /** Transfer in: every batch needs a quantity and an expiry after its production date. Transfer out: a ticked batch needs a quantity within its on-hand. */
  readonly valid = computed(() => {
    const live = this.units().filter(u => !u.isDeleted);
    if (this.data.mode === 'batch-in') return live.every(u => Number(u.qty) > 0 && !!u.prodDate && !!u.expireDate && u.expireDate > u.prodDate);
    if (this.data.mode === 'batch-out') return live.filter(u => u.isSelected).every(u => Number(u.qty) > 0 && Number(u.qty) <= u.onHand);
    return true;
  });

  async ngOnInit(): Promise<void> {
    const saved = (this.isSerial ? this.data.line.serials : this.data.line.batches).map(s => ({ ...s }));
    if (this.isIn) { this.units.set(saved); return; }

    this.loading.set(true);
    try {
      const { productId } = this.data.line;
      const rows: any[] = this.isSerial
        ? await this.lookups.getProductSerials(productId, this.data.branchId)
        : await this.lookups.getProductBatches(productId, this.data.branchId);
      const nowStr = today();
      const key = (x: any) => (this.isSerial ? x.serial : x.batch);
      const merged: TransferSubLine[] = rows.map(r => {
        const found = saved.find(s => key(s) === key(r));
        const expired = !this.isSerial && !!r.expireDate && String(r.expireDate).slice(0, 10) < nowStr;
        const onHand = Number(r.onHand) || 0;
        if (found) return { ...found, onHand: this.isSerial ? 1 : onHand || found.onHand, expired, unitCost: found.unitCost };
        return {
          id: '', qty: expired ? onHand : 0, unitCost: Number(r.unitCost) || 0, batch: r.batch ?? '', serial: r.serial ?? '',
          expireDate: r.expireDate ?? null, prodDate: r.prodDate ?? null, onHand, isSelected: expired, expired,
        };
      });
      // Saved units the branch no longer lists (already moved) stay so the backend can drop them if un-ticked.
      saved.filter(s => !rows.some(r => key(r) === key(s))).forEach(s => merged.push({ ...s, isSelected: s.isSelected }));
      this.units.set(merged);
    } finally {
      this.loading.set(false);
    }
  }

  private patch(u: TransferSubLine, change: Partial<TransferSubLine>): void {
    this.units.update(list => list.map(x => (x === u ? { ...x, ...change } : x)));
  }

  toggle(u: TransferSubLine): void {
    const on = !u.isSelected;
    // A batch ticked with no quantity yet starts at everything it holds.
    this.patch(u, { isSelected: on, ...(on && !this.isSerial && !u.qty ? { qty: u.onHand } : {}) });
  }

  setQty(u: TransferSubLine, v: any): void {
    const n = Math.max(0, Number(v) || 0);
    this.patch(u, { qty: this.isIn ? n : Math.min(n, u.onHand) });
  }
  setCost(u: TransferSubLine, v: any): void { this.patch(u, { unitCost: Math.max(0, Number(v) || 0) }); }

  d10 = (s: string | null) => (s ? String(s).slice(0, 10) : '');
  date = (s: string | null) => toDate(s);
  setDate(u: TransferSubLine, field: 'prodDate' | 'expireDate', v: any): void {
    if (!(v instanceof Date)) return;
    const s = ymd(v)!;
    if (field === 'prodDate') {
      // Expiry has to stay after production.
      this.patch(u, { prodDate: s, expireDate: u.expireDate && u.expireDate > s ? u.expireDate : ymd(new Date(v.getTime() + 86400000)) });
    } else {
      this.patch(u, { expireDate: s });
    }
  }

  add(): void {
    if (!this.canAdd()) return;
    const name = this.newName().trim();
    const unit: TransferSubLine = {
      id: '', qty: this.isSerial ? 1 : 0, unitCost: 0, batch: this.isSerial ? '' : name, serial: this.isSerial ? name : '',
      expireDate: this.isSerial ? null : tomorrow(), prodDate: this.isSerial ? null : today(), onHand: 0, isSelected: true,
    };
    this.units.update(l => [...l, unit]);
    this.newName.set('');
  }

  /** A saved unit is marked deleted (the backend removes it); a new one is simply dropped. */
  remove(u: TransferSubLine): void {
    if (u.id) this.patch(u, { isDeleted: true, isSelected: false });
    else this.units.update(l => l.filter(x => x !== u));
  }

  done(): void {
    // Hand back picked units, and saved ones that were un-ticked so the backend deletes them.
    const out = this.units().filter(u => (u.isSelected && !u.isDeleted) || (u.id && (!u.isSelected || u.isDeleted)));
    this.ref.close(out.map(u => (this.isSerial ? { ...u, qty: 1 } : u)));
  }
}
