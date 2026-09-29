import '../../account-i18n';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { CompanyService } from '@core/auth/company.service';
import { LanguageService } from '@core/i18n/language.service';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { ToastService } from '@shared/components/toast/toast.service';
import { Country, CountriesService } from '@shared/services/countries.service';

export interface SendDocumentData {
  /** Emails pre-filled as chips (customer / supplier email). */
  emails: string[];
  /** Sends the email; receives `{ emails, language }` and returns the API envelope. Each document type supplies its own call. */
  sendEmail: (payload: { emails: string[]; language: string }) => Promise<any>;
  /** Enables the WhatsApp block: backend document type + id + the recipient's phone. */
  whatsapp?: { type: string; id: string; phone: string };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Send" dialog shared by every sales / purchase document: email recipients as chips and,
 * when a WhatsApp plugin is active, the customer's phone with a country code. The caller decides
 * which endpoint sends the email; WhatsApp always goes through `accounts/sendByWhatsapp`.
 */
@Component({
  selector: 'app-send-document-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, SearchDropdownComponent],
  template: `
    <app-modal-header [title]="'DOC_SEND.TITLE' | translate"/>
    <div class="sd">
      <label class="sd__label">{{ 'DOC_SEND.EMAILS' | translate }} <small>({{ 'DOC_SEND.EMAIL_HINT' | translate }})</small></label>
      <div class="sd__chips" [class.sd__chips--err]="emailError()">
        @for (e of emails(); track e) {
          <span class="sd__chip">{{ e }} <button type="button" (click)="removeEmail(e)" aria-label="remove">✕</button></span>
        }
        <input class="sd__chip-input" type="text" [placeholder]="'DOC_SEND.ADD_EMAIL' | translate" [disabled]="sending()"
          [ngModel]="draft()" (ngModelChange)="draft.set($event)"
          (keydown)="onKey($event)" (blur)="commit()" (paste)="onPaste($event)"/>
      </div>
      @if (emailError()) { <small class="sd__err">{{ emailError() | translate }}</small> }
      <div class="sd__end">
        <button type="button" class="sd__btn sd__btn--primary" [disabled]="sending() || !emails().length" (click)="sendEmail()">
          ✉ {{ 'DOC_SEND.SEND_EMAIL' | translate }}
        </button>
      </div>

      @if (data.whatsapp) {
        <hr class="sd__hr"/>
        <div class="sd__wa-head">
          <label class="sd__label">{{ 'DOC_SEND.PHONE' | translate }}</label>
          @if (checked() && !whatsappEnabled()) {
            <span class="sd__badge">{{ 'DOC_SEND.NEEDS_SETUP' | translate }}</span>
            <a href="/plugins" target="_blank" rel="noopener">{{ 'DOC_SEND.CONFIGURE' | translate }}</a>
          }
        </div>
        <div class="sd__phone">
          <div class="sd__code">
            <app-search-dropdown [items]="countries()" [displayWith]="codeLabel" [compareWith]="byCode"
              [value]="selectedCountry()" (valueChange)="onCountry($any($event))" [clearable]="false"
              [disabled]="sending() || !whatsappEnabled()" [placeholder]="'DOC_SEND.CODE' | translate"/>
          </div>
          <input class="sd__input" type="text" placeholder="123456789" [disabled]="sending() || !whatsappEnabled()"
            [ngModel]="number()" (ngModelChange)="number.set($event)"/>
        </div>
        <div class="sd__end">
          <button type="button" class="sd__btn sd__btn--wa" [disabled]="sending() || !canWhatsapp()" (click)="sendWhatsapp()">
            {{ 'DOC_SEND.WHATSAPP' | translate }}
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .sd { padding: 16px 20px; min-width: min(520px, 92vw); display: flex; flex-direction: column; gap: 10px; }
    .sd__label { font-size: 13px; font-weight: 600; color: #334155; small { font-weight: 400; color: #227d8d; } }
    .sd__chips { display: flex; flex-wrap: wrap; gap: 6px; border: 1px solid #d0d5dd; border-radius: 8px; padding: 6px 8px; background: #fff; min-height: 42px; align-items: center; }
    .sd__chips:focus-within { border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38, 145, 164, .12); }
    .sd__chips--err { border-color: #dc2626; }
    .sd__chip { display: inline-flex; align-items: center; gap: 6px; background: #e6f4f6; color: #227d8d; border-radius: 999px; padding: 3px 10px; font-size: 13px; }
    .sd__chip button { border: 0; background: none; color: #227d8d; cursor: pointer; padding: 0; }
    .sd__chip-input { flex: 1; min-width: 160px; border: 0; outline: none; font: inherit; font-size: 13.5px; }
    .sd__err { color: #dc2626; }
    .sd__end { display: flex; justify-content: flex-end; }
    .sd__hr { border: 0; border-top: 1px solid #eef2f6; margin: 6px 0; width: 100%; }
    .sd__wa-head { display: flex; align-items: center; gap: 10px; a { font-size: 12.5px; color: #227d8d; } }
    .sd__badge { font-size: 11.5px; font-weight: 600; color: #b91c1c; background: #fee2e2; border-radius: 999px; padding: 2px 8px; }
    .sd__phone { display: flex; gap: 8px; align-items: flex-start; }
    .sd__code { width: 130px; flex: 0 0 auto; }
    .sd__input { flex: 1; border: 1px solid #d0d5dd; border-radius: 8px; padding: 9px 12px; font: inherit; font-size: 13.5px; }
    .sd__btn { padding: 9px 18px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .sd__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
    .sd__btn--wa { border-color: #16a34a; background: #16a34a; color: #fff; }
    .sd__btn:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class SendDocumentModalComponent implements OnInit {
  data = inject<SendDocumentData>(MODAL_DATA);
  ref = inject<ModalRef<boolean>>(MODAL_REF);
  private api = inject(ApiService);
  private lang = inject(LanguageService);
  private toast = inject(ToastService);
  private countriesService = inject(CountriesService);

  emails = signal<string[]>([...(this.data.emails ?? []).filter(Boolean)]);
  draft = signal('');
  emailError = signal('');
  sending = signal(false);

  countries = signal<Country[]>([]);
  selectedCountry = signal<Country | null>(null);
  number = signal('');
  whatsappEnabled = signal(false);
  checked = signal(false);

  canWhatsapp = computed(() => this.whatsappEnabled() && !!this.number().trim() && !!this.selectedCountry());

  async ngOnInit(): Promise<void> {
    void this.lang.loadFeature('account/components/doc-lines-table');
    if (!this.data.whatsapp) return;
    const [countries, channels] = await Promise.all([
      this.countriesService.load().catch(() => []),
      this.api.request<any>(this.api.get('company/getActiveChannels')).then(r => r?.data).catch(() => null),
    ]);
    this.countries.set(countries);
    this.whatsappEnabled.set(!!channels?.whatsapp);
    this.checked.set(true);

    // Default country code from the company setting, then strip it from the customer's phone.
    const defaultCode = String(CompanyService.companySettings?.settings?.contryCode ?? '').replace('+', '');
    const country = countries.find(c => c.dial_code.replace('+', '') === defaultCode) ?? null;
    this.selectedCountry.set(country);
    let phone = String(this.data.whatsapp.phone ?? '').trim().replace(/^\+/, '');
    if (defaultCode && phone.startsWith(defaultCode)) phone = phone.substring(defaultCode.length);
    this.number.set(phone);
  }

  codeLabel = (c: Country) => c?.dial_code ?? '';
  byCode = (a: Country, b: Country) => a?.dial_code === b?.dial_code;
  onCountry(c: Country | null): void { this.selectedCountry.set(c); }

  // ── email chips ────────────────────────────────────────────────────
  commit(ev?: Event): void {
    const raw = this.draft().trim().replace(/[,;]$/, '');
    if (!raw) return;
    ev?.preventDefault();
    if (!EMAIL_RE.test(raw)) { this.emailError.set('DOC_SEND.ERR_EMAIL'); return; }
    this.emailError.set('');
    if (!this.emails().includes(raw)) this.emails.update(l => [...l, raw]);
    this.draft.set('');
  }
  onKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' || ev.key === ',' || ev.key === ';') this.commit(ev);
  }
  onPaste(ev: ClipboardEvent): void {
    const text = ev.clipboardData?.getData('text') ?? '';
    if (!/[,;\s]/.test(text.trim())) return;
    ev.preventDefault();
    const valid = text.split(/[,;\s]+/).filter(t => EMAIL_RE.test(t));
    this.emails.update(l => [...l, ...valid.filter(v => !l.includes(v))]);
  }
  removeEmail(e: string): void { this.emails.update(l => l.filter(x => x !== e)); }

  // ── send ───────────────────────────────────────────────────────────
  async sendEmail(): Promise<void> {
    this.commit();
    if (!this.emails().length || this.sending()) return;
    this.sending.set(true);
    try {
      const res = await this.data.sendEmail({ emails: this.emails(), language: 'english' });
      if (res?.success) { this.toast.success('DOC_SEND.SENT'); this.ref.close(true); }
      else this.toast.error('COMMON.OPS', typeof res === 'string' ? res : (res?.msg ?? ''));
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.sending.set(false);
    }
  }

  async sendWhatsapp(): Promise<void> {
    const wa = this.data.whatsapp;
    if (!wa || !this.canWhatsapp() || this.sending()) return;
    this.sending.set(true);
    try {
      const code = this.selectedCountry()!.dial_code.replace('+', '');
      const phone = code + this.number().replace(/^\+/, '').trim();
      const res: any = await this.api.request(this.api.post('accounts/sendByWhatsapp', { type: wa.type, id: wa.id, phone }));
      if (res?.success) { this.toast.success('DOC_SEND.SENT_WHATSAPP'); this.ref.close(true); }
      else this.toast.error('COMMON.OPS', res?.msg ?? '');
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message ?? '');
    } finally {
      this.sending.set(false);
    }
  }
}
