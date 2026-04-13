import { PrivilegeSetting } from "../models/privilege-setting.model";

export function productSecurity() {
  return new PrivilegeSetting({
    name: "Products Security",
    securityType: "common",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit New Product",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Product",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Product",
        securityType: "cloud",
      }),
      "manageUnitCost": new PrivilegeSetting({
        name: "Manage Unit Cost",
        securityType: "cloud",
      }),
      "viewStockValue": new PrivilegeSetting({
        name: "View Stock Value",
        securityType: "cloud",
      }),
      "printBarcode": new PrivilegeSetting({
        name: "Print Product Barcode",
        securityType: "cloud",
      }),
      "importExport": new PrivilegeSetting({
        name: "Import/Export Products",
        securityType: "cloud",
      }),
      "bulkPrint": new PrivilegeSetting({
        name: "Bulk Print Barcodes",
        securityType: "cloud",
      }),
      "clone": new PrivilegeSetting({
        name: "Clone Product",
        securityType: "cloud",
      }),
      "requestInventory": new PrivilegeSetting({
        name: "Request Inventory",
        securityType: "common"
      }),
      "requestInventoryAdd": new PrivilegeSetting({
        name: "Add Request Inventory",
        securityType: "common"
      }),
      "kitBuilder": new PrivilegeSetting({
        name: "Kit Builder",
        securityType: "POS",
      }),
      "itemsAvailability": new PrivilegeSetting({
        name: "Items Availability",
        securityType: "POS",
      }),
      "seasonalPrice": new PrivilegeSetting({
        name: "Seasonal Price",
        securityType: "POS",
      }),
      "labelPrint": new PrivilegeSetting({
        name: "Label Print",
        securityType: "POS",
      }),
      "searchItems": new PrivilegeSetting({
        name: "Search Items",
        securityType: "POS",
      }),
      "translation": new PrivilegeSetting({
        name: "Translation",
        securityType: "cloud",
      }),
      "supplierSection": new PrivilegeSetting({
        name: "Supplier Section",
        securityType: "cloud",
      }),
    }
  });
}
