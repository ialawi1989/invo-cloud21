import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../core/http';

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
