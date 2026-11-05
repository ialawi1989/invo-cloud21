import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { InvoicesService } from '../../../features/account/invoices/services/invoices.service';
import { CustomersService } from '../../../features/account/customers/services/customers.service';
import { SalesLookupsService } from '../../../features/account/services/sales-lookups.service';
import { AiDraftService } from './ai-draft.service';
import { AssistantToolbox } from './assistant-tools';

describe('AssistantToolbox invoice drafting', () => {
  let box: AssistantToolbox;
  let drafts: AiDraftService;
  let granted: Set<string>;
  const run = (name: string, args: any) => box.tools.find(t => t.def.name === name)!.run(args);

  beforeEach(() => {
    granted = new Set(['invoiceSecurity.actions.add.access', 'invoiceSecurity.actions.view.access', 'customerSecurity.actions.view.access']);
    TestBed.configureTestingModule({
      providers: [
        AssistantToolbox,
        { provide: PrivilegeService, useValue: { check: (p: string) => granted.has(p) } },
        { provide: InvoicesService, useValue: {} },
        { provide: CustomersService, useValue: { getCustomerMiniList: async () => ({ list: [{ id: 'c1', name: 'Ahmed' }] }) } },
        {
          provide: SalesLookupsService,
          useValue: {
            getBranches: async () => [{ id: 'b1' }],
            getBranchProducts: vi.fn(async () => ({
              list: [
                { id: 'p1', name: 'Pen', type: 'inventory', defaultPrice: 2 },
                { id: 'p2', name: 'Phone', type: 'serialized', defaultPrice: 90 },
              ],
              hasNext: false,
            })),
          },
        },
      ],
    });
    box = TestBed.inject(AssistantToolbox);
    drafts = TestBed.inject(AiDraftService);
  });

  it('find_products remembers what it returned and flags serial / batch products', async () => {
    const out: any = await run('find_products', { search: 'p' });
    expect(out.result.products.map((p: any) => [p.id, p.needsManualPick])).toEqual([['p1', undefined], ['p2', true]]);
    expect(drafts.products.has('p1')).toBe(true);
  });

  it('draft_invoice stores the draft and offers a link to the new invoice form for the customer', async () => {
    await run('find_customers', { search: 'ah' });
    await run('find_products', { search: 'p' });
    const out: any = await run('draft_invoice', { customerId: 'c1', lines: [{ productId: 'p1', qty: 3 }], note: 'urgent' });
    expect(out.result.ok).toBe(true);
    expect(out.links[0].url).toBe('/account/invoices/new?aiDraft=1&customerId=c1');
    expect(drafts.takeInvoice()).toEqual({ customerId: 'c1', note: 'urgent', lines: [{ productId: 'p1', qty: 3 }] });
    expect(drafts.takeInvoice()).toBeNull(); // single use
  });

  it('refuses ids it never looked up (a model cannot invent a customer or product)', async () => {
    const a: any = await run('draft_invoice', { customerId: 'ghost', lines: [{ productId: 'p1', qty: 1 }] });
    expect(a.result.error).toContain('Unknown customer');
    const b: any = await run('draft_invoice', { lines: [{ productId: 'ghost', qty: 1 }] });
    expect(b.result.error).toBe('No valid lines');
    expect(drafts.takeInvoice()).toBeNull();
  });

  it('skips serial products and bad quantities but keeps the valid lines', async () => {
    await run('find_products', { search: 'p' });
    const out: any = await run('draft_invoice', {
      lines: [{ productId: 'p1', qty: 2 }, { productId: 'p2', qty: 1 }, { productId: 'p1', qty: 0 }, { productId: 'p1', qty: -4 }],
    });
    expect(out.result.lines).toBe(1);
    expect(out.result.rejected).toHaveLength(3);
    expect(out.links[0].url).toBe('/account/invoices/new?aiDraft=1');
    expect(drafts.takeInvoice()!.lines).toEqual([{ productId: 'p1', qty: 2 }]);
  });

  it('only offers drafting tools to an employee who may add invoices', () => {
    granted.delete('invoiceSecurity.actions.add.access');
    expect(box.available().map(t => t.def.name)).toEqual(['find_invoices', 'get_invoice', 'find_customers']);
  });
});
