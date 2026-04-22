import express from "express";
import { DepartmentController } from "@src/controller/app/products/department.controller";
import { ProductController } from "@src/controller/app/products/product.controller";
import { RecipeController } from "@src/controller/app/products/recipe.controller";
import { CategoryController } from "@src/controller/app/products/category.controller";
import { OptionsController } from "@src/controller/app/products/option.controller";
import { MenuController } from "@src/controller/app/products/menu.controller";
import { MatrixController } from "@src/controller/app/products/matrix.controller";
import { BatchController } from "@src/controller/app/products/batch.controller";
import { SerialController } from "@src/controller/app/products/serial.controller";
import { kitController } from "@src/controller/app/products/kit.controller";
import { KitchenSectionController } from "@src/controller/app/products/kitchenSection.controller";
import { PhysicalCountController } from "@src/controller/app/Accounts/physicalCount.controller";
import { inventoryTransferContoller } from "@src/controller/app/Accounts/inventoryTransfer.controller";
import { PriceManagmentController } from "@src/controller/app/products/priceManagment.Controller";
import { InventoryRequestController } from "@src/controller/app/Accounts/InventoryRequests.controller";
import { PurchaseOrderController } from "@src/controller/app/Accounts/purchaseOrder.controller";
import { grubtech } from "@src/Integrations/grubtech/grubtech";
import { ApiLimiterRepo } from "@src/apiLimiter";
import { ProductDashboardController } from "@src/controller/app/dashboard/productDashboard.controller";
import { DimensionController } from "@src/controller/app/products/productDimension.controller";


import { createAsyncRouter } from "@src/middlewear/asyncRouter";

export  const router =  createAsyncRouter();




//department 
router.post("/saveDepartment", DepartmentController.addDepartment);
router.get('/getDepartment/:departmentId',DepartmentController.getDepartment)
router.post('/getDepartmentList', DepartmentController.getDepartmentList);
router.get('/getDepartments', DepartmentController.getDepartments)
router.delete('/deleteDepartment/:departmentId', DepartmentController.deleteDepartment)

//Category

router.post('/saveCategory',CategoryController.addCategory);
router.get('/getCategory/:categoryId', CategoryController.getCategory);
router.post('/getCategoryList',CategoryController.getCategoryList)
router.get('/getDepartmentsCategories', CategoryController.getDepartmentCategory)
router.post('/rearrangeCategories', CategoryController.rearrangeCategories)
router.delete('/deleteCategory/:categoryId', CategoryController.deleteCategory)


//product 
router.post("/saveProduct",ApiLimiterRepo.getCustomLimiter(1,3), ProductController.saveProduct);
router.post("/importProducts",ProductController.importFromCsv)
router.get("/getBulkImportProgress",ProductController.getBulkImportProgress)
router.get("/resWrite",ProductController.writeRes)
router.get("/getProduct/:id", ProductController.getProduct);
router.get("/getProduct/:barcode/:branchId", ProductController.getProductByBarcode);
router.post("/getBarcodesProducts", ProductController.getBarcodesProducts);
router.post("/searchByBarcodes", ProductController.searchByBarcodes);

router.post("/testGetImages/", ProductController.testGetImages);
router.get("/getCategoryProducts/:id", ProductController.getCategoryProducts);
router.post("/getProductList",ProductController.getProductList);
router.post("/getProductListForBulk",ProductController.getProductListForBulk);
router.post("/saveCategoryProducts",ProductController.saveCategoryProducts);
router.delete("/deleteProduct/:productId",ProductController.deleteProduct);
router.post("/setProductMedia",ProductController.setProductMedia);
router.get("/getProductAvailability/:productId",ProductController.getProductAvailability)
router.post("/getNonCatigorizedProductList",ProductController.getUnCategoriesedProductList);
router.get("/exprotProducts",ProductController.exprotProducts);

router.post("/getInventoryProducts",ProductController.getInventoryProducts)
router.post("/getExpireBatches", ProductController.getExpireBatches);
router.post("/reorderProducts", ProductController.reorderProducts);
router.post("/assignProductTax", ProductController.assignProductTax);
router.post("/productChildsList",ProductController.productChildsList);

