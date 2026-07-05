import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';

import { BreadcrumbsComponent, BreadcrumbItem } from '@shared/components/breadcrumbs';
import { SpinnerComponent } from '@shared/components/spinner';
import { SegmentedToggleComponent, SegmentedToggleOption } from '@shared/components/segmented-toggle/segmented-toggle.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { TranslationModalComponent, TranslationModalData, TranslationLang } from '@shared/components/translation-modal/translation-modal.component';
import { withTranslations } from '@core/i18n/with-translations';

import { NavigationService } from '../../services/navigation.service';
import { Website } from '../../../models/website.model';
import { NavigationList, NavigationListItem1, MegaMenuColumn } from '../../../models/navigation-list';

/** A source group in the left "add to menu" picker. */
interface LinkOptions {
  title: string;
  abbr: string;
  child: NavigationListItem1[];
  customLinkText?: string;
  customLinkUrl?: string;
  megaMenuTitle?: string;
}

@Component({
  selector: 'app-navigation-builder',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DragDropModule, TranslateModule,
    BreadcrumbsComponent, SpinnerComponent, SegmentedToggleComponent,
  ],
  templateUrl: './navigation-builder.component.html',
  styleUrls: ['./navigation-builder.component.scss'],
})
export class NavigationBuilderComponent implements OnInit {
  private nav       = inject(NavigationService);
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private toast     = inject(ToastService);
  private modal     = inject(ModalService);
  private translate = inject(TranslateService);

  readonly maxDepth = 2;
  readonly maxCol   = 4;

  loading   = signal(true);
  saving    = signal(false);
  formStatus = signal<'new' | 'edit'>('new');

  /** The edited theme. Plain (not signal) so CDK drag mutations to the
   *  nested arrays are picked up by default change detection. */
  menu!: Website;

  editingItemId    = signal<string | null>(null);
  editingMegaMenuId = signal<string | null>(null);

  customLink = { title: '', url: '' };
  megaMenuTitle = '';
  expandedSource = signal<string>('plus');

  breadcrumbs: BreadcrumbItem[] = [];

  /** Left-panel link sources, seeded with static options + loaded collections/pages. */
  linkOptions: LinkOptions[] = [
    { title: 'Online Store', abbr: 'plus', child: [] },
    { title: 'Collections',  abbr: 'collections', child: [] },
    { title: 'Pages',        abbr: 'pages', child: [] },
    { title: 'Orders',       abbr: 'orders', child: [] },
    { title: 'Reservations', abbr: 'reservations', child: [] },
    { title: 'Services',     abbr: 'services', child: [] },
    { title: 'Custom',       abbr: 'custom', child: [], customLinkText: '', customLinkUrl: 'https://' },
    { title: 'Mega Menu',    abbr: 'mega', child: [], megaMenuTitle: '' },
  ];

  readonly locationOptions: SegmentedToggleOption[] = [
    { value: 'primary', label: 'NAV.BUILDER.LOC_PRIMARY' },
    { value: 'footer',  label: 'NAV.BUILDER.LOC_FOOTER' },
  ];

  readonly megaWidthOptions: SegmentedToggleOption[] = [
    { value: 'container', label: 'NAV.BUILDER.WIDTH_CONTAINER' },
    { value: 'full',      label: 'NAV.BUILDER.WIDTH_FULL' },
    { value: 'custom',    label: 'NAV.BUILDER.WIDTH_CUSTOM' },
  ];

