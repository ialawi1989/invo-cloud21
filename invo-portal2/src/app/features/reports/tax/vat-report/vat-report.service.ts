import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';
import { ReportApiFilter } from '../../models/report.model';

/** One box of the VAT return. */
export interface VatBox {
  boxNo: string | number;
  description: string;
  /** Opens the sales / purchase VAT details of this tax (or of these taxes together). */
  taxId?: string;
  taxes?: string[];
  /** The purchases box that opens the bills of entry. */
  isBillOfEntry?: boolean;
  amount: number;
  adjustment: number;
  vatAmount: number;
}

export interface VatSection { records: VatBox[]; totalAmount: number; totalAdjustment: number; totalVatAmount: number; }
export interface VatReportData { sales: VatSection; purchases: VatSection; }

const dec = (v: unknown): number => (v == null || v === '' ? 0 : parseFloat((+v).toFixed(3)) || 0);
const blank = (boxNo: string | number, description: string, extra: Partial<VatBox> = {}): VatBox => ({ boxNo, description, amount: 0, adjustment: 0, vatAmount: 0, ...extra });
const letter = (i: number): string => String.fromCharCode(97 + i);

function finish(records: VatBox[]): VatSection {
  // in box order: 1(a), 1(b), 2 … 8(a), 9, 10, 11(a) … (the number first, then the letter)
  const key = (r: VatBox): [number, string] => { const m = /^(\d+)\(?([a-z]*)/.exec(String(r.boxNo)); return [m ? +m[1] : 0, m?.[2] ?? '']; };
  records.sort((x, y) => { const [nx, lx] = key(x); const [ny, ly] = key(y); return nx - ny || lx.localeCompare(ly); });
  return {
    records,
    totalAmount: records.reduce((t, r) => t + +r.amount, 0),
    totalAdjustment: records.reduce((t, r) => t + +r.adjustment, 0),
    totalVatAmount: records.reduce((t, r) => t + +r.vatAmount, 0),
  };
}

/**
 * VAT Report — the legacy page calls `getSalesVatReport` and `getPurchaseVatReport` together and lays the rows out as
 * the boxes of the VAT return (sales boxes 1–7, purchase boxes 8–14); this keeps its arithmetic and box numbering.
 */
@Injectable({ providedIn: 'root' })
export class VatReportService {
  private api = inject(ApiService);

  private async post(route: string, filter: ReportApiFilter): Promise<any[]> {
    const res = await this.api.request<any>(this.api.post(`accounts/reports/${route}`, { filter }));
    const d = res?.data ?? res;
    return Array.isArray(d) ? d : (d?.records ?? d?.list ?? []);
  }

  async load(f: ReportApiFilter): Promise<VatReportData> {
    const filter: ReportApiFilter = { allowComparison: false, periodQty: 1, ...f };
    const [sales, purchases] = await Promise.all([this.post('getSalesVatReport', filter), this.post('getPurchaseVatReport', filter)]);
    return { sales: this.buildSales(sales), purchases: this.buildPurchases(purchases) };
  }

  private row(boxNo: string | number, e: any, vat = true): VatBox {
    return { boxNo, description: e['taxName'], taxId: e['taxId'], amount: dec(e['Total']), adjustment: dec(e['Adjusments']), vatAmount: vat ? dec(e['vatTotal']) : 0 };
  }

  private buildSales(raw: any[]): VatSection {
    const exempt = raw.find(r => r['taxName'] === 'Exempt Tax');
    const zero = raw.find(r => r['taxName'] === 'Zero Tax');
    const regular = raw.filter(r => r['taxName'] !== 'Exempt Tax' && r['taxName'] !== 'Zero Tax');
    const out: VatBox[] = regular.map((e, i) => this.row(`1(${letter(i)})`, e));
    out.push(blank(2, 'Sales to registered taxpayers in other GCC State'));
    out.push(blank(3, 'Sales subject to domestic reverse charge mechanism'));
    if (zero) out.push(this.row(4, zero, false));
    out.push(blank(5, 'Exports'));
    if (exempt) out.push(this.row(6, exempt, false));
    return finish(out);
  }

  private buildPurchases(raw: any[]): VatSection {
    const exempt = raw.find(r => r['taxName'] === 'Exempt Tax');
    const zero = raw.find(r => r['taxName'] === 'Zero Tax');
    const entry = raw.find(r => r['taxName'] === 'Imports subject to Vat paid at customs');
    const regular = raw.filter(r => !['Exempt Tax', 'Zero Tax', 'Imports subject to Vat paid at customs'].includes(r['taxName']));
    const out: VatBox[] = regular.map((e, i) => this.row(`8(${letter(i)})`, e));
    out.push({ boxNo: 9, description: 'Imports subject to Vat paid at customs', isBillOfEntry: true, amount: dec(entry?.Total), adjustment: dec(entry?.Adjusments), vatAmount: dec(entry?.vatTotal) });
    out.push(blank(10, 'Imports subject to Vat deferral at customs'));
    regular.forEach((e, i) => out.push(blank(`11(${letter(i)})`, 'Imports subject to Vat accounted for through reverse charge mechanism at ' + e['taxName'])));
    out.push(blank(12, 'Purchase subject to domestic reverse charge mechanism'));
    const taxes = [exempt?.['taxId'], zero?.['taxId']].filter(Boolean) as string[];
    out.push({
      boxNo: 13, description: 'Purchase subject from non-registered suppliers, zero-rated/exempt purchase', taxes,
      amount: dec((exempt ? +exempt['Total'] : 0) + (zero ? +zero['Total'] : 0)),
      adjustment: dec(exempt?.['Adjusments']) + dec(zero?.['Adjusments']), vatAmount: 0,
    });
    return finish(out);
  }
}
