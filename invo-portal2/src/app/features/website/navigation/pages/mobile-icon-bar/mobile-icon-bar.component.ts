import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

import { BreadcrumbsComponent, BreadcrumbItem } from '@shared/components/breadcrumbs';
import { SpinnerComponent } from '@shared/components/spinner';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { TranslationModalComponent, TranslationModalData, TranslationLang } from '@shared/components/translation-modal/translation-modal.component';
import { withTranslations } from '@core/i18n/with-translations';

import { NavigationService } from '../../services/navigation.service';
import { Website } from '../../../models/website.model';
import { MobileIconBarList, MobileIconBarItem } from '../../../models/mobileIconBar';
import { Translation } from '@core/models/translation';

/** Default item set, mirroring the legacy `setItems()`. */
const DEFAULT_ITEMS: Array<{ name: string; en: string; ar: string; slug: string; enabled: boolean }> = [
  { name: 'Search',     en: 'Search',     ar: 'بحث',          slug: 'search',           enabled: false },
  { name: 'To Top',     en: 'To Top',     ar: 'إلى الأعلى',    slug: 'toTop',            enabled: false },
  { name: 'Home',       en: 'Home',       ar: 'الرئيسية',      slug: '/',                enabled: true },
  { name: 'Categories', en: 'Categories', ar: 'الأقسام',       slug: 'categories',       enabled: true },
  { name: 'Wishlist',   en: 'Wishlist',   ar: 'المفضلة',       slug: 'wishlist',         enabled: true },
  { name: 'Cart',       en: 'Cart',       ar: 'السلة',         slug: 'cart',             enabled: true },
  { name: 'Profile',    en: 'Account',    ar: 'الحساب',        slug: 'account',          enabled: true },
  { name: 'Menu',       en: 'Menu',       ar: 'قائمة الطعام',  slug: 'menu',             enabled: false },
  { name: 'Store',      en: 'Store',      ar: 'المتجر',        slug: 'shop',             enabled: false },
  { name: 'Orders',     en: 'Orders',     ar: 'الطلبات',       slug: 'my-orders',        enabled: false },
  { name: 'Bookings',   en: 'Bookings',   ar: 'الحجوزات',      slug: 'appointments',     enabled: false },
];

