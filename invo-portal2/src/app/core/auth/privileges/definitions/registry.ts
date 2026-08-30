import { PrivilegeSetting } from '../models/privilege-setting.model';

import { acceptRejectOrderCloudSecurity } from './acceptRejectOrderCloudSecurity';
import { accountSecurity } from './accountSecurity';
import { bankingOverview } from './bankingOverview';
import { billingPaymentsSecurity } from './billingPaymentsSecurity';
import { billingSecurity } from './billingSecurity';
import { billOfEntrySecurity } from './billOfEntrySecurity';
import { blogSecurity } from './blogSecurity';
import { branchesConnectionSecurity } from './branchesConnectionSecurity';
import { branchPaymentsSecurity } from './branchPaymentsSecurity';
import { branchSettingsSecurity } from './branchSettingsSecurity';
import { brandSecurity } from './brandSecurity';
import { budgetSecurity } from './budgetSecurity';
import { businessSettingsSecurity } from './businessSettingsSecurity';
import { callSecurity } from './callSecurity';
import { cashierSecurity } from './cashierSecurity';
import { categorySecurity } from './categorySecurity';
import { chequeBuilderSecurity } from './chequeBuilderSecurity';
import { companiesOverviewSecurity } from './companieOverviewSecurity';
import { companyGroupEmployeesSecurity } from './companyGroupEmployeesSecurity';
import { companySettingsSecurity } from './companySettingsSecurity';
import { coveredAddress } from './coveredAddress';
import { coveredZone } from './coveredZone';
import { creditNoteSecurity } from './creditNoteSecurity';
import { customerSecurity } from './customerSecurity';
import { customerSegmentsSecurity } from './customerSegmentsSecurity';
import { dailyOpertionSecurity } from './dailyOpertionSecurity';
import { dashboardSecurity } from './dashboardSecurity';
import { deliverySecurity } from './deliverySecurity';
import { departmentSecurity } from './departmentSecurity';
import { dimensionSecurity } from './dimensionSecurity';
import { dineInSecurity } from './dineInSecurity';
import { discountSecurity } from './discountSecurity';
import { DomainSettingsSecurity } from './DomainSettingsSecurity';
import { employeeAssetSecurity } from './employeeAssetSecurity';
import { employeeEosSecurity } from './employeeEosSecurity';
import { employeeGosiSecurity } from './employeeGosiSecurity';
import { employeeAttendenceSecurity } from './employeeAttendenceSecurity';
import { employeeDisciplinarySecurity } from './employeeDisciplinarySecurity';
import { employeeDocumentSecurity } from './employeeDocumentSecurity';
import { employeeInvitationSecurity } from './employeeInvitationSecurity';
import { employeeLeaveSecurity } from './employeeLeaveSecurity';
import { employeePayrollSecurity } from './employeePayrollSecurity';
import { employeePerformanceSecurity } from './employeePerformanceSecurity';
import { employeeProfileSecurity } from './employeeProfileSecurity';
import { employeeScheduleSecurity } from './employeeScheduleSecurity';
import { employeeSecurity } from './employeeSecurity';
import { estimateBuilderSecurity } from './estimateBuilderSecurity';
import { billBuilderSecurity } from './billBuilderSecurity';
import { estimateSecurity } from './estimateSecurity';
import { expenseBuilderSecurity } from './expenseBuilderSecurity';
import { expenseSecurity } from './expenseSecurity';
import { houseAccountSecurity } from './houseAccountSecurity';
import { inventoryLocationsSecurity } from './inventoryLocationsSecurity';
import { inventoryPhysicalCountsSecurity } from './inventoryPhysicalCountsSecurity';
import { inventoryTransferSecurity } from './inventoryTransferSecurity';
import { invoiceBuilderSecurity } from './invoiceBuilderSecurity';
import { invoicePaymentsSecurity } from './invoicePaymentsSecurity';
import { invoiceSecurity } from './invoiceSecurity';
import { kitchenSectionSecurity } from './kitchenSectionSecurity';
import { labelBuilderSecurity } from './labelBuilderSecurity';
import { manualAdjustmentSecurity } from './manualAdjustmentSecurity';
import { manualJournalSecurity } from './manualJournalSecurity';
import { matrixItemSecurity } from './matrixItemSecurity';
import { mediaSecurity } from './mediaSecurity';
import { mediaSettingsSecurity } from './mediaSettingsSecurity';
import { menuBuilderSecurity } from './menuBuilderSecurity';
import { openingBalances } from './openingBalances';
import { optionGroupSecurity } from './optionGroupSecurity';
import { optionSecurity } from './optionSecurity';
import { pageBuilderSecurity } from './pageBuilderSecurity';
import { pagingSecurity } from './pagingSecurity';
import { paymentMethodSecurity } from './paymentMethodSecurity';
import { pendingOrderSecurity } from './pendingOrderSecurity';
import { pluginsSecurity } from './pluginsSecurity';
import { prefixSettingsSecurity } from './prefixSettingsSecurity';
import { priceChangeSecurity } from './priceChangeSecurity';
import { priceLabelSecurity } from './priceLabelSecurity';
import { priceManagementSecurity } from './priceManagementSecurity';
import { privilegeSecurity } from './privilegeSecurity';
import { productRecipeSecurity } from './productRecipeSecurity';
import { productsAvailabilitySecurity } from './productsAvailabilitySecurity';
import { productsCollectionsSecurity } from './productsCollectionsSecurity';
import { productSecurity } from './productSecurity';
import { purchaseOrderBuilderSecurity } from './purchaseOrderBuilderSecurity';
import { purchaseOrderSecurity } from './purchaseOrderSecurity';
import { recentUpdatesSecurity } from './recentUpdatesSecurity';
import { recieptBuilderSecurity } from './recieptBuilderSecurity';
import { recipeSecurity } from './recipeSecurity';
import { reconciliationSecurity } from './reconciliationSecurity';
import { recurringBillSecurity } from './recurringBillSecurity';
import { recurringExpenseSecurity } from './recurringExpenseSecurity';
import { recurringInvoiceSecurity } from './recurringInvoiceSecurity';
import { recurringJournalSecurity } from './recurringJournalSecurity';
import { reportsSecurity } from './reportsSecurity';
import { salonSecurity } from './salonSecurity';
import { salesTargetSecurity } from './salesTargetSecurity';
import { serviceSecurity } from './serviceSecurity';
import { shippingSecurity } from './shippingSecurity';
import { supplierCredit } from './supplierCredit';
import { supplierSecurity } from './supplierSecurity';
import { surchargeSecurity } from './surchargeSecurity';
import { tabBuilderSecurity } from './tabBuilderSecurity';
import { tableManagmentSecurity } from './tableManagmentSecurity';
import { taxSecurity } from './taxSecurity';
import { terminalSecurity } from './terminalSecurity';
import { vatPayment } from './vatPayment';
import { waitingListSecurity } from './waitingListSecurity';
import { websiteBuilderSecurity } from './websiteBuilderSecurity';
import { websiteAnalyticsSecurity } from './websiteAnalyticsSecurity';
import { websiteSettingsSecurity } from './websiteSettingsSecurity';
import { workOrderSecurity } from './workOrderSecurity';
import { customReportsSecurity } from '../../../../features/reports/custom/custom-reports.privileges';
import { dashboardWidgetSecurity } from './dashboardWidgetSecurity';

