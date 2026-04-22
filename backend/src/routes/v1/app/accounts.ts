import express from 'express';
import { TablesController } from "@src/controller/app/Settings/tables.controller";
import { AccountController } from "@src/controller/app/Accounts/account.controller";
import { InvoiceController } from "@src/controller/app/Accounts/Invoice.controller";
import { InvoicePaymentController } from "@src/controller/app/Accounts/invoicePaymnet.controller";
import { CustomerController } from "@src/controller/app/Accounts/customer.controller";
import { SupplierController } from "@src/controller/app/Accounts/suppliers.controller";
import { EstimateController } from "@src/controller/app/Accounts/estimate.controller";
import { JournalController } from "@src/controller/app/Accounts/journal.controller";
import { BudgetController } from "@src/controller/app/Accounts/Budget.Controller";
import { PhysicalCountController } from "@src/controller/app/Accounts/physicalCount.controller";
import { inventoryTransferContoller } from "@src/controller/app/Accounts/inventoryTransfer.controller";
import { CreditNoteController } from "@src/controller/app/Accounts/creditNote.controller";
import { DiscountController } from "@src/controller/app/Accounts/discount.controller";
import { SurchargeController } from "@src/controller/app/Accounts/surcharge.controller";
import { PurchaseOrderController } from "@src/controller/app/Accounts/purchaseOrder.controller";
import { BillingController } from "@src/controller/app/Accounts/billing.controller";
import { PaymnetMethodController } from "@src/controller/app/Accounts/paymentMethod.controller";
import reports from './reports/reports'
import { BillingPaymentController } from "@src/controller/app/Accounts/billingPayment.controller";
import { ApiLimiterRepo } from "@src/apiLimiter";
import { TaxController } from "@src/controller/app/Accounts/tax.controller";
import { RefoundController } from "@src/controller/app/Accounts/refund.controller";
import { PermissionMiddleware } from "@src/middlewear/privilegeMiddleWear";
import { SupplierCreditController } from "@src/controller/app/Accounts/supplierCredit.controller";
import { ExpenseController } from "@src/controller/app/Accounts/expense.controller";
import { SupplierAppliedCreditController } from "@src/controller/app/Accounts/supplierAppliedCredit.controller";
import { SupplierRefundController } from "@src/controller/app/Accounts/supplierRefunds.controller";
import { WorkOrderController } from "@src/controller/app/Accounts/workOrder.controller";
import { SentryMiddlware } from '@src/middlewear/Sentry';
import { Budget } from '@src/models/account/Budget';
import { ReconciliationController } from '@src/controller/app/Accounts/Reconciliation.controller';
import { MiddleWareHelper } from '@src/middlewear/middilewareHelper';
import { RecurringBillController } from '@src/controller/app/Accounts/RecurringBill.controller';
import { RecurringInvoiceController } from '@src/controller/app/Accounts/RecurringInvoice.controller';
import { RecurringExpenseController } from '@src/controller/app/Accounts/RecurringExpense.controller';
import { RecurringJournalController } from '@src/controller/app/Accounts/RecurringJournal.controller';
import { LogController } from '@src/controller/app/Accounts/logs.controller';
import { InventoryMovementController } from '@src/controller/app/Accounts/InventoryMovement.controller';
import { VatPaymentController } from '@src/controller/app/Accounts/vatPayment.controller';
import { BillOfEntryController } from '@src/controller/app/Accounts/billOfEntry.controller';

import scheduledReports from "./reports/scheduledReports";
import { NotificationTemplateController } from '@src/controller/app/Accounts/NotificationTemplate.controller';
import { createAsyncRouter } from '@src/middlewear/asyncRouter';

const router = createAsyncRouter();


