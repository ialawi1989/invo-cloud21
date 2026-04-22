import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http';

/**
 * Payload shape for `accounts/saveManualAdjustmentMovement`. Mirrors the
 * wire format from the old project verbatim — field names + server typo
 * (`inventoryMovmentDate`) included.
 */
export interface ManualAdjustmentLine {
  id: string;
  productId: string;
  /** New unit cost when `adjustmentType === 'unitCost adjustment'`. */
  cost?: number;
  /** Old unit cost — preserved for audit trail. */
  currentCost?: number;
  /** Existing on-hand BEFORE the adjustment (server populates display). */
  currentOnHand?: number;
  /** New on-hand value the user typed (for `onHand adjustment`). */
  tempQty?: number;
  /** Delta from currentOnHand to tempQty — backend applies this to stock. */
  qty?: number;
  unitCost?: number;
  [extra: string]: any;
}

export interface ManualAdjustmentMovement {
  id: string;
  /** Server spelling — keep as-is. */
  inventoryMovmentDate: string | null;
  /** Branch scope for the adjustment (required by backend on stock changes). */
  branchId?: string;
  branchName: string;
  employeeId: string;
  employeeName: string;
  /** `"unitCost adjustment"` | `"onHand adjustment"`. */
  adjustmentType: 'unitCost adjustment' | 'onHand adjustment' | string;
  cost: number;
  referenceId: string;
  /** Always `"Manual Adjustment"` for this endpoint. */
  type: 'Manual Adjustment' | string;
  lines: ManualAdjustmentLine[];
  [extra: string]: any;
}

/**
 * Product CRUD Service
 * Handles single-product get/save/delete, serials, batches, import/export,
 * bulk updates, barcode generation.
 */
@Injectable({ providedIn: 'root' })
export class ProductCrudService {
  private api = inject(ApiService);

  // ─── Get single product ────────────────────────────────────

  async getProduct(id: string): Promise<any> {
    return this.api.call(this.api.get(`product/getProduct/${id}`));
  }

  async getProductByBarcode(barcode: string, branchId: string): Promise<any> {
    return this.api.call(this.api.get(`product/getProduct/${barcode}/${branchId}`));
  }

  async cloneProduct(id: string): Promise<any> {
    const product = await this.getProduct(id);
    return {
      ...product,
      id: '',
      name: 'Copy of ' + (product.name ?? ''),
      barcode: '',
      mediaId: null,
      mediaUrl: { defaultUrl: '' },
      productMedia: [],
    };
  }

  // ─── Save ──────────────────────────────────────────────────

  async saveProduct(productInfo: any): Promise<any> {
    // Process branch pricing types
    productInfo.branchProduct?.forEach((branch: any) => {
      if (branch.selectedPricingType === 'buyDownPrice') {
        if (!branch.buyDownQty) branch.selectedPricingType = '';
      } else if (branch.selectedPricingType === 'priceByQty') {
        if (!branch.priceByQty?.length) branch.selectedPricingType = '';
      } else if (branch.selectedPricingType === 'priceBoundary') {
        if (!branch.priceBoundriesFrom || !branch.priceBoundriesTo) branch.selectedPricingType = '';
      }
    });

    const copy: any = { ...productInfo };
    copy.productMedia = copy.productMedia?.map((f: any) => f.id) || [];

    return this.api.request(this.api.post('product/saveProduct', copy));
  }

  // ─── Delete ────────────────────────────────────────────────

  async deleteProduct(id: string): Promise<any> {
    return this.api.request(this.api.delete(`product/deleteProduct/${id}`));
  }

  // ─── Serials & Batches ─────────────────────────────────────

  async getProductSerials(id: string, branchId: string): Promise<any[]> {
    const res = await this.api.request(this.api.get(`product/getProductSerials/${branchId}/${id}`));
    return res?.data ?? [];
  }

  async getProductBatches(id: string, branchId: string): Promise<any[]> {
    const res = await this.api.request(this.api.get(`product/getProductBatches/${branchId}/${id}`));
    return res?.data ?? [];
  }

  // ─── Import / Export ───────────────────────────────────────

  async importProducts(products: any): Promise<any> {
    return this.api.request(this.api.post('product/importProducts', products));
  }