router.get("/exportProducts/:type",ProductController.exportProducts);
router.post("/getProductTags",ProductController.getProductTags);

router.post("/getMenuItemList",ProductController.getMenuItemList)
router.post("/saveProductRecipeItem/:productId",ProductController.saveProductRecipeItem)
router.delete("/deleteProductRecipeItem/:productId/:itemId",ProductController.deleteProductRecipeItem)



router.get("/exportProductsRecipe/:type",ProductController.exportProductsRecipe);
router.post("/importProductsRecipe/:importMode",ProductController.importProductsRecipe)


 //TODO/**Remove getInventoryChildProducts */ 
router.post("/getInventoryChildProducts",ProductController.getInventoryChildProducts)
router.post("/getChildProductList",ProductController.getChildProductList)
router.post("/getProductsListByType",ProductController.getProductsListByType)
router.post("/getProductsListForSupplier",ProductController.getProductsListForSupplier)
router.get("/getBranchProducts/:branchId",ProductController.getProductListByBranchId)
router.post("/getBranchsProducts",ProductController.getProductListByBranch)
router.post("/updateBulkPrices",ProductController.updateBulkPrices)
router.post("/updateTranslation",ProductController.updateTranslation)
router.post("/updateDepartmentTranslation",DepartmentController.updateTranslation)
router.post("/updateOptionGroupTranslation",OptionsController.updateOptionGroupTranslation)
router.post("/updateOptionTranslation",OptionsController.updateOptionTranslation)
router.post("/updateCategoriesTranslation",CategoryController.updateTranslation)
router.post("/updateMatrixTranslation",ProductController.updateMatrixTranslation)

//Product Dashboard
router.get("/getProductDetails/:productId", ProductDashboardController.getProductDetails);
router.get("/getProductStats/:productId",ProductDashboardController.getProductStats)
router.get("/getProductActivity/:productId",ProductDashboardController.getProductActivity)
router.post("/getProductSales/:productId",ProductDashboardController.getProductSales)
router.post("/getProductSalesByDay/:productId",ProductDashboardController.getProductSalesByDay)
router.post("/getProductSalesByService/:productId",ProductDashboardController.getProductSalesByService)
router.post("/getProductLast12MonthSales/:productId",ProductDashboardController.getProductLast12MonthSales)

//brands
router.post("/getBrandList",ProductController.getBrandList);
router.post("/addBrand",ProductController.addBrand);
router.post("/getNonBrandedProductList",ProductController.getNonBrandedProductList);
router.post("/saveNewBrand",ProductController.addBrand);
router.get("/getBrand/:brandID",ProductController.getBrand);
router.post("/updateBrandsTranslation",ProductController.updateBrandTranslation);
//InventoryLocations
router.post("/getInventoryLocationsList",ProductController.getInventoryLocationsList);
router.post("/addInventoryLocations",ProductController.addInventoryLocations);
router.post("/getNonInventoryLocationsProductList",ProductController.getNonInventoryLocationsProductList);
router.post("/saveInventoryLocations",ProductController.addInventoryLocations);
router.get("/getInventoryLocations/:InventoryLocationsID",ProductController.getInventoryLocations);
router.post("/updateInventoryLocationsTranslation",ProductController.updateInventoryLocationsTranslation);
router.get("/getLocationsByBranch/:branchId",ProductController.getLocationsByBranch)


router.get("/getProductSerials/:branchId/:productId",ProductController.getProductSerials)
router.get("/getProductBatches/:branchId/:productId",ProductController.getProductBatches)
router.post("/setProductColor",ProductController.setProductColor)
router.post("/validateBarcode",ProductController.validateBarcode)
router.post("/validateSKU",ProductController.validateSKU)
//Matrix
router.post("/saveMatrix",MatrixController.addMatrix)
// router.post("/updateMatrix",MatrixController.editMatrix)
router.post("/getMatrixList",MatrixController.getAllCompnayMatrix)
router.get("/getMatrix/:matrixId",MatrixController.getMatrixById)

