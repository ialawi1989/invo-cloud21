import { PrivilegeSetting } from './privilege-setting.model';

import { acceptRejectOrderCloudSecurity } from '../definitions/acceptRejectOrderCloudSecurity';
import { accountSecurity } from '../definitions/accountSecurity';
import { bankingOverview } from '../definitions/bankingOverview';
import { billingPaymentsSecurity } from '../definitions/billingPaymentsSecurity';
import { billingSecurity } from '../definitions/billingSecurity';
import { billOfEntrySecurity } from '../definitions/billOfEntrySecurity';
import { branchesConnectionSecurity } from '../definitions/branchesConnectionSecurity';
import { branchPaymentsSecurity } from '../definitions/branchPaymentsSecurity';
import { branchSettingsSecurity } from '../definitions/branchSettingsSecurity';
import { brandSecurity } from '../definitions/brandSecurity';
import { budgetSecurity } from '../definitions/budgetSecurity';
import { businessSettingsSecurity } from '../definitions/businessSettingsSecurity';
import { callSecurity } from '../definitions/callSecurity';
import { cashierSecurity } from '../definitions/cashierSecurity';
import { categorySecurity } from '../definitions/categorySecurity';
import { chequeBuilderSecurity } from '../definitions/chequeBuilderSecurity';
import { companiesOverviewSecurity } from '../definitions/companieOverviewSecurity';
import { companyGroupEmployeesSecurity } from '../definitions/companyGroupEmployeesSecurity';
import { companySettingsSecurity } from '../definitions/companySettingsSecurity';
import { coveredAddress } from '../definitions/coveredAddress';
import { coveredZone } from '../definitions/coveredZone';
import { creditNoteSecurity } from '../definitions/creditNoteSecurity';
import { customerSecurity } from '../definitions/customerSecurity';
import { customerSegmentsSecurity } from '../definitions/customerSegmentsSecurity';
import { dailyOpertionSecurity } from '../definitions/dailyOpertionSecurity';
import { dashboardSecurity } from '../definitions/dashboardSecurity';
import { deliverySecurity } from '../definitions/deliverySecurity';
import { departmentSecurity } from '../definitions/departmentSecurity';
import { dimensionSecurity } from '../definitions/dimensionSecurity';
import { dineInSecurity } from '../definitions/dineInSecurity';
import { discountSecurity } from '../definitions/discountSecurity';
import { DomainSettingsSecurity } from '../definitions/DomainSettingsSecurity';
import { employeeAttendenceSecurity } from '../definitions/employeeAttendenceSecurity';
import { employeeInvitationSecurity } from '../definitions/employeeInvitationSecurity';
import { employeeScheduleSecurity } from '../definitions/employeeScheduleSecurity';
import { employeeSecurity } from '../definitions/employeeSecurity';
import { estimateBuilderSecurity } from '../definitions/estimateBuilderSecurity';
import { billBuilderSecurity } from '../definitions/billBuilderSecurity';
import { estimateSecurity } from '../definitions/estimateSecurity';
import { expenseBuilderSecurity } from '../definitions/expenseBuilderSecurity';
import { expenseSecurity } from '../definitions/expenseSecurity';
import { houseAccountSecurity } from '../definitions/houseAccountSecurity';
import { inventoryLocationsSecurity } from '../definitions/inventoryLocationsSecurity';
import { inventoryPhysicalCountsSecurity } from '../definitions/inventoryPhysicalCountsSecurity';
import { inventoryTransferSecurity } from '../definitions/inventoryTransferSecurity';
import { invoiceBuilderSecurity } from '../definitions/invoiceBuilderSecurity';
import { invoicePaymentsSecurity } from '../definitions/invoicePaymentsSecurity';
import { invoiceSecurity } from '../definitions/invoiceSecurity';
import { kitchenSectionSecurity } from '../definitions/kitchenSectionSecurity';
import { labelBuilderSecurity } from '../definitions/labelBuilderSecurity';
import { manualAdjustmentSecurity } from '../definitions/manualAdjustmentSecurity';
import { manualJournalSecurity } from '../definitions/manualJournalSecurity';
import { matrixItemSecurity } from '../definitions/matrixItemSecurity';
import { mediaSecurity } from '../definitions/mediaSecurity';
import { mediaSettingsSecurity } from '../definitions/mediaSettingsSecurity';
import { menuBuilderSecurity } from '../definitions/menuBuilderSecurity';
import { openingBalances } from '../definitions/openingBalances';
import { optionGroupSecurity } from '../definitions/optionGroupSecurity';
import { optionSecurity } from '../definitions/optionSecurity';
import { pageBuilderSecurity } from '../definitions/pageBuilderSecurity';
import { pagingSecurity } from '../definitions/pagingSecurity';
import { paymentMethodSecurity } from '../definitions/paymentMethodSecurity';
import { pendingOrderSecurity } from '../definitions/pendingOrderSecurity';
import { pluginsSecurity } from '../definitions/pluginsSecurity';
import { prefixSettingsSecurity } from '../definitions/prefixSettingsSecurity';
import { priceChangeSecurity } from '../definitions/priceChangeSecurity';
import { priceLabelSecurity } from '../definitions/priceLabelSecurity';
import { priceManagementSecurity } from '../definitions/priceManagementSecurity';
import { privilegeSecurity } from '../definitions/privilegeSecurity';
import { productRecipeSecurity } from '../definitions/productRecipeSecurity';
import { productsAvailabilitySecurity } from '../definitions/productsAvailabilitySecurity';
import { productsCollectionsSecurity } from '../definitions/productsCollectionsSecurity';
import { productSecurity } from '../definitions/productSecurity';
import { purchaseOrderBuilderSecurity } from '../definitions/purchaseOrderBuilderSecurity';
import { purchaseOrderSecurity } from '../definitions/purchaseOrderSecurity';
import { recentUpdatesSecurity } from '../definitions/recentUpdatesSecurity';
import { recieptBuilderSecurity } from '../definitions/recieptBuilderSecurity';
import { recipeSecurity } from '../definitions/recipeSecurity';
import { reconciliationSecurity } from '../definitions/reconciliationSecurity';
import { recurringBillSecurity } from '../definitions/recurringBillSecurity';
import { recurringExpenseSecurity } from '../definitions/recurringExpenseSecurity';
import { recurringInvoiceSecurity } from '../definitions/recurringInvoiceSecurity';
import { recurringJournalSecurity } from '../definitions/recurringJournalSecurity';
import { reportsSecurity } from '../definitions/reportsSecurity';
import { salonSecurity } from '../definitions/salonSecurity';
import { salesTargetSecurity } from '../definitions/salesTargetSecurity';
import { serviceSecurity } from '../definitions/serviceSecurity';
import { shippingSecurity } from '../definitions/shippingSecurity';
import { supplierCredit } from '../definitions/supplierCredit';
import { supplierSecurity } from '../definitions/supplierSecurity';
import { surchargeSecurity } from '../definitions/surchargeSecurity';
import { tabBuilderSecurity } from '../definitions/tabBuilderSecurity';
import { tableManagmentSecurity } from '../definitions/tableManagmentSecurity';
import { taxSecurity } from '../definitions/taxSecurity';
import { terminalSecurity } from '../definitions/terminalSecurity';
import { vatPayment } from '../definitions/vatPayment';
import { waitingListSecurity } from '../definitions/waitingListSecurity';
import { websiteBuilderSecurity } from '../definitions/websiteBuilderSecurity';
import { websiteSettingsSecurity } from '../definitions/websiteSettingsSecurity';
import { workOrderSecurity } from '../definitions/workOrderSecurity';

