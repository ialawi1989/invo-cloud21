/** The slice of the document line editor the draft needs. */
export interface DraftLineEditor {
  addLine(): any;
  chooseItem(line: any, product: any): void;
  readonly lastLineIsEmpty: boolean;
  readonly accounts: { id: string }[];
}

export interface DraftDoc {
  lines: any[];
  calculateTotal(): void;
}

/** Same rule as the lines table: no product and no note. */
const isBlank = (l: any) => !String(l?.productId ?? '').trim() && !String(l?.note ?? '').trim();

/**
 * Adds assistant-prepared products to a document the way "Add items in bulk" does (blank row replaced, each product
 * chosen through the editor so price / tax / accounts follow the normal rules, a blank row kept at the end).
 * Nothing is saved; the user reviews the form.
 */
export function appendDraftLines(doc: DraftDoc, editor: DraftLineEditor, picks: { product: any; qty: number }[]): void {
  const last = doc.lines[doc.lines.length - 1];
  if (last && isBlank(last)) doc.lines.pop();
  for (const { product, qty } of picks) {
    const line = editor.addLine();
    doc.lines.pop();
    doc.lines.push(line);
    editor.chooseItem(line, product);
    line.qty = qty;
    line.tempQty = qty;
    if (!line.accountId && editor.accounts.length) line.accountId = editor.accounts[0].id;
  }
  if (!editor.lastLineIsEmpty) editor.addLine();
  doc.lines.forEach((l, i) => (l.index = i));
  doc.calculateTotal();
}
