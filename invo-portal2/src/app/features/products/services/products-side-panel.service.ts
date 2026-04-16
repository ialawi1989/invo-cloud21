import { Injectable, signal } from '@angular/core';

/**
 * Products Side Panel Service
 * Signal-based service - replaces NgRx Store!
 */
@Injectable({ providedIn: 'root' })
export class ProductsSidePanelService {
  private _isOpen = signal(false);
  private _productId = signal<string | null>(null);
  private _showHistory = signal(false);
  private _supplierName = signal('');
  private _supplierId = signal('');

  isOpen = this._isOpen.asReadonly();
  productId = this._productId.asReadonly();
  showHistory = this._showHistory.asReadonly();
  supplierName = this._supplierName.asReadonly();
  supplierId = this._supplierId.asReadonly();

  open(params: {
    productId: string;
    showHistory?: boolean;
    supplierName?: string;
    supplierId?: string;
  }): void {
    this._productId.set(params.productId);
    this._showHistory.set(params.showHistory ?? false);
    this._supplierName.set(params.supplierName ?? '');
    this._supplierId.set(params.supplierId ?? '');
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
  }

  toggle(): void {
    this._isOpen.update(value => !value);
  }

  setProduct(productId: string, showHistory: boolean = false): void {
    this._productId.set(productId);
    this._showHistory.set(showHistory);
  }
}
