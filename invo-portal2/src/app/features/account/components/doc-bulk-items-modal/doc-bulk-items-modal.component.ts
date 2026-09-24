import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';

export interface BulkItemsData {
  search: (term: string) => Promise<any[]>;
  barcodeLookup?: (term: string) => Promise<any | null>;
  excludeTypes?: string[];
}
export interface BulkPick { product: any; qty: number; }

/**
 * "Add Items in Bulk": search / scan on the left, click items to pick them, set quantities on
 * the right. Shared by every document form; the data source is supplied by the caller.
 */
@Component({
  selector: 'app-doc-bulk-items-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MycurrencyPipe, ModalHeaderComponent],
  template: `
    <app-modal-header [title]="'DOC_LINES.ADD_ITEMS_BULK' | translate"/>
    <div class="bi">
      <div class="bi__left">
        <input class="bi__search" type="text" autofocus [placeholder]="'DOC_LINES.SEARCH_OR_SCAN' | translate"
          [ngModel]="term()" (ngModelChange)="onTerm($event)" (keydown.enter)="onEnter()"/>
        <ul class="bi__list">
          @for (p of results(); track p.id) {
            <li [class.on]="isPicked(p)" (click)="toggle(p)">
              <div>
                <div class="bi__name">{{ p.name }}</div>
                <div class="bi__rate">{{ 'DOC_LINES.RATE' | translate }}: {{ p.defaultPrice | mycurrency }}</div>
              </div>
              <span class="bi__check">{{ isPicked(p) ? '✓' : '' }}</span>
            </li>
          } @empty {
            <li class="bi__empty">{{ (loading() ? 'DOC_LINES.LOADING' : 'DOC_LINES.NO_ITEMS') | translate }}</li>
          }
        </ul>
      </div>

      <div class="bi__right">
        <div class="bi__head">
          <h3>{{ 'DOC_LINES.SELECTED_ITEMS' | translate }} <span class="bi__count">{{ picks().length }}</span></h3>
          <span>{{ 'DOC_LINES.TOTAL_QUANTITY' | translate }}: <b>{{ totalQty() }}</b></span>
        </div>
        <div class="bi__picked">
          @for (pk of picks(); track pk.product.id) {
            <div class="bi__row">
              <span class="bi__name">{{ pk.product.name }}</span>
              <input class="bi__qty" type="number" min="0.001" step="1" [ngModel]="pk.qty" (ngModelChange)="setQty(pk, $event)"/>
              <button type="button" class="bi__x" (click)="toggle(pk.product)" aria-label="remove">✕</button>
            </div>
          } @empty {
            <div class="bi__hint">{{ 'DOC_LINES.CLICK_TO_SELECT' | translate }}</div>
          }
        </div>
        <div class="bi__foot">
          <button type="button" class="bi__btn bi__btn--primary" [disabled]="!picks().length" (click)="add()">{{ 'DOC_LINES.ADD_ITEMS' | translate }}</button>
          <button type="button" class="bi__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .bi { display: grid; grid-template-columns: 1fr 1fr; min-width: min(920px, 92vw); height: 62vh; }
    @media (max-width: 720px) { .bi { grid-template-columns: 1fr; height: auto; } }
    .bi__left { border-inline-end: 1px solid #e5e7eb; display: flex; flex-direction: column; min-height: 0; background: #f8fafc; }
    .bi__search { margin: 12px; border: 1px solid #2691a4; border-radius: 8px; padding: 9px 12px; font: inherit; }
    .bi__list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
    .bi__list li { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; cursor: pointer; }
    .bi__list li:hover { background: #eef2f6; } .bi__list li.on { background: #e6f4f6; }
    .bi__name { color: #227d8d; font-weight: 500; } .bi__rate { font-size: 12.5px; color: #227d8d; }
    .bi__check { width: 22px; height: 22px; border-radius: 50%; background: #cbd5e1; color: #fff; display: grid; place-items: center; font-size: 13px; }
    .on .bi__check { background: #227d8d; }
    .bi__empty { color: #94a3b8; cursor: default !important; justify-content: center !important; }
    .bi__right { display: flex; flex-direction: column; min-height: 0; }
    .bi__head { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #e5e7eb; h3 { margin: 0; font-size: 20px; } }
    .bi__count { display: inline-block; margin-inline-start: 8px; border: 1px solid #cbd5e1; border-radius: 999px; padding: 0 12px; font-size: 14px; }
    .bi__picked { flex: 1; overflow-y: auto; padding: 8px 16px; }
    .bi__row { display: grid; grid-template-columns: 1fr 90px 28px; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .bi__qty { border: 1px solid #d0d5dd; border-radius: 6px; padding: 6px 8px; text-align: end; }
    .bi__x { border: 0; background: none; color: #dc2626; cursor: pointer; }
    .bi__hint { height: 100%; display: grid; place-items: center; text-align: center; color: #334155; padding: 24px; }
    .bi__foot { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #e5e7eb; }
    .bi__btn { padding: 8px 16px; border-radius: 6px; border: 1px solid #d0d5dd; background: #f3f4f6; cursor: pointer; font-weight: 500; }
    .bi__btn--primary { background: #2691a4; border-color: #2691a4; color: #fff; }
    .bi__btn:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class DocBulkItemsModalComponent implements OnInit {
  data = inject<BulkItemsData>(MODAL_DATA);
  ref = inject<ModalRef<BulkPick[] | null>>(MODAL_REF);

  term = signal('');
  results = signal<any[]>([]);
  picks = signal<BulkPick[]>([]);
  loading = signal(false);
  totalQty = computed(() => this.picks().reduce((s, p) => s + (Number(p.qty) || 0), 0));
  private timer: any;
  private seq = 0;

  ngOnInit(): void { void this.load(''); }

  private async load(term: string): Promise<void> {
    const id = ++this.seq;
    this.loading.set(true);
    try {
      const list = await this.data.search(term);
      if (id === this.seq) this.results.set(list.filter(p => !(this.data.excludeTypes ?? []).includes(p.type)));
    } finally {
      if (id === this.seq) this.loading.set(false);
    }
  }

  onTerm(v: string): void {
    this.term.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.load(v), 350);
  }

  /** Enter = barcode scan: a match is picked (qty +1 if already picked). */
  async onEnter(): Promise<void> {
    const t = this.term().trim();
    if (!t || !this.data.barcodeLookup) return;
    clearTimeout(this.timer);
    const p = await this.data.barcodeLookup(t);
    if (p && !(this.data.excludeTypes ?? []).includes(p.type)) {
      const existing = this.picks().find(x => x.product.id === p.id);
      if (existing) this.setQty(existing, existing.qty + 1);
      else this.picks.update(l => [...l, { product: p, qty: 1 }]);
      this.term.set('');
      void this.load('');
    }
  }

  isPicked = (p: any) => this.picks().some(x => x.product.id === p.id);
  toggle(p: any): void {
    this.picks.update(l => (this.isPicked(p) ? l.filter(x => x.product.id !== p.id) : [...l, { product: p, qty: 1 }]));
  }
  setQty(pk: BulkPick, v: any): void {
    pk.qty = Number(v) || 0;
    this.picks.update(l => [...l]);
  }
  add(): void { this.ref.close(this.picks().filter(p => p.qty > 0)); }
}