// acounts
router.post('/saveAccount', AccountController.addAccount);
router.get('/getAccountName/:accountId'/*,ApiLimiterRepo.apiLimiter*/, AccountController.getAccountName);
router.delete('/deleteAccount/:accountId', AccountController.deleteAccount);
router.get('/getTransactionsDate/:branchId'/*,ApiLimiterRepo.apiLimiter*/, AccountController.getTransactionsDate);
router.post('/addDefaultAccounts', AccountController.addDefaultAccounts);
router.post('/saveProductTobranch'/*,ApiLimiterRepo.apiLimiter*/, AccountController.addToBarnch);
router.post('/getAccounts', AccountController.getAccountList)
router.get('/getAccount/:accountId', AccountController.getAccount)
router.post('/getAccountJournal', AccountController.getAccountJournals)
router.get('/getSalesAccounts', AccountController.getSalesAccounts)
router.post('/getIncomeExpenseSummary', AccountController.getIncomeExpenseTransactions)
router.post('/getDashboardSummary', AccountController.getDashboardSummary)
router.post('/bankOverView', AccountController.bankOverView)
router.get('/exportAccounts/:type', AccountController.exportAccounts)
router.post("/importAccounts", AccountController.importAccountsFromCsv)
router.get("/getAccountsBulkImportProgress", AccountController.getBulkImportProgress)
router.post('/getParentAccountListByType', AccountController.getParentAccountListByType)




router.get('/getOpeningBalanceAccounts/:branchId', AccountController.getOpeningBalanceAccounts)
router.post('/getPayableOpeningBalanceRecords/', AccountController.getAccountPayableOpeningBalanceRecords)
router.post('/getReceivableOpeningBalanceRecords/', AccountController.getAccountReceivableOpeningBalanceRecords)
router.post('/getInventoryAssetsOpeningBalanceRecords/', AccountController.getInventoryAssetsOpeningBalanceRecords)
router.post('/saveAccountsOpeningBalance', AccountController.saveAccountsOpeningBalance)
// router.post('/updateOpeningBalanceDate',AccountController.updateOpeningBalanceDate)

//invoices 
router.post('/saveInvoice', InvoiceController.addInvoice);
router.get('/saveOpenInvoice/:invoiceId', InvoiceController.saveOpenInvoice);
router.post('/getInvoices', InvoiceController.getInvoices);
router.post('/getZatcaInvoices', InvoiceController.getZatcaInvoices);
router.post('/getJofotaraInvoices', InvoiceController.getJofotaraInvoices);
// router.get('/getXmlInvoices/:invoiceId',InvoiceController.getXmlInvoices);
router.get('/JOFatoore/:invoiceId', InvoiceController.JOFatooreInvoice);
router.get('/zatcaSamplifedInvoice/:invoiceId', InvoiceController.zatcaSamplifedInvoice);
router.post('/IssueZatcaCertefcate', InvoiceController.IssueZatcaCertefcate);
router.post('/getOnlineInvoices', InvoiceController.getOnlineInvoices)
router.post('/updateInvoiceStatus', InvoiceController.updateInvoiceStatus)
router.get('/getEcommercePlacedOrders/:branchId', InvoiceController.getEcommercePlacedOrders)
router.get('/getInvoice/:invoiceId', InvoiceController.getInvoiceById);
router.post('/witeOffInvoice', InvoiceController.writeOffInvoice);
router.get('/customerInvoices/:customerId/:branchId?', InvoiceController.getCustomerInvoices)
router.get('/getInvoiceNumber', InvoiceController.getInvoiceNumber);
router.post('/getBranchProducts/', InvoiceController.getBranchProductsList)
router.post('/getBranchProductByBarcode/', InvoiceController.getBranchProductByBarcode)
router.get('/getInvoiceJournal/:invoiceId', InvoiceController.getInvoiceJournal);
router.delete('/deleteInvoice/:invoiceId', InvoiceController.deleteInvoice);
router.post('/sendInvoiceEmail', InvoiceController.sendInvoiceEmail);
router.get('/viewInvoicePdf/:invoiceId', InvoiceController.viewInvoicePdf);
router.get('/InvoicePdf/:invoiceId', InvoiceController.InvoicePdf);
router.post('/sendByWhatsapp', InvoiceController.sendInvoiceWhatsapp);
router.post('/getReceivableAccounts', InvoiceController.getReceivableAccounts);
router.post('/sendInvoiceForSignature', InvoiceController.sendInvoiceForSignature);
router.post('/createInvoiceLink', InvoiceController.createInvoiceLink);

