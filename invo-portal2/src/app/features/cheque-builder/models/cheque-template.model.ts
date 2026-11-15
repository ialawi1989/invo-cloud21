/**
 * Cheque template models - 1:1 with the legacy `core/models/cheque-builder.ts` (`ChequeTemplate`, `ChequeText`
 * and its six content classes). Templates are stored client-side only (legacy `localStorage['chequeList']`);
 * InvoCloudBack has no cheque-template route.
 */
export type ChequeFieldType = 'Date' | 'Payee' | 'AmountAndCurrency' | 'Statement' | 'Crossing' | 'ChequeNumber';

export const CHEQUE_FIELD_TYPES: ChequeFieldType[] = ['Date', 'Payee', 'AmountAndCurrency', 'Statement', 'Crossing', 'ChequeNumber'];
export const CHEQUE_DPIS = [152, 203, 300, 600];
/** No Hebrew/Yiddish by standing requirement. */
export const CHEQUE_LANGUAGES = ['ar', 'en'];

export interface ChequeDate { type: 'Date'; date: string; isVisible: boolean; direction: 'ltr' | 'rtl'; useHindiNumbers: boolean }
export interface ChequePayee { type: 'Payee'; payeeName: string; phraseBefore: string; phraseAfter: string }
export interface ChequeAmountAndCurrency {
  type: 'AmountAndCurrency'; amount: number; currency: string; surroundAmountBy: string; useHindiNumbers: boolean;
  autoFillDecimalPoints: boolean; hideThousandComa: boolean;
  startTextOnly: string; endTextOnly: string; surroundOnlyBy: string; useShortCurrencyName: boolean;
  addDecimalToOnly: boolean; hideCountryName: boolean; hideCurrencyName: boolean;
}
export interface ChequeStatement { type: 'Statement'; checkStatement: string; isVisible: boolean }
export interface ChequeCrossing { type: 'Crossing'; text: string; isVisible: boolean; addLines: boolean }
export interface ChequeNumber { type: 'ChequeNumber'; text: string; isVisible: boolean }
export type ChequeContent = ChequeDate | ChequePayee | ChequeAmountAndCurrency | ChequeStatement | ChequeCrossing | ChequeNumber;

export interface ChequeText {
  fontSize: number;
  fontWeight: string;
  fontFamily: string;
  textDecoration: string;
  lineheight: number;
  width: number;
  position: { x: number; y: number };
  content: ChequeContent;
}

export interface ChequeTemplate {
  id: string;
  name: string;
  companyId: string;
  template: ChequeText[];
  LABEL: string;
  chequeHeight: number;
  chequeWidth: number;
  dpi: number;
  bank: string;
  language: string;
}

export interface ChequeListParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  sortBy?: { sortValue: string; sortDirection: string };
}
export interface ChequeListResult { list: ChequeTemplate[]; count: number; pageCount: number; startIndex: number; lastIndex: number }

export function newChequeTemplate(): ChequeTemplate {
  return { id: '', name: '', companyId: '', template: [], LABEL: '', chequeHeight: 3.5, chequeWidth: 7.05, dpi: 203, bank: '', language: 'ar' };
}

/** A content block with the legacy constructor defaults. */
export function newChequeContent(type: ChequeFieldType): ChequeContent {
  switch (type) {
    case 'Date': return { type, date: new Date().toISOString(), isVisible: true, direction: 'ltr', useHindiNumbers: false };
    case 'Payee': return { type, payeeName: '', phraseBefore: '', phraseAfter: '' };
    case 'AmountAndCurrency':
      return {
        type, amount: 0, currency: '', surroundAmountBy: '#', useHindiNumbers: false, autoFillDecimalPoints: false, hideThousandComa: false,
        startTextOnly: '', endTextOnly: 'Only', surroundOnlyBy: '', useShortCurrencyName: false, addDecimalToOnly: false,
        hideCountryName: false, hideCurrencyName: false,
      };
    case 'Statement': return { type, checkStatement: '', isVisible: true };
    case 'Crossing': return { type, text: '', isVisible: true, addLines: true };
    case 'ChequeNumber': return { type, text: '', isVisible: true };
  }
}

export function newChequeText(type: ChequeFieldType, position = { x: 0, y: 0 }): ChequeText {
  return { fontSize: 15, fontWeight: 'normal', fontFamily: 'normal', textDecoration: 'none', lineheight: 1, width: 100, position, content: newChequeContent(type) };
}

/** Legacy `ChequeTemplate.ParseJson`: copy known keys, re-hydrate every element on top of the defaults. */
export function parseChequeTemplate(json: any): ChequeTemplate {
  const out = newChequeTemplate();
  if (!json) return out;
  for (const key of Object.keys(out) as (keyof ChequeTemplate)[]) {
    if (key === 'template' || json[key] === undefined) continue;
    (out as any)[key] = json[key];
  }
  out.template = (Array.isArray(json.template) ? json.template : []).map((line: any): ChequeText => {
    const type = (line?.content?.type ?? 'Statement') as ChequeFieldType;
    const base = newChequeText(type);
    return { ...base, ...line, position: { ...base.position, ...(line?.position ?? {}) }, content: { ...base.content, ...(line?.content ?? {}) } as ChequeContent };
  });
  return out;
}