//Recipe
router.post("/saveRecipe",RecipeController.saveRecipe);
router.get("/getRecipe/:recipeId",RecipeController.getRecipe);
router.post("/getRecipeList",RecipeController.getAllRecipe);
router.post("/getMenuItemRecipeList",RecipeController.getMenuItemRecipeList)

router.post("/importRecipe",RecipeController.importFromCsv)
router.post("/exportFromRecipeProductXl",RecipeController.exportFromXl)


//Dimension 
// router.post('/addDimenion',DimensionController.addDimension);
// router.post('/editDimension',DimensionController.editDimention); 
// router.get('/getDimenionsList',DimensionController.getDimensionList);
// router.get('/getDimension/:dimensionId',DimensionController.getDimentionbyId)


//options

router.post("/saveOption",OptionsController.addOption);
// router.post("/editOption",OptionsController.editOption);
router.post("/getOptionsList",OptionsController.getOptions);
router.get("/getOption/:optionId",OptionsController.getOptionById);

router.post("/saveOptionGroup",OptionsController.addOptionGroup);
router.post("/editOptionGroup",OptionsController.editOptionGroup);
router.post("/getOptionGroupList",OptionsController.getOptionGroupList);
router.get("/getOptionGroup/:optionGroupId",OptionsController.getOptionGroup);


router.get("/getOptionsProductAvailability/:branchProdId",OptionsController.getOptionsProductAvailability);
router.post("/updateOnlineProductOptionsAvailability",OptionsController.updateOnlineProductOptionsAvailability);
router.post("/updateProductOptionsAvailability",OptionsController.updateProductOptionsAvailability);

router.post("/importOptions",OptionsController.importFromCsv)
router.get("/getOptionBulkImportProgress",OptionsController.getBulkImportProgress)
router.get("/exportOptions/:type",OptionsController.exportOptions);
router.post("/setOptionAvailability/",OptionsController.setOptionAvailability);
router.put("/deleteOption/:optionId",OptionsController.deleteOption);
router.delete("/deleteOptionGroup/:optionGroupId",OptionsController.deleteOptionGroup);


//Menu 

router.post("/saveMenu",MenuController.addMenu)
// router.post("/editMenu",MenuController.editMenu)
router.post("/getMenuList",MenuController.getMenuList);
router.get("/getMenu/:menuId",MenuController.getBranchMenu);
router.get("/getCompanyMenu",MenuController.getCompanyMenu)
router.post("/menuProductList",MenuController.MenuProductList);
router.post("/rearrangeMenu",MenuController.rearrangeMenu);
router.post("/uploadGrupTechMenu",MenuController.uploadGruptechMenu);
router.post("/ItemAvailable",MenuController.GruptechItemAvailable);
router.post("/ItemUnAvailable",MenuController.GruptechItemUnAvailable);






//serial 
// router.post("/addNewSerial",SerialController.addSerial)
// router.post("/editSerial",SerialController.editSerial)
// router.get("/getAllSerials/:branchProductId",SerialController.getAllserials);
// router.get("/getSerial/:branchProductId/:id",SerialController.getserial);




//kit
router.post("/getKitMaxQty",kitController.getMaximumAllowedQty)
router.post("/buildKit",kitController.buildKit)
router.post("/breakKit",kitController.breakKit)

//kitchenSection
router.post("/saveKitchenSection",KitchenSectionController.saveKitchenSection)
router.post("/getKitchenSectionList",KitchenSectionController.getKitchenSectionList)
router.get("/getKitchenSection/:kitchenSectionId",KitchenSectionController.getKitchenSectionById)
router.get("/getKitchenSectionProducts",KitchenSectionController.getKitchenSectionProducts)



//PhysicalCount
router.post('/savePhysicalCount',PhysicalCountController.addNewPhysicalCount)
router.post('/getphysicalCountList',PhysicalCountController.getPhysicalCountList)
router.get('/getphysicalCount/:physicalCountId',PhysicalCountController.getPhysicalCountbyId)
router.post('/getPhysicalCountProducts',PhysicalCountController.getPhysicalCountProducts)
router.post('/getPhysicalCountProductsbyInventory',PhysicalCountController.getPhysicalCountProductsbyInventory)
router.post('/getPhysicalCountProductsbyCategory',PhysicalCountController.getPhysicalCountProductsbyCategory)
router.get('/getPhysicalCountJournal/:physicalCountId',PhysicalCountController.getPhysicalCountJournal)
router.delete('/deletePhysicalCount/:physicalCountId',PhysicalCountController.deletePhysicalCount)