export class Privilege {
  [key: string]: PrivilegeSetting | any;

  dashboardSecurity              = dashboardSecurity();
  branchesConnectionSecurity     = branchesConnectionSecurity();
  branchSettingsSecurity         = branchSettingsSecurity();
  branchPaymentsSecurity         = branchPaymentsSecurity();
  kitchenSectionSecurity         = kitchenSectionSecurity();
  companySettingsSecurity        = companySettingsSecurity();
  tableManagmentSecurity         = tableManagmentSecurity();
  recieptBuilderSecurity         = recieptBuilderSecurity();
  invoiceBuilderSecurity         = invoiceBuilderSecurity();
  estimateBuilderSecurity        = estimateBuilderSecurity();
  expenseBuilderSecurity         = expenseBuilderSecurity();
  purchaseOrderBuilderSecurity   = purchaseOrderBuilderSecurity();
  billBuilderSecurity            = billBuilderSecurity();
  shippingSecurity               = shippingSecurity();
  acceptRejectOrderCloudSecurity = acceptRejectOrderCloudSecurity();
  DomainSettingsSecurity         = DomainSettingsSecurity();
  labelBuilderSecurity           = labelBuilderSecurity();
  chequeBuilderSecurity          = chequeBuilderSecurity();
  serviceSecurity                = serviceSecurity();
  menuBuilderSecurity            = menuBuilderSecurity();
  budgetSecurity                 = budgetSecurity();
  taxSecurity                    = taxSecurity();
  surchargeSecurity              = surchargeSecurity();
  tabBuilderSecurity             = tabBuilderSecurity();
  paymentMethodSecurity          = paymentMethodSecurity();
  priceLabelSecurity             = priceLabelSecurity();
  priceManagementSecurity        = priceManagementSecurity();
  discountSecurity               = discountSecurity();
  prefixSettingsSecurity         = prefixSettingsSecurity();
  productSecurity                = productSecurity();
  recentUpdatesSecurity          = recentUpdatesSecurity();
  matrixItemSecurity             = matrixItemSecurity();
  brandSecurity                  = brandSecurity();
  inventoryLocationsSecurity     = inventoryLocationsSecurity();
  priceChangeSecurity            = priceChangeSecurity();
  productRecipeSecurity          = productRecipeSecurity();
  bankingOverview                = bankingOverview();
  openingBalances                = openingBalances();
  vatPayment                     = vatPayment();
  coveredAddress                 = coveredAddress();
  coveredZone                    = coveredZone();
  productsCollectionsSecurity    = productsCollectionsSecurity();
  pagingSecurity                 = pagingSecurity();
  customerSegmentsSecurity       = customerSegmentsSecurity();
  departmentSecurity             = departmentSecurity();
  dimensionSecurity              = dimensionSecurity();
  productsAvailabilitySecurity   = productsAvailabilitySecurity();
  categorySecurity               = categorySecurity();
  optionGroupSecurity            = optionGroupSecurity();
  optionSecurity                 = optionSecurity();
  recipeSecurity                 = recipeSecurity();
  mediaSecurity                  = mediaSecurity();
  mediaSettingsSecurity          = mediaSettingsSecurity();
  pluginsSecurity                = pluginsSecurity();
  pendingOrderSecurity           = pendingOrderSecurity();
  waitingListSecurity            = waitingListSecurity();
  employeeSecurity               = employeeSecurity();
  employeeScheduleSecurity       = employeeScheduleSecurity();
  employeeAttendenceSecurity     = employeeAttendenceSecurity();
  employeeInvitationSecurity     = employeeInvitationSecurity();
  companyGroupEmployeesSecurity  = companyGroupEmployeesSecurity();
  inventoryPhysicalCountsSecurity = inventoryPhysicalCountsSecurity();
  inventoryTransferSecurity      = inventoryTransferSecurity();
  websiteBuilderSecurity         = websiteBuilderSecurity();
  pageBuilderSecurity            = pageBuilderSecurity();
  websiteSettingsSecurity        = websiteSettingsSecurity();
  reportsSecurity                = reportsSecurity();
  privilegeSecurity              = privilegeSecurity();
  accountSecurity                = accountSecurity();
  customerSecurity               = customerSecurity();
  manualJournalSecurity          = manualJournalSecurity();
  manualAdjustmentSecurity       = manualAdjustmentSecurity();
  recurringJournalSecurity       = recurringJournalSecurity();
  estimateSecurity               = estimateSecurity();
  invoiceSecurity                = invoiceSecurity();
  invoicePaymentsSecurity        = invoicePaymentsSecurity();
  workOrderSecurity              = workOrderSecurity();
  creditNoteSecurity             = creditNoteSecurity();
  supplierSecurity               = supplierSecurity();
  salesTargetSecurity            = salesTargetSecurity();
  purchaseOrderSecurity          = purchaseOrderSecurity();
  billingSecurity                = billingSecurity();
  billOfEntrySecurity            = billOfEntrySecurity();
  recurringBillSecurity          = recurringBillSecurity();
  recurringInvoiceSecurity       = recurringInvoiceSecurity();
  recurringExpenseSecurity       = recurringExpenseSecurity();
  billingPaymentsSecurity        = billingPaymentsSecurity();
  expenseSecurity                = expenseSecurity();
  supplierCredit                 = supplierCredit();
  reconciliationSecurity         = reconciliationSecurity();
  businessSettingsSecurity       = businessSettingsSecurity();
  dineInSecurity                 = dineInSecurity();
  deliverySecurity               = deliverySecurity();
  callSecurity                   = callSecurity();
  salonSecurity                  = salonSecurity();
  dailyOpertionSecurity          = dailyOpertionSecurity();
  cashierSecurity                = cashierSecurity();
  houseAccountSecurity           = houseAccountSecurity();
  terminalSecurity               = terminalSecurity();
  companiesOverviewSecurity      = companiesOverviewSecurity();