router.get('/getInvoicePdf/:invoiceId', InvoiceController.getInvoicePdf);
router.get('/invoiceMovementDetails/:invoiceId', InvoiceController.getInvoiceProductMovementDetails);


//estimate
router.post('/saveEstimate', EstimateController.addEstimate);
router.get('/getEstimate/:estimateId', EstimateController.getEstimateById);
router.post('/convertToInvoice', EstimateController.convertToInvoice);
router.post('/getEstimates', EstimateController.getEstimates)
router.get('/getEstimateNumber', EstimateController.getEstimateNumber)
router.post('/sendEstimateEmail', EstimateController.sendEstimateEmail);
router.get('/viewEstimatePdf/:estimateId', EstimateController.viewEstimatePdf);
router.delete('/deleteEstimate/:id', EstimateController.deleteEstimate);

//invoicePayment
router.post('/saveInvoicePayment', InvoicePaymentController.addInvoicePayment)
router.delete('/deleteInvoicePayment/:invoicePaymentId', InvoicePaymentController.deleteInvoicePayment)
router.get('/getInvoicePayment/:invoicePaymentId', InvoicePaymentController.getInvoicePaymentById)
router.post('/getInvoicePaymentsList', InvoicePaymentController.getInvoicePaymentsList)
router.get('/getInvoiceBalance/:invoiceId', InvoicePaymentController.getInvoiceBalance)
router.get('/getInvoicePaymentJournals/:invoicePaymentId', InvoicePaymentController.getInvoicePaymentJournals)
router.post('/getPosInvoicePayment', InvoicePaymentController.getPosInvoicePayment)
router.post('/sendInvoicePaymentEmail', InvoicePaymentController.sendInvoicePaymentEmail);
router.get('/viewInvoicePaymentPdf/:invoicePaymentId', InvoicePaymentController.viewInvoicePaymentPdf);


//customers 
router.post("/saveCustomer", CustomerController.addCustomer)
router.post("/getCustomerList", CustomerController.getCutomerList)
router.get("/getCustomer/:customerId", CustomerController.getCustomerById)
router.post("/getCustomerInvoiceTransactions", CustomerController.getCustomerInvoiceTransactions)
router.post("/getCustomerEstimateTransactions", CustomerController.getCustomerEstimateTransactions)
router.post("/getCustomerCreditNoteTransactions", CustomerController.getCustomerCreditNoteTransactions)
router.post("/getCustomerPaymentTransactions", CustomerController.getCustomerPaymentTransactions)
router.post('/getCustomerOverView', CustomerController.getCustomerOverView)
router.get('/customerLastPayment/:customerId', CustomerController.customerLastPayment)
router.get('/customerAddresses/:customerId', CustomerController.getCustomerAddresses)
router.post("/importCustomers", CustomerController.importFromCsv)
router.get("/getCustomerBulkImportProgress", CustomerController.getBulkImportProgress)
router.get("/exportCustomers/:type", CustomerController.exportCustomers);
router.post("/customerStatement", CustomerController.customerStatement);
router.post("/getCustomerMiniList", CustomerController.getMiniCustomerList);
router.get("/getCustomerBranchReceivable/:branchId/:customerId", CustomerController.getCustomerReceivableByBranch);
router.post("/getMiniCustomersByIds/", CustomerController.getMiniCustomersByIds);
router.post("/saveCustomerNotes/", CustomerController.saveCustomerNotes);
router.post("/getParentCustomers", CustomerController.getParentCustomers);
router.get('/getSubCustomerOverView/:customerId', CustomerController.getSubCustomerOverView)
router.post("/importCustomersOpeningBalance/",CustomerController.importCustomersOpeningBalance);
router.get("/exportCustomerOpeningBalance/:branchId/:type",CustomerController.exportCustomerOpeningBalance);
router.post("/miniCustomerList/",CustomerController.miniCustomerList);

