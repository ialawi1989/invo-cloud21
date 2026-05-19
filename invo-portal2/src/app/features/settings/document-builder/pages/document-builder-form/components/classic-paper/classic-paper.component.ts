import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import {
  DocumentTemplate,
  DocumentType,
  paperWidthCm,
  paperHeightCm,
  TextStyle,
} from '../../../../services/document-template.types';

/**
 * ClassicPaperComponent
 * ─────────────────────
 * Phase-1 read-only preview of the Classic renderer. Mirrors the
 * structure of the legacy `unified-paper` component so what the user
 * sees here matches what their saved templates render at print time
 * (after phase 3 wires this up to the entity view pages).
 *
 * Sample data is hard-coded (matches the receipt-builder pattern) —
 * full live binding lands in phase 2 alongside the data picker.
 *
 * Visibility / size / colour toggles from the template are honoured
 * for header + title + customer + meta + table-header + total
 * sections so the user can see their changes immediately.
 */
@Component({
  selector: 'app-document-classic-paper',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './classic-paper.component.html',
  styleUrl: './classic-paper.component.scss',
})
export class ClassicPaperComponent {
  template = input.required<DocumentTemplate>();

  // ─── Sample data for live preview ────────────────────────────────────
  readonly sample = {
    company: {
      name:    'ABC Trading Company W.L.L.',
      vat:     '200012345600002',
      address: 'Building 123, Road 456, Block 789, Manama',
      phone:   '+973 1700 0000',
      logo:    '',
    },
    customer: {
      name:    'XYZ Enterprises Ltd.',
      vat:     '200056789400001',
      address: 'Building 55, Block 303, Road 101, Riffa',
      phone:   '+973 1800 0000',
    },
    invoice: {
      number:    'INV-2026-001287',
      date:      '20/04/2026',
      dueDate:   '20/05/2026',
      reference: 'PO-2026-0456',
    },
    lines: [
      { desc: 'Professional consulting services — Q1 2026', qty: 40, price: 75 },
      { desc: 'Software license — Annual subscription',     qty: 1,  price: 2400 },
      { desc: 'On-site support & training (3 days)',         qty: 3,  price: 450 },
      { desc: 'Hardware setup & configuration',              qty: 1,  price: 850 },
    ],
    totals: {
      subtotal:   336.250,
      vat:         31.625,
      grandTotal: 367.875,
    },
    notes: 'Thank you for your business. Payment is due within 30 days of invoice date.',
    terms: 'Goods once sold are not returnable. Payment due within 30 days. Late payments subject to 2% monthly service charge.',
  };

  // ─── Derived geometry ────────────────────────────────────────────────
  /** Paper dimensions in pixels (1cm = 37.8px @ 96dpi). */
  paperWidthPx  = computed<number>(() => paperWidthCm(this.template())  * 37.8);
  paperHeightPx = computed<number>(() => paperHeightCm(this.template()) * 37.8);

  /** Title label per document type. */
  titleLabel = computed<string>(() => {
    const type = this.template().documentType as DocumentType;
    const labels: Record<DocumentType, string> = {
      'invoice':         'TAX INVOICE',
      'estimate':        'ESTIMATE',
      'credit-note':     'CREDIT NOTE',
      'purchase-order':  'PURCHASE ORDER',
      'bill':            'BILL',
      'expense':         'EXPENSE',
      'supplier-credit': 'SUPPLIER CREDIT',
    };
    return labels[type] ?? 'DOCUMENT';
  });

  /** Helper used by the template to compose inline styles for a
   *  `TextStyle` block. Returns a CSS-style object the renderer
   *  accepts via [ngStyle]. */
  textStyle(t: TextStyle | undefined | null): Record<string, string> {
    if (!t) return {};
    return {
      'font-size':       (Number(t.size) || 10) + 'pt',
      'color':           t.color || 'inherit',
      'font-weight':     t.bold      ? '700'       : '400',
      'font-style':      t.italic    ? 'italic'    : 'normal',
      'text-decoration': t.underline ? 'underline' : 'none',
      'text-align':      t.alignment || 'left',
      'background-color': t.backgroundColor || 'transparent',
    };
  }
}
