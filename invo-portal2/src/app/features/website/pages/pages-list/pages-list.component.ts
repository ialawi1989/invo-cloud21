import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { BreadcrumbItem } from '@shared/components/breadcrumbs';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';
import { QueryParamsService, StringCodec, type ParamDef } from '@shared/services/query-params.service';
import { withTranslations } from '@core/i18n/with-translations';

import { PageTypeService } from '../../page-types/page-type.service';
import { WebsitePage, WebsitePagesService } from '../services/website-pages.service';

/**
 * Storefront pages.
 *
 * The sidebar has linked `/page-builder` for a while with nothing behind it.
 * This is that screen — and it's the first place the registry is visible to a
 * merchant: every page shows WHAT IT IS (`Product listing`, `Checkout`,
 * `Content page`) rather than being implied by its slug, and a product listing
 * also shows where its products come from.
 *
 * That's the whole point of the refactor made concrete: `menu` and `shop` are
 * two rows of one type, so a merchant can have both, or five, without anyone
 * shipping code.
 */
@Component({
  selector: 'app-website-pages-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListShellComponent, DropdownMenuBtnComponent],
  template: `
    <app-list-shell
      [title]="'WEBSITE.PAGES.TITLE' | translate"
      [subtitle]="'WEBSITE.PAGES.SUBTITLE' | translate"
      [breadcrumbs]="breadcrumbs"
      [search]="search()"
      [searchPlaceholder]="'WEBSITE.PAGES.SEARCH' | translate"
      [loading]="loading()"
      [hasRows]="rows().length > 0"
      (searchChange)="onSearch($event)"
      (searchClear)="onSearch('')">

      <app-dropdown-menu-btn
        shellActions
        [items]="addMenuItems()"
        triggerClass="btn btn-primary"
        align="end"
        [appendToBody]="true">
        {{ 'WEBSITE.PAGES.ADD' | translate }}
      </app-dropdown-menu-btn>

      <table class="wp-table">
        <thead>
          <tr>
            <th>{{ 'WEBSITE.PAGES.COL_NAME' | translate }}</th>
            <th>{{ 'WEBSITE.PAGES.COL_TYPE' | translate }}</th>
            <th>{{ 'WEBSITE.PAGES.COL_SOURCE' | translate }}</th>
            <th>{{ 'WEBSITE.PAGES.COL_URL' | translate }}</th>
            <th class="wp-table__end"></th>
          </tr>
        </thead>
        <tbody>
          @for (page of rows(); track page.id) {
            <tr (click)="edit(page)">
              <td class="wp-name">
                {{ page.name || page.slug }}
                @if (page.isHomePage) {
                  <span class="wp-chip wp-chip--home">{{ 'WEBSITE.PAGES.HOME' | translate }}</span>
                }
              </td>
              <td><span class="wp-chip">{{ typeTitle(page.pageType) }}</span></td>
              <td class="wp-muted">
                @if (page.source) { {{ sourceTitle(page.source.kind) }} } @else { — }
              </td>
              <td class="wp-muted">/{{ page.slug }}</td>
              <td class="wp-table__end" (click)="$event.stopPropagation()">
                <app-dropdown-menu-btn
                  [items]="rowMenu(page)"
                  triggerClass="btn btn-ghost btn-sm"
                  align="end"
                  [appendToBody]="true">⋯</app-dropdown-menu-btn>
              </td>
            </tr>
          }
        </tbody>
      </table>

      @if (!loading() && !rows().length) {
        <p class="wp-empty">{{ 'WEBSITE.PAGES.EMPTY' | translate }}</p>
      }
    </app-list-shell>
  `,
  styles: [`
    .wp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .wp-table th {
      text-align: start; padding: 10px 12px; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .4px; color: #64748b;
      background: #f8fafc; border-bottom: 1px solid #e2e8f0;
    }
    .wp-table td { padding: 11px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .wp-table tbody tr { cursor: pointer; }
    .wp-table tbody tr:hover { background: #f8fafc; }
    .wp-table__end { text-align: end; width: 56px; }
    .wp-name { font-weight: 600; color: #0f172a; }
    .wp-muted { color: #64748b; }
    .wp-chip {
      display: inline-block; padding: 2px 9px; border-radius: 999px;
      background: #e2f6f9; color: #0f7c8c; font-size: 11px; font-weight: 600;
    }
    .wp-chip--home { background: #fef3c7; color: #92400e; margin-inline-start: 8px; }
    .wp-empty { padding: 36px 12px; text-align: center; color: #94a3b8; font-size: 13px; margin: 0; }
  `],
})
export class WebsitePagesListComponent implements OnInit {
  private service  = inject(WebsitePagesService);
  private registry = inject(PageTypeService);
  private router   = inject(Router);
  private toast    = inject(ToastService);
  private modal    = inject(ModalService);
  private translate = inject(TranslateService);
  private queryParams = inject(QueryParamsService);

  loading = signal<boolean>(true);
  search  = signal<string>('');
  private all = signal<WebsitePage[]>([]);

  breadcrumbs: BreadcrumbItem[] = [{ label: 'MENU.WEBSITE_CONTENT' }, { label: 'WEBSITE.PAGES.TITLE' }];

  /** URL-synced search, per the list conventions in this app. */
  private readonly PARAMS = {
    search: { key: 'q', codec: StringCodec } as ParamDef<string>,
  };

  rows = computed<WebsitePage[]>(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.all();
    if (!term) return list;
    return list.filter(p =>
      p.name.toLowerCase().includes(term) || p.slug.toLowerCase().includes(term),
    );
  });

  constructor() { withTranslations('website/page-types'); }

  async ngOnInit(): Promise<void> {
    const state = this.queryParams.read(this.PARAMS);
    this.search.set(String(state.search ?? ''));
    await this.registry.load();
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      this.all.set(await this.service.list());
    } finally {
      this.loading.set(false);
    }
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.queryParams.write(this.PARAMS, { search: value });
  }

  /** "Add page" lists every type the manifest marks `multiple`, so the menu
   *  grows by itself when a type is added server-side. */
  addMenuItems = (): DropdownMenuBtnItem[] =>
    this.registry.multiTypes().map(t => ({
      label: t.title,
      click: () => this.router.navigate(['/page-builder', 'new'], { queryParams: { type: t.id } }),
    }));

  rowMenu = (page: WebsitePage): DropdownMenuBtnItem[] => {
    const items: DropdownMenuBtnItem[] = [
      { label: 'COMMON.ACTIONS.EDIT', click: () => this.edit(page) },
    ];
    if (!page.isHomePage && page.pageType === 'content') {
      items.push({ label: 'WEBSITE.PAGES.SET_HOME', click: () => void this.setHome(page) });
    }
    items.push({ label: 'COMMON.ACTIONS.DELETE', danger: true, click: () => void this.remove(page) });
    return items;
  };

  edit(page: WebsitePage): void {
    if (page.id) void this.router.navigate(['/page-builder', page.id]);
  }

  typeTitle(id: string): string {
    return this.registry.typeDef(id)?.title ?? id;
  }

  sourceTitle(kind: string): string {
    const key = `WEBSITE.PAGE_TYPES.SOURCE_${kind.toUpperCase()}`;
    const translated = this.translate.instant(key);
    return translated === key ? kind : translated;
  }

  private async setHome(page: WebsitePage): Promise<void> {
    if (!page.id) return;
    if (await this.service.setHome(page.id)) {
      this.toast.success('WEBSITE.PAGES.HOME_SET');
      await this.reload();
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
      await this.reload();
    } else {
      this.toast.error('COMMON.DELETE_FAILED');
    }
  }
}
