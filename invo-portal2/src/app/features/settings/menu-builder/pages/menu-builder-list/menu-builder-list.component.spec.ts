// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ModalService } from '@shared/modal/modal.service';
import { TranslateModule } from '@ngx-translate/core';

import { UserPreferencesService } from '@core/preferences/user-preferences.service';
import { MenuBuilderService } from '../../services/menu-builder.service';
import type { MenuListItem } from '../../services/menu-builder.types';
import { MenuBuilderListComponent } from './menu-builder-list.component';

const row = (over: Partial<MenuListItem> = {}): MenuListItem => ({
  id: 'm1', name: 'Lunch', branchIds: [], startAt: '09:00:00', endAt: '17:00:00', availableOnline: true, index: 0, sectionsCount: 3, ...over,
});

describe('MenuBuilderListComponent (logic)', () => {
  let getList: ReturnType<typeof vi.fn>;
  let getSummary: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let cmp: MenuBuilderListComponent;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  function create(initial: Record<string, string> = {}) {
    params = new BehaviorSubject(convertToParamMap(initial));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MenuBuilderListComponent, TranslateModule.forRoot()],
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { get queryParamMap() { return params.value; } } } },
        { provide: MenuBuilderService, useValue: { getList, getSummary } },
        { provide: ModalService, useValue: { open: () => ({ afterClosed: async () => true }) } },
        { provide: UserPreferencesService, useValue: { timePattern: () => 'HH:mm' } },
      ],
    });
    TestBed.overrideComponent(MenuBuilderListComponent, { set: { template: '', imports: [] } });
    return TestBed.createComponent(MenuBuilderListComponent).componentInstance;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    getList = vi.fn().mockResolvedValue({ list: [row()], total: 41 });
    getSummary = vi.fn().mockResolvedValue({ total: 41, statusCounts: { ACTIVE: 40, SCHEDULED: 0, ENDED: 1, DISABLED: 0 }, active: [{ id: 'a', name: 'DineIn' }], branchTimeZone: 'Asia/Bahrain' });
    navigate = vi.fn().mockResolvedValue(true);
    cmp = create();
  });

  it('loads a page with the search text trimmed, and works out the page count', async () => {
    const res = await cmp.load({ page: 2, limit: 20, searchTerm: ' lunch ' });
    expect(getList).toHaveBeenCalledWith({ page: 2, limit: 20, search: 'lunch', sortBy: undefined, status: undefined });
    expect(res).toEqual({ list: [row()], count: 41, pageCount: 3 });
  });

  it('sorts by the column chosen in the table (Hours = its start time); with none chosen it sends no sort so the default (priority) applies', async () => {
    await cmp.load({ page: 1, limit: 20, sortBy: { sortValue: 'hours', sortDirection: 'desc' } });
    expect(getList).toHaveBeenLastCalledWith({ page: 1, limit: 20, search: '', sortBy: { sortValue: 'startAt', sortDirection: 'desc' }, status: undefined });
    await cmp.load({ page: 1, limit: 20 });
    expect(getList).toHaveBeenLastCalledWith({ page: 1, limit: 20, search: '', sortBy: undefined, status: undefined });
  });

  it('loads the summary with the list, and the list still loads when the summary fails', async () => {
    await cmp.load({ page: 1, limit: 20 });
    expect(cmp.summary()?.statusCounts.ACTIVE).toBe(40);
    getSummary.mockRejectedValue(new Error('x'));
    const res = await cmp.load({ page: 1, limit: 20 });
    expect(res.list.length).toBe(1);
    expect(cmp.summary()).toBeNull();
  });

  it('reads the selected tab from the URL, and ignores nonsense', () => {
    expect(create({ status: 'ended' }).status()).toBe('ENDED');
    expect(create({ status: 'nonsense' }).status()).toBeNull();
  });

  it('picking a tab writes it to the URL and starts at page 1; All clears it', () => {
    cmp.setStatus('ACTIVE');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { status: 'active', page: null }, queryParamsHandling: 'merge' }));
    cmp.setStatus(null);
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { status: null, page: null } }));
  });

  it('follows the address bar', () => {
    params.next(convertToParamMap({ status: 'scheduled' }));
    expect(cmp.status()).toBe('SCHEDULED');
  });

  it('asks the backend for the chosen tab, with the search kept', async () => {
    cmp = create({ status: 'ended' });
    await cmp.load({ page: 1, limit: 20, searchTerm: 'a' });
    expect(getList).toHaveBeenLastCalledWith({ page: 1, limit: 20, search: 'a', sortBy: undefined, status: ['ENDED'] });
  });

  it('formats the hours: no seconds, "all day", overnight', () => {
    expect(cmp.hours(row()).range).toBe('09:00 – 17:00');
    expect(cmp.hours(row({ startAt: '00:00:00', endAt: '23:59:00' })).allDay).toBe(true);
    expect(cmp.hours(row({ startAt: '18:00:00', endAt: '02:00:00' })).overnight).toBe(true);
  });

  it('opens a menu, and a new one', () => {
    cmp.edit(row({ id: 'abc' }));
    expect(navigate).toHaveBeenCalledWith(['/settings/menu-builder', 'abc']);
    cmp.addNew();
    expect(navigate).toHaveBeenLastCalledWith(['/settings/menu-builder', 'new']);
  });
});
