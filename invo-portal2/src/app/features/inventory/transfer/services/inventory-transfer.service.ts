import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/http/api.service';

import { ProductsService } from '../../../products/services/products.service';
import {
  InventoryTransfer, TransferJournalBranch, TransferLine, TransferListParams, TransferListResult, TransferProduct, TransferRow,
  TransferSubLine, pickedQty,
} from '../models/inventory-transfer.model';

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export const mapSub = (s: any): TransferSubLine => ({
  id: s?.id ?? '', qty: num(s?.qty), unitCost: num(s?.unitCost), batch: s?.batch ?? '', serial: s?.serial ?? '',
  expireDate: s?.expireDate ?? null, prodDate: s?.prodDate ?? null, onHand: num(s?.onHand), isSelected: s?.isSelected ?? true,
});

export const mapLine = (l: any): TransferLine => ({
  id: l?.id ?? '', productId: l?.productId ?? '', productName: l?.productName ?? '', UOM: l?.UOM ?? '', barcode: l?.barcode ?? '',
  categoryName: l?.categoryName ?? '', type: l?.type ?? '', qty: num(l?.qty), unitCost: num(l?.unitCost), onHand: num(l?.onHand),
  batches: (l?.batches ?? []).map(mapSub), serials: (l?.serials ?? []).map(mapSub),
});

/**
 * Inventory transfers API - the `product/*InventoryTransfer*` endpoints of the legacy `InventoryTransferService`
 * (InvoCloudBack `routes/v1/app/product.ts` -> `inventoryTransfer.controller`), same paths, verbs and payloads.
 */
@Injectable({ providedIn: 'root' })
export class InventoryTransferService {
  private api = inject(ApiService);
  private products = inject(ProductsService);

  async getList(params: TransferListParams = {}): Promise<TransferListResult> {
    const body = {
      page: params.page ?? 1,
      limit: params.limit ?? 15,
      searchTerm: params.searchTerm ?? '',
      // Left out when unsorted: the backend reads `sortBy.sortValue` straight into its ORDER BY.
      ...(params.sortBy ? { sortBy: params.sortBy } : {}),
      filter: params.filter ?? {},
    };
    const res = await this.api.request<any>(this.api.post('product/getInventoryTransferList', body));
    const list: TransferRow[] = res?.data?.list ?? [];
    return { list, count: num(res?.data?.count ?? list.length), pageCount: num(res?.data?.pageCount ?? 1) || 1 };
  }

  async getById(id: string): Promise<InventoryTransfer | null> {
    const res = await this.api.request<any>(this.api.get('product/getInventoryTransfer/' + id));
    const d = res?.data;
    if (!d?.id) return null;
    return {
      id: d.id, transferNumber: d.transferNumber ?? '', reference: d.reference ?? '', status: d.status ?? 'Open', type: d.type ?? '',
      reason: d.reason ?? '', note: d.note ?? '', createdDate: d.createdDate ?? '', confirmDatetime: d.confirmDatetime ?? null,
      employeeId: d.employeeId ?? '', employeeName: d.employeeName ?? '', confirmedEmployee: d.confirmedEmployee ?? '',
      confirmedEmployeeName: d.confirmedEmployeeName ?? '', branchId: d.branchId ?? '', branchName: d.branchName ?? '',
      destinationBranch: d.destinationBranch ?? null, destinationBranchName: d.destinationBranchName ?? '',
      inventoryBalancingAccountId: d.inventoryBalancingAccountId ?? null, inventoryRequestId: d.inventoryRequestId ?? '',
      lines: (d.lines ?? []).map(mapLine),
    };
  }

  /** Accounting entries of a confirmed transfer, grouped by branch. */
  async getJournal(id: string): Promise<TransferJournalBranch[]> {
    const res = await this.api.request<any>(this.api.get('product/getTransferJournal/' + id));
    return res?.data?.defaultJournals ?? [];
  }

  /** The next transfer number (the backend also re-issues one on save if this one was taken). */
  async getNumber(): Promise<string> {
    const res = await this.api.request<any>(this.api.get('product/getTransferNumber'));
    return String(res?.data?.transferNumber ?? '');
  }

