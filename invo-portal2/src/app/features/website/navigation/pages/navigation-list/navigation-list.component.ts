import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { BreadcrumbItem } from '@shared/components/breadcrumbs';
import { ToastService } from '@shared/components/toast/toast.service';
import { QueryParamsService, StringCodec, type ParamDef } from '@shared/services/query-params.service';
import { withTranslations } from '@core/i18n/with-translations';

import { NavigationService } from '../../services/navigation.service';
import { Website } from '../../../models/website.model';

interface MenuRow {
  id: string;
  name: string;
  /** 'primary' | 'footer' | 'mobile' — drives the location chip + routing. */
  kind: 'primary' | 'footer' | 'mobile';
  itemCount: number;
}

const QP = {
  search: { key: 'q', codec: StringCodec } as ParamDef<string>,
};

@Component({
  selector: 'app-navigation-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, ListShellComponent, DropdownMenuBtnComponent],
  template: `
    <app-list-shell
      [title]="'NAV.LIST.TITLE' | translate"
      [subtitle]="'NAV.LIST.SUBTITLE' | translate"
      [breadcrumbs]="breadcrumbs"
      [search]="search()"
      [searchPlaceholder]="'NAV.LIST.SEARCH' | translate"
      [loading]="loading()"
      [hasRows]="filtered().length > 0"
      [hideCard]="false"
      [cardFlush]="true"
      (searchChange)="onSearch($event)"
      (searchClear)="onSearch('')">

      <button shellActions type="button" class="btn btn-primary" (click)="addMenu()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ 'NAV.LIST.ADD' | translate }}
      </button>

      <div shellEmpty class="empty">
        <h3>{{ 'NAV.LIST.EMPTY_TITLE' | translate }}</h3>
        <p>{{ 'NAV.LIST.EMPTY_SUB' | translate }}</p>
        <button type="button" class="btn btn-primary" (click)="addMenu()">{{ 'NAV.LIST.ADD' | translate }}</button>
      </div>

      <table class="nav-table">
        <thead>
          <tr>
            <th>{{ 'NAV.LIST.COL_NAME' | translate }}</th>
            <th>{{ 'NAV.LIST.COL_LOCATION' | translate }}</th>
            <th>{{ 'NAV.LIST.COL_ITEMS' | translate }}</th>
            <th class="actions-col"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of filtered(); track row.id + row.kind) {
            <tr (click)="open(row)">
              <td class="name-cell">{{ row.name }}</td>
              <td>
                <span class="chip" [class.chip-footer]="row.kind === 'footer'" [class.chip-mobile]="row.kind === 'mobile'">
                  {{ ('NAV.LOCATION.' + row.kind) | translate }}
                </span>
              </td>
              <td>{{ row.kind === 'mobile' ? '—' : row.itemCount }}</td>
              <td class="actions-col" (click)="$event.stopPropagation()">
                <app-dropdown-menu-btn
                  [items]="rowMenu(row)"
                  [appendToBody]="true"
                  [chevron]="false"
                  align="end"
                  triggerClass="icon-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/>
                  </svg>
                </app-dropdown-menu-btn>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </app-list-shell>
  `,
  styles: [`
    :host { display:block; }
    .nav-table { width:100%; border-collapse:collapse; font-size:14px; }
    .nav-table th { text-align:left; font-weight:600; color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:.04em; padding:12px 16px; border-bottom:1px solid #e2e8f0; }
    .nav-table td { padding:14px 16px; border-bottom:1px solid #f1f5f9; color:#334155; }
    .nav-table tbody tr { cursor:pointer; transition:background .12s; }
    .nav-table tbody tr:hover { background:#f8fafc; }
    .name-cell { font-weight:600; color:#0f172a; }
    .actions-col { width:48px; text-align:right; }
    .chip { display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:500; background:color-mix(in srgb, var(--color-brand-100), transparent 20%); color:var(--color-brand-700); }
    .chip-footer { background:#f1f5f9; color:#475569; }
    .chip-mobile { background:#fef3c7; color:#92400e; }
    .icon-btn { width:30px; height:30px; border:none; background:transparent; border-radius:6px; color:#94a3b8; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
    .icon-btn:hover { background:#f1f5f9; color:#334155; }
    .btn { display:inline-flex; align-items:center; gap:7px; height:38px; padding:0 18px; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; border:none; }
    .btn-primary { background:var(--color-brand-600); color:#fff; }
    .btn-primary:hover { background:var(--color-brand-700); }
    .empty { text-align:center; padding:80px 20px; }
    .empty h3 { font-size:18px; font-weight:700; color:#0f172a; margin:0 0 8px; }
    .empty p { font-size:14px; color:#94a3b8; margin:0 0 24px; }
  `],
})
export class NavigationListComponent implements OnInit {
  private nav     = inject(NavigationService);
  private router  = inject(Router);
  private toast   = inject(ToastService);
  private qp      = inject(QueryParamsService);
  private translate = inject(TranslateService);

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
    { label: 'Website', routerLink: '/website' },
    { label: 'Navigation' },
  ];

  loading = signal(true);
  search  = signal('');
  private rows = signal<MenuRow[]>([]);

  filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    const list = this.rows();
    if (!q) return list;
    return list.filter(r => r.name.toLowerCase().includes(q));
  });

  constructor() { withTranslations('website/navigation'); }

  ngOnInit(): void {
    this.search.set(this.qp.read(QP).search);
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [menus, mobileBar] = await Promise.all([
        this.nav.listMenus(),
        this.nav.getMobileIconBar(),
      ]);

      const rows: MenuRow[] = menus.map(m => ({
        id: String(m.id),
        name: m.name || this.translate.instant('NAV.LIST.UNTITLED'),
        kind: m.isFooterMenu ? 'footer' : 'primary',
        itemCount: m.template?.list?.length ?? 0,
      }));

      // Synthetic Mobile Icon Bar row — always present, routes to its
      // dedicated config (matches the legacy `appendMobileIconBar`).
      rows.unshift({
        id: mobileBar ? String(mobileBar.id) : 'new',
        name: this.translate.instant('NAV.LIST.MOBILE_BAR'),
        kind: 'mobile',
        itemCount: 0,
      });

      this.rows.set(rows);
    } catch (e: any) {
      this.toast.error('NAV.LIST.LOAD_FAILED', e?.message);
    } finally {
      this.loading.set(false);
    }
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.qp.write(QP, { search: value });
  }

  open(row: MenuRow): void {
    if (row.kind === 'mobile') {
      this.router.navigate(['/mobile-icon-bar', row.id]);
    } else {
      this.router.navigate(['/navigation-list', row.id]);
    }
  }

  addMenu(): void {
    this.router.navigate(['/navigation-list', 0]);
  }

  rowMenu(row: MenuRow): DropdownMenuBtnItem[] {
    if (row.kind === 'mobile') {
      return [{ label: this.translate.instant('NAV.LIST.CONFIGURE'), click: () => this.open(row) }];
    }
    return [
      { label: this.translate.instant('COMMON.EDIT'), click: () => this.open(row) },
      { label: '', click: () => {}, separator: true },
      { label: this.translate.instant('COMMON.DELETE'), click: () => this.remove(row), danger: true },
    ];
  }

  async remove(row: MenuRow): Promise<void> {
    if (!confirm(this.translate.instant('NAV.LIST.DELETE_CONFIRM', { name: row.name }))) return;
    try {
      await this.nav.deleteMenu(row.id);
      this.rows.update(list => list.filter(r => !(r.id === row.id && r.kind === row.kind)));
      this.toast.success('NAV.LIST.DELETED');
    } catch (e: any) {
      this.toast.error('NAV.LIST.DELETE_FAILED', e?.message);
    }
  }
}
