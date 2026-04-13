import { PrivilegeSetting } from "../models/privilege-setting.model";

export function reportsSecurity() {
  return new PrivilegeSetting({
    name: "Reports Security",
    securityType: "cloud",
    securityGroup: "reports",
    actions: {
      "view": new PrivilegeSetting({
        name: "View List",
        securityType: "cloud",
      }),
      "ProfitandLoss": new PrivilegeSetting({
        name: "Profit and Loss",
        securityType: "cloud",
      }),
      "BalanceSheet": new PrivilegeSetting({
        name: "Balance Sheet",
        securityType: "cloud",
      }),
      "TrialBalanceBasisAccrual": new PrivilegeSetting({
        name: "Trial Balance Basis: Accrual",
        securityType: "cloud",
      }),
      "JournalEntries": new PrivilegeSetting({
        name: "Journal Entries",
        securityType: "cloud",
      }),

       "AccountJournals": new PrivilegeSetting({
        name: "Account Journals",
        securityType: "cloud",
      }),
      "GeneralLedgerReport": new PrivilegeSetting({
        name: "General Ledger Report",
        securityType: "cloud",
      }),
      "DepartmentSalesAndPaymentsOverviewReport": new PrivilegeSetting({
        name: "Department Sales And Payments Overview Report",
        securityType: "cloud",
      }),
      "ReorderAlertReport": new PrivilegeSetting({
        name: "Reorder Alert Report",
        securityType: "cloud",
      }),
      "GeneralInventoryReport": new PrivilegeSetting({
        name: "General Inventory Report",
        securityType: "cloud",
      }),
      "ProductMovment": new PrivilegeSetting({
        name: "Product Movment",
        securityType: "cloud",
      }),
      "SalesSummary": new PrivilegeSetting({
        name: "Sales Summary",
        securityType: "cloud",
      }),
      "SalesByItemReport": new PrivilegeSetting({
        name: "Sales By Item Report",
        securityType: "cloud",
      }),
      "SalesByAggregatorReport": new PrivilegeSetting({
        name: "Sales By Aggregator Report",
        securityType: "cloud",
      }),
      "SalesByAggregatorSubReport": new PrivilegeSetting({
        name: "Sales By Aggregator Sub Report",
        securityType: "cloud",
      }),
      "AggregatorOrdersListReport": new PrivilegeSetting({
        name: "Aggregator Orders List Report",
        securityType: "cloud",
      }),
      "SalesByCategoryReport": new PrivilegeSetting({
        name: "Sales By Category Report",
        securityType: "cloud",
      }),
      "SalesByEmployeeReport": new PrivilegeSetting({
        name: "Sales By Employee Report",
        securityType: "cloud",
      }),
      "SalesDiscount": new PrivilegeSetting({
        name: "Sales Discount",
        securityType: "cloud",
      }),
      "SalesByDiscount": new PrivilegeSetting({
        name: "Sales By Discount",
        securityType: "cloud",
      }),
      "MonthlyBldBreakdownReport": new PrivilegeSetting({
        name: "Monthly BLG Breakdown Report",
        securityType: "cloud",
      }),
      "ReorderReport": new PrivilegeSetting({
        name: "Reorder Report",
        securityType: "cloud",
      }),
      "SalesVsInventoryUsage": new PrivilegeSetting({
        name: "Sales Vs Inventory Usage",
        securityType: "cloud",
      }),
      "ExpiredProductsReport": new PrivilegeSetting({
        name: "Sales Vs Inventory Usage",
        securityType: "cloud",
      }),
      "ProductSalesVsInventoryUsage": new PrivilegeSetting({
        name: "Product Sales Vs Inventory Usage",
        securityType: "cloud",
      }),
      "ProductInventoryUsage": new PrivilegeSetting({
        name: "Product Inventory Usage",
        securityType: "cloud",
      }),
      "SalesByCategory": new PrivilegeSetting({
        name: "Sales By Category",
        securityType: "cloud",
      }),
      "SalesByItem": new PrivilegeSetting({
        name: "Sales By Item",
        securityType: "cloud",
      }),
      "SalesByDepartment": new PrivilegeSetting({
        name: "Sales By Department",
        securityType: "cloud",
      }),
      "SalesByService": new PrivilegeSetting({
        name: "Sales By Service",
        securityType: "cloud",
      }),
      "SalesByServiceDetails": new PrivilegeSetting({
        name: "Sales By Service Details",
        securityType: "cloud",
      }),
      "SalesByEmployee": new PrivilegeSetting({
        name: "Sales By Employee",
        securityType: "cloud",
      }),
      "SalesByEmployeeVsProducts": new PrivilegeSetting({
        name: "Sales By Employee Vs Products",
        securityType: "cloud",
      }),
      "SalesReportByPeriod": new PrivilegeSetting({
        name: "Sales Report By Period",
        securityType: "cloud",
      }),
      "SalesByTerminal": new PrivilegeSetting({
        name: "Sales By Terminal",
        securityType: "cloud",
      }),
      "SalesByInvoice": new PrivilegeSetting({
        name: "Sales By Invoice",
        securityType: "cloud",
      }),
      "SalesBreakdownDailyClosing": new PrivilegeSetting({
        name: "Sales Breakdown / Daily Closing",
        securityType: "cloud",
      }),
      "SalesByBrands": new PrivilegeSetting({
        name: "Sales By Brands",
        securityType: "cloud",
      }),
      "SalesByTables": new PrivilegeSetting({
        name: "Sales By Tables",
        securityType: "cloud",
      }),
      "SalesByTableGroups": new PrivilegeSetting({
        name: "Sales By Table Groups",
        securityType: "cloud",
      }),
      "TableUsageReport": new PrivilegeSetting({
        name: "Table Usage Report",
        securityType: "cloud",
      }),
      "TableUsageSummaryReport": new PrivilegeSetting({
        name: "Table Usage Summary Report",
        securityType: "cloud",
      }),
      "SalesByDeliveryArea": new PrivilegeSetting({
        name: "Sales By Delivery Area",
        securityType: "cloud",
      }),
      "SalesByProductsVsOptions": new PrivilegeSetting({
        name: "Sales By Products Vs Options",
        securityType: "cloud",
      }),
      "salesByServiceVsProducts": new PrivilegeSetting({
        name: "Sales By Service Vs Products",
        securityType: "cloud",
      }),
      "CashierReport": new PrivilegeSetting({
        name: "Cashier Report",
        securityType: "cloud",
      }),
      "CashierSummaryReport": new PrivilegeSetting({
        name: "Cashier Summary Report",
        securityType: "cloud",
      }),
      "DriverDetailsReport": new PrivilegeSetting({
        name: "Driver Details Report",
        securityType: "cloud",
      }),
      "AttendenceReport": new PrivilegeSetting({
        name: "Attendence Report",
        securityType: "cloud",
      }),
      "DriverReport": new PrivilegeSetting({
        name: "Driver Report",
        securityType: "cloud",
      }),
      "SalesByMenu": new PrivilegeSetting({
        name: "Sales By Menu",
        securityType: "cloud",
      }),
      "SalesByMenuSections": new PrivilegeSetting({
        name: "Sales By Menu Sections",
        securityType: "cloud",
      }),
      "SalesByMenuProductVsService": new PrivilegeSetting({
        name: "Sales By Menu Product Vs Service",
        securityType: "cloud",
      }),
      "SalesByMenuProductsVsOptions": new PrivilegeSetting({
        name: "Sales By Menu Products Vs Options",
        securityType: "cloud",
      }),
      "SalesByProductsCategory": new PrivilegeSetting({
        name: "Sales By Products Category",
        securityType: "cloud",
      }),
      "CustomerOrderHistory": new PrivilegeSetting({
        name: "Customer Order History",
        securityType: "cloud",
      }),
      "PaymentMethodReport": new PrivilegeSetting({
        name: "Payment Method Report",
        securityType: "cloud",
      }),
      "PaymentMethodSubReport": new PrivilegeSetting({
        name: "Payment Method Sub Report",
        securityType: "cloud",
      }),
      "ProductPreparedTimeSummary": new PrivilegeSetting({
        name: "Product Prepared Time Summary",
        securityType: "cloud",
      }),
      "UnsoldProductsReport": new PrivilegeSetting({
        name: "Unsold Products Report",
        securityType: "cloud",
      }),
      "BillPaymentAndExpenceReport": new PrivilegeSetting({
        name: "Bill Payment And Expence Report",
        securityType: "cloud",
      }),
      "CreditNotesReport": new PrivilegeSetting({
        name: "Credit Notes Report",
        securityType: "cloud",
      }),
      "PaymentReceivedReport": new PrivilegeSetting({
        name: "Payment Received Report",
        securityType: "cloud",
      }),
      "RefundsReport": new PrivilegeSetting({
        name: "Refunds Report",
        securityType: "cloud",
      }),
      "SupplierCreditsReport": new PrivilegeSetting({
        name: "Supplier Credits Report",
        securityType: "cloud",
      }),
      "SupplierRefundsReport": new PrivilegeSetting({
        name: "Supplier Refunds Report",
        securityType: "cloud",
      }),
      "PreparedTimeSummary": new PrivilegeSetting({
        name: "Prepared Time Summary",
        securityType: "cloud",
      }),
      "ShortOverReport": new PrivilegeSetting({
        name: "Short Over Report",
        securityType: "cloud",
      }),
      "CustomerAgingReport": new PrivilegeSetting({
        name: "Customer Aging Report",
        securityType: "cloud",
      }),
      "CustomerAgingSummaryReport": new PrivilegeSetting({
        name: "Customer Aging Summary Report",
        securityType: "cloud",
      }),
      "SupplierAgingReport": new PrivilegeSetting({
        name: "Supplier Aging Report",
        securityType: "cloud",
      }),
      "SupplierAgingSummaryReport": new PrivilegeSetting({
        name: "Supplier Aging Summary Report",
        securityType: "cloud",
      }),
      "SupplierBalanceReport": new PrivilegeSetting({
        name: "Supplier Balance Report",
        securityType: "cloud",
      }),
      "SupplierChangePriceReport": new PrivilegeSetting({
        name: "Supplier Balance Report",
        securityType: "cloud",
      }),
      "CustomReport": new PrivilegeSetting({
        name: "Custom Report",
        securityType: "cloud",
      }),
      "VatReport": new PrivilegeSetting({
        name: "Vat Report",
        securityType: "cloud",
      }),
      "MonthlyBLDBreakdown": new PrivilegeSetting({
        name: "Monthly BLD Breakdown",
        securityType: "cloud",
      }),
      "DiscountReport": new PrivilegeSetting({
        name: "Discount Report",
        securityType: "cloud",
      }),
      "DeliveryChargeReport": new PrivilegeSetting({
        name: "Delivery Charge Report",
        securityType: "cloud",
      }),
      "SurchargeReports": new PrivilegeSetting({
        name: "Surcharge Reports",
        securityType: "cloud",
      }),
      "DailyPaymentReport": new PrivilegeSetting({
        name: "Daily Payment Report",
        securityType: "cloud",
      }),
      "PurchaseBySupplier": new PrivilegeSetting({
        name: "Purchase By Supplier",
        securityType: "cloud",
      }),
      "PurchaseBySupplierSub": new PrivilegeSetting({
        name: "Purchase By Supplier Sub Report",
        securityType: "cloud",
      }),
      "PurchaseByItem": new PrivilegeSetting({
        name: "Purchase By Item",
        securityType: "cloud",
      }),
      "PurchaseByItemSub": new PrivilegeSetting({
        name: "Purchase By Item Sub Report",
        securityType: "cloud",
      }),
      "PurchaseByCategory": new PrivilegeSetting({
        name: "Purchase By Category",
        securityType: "cloud",
      }),
      "PurchaseDetails": new PrivilegeSetting({
        name: "Purchase Details",
        securityType: "cloud",
      }),
      "ExpensesSummaryByCategory": new PrivilegeSetting({
        name: "Expenses Summary By Category",
        securityType: "cloud",
      }),
      "ExpenseByCategory": new PrivilegeSetting({
        name: "Expense By Category",
        securityType: "cloud",
      }),
      "ExpensesDetails": new PrivilegeSetting({
        name: "Expenses Details",
        securityType: "cloud",
      }),
      "DailySales": new PrivilegeSetting({
        name: "Daily Sales",
        securityType: "cloud",
      }),
      "HourlySales": new PrivilegeSetting({
        name: "Hourly Sales",
        securityType: "cloud",
      }),
      "MonthlySales": new PrivilegeSetting({
        name: "Monthly Sales",
        securityType: "cloud",
      }),
      "QuarterlySales": new PrivilegeSetting({
        name: "Quarterly Sales",
        securityType: "cloud",
      }),
      "WeekdaySales": new PrivilegeSetting({
        name: "Weekday Sales",
        securityType: "cloud",
      }),
      "WeeklySales": new PrivilegeSetting({
        name: "Weekly Sales",
        securityType: "cloud",
      }),
      "YearlySales": new PrivilegeSetting({
        name: "Yearly Sales",
        securityType: "cloud",
      }),
      "VatAuditReport": new PrivilegeSetting({
        name: "Vat Audit Report",
        securityType: "cloud",
      }),
      "ProductWiseVatReport": new PrivilegeSetting({
        name: "Product Wise Vat Report",
        securityType: "cloud",
      }),
      "ProductWiseVatSubReport": new PrivilegeSetting({
        name: "Product Wise Vat Sub Report",
        securityType: "cloud",
      }),
      "DetailedWastageReport": new PrivilegeSetting({
        name: "Detailed Wastage Report",
        securityType: "cloud",
      }),
      "WastageSummaryReport": new PrivilegeSetting({
        name: "Wastage Summary Report",
        securityType: "cloud",
      }),
      "InventoryTransferReport": new PrivilegeSetting({
        name: "Inventory Transfer Report",
        securityType: "cloud",
      }),
      "CohortRetentionAnalysis": new PrivilegeSetting({
        name: "Cohort Retention Analysis",
        securityType: "cloud",
      }),
      "CustomerBalanceSummary": new PrivilegeSetting({
        name: "Customer Balance Summary",
        securityType: "cloud",
      }),
      "GuestReport": new PrivilegeSetting({
        name: "Guest Report",
        securityType: "cloud",
      }),
      "SalesByCustomersSummary": new PrivilegeSetting({
        name: "Sales By Customers Summary",
        securityType: "cloud",
      }),
      "TheChurnByCustomer": new PrivilegeSetting({
        name: "The Churn By Customer",
        securityType: "cloud",
      }),
      "ClientWiseItemSalesReport": new PrivilegeSetting({
        name: "Client Wise Item Sales Report",
        securityType: "cloud",
      }),
      "ClientWiseDiscountReport": new PrivilegeSetting({
        name: "Client Wise Discount Report",
        securityType: "cloud",
      }),
      "SalesByServiceVsProducts": new PrivilegeSetting({
        name: "Sales By Service Vs Products",
        securityType: "cloud",
      }),
      "VoidRansactions": new PrivilegeSetting({
        name: "Void Ransactions Report",
        securityType: "cloud",
      }),
      "CustomerReport": new PrivilegeSetting({
        name: "Customer Report",
        securityType: "cloud",
      })

     }
  });
}
