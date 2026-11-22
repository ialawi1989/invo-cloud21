import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ModalService } from '@shared/modal/modal.service';
import { ListPreferencesService } from '@core/layout/services/list-preferences.service';
import { ListPageComponent } from './list-page.component';
import { ListGalleryCardDirective } from '../directives/list-template.directives';
import { GalleryViewConfig, TableColumn } from '../interfaces/list-page.types';

/**
 * Opt-in gallery view: what is requested, what is stored, and that other pages' grid is untouched.
 * `image` mirrors the Products column: hidden by default and `noApi` (never sent in list/grid views).
 */
@Component({
  standalone: true,
  imports: [ListPageComponent, ListGalleryCardDirective],
  template: `
    <app-list-page pageTitle="Items" resultsNoun="items" [columns]="columns" [dataSource]="load" [selectable]="true"
      [galleryView]="gallery" [pagination]="{ enabled: true, pageLimits: [15, 30] }">
      <ng-template listGalleryCard let-row let-selected="selected">
        <article class="card" [attr.data-selected]="selected">{{ row.name }}</article>
      </ng-template>
    </app-list-page>`,
})
class HostComponent {
  @ViewChild(ListPageComponent) page!: ListPageComponent;
  gallery: GalleryViewConfig | undefined = { imageKey: 'image' };
  rows: any[] = [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }];
  columns: TableColumn[] = [
    { key: 'name', label: 'Name', locked: true, visible: true, order: 0 } as TableColumn,
    { key: 'SKU', label: 'SKU', visible: true, order: 1 } as TableColumn,
    { key: 'image', label: 'Name', headerLabel: 'Image', visible: false, noApi: true, order: 2 } as TableColumn,
  ];
  calls: any[] = [];
  load = async (p: any) => { this.calls.push(p); return { list: this.rows, hasNext: false }; };
  cols = (i: number) => this.calls[i]?.columns as string[];
}

