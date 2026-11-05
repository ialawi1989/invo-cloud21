import { Injectable, inject } from '@angular/core';

import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { InvoicesService } from '../../../features/account/invoices/services/invoices.service';
import { CustomersService } from '../../../features/account/customers/services/customers.service';
import { SalesLookupsService } from '../../../features/account/services/sales-lookups.service';
import { AiDraftService } from './ai-draft.service';
import { AssistantTool, ToolOutcome } from './assistant.types';

const MAX_ROWS = 8;
const MAX_DRAFT_LINES = 30;
const MAX_QTY = 100_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const pick = (o: any, keys: string[]) =>
  Object.fromEntries(keys.filter(k => o?.[k] !== undefined && o?.[k] !== null && o?.[k] !== '').map(k => [k, o[k]]));

const clampLimit = (v: unknown) => Math.min(MAX_ROWS, Math.max(1, Math.floor(Number(v)) || 5));
const text = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const dateOrNull = (v: unknown) => (typeof v === 'string' && DATE.test(v) ? v : null);

/**
 * What the assistant can do. Every tool goes through the same service (and therefore the same authorized backend
 * route and branch/privilege scoping) the matching screen uses, and every tool is read-only or opens a page for the
 * user: nothing here saves, changes or deletes a document. Add a tool by adding one entry to {@link tools}.
 */
@Injectable({ providedIn: 'root' })
export class AssistantToolbox {
  private invoices = inject(InvoicesService);
  private customers = inject(CustomersService);
  private privileges = inject(PrivilegeService);
  private lookups = inject(SalesLookupsService);
  private drafts = inject(AiDraftService);

  private can = (p: string) => this.privileges.check(p);

  /** The branch a new invoice form starts on (its first branch), so product prices here match what the form shows. */
  private async defaultBranchId(): Promise<string | null> {
    const branches = await this.lookups.getBranches();
    return branches?.[0]?.id ?? null;
  }

