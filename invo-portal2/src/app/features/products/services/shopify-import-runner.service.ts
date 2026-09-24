import { Injectable, inject, signal } from '@angular/core';
import { ProductCrudService } from './product-crud.service';

// ────────────────────────────────────────────────────────────────────
// Mirrors InvoCloudBack's `POST product/importShopifyProducts` contract
// (see InvoCloudBack/docs/shopify-import-frontend.md). One Shopify
// product becomes one ProductMatrix; variants become matrix children.
//
// The server paginates by request, not by cursor: a URL source returns
// `source.pages` on its first page so the loop length is known up
// front; a file upload is chunked client-side into the same shape.
// Re-running the same payload is always safe (import is keyed on
// matrix barcode) — so "resume" is just "call start again", no
// mid-loop checkpoint to persist.
// ────────────────────────────────────────────────────────────────────

export type ShopifyImageMode  = 'link' | 'download';
export type ShopifyOnExisting = 'skip' | 'update';

export interface ShopifyImportOptions {
  branchId:          string | null;
  unitCost:          number;
  importStock:       boolean;
  defaultTax:        boolean;
  departmentName:    string;
  importImages:      boolean;
  imageMode:         ShopifyImageMode;
  onExisting:        ShopifyOnExisting;
  dropTagNamespaces: string[];
}

export function defaultShopifyOptions(): ShopifyImportOptions {
  return {
    branchId:          null,
    unitCost:          0,
    importStock:       true,
    defaultTax:        true,
    departmentName:    '',
    importImages:      true,
    imageMode:         'link',
    onExisting:        'skip',
    dropTagNamespaces: ['keyword', 'parent'],
  };
}

/**
 * Loose on purpose — dry-run vs. real-run items carry different
 * fields (see §4 vs §5 of the backend doc). The named properties are
 * the ones the report UI reads; everything else still comes through
 * via the index signature, just not as a typed property (avoids
 * TS4111 under `noPropertyAccessFromIndexSignature`).
 */
export interface ShopifyReportItem {
  title?:    string;
  handle?:   string;
  barcode?:  string;
  matrixId?: string;
  variants?: number;
  error?:    string;
  warnings?: string[];
  [key: string]: any;
}

export interface ShopifyAggregate {
  summary: {
    imported:           number;
    updated:            number;
    toUpdate:            number;
    variants:            number;
    skipped:             number;
    failed:              number;
    alreadyInCatalogue:  number;
  };
  imported:    ShopifyReportItem[];
  updated:     ShopifyReportItem[];
  willUpdate:  ShopifyReportItem[];
  skipped:     ShopifyReportItem[];
  failed:      ShopifyReportItem[];
  productIds:  string[];
  slugSupport: { products: boolean; matrix: boolean } | null;
}

function emptyAggregate(): ShopifyAggregate {
  return {
    summary: { imported: 0, updated: 0, toUpdate: 0, variants: 0, skipped: 0, failed: 0, alreadyInCatalogue: 0 },
    imported: [], updated: [], willUpdate: [], skipped: [], failed: [], productIds: [],
    slugSupport: null,
  };
}

/** Cap how many rows we keep per bucket — a 1500-product catalogue
 *  dry run doesn't need every row held in memory, just enough to show
 *  the user a representative sample (the counts in `summary` are
 *  never truncated). */
const MAX_ITEMS_PER_BUCKET = 300;

function pushCapped(list: ShopifyReportItem[], items: ShopifyReportItem[] | undefined): void {
  if (!items?.length) return;
  const room = MAX_ITEMS_PER_BUCKET - list.length;
  if (room > 0) list.push(...items.slice(0, room));
}

function mergeAggregate(agg: ShopifyAggregate, data: any): void {
  const s = data?.summary ?? {};
  agg.summary.imported          += s.imported ?? 0;
  agg.summary.updated           += s.updated ?? 0;
  agg.summary.toUpdate          += s.toUpdate ?? 0;
  agg.summary.variants          += s.variants ?? 0;
  agg.summary.skipped           += s.skipped ?? 0;
  agg.summary.failed            += s.failed ?? 0;
  agg.summary.alreadyInCatalogue += s.alreadyInCatalogue ?? 0;
  pushCapped(agg.imported,   data?.imported);
  pushCapped(agg.updated,    data?.updated);
  pushCapped(agg.willUpdate, data?.willUpdate);
  pushCapped(agg.skipped,    data?.skipped);
  pushCapped(agg.failed,     data?.failed);
  if (Array.isArray(data?.productIds)) agg.productIds.push(...data.productIds);
  if (data?.slugSupport) agg.slugSupport = data.slugSupport;
}

export type ShopifyRunnerStatus =
  | 'idle'          // nothing configured yet
  | 'previewing'    // dry-run loop in flight
  | 'preview-ready' // dry-run finished, waiting on "Import Now"
  | 'importing'     // commit loop in flight
  | 'done'          // commit loop finished
  | 'conflict'      // another import (this one or the CSV one) is running
  | 'error';        // a page failed and stopped the loop

export interface ShopifyRunnerState {
  status:        ShopifyRunnerStatus;
  /** Which loop is running / most recently ran — lets the caller
   *  retry the right one after an 'error' or 'conflict'. */
  phase:         'preview' | 'commit' | null;
  currentPage:   number;
  totalPages:    number;
  errorMessage:  string | null;
  conflictProgress: string | null;
  preview:       ShopifyAggregate | null;
  final:         ShopifyAggregate | null;
}

function initialState(): ShopifyRunnerState {
  return {
    status: 'idle', phase: null, currentPage: 0, totalPages: 1,
    errorMessage: null, conflictProgress: null,
    preview: null, final: null,
  };
}

