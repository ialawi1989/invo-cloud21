import { DocFetch, DocFetchOpts, DocFetchResult } from './doc-views.types';

export type DocListQuery = { searchTerm?: string; sortBy?: any; filter?: Record<string, any> };

/**
 * Builds the `fetch` the board / calendar use from a list page's own pieces:
 * its latest search / sort / filters, its request-body builder and its API call.
 * Per-view overrides (status of a column, week range) are applied on top, so the
 * views can never disagree with the list about what the filters mean.
 */
export function makeDocViewFetch(deps: {
  query:     () => DocListQuery;
  buildBody: (q: DocListQuery) => any;
  fetch:     (body: any) => Promise<any>;
}): DocFetch {
  return async (o: DocFetchOpts): Promise<DocFetchResult> => {
    const body = deps.buildBody(deps.query());
    if (o.status) {
      const chosen: string[] = body.filter.status ?? [];
      const statuses = chosen.length ? o.status.filter(s => chosen.includes(s)) : o.status;
      if (!statuses.length) return { list: [], count: 0, pageCount: 0 };
      body.filter.status = statuses;
    }
    if (o.fromDate) body.filter.fromDate = o.fromDate;
    if (o.toDate) body.filter.toDate = o.toDate;
    const data = await deps.fetch({ page: o.page, limit: o.limit, ...body });
    return { list: data?.list ?? [], count: data?.count ?? 0, pageCount: data?.pageCount ?? 0 };
  };
}
