import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ListShellComponent } from '@shared/components/list-shell/list-shell.component';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { BreadcrumbItem } from '@shared/components/breadcrumbs';
import { ToastService } from '@shared/components/toast/toast.service';
import { QueryParamsService, StringCodec, type ParamDef } from '@shared/services/query-params.service';
import { withTranslations } from '@core/i18n/with-translations';

import { NavigationService } from '../../services/navigation.service';
import { iconsForSlug } from '../mobile-icon-bar/mobile-icon-bar.icons';

interface MenuRow {
  id: string;
  name: string;
  /** 'primary' | 'footer' — drives the location chip. */
  kind: 'primary' | 'footer';
  itemCount: number;
}

/** Snapshot of the (singleton) mobile icon bar for its summary card. */
interface MobileBarSummary {
  id: string;
  enabled: number;
  icons: SafeHtml[];
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
      [hasRows]="!loading()"
      [hideCard]="true"
      (searchChange)="onSearch($event)"
      (searchClear)="onSearch('')">

      <button shellActions type="button" class="btn btn-primary" (click)="addMenu()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        {{ 'NAV.LIST.ADD' | translate }}
      </button>

      <!-- ── Mobile Icon Bar — its own summary card (singleton config) ── -->
      @if (mobileBar(); as mb) {
        <section class="mib-card" (click)="openMobileBar()">
          <div class="mib-main">
            <span class="mib-badge" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
            </span>
            <div class="mib-text">
              <h2 class="mib-title">{{ 'NAV.LIST.MOBILE_BAR' | translate }}</h2>
              <p class="mib-desc">{{ 'NAV.LIST.MOBILE_BAR_DESC' | translate }}</p>
            </div>
            <span class="mib-count" [class.full]="mb.enabled >= MOBILE_MAX">{{ mb.enabled }}/{{ MOBILE_MAX }}</span>
          </div>
          <div class="mib-foot">
            <div class="mib-preview">
              @for (ic of mb.icons; track $index) {
                <span class="mib-ico" [innerHTML]="ic"></span>
              } @empty {
                <span class="mib-empty">{{ 'NAV.LIST.MOBILE_BAR_EMPTY' | translate }}</span>
              }
            </div>
            <button type="button" class="btn btn-outline" (click)="openMobileBar(); $event.stopPropagation()">
              {{ 'NAV.LIST.CONFIGURE' | translate }}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </section>
      }

      <!-- ── Menus — the list of header / footer navigations ── -->
      <section class="menus-card">
        <div class="menus-head">
          <h2 class="menus-title">{{ 'NAV.LIST.MENUS' | translate }}</h2>
        </div>

        @if (filtered().length) {
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
                    <span class="chip" [class.chip-footer]="row.kind === 'footer'">
                      {{ ('NAV.LOCATION.' + row.kind) | translate }}
                    </span>
                  </td>
                  <td>{{ row.itemCount }}</td>
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
        } @else {
          <div class="menus-empty">
            <p>{{ (search() ? 'NAV.LIST.NO_MATCH' : 'NAV.LIST.EMPTY_SUB') | translate }}</p>
            @if (!search()) {
              <button type="button" class="btn btn-primary" (click)="addMenu()">{{ 'NAV.LIST.ADD' | translate }}</button>
            }
          </div>
        }
      </section>
    </app-list-shell>
  `,
  styles: [`
    :host { display:block; }

