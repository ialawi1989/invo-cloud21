import express from "express";

// Controllers
import { AuthController } from "@src/controller/app/auth.controller";
import { InvoiceController } from "@src/controller/app/Accounts/Invoice.controller";
import { PurchaseOrderController } from "@src/controller/app/Accounts/purchaseOrder.controller";
import { BranchController } from "@src/controller/admin/branch.controller";
import { SupplierController } from "@src/controller/app/Accounts/suppliers.controller";
import { TaxController } from "@src/controller/app/Accounts/tax.controller";
import { PhysicalCountController } from "@src/controller/app/Accounts/physicalCount.controller";
import { ProductController } from "@src/controller/app/products/product.controller";
import { inventoryTransferContoller } from "@src/controller/app/Accounts/inventoryTransfer.controller";
import { inventoryAppCompanyController } from "@src/controller/app/Accounts/inventoryApp/company.controller";

// Middlewares / Utils
import { ApiLimiter, ApiLimiterRepo } from "@src/apiLimiter";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
import { authenticatedContextMiddleware } from "@src/middlewear/authenticatedContextMiddleware";

const router = createAsyncRouter();
router.use(authenticatedContextMiddleware("InventoryApp"))
/* =========================
 * Auth (public)
 * ========================= */
router.post("/login", /* ApiLimiterRepo.authLimiter?, */ AuthController.login);
router.post("/refreshToken", AuthController.refreshToken);
router.get("/tryHash", AuthController.testHash);

// Protect everything below
router.use(AuthController.authintcate);

/* =========================
 * Company / Employee
 * ========================= */
router.get(
  "/getEmployeePrivielges", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter,
    inventoryAppCompanyController.getEmployeePrivielges)
);

/* =========================
 * Branches
 * ========================= */
router.get("/getBranchList", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, BranchController.getBranchesList));

/* =========================
 * Products
 * ========================= */
// Single product + per-branch data
router.get("/getProduct/:id", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, ProductController.getProduct));
router.post("/getProductBranchData", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, ProductController.getProductBranchData));

// Locations by branch
router.get("/getLocationsByBranch/:branchId", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, ProductController.getLocationsByBranch));

// Batches / Serials
router.get("/getProductBatches/:branchId/:productId", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, ProductController.getProductBatches));
router.get("/getProductSerials/:branchId/:productId", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter,ProductController.getProductSerials));

// Physical count helpers
router.post("/getBranchProductByBarcode", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PhysicalCountController.getBranchProductByBarcode));

/* =========================
 * Suppliers / Taxes
 * ========================= */
router.post("/getSupplierMiniList", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, SupplierController.getSupplierMiniList));
router.post("/getTaxesList", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, TaxController.getTaxesList));

/* =========================
 * Purchase Orders
 * ========================= */
// Lists
router.post("/getOpenPurchaseOrderList", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PurchaseOrderController.getOpenPurchaseOrderList));
router.post("/getClosedPurchaseOrderList", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PurchaseOrderController.getClosedPurchaseOrderList));

// CRUD / helpers
router.post("/savePurchaseOrder", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.writeLimiter, PurchaseOrderController.savePurchaseOrder));
router.get("/getPurchaseOrderById/:purchaseOrderId", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PurchaseOrderController.getPurchaseOrderById));
router.get("/getPurchaseAccounts", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PurchaseOrderController.getPurchaseAccounts));
router.get("/getPurchaseNumber", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PurchaseOrderController.getPurchaseNumber));

// Product lookup (for purchase)
router.post("/getPurchaseProducts", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PurchaseOrderController.getPurchaseProducts));

/* =========================
 * Physical Count
 * ========================= */
// Lists
router.post("/getphysicalCountList", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PhysicalCountController.getPhysicalCountList));
router.post("/getOpenPhysicalCountList", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PhysicalCountController.getOpenPhysicalCountList));
router.post("/getClosedPhysicalCountList", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PhysicalCountController.getClosedPhysicalCountList));
router.post("/getCalculatedPhysicalCountList", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PhysicalCountController.getCalculatedPhysicalCountList));

// Detail / actions
router.get("/getphysicalCount/:physicalCountId", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PhysicalCountController.getPhysicalCountbyId));
router.post("/getPhysicalCountProducts", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PhysicalCountController.getPhysicalCountProducts));
router.post("/getPhysicalCountProductsbyInventory", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PhysicalCountController.getPhysicalCountProductsbyInventory));
router.post("/getPhysicalCountProductsbyCategory", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, PhysicalCountController.getPhysicalCountProductsbyCategory));
router.post("/savePhysicalCount", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.writeLimiter, PhysicalCountController.addNewPhysicalCount));

/* =========================
 * Inventory Transfer
 * ========================= */
// Lists / details
router.post("/getInventoryTransferList", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, inventoryTransferContoller.getInventoryTransferOutList));
router.get("/getInventoryTransfer/:inventoryTransferId", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, inventoryTransferContoller.getInventoryTransferById));

// Create / helpers
router.post("/saveInventoryTransfer", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.writeLimiter, inventoryTransferContoller.addNewInventoryTransfer));
router.get("/getTransferNumber", ApiLimiter.rateLimitedExpress(ApiLimiter.ApiLimiterRepo.readLimiter, inventoryTransferContoller.getTransferNumber));

export default router;
