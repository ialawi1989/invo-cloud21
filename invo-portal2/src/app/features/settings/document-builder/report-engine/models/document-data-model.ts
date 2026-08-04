import { DocumentType } from '../../services/document-template.types';

/**
 * The field names each document type carries on its payload.
 *
 * Every type shares one envelope — `lines[]`, `subTotal`, `taxTotal`,
 * `total`, `branchName` — and differs only in what the number/date fields
 * are called, whether the counterparty is a customer or a supplier, and
 * whether lines price as `price` or `unitCost`. `starterTemplate()` uses
 * this to retarget the bundled invoice sample instead of shipping seven
 * near-identical templates.
 */
export interface DocumentDataModel {
  documentNumberField: string;
  documentDateField: string;
  /** Absent for types with no due/expiry concept (credit notes, expenses). */
  dueDateField?: string;
  entityNameField: string;
  /** Supplier-facing documents price lines as `unitCost`, not `price`. */
  linePriceField: string;
}

/** What the type is called in the UI — used for the document title copy. */
export const DOCUMENT_DISPLAY_NAMES: Record<DocumentType, string> = {
  'invoice': 'Invoice',
  'estimate': 'Estimate',
  'credit-note': 'Credit Note',
  'purchase-order': 'Purchase Order',
  'bill': 'Bill',
  'expense': 'Expense',
  'supplier-credit': 'Supplier Credit',
};

export const DOCUMENT_DATA_MODELS: Record<DocumentType, DocumentDataModel> = {
  'invoice': {
    documentNumberField: 'invoiceNumber',
    documentDateField: 'invoiceDate',
    dueDateField: 'dueDate',
    entityNameField: 'customerName',
    linePriceField: 'price',
  },
  'estimate': {
    documentNumberField: 'estimateNumber',
    documentDateField: 'estimateDate',
    dueDateField: 'estimateExpDate',
    entityNameField: 'customerName',
    linePriceField: 'price',
  },
  'credit-note': {
    documentNumberField: 'creditNoteNumber',
    documentDateField: 'creditNoteDate',
    entityNameField: 'customerName',
    linePriceField: 'price',
  },
  'purchase-order': {
    documentNumberField: 'purchaseNumber',
    documentDateField: 'purchaseDate',
    dueDateField: 'expectedDeliveryDate',
    entityNameField: 'supplierName',
    linePriceField: 'unitCost',
  },
  'bill': {
    documentNumberField: 'billingNumber',
    documentDateField: 'billingDate',
    dueDateField: 'dueDate',
    entityNameField: 'supplierName',
    linePriceField: 'unitCost',
  },
  'expense': {
    documentNumberField: 'expenseNumber',
    documentDateField: 'expenseDate',
    entityNameField: 'supplierName',
    linePriceField: 'unitCost',
  },
  'supplier-credit': {
    documentNumberField: 'supplierCreditNumber',
    documentDateField: 'supplierCreditDate',
    entityNameField: 'supplierName',
    linePriceField: 'unitCost',
  },
};
