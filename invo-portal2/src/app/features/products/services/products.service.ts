import { Injectable, inject } from '@angular/core';
import { ProductListService } from './product-list.service';
import { ProductCrudService } from './product-crud.service';
import { ProductInventoryService } from './product-inventory.service';
import { ProductCollectionService } from './product-collection.service';

// Re-export all types so existing consumers keep working with
// import { ... } from '...products.service' unchanged.
export * from './product.types';

// Re-export sub-services for consumers that want to inject directly.
export { ProductListService } from './product-list.service';
export { ProductCrudService } from './product-crud.service';
export { ProductInventoryService } from './product-inventory.service';
export { ProductCollectionService } from './product-collection.service';

/**
 * Product Service -- Facade
 *
 * Delegates to four focused sub-services:
 * - ProductListService       -- product lists, children, tags, depts, cats, custom fields, media
 * - ProductCrudService       -- get/save/delete product, serials, batches, import/export, bulk, barcode
 * - ProductInventoryService  -- options, availability, recipes, kit build/break, tags, tax
 * - ProductCollectionService -- collections, categories, brands, details, stats, activity, sales, purchase history, movement
 *
 * Existing code can keep injecting ProductsService. New code should inject
 * the sub-service it needs directly for lighter DI.
 */
@Injectable({ providedIn: 'root' })
export class ProductsService {
  private list       = inject(ProductListService);
  private crud       = inject(ProductCrudService);
  private inventory  = inject(ProductInventoryService);
  private collection = inject(ProductCollectionService);

  // ================================================================
  // LIST (delegated to ProductListService)
  // ================================================================
  getProductList                     = (...a: Parameters<ProductListService['getProductList']>)                     => this.list.getProductList(...a);
  productChildsList                  = (...a: Parameters<ProductListService['productChildsList']>)                  => this.list.productChildsList(...a);
  getProductTags                     = (...a: Parameters<ProductListService['getProductTags']>)                     => this.list.getProductTags(...a);
  getDepartments                     = (...a: Parameters<ProductListService['getDepartments']>)                     => this.list.getDepartments(...a);
  getCategories                      = (...a: Parameters<ProductListService['getCategories']>)                      => this.list.getCategories(...a);
  getBrands                          = (...a: Parameters<ProductListService['getBrands']>)                          => this.list.getBrands(...a);
  getTaxes                           = (...a: Parameters<ProductListService['getTaxes']>)                           => this.list.getTaxes(...a);
  getChildProducts                   = (...a: Parameters<ProductListService['getChildProducts']>)                   => this.list.getChildProducts(...a);
  getCustomFields                    = ()                                                                            => this.list.getCustomFields();
  getProductForMedia                 = (...a: Parameters<ProductListService['getProductForMedia']>)                 => this.list.getProductForMedia(...a);
  bulkProductMedia                   = (...a: Parameters<ProductListService['bulkProductMedia']>)                   => this.list.bulkProductMedia(...a);

  // ================================================================
  // CRUD (delegated to ProductCrudService)
  // ================================================================
  getProduct                         = (...a: Parameters<ProductCrudService['getProduct']>)                         => this.crud.getProduct(...a);
  getProductByBarcode                = (...a: Parameters<ProductCrudService['getProductByBarcode']>)                => this.crud.getProductByBarcode(...a);
  cloneProduct                       = (...a: Parameters<ProductCrudService['cloneProduct']>)                       => this.crud.cloneProduct(...a);
  saveProduct                        = (...a: Parameters<ProductCrudService['saveProduct']>)                        => this.crud.saveProduct(...a);
  deleteProduct                      = (...a: Parameters<ProductCrudService['deleteProduct']>)                      => this.crud.deleteProduct(...a);
  getProductSerials                   = (...a: Parameters<ProductCrudService['getProductSerials']>)                  => this.crud.getProductSerials(...a);
  getProductBatches                   = (...a: Parameters<ProductCrudService['getProductBatches']>)                  => this.crud.getProductBatches(...a);
  importProducts                     = (...a: Parameters<ProductCrudService['importProducts']>)                     => this.crud.importProducts(...a);
  exportProducts                     = (...a: Parameters<ProductCrudService['exportProducts']>)                     => this.crud.exportProducts(...a);
  getBulkImportProgress              = ()                                                                            => this.crud.getBulkImportProgress();
  updateBulkPrices                   = (...a: Parameters<ProductCrudService['updateBulkPrices']>)                   => this.crud.updateBulkPrices(...a);
  updateTranslation                  = (...a: Parameters<ProductCrudService['updateTranslation']>)                  => this.crud.updateTranslation(...a);
  generateRandomEan13                = ()                                                                            => this.crud.generateRandomEan13();
  showGenerateBarcode                = (...a: Parameters<ProductCrudService['showGenerateBarcode']>)                => this.crud.showGenerateBarcode(...a);
  productMergeInfo                   = (...a: Parameters<ProductCrudService['productMergeInfo']>)                   => this.crud.productMergeInfo(...a);
  validateName                       = (...a: Parameters<ProductCrudService['validateName']>)                       => this.crud.validateName(...a);
  validateBarcode                    = (...a: Parameters<ProductCrudService['validateBarcode']>)                    => this.crud.validateBarcode(...a);

