import '../../../account-i18n';
import { ElementRef, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { LanguageService } from '@core/i18n/language.service';
import { LocalizedNamePipe } from '@core/pipes/localized-name.pipe';

import { Invoice, InvoiceLine } from '../../../models/invoice.model';
import { InvoicesService } from '../../services/invoices.service';

/** One printable row: a real line or one of its voided sub-lines (both render the same way). */
interface DeliveryRow { name: string; note: string; options: { name: string }[]; qty: number; voided: boolean; }

/**
 * "Print Delivery Note" (`/print/delivery-note/:id?autoPrint=true`) — full-page, no app chrome.
 * 1:1 port of legacy `DeliveryNoteComponent`: the invoice's own header/company identity, the same
 * transactional-detail fields as its invoice paper (number, customer, phone, dates, VAT, reference,
 * salesperson), then an item table with ONLY description + qty (no price/tax/amount — a delivery
 * note is a packing document, not a bill) including voided sub-lines, the company's invoice-options
 * note, and "Authorized Signature" / "Delivery Date" sign-off lines. `autoPrint=true` triggers the
 * browser print dialog once the invoice has loaded.
 */
@Component({
  selector: 'app-delivery-note-print',
  standalone: true,
  imports: [CommonModule, TranslateModule, LocalizedNamePipe],
  templateUrl: './delivery-note-print.component.html',
  styleUrl: './delivery-note-print.component.scss',
})
export class DeliveryNotePrintComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private invoices = inject(InvoicesService);
  private company = inject(CompanyService);
  private lang = inject(LanguageService);
  private host = inject(ElementRef);

  invoice = signal<Invoice | null>(null);
  loading = signal(true);

  companyInfo = computed(() => this.company.currentCompany() as { name?: string; vat?: string; address?: string; phone?: string; logo?: string; logoUrl?: string; mediaUrl?: { defaultUrl?: string } } | null);
  logoUrl = computed(() => {
    const c = this.companyInfo();
    return c?.mediaUrl?.defaultUrl || c?.logoUrl || c?.logo || '';
  });
  deliveryNote = computed(() => (this.company.settings() as any)?.invoiceOptions?.note ?? '');

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('account/invoices');
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const inv = await this.invoices.getInvoice(id);
    this.invoice.set(inv);
    this.loading.set(false);
    if (this.route.snapshot.queryParamMap.get('autoPrint') === 'true') {
      await this.imagesReady();
      window.print();
    }
  }

  /** Waits for the page's images (the company logo) to finish loading — printing earlier prints an empty logo box. Gives up after 5 s so a broken URL can't block printing. */
  private async imagesReady(): Promise<void> {
    await new Promise<void>(r => setTimeout(r)); // let the just-set invoice render its <img>
    const imgs = Array.from((this.host.nativeElement as HTMLElement).querySelectorAll('img')).filter(i => !i.complete);
    if (!imgs.length) return;
    const loaded = Promise.all(imgs.map(i => new Promise<void>(r => { i.addEventListener('load', () => r(), { once: true }); i.addEventListener('error', () => r(), { once: true }); })));
    await Promise.race([loaded, new Promise<void>(r => setTimeout(r, 5000))]);
  }

  rowsOf(line: InvoiceLine): DeliveryRow[] {
    const main: DeliveryRow = {
      name: line.selectedItem?.name ?? '', note: line.note ?? '',
      options: (line.optionList ?? []) as { name: string }[], qty: line.qty, voided: false,
    };
    const voided = (line.voidedItems ?? []).map((v: any): DeliveryRow => ({
      name: v.selectedItem?.name ?? '', note: v.note ?? '', options: (v.optionList ?? []) as { name: string }[], qty: v.qty, voided: true,
    }));
    return [main, ...voided];
  }
}
