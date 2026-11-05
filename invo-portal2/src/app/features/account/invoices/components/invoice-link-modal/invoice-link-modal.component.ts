import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ToastService } from '@shared/components/toast/toast.service';

import { EmailChipsComponent } from '../../../components/email-chips/email-chips.component';
import { InvoicesService } from '../../services/invoices.service';

export interface InvoiceLinkModalData {
  /** `link` = public invoice link (copy only); `signature` = signing link, optionally emailed to the customer. */
  mode: 'link' | 'signature';
  invoiceId: string;
  customerEmail?: string;
}

/**
 * Legacy `CreateInvoiceLinkComponent` + `SendInvoiceForSignatureComponent` in one dialog. Both ask
 * the backend for a URL when opened (`accounts/createInvoiceLink` / `accounts/sendInvoiceForSignature`
 * without an email only returns the URL); in `signature` mode the link can then be e-mailed to one or more
 * recipients through the same endpoint (`emails`).
 */
@Component({
  selector: 'app-invoice-link-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, EmailChipsComponent],
  template: `
    <app-modal-header [title]="(data.mode === 'link' ? 'INVOICES.VIEW.CREATE_LINK' : 'INVOICES.VIEW.SEND_FOR_SIGNATURE') | translate"/>
    <div class="il">
      <p class="il__hint">{{ (data.mode === 'link' ? 'INVOICES.VIEW.LINK_HINT' : 'INVOICES.VIEW.SIGNATURE_HINT') | translate }}</p>
      <div class="il__copy">
        <input class="il__input" type="text" readonly dir="ltr" [value]="loading() ? '…' : link()" (focus)="$any($event.target).select()"/>
        <button type="button" class="il__btn il__btn--primary" [disabled]="!link()" (click)="copy()">
          {{ (copied() ? 'INVOICES.VIEW.COPIED' : 'INVOICES.VIEW.COPY') | translate }}
        </button>
      </div>

      @if (data.mode === 'signature') {
        <label class="il__label">{{ 'DOC_SEND.EMAILS' | translate }}</label>
        <app-email-chips #chips [(emails)]="emails" [disabled]="sending()"/>
        <div class="il__end">
          <button type="button" class="il__btn" [disabled]="sending()" (click)="ref.close()">{{ 'COMMON.CANCEL' | translate }}</button>
          <button type="button" class="il__btn il__btn--primary" [disabled]="sending() || !link() || !emails().length" (click)="send()">{{ 'DOC_SEND.SEND_EMAIL' | translate }}</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .il { padding: 16px 20px; min-width: min(520px, 92vw); display: flex; flex-direction: column; gap: 10px; }
    .il__hint { margin: 0; font-size: 13px; color: #64748b; }
    .il__label { font-size: 13px; font-weight: 600; color: #334155; margin-top: 6px; }
    .il__copy { display: flex; gap: 8px; padding: 12px; border: 1px solid #e4e7ec; border-radius: 10px; background: #f8fafc; }
    .il__input { flex: 1; min-width: 0; border: 1px solid #d0d5dd; border-radius: 8px; padding: 9px 12px; font: inherit; font-size: 13.5px; background: #fff;
      &:focus { outline: none; border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38, 145, 164, .12); }
      &--err { border-color: #dc2626; } }
    .il__err { color: #dc2626; }
    .il__end { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
    .il__btn { padding: 9px 18px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; font-weight: 600; font-size: 13.5px; cursor: pointer; white-space: nowrap;
      &--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
      &:disabled { opacity: .5; cursor: not-allowed; } }
  `],
})
export class InvoiceLinkModalComponent implements OnInit {
  data = inject<InvoiceLinkModalData>(MODAL_DATA);
  ref = inject<ModalRef<void>>(MODAL_REF);
  private invoices = inject(InvoicesService);
  private toast = inject(ToastService);

  link = signal('');
  loading = signal(true);
  copied = signal(false);
  emails = signal<string[]>([]);
  private chips = viewChild(EmailChipsComponent);
  sending = signal(false);

  async ngOnInit(): Promise<void> {
    if (this.data.customerEmail) this.emails.set([this.data.customerEmail]);
    try {
      const res: any = this.data.mode === 'link'
        ? await this.invoices.createInvoiceLink({ invoiceId: this.data.invoiceId })
        : await this.invoices.sendInvoiceForSignature({ invoiceId: this.data.invoiceId });
      this.link.set(res?.data?.url ?? '');
      if (!res?.data?.url) this.toast.error('COMMON.OPS', res?.msg ?? '');
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.loading.set(false);
    }
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.link());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch { /* clipboard unavailable — the field is selectable as a fallback */ }
  }

  async send(): Promise<void> {
    if (this.chips() && !this.chips()!.flush()) return;
    const emails = this.emails();
    if (!emails.length || this.sending()) return;
    this.sending.set(true);
    try {
      const res: any = await this.invoices.sendInvoiceForSignature({ invoiceId: this.data.invoiceId, emails, language: 'english' });
      if (res?.success) { this.toast.success('DOC_SEND.SENT'); this.ref.close(); }
      else this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.sending.set(false);
    }
  }
}