  ToJson(): any {
    const result: any = {};
    for (const key in this) {
      if (typeof this[key] === 'function') continue;
      result[key] = (this[key] as PrivilegeSetting).ToJson();
    }
    return result;
  }

  ParseJson(json: any): void {
    for (const key in this) {
      if (typeof this[key] === 'function') continue;
      if (json[key] == null) continue;

      const x = this[key] as PrivilegeSetting;
      x.name   = json[key].name   ?? x.name;
      x.access = json[key].access ?? null;

      if (json[key].actions && x.actions) {
        for (const [k, v] of Object.entries(json[key].actions as any)) {
          if (x.actions[k]) {
            x.actions[k].access = (v as any).access ?? null;
            x.actions[k].name   = (v as any).name   ?? x.actions[k].name;
          }
        }
      }
    }
  }
}

// ─── Employee Privilege (the stored record) ───────────────────────────────────
export class EmployeePrivilege {
  id: string | null = null;
  name              = '';
  privileges        = new Privilege();
  companyId         = '';
  updatedDate       = new Date();
  createdAt         = new Date();

  ToJson(): any {
    return {
      id:          this.id,
      name:        this.name,
      privileges:  this.privileges.ToJson(),
      companyId:   this.companyId,
      updatedDate: this.updatedDate,
      createdAt:   this.createdAt,
    };
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key === 'privileges') {
        const p = new Privilege();
        p.ParseJson(json[key]);
        this.privileges = p;
      } else {
        (this as any)[key] = json[key];
      }
    }
  }
}
