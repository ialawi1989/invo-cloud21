import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';

import {
  CountLine, PhysicalCount, differenceOf, enteredOf, expectedOf, isBatchLine, isSerialLine, totalsOf,
} from '../../models/physical-count.model';

/**
 * The physical count document (legacy `physical-count-paper`): who counted, where and when, then every product with
 * what the system held, what was counted and the difference. Serial and batch products list their units underneath.
 * The system quantities and values only mean something once the count was calculated.
 */
@Component({
  selector: 'app-physical-count-paper',
  standalone: true,
  imports: [CommonModule, TranslateModule, MycurrencyPipe],
  template: `
    @let d = count();
    <article class="pp">
      <header class="pp__head">
        @if (logo()) { <img class="pp__logo" [src]="logo()" alt=""/> }
        <h2>{{ companyName() }}</h2>
        <div class="pp__title">{{ 'PHYSICAL_COUNT.COUNT' | translate }}</div>
      </header>

      <dl class="pp__grid">
        <div><dt>{{ 'PHYSICAL_COUNT.REFERENCE' | translate }}</dt><dd>{{ d.reference || '—' }}</dd></div>
        <div><dt>{{ 'PHYSICAL_COUNT.STATUS_LABEL' | translate }}</dt><dd>{{ 'PHYSICAL_COUNT.STATUS.' + d.status | translate }}</dd></div>
        <div><dt>{{ 'PHYSICAL_COUNT.BRANCH' | translate }}</dt><dd>{{ d.branchName }}</dd></div>
        <div><dt>{{ 'PHYSICAL_COUNT.CREATED_BY' | translate }}</dt><dd>{{ d.createdEmployeeName }} · {{ d.createdDate | date: 'dd/MM/yyyy' }}</dd></div>
        @if (d.calculatedDate) {
          <div><dt>{{ 'PHYSICAL_COUNT.CALCULATED_BY' | translate }}</dt><dd>{{ d.calculatedEmployeeName }} · {{ d.calculatedDate | date: 'dd/MM/yyyy' }}</dd></div>
        }
        @if (d.closedDate && d.status === 'Closed') {
          <div><dt>{{ 'PHYSICAL_COUNT.COMMITTED_BY' | translate }}</dt><dd>{{ d.closedEmployeeName }} · {{ d.closedDate | date: 'dd/MM/yyyy' }}</dd></div>
        }
        @if (d.note) { <div class="pp__wide"><dt>{{ 'PHYSICAL_COUNT.NOTE' | translate }}</dt><dd>{{ d.note }}</dd></div> }
      </dl>

      <div class="pp__wrap">
        <table class="pp__table">
          <thead>
            <tr>
              <th>{{ 'PHYSICAL_COUNT.PRODUCT' | translate }}</th>
              @if (calculated()) { <th class="end">{{ 'PHYSICAL_COUNT.SYSTEM_QTY' | translate }}</th> }
              <th class="end">{{ 'PHYSICAL_COUNT.COUNTED' | translate }}</th>
              @if (calculated()) { <th class="end">{{ 'PHYSICAL_COUNT.DIFFERENCE' | translate }}</th> }
            </tr>
          </thead>
          <tbody>
            @for (l of lines(); track $index) {
              <tr>
                <td>
                  <strong>{{ l.productName }}</strong>
                  @if (l.UOM) { <span class="pp__chip">{{ l.UOM }}</span> }
                  @if (l.barcode) { <div class="pp__muted">{{ l.barcode }}</div> }
                </td>
                @if (calculated()) { <td class="end">{{ expected(l) }}</td> }
                <td class="end">{{ entered(l) }}</td>
                @if (calculated()) {
                  <td class="end" [class.pp__neg]="diff(l) < 0" [class.pp__pos]="diff(l) > 0">{{ diff(l) }}</td>
                }
              </tr>
              @if (isBatch(l)) {
                @for (b of l.batches; track $index) {
                  <tr class="pp__sub">
                    <td>{{ 'PHYSICAL_COUNT.BATCH' | translate }}: {{ b.batch }}</td>
                    @if (calculated()) { <td class="end">{{ b.expectedQty }}</td> }
                    <td class="end">{{ b.enteredQty }}</td>
                    @if (calculated()) { <td class="end">{{ b.enteredQty - b.expectedQty }}</td> }
                  </tr>
                }
              } @else if (isSerial(l)) {
                @for (s of l.serials; track $index) {
                  <tr class="pp__sub">
                    <td>{{ 'PHYSICAL_COUNT.SERIAL' | translate }}: {{ s.serial }}</td>
                    @if (calculated()) { <td class="end">1</td> }
                    <td class="end">{{ s.isAvailable ? 1 : 0 }}</td>
                    @if (calculated()) { <td class="end">{{ s.isAvailable ? 0 : -1 }}</td> }
                  </tr>
                }
              }
            }
          </tbody>
        </table>
      </div>

      @if (calculated()) {
        <dl class="pp__totals">
          <div><dt>{{ 'PHYSICAL_COUNT.SYSTEM_VALUE' | translate }}</dt><dd>{{ totals().expected | mycurrency }}</dd></div>
          <div><dt>{{ 'PHYSICAL_COUNT.COUNTED_VALUE' | translate }}</dt><dd>{{ totals().counted | mycurrency }}</dd></div>
          <div><dt>{{ 'PHYSICAL_COUNT.DIFFERENCE_VALUE' | translate }}</dt>
            <dd [class.pp__neg]="totals().difference < 0" [class.pp__pos]="totals().difference > 0"><b>{{ totals().difference | mycurrency }}</b></dd></div>
        </dl>
      }
    </article>
  `,
  styles: [`
    :host { display: block; }
    .pp { background: var(--ui-surface); padding: 28px; border: 1px solid var(--ui-line); border-radius: 12px; display: flex; flex-direction: column; gap: 18px; }
    .pp__head { display: flex; align-items: center; gap: 14px; border-bottom: 1px solid var(--ui-line); padding-bottom: 14px; }
    .pp__head h2 { margin: 0; font-size: 18px; }
    .pp__logo { height: 40px; }
    .pp__title { margin-inline-start: auto; font-size: 22px; font-weight: 700; color: var(--ui-text); }
    .pp__grid { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px 24px; }
    .pp__grid > div { display: flex; gap: 8px; font-size: 14px; }
    .pp__wide { grid-column: 1 / -1; }
    dt { color: var(--ui-muted); min-width: 110px; } dd { margin: 0; color: var(--ui-text); }
    .pp__wrap { overflow-x: auto; }
    .pp__table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .pp__table th { background: var(--ui-ink); color: #fff; text-align: start; padding: 10px 12px; }
    .pp__table td { padding: 10px 12px; border-bottom: 1px solid var(--ui-surface-2); vertical-align: top; }
    .pp__sub td { padding-block: 5px; color: var(--ui-text-4); font-size: 12.5px; background: var(--ui-surface-1); }
    .pp__sub td:first-child { padding-inline-start: 28px; }
    .end { text-align: end !important; }
    .pp__chip { margin-inline-start: 8px; padding: 1px 8px; border-radius: 999px; background: var(--ui-line); font-size: 12px; }
    .pp__muted { color: var(--ui-muted); font-size: 12px; }
    .pp__neg { color: var(--ui-red-text); font-weight: 600; }
    .pp__pos { color: var(--ui-green-text); font-weight: 600; }
    .pp__totals { margin: 0; align-self: flex-end; min-width: 320px; display: flex; flex-direction: column; gap: 6px; }
    .pp__totals > div { display: flex; justify-content: space-between; gap: 24px; font-size: 14px; }
  `],
})
export class PhysicalCountPaperComponent {
  private company = inject(CompanyService);

  count = input.required<PhysicalCount>();

  lines = computed(() => this.count().lines.filter(l => !l.isDeleted));
  /** Before it is calculated a count only lists what was counted. */
  calculated = computed(() => this.count().status !== 'Open');
  totals = computed(() => totalsOf(this.count().lines));
  companyName = computed(() => this.company.currentCompany()?.name ?? '');
  logo = computed(() => {
    const c: any = this.company.currentCompany();
    return c?.mediaUrl?.defaultUrl || c?.logoUrl || c?.logo || '';
  });

  entered = (l: CountLine) => enteredOf(l);
  expected = (l: CountLine) => expectedOf(l);
  diff = (l: CountLine) => differenceOf(l);
  isBatch = isBatchLine;
  isSerial = isSerialLine;
}
