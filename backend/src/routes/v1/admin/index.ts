import express from "express";
import { CompanyController } from "@src/controller/admin/company.controller"
import { AuthController } from '@src/controller/app/auth.controller';
import { BranchController } from "@src/controller/admin/branch.controller"
import { BranchValdation } from '@src/validationSchema/admin/branch.Schema'
import { BrandValdation } from "@src/validationSchema/admin/brand.Schema";

import { EmployeeController } from "@src/controller/admin/employee.controller";
import { EmployeeValidation } from "@src/validationSchema/admin/employee.Schema";
import { CompanyGroupController } from "@src/controller/admin/companyGroup.controller";
import { ServiceController } from "@src/controller/admin/service.controller";
import { TerminalController } from "@src/controller/app/Terminal/terminal.controller";
import { AccountController } from "@src/controller/admin/Account.Controller";
import { InvoicingController } from "@src/controller/adminApp/invoicing.Controller";
import { ReportsController } from "@src/controller/adminApp/reports.Controller";
import { SubscriptionsJob } from "@src/controller/app/jobs/subscriptions";
import rateLimit from "express-rate-limit";
import { idempotencyMiddleware } from "@src/middlewear/idempotency.middleware";
import { AdminController } from "@src/controller/admin/admin.controller";
import { createAsyncRouter } from "@src/middlewear/asyncRouter";
import { PgDashboardController } from "@src/controller/admin/pgDashboard.Controller";

export const router = createAsyncRouter();

  //

//// Compnay GROUPS
router.post('/authenticate', AuthController.adminLogin);
router.use(AuthController.authintcateAdmin)

router.put("/disconnectTerminal/:branchId",TerminalController.discconectTerminal)
router.post("/addMissingJournals",AccountController.addMissingJournals)
router.post("/inBalanceJournals",AccountController.inBalanceJournals)
router.post("/inBalanceSales",AccountController.inBalanceSales)
router.post("/inBalanceInventoryAssets",AccountController.inBalanceInventoryAssets)
router.post("/inBalanceInventoryAssets2",AccountController.inBalanceInventoryAssets2)
router.post('/getPosInvoicePayment',AccountController.getPosInvoicePayment)

router.get('/companiesList', CompanyController.getAdminCompaniesList);
router.post('/getCompanyById', CompanyController.getAdminCompanyById);
router.get('/GetAllCompanyGroups', CompanyGroupController.getAllCompanyGroups);
router.get('/getCompanyGroupSuperAdmin/:companyGroupId', CompanyGroupController.getCompanyGroupSuperAdmin);
router.get('/branchesList', BranchController.getAllBranchesList);
router.get('/branchesList/:companyId', BranchController.getBranchesListByCompanyId);
router.patch('/branches/:id', BranchController.setBranchSubscription);
router.get('/GetAllCompanyEmployee/:companyId', EmployeeController.GetAllCompanyEmployee);


router.get('/getCompanyGroup/:companyGroupId', CompanyGroupController.getCompanyGroupById)
router.get('/getAdminLog', CompanyGroupController.getAdminLog);
router.post('/getSocketLog', CompanyGroupController.getSocketLog);

/// company routes
router.get('/getServicesList/:companyId', ServiceController.getAdminServicesList);


router.get('/GetAllCompanies/:companyGroupId', CompanyController.getAllCompanies);
router.get('/getCompany/:companyGroupId/:companyId', CompanyController.getCompanyById)

//branch routes
router.get('/getbranch/:companyId/:branchId', BranchController.getBranch)


//admin routes

router.get('/adminsList', EmployeeController.GetAllAdmins)
router.get('/getAdminById/:adminId', EmployeeController.getAdminById)
router.post('/updateFeatures', CompanyController.updateFeatures)







//brand routes

// router.get('/getbrand/:brandId/:companyId',BrandController.GetBrandById)
// router.get('/getAllBrands/:companyId',BrandController.getAllBrand)
// router.post('/addBrand',BrandController.AddBrand)
// router.post('/editBrand',BrandController.EditBrand)




// employee routes

router.get('/getEmployee/:employeeId/:companyId', EmployeeController.GetEmployeeByID);
router.get('/getEmployeeList/:companyId', EmployeeController.GetAllCompanyEmployee);


router.post('/deleteTesting', CompanyGroupController.TestingDelete)
router.get('/getAllAdminInvoices', CompanyGroupController.getAllAdminInvoices)




