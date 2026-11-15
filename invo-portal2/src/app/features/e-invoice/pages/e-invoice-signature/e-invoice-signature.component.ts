import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { DocumentTemplate, parseTemplate } from '@features/settings/document-builder/services/document-template.types';

import '../../e-invoice-i18n';
import { Invoice } from '../../../account/models/invoice.model';
import { EInvoiceCompany } from '../../models/e-invoice.model';
import { EInvoiceService } from '../../services/e-invoice.service';
import { EInvoicePaperComponent } from '../../components/e-invoice-paper/e-invoice-paper.component';
import { SignaturePadComponent } from '../../components/signature-pad/signature-pad.component';

/**
 * Public invoice signing page (`/invoiceSign/:token`) - the legacy `EInvoiceForSignatureComponent`. The link's
 * token is an access token sent as the `token` header: it loads the invoice (`getInvoiceForSignature`) and the
 * customer's drawn signature is saved with `saveInvoiceSignature`.
 */
@Component({
  selector: 'app-e-invoice-signature',
  standalone: true,
  imports: [CommonModule, TranslateModule, EmptyStateComponent, SegmentedToggleComponent, EInvoicePaperComponent, SignaturePadComponent],
  templateUrl: './e-invoice-signature.component.html',
  styleUrl: '../../e-invoice-public.scss',
})
export class EInvoiceSignatureComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(EInvoiceService);
  readonly lang = inject(LanguageService);

  private signBox = viewChild<ElementRef<HTMLElement>>('signBox');

  loading = signal(true);
  invalid = signal(false);
  sending = signal(false);
  invoice = signal<Invoice | null>(null);
  company = signal<EInvoiceCompany | null>(null);
  template = signal<DocumentTemplate | null>(null);
  signature = signal('');
  notice = signal<{ kind: 'success' | 'error'; text: string } | null>(null);

  private token = '';

  /** Legacy: the sign UI only shows while the invoice has a balance and no customer signature yet. */
  readonly canSign = computed(() => {
    const inv = this.invoice();
    return !!inv && Number(inv.balance) > 0 && !inv['customerSignature'];
  });
  readonly langOptions: SegmentedToggleOption<string>[] = [
    { value: 'en', label: 'English', translate: false },
    { value: 'ar', label: 'العربية', translate: false },
  ];

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('e-invoice');
    this.route.paramMap.subscribe(async p => {
      this.token = p.get('token') ?? '';
      await this.load();
    });
  }

  private async load(): Promise<void> {
    const data = await this.api.getInvoiceForSignature(this.token);
    if (!data?.invoice?.id) { this.invalid.set(true); this.loading.set(false); return; }
    this.invoice.set(data.invoice);
    this.company.set(data.company);
    const tr = await this.api.getInvoiceTemplate(data.company.id);
    this.template.set(parseTemplate(tr?.invoiceBuilder ?? {}, 'invoice'));
    this.loading.set(false);
  }

  setLanguage(code: string): void { void this.lang.use(code); }

  scrollToSign(): void { this.signBox()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'center' }); }

  async send(): Promise<void> {
    if (!this.signature() || this.sending()) return;
    this.sending.set(true);
    try {
      // Legacy sends the data URL without its `data:image/png;` prefix (`split(';')[1]` -> `base64,<data>`), which is what the backend parses.
      const res = await this.api.saveInvoiceSignature(this.token, this.signature().split(';')[1]);
      if (res.success) {
        this.notice.set({ kind: 'success', text: res.msg || this.lang.instant('EINVOICE.SIGNED') });
        this.signature.set('');
        await this.load();
      } else {
        this.notice.set({ kind: 'error', text: res.msg || this.lang.instant('COMMON.OPS') });
      }
    } catch (e: any) {
      this.notice.set({ kind: 'error', text: e?.error?.msg ?? e?.message ?? this.lang.instant('COMMON.OPS') });
    } finally {
      this.sending.set(false);
    }
  }
}
