import {
  Component,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { ListPageComponent } from '@shared/components/list-page/components/list-page.component';
import { ModalService } from '@shared/modal/modal.service';
import {
  DropdownMenuBtnComponent,
  DropdownMenuBtnItem,
} from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import {
  LogsDrawerComponent,
  LogsDrawerData,
} from '@shared/components/logs-drawer/logs-drawer.component';
import {
  ListCellTemplateDirective,
  ListRowActionsDirective,
  ListRowDetailDirective,
} from '@shared/components/list-page/directives/list-template.directives';
import { PrepRecipePanelComponent } from '../../components/prep-recipe-panel/prep-recipe-panel.component';
import {
  TableColumn,
  ListQueryParams,
  MobileCardConfig,
} from '@shared/components/list-page/interfaces/list-page.types';

import { RecipeService, RecipeListRow } from '../../services/recipe.service';

/**
 * Brands list — shared `<app-list-page>`. Ported from InvoCloudFront2's
 * `brands.component` (single Name column). Brands cannot be deleted in this
 * app, so the row offers Edit only (hover-revealed). URL `/products/recipe`.
 */
@Component({
  selector: 'app-recipes-list',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ListPageComponent,
    ListCellTemplateDirective,
    ListRowActionsDirective,
    ListRowDetailDirective,
    DropdownMenuBtnComponent,
    PrepRecipePanelComponent,
  ],
  templateUrl: './recipes-list.component.html',
  styleUrl: './recipes-list.component.scss',
})
export class RecipesListComponent implements OnInit {
  private service = inject(RecipeService);
  private router = inject(Router);
  private lang = inject(LanguageService);
  private privileges = inject(PrivilegeService);
  private modal = inject(ModalService);

  @ViewChild(ListPageComponent) listPage?: ListPageComponent;

  readonly canAdd = this.privileges.check('recipeSecurity.actions.add.access');
  readonly canEdit = this.canAdd;

  /** Header "⋯" menu. */
  readonly moreMenuItems: DropdownMenuBtnItem[] = [
    { label: 'COMMON.LOGS.SHOW', click: () => this.openLogs() },
  ];

  /** Activity log — the legacy entity key for recipes is 'Recipe'. */
  openLogs(): void {
    this.modal.open<LogsDrawerComponent, LogsDrawerData, void>(LogsDrawerComponent, {
      drawer: true,
      drawerWidth: '480px',
      drawerResizable: true,
      data: {
        sourceTable: 'Recipe',
        title: this.lang.instant('PRODUCTS.RECIPES.TITLE'),
      },
    });
  }

  columns: TableColumn[] = [];

  breadcrumbs = [
    { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
    { label: '', routerLink: '/products/recipe' },
  ];

  paginationConfig = { enabled: true, pageLimits: [15, 25, 50, 100], default: 15 };
  searchConfig = { enabled: true, placeholder: '', debounceMs: 500 };
  sortingConfig = { enabled: true };
  emptyState = { title: '', message: '' };
  mobileCardConfig: MobileCardConfig = { showThumbnail: false, metricKeys: [], secondaryKey: '' };

  async ngOnInit(): Promise<void> {
    await this.lang.loadFeature('products');
    this.initTranslations();
  }

  private initTranslations(): void {
    this.columns = [
      {
        key: 'name',
        label: this.lang.instant('PRODUCTS.RECIPES.COL_NAME'),
        sortable: true,
        primary: true,
        locked: true,
        interactive: true,
        customTemplate: true,
        visible: true,
        order: 0,
      },
    ];
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home' as const, iconOnly: true },
      { label: this.lang.instant('PRODUCTS.RECIPES.TITLE'), routerLink: '/products/recipe' },
    ];
    this.searchConfig.placeholder = this.lang.instant('PRODUCTS.RECIPES.SEARCH_PLACEHOLDER');
    this.emptyState = { title: this.lang.instant('PRODUCTS.RECIPES.EMPTY'), message: '' };
  }

  loadRecipes = async (params: ListQueryParams) => {
    const data = await this.service.getList({
      page: params.page,
      limit: params.limit,
      searchTerm: params.searchTerm || '',
      sortBy: params.sortBy
        ? { sortValue: params.sortBy.sortValue, sortDirection: params.sortBy.sortDirection }
        : {},
    });
    return { list: data.list, count: data.count, pageCount: data.pageCount };
  };

  onRowClick(event: any): void {
    if (event?.row) this.edit(event.row);
  }

  edit(row: RecipeListRow): void {
    void this.router.navigate(['/products/recipe', row.id]);
  }

  add(): void {
    void this.router.navigate(['/products/recipe/new']);
  }
}
