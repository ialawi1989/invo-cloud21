import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmployeeOptionsService } from '@core/layout/services/employee-options.service';
import {
  BRANCH_TABS_NAMESPACE,
  BranchTabsService,
} from './branch-tabs.service';
import { FindBranchPopoverComponent } from '../find-branch-popover/find-branch-popover.component';

const NS = 'test.ns';
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function configure(getResult: any) {
  const employeeOptions = {
    get: vi.fn().mockResolvedValue(getResult),
    set: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      BranchTabsService,
      { provide: EmployeeOptionsService, useValue: employeeOptions },
      { provide: BRANCH_TABS_NAMESPACE, useValue: NS },
    ],
  });
  return employeeOptions;
}

describe('BranchTabsService — group collapse persistence', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('hydrates collapsedGroups from the persisted slice', async () => {
    configure({
      branchTabs: { [NS]: { openTabIds: [], activeTabId: null, pinnedIds: [], collapsedGroups: ['trucks'] } },
    });
    const svc = TestBed.inject(BranchTabsService);
    await flush();

    expect(svc.isGroupCollapsed('trucks')).toBe(true);
    expect(svc.isGroupCollapsed('stores')).toBe(false);
  });

  it('toggleGroup flips the collapsed state', async () => {
    configure({});
    const svc = TestBed.inject(BranchTabsService);
    await flush();

    expect(svc.isGroupCollapsed('stores')).toBe(false);
    svc.toggleGroup('stores');
    expect(svc.isGroupCollapsed('stores')).toBe(true);
    svc.toggleGroup('stores');
    expect(svc.isGroupCollapsed('stores')).toBe(false);
  });

  it('persists collapsedGroups back to EmployeeOptions (debounced)', async () => {
    const opts = configure({});
    const svc = TestBed.inject(BranchTabsService);
    await flush();
    opts.set.mockClear();

    vi.useFakeTimers();
    svc.toggleGroup('trucks');
    await vi.advanceTimersByTimeAsync(400); // past the 300ms persist debounce
    vi.useRealTimers();

    expect(opts.set).toHaveBeenCalled();
    const slice = opts.set.mock.calls.at(-1)![0].branchTabs[NS];
    expect(slice.collapsedGroups).toContain('trucks');
  });
});

describe('FindBranchPopover — pick-once ("select") mode', () => {
  let store: any;

  beforeEach(() => {
    TestBed.resetTestingModule();
    store = {
      openBranch: vi.fn(),
      togglePin: vi.fn(),
      isPinned: vi.fn(() => false),
      pinnedIds: () => new Set<string>(),
      recentIds: () => [] as string[],
      directoryList: () => [] as any[],
    };
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [{ provide: BranchTabsService, useValue: store }],
    });
  });

  const branch = { id: 'b1', name: 'B1', isOnline: true };

  it("'select' mode emits branchPicked WITHOUT touching the store (active unchanged)", () => {
    const fixture = TestBed.createComponent(FindBranchPopoverComponent);
    fixture.componentRef.setInput('pickMode', 'select');
    const cmp = fixture.componentInstance;

    const picked: string[] = [];
    cmp.branchPicked.subscribe((id) => picked.push(id));

    cmp.pick(branch);

    expect(store.openBranch).not.toHaveBeenCalled();
    expect(picked).toEqual(['b1']);
  });

  it("default 'open' mode opens the branch via the store", () => {
    const fixture = TestBed.createComponent(FindBranchPopoverComponent);
    const cmp = fixture.componentInstance;

    cmp.pick(branch);

    expect(store.openBranch).toHaveBeenCalledWith('b1');
  });
});