//suppliers 
router.post("/saveSupplier", SupplierController.addSupplier)
router.post("/getSupplierList", SupplierController.getSupplierList)
router.post("/getSupplierMiniList", SupplierController.getSupplierMiniList)
router.get("/getSupplier/:supplierId", SupplierController.getSupplierById)
router.get("/lastPaymentMadeToSupplier/:supplierId", SupplierController.lastPaymentMadeToSupplier)
router.get("/getSupplierBills/:supplierId/:branchId?", SupplierController.getSupplierBills)
router.get("/getBillForSupplierCredit/:supplierId/:branchId", SupplierController.getSupplierBillsbyBranch)
router.get("/getApplyCreditSupplierBills/:supplierId", SupplierController.getApplyCreditSupplierBills)
router.post("/getSupplierOverView", SupplierController.getSupplierOverView)
router.post("/getSupplierBillingsTransactions", SupplierController.getSupplierBillingsTransactions)
router.post("/getSupplierPaymentsTransactions", SupplierController.getSupplierPaymentsTransactions)
router.post("/getSupplierCreditsTransactions", SupplierController.getSupplierCreditsTransactions)
router.post("/getSupplierPurchaseTransactions", SupplierController.getSupplierPurchaseTransactions)
router.post('/supplierStatement', SupplierController.supplierStatement)
router.post('/getSupplierItems', SupplierController.getSupplierItems)
router.post("/importSupplier", SupplierController.importFromCsv)
router.get("/getSupplierBulkImportProgress", SupplierController.getBulkImportProgress)
router.get("/exprotSuppliers/:type", SupplierController.exprotSuppliers);
router.get("/exportSuppliersOpeningBalance/:branchId/:type",SupplierController.exportSuppliersOpeningBalance);
router.get("/getSupplierItemCost/:productId/:supplierId", SupplierController.getSupplierItemCost);
router.get("/getSupplierPayableByBranch/:branchId/:supplierId", SupplierController.getSupplierPayableByBranch);
router.post("/getMiniSuppliersByIds/", SupplierController.getMiniSuppliersByIds);
router.get("/getSupplierProductsByBranch/:branchId/:supplierId", SupplierController.getSupplierProductsByBranch);
router.post("/addSupplierItems/", SupplierController.addSupplierItem);
router.post("/deleteSupplierItem/", SupplierController.deleteSupplierItem);
router.post("/importSupplierOpeningBalance/",SupplierController.importSupplierOpeningBalance);

//ManualJournal 
router.post("/saveManualJournal", JournalController.addManualJournal)
router.get("/getManualJournal/:journalId", JournalController.getManualJournalById)
router.post("/getJournals", JournalController.getJournals)
router.post("/saveJournalComments", JournalController.saveJournalComments)
router.delete("/deleteJournal/:journalId", JournalController.deleteJournal)
router.put("/saveOpenJournal/:journalId", JournalController.saveOpenJournal)

//Account Journals id => is [invoiceId or creditNoteId ... ]
router.get("/getJournal/:id", JournalController.getJournal) //System Journal from "View"


//CreditNote
router.post('/saveCreditNote', CreditNoteController.addCreditNote)

router.get('/getCreditNote/:creditNoteId', CreditNoteController.getCreditNoteById)
router.post('/getCreditNotes', CreditNoteController.getCreditNotes)
router.get('/getInvoicesForCreditNote/:branchId/:customerId', CreditNoteController.getInvoicesForCreditNote)
router.get('/getCreditNoteNumber', CreditNoteController.getCreditNoteNumber)
router.post('/getCreditNoteInvoice', CreditNoteController.getCreditNoteInvoice)
router.post('/sendCreditNoteEmail', CreditNoteController.sendCreditNoteEmail);
router.get('/viewCreditNotePdf/:creditNoteId', CreditNoteController.viewCrediteNotePdf);