  // ================================================================
  // INVENTORY (delegated to ProductInventoryService)
  // ================================================================
  setProductOptions                  = (...a: Parameters<ProductInventoryService['setProductOptions']>)             => this.inventory.setProductOptions(...a);
  getProductOptionsOld               = ()                                                                            => this.inventory.getProductOptionsOld();
  getProductOptions                  = ()                                                                            => this.inventory.getProductOptions();
  saveProductInventoryLocations      = (...a: Parameters<ProductInventoryService['saveProductInventoryLocations']>) => this.inventory.saveProductInventoryLocations(...a);
  getInventoryLocationsList          = (...a: Parameters<ProductInventoryService['getInventoryLocationsList']>)     => this.inventory.getInventoryLocationsList(...a);
  getProductAvailability             = (...a: Parameters<ProductInventoryService['getProductAvailability']>)        => this.inventory.getProductAvailability(...a);
  getBranchProductsAvailability      = (...a: Parameters<ProductInventoryService['getBranchProductsAvailability']>) => this.inventory.getBranchProductsAvailability(...a);
  setBranchProductAvailability       = (...a: Parameters<ProductInventoryService['setBranchProductAvailability']>)  => this.inventory.setBranchProductAvailability(...a);
  updateAvailability                 = (...a: Parameters<ProductInventoryService['updateAvailability']>)            => this.inventory.updateAvailability(...a);
  updateOnlineAvailability           = (...a: Parameters<ProductInventoryService['updateOnlineAvailability']>)      => this.inventory.updateOnlineAvailability(...a);
  getOptionsBranchAvailability       = (...a: Parameters<ProductInventoryService['getOptionsBranchAvailability']>)  => this.inventory.getOptionsBranchAvailability(...a);
  getOptionsProductAvailability      = (...a: Parameters<ProductInventoryService['getOptionsProductAvailability']>) => this.inventory.getOptionsProductAvailability(...a);
  setOptionsBranchAvailability       = (...a: Parameters<ProductInventoryService['setOptionsBranchAvailability']>)  => this.inventory.setOptionsBranchAvailability(...a);
  setOptionsProductAvailability      = (...a: Parameters<ProductInventoryService['setOptionsProductAvailability']>) => this.inventory.setOptionsProductAvailability(...a);
  updateProductOptionsAvailability   = (...a: Parameters<ProductInventoryService['updateProductOptionsAvailability']>) => this.inventory.updateProductOptionsAvailability(...a);
  updateOnlineProductOptionsAvailability = (...a: Parameters<ProductInventoryService['updateOnlineProductOptionsAvailability']>) => this.inventory.updateOnlineProductOptionsAvailability(...a);
  saveProductRecipeItem              = (...a: Parameters<ProductInventoryService['saveProductRecipeItem']>)         => this.inventory.saveProductRecipeItem(...a);
  deleteProductRecipeItem            = (...a: Parameters<ProductInventoryService['deleteProductRecipeItem']>)       => this.inventory.deleteProductRecipeItem(...a);
  getKitMaxQty                       = (...a: Parameters<ProductInventoryService['getKitMaxQty']>)                  => this.inventory.getKitMaxQty(...a);
  buildKit                           = (...a: Parameters<ProductInventoryService['buildKit']>)                      => this.inventory.buildKit(...a);
  breakKit                           = (...a: Parameters<ProductInventoryService['breakKit']>)                      => this.inventory.breakKit(...a);
  getProductTagsRaw                  = (...a: Parameters<ProductInventoryService['getProductTags']>)                => this.inventory.getProductTags(...a);
  assignProductTax                   = (...a: Parameters<ProductInventoryService['assignProductTax']>)              => this.inventory.assignProductTax(...a);

  // ================================================================
  // COLLECTION & REPORTS (delegated to ProductCollectionService)
  // ================================================================
  getCollectionList                  = (...a: Parameters<ProductCollectionService['getCollectionList']>)            => this.collection.getCollectionList(...a);
  getCollectionById                  = (...a: Parameters<ProductCollectionService['getCollectionById']>)            => this.collection.getCollectionById(...a);
  saveCollection                     = (...a: Parameters<ProductCollectionService['saveCollection']>)               => this.collection.saveCollection(...a);
  getCollectionProducts              = (...a: Parameters<ProductCollectionService['getCollectionProducts']>)        => this.collection.getCollectionProducts(...a);
  getSectionData                     = (...a: Parameters<ProductCollectionService['getSectionData']>)               => this.collection.getSectionData(...a);
  saveCategoryProducts               = (...a: Parameters<ProductCollectionService['saveCategoryProducts']>)         => this.collection.saveCategoryProducts(...a);
  saveProductBrand                   = (...a: Parameters<ProductCollectionService['saveProductBrand']>)             => this.collection.saveProductBrand(...a);
  getProductDetails                  = (...a: Parameters<ProductCollectionService['getProductDetails']>)            => this.collection.getProductDetails(...a);
  getProductStats                    = (...a: Parameters<ProductCollectionService['getProductStats']>)              => this.collection.getProductStats(...a);
  getProductActivity                 = (...a: Parameters<ProductCollectionService['getProductActivity']>)           => this.collection.getProductActivity(...a);
  getProductSales                    = (...a: Parameters<ProductCollectionService['getProductSales']>)              => this.collection.getProductSales(...a);
  getProductSalesByDay               = (...a: Parameters<ProductCollectionService['getProductSalesByDay']>)         => this.collection.getProductSalesByDay(...a);
  getProductSalesByService           = (...a: Parameters<ProductCollectionService['getProductSalesByService']>)     => this.collection.getProductSalesByService(...a);
  getProductLast12MonthSales         = (...a: Parameters<ProductCollectionService['getProductLast12MonthSales']>)   => this.collection.getProductLast12MonthSales(...a);
  getProductPurchaseHistory          = (...a: Parameters<ProductCollectionService['getProductPurchaseHistory']>)    => this.collection.getProductPurchaseHistory(...a);
  getProductMovement                 = (...a: Parameters<ProductCollectionService['getProductMovement']>)           => this.collection.getProductMovement(...a);
}
