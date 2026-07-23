import { Privilege } from './models/privilege.model';
import { PrivilegeSetting } from './models/privilege-setting.model';

/**
 * Preset (template) roles for privilege sets.
 * ───────────────────────────────────────────
 * A curated catalog of ready-made permission templates so an admin can start
 * from "Cashier" / "Accountant" / "Manager" and tweak, instead of toggling
 * ~100 security groups from an all-off blank. Inspired by the "System roles"
 * pattern (School-Management SaaS reference).
 *
 * A preset lists the security-**group** keys it fully enables (every action +
 * the group's own `access`). `all: true` enables the entire catalog (Owner).
 * Applying a preset is a REPLACE: listed groups on, everything else off — so
 * re-picking a preset always yields a predictable baseline.
 *
 * i18n: labels/descriptions live under `EMPLOYEES.PRIVILEGES.PRESETS.*`.
 */
export interface PresetRole {
  /** Stable key (persisted as the seed marker if the backend wants it). */
  key: string;
  /** i18n key for the display name. */
  displayNameKey: string;
  /** i18n key for the one-line description. */
  descriptionKey: string;
  /** Enable the whole catalog. Mutually exclusive with `groups`. */
  all?: boolean;
  /** Security-group keys to fully enable. */
  groups?: string[];
}

export const PRESET_ROLES: PresetRole[] = [
  {
    key: 'owner',
    displayNameKey: 'EMPLOYEES.PRIVILEGES.PRESETS.OWNER',
    descriptionKey: 'EMPLOYEES.PRIVILEGES.PRESETS.OWNER_DESC',
    all: true,
  },
  {
    key: 'manager',
    displayNameKey: 'EMPLOYEES.PRIVILEGES.PRESETS.MANAGER',
    descriptionKey: 'EMPLOYEES.PRIVILEGES.PRESETS.MANAGER_DESC',
    groups: [
      'dashboardSecurity', 'reportsSecurity', 'customReportsSecurity',
      'productSecurity', 'categorySecurity', 'brandSecurity', 'departmentSecurity',
      'matrixItemSecurity', 'optionGroupSecurity', 'optionSecurity', 'productsCollectionsSecurity',
      'inventoryPhysicalCountsSecurity', 'inventoryTransferSecurity', 'inventoryLocationsSecurity',
      'customerSecurity', 'customerSegmentsSecurity',
      'invoiceSecurity', 'estimateSecurity', 'invoicePaymentsSecurity', 'creditNoteSecurity',
      'supplierSecurity', 'purchaseOrderSecurity', 'billingSecurity',
      'discountSecurity', 'salesTargetSecurity',
      'employeeSecurity', 'employeeScheduleSecurity', 'employeeAttendenceSecurity',
      'dailyOpertionSecurity', 'pendingOrderSecurity', 'deliverySecurity', 'dineInSecurity',
    ],
  },
  {
    key: 'cashier',
    displayNameKey: 'EMPLOYEES.PRIVILEGES.PRESETS.CASHIER',
    descriptionKey: 'EMPLOYEES.PRIVILEGES.PRESETS.CASHIER_DESC',
    groups: [
      'dashboardSecurity',
      'cashierSecurity', 'terminalSecurity', 'dailyOpertionSecurity',
      'pendingOrderSecurity', 'waitingListSecurity',
      'dineInSecurity', 'deliverySecurity', 'houseAccountSecurity',
      'acceptRejectOrderCloudSecurity',
    ],
  },
  {
    key: 'accountant',
    displayNameKey: 'EMPLOYEES.PRIVILEGES.PRESETS.ACCOUNTANT',
    descriptionKey: 'EMPLOYEES.PRIVILEGES.PRESETS.ACCOUNTANT_DESC',
    groups: [
      'dashboardSecurity', 'reportsSecurity', 'customReportsSecurity',
      'accountSecurity', 'openingBalances', 'bankingOverview', 'reconciliationSecurity',
      'manualJournalSecurity', 'recurringJournalSecurity',
      'invoiceSecurity', 'invoicePaymentsSecurity', 'recurringInvoiceSecurity', 'creditNoteSecurity',
      'billingSecurity', 'billingPaymentsSecurity', 'recurringBillSecurity', 'billOfEntrySecurity',
      'expenseSecurity', 'recurringExpenseSecurity',
      'budgetSecurity', 'taxSecurity', 'vatPayment', 'supplierCredit',
    ],
  },
  {
    key: 'inventory',
    displayNameKey: 'EMPLOYEES.PRIVILEGES.PRESETS.INVENTORY',
    descriptionKey: 'EMPLOYEES.PRIVILEGES.PRESETS.INVENTORY_DESC',
    groups: [
      'dashboardSecurity',
      'productSecurity', 'categorySecurity', 'brandSecurity', 'departmentSecurity',
      'matrixItemSecurity', 'dimensionSecurity', 'optionGroupSecurity', 'optionSecurity',
      'recipeSecurity', 'productRecipeSecurity', 'productsAvailabilitySecurity',
      'inventoryPhysicalCountsSecurity', 'inventoryTransferSecurity', 'inventoryLocationsSecurity',
      'priceChangeSecurity', 'priceManagementSecurity',
      'supplierSecurity', 'purchaseOrderSecurity',
    ],
  },
  {
    key: 'marketing',
    displayNameKey: 'EMPLOYEES.PRIVILEGES.PRESETS.MARKETING',
    descriptionKey: 'EMPLOYEES.PRIVILEGES.PRESETS.MARKETING_DESC',
    groups: [
      'dashboardSecurity',
      'websiteBuilderSecurity', 'pageBuilderSecurity', 'websiteSettingsSecurity',
      'websiteAnalyticsSecurity', 'DomainSettingsSecurity',
      'blogSecurity', 'mediaSecurity', 'mediaSettingsSecurity',
      'discountSecurity', 'customerSegmentsSecurity',
    ],
  },
  {
    key: 'driver',
    displayNameKey: 'EMPLOYEES.PRIVILEGES.PRESETS.DRIVER',
    descriptionKey: 'EMPLOYEES.PRIVILEGES.PRESETS.DRIVER_DESC',
    groups: [
      'deliverySecurity', 'dailyOpertionSecurity', 'pendingOrderSecurity',
    ],
  },
];

/** Look up a preset by its stable key. */
export function findPresetRole(key: string): PresetRole | undefined {
  return PRESET_ROLES.find(p => p.key === key);
}

/**
 * Apply a preset to a live {@link Privilege} tree in place: enable every
 * action (+ section access) of the preset's groups, disable everything else.
 * Returns the same tree for convenience.
 */
export function applyPresetToPrivilege(privileges: Privilege, preset: PresetRole): Privilege {
  const enable = new Set(preset.groups ?? []);
  for (const key in privileges) {
    const section = privileges[key] as PrivilegeSetting;
    if (!section || typeof section.ToJson !== 'function') continue;

    const on = !!preset.all || enable.has(key);
    section.access = on;
    if (section.actions) {
      for (const ak in section.actions) section.actions[ak].access = on;
    }
  }
  return privileges;
}