//applied Credit 
router.post('/applyCredit', CreditNoteController.saveAppliedCredit)
router.get('/getAppliedCreditList', CreditNoteController.getApplyCreditList)
router.get('/getCustomerCredit/:customerId', CustomerController.getCustomerCredit)
router.delete('/deleteAppliedCredit/:appliedCreditId', CreditNoteController.deleteAppliedCredit)

router.get('/getCreditNoteJournal/:creditNoteId', CreditNoteController.getCreditNoteJournal)
router.delete('/deleteCreditNote/:creditNoteId', CreditNoteController.deleteCreditNote)
router.get('/getCustomerCreditsList/:customerId', CreditNoteController.getCustomerCreditsList)
router.get('/getCustomerApplyCreditInvoices/:customerId', CreditNoteController.getCustomerApplyCreditInvoices)
//discounts 

router.post('/saveDiscount', DiscountController.saveDiscount)
router.post('/getDiscountList', DiscountController.getDiscountList)
router.get('/getDiscount/:discountId', DiscountController.getDiscount)

//Surcharge 

router.post('/saveSurcharge', SurchargeController.saveSurcharge)
router.post('/getSurchargeList', SurchargeController.getSurchargeList)
router.get('/getSurcharge/:surchargeId', SurchargeController.getSurcharge)
router.post('/getTransactionsSurchargeList/', SurchargeController.getTransactionsSurchargeList)

//PurchaseOrder 

router.post("/savePurchaseOrder", PurchaseOrderController.savePurchaseOrder)
router.get("/getPurchaseOrderList/:branchId", PurchaseOrderController.getPurchaseOrderList)
router.get("/getPurchaseOrderById/:purchaseOrderId", PurchaseOrderController.getPurchaseOrderById)
router.post("/getRecommendedPurchaseProducts", PurchaseOrderController.getRecommendedPurchaseProducts)
router.post("/getRecommendedPurchaseProdPerSup", PurchaseOrderController.getRecommendedPurchaseProdPerSup)

router.post("/convertToBill", PurchaseOrderController.convertToBill)
router.post("/getPurchaseList", PurchaseOrderController.getPurchaseOrderList)
router.post("/getPurchaseProducts/", PurchaseOrderController.getPurchaseProducts)
router.post("/getPurchaseProductByBarcode/", PurchaseOrderController.getPurchaseProductByBarcode)
router.get("/getPurchaseAccounts", PurchaseOrderController.getPurchaseAccounts)
router.get("/getPurchaseNumber", PurchaseOrderController.getPurchaseNumber)
router.delete("/deletePurchaseOrder/:prurchaseOrderId", PurchaseOrderController.deletePurchaseOrder)
router.post('/sendPurchaseOrderEmail', PurchaseOrderController.sendPurchaseOrderEmail);
router.get('/viewPurchaseOrderPdf/:purchaseOrderId', PurchaseOrderController.viewPurchaseOrderPdf);
router.post('/convertAutoPurchase/', PurchaseOrderController.convertAutoPurchase);


//billing
router.post("/saveBilling", BillingController.saveBilling)
router.delete("/deleteBilling/:billId", BillingController.deleteBilling)
router.get("/getBill/:billId", BillingController.getBillingById)
router.post("/getBillingList", BillingController.getBillingsList)
router.get("/getBillingNumber", BillingController.getBillingNumber)
router.get("/getBillingJournal/:billingId", BillingController.getBillingJournals)
router.get('/saveOpenBill/:billingId', BillingController.saveOpenBill);
router.get("/getPaymentsByBill/:billId", BillingController.getBillForPayment)
router.post('/sendBillEmail', BillingController.sendBillEmail);
router.get('/viewBillPdf/:billId', BillingController.viewBillPdf);
router.post('/getPayableAccounts', BillingController.getPayableAccounts);
router.post('/getProductPurchaseHistory', BillingController.getProductPurchaseHistory);
//BILL OF ENTRY 
router.post("/saveBillOfEntry", BillOfEntryController.saveBillOfEnrty)
router.post("/getBillOfEntryList"/*,ApiLimiterRepo.apiLimiter*/, BillOfEntryController.getBillOfEnrtyList)
router.get("/getBillOfEntry/:id"/*,ApiLimiterRepo.apiLimiter*/, BillOfEntryController.getBillingEntryById)
router.get("/getBillingOfEntryNumber"/*,ApiLimiterRepo.apiLimiter*/, BillOfEntryController.getBillingOfEntryNumber)
router.delete("/deleteBillOfEntry/:id", BillOfEntryController.deleteBillOfEntry)
router.post("/sendBillOfEntryEmail/", BillOfEntryController.sendBillOfEntryEmail)
router.get("/viewBillOfEntryPdf/:id", BillOfEntryController.viewPdf)

