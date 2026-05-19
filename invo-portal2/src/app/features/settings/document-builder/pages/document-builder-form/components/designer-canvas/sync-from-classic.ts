import {
  DesignerElement,
  DocumentTemplate,
  paperWidthCm,
} from '../../../../services/document-template.types';

/**
 * Build a starter set of designer elements from a Classic template.
 *
 * Lets users opt into Designer mode without losing their structured
 * Classic config — the Sync button in the inspector calls this and
 * replaces the current designer-elements array. Visibility toggles
 * + additional-data + custom-elements from Classic are all honoured.
 *
 * Coordinates assume an A4 portrait paper (~752px wide). The canvas
 * will clip / scale via zoom regardless of paper size, so the seed
 * stays usable on any orientation.
 */
export function seedDesignerFromClassic(template: DocumentTemplate): DesignerElement[] {
  const out: DesignerElement[] = [];
  let nextId = 1;
  const id = () => nextId++;

  const paperW = paperWidthCm(template) * 37.8;
  const h     = template.headerCustomization;
  const f     = template.footerCustomization;

  // Decorative outer + inner frame
  out.push({ id: id(), type: 'Shape', x: 28, y: 28, w: paperW - 56, h: 1067,
             bg: 'transparent', stroke: '#1e3a8a', strokeWidth: 2, radius: 6, shapeKind: 'rect' });

  let yCursor = 50;

  if (h.visibility.visible) {
    // Logo
    if (h.logo.show) {
      out.push({ id: id(), type: 'Image', x: 50, y: yCursor,
                 w: h.logo.width || 120, h: h.logo.height || 80,
                 bg: '#f8fafc', content: 'LOGO', color: '#9ca3af', size: 10, align: 'center' });
    }
    // Company block
    let y = yCursor + 2;
    const lineH = 18;
    if (h.companyName.show) {
      out.push({ id: id(), type: 'Text', x: 185, y, w: 300, h: lineH,
                 content: '{{company.name}}', color: '#1e3a8a', bold: true, size: 14, align: 'center' });
      y += lineH + 2;
    }
    if (h.address.show) {
      out.push({ id: id(), type: 'Text', x: 185, y, w: 300, h: 14,
                 content: '{{company.address}}', color: '#4b5563', size: 9, align: 'center' });
      y += 14;
    }
    if (h.vatNumber.show) {
      out.push({ id: id(), type: 'Text', x: 185, y, w: 300, h: 14,
                 content: 'VAT Reg. No: {{company.vat}}', color: '#4b5563', size: 9, align: 'center' });
      y += 14;
    }
    if (h.phone.show) {
      out.push({ id: id(), type: 'Text', x: 185, y, w: 300, h: 14,
                 content: 'Tel: {{company.phone}}', color: '#4b5563', size: 9, align: 'center' });
      y += 14;
    }
    yCursor = Math.max(yCursor + 80, y + 12);

    // Bill-to card
    out.push({ id: id(), type: 'Shape', x: paperW - 270, y: 50, w: 220, h: 90,
               bg: '#f8fafc', stroke: '#cbd5e1', strokeWidth: 1, radius: 4, shapeKind: 'rect' });
    out.push({ id: id(), type: 'Text', x: paperW - 264, y: 54, w: 80, h: 14,
               content: 'Bill To', color: '#1e3a8a', bold: true, size: 10 });
    out.push({ id: id(), type: 'Text', x: paperW - 264, y: 70, w: 210, h: 14,
               content: '{{customer.name}}', color: '#111827', bold: true, size: 10 });
    out.push({ id: id(), type: 'Text', x: paperW - 264, y: 86, w: 210, h: 12,
               content: '{{customer.address}}', color: '#4b5563', size: 9 });
    out.push({ id: id(), type: 'Text', x: paperW - 264, y: 102, w: 210, h: 12,
               content: 'VAT: {{customer.vat}}', color: '#111827', bold: true, size: 9 });
  }

  // Title
  out.push({ id: id(), type: 'Text', x: 0, y: yCursor + 12, w: paperW, h: 28,
             content: 'TAX INVOICE', color: '#1e3a8a', bold: true, size: 22, align: 'center' });
  yCursor += 56;

  // Meta + items table
  out.push({ id: id(), type: 'Table', x: 50, y: yCursor, w: paperW - 100, h: 42,
             headers: ['Invoice No', 'Date', 'Due Date', 'Reference'],
             rows:    [['{{invoice.number}}', '{{invoice.date}}', '{{invoice.dueDate}}', '{{invoice.reference}}']],
             headerBg: '#1e3a8a', headerColor: '#ffffff', striped: true });
  yCursor += 56;

  out.push({ id: id(), type: 'Table', x: 50, y: yCursor, w: paperW - 100, h: 120,
             headers: ['#', 'Description', 'Qty', 'Unit', 'Total'],
             rows: [
               ['1', '{{invoice.line1}}', '40', '75.000', '3000.000'],
               ['2', '{{invoice.line2}}', '1',  '2400.000', '2400.000'],
             ],
             bindTo: 'lines', headerBg: '#1e3a8a', headerColor: '#ffffff', striped: true });
  yCursor += 140;

  // Totals
  out.push({ id: id(), type: 'Shape', x: paperW - 270, y: yCursor, w: 220, h: 90,
             bg: '#fafafa', stroke: '#e5e7eb', strokeWidth: 1, radius: 4, shapeKind: 'rect' });
  out.push({ id: id(), type: 'Text', x: paperW - 264, y: yCursor + 8,  w: 90,  h: 14,
             content: 'Subtotal', color: '#4b5563', size: 10 });
  out.push({ id: id(), type: 'Text', x: paperW - 165, y: yCursor + 8,  w: 100, h: 14,
             content: 'BHD {{totals.subtotal}}', color: '#111827', size: 10, align: 'right' });
  out.push({ id: id(), type: 'Text', x: paperW - 264, y: yCursor + 28, w: 90,  h: 14,
             content: 'VAT', color: '#4b5563', size: 10 });
  out.push({ id: id(), type: 'Text', x: paperW - 165, y: yCursor + 28, w: 100, h: 14,
             content: 'BHD {{totals.vat}}', color: '#111827', size: 10, align: 'right' });
  out.push({ id: id(), type: 'Text', x: paperW - 264, y: yCursor + 56, w: 90,  h: 18,
             content: 'Grand Total', color: '#1e3a8a', bold: true, size: 12 });
  out.push({ id: id(), type: 'Text', x: paperW - 165, y: yCursor + 56, w: 100, h: 18,
             content: 'BHD {{totals.grandTotal}}', color: '#1e3a8a', bold: true, size: 12, align: 'right' });

  yCursor += 120;

  // Footer
  if (f.visibility.visible) {
    if (f.term.show) {
      out.push({ id: id(), type: 'Text', x: 50, y: yCursor, w: paperW - 100, h: 60,
                 content: 'Terms & Conditions: {{terms}}', color: '#6b7280', size: 9 });
      yCursor += 70;
    }
    if (f.note.show) {
      out.push({ id: id(), type: 'Text', x: 50, y: yCursor, w: paperW - 100, h: 30,
                 content: '{{notes}}', color: '#6b7280', italic: true, size: 9 });
    }
  }

  // Honour any additional-data fields the user added — render at
  // their chosen position as a single line of "label: value" text.
  for (const ad of (template.additionalData || [])) {
    if (!ad.show) continue;
    out.push({
      id: id(), type: 'Text', x: 50, y: yCursor, w: paperW - 100, h: 16,
      content: `${ad.label}: {{additional.${ad.key}}}`,
      color: '#6b7280', size: 9,
    });
    yCursor += 20;
  }

  return out;
}
