import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, input, signal, viewChild } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DocumentPaperComponent } from '@shared/components/document-paper/document-paper.component';
import { DocumentRenderData } from '@shared/components/document-paper/token-resolve';
import { RangeSliderComponent } from '@shared/components/range-slider/range-slider.component';
import { DocumentTemplate, paperWidthCm } from '@features/settings/document-builder/services/document-template.types';

import { Invoice } from '../../../account/models/invoice.model';
import { invoiceToRenderData } from '../../../account/invoices/services/invoice-render-data';
import { EInvoiceCompany } from '../../models/e-invoice.model';

/**
 * The invoice paper both public pages show (legacy `<app-unified-paper>` + zoom slider): the shared
 * `app-document-paper` renderer, fitted to the viewer's width on first paint and zoomable until the visitor
 * moves the slider (legacy `onAutoZoomCalculated` / `userHasAdjustedZoom`).
 */
@Component({
  selector: 'app-e-invoice-paper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule, DocumentPaperComponent, RangeSliderComponent],
  template: `
    <div class="eip__zoom">
      <label>{{ 'EINVOICE.ZOOM' | translate }}</label>
      <div class="eip__slider">
        <app-range-slider [range]="false" [floor]="40" [ceiling]="150" [step]="1" unit="%"
          [value]="zoom()" (valueChange)="onZoom($any($event))"/>
      </div>
    </div>
    <div class="eip__viewer" #viewer>
      <div class="eip__scale" [style.zoom]="zoom() / 100">
        <app-document-paper [template]="template()" [data]="data()"/>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .eip__zoom { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
    .eip__zoom label { font-size: 13px; color: var(--ui-text-4); }
    .eip__slider { width: 260px; max-width: 100%; }
    .eip__viewer { overflow: auto; background: var(--ui-surface-2); border: 1px solid var(--ui-line); border-radius: 12px; padding: 16px; }
    .eip__scale { width: max-content; margin-inline: auto; }
  `],
})
export class EInvoicePaperComponent {
  invoice = input.required<Invoice>();
  company = input.required<EInvoiceCompany>();
  template = input.required<DocumentTemplate>();

  zoom = signal(100);
  private userAdjusted = false;
  private viewer = viewChild<ElementRef<HTMLElement>>('viewer');

  data = computed<DocumentRenderData>(() => ({
    ...invoiceToRenderData(this.invoice()),
    company: { name: this.company()?.name ?? '' },
  }));

  constructor() {
    afterNextRender(() => this.fit());
  }

  onZoom(v: number): void {
    this.userAdjusted = true;
    this.zoom.set(Math.round(Number(v)) || 100);
  }

  /** Fit the page to the viewer width (never above 100%). */
  private fit(): void {
    if (this.userAdjusted) return;
    const el = this.viewer()?.nativeElement;
    if (!el) return;
    const natural = (paperWidthCm(this.template()) * 96) / 2.54;
    const avail = el.clientWidth - 32;
    if (natural > 0 && avail > 0) this.zoom.set(Math.max(40, Math.min(100, Math.floor((avail / natural) * 100))));
  }
}