//billingPayments
router.post('/saveBillingPayment', BillingPaymentController.saveBillingPayment)
router.delete('/deleteBillPayment/:billPaymentId', BillingPaymentController.deleteBillPayment)
router.get('/getBillingPayment/:billingPaymentId', BillingPaymentController.getBillingPaymentById)
router.post('/getBillingPaymentList', BillingPaymentController.getBillingPaymentList)
router.get('/getBillingPaymentJournal/:billingPaymentId', BillingPaymentController.getBillingPaymentJournal)
router.post('/sendBillPaymentEmail', BillingPaymentController.sendBillPaymentEmail);
router.get('/viewBillPaymentPdf/:billPaymentId', BillingPaymentController.viewBillPaymentPdf);

//paymentMethods 
router.post('/savePaymentMethod', PaymnetMethodController.savePaymentMethod)
router.post('/getPaymentMethodList', PaymnetMethodController.getPaymentMethodList)
router.get('/getPaymentMethod/:paymentMethodId', PaymnetMethodController.getPaymentMethod)
router.get('/getOnlinePaymentSettings', PaymnetMethodController.getOnlinePaymentMethods)
router.post('/enablePaymentMethod', PaymnetMethodController.getOnlinePaymentMethods)
router.get('/getPaymentAccounts', PaymnetMethodController.getPaymentAccounts)
router.post('/getPaymentsFlow', PaymnetMethodController.getPaymentsFlow)
router.post('/rearrangePaymentMethod', PaymnetMethodController.rearrangePaymentMethod)
router.post('/getOnlinePaymentMethods', PaymnetMethodController.getOnlinePaymentMethods)
router.post('/enablePaymentMethods', PaymnetMethodController.enablePaymentMethods)
router.get('/getPaymentMethodBalance/:paymentMethodId/:branchId?', PaymnetMethodController.getPaymentMethodBalance)
router.post('/getMiniPaymentMethodList', PaymnetMethodController.getMiniPaymentMethodList)
//Taxes
router.post('/saveTax', TaxController.saveTax)
router.post('/getTaxesList', TaxController.getTaxesList)
router.get('/getTaxById/:taxId', TaxController.getTaxById)
router.post('/getChildTaxes', TaxController.getChildrenTexes)
router.post('/setDefaultTax', TaxController.setDefaultTax)
//vat paymnt 
router.post('/getNetVatTotal', VatPaymentController.getNetVatTotal)
router.post('/saveVatPayment', VatPaymentController.saveVatPayment)
router.get('/getVatPayment/:id', VatPaymentController.getVatPayment)
router.post('/getVatPaymentList', VatPaymentController.getVatPaymentList)
router.post('/saveVatPaymentLine', VatPaymentController.saveVatPaymentLine)
router.get('/getNewTransactionDate', VatPaymentController.getNewTransactionDate)
router.get('/getVatPayments/:vatPaymentId', VatPaymentController.getVatPayments)
router.get('/getVatPaymentJournal/:id', VatPaymentController.getJournals)
router.get('/getVatPaymentLineById/:id', VatPaymentController.getVatPaymentLineById)
router.delete('/deleteVatPayment/:id', VatPaymentController.deleteVatPaymnets)

//Refound 

router.post('/saveRefund', RefoundController.saveRefund)
router.get('/getRefundList', RefoundController.getRefoundedList)
router.get('/getRefund/:refundId', RefoundController.getRefundById)
router.get('/getCustomerCreditNotes/:customerId', RefoundController.getCustomerCreditNotes)




