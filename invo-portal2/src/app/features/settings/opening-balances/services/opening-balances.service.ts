import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { saveAs } from 'file-saver';
import { ApiService } from '@core/http';
import { environment } from '../../../../../environments/environment';

import {
  OpeningBalanceAccount,
  OpeningBalanceLoad,
  OpeningBalanceRecord,
  SaveOpeningBalancePayload,
} from './opening-balances.types';

/** A row parsed from an imported product file. */
export interface InventoryImportRow { barcode: string; name: string; openingBalance: number; openingBalanceCost: number; }
/** A row parsed from an imported supplier / customer file. */
export interface PartyImportRow { name: string; phone: string; openingBalance: number; }
/** Per-row error returned by an import. */
export interface ImportError { name: string; error: string; }
/** File format for template / export downloads. */
export type FileType = 'csv' | 'xlsx';

/** One page of expandable sub-records. */
interface RecordPage {
  list:      OpeningBalanceRecord[];
  count:     number;
  pageCount: number;
}

/**
 * OpeningBalancesService
 * ──────────────────────
 * Wraps the legacy `accounts/*` opening-balance endpoints:
 *
 *   GET  accounts/getOpeningBalanceAccounts/:branchId        → grid + date
 *   POST accounts/saveAccountsOpeningBalance                 → persist grid
 *   POST accounts/getReceivableOpeningBalanceRecords         → customer rows
 *   POST accounts/getPayableOpeningBalanceRecords            → supplier rows
 *   POST accounts/getInventoryAssetsOpeningBalanceRecords    → product rows
 *   POST accounts/saveInventoryAssetsOpeningBalance          → per-product edit
 */
@Injectable({ providedIn: 'root' })
export class OpeningBalancesService {
  private api  = inject(ApiService);
  private http = inject(HttpClient);
  private baseUrl = environment.backendUrl;

  // ─── Load / save the accounts grid ───────────────────────────────────────
  async getAccounts(branchId: string): Promise<OpeningBalanceLoad> {
    const res = await this.api.request<any>(
      this.api.get(`accounts/getOpeningBalanceAccounts/${branchId}`),
    );
    const data = res?.data ?? res ?? {};
    const accounts: OpeningBalanceAccount[] = (data.accounts ?? []).map((a: any) => this.normalize(a));
    return { accounts, openingBalanceDate: data.openingBalanceDate ?? null };
  }

  async save(payload: SaveOpeningBalancePayload): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.post('accounts/saveAccountsOpeningBalance/', payload),
    );
    return !!res?.success;
  }

  // ─── Expandable sub-records ──────────────────────────────────────────────
  async getReceivableRecords(branchId: string, page: number, limit: number): Promise<RecordPage> {
    return this.records('accounts/getReceivableOpeningBalanceRecords/', { branchId, page, limit });
  }

  async getPayableRecords(branchId: string, page: number, limit: number): Promise<RecordPage> {
    return this.records('accounts/getPayableOpeningBalanceRecords/', { branchId, page, limit });
  }

  async getInventoryRecords(
    branchId: string, accountId: string | null, page: number, limit: number, searchTerm: string,
  ): Promise<RecordPage> {
    return this.records('accounts/getInventoryAssetsOpeningBalanceRecords/', {
      branchId, accountId, page, limit, searchTerm,
    });
  }

  /** Per-product inventory opening-balance edit (stock / balance / cost). */
  async saveInventoryRecord(param: {
    branchId: string; productId: string; stock: number;
    openingBalance: number; openingBalanceCost: number;
  }): Promise<boolean> {
    const res = await this.api.request<any>(
      this.api.post('accounts/saveInventoryAssetsOpeningBalance', param),
    );
    return !!res?.success;
  }

  // ─── Import / Export ─────────────────────────────────────────────────────
  /** Bulk-set inventory opening balances from an imported product file. */
  async importInventory(branchId: string, products: InventoryImportRow[]): Promise<{ success: boolean; msg?: string; errors: ImportError[] }> {
    const res = await this.api.request<any>(
      this.api.post('accounts/saveInventoryAssetsOpeningBalance', { branchId, products }),
    );
    return { success: !!res?.success, msg: res?.msg, errors: this.mapErrors(res, 'productName') };
  }

  async importSuppliers(branchId: string, suppliers: PartyImportRow[]): Promise<{ success: boolean; msg?: string; errors: ImportError[] }> {
    const res = await this.api.request<any>(
      this.api.post('accounts/importSupplierOpeningBalance', { branchId, suppliers }),
    );
    return { success: !!res?.success, msg: res?.msg, errors: this.mapErrors(res, 'supplierName') };
  }

  async importCustomers(branchId: string, customers: PartyImportRow[]): Promise<{ success: boolean; msg?: string; errors: ImportError[] }> {
    const res = await this.api.request<any>(
      this.api.post('accounts/importCustomersOpeningBalance', { branchId, customers }),
    );
    return { success: !!res?.success, msg: res?.msg, errors: this.mapErrors(res, 'customerName') };
  }

  /** Server-side exports (blob download). `kind` picks the endpoint/filename. */
  async exportFile(kind: 'inventory' | 'suppliers' | 'customers', branchId: string, type: FileType): Promise<void> {
    const endpoints: Record<string, { path: string; file: string }> = {
      inventory: { path: `accounts/exprotInventoryAssetsOpeningBalance/${branchId}/${type}`, file: `products.${type}` },
      suppliers: { path: `accounts/exportSuppliersOpeningBalance/${branchId}/${type}`,       file: `suppliers.${type}` },
      customers: { path: `accounts/exportCustomerOpeningBalance/${branchId}/${type}`,        file: `customers.${type}` },
    };
    const { path, file } = endpoints[kind];
    const blob = await firstValueFrom(
      this.http.get(`${this.baseUrl}${path}`, { responseType: 'blob' }),
    );
    saveAs(blob, file);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  private mapErrors(res: any, nameKey: string): ImportError[] {
    const errs = res?.data?.errors;
    if (!Array.isArray(errs)) return [];
    return errs.map((e: any) => ({ name: String(e?.[nameKey] ?? e?.name ?? ''), error: String(e?.error ?? e?.message ?? '') }));
  }

  private async records(endpoint: string, body: Record<string, unknown>): Promise<RecordPage> {
    const res = await this.api.request<any>(this.api.post(endpoint, body));
    const data = res?.data ?? {};
    const list: OpeningBalanceRecord[] = (data.list ?? []).map((r: any) => ({
      id:                 String(r.id ?? ''),
      name:               String(r.name ?? ''),
      openingBalance:     Number(r.openingBalance) || 0,
      stock:              r.stock != null ? Number(r.stock) || 0 : undefined,
      openingBalanceCost: r.openingBalanceCost != null ? Number(r.openingBalanceCost) || 0 : undefined,
      editing:            false,
    }));
    return {
      list,
      count:     Number(data.count ?? list.length) || 0,
      pageCount: Number(data.pageCount ?? 1) || 1,
    };
  }

  private normalize(a: any): OpeningBalanceAccount {
    // Clamp negatives, mirror the legacy load-time guard.
    const debit  = Math.max(0, Number(a.debit)  || 0);
    const credit = Math.max(0, Number(a.credit) || 0);
    return {
      accountId:  a.accountId ?? a.id ?? null,
      name:       String(a.name ?? ''),
      default:    !!a.default,
      type:       String(a.type ?? ''),
      parentType: String(a.parentType ?? ''),
      debit,
      credit,
    };
  }
}