    /* ── Mobile Icon Bar card ── */
    .mib-card { border:1px solid #e2e8f0; border-radius:12px; background:#fff; padding:18px 20px; margin-bottom:20px; cursor:pointer; transition:border-color .12s, box-shadow .12s; }
    .mib-card:hover { border-color:#cbd5e1; box-shadow:0 4px 14px rgba(15,23,42,.05); }
    .mib-main { display:flex; align-items:flex-start; gap:14px; }
    .mib-badge { width:40px; height:40px; border-radius:10px; background:color-mix(in srgb, var(--color-brand-100), transparent 30%); color:var(--color-brand-700); display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto; }
    .mib-text { flex:1; min-width:0; }
    .mib-title { margin:0; font-size:16px; font-weight:700; color:#0f172a; }
    .mib-desc { margin:2px 0 0; font-size:13px; color:#64748b; }
    .mib-count { flex:0 0 auto; font-size:12px; font-weight:600; color:#64748b; padding:4px 10px; border-radius:999px; background:#f1f5f9; }
    .mib-count.full { background:#fef3c7; color:#92400e; }
    .mib-foot { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:14px; padding-top:14px; border-top:1px solid #f1f5f9; flex-wrap:wrap; }
    .mib-preview { display:flex; align-items:center; gap:8px; flex-wrap:wrap; min-height:34px; }
    .mib-ico { width:34px; height:34px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc; color:#475569; display:inline-flex; align-items:center; justify-content:center; }
    .mib-ico ::ng-deep svg { width:18px; height:18px; }
    .mib-empty { font-size:13px; color:#94a3b8; }

    /* ── Menus card ── */
    .menus-card { border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden; }
    .menus-head { padding:14px 16px; border-bottom:1px solid #f1f5f9; }
    .menus-title { margin:0; font-size:15px; font-weight:700; color:#0f172a; }
    .menus-empty { padding:48px 20px; text-align:center; }
    .menus-empty p { margin:0 0 16px; font-size:14px; color:#94a3b8; }

    .nav-table { width:100%; border-collapse:collapse; font-size:14px; }
    .nav-table th { text-align:left; font-weight:600; color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:.04em; padding:12px 16px; border-bottom:1px solid #e2e8f0; }
    .nav-table td { padding:14px 16px; border-bottom:1px solid #f1f5f9; color:#334155; }
    .nav-table tbody tr:last-child td { border-bottom:none; }
    .nav-table tbody tr { cursor:pointer; transition:background .12s; }
    .nav-table tbody tr:hover { background:#f8fafc; }
    .name-cell { font-weight:600; color:#0f172a; }
    .actions-col { width:48px; text-align:right; }
    .chip { display:inline-flex; align-items:center; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:500; background:color-mix(in srgb, var(--color-brand-100), transparent 20%); color:var(--color-brand-700); }
    .chip-footer { background:#f1f5f9; color:#475569; }
    .icon-btn { width:30px; height:30px; border:none; background:transparent; border-radius:6px; color:#94a3b8; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
    .icon-btn:hover { background:#f1f5f9; color:#334155; }

    .btn { display:inline-flex; align-items:center; gap:7px; height:38px; padding:0 18px; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; border:none; }
    .btn-primary { background:var(--color-brand-600); color:#fff; }
    .btn-primary:hover { background:var(--color-brand-700); }
    .btn-outline { background:#fff; border:1px solid #e2e8f0; color:#334155; height:36px; padding:0 14px; }
    .btn-outline:hover { background:#f8fafc; border-color:#cbd5e1; }
  `],
})
export class NavigationListComponent implements OnInit {
  private nav       = inject(NavigationService);
  private router    = inject(Router);
  private toast     = inject(ToastService);
  private qp        = inject(QueryParamsService);
  private translate = inject(TranslateService);
  private sanitizer = inject(DomSanitizer);

  readonly MOBILE_MAX = 5;

  readonly breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
    { label: 'Website', routerLink: '/website' },
    { label: 'Navigation' },
  ];

  loading = signal(true);
  search  = signal('');
  mobileBar = signal<MobileBarSummary | null>(null);
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
      const [menus, bar] = await Promise.all([
        this.nav.listMenus(),
        this.nav.getMobileIconBar(),
      ]);

      this.rows.set(menus.map(m => ({
        id: String(m.id),
        name: m.name || this.translate.instant('NAV.LIST.UNTITLED'),
        kind: m.isFooterMenu ? 'footer' : 'primary',
        itemCount: m.template?.list?.length ?? 0,
      })));

      // Mobile icon bar summary (singleton) — enabled shortcuts + their icons.
      const items: any[] = bar?.template?.list ?? [];
      const enabled = items.filter(i => i.enabled);
      this.mobileBar.set({
        id: bar ? String(bar.id) : 'new',
        enabled: enabled.length,
        icons: enabled
          .slice(0, this.MOBILE_MAX)
          .map(i => this.sanitizer.bypassSecurityTrustHtml(i.icon || iconsForSlug(i.slug)[0])),
      });
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
    this.router.navigate(['/navigation-list', row.id]);
  }

  openMobileBar(): void {
    this.router.navigate(['/mobile-icon-bar', this.mobileBar()?.id ?? 'new']);
  }

  addMenu(): void {
    this.router.navigate(['/navigation-list', 0]);
  }

  rowMenu(row: MenuRow): DropdownMenuBtnItem[] {
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