//Supplier Credit 
router.post('/saveSupplierCredit', SupplierCreditController.saveSupplierCredit)
router.get('/getSupplierCredit/:supplierCreditId', SupplierCreditController.getSupplierCredit)
router.post('/getSupplierCreditList', SupplierCreditController.getSupplierCreditList)
router.post('/getBillForSupplierCredit/', SupplierCreditController.getBillingForSupplierCredit)
router.get('/getSupplierCreditNumber', SupplierCreditController.getSupplierCreditNumber)
router.get('/getSupplierCreditJournal/:supplierCreditId', SupplierCreditController.getSupplierCreditJournal)
router.post('/sendSupplierCreditEmail', SupplierCreditController.sendSupplierCreditEmail);
router.get('/viewSupplierCreditPdf/:supplierCreditId', SupplierCreditController.viewSupplierCreditPdf);
router.delete('/deleteSupplierCredit/:supplierCreditId', SupplierCreditController.deleteSupplierCredit);
router.post('/getProductBillingLines', SupplierCreditController.getProductBillingLines);

//Expense 
router.post('/saveExpense', ExpenseController.saveExpense)
router.post('/getExpenseList', ExpenseController.getExpenseList)
router.get('/getExpense/:expenseId', ExpenseController.getExpenseById)
router.get('/getExpenseNumber', ExpenseController.getExpenseNumber)
router.get('/getExpenseAccounts', ExpenseController.getExpenseAccounts)
router.get('/getPaidThroughAccounts', ExpenseController.getPaidThroughAccounts)
router.delete('/deleteExpense/:expenseId', ExpenseController.deleteExpense)
router.post('/sendExpenseEmail', ExpenseController.sendExpenseEmail);
router.get('/viewExpensePdf/:expenseId', ExpenseController.viewExpensePdf);

//SupplierAppliedCredit
router.post('/applySupplierCredit', SupplierAppliedCreditController.applyCredit)
router.delete('/deleteSupplierAppliedCredit/:appliedCreditId', SupplierAppliedCreditController.deleteAppliedCredit)
router.get('/getAvailableCreditsList/:supplierId', SupplierAppliedCreditController.AvailableCreditsList)
router.get('/getAvailableCredit/:supplierId', SupplierAppliedCreditController.getSupplierCredit)

//SupplierRefunds
router.post('/saveSupplierRefund', SupplierRefundController.saveRefund)

//WorkOrder 
// router.post('/saveWorkOrder',WorkOrderController.saveWorkOrder)
// router.post('/getWorkOrderList',WorkOrderController.saveWorkOrder)
// router.get('/getWorkOrder/:workOrderId',WorkOrderController.saveWorkOrder)


// Budget

router.post('/saveBudget', BudgetController.saveBudget)
router.delete('/deleteBudget/:budgetId', BudgetController.deleteBudget)
router.get('/getBudget/:budgetId', BudgetController.getBudgetById)
router.get('/getBudget2/:budgetId', BudgetController.getBudgetById2)
router.get('/ActualvsPrediction/:budgetId', BudgetController.ActualvsPrediction)
router.post('/getBudgetList', BudgetController.getBudgetList)
router.get('/getAccountList', BudgetController.getAccountList)


//Reconcilation
router.post('/saveReconciliation/', ReconciliationController.saveReconciliation)
router.post('/getReconcilationList/', ReconciliationController.getReconcilationList)
router.get('/getReconcilation/:id', ReconciliationController.getById)
router.post('/getReconcilationRecordsById/', ReconciliationController.getReconcilationRecordsById)
router.post('/getReconcilationsRecords/', ReconciliationController.getRecords)
router.post('/getReconcilationDate/', ReconciliationController.getReconcilationDate)
router.delete('/deleteReconcilation/:id', ReconciliationController.deleteReconcilation)
router.put('/undoReconcilation/:id', ReconciliationController.undoReconcilation)
router.post('/getAccountOpeningBalance/', ReconciliationController.getAccountOpeningBalance)