  /** Products of a branch with their on-hand (`product/getPhysicalCountProducts`): inventory, kit, batch and serialized. */
  async getBranchProducts(params: { branchId: string; page: number; limit: number; searchTerm: string }): Promise<{ list: TransferProduct[]; count: number }> {
    const res = await this.api.request<any>(this.api.post('product/getPhysicalCountProducts', { ...params, sortBy: {} }));
    const list: TransferProduct[] = (res?.data?.list ?? []).map((p: any) => ({
      id: p.id, name: p.name ?? '', barcode: p.barcode ?? '', UOM: p.UOM ?? '', type: p.type ?? '',
      unitCost: num(p.unitCost), onHand: num(p.onHand), categoryName: p.categoryName ?? '',
    }));
    return { list, count: num(res?.data?.count ?? list.length) };
  }

  /** Products by barcode, for the import and for converting an inventory request. */
  async getProductsByBarcodes(barcodes: string[], branchId: string): Promise<TransferProduct[]> {
    const rows = await this.products.getBarcodesProducts(barcodes, branchId);
    return rows.map((p: any) => ({
      id: p.id, name: p.name ?? '', barcode: p.barcode ?? '', UOM: p.UOM ?? '', type: p.type ?? '',
      unitCost: num(p.unitCost), onHand: num(p.onHand), categoryName: p.categoryName ?? '',
    }));
  }

  /** Batch products of a branch that hold expired stock, ready to be written off (the wastage shortcut). */
  async getBatchWastageProducts(branchId: string): Promise<TransferLine[]> {
    const res = await this.api.request<any>(this.api.post('product/getBatchWastageProducts', { branchId }));
    return (res?.data ?? []).map((e: any) => {
      const line = mapLine({ ...e, id: '', productName: e.name, qty: 0 });
      // Expired batches are ticked with everything they hold; the rest start at their qty.
      line.batches = (e.batches ?? []).map((b: any) => ({
        ...mapSub(b), isSelected: !!b.expired, expired: !!b.expired, qty: b.expired ? num(b.onHand) : num(b.qty),
      }));
      return line;
    });
  }

  /** Accounts a transfer can post against: the opening-balance adjustment for a transfer in, cost / expense accounts for out. */
  async getImpactAccounts(type: string): Promise<{ id: string; name: string; code: string }[]> {
    const url = type === 'Transfer In' ? 'accounts/getInventoryTransferAccounts' : 'accounts/getInventoryTransferExpenseAccounts';
    const res = await this.api.request<any>(this.api.post(url, {}));
    return (res?.data?.list ?? []).map((a: any) => ({ id: a.id, name: a.name ?? '', code: a.code ?? '' }));
  }

  /**
   * Creates (no id) or updates a transfer. `status: 'Confirmed'` moves the stock right away. Returns the raw
   * `{ success, msg, data }` envelope. Sub-lines (serials / batches) that were never saved carry an empty id so the
   * backend inserts them - an id there makes it update a row that does not exist.
   */
  async save(t: InventoryTransfer): Promise<any> {
    const iso = (v: string | null) => (v ? new Date(v).toISOString() : new Date().toISOString());
    const sub = (s: TransferSubLine) => ({
      id: s.id || '', qty: s.qty, unitCost: s.unitCost, batch: s.batch, serial: s.serial, expireDate: s.expireDate, prodDate: s.prodDate,
      isSelected: s.isSelected && !s.isDeleted, isDeleted: !!s.isDeleted,
    });
    const body = {
      id: t.id || null,
      transferNumber: t.transferNumber,
      createdDate: iso(t.createdDate),
      confirmDatetime: iso(t.confirmDatetime),
      reference: t.reference ?? '',
      note: t.note ?? '',
      branchId: t.branchId,
      type: t.type,
      status: t.status,
      reason: t.reason ?? '',
      destinationBranch: t.reason === 'To Another Branch' ? t.destinationBranch : null,
      inventoryBalancingAccountId: t.inventoryBalancingAccountId,
      inventoryRequestId: t.inventoryRequestId || '',
      lines: t.lines.map(l => ({
        id: l.id || '', InventoryTransferId: t.id || '', productId: l.productId, qty: l.isDeleted ? l.qty || 1 : pickedQty(l),
        unitCost: l.unitCost, UOM: l.UOM, barcode: l.barcode, type: l.type, isDeleted: !!l.isDeleted,
        serials: l.serials.map(sub), batches: l.batches.map(sub),
      })),
    };
    return this.api.request<any>(this.api.post('product/saveInventoryTransfer', body));
  }
}