// ── Feature Catalog ──
router.get('/features', InvoicingController.getFeatures)
router.post('/saveFeature', InvoicingController.saveFeature)

// ── Plans ──
router.get('/plans', InvoicingController.getPlans)
router.get('/plans/:id', InvoicingController.getPlanById)
router.post('/savePlan', InvoicingController.savePlan)

// ── Feature Pricing ──
router.get('/featurePricing', InvoicingController.getFeaturePricing)
router.post('/saveFeaturePricing', InvoicingController.saveFeaturePricing)

// ── Company Subscriptions ──
router.get('/companySubscription/:companyId', InvoicingController.getCompanySubscription)
router.get('/companySubscriptionHistory/:companyId', InvoicingController.getCompanySubscriptionHistory)
router.post('/createCompanySubscription', InvoicingController.createCompanySubscription)
router.post('/cancelCompanySubscription', InvoicingController.cancelCompanySubscription)

// ── Branch Subscriptions ──
router.get('/branchSubscription/:branchId', InvoicingController.getBranchSubscription)
router.get('/branchSubscriptionHistory/:branchId', InvoicingController.getBranchSubscriptionHistory)
router.get('/branchSubscriptionsByCompany/:companyId', InvoicingController.getBranchSubscriptionsByCompany)
router.post('/createBranchSubscription', InvoicingController.createBranchSubscription)
router.post('/cancelBranchSubscription', InvoicingController.cancelBranchSubscription)
router.post('/setSubscriptionAutoRenew', InvoicingController.setSubscriptionAutoRenew)
router.post('/importSubscriptions', InvoicingController.importSubscriptions)

// ── Mid-Cycle Changes ──
router.post('/addFeatureMidCycle', InvoicingController.addFeatureMidCycle)
router.post('/increaseQuantityMidCycle', InvoicingController.increaseQuantityMidCycle)
router.post('/removeFeatureMidCycle', InvoicingController.removeFeatureMidCycle)

// ── Entitlement Queries ──
router.get('/activeCompanyFeatures/:companyId', InvoicingController.getActiveCompanyFeatures)
router.get('/activeBranchFeatures/:branchId', InvoicingController.getActiveBranchFeatures)
router.get('/futureCompanyFeatures/:companyId', InvoicingController.getFutureCompanyFeatures)
router.get('/futureBranchFeatures/:branchId', InvoicingController.getFutureBranchFeatures)
router.get('/subscriptionFeatures/:subscriptionId/:subscriptionType', InvoicingController.getSubscriptionFeatures)
router.get('/allowedDevices/:branchId/:deviceType', InvoicingController.getAllowedDevices)

// ── Billing Invoices ──
router.post('/createBillingInvoice', InvoicingController.createBillingInvoice)
router.get('/billingInvoice/:id', InvoicingController.getBillingInvoiceById)
router.get('/billingInvoicesByCompany/:companyId', InvoicingController.getBillingInvoicesByCompany)
router.get('/billingInvoices', InvoicingController.getAllBillingInvoices)
router.patch('/voidBillingInvoice/:id', InvoicingController.voidBillingInvoice)

// ── Payments ──
router.post('/createPayment', InvoicingController.createPayment)
router.post('/allocatePayment', InvoicingController.allocatePayment)
router.get('/paymentsByCompany/:companyId', InvoicingController.getPaymentsByCompany)
router.get('/payment/:id', InvoicingController.getPaymentById)
router.get('/payments', InvoicingController.getAllPayments)

// ── Branch Devices ──
router.post('/registerDevice', InvoicingController.registerDevice)
router.get('/branchDevices/:branchId', InvoicingController.getBranchDevices)
router.patch('/deviceStatus/:id', InvoicingController.updateDeviceStatus)

// ── Subscription Changes / Audit ──
router.get('/subscriptionChanges/:subscriptionId/:subscriptionType', InvoicingController.getSubscriptionChanges)
router.post('/listSubscriptionChanges', InvoicingController.listSubscriptionChanges)

// ── Analytics ──
router.get('/revenue', InvoicingController.getRevenue)
router.get('/expiringSubscriptions', InvoicingController.getExpiringSubscriptions)
router.get('/overdueInvoices', InvoicingController.getOverdueInvoices)