//Recurring Transctions
router.post('/saveRecurringBill', RecurringBillController.saveRecurringBill);
router.delete('/deleteRecurringBill/:id', RecurringBillController.deleteRecurringBill);
router.get('/getRecurringBillById/:id', RecurringBillController.getRecurringBillById);
router.get('/getRecurringBillOverview/:id', RecurringBillController.getRecurringBillOverview);
router.post('/getRecurringBillList', RecurringBillController.getRecurringBillList);

router.post('/saveRecurringInvoice', RecurringInvoiceController.saveRecurringInvoice);
router.delete('/deleteRecurringInvoice/:id', RecurringInvoiceController.deleteRecurringInvoice);
router.get('/getRecurringInvoiceById/:id', RecurringInvoiceController.getRecurringInvoiceById);
router.get('/getRecurringInvoiceOverview/:id', RecurringInvoiceController.getRecurringInvoiceOverview);
router.post('/getRecurringInvoiceList', RecurringInvoiceController.getRecurringInvoiceList);


router.post('/saveRecurringExpense', RecurringExpenseController.saveRecurringExpense);
router.delete('/deleteRecurringExpense/:id', RecurringExpenseController.deleteRecurringExpense);
router.get('/getRecurringExpenseById/:id', RecurringExpenseController.getRecurringExpenseById);
router.get('/getRecurringExpenseOverview/:id', RecurringExpenseController.getRecurringExpenseOverview);
router.post('/getRecurringExpenseList', RecurringExpenseController.getRecurringExpenseList);

router.post('/saveRecurringJournal', RecurringJournalController.saveRecurringJournal);
router.delete('/deleteRecurringJournal/:id', RecurringJournalController.deleteRecurringJournal);
router.get('/getRecurringJournalById/:id', RecurringJournalController.getRecurringJournalById);
router.get('/getRecurringJournalOverview/:id', RecurringJournalController.getRecurringJournalOverview);
router.post('/getRecurringJournalList', RecurringJournalController.getRecurringJournalList);

router.post('/getLogs', LogController.getLogs);
router.post('/getLogReport', LogController.getLogReport);

router.get('/exprotInventoryAssetsOpeningBalance/:branchId/:type', AccountController.exprotInventoryAssetsOpeningBalance)
router.post("/saveInventoryAssetsOpeningBalance", AccountController.saveInventoryAssetsOpeningBalance)
router.get("/getManualAdjustmentMovementJournal/:movmentId", InventoryMovementController.getManualAdjustmentMovementJournal)


//ManualAdjusmentMovement
router.post('/saveManualAdjustmentMovement', InventoryMovementController.saveManualAdjustmentMovement)
router.delete('/deleteManualAdjustmentMovement/:movmentId', InventoryMovementController.deleteManualAdjustmentMovement)
router.get('/getManualAdjustmentMovementById/:movmentId', InventoryMovementController.getManualAdjustmentMovementById)
router.post('/getManualAdjustmentMovementList', InventoryMovementController.getManualAdjustmentMovementList)
router.post('/getManualAdjustmentProducts', InventoryMovementController.getManualAdjustmentProducts)
router.post ('/getManualAdjustmentProductsByBarcodes',InventoryMovementController.getManualAdjustmentProductsByBarcodes)

//NotificationTemplate
router.post('/saveNotificationTemplate', NotificationTemplateController.saveNotificationTemplate)
router.delete('/deleteNotificationTemplate/:id', NotificationTemplateController.deleteNotificationTemplate)
router.get('/getNotificationTemplateById/:id', NotificationTemplateController.getNotificationTemplateById)
router.get('/getNotificationTemplateList', NotificationTemplateController.getNotificationTemplateList)



router.post('/test12'/*,ApiLimiterRepo.apiLimiter*/, RecurringJournalController.test12);

router.use(MiddleWareHelper.setFilterDates())
router.use(MiddleWareHelper.setTimeOffset())
router.use('/reports', reports)
router.use('/scheduledReports', scheduledReports)

export default router;