@Injectable({ providedIn: 'root' })
export class ShopifyImportRunnerService {
  private crud = inject(ProductCrudService);

  /** Root-provided singleton, so a run started here keeps going even
   *  if the user navigates away from the page mid-loop — reopening it
   *  just re-subscribes to the same state. */
  private stateSig = signal<ShopifyRunnerState>(initialState());
  readonly state = this.stateSig.asReadonly();

  private sourceUrl: string | null = null;
  private products:  any[]  | null = null;
  private options!:  ShopifyImportOptions;
  private pageSize = 100;
  private cancelled = false;

  isActive(): boolean {
    const s = this.stateSig().status;
    return s === 'previewing' || s === 'importing';
  }

  reset(): void {
    this.cancelled = false;
    this.sourceUrl = null;
    this.products  = null;
    this.stateSig.set(initialState());
  }

  configure(input: { sourceUrl?: string; products?: any[]; options: ShopifyImportOptions }): void {
    this.sourceUrl = input.sourceUrl ?? null;
    this.products  = input.products ?? null;
    this.options   = input.options;
    // Each fetched image costs an HTTP round trip + resize + two S3
    // uploads server-side — keep those requests well inside any
    // load balancer's timeout by shrinking the chunk (see backend
    // doc §7). Link mode is DB-bound, so a full feed page is fine.
    this.pageSize  = this.options.imageMode === 'download' ? 8 : 100;

    const totalPages = this.sourceUrl
      ? 1 // unknown until the first response's `source.pages`
      : Math.max(1, Math.ceil((this.products?.length ?? 0) / this.pageSize));

    this.stateSig.set({ ...initialState(), totalPages });
  }

  /** Checks the shared import lock before starting. Returns the
   *  in-progress percentage if one is running (this screen's own
   *  loop, or the CSV importer's), else null. */
  async preflight(): Promise<string | null> {
    const res = await this.crud.getBulkImportProgress();
    const progress: string | undefined = res?.data?.progress;
    if (progress && progress !== '100%') return progress;
    return null;
  }

  async startPreview(): Promise<void> {
    await this.run('previewing', 'preview-ready', 'preview', true);
  }

  async commit(): Promise<void> {
    await this.run('importing', 'done', 'commit', false);
  }

  /** Retries whichever loop was last attempted — safe because a
   *  re-run always restarts from page 1 and is idempotent. */
  async retry(): Promise<void> {
    if (this.stateSig().phase === 'commit') await this.commit();
    else await this.startPreview();
  }

  cancel(): void {
    this.cancelled = true;
  }

  private async run(
    activeStatus: ShopifyRunnerStatus,
    doneStatus: ShopifyRunnerStatus,
    phase: 'preview' | 'commit',
    dryRun: boolean,
  ): Promise<void> {
    this.cancelled = false;
    const conflict = await this.preflight();
    if (conflict) {
      this.stateSig.update(s => ({ ...s, status: 'conflict', phase, conflictProgress: conflict }));
      return;
    }

    const agg = emptyAggregate();
    let totalPages = this.stateSig().totalPages;
    this.stateSig.update(s => ({ ...s, status: activeStatus, phase, currentPage: 0, errorMessage: null }));

    for (let page = 1; page <= totalPages; page++) {
      if (this.cancelled) break;
      this.stateSig.update(s => ({ ...s, currentPage: page }));

      const payload = this.buildPayload(page, dryRun);
      let res: any;
      try {
        res = await this.crud.importShopifyProducts(payload);
      } catch (e: any) {
        this.stateSig.update(s => ({ ...s, status: 'error', errorMessage: e?.message ?? String(e) }));
        return;
      }

      if (!res?.success) {
        const msg: string = res?.msg || res?.message || 'Import failed.';
        const conflictMatch = /still in progress:\s*(\d+%)/i.exec(msg);
        if (conflictMatch) {
          this.stateSig.update(s => ({ ...s, status: 'conflict', conflictProgress: conflictMatch[1] }));
        } else {
          this.stateSig.update(s => ({ ...s, status: 'error', errorMessage: msg }));
        }
        return;
      }

      const data = res.data;
      if (this.sourceUrl && data?.source?.pages) {
        totalPages = data.source.pages;
        this.stateSig.update(s => ({ ...s, totalPages }));
      }
      mergeAggregate(agg, data);

      const key = dryRun ? 'preview' : 'final';
      this.stateSig.update(s => ({ ...s, [key]: { ...agg } }) as ShopifyRunnerState);
    }

    if (!this.cancelled) {
      this.stateSig.update(s => ({ ...s, status: doneStatus }));
    }
  }

  private buildPayload(page: number, dryRun: boolean): Record<string, any> {
    const options: Record<string, any> = {
      dryRun,
      onExisting:        this.options.onExisting,
      importStock:       this.options.importStock,
      unitCost:          this.options.unitCost,
      defaultTax:        this.options.defaultTax,
      importImages:      this.options.importImages,
      imageMode:         this.options.imageMode,
      dropTagNamespaces: this.options.dropTagNamespaces,
    };
    if (this.options.branchId) options['branchId'] = this.options.branchId;
    if (this.options.departmentName) options['departmentName'] = this.options.departmentName;

    if (this.sourceUrl) {
      return { sourceUrl: this.sourceUrl, options: { ...options, page, pageSize: this.pageSize } };
    }
    const start = (page - 1) * this.pageSize;
    return { products: (this.products ?? []).slice(start, start + this.pageSize), options };
  }
}