describe('<app-list-page> gallery view', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let drawerData: { columns: TableColumn[] } | undefined;
  let drawerResult: ((cols: TableColumn[]) => TableColumn[]) | undefined;
  const settle = async () => { for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 0)); fixture.detectChanges(); } };
  const q = (sel: string) => (fixture.nativeElement as HTMLElement).querySelectorAll(sel);

  async function mount(opts: { gallery?: GalleryViewConfig | undefined } = { gallery: { imageKey: 'image' } }) {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
    drawerData = undefined; drawerResult = undefined;
    TestBed.configureTestingModule({
      imports: [HostComponent, TranslateModule.forRoot()],
      providers: [
        { provide: Router, useValue: { navigate: async () => true, url: '/items', events: of() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} }, queryParams: new BehaviorSubject({}) } },
        { provide: ModalService, useValue: { open: (_c: unknown, cfg: any) => {
            drawerData = cfg.data;
            return { afterClosed: async () => drawerResult?.(cfg.data.columns), closed: of(undefined) };
          } } },
        { provide: ListPreferencesService, useValue: { load: async () => null, save: async () => {} } },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    host.gallery = opts.gallery;
    fixture.detectChanges();
    await settle();
  }

  afterEach(() => vi.unstubAllGlobals());

  describe('what is requested', () => {
    it('list view is unchanged: the image is never requested', async () => {
      await mount();
      expect(host.cols(0)).toEqual(['name', 'SKU']);
    });

    it('gallery requests the image even though Image is unchecked, on top of the user columns', async () => {
      await mount();
      host.page.setViewMode('gallery');
      await settle();
      expect(host.calls.length).toBe(2);
      expect(host.cols(1)).toEqual(['name', 'SKU', 'image']);
    });

    it('does not duplicate the image when it is already requested', async () => {
      await mount();
      host.columns[2] = { ...host.columns[2], noApi: false, visible: true };
      host.columns = [...host.columns];
      fixture.detectChanges(); await settle();
      host.page.setViewMode('gallery'); await settle();
      const last = host.cols(host.calls.length - 1);
      expect(last.filter(c => c === 'image').length).toBe(1);
    });

    it('list -> gallery -> list -> gallery fetches once, then reuses the data (no refetch loop)', async () => {
      await mount();
      for (let i = 0; i < 6; i++) { host.page.setViewMode(i % 2 === 0 ? 'gallery' : 'table'); await settle(); }
      expect(host.calls.length).toBe(2);   // initial list load + the single gallery load
    });
  });

  describe('the saved selection is never touched', () => {
    it('list -> gallery -> list leaves the stored columns and visibility exactly as they were', async () => {
      await mount();
      const before = { vis: [...host.page.visibleColumns()], cols: JSON.stringify(host.page.columns) };
      host.page.setViewMode('gallery'); await settle();
      expect(host.page.visibleColumns()).toEqual(before.vis);
      host.page.setViewMode('table'); await settle();
      expect(host.page.visibleColumns()).toEqual(before.vis);
      expect(JSON.stringify(host.page.columns)).toBe(before.cols);
      expect(host.page.columns.find(c => c.key === 'image')!.visible).toBe(false);
    });
  });

  describe('Manage Fields while the gallery is open', () => {
    it('shows Image checked and locked with the "always shown" hint', async () => {
      await mount();
      host.page.setViewMode('gallery'); await settle();
      await host.page.openColumnCustomization();
      const img = drawerData!.columns.find(c => c.key === 'image')!;
      expect(img.visible).toBe(true);
      expect(img.locked).toBe(true);
      expect(img.lockedHint).toBe('COMMON.GALLERY_ALWAYS_SHOWN');
    });

    it('applying the drawer in the gallery keeps the user\'s own Image choice (unchecked) and no temporary lock', async () => {
      await mount();
      host.page.setViewMode('gallery'); await settle();
      drawerResult = cols => cols.map(c => c.key === 'SKU' ? { ...c, visible: false } : c);   // the user hides SKU
      await host.page.openColumnCustomization(); await settle();
      const img = host.page.columns.find(c => c.key === 'image')!;
      expect(img.visible).toBe(false);
      expect(img.locked).toBeFalsy();
      expect((img as any).lockedHint).toBeUndefined();
      expect(host.page.columns.find(c => c.key === 'SKU')!.visible).toBe(false);
      expect(host.cols(host.calls.length - 1)).toEqual(['name', 'image']);   // still requested for the gallery
    });

    it('in the list view the Image field is an ordinary, unchecked, unlocked field', async () => {
      await mount();
      await host.page.openColumnCustomization();
      const img = drawerData!.columns.find(c => c.key === 'image')!;
      expect(img.visible).toBe(false);
      expect(img.locked).toBeFalsy();
      expect(img.lockedHint).toBeUndefined();
    });
  });

  describe('view preference mapping', () => {
    it('a requested "grid" maps to the gallery when the page opted in', async () => {
      await mount();
      expect(host.page.normalizeViewMode('grid')).toBe('gallery');
      host.page.setViewMode('grid'); await settle();
      expect(host.page.viewMode()).toBe('gallery');
      expect(host.cols(host.calls.length - 1)).toContain('image');
    });

    it('other pages keep their grid: no mapping, no image, built-in grid body', async () => {
      await mount({ gallery: undefined });
      expect(host.page.normalizeViewMode('grid')).toBe('grid');
      host.page.setViewMode('grid'); await settle();
      expect(host.page.viewMode()).toBe('grid');
      expect(host.calls.length).toBe(1);
      expect(host.cols(0)).toEqual(['name', 'SKU']);
      expect(q('.lp-gallery').length).toBe(0);
    });

    it('the toggle offers Gallery (not Grid) only on the opted-in page', async () => {
      await mount();
      const labels = Array.from(q('.lp-seg__btn')).map(b => b.getAttribute('aria-label'));
      expect(labels).toContain('COMMON.GALLERY_VIEW');
      expect(labels).not.toContain('COMMON.GRID_VIEW');
    });
  });

  describe('gallery body', () => {
    it('renders one card per row through the page template and keeps selection independent per card', async () => {
      await mount();
      host.page.setViewMode('gallery'); await settle();
      const cards = () => Array.from(q('article.card')) as HTMLElement[];
      expect(cards().map(c => c.textContent!.trim())).toEqual(['Alpha', 'Beta']);
      host.page.toggleRowSelection(host.rows[1]); await settle();
      expect(cards().map(c => c.getAttribute('data-selected'))).toEqual(['false', 'true']);
      expect(host.page.selectedRows().length).toBe(1);
    });

    it('shows the page\'s empty state when there are no results', async () => {
      await mount();
      host.rows = [];
      host.page.setViewMode('gallery'); await settle();
      expect(q('article.card').length).toBe(0);
      expect(q('app-empty-state').length).toBe(1);
    });
  });
});