  constructor() { withTranslations('website/navigation'); }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.seedStaticOptions();
    await Promise.all([this.loadCollections(), this.loadPages()]);

    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== '0') {
      this.formStatus.set('edit');
      try {
        this.menu = await this.nav.getMenu(id);
      } catch (e: any) {
        this.toast.error('NAV.BUILDER.LOAD_FAILED', e?.message);
        this.menu = this.blankMenu();
      }
    } else {
      this.menu = this.blankMenu();
    }
    if (!(this.menu.template instanceof NavigationList)) {
      const t = new NavigationList();
      t.ParseJson(this.menu.template ?? {});
      this.menu.template = t;
    }
    this.buildBreadcrumbs();
    this.loading.set(false);
  }

  private blankMenu(): Website {
    const w = new Website();
    w.type = 'Menus';
    w.isPrimaryMenu = true;
    w.template = new NavigationList();
    return w;
  }

  private buildBreadcrumbs(): void {
    this.breadcrumbs = [
      { label: 'Home', routerLink: '/', icon: 'home', iconOnly: true },
      { label: 'Website', routerLink: '/website' },
      { label: this.translate.instant('NAV.LIST.TITLE'), routerLink: '/navigation-list' },
      { label: this.translate.instant(this.formStatus() === 'edit' ? 'COMMON.EDIT' : 'NAV.LIST.ADD') },
    ];
  }

  // ─── Link sources ───────────────────────────────────────────────────────

  private mkItem(name: string, type: string, abbr: string): NavigationListItem1 {
    const it = new NavigationListItem1();
    it.name = name;
    it.originalName = name;
    it.type = type;
    it.abbr = abbr;
    return it;
  }

  private seedStaticOptions(): void {
    const store = this.linkOptions.find(o => o.abbr === 'plus')!;
    store.child.push(this.mkItem('Home', 'page', 'home'));
    store.child.push(this.mkItem('Shop', 'shop', 'shop'));
    store.child.push(this.mkItem('Menu', 'menu', 'menu'));

    this.linkOptions.find(o => o.abbr === 'orders')!.child.push(this.mkItem('Order History', 'orders', 'my-orders'));
    this.linkOptions.find(o => o.abbr === 'reservations')!.child.push(this.mkItem('Reservation History', 'reservations', 'my-reservations'));

    const services = this.linkOptions.find(o => o.abbr === 'services')!;
    [['Pickup (menu)', 'pickup-menu'], ['Delivery (menu)', 'delivery-menu'], ['Appointments', 'appointments'], ['Table Reservation', 'table-reservation']]
      .forEach(([name, abbr]) => services.child.push(this.mkItem(name, 'services', abbr)));
  }

  private async loadCollections(): Promise<void> {
    try {
      const cols = await this.nav.getCollections();
      const target = this.linkOptions.find(o => o.abbr === 'collections')!;
      cols.forEach(c => {
        if (!c.title) return;
        const it = this.mkItem(c.title, 'collections', c.title.replaceAll(' ', '-'));
        target.child.push(it);
      });
    } catch { /* picker just shows no collections */ }
  }

  private async loadPages(): Promise<void> {
    try {
      const pages = await this.nav.getPages();
      const target = this.linkOptions.find(o => o.abbr === 'pages')!;
      pages.forEach(p => {
        if (!p.name) return;
        target.child.push(this.mkItem(p.name, 'pages', p.name.replaceAll(' ', '-')));
      });
    } catch { /* picker just shows no pages */ }
  }

  toggleSource(abbr: string): void {
    this.expandedSource.set(this.expandedSource() === abbr ? '' : abbr);
  }

  // ─── Add to menu ──────────────────────────────────────────────────────────

  addToMenu(item: NavigationListItem1): void {
    const it = new NavigationListItem1();
    it.ParseJson(item);
    it.uId = 'item-' + crypto.randomUUID();
    it.index = this.menu.template.list.length;
    it.depth = 0;
    this.menu.template.list.push(it);
  }

  addCustomLink(): void {
    if (!this.customLink.title || !this.customLink.url) return;
    const it = new NavigationListItem1();
    it.uId = 'custom-' + crypto.randomUUID();
    it.name = this.customLink.title;
    it.originalName = this.customLink.title;
    it.customUrl = this.customLink.url;
    it.type = 'customUrl';
    it.index = this.menu.template.list.length;
    it.depth = 0;
    this.menu.template.list.push(it);
    this.customLink = { title: '', url: '' };
  }

  addMegaMenu(): void {
    if (!this.megaMenuTitle) return;
    const it = new NavigationListItem1();
    it.uId = 'mega-' + crypto.randomUUID();
    it.name = this.megaMenuTitle;
    it.originalName = this.megaMenuTitle;
    it.customUrl = '#';
    it.type = 'mega';
    it.index = this.menu.template.list.length;
    it.depth = 0;
    it.isMegaMenu = true;
    it.megaWidth = 'container';
    it.megaColumns = [this.mkColumn(1)];
    this.menu.template.list.push(it);
    this.megaMenuTitle = '';
  }

  private mkColumn(n: number): MegaMenuColumn {
    const col = new MegaMenuColumn();
    col.uId = 'column-' + crypto.randomUUID();
    col.title = `Column ${n}`;
    col.width = 25;
    col.items = [];
    return col;
  }

  convertToMegaMenu(item: NavigationListItem1): void {
    item.isMegaMenu = true;
    item.type = 'mega';
    item.megaWidth = 'container';
    item.megaColumns = item.megaColumns?.length ? item.megaColumns : [this.mkColumn(1)];
    this.editMegaMenu(item);
  }

  // ─── Reorder + depth ────────────────────────────────────────────────────

  onDrop(event: CdkDragDrop<NavigationListItem1[]>): void {
    moveItemInArray(this.menu.template.list, event.previousIndex, event.currentIndex);
    this.reindex();
  }

  moveLeft(item: NavigationListItem1): void {
    if (item.depth > 0) item.depth--;
  }

  moveRight(item: NavigationListItem1): void {
    if (this.canMoveRight(item)) item.depth++;
  }

  canMoveRight(item: NavigationListItem1): boolean {
    const idx = this.menu.template.list.findIndex((i: NavigationListItem1) => i.uId === item.uId);
    if (idx === 0 || item.type === 'mega') return false;
    const prev = this.menu.template.list[idx - 1];
    return item.depth <= prev.depth && item.depth < this.maxDepth;
  }

  depthLines(depth: number): number[] {
    return Array.from({ length: depth }, (_, i) => i);
  }

  removeItem(item: NavigationListItem1): void {
    this.menu.template.list = this.menu.template.list.filter((i: NavigationListItem1) => i.uId !== item.uId);
    this.reindex();
  }

  toggleExpand(item: NavigationListItem1): void { item.expanded = !item.expanded; }

  private reindex(): void {
    this.menu.template.list.forEach((it: NavigationListItem1, i: number) => (it.index = i));
  }

  // ─── Inline edit ──────────────────────────────────────────────────────────

  editItem(item: NavigationListItem1): void {
    this.editingItemId.set(item.uId);
    this.editingMegaMenuId.set(null);
  }
  saveEdit(): void { this.editingItemId.set(null); }
  editMegaMenu(item: NavigationListItem1): void {
    this.editingMegaMenuId.set(item.uId);
    this.editingItemId.set(null);
  }
  saveMegaEdit(): void { this.editingMegaMenuId.set(null); }

  // ─── Mega columns ─────────────────────────────────────────────────────────

  addMegaColumn(item: NavigationListItem1): void {
    if (!item.megaColumns) item.megaColumns = [];
    if (item.megaColumns.length >= this.maxCol) return;
    item.megaColumns.push(this.mkColumn(item.megaColumns.length + 1));
  }
  removeMegaColumn(item: NavigationListItem1, idx: number): void {
    if (item.megaColumns && item.megaColumns.length > 1) item.megaColumns.splice(idx, 1);
  }
  removeColumnItem(column: MegaMenuColumn, idx: number): void {
    column.items.splice(idx, 1);
  }
  onColumnItemDrop(event: CdkDragDrop<NavigationListItem1[]>, column: MegaMenuColumn): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(column.items, event.previousIndex, event.currentIndex);
    }
  }

  // ─── Column item picker (modal-free inline picker) ─────────────────────────

  pickerColumn = signal<MegaMenuColumn | null>(null);
  pickerTab    = signal<string>('plus');
  pickerSearch = '';
  pickerCustom = { title: '', url: '' };

  openColumnPicker(column: MegaMenuColumn): void {
    this.pickerColumn.set(column);
    this.pickerTab.set('plus');
    this.pickerSearch = '';
  }
  closeColumnPicker(): void {
    this.pickerColumn.set(null);
    this.pickerCustom = { title: '', url: '' };
  }
  pickerTabs(): LinkOptions[] {
    return this.linkOptions.filter(o => o.abbr !== 'custom' && o.abbr !== 'mega');
  }
  pickerItems(): NavigationListItem1[] {
    const opt = this.linkOptions.find(o => o.abbr === this.pickerTab());
    let items = opt?.child ?? [];
    const q = this.pickerSearch.toLowerCase().trim();
    if (q) items = items.filter(i => i.name.toLowerCase().includes(q));
    return items;
  }
  addItemToColumn(item: NavigationListItem1): void {
    const col = this.pickerColumn();
    if (!col || col.items.some(c => c.abbr === item.abbr && c.name === item.name)) return;
    const it = new NavigationListItem1();
    it.ParseJson(item);
    it.uId = 'item-' + crypto.randomUUID();
    col.items.push(it);
  }
  addCustomToColumn(): void {
    const col = this.pickerColumn();
    if (!col || !this.pickerCustom.title || !this.pickerCustom.url) return;
    const it = new NavigationListItem1();
    it.uId = 'custom-' + crypto.randomUUID();
    it.name = this.pickerCustom.title;
    it.originalName = this.pickerCustom.title;
    it.customUrl = this.pickerCustom.url;
    it.type = 'customUrl';
    col.items.push(it);
    this.pickerCustom = { title: '', url: '' };
  }

  // ─── Media (image item) ─────────────────────────────────────────────────

  async addImage(column: MegaMenuColumn, item: NavigationListItem1 | null = null): Promise<void> {
    const { MediaPickerModalComponent } =
      await import('@features/settings/media/components/media-picker/media-picker-modal.component');
    const ref = this.modal.open<any, any, any>(MediaPickerModalComponent, {
      size: 'xl',
      data: { contentTypes: ['image'], multiple: false, title: this.translate.instant('NAV.BUILDER.CHOOSE_IMAGE') },
      closeOnBackdrop: true,
    });
    const picked = await ref.afterClosed();
    const media = Array.isArray(picked) ? picked[0] : picked;
    if (!media) return;
    const url = media.imageUrl || media.url?.defaultUrl || media.url?.original || media.defaultUrl || media.thumbnailUrl || '';

    if (item) {
      item.mediaId = media.id ?? media._id ?? '';
      if (item.mediaUrl) item.mediaUrl.defaultUrl = url;
    } else {
      const it = new NavigationListItem1();
      it.uId = 'image-' + crypto.randomUUID();
      it.name = media.name ?? 'Image';
      it.mediaId = media.id ?? media._id ?? '';
      it.type = 'image';
      if (it.mediaUrl) it.mediaUrl.defaultUrl = url;
      column.items.push(it);
    }
  }

  // ─── Translation ──────────────────────────────────────────────────────────

  translateItem(item: NavigationListItem1): void {
    if (!item.translation) item.translation = {};
    if (!item.translation.en) item.translation.en = { name: item.name };
    if (!item.translation.ar) item.translation.ar = { name: '' };
    item.translation.en.name = item.name;

    const ref = this.modal.open<TranslationModalComponent, TranslationModalData, TranslationLang>(
      TranslationModalComponent,
      { size: 'md', data: { initial: { en: item.translation.en.name, ar: item.translation.ar.name }, label: item.name } },
    );
    ref.afterClosed().then((res) => {
      if (!res) return;
      item.translation.en = { name: res.en };
      item.translation.ar = { name: res.ar };
      item.name = res.en;
    });
  }

  // ─── Location ──────────────────────────────────────────────────────────────

  get location(): 'primary' | 'footer' {
    return this.menu?.isFooterMenu ? 'footer' : 'primary';
  }
  setLocation(value: string): void {
    this.menu.isFooterMenu = value === 'footer';
    this.menu.isPrimaryMenu = value !== 'footer';
  }

  // ─── Save / cancel ──────────────────────────────────────────────────────────

  async save(): Promise<void> {
    if (!this.menu.name?.trim()) {
      this.toast.error('NAV.BUILDER.NAME_REQUIRED');
      return;
    }
    this.saving.set(true);
    try {
      const { id } = await this.nav.saveMenu(this.menu);
      if (id) this.menu.id = id;
      this.toast.success('NAV.BUILDER.SAVED');
      this.router.navigate(['/navigation-list']);
    } catch (e: any) {
      this.toast.error('NAV.BUILDER.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/navigation-list']);
  }

  itemIcon(type: string): string {
    return ICONS[type] ?? ICONS['default'];
  }
}

/** Minimal inline icon set (kept small; the legacy set was decorative). */
const ICONS: Record<string, string> = {
  page:        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  pages:       '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  collections: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  orders:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  reservations:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  services:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  customUrl:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  mega:        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
  image:       '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  default:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/></svg>',
};
