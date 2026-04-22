import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, from, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { ProductsService } from './products.service';

/**
 * Ports the old project's `nameExistInTable` async validator — mirrors the
 * 500ms debounce and only runs when the control has been touched. When the
 * backend reports a clash, emits `{ exist: true }` on the control so
 * consumers can surface a friendly error message.
 *
 * Wire into a reactive form by constructing the validator through a
 * factory that has access to the current product id (so edits to the
 * product's own name don't flag themselves as duplicates).
 */
export interface ProductNameValidatorOptions {
  /** Current product id (empty/undefined on new products). */
  getProductId: () => string | null | undefined;
  /** `'product'` by default — override if validating against a different
   *  entity (e.g. `'matrixItem'`). */
  tableName?: string;
  /** Debounce (ms) before hitting the backend. Default: 500ms. */
  debounceMs?: number;
}

export function productNameUniqueValidator(
  products: ProductsService,
  opts: ProductNameValidatorOptions,
): AsyncValidatorFn {
  const debounce = opts.debounceMs ?? 500;
  const table    = opts.tableName ?? 'product';

  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = (control.value ?? '').toString().trim();
    if (!value || !control.dirty) return of(null);

    return timer(debounce).pipe(
      switchMap(() => from(products.validateName({
        tableName: table,
        id: opts.getProductId() ?? '',
        name: value,
      }))),
      map(res => res.success ? null : { exist: true }),
      catchError(() => of(null)),
    );
  };
}

export interface ProductBarcodeValidatorOptions {
  getProductId: () => string | null | undefined;
  getIsMatrix?: () => boolean | undefined;
  tableName?: string;
  debounceMs?: number;
}

export function productBarcodeUniqueValidator(
  products: ProductsService,
  opts: ProductBarcodeValidatorOptions,
): AsyncValidatorFn {
  const debounce = opts.debounceMs ?? 500;
  const table    = opts.tableName ?? 'product';

  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = (control.value ?? '').toString().trim();
    if (!value || !control.dirty) return of(null);

    return timer(debounce).pipe(
      switchMap(() => from(products.validateBarcode({
        tableName: table,
        productId: opts.getProductId() ?? '',
        barcode: value,
        ...(opts.getIsMatrix ? { isMatrix: opts.getIsMatrix() } : {}),
      }))),
      map(res => res.success ? null : { exist: true }),
      catchError(() => of(null)),
    );
  };
}
