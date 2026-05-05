import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { withTranslations } from '@core/i18n/with-translations';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { MenuBuilderService } from '../../services/menu-builder.service';
import { MenuListItem } from '../../services/menu-builder.types';

/**
 * Menu Builder → list page.
 *
 * Searchable, paginated table of menus. Click a row to open the
 * full-page builder. Add-new also opens the builder. Same conventions
 * as the kitchen-sections list (signals + OnPush + breadcrumbs +
 * inline pager, no external table lib).
 */
@Component({
  selector: 'app-menu-builder-list',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, BreadcrumbsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-builder-list.component.html',
  styleUrl: './menu-builder-list.component.scss',
})
export class MenuBuilderListComponent implements OnInit {
  private service    = inject(MenuBuilderService);
  private translate  = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router     = inject(Router);

  loading = signal<boolean>(false);
  rows    = signal<MenuListItem[]>([]);
  total   = signal<number>(0);

  search   = signal<string>('');
  page     = signal<number>(1);
  pageSize = signal<number>(20);

  /** Tick so computed labels re-evaluate when ngx-translate finishes. */
  private i18nTick = signal(0);

  private debounce?: ReturnType<typeof setTimeout>;

  breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.i18nTick();
    // The page lives under Settings, so the trail is
    // Settings → Menu Builder rather than Home → Menu Builder.
    return [
      { label: this.translate.instant('SETTINGS.TITLE'), routerLink: '/settings' },
      { label: this.translate.instant('MENU_BUILDER.TITLE') },
    ];
  });

  pageCount = computed<number>(() => {
    const total = this.total();
    const limit = this.pageSize();
    return total > 0 ? Math.ceil(total / limit) : 1;
  });

  rangeLabel = computed<string>(() => {
    this.i18nTick();
    const total = this.total();
    if (total === 0) return '';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end   = Math.min(this.page() * this.pageSize(), total);
    return this.translate.instant('COMMON.PAGINATION_RANGE', { start, end, total });
  });

  constructor() {
    withTranslations('menu-builder');
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.service.getList({
        page:   this.page(),
        limit:  this.pageSize(),
        search: this.search().trim(),
      });
      this.rows.set(res.list);
      this.total.set(res.total);
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Search + paging ───────────────────────────────────────────────────
  onSearchInput(value: string): void {
    this.search.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 300);
  }

  clearSearch(): void {
    this.search.set('');
    this.page.set(1);
    this.load();
  }

  goPrev(): void {
    if (this.page() <= 1) return;
    this.page.update((p) => p - 1);
    this.load();
  }

  goNext(): void {
    if (this.page() >= this.pageCount()) return;
    this.page.update((p) => p + 1);
    this.load();
  }

  // ─── Navigation ────────────────────────────────────────────────────────
  edit(row: MenuListItem): void {
    this.router.navigate(['/settings/menu-builder', row.id]);
  }

  addNew(): void {
    this.router.navigate(['/settings/menu-builder', 'new']);
  }

  // Delete intentionally not wired — backend exposes no `deleteMenu`
  // route yet. When it does, add a button in the list HTML and call
  // `MenuBuilderService.deleteMenu(id)` from here.
}