@Component({
  selector: 'app-mobile-icon-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, TranslateModule, BreadcrumbsComponent, SpinnerComponent],
  template: `
    <app-breadcrumbs [items]="breadcrumbs" navClass="mb-2" />

    @if (loading()) {
      <div class="loading"><app-spinner size="sm" /> {{ 'COMMON.LOADING' | translate }}</div>
    } @else {
      <div class="head">
        <div>
          <h1 class="title">{{ 'NAV.MOBILE.TITLE' | translate }}</h1>
          <p class="sub">{{ 'NAV.MOBILE.SUBTITLE' | translate: { max: MAX } }}</p>
        </div>
        <div class="actions">
          <span class="count" [class.full]="enabledCount() >= MAX">{{ enabledCount() }}/{{ MAX }}</span>
          <button type="button" class="btn btn-outline" (click)="cancel()">{{ 'COMMON.CANCEL' | translate }}</button>
          <button type="button" class="btn btn-primary" (click)="save()" [disabled]="saving()">
            @if (saving()) { <app-spinner size="sm" /> }
            {{ 'COMMON.SAVE' | translate }}
          </button>
        </div>
      </div>

      <div class="list" cdkDropList [cdkDropListData]="bar.template.list" (cdkDropListDropped)="onDrop($event)">
        @for (item of bar.template.list; track item.uId) {
          <div class="row" cdkDrag [cdkDragData]="item" [class.off]="!item.enabled">
            <span class="drag" cdkDragHandle>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
            </span>

            <div class="icon-choices">
              @for (icon of iconsFor(item); track $index) {
                <button type="button" class="icon-swatch" [class.selected]="item.icon === icon"
                        [innerHTML]="sanitize(icon)" (click)="item.icon = icon"></button>
              }
            </div>

            <span class="row-name">{{ item.name }}</span>

            <div class="row-tools">
              <button type="button" class="tool" (click)="translateName(item)" [title]="'NAV.BUILDER.TRANSLATE' | translate">文</button>
              <button type="button" class="toggle" [class.on]="item.enabled"
                      [disabled]="eyeDisabled(item)" (click)="toggle(item)"
                      [title]="eyeTooltip(item)">
                @if (item.enabled) {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                } @else {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                }
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display:block; }
    .loading { display:flex; align-items:center; gap:10px; justify-content:center; padding:80px 0; color:#94a3b8; font-size:14px; }
    .head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:22px; flex-wrap:wrap; }
    .title { font-size:22px; font-weight:700; color:#0f172a; margin:0 0 4px; }
    .sub { font-size:14px; color:#64748b; margin:0; }
    .actions { display:flex; align-items:center; gap:10px; }
    .count { font-size:13px; font-weight:600; color:#64748b; padding:4px 10px; border-radius:999px; background:#f1f5f9; }
    .count.full { background:#fef3c7; color:#92400e; }
    .btn { display:inline-flex; align-items:center; gap:7px; height:38px; padding:0 18px; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; border:none; }
    .btn-primary { background:var(--color-brand-600); color:#fff; }
    .btn-primary:hover { background:var(--color-brand-700); }
    .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
    .btn-outline { background:#fff; border:1px solid #e2e8f0; color:#334155; }
    .list { display:flex; flex-direction:column; gap:8px; max-width:680px; }
    .row { display:flex; align-items:center; gap:12px; padding:10px 14px; border:1px solid #e2e8f0; border-radius:10px; background:#fff; transition:.12s; }
    .row.off { background:#f8fafc; opacity:.75; }
    .drag { cursor:grab; color:#cbd5e1; display:inline-flex; }
    .icon-choices { display:flex; gap:6px; }
    .icon-swatch { width:36px; height:36px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; color:#475569; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:0; }
    .icon-swatch.selected { border-color:var(--color-brand-500); background:color-mix(in srgb, var(--color-brand-100), transparent 40%); color:var(--color-brand-700); }
    .icon-swatch svg { width:20px; height:20px; }
    .row-name { flex:1; font-size:14px; font-weight:500; color:#0f172a; }
    .row-tools { display:flex; align-items:center; gap:4px; }
    .tool { width:30px; height:30px; border:none; background:transparent; border-radius:6px; cursor:pointer; color:#64748b; font-size:14px; display:inline-flex; align-items:center; justify-content:center; }
    .tool:hover { background:#f1f5f9; color:#0f172a; }
    .toggle { width:34px; height:30px; border:none; background:transparent; border-radius:6px; cursor:pointer; color:#94a3b8; display:inline-flex; align-items:center; justify-content:center; }
    .toggle.on { color:var(--color-brand-600); }
    .toggle:disabled { opacity:.35; cursor:not-allowed; }
    .cdk-drag-preview { box-shadow:0 8px 24px rgba(0,0,0,.15); border-radius:10px; }
    .cdk-drag-placeholder { opacity:.4; }
  `],
})
export class MobileIconBarComponent implements OnInit {
  private nav       = inject(NavigationService);
  private router    = inject(Router);
  private toast     = inject(ToastService);
  private modal     = inject(ModalService);
  private translate = inject(TranslateService);

  readonly MAX = 5;
  private readonly excluded = ['/', 'cart', 'account'];

  loading = signal(true);
  saving  = signal(false);
  bar!: Website;

  breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
    { label: 'Website', routerLink: '/website' },
    { label: 'Navigation', routerLink: '/navigation-list' },
    { label: 'Mobile Icon Bar' },
  ];

  constructor() { withTranslations('website/navigation'); }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const existing = await this.nav.getMobileIconBar();
      this.bar = existing ?? this.blank();
    } catch {
      this.bar = this.blank();
    }
    if (!(this.bar.template instanceof MobileIconBarList) || !this.bar.template.list?.length) {
      const t = new MobileIconBarList();
      t.ParseJson(this.bar.template ?? {});
      if (!t.list.length) t.list = this.defaultItems();
      this.bar.template = t;
    }
    // Ensure every item has a selected icon.
    this.bar.template.list.forEach((it: MobileIconBarItem) => {
      const icons = this.iconsFor(it);
      if (!it.icon && icons.length) it.icon = icons[0];
    });
    this.loading.set(false);
  }

  private blank(): Website {
    const w = new Website();
    w.name = 'Mobile Icon Bar';
    w.type = 'MobileIconBar';
    const t = new MobileIconBarList();
    t.list = this.defaultItems();
    w.template = t;
    return w;
  }

  private defaultItems(): MobileIconBarItem[] {
    return DEFAULT_ITEMS.map((d, i) => {
      const it = new MobileIconBarItem();
      it.index = i;
      it.name = d.name;
      it.slug = d.slug;
      it.enabled = d.enabled;
      it.translation = new Translation();
      it.translation.title.en = d.en;
      it.translation.title.ar = d.ar;
      return it;
    });
  }

  enabledCount(): number {
    return this.bar?.template?.list?.filter((i: MobileIconBarItem) => i.enabled).length ?? 0;
  }

  canEnable(item: MobileIconBarItem): boolean {
    return item.enabled || this.enabledCount() < this.MAX;
  }

  eyeDisabled(item: MobileIconBarItem): boolean {
    return !item.enabled && !this.canEnable(item);
  }

  eyeTooltip(item: MobileIconBarItem): string {
    if (item.enabled) return this.translate.instant('NAV.MOBILE.DISABLE');
    return this.canEnable(item)
      ? this.translate.instant('NAV.MOBILE.ENABLE')
      : this.translate.instant('NAV.MOBILE.LIMIT', { max: this.MAX });
  }

  toggle(item: MobileIconBarItem): void {
    if (item.enabled) { item.enabled = false; return; }
    if (this.canEnable(item)) { item.enabled = true; }
    else { this.toast.warning('NAV.MOBILE.LIMIT', this.translate.instant('NAV.MOBILE.LIMIT', { max: this.MAX })); }
  }

  onDrop(event: CdkDragDrop<MobileIconBarItem[]>): void {
    moveItemInArray(this.bar.template.list, event.previousIndex, event.currentIndex);
    this.bar.template.list.forEach((it: MobileIconBarItem, i: number) => (it.index = i));
  }

  translateName(item: MobileIconBarItem): void {
    if (!item.translation.title.en) item.translation.title.en = item.name;
    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang>(
      TranslationModalComponent,
      { size: 'md', data: { initial: { en: item.translation.title.en, ar: item.translation.title.ar }, label: item.name } },
    );
    ref.afterClosed().then((res) => {
      if (!res) return;
      item.translation.title.en = res.en;
      item.translation.title.ar = res.ar;
      item.name = res.en;
    });
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const { id } = await this.nav.saveMobileIconBar(this.bar);
      if (id) this.bar.id = id;
      this.toast.success('NAV.MOBILE.SAVED');
      this.router.navigate(['/navigation-list']);
    } catch (e: any) {
      this.toast.error('NAV.MOBILE.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/navigation-list']);
  }

  sanitize(icon: string): string { return icon; }

  /** Candidate icons for an item's slug (user picks one). */
  iconsFor(item: MobileIconBarItem): string[] {
    return ICON_SETS[item.slug] ?? ICON_SETS['default'];
  }
}

const stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICON_SETS: Record<string, string[]> = {
  search:       [`<svg viewBox="0 0 24 24" ${stroke}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`],
  toTop:        [`<svg viewBox="0 0 24 24" ${stroke}><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`],
  '/':          [`<svg viewBox="0 0 24 24" ${stroke}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`],
  categories:   [`<svg viewBox="0 0 24 24" ${stroke}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`],
  wishlist:     [`<svg viewBox="0 0 24 24" ${stroke}><path d="m19 14 1.5-1.5c2-2 2-5 0-7s-5-2-7 0l-1.5 1.5L10.5 5.5c-2-2-5-2-7 0s-2 5 0 7L5 14l7 7 7-7z"/></svg>`],
  cart:         [`<svg viewBox="0 0 24 24" ${stroke}><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>`],
  account:      [`<svg viewBox="0 0 24 24" ${stroke}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`],
  menu:         [`<svg viewBox="0 0 24 24" ${stroke}><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`],
  shop:         [`<svg viewBox="0 0 24 24" ${stroke}><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>`],
  'my-orders':  [`<svg viewBox="0 0 24 24" ${stroke}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`],
  appointments: [`<svg viewBox="0 0 24 24" ${stroke}><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`],
  default:      [`<svg viewBox="0 0 24 24" ${stroke}><circle cx="12" cy="12" r="9"/></svg>`],
};