//InventoryTransfer 
router.post('/saveInventoryTransfer',inventoryTransferContoller.addNewInventoryTransfer)
router.post('/getInventoryTransferList',inventoryTransferContoller.getInventoryTransferList)
router.get('/getInventoryTransfer/:inventoryTransferId',inventoryTransferContoller.getInventoryTransferById)
router.get('/getTransferNumber',inventoryTransferContoller.getTransferNumber)
router.get('/getTransferJournal/:transferId',inventoryTransferContoller.getTransferJournal)

router.post('/getBatchWastageProducts',inventoryTransferContoller.getBatchWastageProducts )

//priceManagment
router.post('/savePriceLabel',PriceManagmentController.savePriceLabel)
router.post('/ImportPriceLabel',PriceManagmentController.importPriceLabel);
router.get('/getPriceLabelBulkImportProgress/:priceLabelId',PriceManagmentController.getPriceLabelBulkImportProgress);  


router.post('/getPriceLabelList',PriceManagmentController.getPriceLabelList)
router.get('/getPriceLabel/:priceLabelId',PriceManagmentController.getPriceLabelById)

router.post('/savePriceManagement',PriceManagmentController.savePriceManagment)
router.post('/getPriceManagementList',PriceManagmentController.getPriceManagmentList)
router.post('/validatePriceManagementDate',PriceManagmentController.validatePriceManagmentDate)
router.get('/getPriceManagement/:priceManagmentId',PriceManagmentController.getPriceManagmentById)


//InventoryTransfer 
router.post('/saveInventoryRequest',InventoryRequestController.addInventoryRequest)
router.post('/getInventoryRequestList',InventoryRequestController.getList)
router.get('/getInventoryRequestById/:requestId',InventoryRequestController.getById)
router.delete('/deleteInventoryRequest/:requestId',InventoryRequestController.delete)
router.post('/convertToPurchaseOrder/',InventoryRequestController.convertToPurchaseOrder)

router.post("/getInventoryRequestProducts",PurchaseOrderController.getInventoryRequestProducts)


 
//branchproduct 
router.post('/getBranchProductsAvailability',ProductController.getBranchProductAvailability)
router.post('/updateAvailability',ProductController.updateAvailability)
router.post('/updateOnlineAvailability',ProductController.updateOnlineAvailability)


//productDashboard 
router.post('/getProductHistory',ProductDashboardController.productHistory)
router.post('/salesByService',ProductDashboardController.salesByService)
router.post('/salesByTime',ProductDashboardController.salesByTime)
router.post('/Last12MonthsSales',ProductDashboardController.Last12MonthsSales)
router.post('/wastageReport',ProductDashboardController.wastageReport)
router.post('/salesBySource',ProductDashboardController.salesBySource)


//Dimension
router.post('/saveDimension',DimensionController.saveDimension);
router.get('/getDimension/:dimensionId', DimensionController.getDimensionById);
router.post('/getDimensionList',DimensionController.getDimensionList)


//quick reciept management
router.get("/getRecipeItems/recipe/:id",RecipeController.getRecipeItems)
router.get("/getOptionItems/option/:id",OptionsController.getOptionRecipeItems)

router.post("/saveRecipeItem/:type/:id",ProductController.saveRecipeItem)
router.delete("/deleteRecipeItem/:type/:productId/:itemId",ProductController.deleteRecipeItem)



router.get("/getProductColumns",ProductController.getProductColumns);
router.post("/productListWithCustomeFields",ProductController.productListWithCustomeFields);



router.post("/getProductForMedia",ProductController.getProductForMedia);
router.post("/bulkProductMedia",ProductController.bulkProductMedia);
export default router;