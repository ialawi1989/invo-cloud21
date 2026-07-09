import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EmployeeOptionsService } from '@core/layout/services/employee-options.service';
import {
  ENTITY_SELECTOR_NAMESPACE,
  EntitySelectorService,
} from './entity-selector.service';
import { FindEntityPopoverComponent } from './find-entity-popover/find-entity-popover.component';

const NS = 'test.ns';
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

function configure(getResult: any) {
  const employeeOptions = {
    get: vi.fn().mockResolvedValue(getResult),
    set: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      EntitySelectorService,
      { provide: EmployeeOptionsService, useValue: employeeOptions },
      { provide: ENTITY_SELECTOR_NAMESPACE, useValue: NS },
    ],
  });
  return employeeOptions;
}

describe('EntitySelectorService — group collapse persistence', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('hydrates collapsedGroups from the persisted slice', async () => {
    configure({ entitySelector: { [NS]: { openTabIds: [], activeTabId: null, pinnedIds: [], collapsedGroups: ['trucks'] } } });
    const svc = TestBed.inject(EntitySelectorService);
    await flush();

    expect(svc.isGroupCollapsed('trucks')).toBe(true);
    expect(svc.isGroupCollapsed('stores')).toBe(false);
  });

  it('toggleGroup flips the collapsed state', async () => {
    configure({});
    const svc = TestBed.inject(EntitySelectorService);
    await flush();

    expect(svc.isGroupCollapsed('stores')).toBe(false);
    svc.toggleGroup('stores');
    expect(svc.isGroupCollapsed('stores')).toBe(true);
    svc.toggleGroup('stores');
    expect(svc.isGroupCollapsed('stores')).toBe(false);
  });

  it('persists collapsedGroups back under `entitySelector` (debounced)', async () => {
    const opts = configure({});
    const svc = TestBed.inject(EntitySelectorService);
    await flush();
    opts.set.mockClear();

    vi.useFakeTimers();
    svc.toggleGroup('trucks');
    await vi.advanceTimersByTimeAsync(400);
    vi.useRealTimers();

    expect(opts.set).toHaveBeenCalled();
    const slice = opts.set.mock.calls.at(-1)![0].entitySelector[NS];
    expect(slice.collapsedGroups).toContain('trucks');
  });
});

describe('FindEntityPopover — pick-once ("select") mode', () => {
  let store: any;

  beforeEach(() => {
    TestBed.resetTestingModule();
    store = {
      open: vi.fn(),
      togglePin: vi.fn(),
      isPinned: vi.fn(() => false),
      pinnedIds: () => new Set<string>(),
      recentIds: () => [] as string[],
      directoryList: () => [] as any[],
    };
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [{ provide: EntitySelectorService, useValue: store }],
    });
  });

  const item = { id: 'i1', label: 'I1', status: 'online' };

  it("'select' mode emits itemPicked WITHOUT touching the store (active unchanged)", () => {
    const fixture = TestBed.createComponent(FindEntityPopoverComponent);
    fixture.componentRef.setInput('pickMode', 'select');
    const cmp = fixture.componentInstance;

    const picked: string[] = [];
    cmp.itemPicked.subscribe((id) => picked.push(id));

    cmp.pick(item);

    expect(store.open).not.toHaveBeenCalled();
    expect(picked).toEqual(['i1']);
  });

  it("default 'open' mode opens the item via the store", () => {
    const fixture = TestBed.createComponent(FindEntityPopoverComponent);
    fixture.componentInstance.pick(item);
    expect(store.open).toHaveBeenCalledWith('i1');
  });
});