  readonly tools: AssistantTool[] = [
    {
      def: {
        name: 'find_invoices',
        description:
          'Search sales invoices. Returns up to 8 matches with number, customer, total, status, dates. ' +
          'Use search for an invoice number or customer name.',
        parameters: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Invoice number or customer name' },
            status: { type: 'array', items: { type: 'string' }, description: 'Statuses as shown in the invoice list, e.g. Paid, Partially Paid, Unpaid, Overdue' },
            fromDate: { type: 'string', description: 'YYYY-MM-DD' },
            toDate: { type: 'string', description: 'YYYY-MM-DD' },
            limit: { type: 'number', description: 'Max rows, default 5, at most 8' },
          },
        },
      },
      allowed: () => this.can('invoiceSecurity.actions.view.access'),
      run: async a => {
        const limit = clampLimit(a['limit']);
        const status = Array.isArray(a['status']) ? a['status'].filter((s: unknown) => typeof s === 'string').slice(0, 6) : [];
        const data = await this.invoices.getInvoiceList({
          page: 1, limit, searchTerm: text(a['search']), sortBy: {},
          filter: {
            sources: [], status, branches: [],
            fromDate: dateOrNull(a['fromDate']), toDate: dateOrNull(a['toDate']),
            salesEmployeeId: null, productId: null,
          },
        });
        const rows: any[] = (data?.list ?? []).slice(0, limit);
        return {
          result: {
            total: data?.count ?? rows.length,
            invoices: rows.map(r => pick(r, ['id', 'invoiceNumber', 'customerName', 'total', 'status', 'invoiceDate', 'dueDate', 'branchName'])),
          },
          links: rows.filter(r => r.id).map(r => ({ label: String(r.invoiceNumber ?? r.id), url: `/account/invoices/view/${r.id}` })),
        } satisfies ToolOutcome;
      },
    },
    {
      def: {
        name: 'get_invoice',
        description: 'Get one invoice by its id (from find_invoices): customer, dates, status, total and its lines.',
        parameters: { type: 'object', properties: { invoiceId: { type: 'string' } }, required: ['invoiceId'] },
      },
      allowed: () => this.can('invoiceSecurity.actions.view.access'),
      run: async a => {
        const id = text(a['invoiceId'], 64);
        const inv: any = id ? await this.invoices.getInvoiceRaw(id) : null;
        if (!inv) return { result: { error: 'Invoice not found' } };
        return {
          result: {
            ...pick(inv, ['id', 'invoiceNumber', 'customerName', 'status', 'invoiceDate', 'dueDate', 'total', 'branchName', 'note']),
            lines: (inv.lines ?? []).slice(0, 15).map((l: any) => pick(l, ['productName', 'name', 'qty', 'price', 'total'])),
          },
          links: [{ label: String(inv.invoiceNumber ?? id), url: `/account/invoices/view/${id}` }],
        };
      },
    },
    {
      def: {
        name: 'find_customers',
        description: 'Search customers by name, phone or email. Returns up to 8 matches.',
        parameters: { type: 'object', properties: { search: { type: 'string' } }, required: ['search'] },
      },
      allowed: () => this.can('customerSecurity.actions.view.access'),
      run: async a => {
        const data = await this.customers.getCustomerMiniList({ page: 1, limit: MAX_ROWS, searchTerm: text(a['search']), sortBy: {} });
        const rows: any[] = (data?.list ?? []).slice(0, MAX_ROWS);
        rows.forEach(r => r.id && this.drafts.customerIds.add(String(r.id)));
        return {
          result: { customers: rows.map(r => pick(r, ['id', 'name', 'displayName', 'phone', 'email'])) },
        };
      },
    },
    {
      def: {
        name: 'find_products',
        description:
          'Search sellable products by name or barcode (price shown is the standard price). Use this to get the productId ' +
          'before drafting an invoice. Returns up to 8 matches.',
        parameters: { type: 'object', properties: { search: { type: 'string' } }, required: ['search'] },
      },
      allowed: () => this.can('invoiceSecurity.actions.add.access'),
      run: async a => {
        const branchId = await this.defaultBranchId();
        if (!branchId) return { result: { error: 'No branch available' } };
        const res = await this.lookups.getBranchProducts({ page: 1, limit: MAX_ROWS, searchTerm: text(a['search']), branchId, customerId: null });
        const rows: any[] = (res?.list ?? []).slice(0, MAX_ROWS);
        rows.forEach(r => r.id && this.drafts.products.set(String(r.id), r));
        return {
          result: {
            products: rows.map(r => ({
              ...pick(r, ['id', 'name', 'barcode', 'type', 'unitCost']),
              price: r.defaultPrice ?? r.price,
              // Serial / batch products need a per-line picker, so the assistant cannot add them to a draft.
              needsManualPick: r.type === 'serialized' || r.type === 'batch' ? true : undefined,
            })),
          },
        };
      },
    },
    {
      def: {
        name: 'draft_invoice',
        description:
          'Prepare a NEW invoice draft and show the user a button that opens the invoice form already filled in. Nothing is ' +
          'saved: the user reviews and saves it. Only use ids returned by find_customers / find_products. Confirm the customer ' +
          'and quantities with the user first when anything is unclear.',
        parameters: {
          type: 'object',
          properties: {
            customerId: { type: 'string', description: 'From find_customers; omit for a walk-in customer' },
            lines: {
              type: 'array',
              description: 'Products to add',
              items: {
                type: 'object',
                properties: { productId: { type: 'string' }, qty: { type: 'number' } },
                required: ['productId', 'qty'],
              },
            },
            note: { type: 'string' },
          },
          required: ['lines'],
        },
      },
      allowed: () => this.can('invoiceSecurity.actions.add.access'),
      run: async a => {
        const customerId = text(a['customerId'], 64) || null;
        if (customerId && !this.drafts.customerIds.has(customerId)) {
          return { result: { error: 'Unknown customer: look the customer up with find_customers first.' } };
        }
        const rawLines: any[] = Array.isArray(a['lines']) ? a['lines'].slice(0, MAX_DRAFT_LINES) : [];
        const lines: { productId: string; qty: number }[] = [];
        const rejected: string[] = [];
        for (const l of rawLines) {
          const productId = text(l?.productId, 64);
          const qty = Number(l?.qty);
          const product = this.drafts.products.get(productId);
          if (!product) rejected.push(`${productId || '?'}: not found, look it up with find_products first`);
          else if (product.type === 'serialized' || product.type === 'batch') rejected.push(`${product.name}: needs a serial/batch, the user must add it in the form`);
          else if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_QTY) rejected.push(`${product.name}: invalid quantity`);
          else lines.push({ productId, qty });
        }
        if (!lines.length) return { result: { error: 'No valid lines', rejected } };

        this.drafts.setInvoice({ customerId, note: text(a['note'], 500), lines });
        const url = '/account/invoices/new?aiDraft=1' + (customerId ? `&customerId=${encodeURIComponent(customerId)}` : '');
        return {
          result: { ok: true, lines: lines.length, rejected, note: 'A button to open the prefilled invoice was shown. It is not saved: the user must review and save it.' },
          links: [{ label: 'Review the new invoice', url }],
        };
      },
    },
    {
      def: {
        name: 'open_new_invoice',
        description: 'Offer the user a button that opens a blank new invoice form. Use when they want to create an invoice.',
        parameters: { type: 'object', properties: {} },
      },
      allowed: () => this.can('invoiceSecurity.actions.add.access'),
      run: async () => ({
        result: { ok: true, note: 'A button to open the new invoice form was shown to the user. You cannot fill or save it.' },
        links: [{ label: 'New invoice', url: '/account/invoices/new' }],
      }),
    },
  ];

  /** Tools the current employee may use. */
  available(): AssistantTool[] {
    return this.tools.filter(t => t.allowed());
  }
}
