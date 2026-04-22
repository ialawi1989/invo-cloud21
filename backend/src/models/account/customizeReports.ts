const relations: any = {
    InvoiceView: {
        customerId: { table: "CustomerView", linkField: "id", returnField: "name" },
        branchId: { table: "Branches", linkField: "id", returnField: "name" },
        employeeId: { table: "Employees", linkField: "id", returnField: "name" },
        tableId: { table: "Tables", linkField: "id", returnField: "name" },
        serviceId: { table: "Services", linkField: "id", returnField: "name" },
        terminalId: { table: "Terminals", linkField: "id", returnField: "name" },
        discountId: { table: "Discounts", linkField: "id", returnField: "name" },
        estimateId: { table: "EstimatesView", linkField: "id", returnField: "estimateNumber" }
    },
    InvoiceLinesView: {
        branchId: { table: "InvoiceView", linkField: "branchId" },
        taxId: { table: "Taxes", linkField: "id", returnField: "name" },
        accountId: { table: "Accounts", linkField: "id", returnField: "name" },
        employeeId: { table: "Employees", linkField: "id", returnField: "name" },
        productId: { table: "Products", linkField: "id", returnField: "name" }
    },
    InvoiceLineOptionsView: {
        branchId: { table: "InvoiceLinesView", linkField: "branchId", returnField: "branchName" },
        optionId: { table: "Options", linkField: "id", returnField: "name" },
        invoiceLineId: { table: "InvoiceLinesView", linkField: "id", returnField: "id" },
    },

    EstimatesView: {
        branchId: { table: "Branches", linkField: "id", returnField: "name" },
        serviceId: { table: "Services", linkField: "id", returnField: "name" },
        tableId: { table: "Tables", linkField: "id", returnField: "name" },
        employeeId: { table: "Employees", linkField: "id", returnField: "name" },
        discountId: { table: "Discounts", linkField: "id", returnField: "name" },
        customerId: { table: "CustomerView", linkField: "id", returnField: "name" },

    },
    EstimateLinesView: {
        branchId: { table: "EstimatesView", linkField: "branchId" },
        taxId: { table: "Taxes", linkField: "id", returnField: "name" },
        accountId: { table: "Accounts", linkField: "id", returnField: "name" },
        employeeId: { table: "Employees", linkField: "id", returnField: "name" },
        productId: { table: "Products", linkField: "id", returnField: "name" },
        estimateId: { table: "Estimates", linkField: "id", returnField: "estimateNumber" }
    },
    EstimateLineOptionsView: {
        branchId: { table: "EstimatesView", linkField: "branchId" },
        optionId: { table: "Options", linkField: "id", returnField: "name" },
        estimateLineId: { table: "EstimatesView", linkField: "id", returnField: "id" }
    },

    InvoicePaymentsView: {
        branchId: { table: "Branches", linkField: "id", returnField: "name" },
        paymentMethodId: { table: "PaymentMethods", linkField: "id", returnField: "name" },
        cashierId: { table: "CashiersView", linkField: "id", returnField: "cashierNumber" },
        paymentMethodAccountId: { table: "Accounts", linkField: "id", returnField: "name" },
        employeeId: { table: "Employees", linkField: "id", returnField: "name" },
        customerId: { table: "CustomerView", linkField: "id", returnField: "name" }
    },
    InvoicePaymentLinesView: {
        branchId: { table: "InvoicePaymentLinesView", linkField: "id", returnField: "name" },
        invoiceId: { table: "InvoiceView", linkField: "id", returnField: "invoiceNumber" },
        invoicePaymentId: { table: "InvoicePaymentsView", linkField: "id", returnField: "id" }
    },

    CreditNotesView: {
        branchId: { table: "Branches", linkField: "id", returnField: "name" },
        invoiceId: { table: "InvoiceView", linkField: "id", returnField: "invoiceNumber" },
        employeeId: { table: "Employees", linkField: "id", returnField: "name" }
    },
    CreditNoteLinesView: {
        branchId: { table: "Branches", linkField: "id", returnField: "name" },
        creditNoteId: { table: "CreditNotesView", linkField: "id", returnField: "creditNoteNumber" },
        employeeId: { table: "Employees", linkField: "id", returnField: "name" },
        productId: { table: "Products", linkField: "id", returnField: "name" },
        taxId: { table: "Taxes", linkField: "id", returnField: "name" },
        accountId: { table: "Accounts", linkField: "id", returnField: "name" }
    },

    CreditNoteRefundsView: {
        branchId: { table: "Branches", linkField: "id", returnField: "name" },
        employeeId: { table: "Employees", linkField: "id", returnField: "name" },
        creditNoteId: { table: "CreditNotesView", linkField: "id", returnField: "creditNoteNumber" },
    },
    CreditNoteRefundLinesView: {
        branchId: { table: "CreditNoteRefundLinesView", linkField: "branchId" },
        creditNoteRefundId: { table: "CreditNoteRefundsView", linkField: "id", returnField: "creditNoteNumber" },
        paymentMethodId: { table: "PaymentMethods", linkField: "id", returnField: "name" },
        accountId: { table: "Accounts", linkField: "id", returnField: "name" },
    },
    AppliedCreditsView: {
        branchId: { table: "AppliedCreditsView", linkField: "branchId" },
        invoiceId: { table: "InvoiceView", linkField: "id", returnField: "invoiceNumber" },
        creditNoteId: { table: "CreditNotesView", linkField: "id", returnField: "creditNoteNumber" },
    },

    Discounts: { companyId: { table: "Companies", linkField: "id", returnField: "name" } },
    Branches: {
        companyId: { table: "Companies", linkField: "id", returnField: "name" },
    },
    Accounts: {
        companyId: { table: "Companies", linkField: "id", returnField: "name" },
    },
    Taxes: {
        companyId: { table: "Companies", linkField: "id", returnField: "name" },
    },

    Suppliers: {
        companyId: { table: "Companies", linkField: "id", returnField: "name" },
    },


    CashiersView: { branchId: { table: "Branches", linkField: "id", returnField: "name" } },
    CashierLinesView: {
        branchId: { table: "Branches", linkField: "id", returnField: "name" },
        cashierId: { table: "CashiersView", linkField: "id", returnField: "cashierNumber" },
        paymentMethodId: { table: "PaymentMethods", linkField: "id", returnField: "name" },
    },
    Products: { companyId: { table: "Companies", linkField: "id", returnField: "name" } },

    CustomerView: { companyId: { table: "Companies", linkField: "id", returnField: "name" } },
    Tables: { companyId: { table: "Companies", linkField: "id", returnField: "name" } },
    Options: { companyId: { table: "Companies", linkField: "id", returnField: "name" } },
    Services: { branchId: { table: "Branches", linkField: "id", returnField: "name" }, },
    Terminals: { branchId: { table: "Branches", linkField: "id", returnField: "name" }, },
    Estimates: { branchId: { table: "Branches", linkField: "id", returnField: "name" }, },
    Employees: { companyId: { table: "Companies", linkField: "id", returnField: "name" } },
    PaymentMethods: { companyId: { table: "Companies", linkField: "id", returnField: "name" } },
    SupplierItemsView: { companyId: { table: "Companies", linkField: "id", returnField: "name" } },
    Billings: { branchId: { table: "Branches", linkField: "id", returnField: "name" }, },
    Expenses: { branchId: { table: "Branches", linkField: "id", returnField: "name" }, },
    BillingLinesView: { branchId: { table: "Branches", linkField: "id", returnField: "name" }, },
    BillingPayments: { companyId: { table: "Companies", linkField: "id", returnField: "name" } },
    BillingPaymentLinesView: { companyId: { table: "Companies", linkField: "id", returnField: "name" } },
  
};


export default (relations)