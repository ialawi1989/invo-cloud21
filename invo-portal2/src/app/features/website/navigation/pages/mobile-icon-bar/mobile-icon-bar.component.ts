import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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
import { iconsForSlug } from './mobile-icon-bar.icons';

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

            <div class="icon-picker">
              <button type="button" class="icon-trigger" [class.open]="iconMenu() === item.uId"
                      (click)="toggleIconMenu(item, $event)"
                      [title]="'NAV.MOBILE.CHANGE_ICON' | translate">
                <span class="icon-current" [innerHTML]="sanitize(item.icon || iconsFor(item)[0])"></span>
                @if (iconsFor(item).length > 1) {
                  <svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                }
              </button>
              @if (iconMenu() === item.uId) {
                <div class="icon-menu">
                  @for (icon of iconsFor(item); track $index) {
                    <button type="button" class="icon-swatch" [class.selected]="item.icon === icon"
                            [innerHTML]="sanitize(icon)" (click)="selectIcon(item, icon)"></button>
                  }
                </div>
              }
            </div>

            <span class="row-name">{{ item.name }}</span>

            <div class="row-tools">
              <button type="button" class="tool" (click)="translateName(item)" [title]="'NAV.BUILDER.TRANSLATE' | translate">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </button>
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
    /* Icon picker: a trigger showing the current icon that opens a menu of choices. */
    .icon-picker { position:relative; flex:0 0 auto; }
    .icon-trigger { display:inline-flex; align-items:center; gap:5px; height:36px; padding:0 8px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; color:#475569; cursor:pointer; transition:border-color .12s, background .12s; }
    .icon-trigger:hover { border-color:#cbd5e1; background:#f8fafc; }
    .icon-trigger.open { border-color:var(--color-brand-500); color:var(--color-brand-700); background:#fff; }
    .icon-current { display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; flex:0 0 auto; }
    .icon-current ::ng-deep svg { width:18px; height:18px; display:block; }
    .icon-trigger .chev { color:#94a3b8; flex:0 0 auto; transition:transform .15s ease; }
    .icon-trigger.open .chev { transform:rotate(180deg); color:var(--color-brand-600); }
    .icon-menu { position:absolute; top:calc(100% + 6px); inset-inline-start:0; z-index:30; display:flex; gap:6px; padding:8px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; box-shadow:0 10px 30px rgba(15,23,42,.16); }
    .icon-swatch { width:38px; height:38px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; color:#475569; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:0; transition:border-color .12s, background .12s; }
    .icon-swatch:hover { border-color:#cbd5e1; background:#f8fafc; }
    .icon-swatch.selected { border-color:var(--color-brand-500); background:color-mix(in srgb, var(--color-brand-100), transparent 40%); color:var(--color-brand-700); }
    .icon-swatch ::ng-deep svg { width:20px; height:20px; display:block; }
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
  private sanitizer = inject(DomSanitizer);
  private iconCache = new Map<string, SafeHtml>();

  readonly MAX = 5;
  private readonly excluded = ['/', 'cart', 'account'];

  loading = signal(true);
  saving  = signal(false);
  bar!: Website;

  /** uId of the item whose icon dropdown is open, or null when all are closed. */
  iconMenu = signal<string | null>(null);

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

  /** Open/close the icon dropdown for an item (single icon → nothing to pick). */
  toggleIconMenu(item: MobileIconBarItem, event: Event): void {
    event.stopPropagation();
    if (this.iconsFor(item).length <= 1) return;
    this.iconMenu.set(this.iconMenu() === item.uId ? null : item.uId);
  }

  /** Pick an icon and close the dropdown. */
  selectIcon(item: MobileIconBarItem, icon: string): void {
    item.icon = icon;
    this.iconMenu.set(null);
  }

  /** Any outside click closes an open icon dropdown (the trigger stops
   *  propagation, so opening it doesn't immediately re-close). */
  @HostListener('document:click')
  closeIconMenu(): void {
    if (this.iconMenu() !== null) this.iconMenu.set(null);
  }

  onDrop(event: CdkDragDrop<MobileIconBarItem[]>): void {
    moveItemInArray(this.bar.template.list, event.previousIndex, event.currentIndex);
    this.bar.template.list.forEach((it: MobileIconBarItem, i: number) => (it.index = i));
  }

  translateName(item: MobileIconBarItem): void {
    if (!item.translation.title.en) item.translation.title.en = item.name;
    const title = item.translation.title as Record<string, string>;
    const initial: Record<string, string> = { ...title, en: title['en'] || item.name };
    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang>(
      TranslationModalComponent,
      { size: 'md', data: { initial, label: item.name } },
    );
    ref.afterClosed().then((res) => {
      if (!res) return;
      // Write every language the modal returned, preserving the title map.
      for (const [lang, value] of Object.entries(res)) title[lang] = value;
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

  /** Trust the inline SVG string so `[innerHTML]` renders it instead of
   *  Angular's HTML sanitizer stripping the <svg> markup (blank swatch). */
  sanitize(icon: string): SafeHtml {
    let html = this.iconCache.get(icon);
    if (!html) {
      html = this.sanitizer.bypassSecurityTrustHtml(icon);
      this.iconCache.set(icon, html);
    }
    return html;
  }

  /** Candidate icons for an item's slug (user picks one). */
  iconsFor(item: MobileIconBarItem): string[] {
    return iconsForSlug(item.slug);
  }
}
