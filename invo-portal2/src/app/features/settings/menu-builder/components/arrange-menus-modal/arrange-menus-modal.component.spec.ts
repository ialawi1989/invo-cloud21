// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ToastService } from '@shared/components/toast/toast.service';
import { MenuBuilderService } from '../../services/menu-builder.service';
import { ArrangeMenusModalComponent } from './arrange-menus-modal.component';

const m = (id: string, name: string) => ({ id, name, startAt: '00:00:00', endAt: '23:59:00' });

describe('ArrangeMenusModalComponent (menu priority)', () => {
  let fixture: ComponentFixture<ArrangeMenusModalComponent>;
  let cmp: ArrangeMenusModalComponent;
  let svc: { getList: ReturnType<typeof vi.fn>; rearrange: ReturnType<typeof vi.fn> };
  let ref: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    svc = { getList: vi.fn().mockResolvedValue({ list: [m('a', 'DineIn'), m('b', 'Delivery'), m('c', 'Pickup')] }), rearrange: vi.fn().mockResolvedValue(true) };
    ref = { close: vi.fn(), dismiss: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ArrangeMenusModalComponent, TranslateModule.forRoot()],
      providers: [
        { provide: MenuBuilderService, useValue: svc }, { provide: MODAL_REF, useValue: ref },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(ArrangeMenusModalComponent);
    cmp = fixture.componentInstance;
    await cmp.ngOnInit();
    fixture.detectChanges();
  });
  const names = () => cmp.rows().map((r) => r.name);

  it('lists the menus in their current priority order, nothing to save yet', () => {
    expect(names()).toEqual(['DineIn', 'Delivery', 'Pickup']);
    expect(cmp.dirty()).toBe(false);
  });

  it('moves a menu and keeps within the list', () => {
    cmp.move(2, 0);
    expect(names()).toEqual(['Pickup', 'DineIn', 'Delivery']);
    expect(cmp.dirty()).toBe(true);
    cmp.move(0, 9);
    expect(names()).toEqual(['Pickup', 'DineIn', 'Delivery']);
  });

  it('Alt+ArrowDown on a handle moves the menu down one place', () => {
    cmp.onKey(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }), 0);
    expect(names()).toEqual(['Delivery', 'DineIn', 'Pickup']);
    cmp.onKey(new KeyboardEvent('keydown', { key: 'ArrowDown' }), 0);
    expect(names()).toEqual(['Delivery', 'DineIn', 'Pickup']);
  });

  it('saves every menu with its new position (0 = first) and closes', async () => {
    cmp.move(2, 0);
    await cmp.save();
    expect(svc.rearrange).toHaveBeenCalledWith([{ id: 'c', index: 0 }, { id: 'a', index: 1 }, { id: 'b', index: 2 }]);
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('stays open when the save fails', async () => {
    svc.rearrange.mockResolvedValue(false);
    cmp.move(1, 0);
    await cmp.save();
    expect(ref.close).not.toHaveBeenCalled();
    expect(cmp.saving()).toBe(false);
  });
});