// ── Reports: Dashboard ──
router.get('/reports/dashboard', ReportsController.getDashboardKpis)

// ── Reports: Retention & Churn ──
router.get('/reports/cohortRetention', ReportsController.getCohortRetention)
router.get('/reports/monthlyChurnRate', ReportsController.getMonthlyChurnRate)

// ── Reports: Revenue (MRR/ARR) ──
router.get('/reports/mrrTrend', ReportsController.getMrrTrend)
router.get('/reports/mrrWaterfall', ReportsController.getMrrWaterfall)
router.get('/reports/revenueByPlan', ReportsController.getRevenueByPlan)
router.get('/reports/netRevenueRetention', ReportsController.getNetRevenueRetention)

// ── Reports: Acquisition & Growth ──
router.get('/reports/newSignups', ReportsController.getNewSignups)
router.get('/reports/activationRate', ReportsController.getActivationRate)

// ── Reports: Customer Health ──
router.get('/reports/accountHealth', ReportsController.getAccountHealth)
router.get('/reports/accountsAtRisk', ReportsController.getAccountsAtRisk)
router.get('/reports/usageFrequency', ReportsController.getUsageFrequency)

// ── Reports: Cohort (Excel-style views, supports ?format=csv) ──
router.get('/reports/cohort/summaryKpis', ReportsController.getCohortSummaryKpis)
router.get('/reports/cohort/monthlyTrend', ReportsController.getCohortMonthlyTrend)
router.get('/reports/cohort/profileSummary', ReportsController.getCohortProfileSummary)
router.get('/reports/cohort/retentionMatrix', ReportsController.getCohortRetentionMatrix)
router.get('/reports/cohort/revenueRetention', ReportsController.getRevenueRetentionByCohort)

// ── Reports: Inactive / Low activity accounts (paginated + CSV) ──
router.get('/reports/inactiveAccounts', ReportsController.listInactiveAccounts)

// ── Reports: Uninvoiced subscriptions (paginated + CSV) ──
router.get('/reports/uninvoicedSubscriptions', ReportsController.listUninvoicedSubscriptions)

// ── Reports: Overdue invoices (paginated + CSV + aging buckets) ──
router.get('/reports/overdueInvoices', ReportsController.listOverdueInvoices)

// ── Reports: At-risk subscriptions (expiring + no auto-renew, paginated + CSV) ──
router.get('/reports/atRiskSubscriptions', ReportsController.listAtRiskSubscriptions)

router.post('/companyUnitCostAllocate',AccountController.companyUnitCostAllocate)
router.post('/retryJournal',AccountController.retryJournal)
router.post('/companyUnitCostAllocateByProduct',AccountController.companyUnitCostAllocateByProduct)


router.post('/invoiceChargeTax',AccountController.invoiceChargeTax)
router.post('/fixInvoiceChargeTotal',AccountController.fixInvoiceChargeTotal)
router.post('/recalculateInvoices',AccountController.recalculateInvoices)
router.post('/reallocateTheProducts',AccountController.reallocateTheProducts)
router.get('/getTerm/:id', AdminController.getTerm)
router.post('/getTermsList', AdminController.getList)
router.get('/getLatestTerms', AdminController.getLatest)
router.put('/activateTerms', AdminController.activateTerms)
router.get('/getVersionNumber', AdminController.getVersionNumber)
router.post('/saveTerms', AdminController.saveTerms)
router.get('/dbDashboard', PgDashboardController.dashboard)
router.use(rateLimit({
    windowMs: 2 * 1000, // 2 seconds
    max: 1, // Limit each IP to 1 request per `window` (here, per 2 seconds)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
}));

//add idempotency key to prevent double submission
// router.use(idempotencyMiddleware);
router.post('/addBranch', BranchController.addBranch)
router.post('/SaveCompanyGroup', CompanyGroupController.AddNewCompanyGroup);
router.post('/editCompanyGroup', CompanyGroupController.editCompanyGroup);
router.post('/SaveCompany', CompanyController.AddNewCompany);
router.post('/editCompany', CompanyController.editCompany);
router.post('/addService', ServiceController.addServiceToCompany);
router.post('/saveAdmin', EmployeeController.saveAdmin)
router.post('/addEmployee', EmployeeController.AddNewEmployee)
router.post('/updateEmployee', EmployeeController.EditEmployeeInfo)


//terms 







export default router;