  exportProducts(type: string): void {
    // Blob download — subscribe directly since it's a fire-and-forget download.
    this.api.get(`product/exportProducts/${type}`).subscribe((res: any) => {
      // If the API returns a blob, handle it; otherwise this is a no-op.
      if (res instanceof Blob) {
        const url = window.URL.createObjectURL(res);
        const link = document.createElement('a');
        link.href = url;
        link.download = `products.${type}`;
        link.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  async getBulkImportProgress(): Promise<any> {
    return this.api.request(this.api.get('product/getBulkImportProgress'));
  }

  // ─── Bulk Updates ──────────────────────────────────────────

  async updateBulkPrices(productList: any[]): Promise<any> {
    return this.api.request(this.api.post('product/updateBulkPrices', productList));
  }

  async updateTranslation(productList: any[]): Promise<any> {
    return this.api.request(this.api.post('product/updateTranslation', { list: productList }));
  }

  // ─── Barcode Generation ────────────────────────────────────

  generateRandomEan13(): string {
    let randomNumber = Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0');
    let checkDigit = 0;
    for (let i = 0; i < 12; i++) {
      checkDigit += parseInt(randomNumber[i]) * (i % 2 === 0 ? 1 : 3);
    }
    checkDigit = (10 - (checkDigit % 10)) % 10;
    if (checkDigit !== parseInt(randomNumber[12]) || ['20', '21', '22'].some(p => randomNumber.startsWith(p))) {
      return this.generateRandomEan13();
    }
    return randomNumber;
  }

  showGenerateBarcode(productInfo: any, type: string = '', batchOrSerialData: any = {}, branch: string = ''): void {
    // TODO: Port GenerateBarcodeComponent to standalone + use ModalService.
    // For now this is a placeholder.
    console.log('Generate barcode for:', productInfo, { type, batchOrSerialData, branch });
  }

  // ─── Manual adjustment (unit-cost / stock corrections) ─────
  /**
   * Posts a manual adjustment-movement record (endpoint: `accounts/…`).
   *
   * Body shape mirrors the old project exactly — a full movement envelope
   * with a `lines` array that carries the actual adjustment. The `type`
   * `"Manual Adjustment"` and `adjustmentType` `"unitCost adjustment"` are
   * both required discriminators the backend keys off. Note the typo in
   * `inventoryMovmentDate` — preserved to match the server field name.
   */
  async saveManualAdjustmentMovement(body: ManualAdjustmentMovement): Promise<any> {
    return this.api.request(this.api.post('accounts/saveManualAdjustmentMovement', body));
  }

  /**
   * Unit-cost adjustment. Backend signature:
   *   adjustmentType = "unitCost adjustment"
   *   lines[0].currentCost = old cost (audit)
   *   lines[0].cost        = new cost
   */
  buildUnitCostAdjustmentBody(
    productId: string,
    newUnitCost: number,
    opts: { branchId?: string; currentUnitCost?: number } = {},
  ): ManualAdjustmentMovement {
    return {
      id: '',
      inventoryMovmentDate: null,
      branchId: opts.branchId ?? '',
      branchName: '',
      employeeId: '',
      employeeName: '',
      adjustmentType: 'unitCost adjustment',
      cost: 0,
      referenceId: '',
      type: 'Manual Adjustment',
      lines: [
        {
          id: '',
          productId,
          currentCost: Number(opts.currentUnitCost ?? 0),
          cost: Number(newUnitCost) || 0,
        },
      ],
    };
  }

  /**
   * Stock (onHand) adjustment. Backend signature:
   *   adjustmentType = "onHand adjustment"
   *   lines[0].currentOnHand = old qty (audit)
   *   lines[0].tempQty       = new qty the user entered
   *   lines[0].qty           = delta (tempQty - currentOnHand)
   */
  buildStockAdjustmentBody(
    productId: string,
    branchId: string,
    currentOnHand: number,
    newOnHand: number,
  ): ManualAdjustmentMovement {
    const cur = Number(currentOnHand) || 0;
    const next = Number(newOnHand) || 0;
    return {
      id: '',
      inventoryMovmentDate: null,
      branchId,
      branchName: '',
      employeeId: '',
      employeeName: '',
      adjustmentType: 'onHand adjustment',
      cost: 0,
      referenceId: '',
      type: 'Manual Adjustment',
      lines: [
        {
          id: '',
          productId,
          currentOnHand: cur,
          tempQty: next,
          qty: next - cur,
        },
      ],
    };
  }

  // ─── Uniqueness validation (name / barcode) ───────────────
  /**
   * Checks whether a product name is free within the given table. The
   * backend contract returns `{ success: true }` when the name is unique
   * (or unchanged for the current record) and `{ success: false }` when a
   * duplicate exists elsewhere.
   */
  async validateName(params: { tableName: string; id?: string | null; name: string; branchId?: string }): Promise<{ success: boolean; msg?: string }> {
    const res = await this.api.request<any>(this.api.post('company/validateName', {
      tableName: params.tableName,
      id: params.id ?? '',
      name: params.name,
      branchId: params.branchId ?? '',
    }));
    return { success: !!res?.success, msg: res?.msg };
  }

  /**
   * Checks whether a barcode is free. Backend: `product/validateBarcode`.
   * Pass `isMatrix` when validating a matrix-product child so the backend
   * skips the parent-vs-child collision rule.
   */
  async validateBarcode(params: { tableName?: string; productId?: string | null; barcode: string; isMatrix?: boolean }): Promise<{ success: boolean; msg?: string }> {
    const res = await this.api.request<any>(this.api.post('product/validateBarcode', {
      tableName: params.tableName ?? 'product',
      productId: params.productId ?? '',
      barcode: params.barcode,
      ...(params.isMatrix != null ? { isMatrix: params.isMatrix } : {}),
    }));
    return { success: !!res?.success, msg: res?.msg };
  }

  // ─── Helper ────────────────────────────────────────────────

  productMergeInfo(allProducts: any[], currentData: any[]): void {
    if (!allProducts?.length) return;
    currentData.forEach(current => {
      current.items?.forEach((item: any) => {
        const found = allProducts.find((p: any) => p.id === item.productId);
        if (found) item.name = found.name;
      });
    });
  }
}
