import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '@core/http/api.service';

import { CreditNote } from '../../models/credit-note.model';
import { Invoice } from '../../models/invoice.model';

/**
 * Credit notes API — the endpoints of the legacy `CreditNotesService` (same paths, verbs, payloads;
 * all verified against the backend's `accounts` router). Reads unwrap the envelope to `data`; the save
 * returns the raw `{success,msg,data}` body and resolves the server's error body on HTTP failure.
 */
@Injectable({ providedIn: 'root' })
export class CreditNotesService {
  private api = inject(ApiService);
  private translate = inject(TranslateService);

  private async data<T = any>(req: ReturnType<ApiService['get']>): Promise<T> {
    return (await this.api.request(req))?.data as T;
  }

  private async envelope(req: ReturnType<ApiService['get']>): Promise<any> {
    try {
      return await this.api.request(req);
    } catch (e: any) {
      return e?.error ?? e;
    }
  }

  private get lang(): string {
    return this.translate.currentLang || this.translate.defaultLang || '';
  }

  /** Paged list: `{ list, count, pageCount, startIndex, lastIndex }`. */
  async getCreditNoteList(param: any): Promise<any> {
    const d = await this.data<any>(this.api.post('accounts/getCreditNotes', param));
    if (!d) return { list: [], count: 0, pageCount: 0 };
    return { list: d.list, count: d.count, pageCount: d.pageCount, startIndex: d.startIndex, lastIndex: d.lastIndex };
  }

  getCreditNoteRaw = (id: string) => this.data(this.api.get('accounts/getCreditNote/' + id));

  async getCreditNote(id: string): Promise<CreditNote> {
    const note = new CreditNote();
    note.ParseJson(await this.getCreditNoteRaw(id));
    return note;
  }

  async getCreditNoteNumber(): Promise<string> {
    return (await this.data<any>(this.api.get('accounts/getCreditNoteNumber/')))?.creditNoteNumber ?? '';
  }

  /** The invoices of a customer / branch that can still be credited. */
  async getInvoicesForCreditNote(branchId: string, customerId: string): Promise<Invoice[]> {
    const raw: any[] = (await this.data<any[]>(this.api.get(`accounts/getInvoicesForCreditNote/${branchId}/${customerId}`))) ?? [];
    return raw.map(r => { const i = new Invoice(); i.ParseJson(r); return i; });
  }

  /** The invoice to credit, with each line's `maxQty` and the shares earlier credit notes already hold. */
  getCreditNoteInvoiceRaw = (creditNoteId: string | null, invoiceId: string) =>
    this.data(this.api.post('accounts/getCreditNoteInvoice', { creditNoteId, invoiceId }));

  saveCreditNote(info: any): Promise<any> {
    return this.envelope(this.api.post('accounts/saveCreditNote', info));
  }

  /** Accounting entries of the credit note: `{ defaultJournals, extraJournals }` (applied credits / refunds). */
  getCreditNoteJournal = (id: string) => this.data(this.api.get('accounts/getCreditNoteJournal/' + id));

  deleteCreditNote = (id: string) => this.api.request(this.api.delete('accounts/deleteCreditNote/' + id));

  /** Takes a credit that was applied to an invoice back (view → "Applied to" rows). */
  deleteAppliedCredit = (id: string) => this.api.request(this.api.delete('accounts/deleteAppliedCredit/' + id));

  sendCreditNoteEmail = (param: any = null) => this.api.request(this.api.post('accounts/sendCreditNoteEmail/', param));

  viewCreditNotePdf = (id: string) =>
    this.data(this.api.get('accounts/viewCreditNotePdf/' + id, this.lang ? { lang: this.lang } : undefined));
}
