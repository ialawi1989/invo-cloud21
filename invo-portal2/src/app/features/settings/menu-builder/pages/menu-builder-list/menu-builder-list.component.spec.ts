// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { UserPreferencesService } from '@core/preferences/user-preferences.service';
import { MenuBuilderService } from '../../services/menu-builder.service';
import type { MenuListItem, MenuListPage } from '../../services/menu-builder.types';
import { MenuBuilderListComponent } from './menu-builder-list.component';

const row = (over: Partial<MenuListItem> = {}): MenuListItem => ({
  id: 'm1', name: 'Lunch', branchIds: [], startAt: '09:00:00', endAt: '17:00:00', availableOnline: true, index: 0, sectionsCount: 3,
  status: 'ACTIVE', nextChangeAt: null, allDay: false, overnight: false, days: null, hasOverlap: false, overlapsWith: [], warnings: [], ...over,
});
const page = (over: Partial<MenuListPage> = {}): MenuListPage => ({
  list: [row()], total: 1, statusCounts: { ACTIVE: 1, SCHEDULED: 0, ENDED: 0, DISABLED: 0 }, branchTimeZone: 'Asia/Riyadh',
  serverNow: '2026-11-17T12:00:00.000Z', ...over,
});

describe('MenuBuilderListComponent (logic)', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.fn>;
  let getList: ReturnType<typeof vi.fn>;
  let getSummary: ReturnType<typeof vi.fn>;

  function create(initial: Record<string, string> = {}) {
    params = new BehaviorSubject(convertToParamMap(initial));
    navigate = vi.fn().mockResolvedValue(true);
    getList = vi.fn().mockResolvedValue(page());
    getSummary = vi.fn().mockResolvedValue({ total: 1, statusCounts: page().statusCounts, active: [{ id: 'm1', name: 'Lunch', nextChangeAt: null }], nextChangeAt: null, branchTimeZone: 'Asia/Riyadh', serverNow: page().serverNow });
    TestBed.configureTestingModule({
      imports: [MenuBuilderListComponent, TranslateModule.forRoot()],
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params, snapshot: { get queryParamMap() { return params.value; } } } },
        { provide: MenuBuilderService, useValue: { getList, getSummary } },
        { provide: UserPreferencesService, useValue: { timePattern: () => 'HH:mm' } },
      ],
    });
    // Only the container's own logic is under test: the shared list page is replaced by an empty template.
    TestBed.overrideComponent(MenuBuilderListComponent, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(MenuBuilderListComponent);
    return { fixture, cmp: fixture.componentInstance };
  }

  beforeEach(() => { TestBed.resetTestingModule(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('reads the selected chip from the URL', () => {
    expect(create({ status: 'ended' }).cmp.status()).toBe('ENDED');
    TestBed.resetTestingModule();
    expect(create({ status: 'nonsense' }).cmp.status()).toBeNull();
  });

  it('picking a chip writes it to the URL and resets to page 1', () => {
    const { cmp } = create({ page: '3' });
    cmp.setStatus('ACTIVE');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { status: 'active', page: null }, queryParamsHandling: 'merge',
    }));
    cmp.setStatus(null);
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { status: null, page: null } }));
  });

  it('follows the address bar (back / forward)', () => {
    const { cmp } = create();
    params.next(convertToParamMap({ status: 'scheduled' }));
    expect(cmp.status()).toBe('SCHEDULED');
  });

  it('asks the backend for the chosen status, active first, and keeps the search', async () => {
    const { cmp } = create({ status: 'ended' });
    await cmp.load({ page: 1, limit: 20, searchTerm: ' lunch ' });
    expect(getList).toHaveBeenCalledWith({ page: 1, limit: 20, search: 'lunch', status: ['ENDED'], sort: 'status' });
  });

  it('exposes the counts and the zone for the chips and the hint', async () => {
    const { cmp } = create();
    await cmp.load({ page: 1, limit: 20 });
    expect(cmp.counts().ACTIVE).toBe(1);
    expect(cmp.timeZone()).toBe('Asia/Riyadh');
    expect(cmp.totalMenus()).toBe(1);
    expect(cmp.summary()?.active[0].name).toBe('Lunch');
  });

  it('still lists the menus when the summary call fails', async () => {
    const { cmp } = create();
    getSummary.mockRejectedValue(new Error('x'));
    const res = await cmp.load({ page: 1, limit: 20 });
    expect(res.list.length).toBe(1);
    expect(cmp.summary()).toBeNull();
  });

  it('schedules a refetch at the next change (server clock), not later than 60 s', async () => {
    const { fixture, cmp } = create();
    const refresh = vi.fn();
    (cmp as any).listPage = () => ({ refresh });
    getSummary.mockResolvedValue({ total: 1, statusCounts: page().statusCounts, active: [], nextChangeAt: new Date(Date.now() + 20_000).toISOString(), branchTimeZone: 'Asia/Riyadh', serverNow: new Date().toISOString() });
    getList.mockResolvedValue(page({ serverNow: new Date().toISOString() }));
    await cmp.load({ page: 1, limit: 20 });
    vi.advanceTimersByTime(19_000);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('falls back to a 60 s refresh when nothing is due', async () => {
    const { fixture, cmp } = create();
    const refresh = vi.fn();
    (cmp as any).listPage = () => ({ refresh });
    getSummary.mockResolvedValue({ total: 0, statusCounts: page().statusCounts, active: [], nextChangeAt: null, branchTimeZone: '', serverNow: '' });
    await cmp.load({ page: 1, limit: 20 });
    vi.advanceTimersByTime(59_000);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('pauses while the tab is hidden and refetches when it is visible again', async () => {
    const { fixture, cmp } = create();
    const refresh = vi.fn();
    (cmp as any).listPage = () => ({ refresh });
    let state: DocumentVisibilityState = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    await cmp.load({ page: 1, limit: 20 });
    vi.advanceTimersByTime(61_000);
    expect(refresh).not.toHaveBeenCalled();
    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('stops its timer when destroyed', async () => {
    const { fixture, cmp } = create();
    const refresh = vi.fn();
    (cmp as any).listPage = () => ({ refresh });
    await cmp.load({ page: 1, limit: 20 });
    fixture.destroy();
    vi.advanceTimersByTime(120_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('builds the overlap warning from the other menus', () => {
    const { cmp } = create();
    const t = TestBed.inject(TranslateService);
    t.setTranslation('en', { MENU_BUILDER: { STATUS: { OVERLAP: 'Overlaps with {{names}}' } } });
    t.use('en');
    const text = cmp.overlapText(row({ hasOverlap: true, overlapsWith: [{ id: 'x', name: 'Dinner' }, { id: 'y', name: 'Brunch' }] }));
    expect(text).toContain('Dinner, Brunch');
  });

  it('highlights only live rows', () => {
    const { cmp } = create();
    expect(cmp.rowClass(row({ status: 'ACTIVE' }))).toBe('menu-row--active');
    expect(cmp.rowClass(row({ status: 'ENDED' }))).toBe('');
  });
});
