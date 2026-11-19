import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiService } from '@core/http/api.service';
import { OnDemandCount } from '@shared/components/list-page/utils/on-demand-count';
import { DeferredCount } from '@shared/components/list-page/utils/deferred-count';
import { buildCountBody, buildRootListBody, RootListInput } from './product-list-requests';
import { ProductListService } from './product-list.service';

/**
 * Drives the real list-page state machines with the real Products request builders and service, against a fake API,
 * and asserts on what goes over the wire.
 */
describe('Products list: count modes on the wire', () => {
  let sent: any[];
  let service: ProductListService;
  const input: RootListInput = {
    page: 3, limit: 30, searchTerm: 'milk',
    sortBy: { sortValue: 'name', sortDirection: 'asc' },
    filter: { types: ['inventory'], categoryId: 'c1' },
  };

  beforeEach(() => {
    sent = [];
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        ProductListService,
        { provide: TranslateService, useValue: {} },
        { provide: HttpClient, useValue: {} },
        {
          provide: ApiService,
          useValue: {
            post: (url: string, body: any) => ({ url, body }),
            request: async (r: any) => {
              sent.push(r.body);
              return { success: true, data: r.body.countOnly ? { count: 10581 } : { list: [{ id: 1 }], hasNext: true } };
            },
          },
        },
      ],
    });
    service = TestBed.inject(ProductListService);
  });
  afterEach(() => vi.useRealTimers());

  const sigOf = (p: RootListInput) => JSON.stringify([p.searchTerm || '', p.filter ?? {}]);

  it("'onDemand': the load sends skipCount and NO countOnly request until the button is clicked", async () => {
    const oc = new OnDemandCount<RootListInput>({
      fetch: (p, signal) => service.getProductCount(buildCountBody(p) as any, signal),
      signature: sigOf, currentSignature: () => sigOf(input), onChange: () => {}, sticky: () => true,
    });
    await service.getProductList(buildRootListBody(input, true) as any);
    oc.observe(input);
    expect(sent).toHaveLength(1);
    expect(sent[0].skipCount).toBe(true);
    expect(sent[0].countOnly).toBeUndefined();

    oc.request(input);
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(2);
    const count = sent[1];
    expect(count.countOnly).toBe(true);
    expect(count.searchTerm).toBe('milk');
    expect(count.filter).toEqual(sent[0].filter);                 // same search, filters and type
    expect(count.filter.type).toEqual(['inventory']);
    for (const k of ['page', 'limit', 'sortBy', 'skipCount']) expect(k in count).toBe(false);
    expect(oc.current).toMatchObject({ status: 'known', total: 10581 });
  });

  it("'onDemand': paging, per-page and sort never trigger a count request", async () => {
    const oc = new OnDemandCount<RootListInput>({
      fetch: (p, signal) => service.getProductCount(buildCountBody(p) as any, signal),
      signature: sigOf, currentSignature: () => sigOf(input), onChange: () => {}, sticky: () => true,
    });
    oc.observe(input);
    oc.request(input);
    await vi.advanceTimersByTimeAsync(0);
    const before = sent.length;
    oc.observe({ ...input, page: 4 });
    oc.observe({ ...input, limit: 100 });
    oc.observe({ ...input, sortBy: { sortValue: 'price', sortDirection: 'desc' } });
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent.length).toBe(before);
  });

  it("'auto' (unchanged): the count request goes out with the load, in parallel", async () => {
    const dc = new DeferredCount<RootListInput>({
      enabled: () => true,
      fetch: (p, signal) => service.getProductCount(buildCountBody(p) as any, signal),
      signature: sigOf, currentSignature: () => sigOf(input), onChange: () => {},
    });
    dc.load(input);
    await service.getProductList(buildRootListBody(input, true) as any);
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.filter(b => b.countOnly)).toHaveLength(1);
    expect(sent.filter(b => b.skipCount)).toHaveLength(1);
  });

  it('child groups keep the default response (no skipCount / countOnly)', () => {
    // buildChildrenBody is covered in product-list-requests.spec; this guards that on-demand did not touch it.
    expect(JSON.stringify(buildRootListBody(input, false))).not.toContain('skipCount');
  });
});
