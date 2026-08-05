import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import {
  ListPageComponent,
  ListCellTemplateDirective,
  ListRowActionsDirective,
} from '@shared/components/list-page';
import {
  FilterConfig,
  ListQueryParams,
  MobileCardConfig,
  TableColumn,
} from '@shared/components/list-page/interfaces/list-page.types';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { LanguageService } from '@core/i18n/language.service';

import { PageTypeService } from '../../page-types/page-type.service';
import { WebsitePage, WebsitePagesService } from '../services/website-pages.service';

/**
 * Storefront pages.
 *
 * The sidebar has linked `/page-builder` for a while with nothing behind it.
 * This is that screen — and the first place the page-type registry is visible
 * to a merchant: every page states WHAT IT IS (`Product listing`, `Checkout`,
 * `Content page`) instead of having it implied by the slug, and a listing shows
 * where its products come from.
 *
 * Built on the shared `<app-list-page>` like every other table in the app, so
 * search / paging / sorting / URL state / mobile cards come for free.
 */
@Component({
  selector: 'app-website-pages-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    DropdownMenuBtnComponent,
  ],
  templateUrl: './pages-list.component.html',
})
export class WebsitePagesListComponent implements OnInit {
  private service   = inject(WebsitePagesService);
  private registry  = inject(PageTypeService);
  private router    = inject(Router);
  private toast     = inject(ToastService);
  private modal     = inject(ModalService);
  private translate = inject(TranslateService);
  private lang      = inject(LanguageService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  columns: TableColumn[] = [];
  filters: FilterConfig[] = [];

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig     = { enabled: true, placeholder: '', debounceMs: 300 };
  sortingConfig    = { enabled: true };
  emptyState       = { title: '', message: '' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: 'slug' };

  async ngOnInit(): Promise<void> {
    // Await BOTH before building the config: the column labels come from this
    // feature's translations and the type names from the registry. Reading
    // either too early is what put raw i18n keys in the header.
    await Promise.all([
      this.lang.loadFeature('website/page-types'),
      this.registry.load(),
    ]);
    this.initTranslations();
  }

  private initTranslations(): void {
    const t = (k: string) => this.translate.instant(k);
    this.columns = [
      {
        key: 'name', label: t('WEBSITE.PAGES.COL_NAME'),
        sortable: true, primary: true, locked: true, interactive: true,
        customTemplate: true, visible: true, order: 0,
      },
      {
        key: 'pageType', label: t('WEBSITE.PAGES.COL_TYPE'),
        noApi: true, sortable: false, customTemplate: true, visible: true, order: 1,
      },
      {
        key: 'source', label: t('WEBSITE.PAGES.COL_SOURCE'),
        noApi: true, sortable: false, customTemplate: true, visible: true, order: 2,
      },
      {
        key: 'slug', label: t('WEBSITE.PAGES.COL_URL'),
        sortable: true, customTemplate: true, visible: true, order: 3,
      },
    ];
    this.searchConfig.placeholder = t('WEBSITE.PAGES.SEARCH');
    this.emptyState = { title: t('WEBSITE.PAGES.EMPTY'), message: '' };

    // Dynamic vs Static, as the old page list separated them: a dynamic page is
    // built from sections in the editor; a static one is a system page (menu,
    // checkout, cart…) that only carries settings.
    this.filters = [{
      key: 'kind',
      label: t('WEBSITE.PAGES.KIND'),
      type: 'status',
      defaultValue: 'all',
      options: [
        { label: t('WEBSITE.PAGES.KIND_ALL'),     value: 'all' },
        { label: t('WEBSITE.PAGES.KIND_DYNAMIC'), value: 'dynamic' },
        { label: t('WEBSITE.PAGES.KIND_STATIC'),  value: 'static' },
      ],
    }];
  }

  /**
   * Pages come back as one list — there is no paged endpoint for them, and a
   * storefront has tens of pages, not thousands — so search / sort / paging are
   * applied here to honour the shared table's contract.
   */
  loadPages = async (params: ListQueryParams) => {
    const all = await this.service.list();

    const kind = String(params.filter?.['kind'] ?? 'all');
    let rows = kind === 'all'
      ? all
      : all.filter(p => (kind === 'static' ? p.rowType === 'StaticPage' : p.rowType === 'Page'));

    const term = (params.searchTerm || '').trim().toLowerCase();
    if (term) {
      rows = rows.filter(p =>
        p.name.toLowerCase().includes(term) || p.slug.toLowerCase().includes(term));
    }

    const sort = params.sortBy;
    if (sort?.sortValue) {
      const dir = sort.sortDirection === 'desc' ? -1 : 1;
      const key = sort.sortValue as 'name' | 'slug';
      rows = [...rows].sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * dir);
    }

    const limit = params.limit || 15;
    const page  = params.page  || 1;
    const start = (page - 1) * limit;

    return {
      list:      rows.slice(start, start + limit),
      count:     rows.length,
      pageCount: Math.max(1, Math.ceil(rows.length / limit)),
    };
  };

  onRowClick(event: any): void {
    const row: WebsitePage | undefined = event?.row ?? event;
    if (row?.id) void this.router.navigate(['/page-builder', row.id]);
  }

  addMenuItems = (): DropdownMenuBtnItem[] =>
    this.registry.multiTypes().map(t => ({
      label: t.title,
      click: () => void this.router.navigate(['/page-builder', 'new'], { queryParams: { type: t.id } }),
    }));

  rowMenu = (page: WebsitePage): DropdownMenuBtnItem[] => {
    const items: DropdownMenuBtnItem[] = [
      { label: 'COMMON.ACTIONS.EDIT', click: () => this.onRowClick({ row: page }) },
    ];
    // Only a content page makes sense as a home page — a checkout or a listing
    // as the landing page would be a mistake, not a choice.
    if (!page.isHomePage && page.pageType === 'content') {
      items.push({ label: 'WEBSITE.PAGES.SET_HOME', click: () => void this.setHome(page) });
    }
    items.push({ label: 'COMMON.ACTIONS.DELETE', danger: true, click: () => void this.remove(page) });
    return items;
  };

  typeTitle(id: string): string {
    return this.registry.typeDef(id)?.title ?? id;
  }

  /** `menu` → "Menu", falling back to the raw kind when the key is missing. */
  sourceTitle(kind: string): string {
    const key = `WEBSITE.PAGE_TYPES.SOURCE_${String(kind).toUpperCase()}`;
    const out = this.translate.instant(key);
    return out === key ? kind : out;
  }

  private async setHome(page: WebsitePage): Promise<void> {
    if (!page.id) return;
    if (await this.service.setHome(page.id)) {
      this.toast.success('WEBSITE.PAGES.HOME_SET');
      this.listPage?.refresh();
    } else {
      this.toast.error('COMMON.SAVE_FAILED');
    }
  }

  private async remove(page: WebsitePage): Promise<void> {
    if (!page.id) return;
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(
      ConfirmModalComponent,
      {
        size: 'sm',
        data: {
          title:   this.translate.instant('COMMON.DELETE'),
          message: this.translate.instant('WEBSITE.PAGES.CONFIRM_DELETE', { name: page.name || page.slug }),
          confirm: this.translate.instant('COMMON.DELETE'),
          danger:  true,
        },
      },
    );
    if (!(await ref.afterClosed())) return;

    if (await this.service.remove(page.id)) {
      this.toast.success('COMMON.DELETED_OK');
      this.listPage?.refresh();
    } else {
      this.toast.error('COMMON.DELETE_FAILED');
    }
  }
}
