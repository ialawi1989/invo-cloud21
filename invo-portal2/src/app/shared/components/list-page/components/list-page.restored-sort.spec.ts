import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModalService } from '@shared/modal/modal.service';
import { ListPreferencesService } from '@core/layout/services/list-preferences.service';
import { ListPageComponent } from './list-page.component';
import { SortingConfig, TableColumn } from '../interfaces/list-page.types';

/**
 * A sort restored from the URL must only be applied when it names a `sortable: true` column
 * (or the screen's declared defaultSort key). Covers both call sites in list-page.component.ts:
 * the initial restore (restoreStateFromUrl) and back/forward (onUrlQueryParamsChanged).
 */
@Component({
  standalone: true,
  imports: [ListPageComponent],
  template: `<app-list-page pageTitle="Items" resultsNoun="items" [columns]="columns" [dataSource]="load"
    [sorting]="sorting" [pagination]="{ enabled: true, pageLimits: [15, 30] }" />`,
})
class HostComponent {
  @ViewChild(ListPageComponent) page!: ListPageComponent;
  sorting: SortingConfig = { enabled: true, defaultSort: { key: 'name', direction: 'asc' } };
  columns: TableColumn[] = [
    { key: 'name', label: 'Name', sortable: true } as TableColumn,
    { key: 'total', label: 'Total', sortable: true } as TableColumn,
    { key: 'notes', label: 'Notes', sortable: false } as TableColumn,
  ];
  bodies: any[] = [];
  load = async (p: any) => { this.bodies.push(p); return { list: [{ id: 1, name: 'a' }], hasNext: false }; };
  lastSort = () => this.bodies[this.bodies.length - 1]?.sortBy;
}

describe('<app-list-page> restored URL sort', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let snapshot: { queryParams: Record<string, string> };
  let queryParams$: BehaviorSubject<Record<string, string>>;
  const settle = async () => { for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 0)); fixture.detectChanges(); } };

  async function mount(initial: Record<string, string>, sorting?: SortingConfig) {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
    snapshot = { queryParams: initial };
    queryParams$ = new BehaviorSubject(initial);
    TestBed.configureTestingModule({
      imports: [HostComponent, TranslateModule.forRoot()],
      providers: [
        { provide: Router, useValue: { navigate: async () => true, url: '/items', events: of() } },
        { provide: ActivatedRoute, useValue: { snapshot, queryParams: queryParams$ } },
        { provide: ModalService, useValue: { open: () => ({ closed: of(undefined) }) } },
        { provide: ListPreferencesService, useValue: { load: async () => null, save: async () => {} } },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    if (sorting) host.sorting = sorting;
    fixture.detectChanges();
    await settle();
  }

  /** Simulates browser back/forward: the address bar changes and the route emits. */
  async function navigateTo(params: Record<string, string>) {
    snapshot.queryParams = params;
    queryParams$.next(params);
    await settle();
  }

  afterEach(() => vi.unstubAllGlobals());

  describe('initial restore from the URL', () => {
    it('(a) applies a valid sortable key, direction normalised', async () => {
      await mount({ sortBy: 'total', sortDir: 'DESC' });
      expect(host.page.sortBy()).toEqual({ sortValue: 'total', sortDirection: 'desc' });
      expect(host.lastSort()).toEqual({ sortValue: 'total', sortDirection: 'desc' });
    });

    it('(b) an unknown key falls back to the default sort', async () => {
      await mount({ sortBy: 'bogus', sortDir: 'desc' });
      expect(host.page.sortBy()).toEqual({ sortValue: 'name', sortDirection: 'asc' });
      expect(host.lastSort()).toEqual({ sortValue: 'name', sortDirection: 'asc' });
    });

    it('(b) a non-sortable column and an injection-like string are ignored too', async () => {
      await mount({ sortBy: 'notes' });
      expect(host.lastSort()).toEqual({ sortValue: 'name', sortDirection: 'asc' });
      TestBed.resetTestingModule();
      await mount({ sortBy: `name"; DROP TABLE users;--`, sortDir: 'asc' });
      expect(host.lastSort()).toEqual({ sortValue: 'name', sortDirection: 'asc' });
    });

    it('a missing direction uses the default direction', async () => {
      await mount({ sortBy: 'total' });
      expect(host.page.sortBy()).toEqual({ sortValue: 'total', sortDirection: 'asc' });
    });

    it('with no defaultSort, an invalid restored sort sends no sort at all (never an empty sortValue)', async () => {
      await mount({ sortBy: 'bogus' }, { enabled: true });
      expect(host.page.sortBy()).toBeUndefined();
      expect(host.lastSort()).toBeUndefined();
    });
  });

  describe('back/forward navigation (onUrlQueryParamsChanged)', () => {
    beforeEach(async () => { await mount({ sortBy: 'total', sortDir: 'desc' }); });

    it('(c) navigating to an unknown key falls back to the default sort and reloads with it', async () => {
      expect(host.page.sortBy()).toEqual({ sortValue: 'total', sortDirection: 'desc' });
      await navigateTo({ sortBy: 'bogus', sortDir: 'asc' });
      expect(host.page.sortBy()).toEqual({ sortValue: 'name', sortDirection: 'asc' });
      expect(host.lastSort()).toEqual({ sortValue: 'name', sortDirection: 'asc' });
    });

    it('(c) navigating to an injection-like key falls back the same way', async () => {
      await navigateTo({ sortBy: `total'; --`, sortDir: 'desc' });
      expect(host.page.sortBy()).toEqual({ sortValue: 'name', sortDirection: 'asc' });
    });

    it('navigating to another valid sortable key applies it', async () => {
      await navigateTo({ sortBy: 'name', sortDir: 'DESC' });
      expect(host.page.sortBy()).toEqual({ sortValue: 'name', sortDirection: 'desc' });
      expect(host.lastSort()).toEqual({ sortValue: 'name', sortDirection: 'desc' });
    });
  });
});