/**
 * Security-definition registry — the single source of truth for the whole
 * privilege catalog.
 * ─────────────────────────────────────────────────────────────────────────
 * **Adding a new feature to the permission system is now a ONE-LINE change:**
 * add its `xxxSecurity` factory here. The {@link Privilege} model builds its
 * tree by iterating this map, so there is no second place (a hardcoded class
 * field) to keep in sync — the old two-step registration (import + field) was
 * the source of "I added a feature but its permission never showed up" bugs.
 *
 * Each value is a **factory** (`() => PrivilegeSetting`) so every `Privilege`
 * instance gets its own fresh, isolated settings objects.
 *
 * The map's keys are the persisted group keys — they MUST match the saved
 * data structure (`{ <groupKey>: { name, access, actions } }`). Do not rename
 * a key without a data migration; adding a new key is safe (old saved records
 * simply lack it and fall back to the default, i.e. allow-by-default).
 */
export const SECURITY_DEFINITIONS = {
  dashboardSecurity,
  dashboardWidgetSecurity,
  branchesConnectionSecurity,
  branchSettingsSecurity,
  branchPaymentsSecurity,
  kitchenSectionSecurity,
  companySettingsSecurity,
  tableManagmentSecurity,
  recieptBuilderSecurity,
  invoiceBuilderSecurity,
  estimateBuilderSecurity,
  expenseBuilderSecurity,
  purchaseOrderBuilderSecurity,
  billBuilderSecurity,
  shippingSecurity,
  acceptRejectOrderCloudSecurity,
  DomainSettingsSecurity,
  labelBuilderSecurity,
  chequeBuilderSecurity,
  serviceSecurity,
  menuBuilderSecurity,
  budgetSecurity,
  taxSecurity,
  surchargeSecurity,
  tabBuilderSecurity,
  paymentMethodSecurity,
  priceLabelSecurity,
  priceManagementSecurity,
  discountSecurity,
  prefixSettingsSecurity,
  productSecurity,
  recentUpdatesSecurity,
  matrixItemSecurity,
  brandSecurity,
  inventoryLocationsSecurity,
  priceChangeSecurity,
  productRecipeSecurity,
  bankingOverview,
  openingBalances,
  vatPayment,
  coveredAddress,
  coveredZone,
  productsCollectionsSecurity,
  pagingSecurity,
  customerSegmentsSecurity,
  departmentSecurity,
  dimensionSecurity,
  productsAvailabilitySecurity,
  categorySecurity,
  optionGroupSecurity,
  optionSecurity,
  recipeSecurity,
  mediaSecurity,
  mediaSettingsSecurity,
  pluginsSecurity,
  pendingOrderSecurity,
  waitingListSecurity,
  employeeSecurity,
  employeeProfileSecurity,
  // HR phases 2–5. All default-deny server-side: until an administrator ticks
  // these, nobody but a company admin can reach documents, assets, leave,
  // reviews, disciplinary records or pay. That is deliberate, but it means the
  // feature does nothing at all until these are configured.
  employeeDocumentSecurity,
  employeeAssetSecurity,
  employeeLeaveSecurity,
  employeePerformanceSecurity,
  employeeDisciplinarySecurity,
  employeePayrollSecurity,
  employeeEosSecurity,
  employeeGosiSecurity,
  employeeScheduleSecurity,
  employeeAttendenceSecurity,
  employeeInvitationSecurity,
  companyGroupEmployeesSecurity,
  inventoryPhysicalCountsSecurity,
  inventoryTransferSecurity,
  websiteBuilderSecurity,
  websiteAnalyticsSecurity,
  pageBuilderSecurity,
  websiteSettingsSecurity,
  blogSecurity,
  reportsSecurity,
  customReportsSecurity,
  privilegeSecurity,
  accountSecurity,
  customerSecurity,
  manualJournalSecurity,
  manualAdjustmentSecurity,
  recurringJournalSecurity,
  estimateSecurity,
  invoiceSecurity,
  invoicePaymentsSecurity,
  workOrderSecurity,
  creditNoteSecurity,
  supplierSecurity,
  salesTargetSecurity,
  purchaseOrderSecurity,
  billingSecurity,
  billOfEntrySecurity,
  recurringBillSecurity,
  recurringInvoiceSecurity,
  recurringExpenseSecurity,
  billingPaymentsSecurity,
  expenseSecurity,
  supplierCredit,
  reconciliationSecurity,
  businessSettingsSecurity,
  dineInSecurity,
  deliverySecurity,
  callSecurity,
  salonSecurity,
  dailyOpertionSecurity,
  cashierSecurity,
  houseAccountSecurity,
  terminalSecurity,
  companiesOverviewSecurity,
} satisfies Record<string, () => PrivilegeSetting>;

/** Union of every valid security-group key (derived from the registry). */
export type SecurityKey = keyof typeof SECURITY_DEFINITIONS;
