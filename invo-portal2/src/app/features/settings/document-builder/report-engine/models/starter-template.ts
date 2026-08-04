import { Block, TableColumn } from '../core/types/block.types';
import { ReportTemplate, Section } from '../core/types/template.types';
import { makeTemplateId } from '../utils/id.utils';
import { sampleInvoiceTemplate } from './sample-templates';
import { DocumentType } from '../../services/document-template.types';
import { DOCUMENT_DATA_MODELS, DOCUMENT_DISPLAY_NAMES } from './document-data-model';

/**
 * Produces the starting template for a document type that has never been
 * designed before.
 *
 * The bundled sample is authored against the *invoice* payload
 * (`invoiceNumber`, `invoiceDate`, `dueDate`, …). Every document type shares
 * the same envelope — `lines[]`, `subTotal`, `taxTotal`, `total`,
 * `branchName` — and differs only in the number/date field names and the
 * customer-vs-supplier entity field. So rather than maintaining seven
 * near-identical 2000-line templates, we retarget the one sample:
 *
 *   1. Rewrite `invoiceNumber` / `invoiceDate` / `dueDate` bindings to the
 *      field names from the type's DataModelConfig.
 *   2. Rewrite `customerName` → the type's entity name field, so
 *      supplier-facing documents bind the supplier.
 *   3. Swap the title text and the "Invoice #" label for the type's own.
 *
 * The rewrite walks every string-carrying field on every block (including
 * table columns, totals rows, and repeater children) using whole-word
 * boundaries, so `invoiceNumber` is replaced but `invoiceNumberSuffix`
 * — were it ever to exist — would not be.
 */
export function starterTemplate(documentType: DocumentType): ReportTemplate {
  const base = sampleInvoiceTemplate();
  const displayName = DOCUMENT_DISPLAY_NAMES[documentType];
  const model = DOCUMENT_DATA_MODELS[documentType];

  // Source → target binding renames. Identity entries are harmless; they're
  // filtered out below so the invoice case does no work at all.
  const renames: Array<[string, string]> = [
    ['invoiceNumber', model.documentNumberField],
    ['invoiceDate', model.documentDateField],
    ['customerName', model.entityNameField],
    // Supplier-facing documents (bill, PO, expense, supplier credit) carry
    // `unitCost` on their lines instead of `price`. Without this the starter's
    // price column would bind a field that doesn't exist on those payloads
    // and silently render blank.
    ['row.price', `row.${model.linePriceField}`],
  ];
  if (model.dueDateField) renames.push(['dueDate', model.dueDateField]);

  const active = renames.filter(([from, to]) => from !== to);

  const rewriteBindings = (text: string): string => {
    let out = text;
    for (const [from, to] of active) {
      // Escape first — `row.price` contains a `.`, which would otherwise
      // match any character. Word boundaries then keep `invoiceNumber` from
      // matching inside a longer identifier.
      out = out.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'g'), to);
    }
    return out;
  };

  // Literal copy that names the document type. Done after binding renames so
  // the label swap can't be undone by a binding rewrite.
  const rewriteLabels = (text: string): string => {
    if (text === 'INVOICE') return displayName.toUpperCase();
    if (text === 'Invoice #') return `${displayName} #`;
    return text;
  };

  const sections: Section[] = base.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((b) => rewriteBlock(b, rewriteBindings, rewriteLabels)),
  }));

  return {
    ...base,
    id: makeTemplateId(),
    name: `${displayName} template`,
    description: `${displayName} layout bound to the Invo ${displayName.toLowerCase()} payload.`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections,
    // The host supplies live preview data through the designer's [data]
    // Input, so the template carries none of its own — that keeps one
    // source of truth for the dummy document across Classic and Free modes.
    sampleData: undefined,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Apply the two rewrites across every string field a block can carry. */
function rewriteBlock(
  block: Block,
  bindings: (s: string) => string,
  labels: (s: string) => string,
): Block {
  // `both` is for user-visible copy that may also contain bindings (block
  // text, table headers); `bindings` alone is for pure expressions, where a
  // label swap would be meaningless and potentially destructive.
  const both = (s: string) => labels(bindings(s));

  const out: Block = { ...block };

  if (out.visibleWhen) out.visibleWhen = bindings(out.visibleWhen);

  switch (out.type) {
    case 'text':
      out.text = both(out.text);
      break;
    case 'rich-text':
      out.html = both(out.html);
      break;
    case 'dynamic-field':
      out.expression = bindings(out.expression);
      break;
    case 'page-number':
      out.format = both(out.format);
      break;
    case 'qr-code':
      out.value = bindings(out.value);
      break;
    case 'barcode':
      out.value = bindings(out.value);
      break;
    case 'signature':
      if (out.label) out.label = labels(out.label);
      if (out.imageBinding) out.imageBinding = bindings(out.imageBinding);
      break;
    case 'image':
      // `source` may be a data URL — only rewrite when it's a binding.
      if (out.binding) out.binding = bindings(out.binding);
      break;
    case 'totals':
      out.rows = out.rows.map((r) => ({ ...r, label: labels(r.label), expression: bindings(r.expression) }));
      break;
    case 'table':
      out.dataSource = bindings(out.dataSource);
      out.columns = out.columns.map(
        (c): TableColumn => ({ ...c, header: both(c.header), expression: bindings(c.expression) }),
      );
      if (out.rowVisibleWhen) out.rowVisibleWhen = bindings(out.rowVisibleWhen);
      if (out.groups) {
        out.groups = out.groups.map((g) => ({
          ...g,
          by: bindings(g.by),
          headerExpression: g.headerExpression ? both(g.headerExpression) : g.headerExpression,
          footerExpression: g.footerExpression ? both(g.footerExpression) : g.footerExpression,
        }));
      }
      break;
    case 'payments':
      out.dataSource = bindings(out.dataSource);
      if (out.rowVisibleWhen) out.rowVisibleWhen = bindings(out.rowVisibleWhen);
      break;
    case 'group-header':
    case 'group-footer':
      out.groupBy = bindings(out.groupBy);
      out.template = both(out.template);
      break;
    case 'repeater':
      out.dataSource = bindings(out.dataSource);
      if (out.rowVisibleWhen) out.rowVisibleWhen = bindings(out.rowVisibleWhen);
      out.items = out.items.map((c) => rewriteBlock(c, bindings, labels));
      break;
    default:
      // line / rectangle / divider carry no bindings.
      break;
  }

  return out;
}
