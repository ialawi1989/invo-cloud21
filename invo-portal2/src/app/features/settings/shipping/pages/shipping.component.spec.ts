// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { CompanyService } from '@core/auth/company.service';
import { ModalService } from '@shared/modal/modal.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ShippingService } from '../services/shipping.service';
import type { Rate, Zone } from '../services/shipping.types';
import { ShippingComponent } from './shipping.component';

let nextId = 1;
const rate = (over: Partial<Rate> = {}): Rate => ({ id: nextId++, name: 'Standard', type: 'weight', from: '0', to: '5', price: '1', note: '', ...over });
const zone = (rates: Rate[], over: Partial<Zone> = {}): Zone => ({ id: 1, name: 'Gulf', countries: ['Bahrain'], taxExempt: false, rates, ...over });

describe('ShippingComponent (rate rules and structure)', () => {
  let cmp: ShippingComponent;
  let service: { loadZones: ReturnType<typeof vi.fn>; loadCountries: ReturnType<typeof vi.fn>; loadOptions: ReturnType<typeof vi.fn>; saveZones: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };

  async function setup(zones: Zone[]) {
    TestBed.resetTestingModule();
    service = {
      loadZones: vi.fn().mockResolvedValue(zones),
      loadCountries: vi.fn().mockResolvedValue([{ name: 'Bahrain', code: 'BH', dial_code: '+973' }]),
      loadOptions: vi.fn().mockResolvedValue({ dimensionUOM: 'cm' }),
      saveZones: vi.fn(),
    };
    toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ShippingComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ShippingService, useValue: service },
        { provide: CompanyService, useValue: { settings: signal({ weightUOM: 'kg', settings: { currencySymbol: 'BHD' } }) } },
        { provide: ModalService, useValue: { open: () => ({ afterClosed: async () => true }) } },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(ShippingComponent, { set: { template: '', imports: [] } });
    cmp = TestBed.createComponent(ShippingComponent).componentInstance;
    await cmp.ngOnInit();
  }
  const group = (z = 0) => cmp.groupedZones()[z].groups[0];

  describe('THE RULE: [from, to), an empty To means no upper limit on the top tier only', () => {
    it('a normal range is valid, from must be 0 or more, to must be greater', async () => {
      await setup([zone([rate({ from: '0', to: '5' })])]);
      expect(cmp.validateRange(group().ranges[0], group())).toBe(true);
      await setup([zone([rate({ from: '-1', to: '5' })])]);
      expect(cmp.validateRange(group().ranges[0], group())).toBe(false);
      await setup([zone([rate({ from: '5', to: '5' })])]);
      expect(cmp.validateRange(group().ranges[0], group())).toBe(false);
    });

    it('the top tier may have no upper limit; a lower tier may not', async () => {
      await setup([zone([rate({ from: '0', to: '5' }), rate({ from: '5', to: '' })])]);
      const [low, top] = group().ranges;
      expect(cmp.validateRange(top, group())).toBe(true);
      await setup([zone([rate({ from: '0', to: '' }), rate({ from: '5', to: '10' })])]);
      const [open, higher] = group().ranges;
      expect(cmp.validateRange(open, group())).toBe(false);
      expect(cmp.rangeErrorKey(open, group())).toBe('SHIPPING.RATES.ERR_UNBOUNDED');
      expect(cmp.validateRange(higher, group())).toBe(true);
      void low;
    });

    it('says why a range is wrong', async () => {
      await setup([zone([rate({ from: '', to: '5' })])]);
      expect(cmp.rangeErrorKey(group().ranges[0], group())).toBe('SHIPPING.RATES.ERR_FROM');
      await setup([zone([rate({ from: '5', to: '3' })])]);
      expect(cmp.rangeErrorKey(group().ranges[0], group())).toBe('SHIPPING.RATES.ERR_TO_GREATER');
    });

    it('touching ranges are fine; a gap is a warning; an overlap blocks saving', async () => {
      await setup([zone([rate({ from: '0', to: '5' }), rate({ from: '5', to: '10' })])]);
      expect(group().gaps.length + group().overlaps.length).toBe(0);
      expect(cmp.hasErrors()).toBe(false);

      await setup([zone([rate({ from: '0', to: '5' }), rate({ from: '7', to: '10' })])]);
      expect(group().gaps).toEqual([{ from: 5, to: 7, afterRange: 0 }]);
      expect(cmp.hasErrors()).toBe(false);

      await setup([zone([rate({ from: '0', to: '5' }), rate({ from: '3', to: '10' })])]);
      expect(group().overlaps.length).toBe(1);
      expect(cmp.hasErrors()).toBe(true);
    });

    it('finds overlaps whatever order the rows are in', async () => {
      await setup([zone([rate({ from: '5', to: '10' }), rate({ from: '0', to: '6' })])]);
      expect(group().overlaps.length).toBe(1);
    });
  });

  describe('No upper limit', () => {
    it('checking it empties To; unchecking seeds To with From (invalid until raised)', async () => {
      await setup([zone([rate({ from: '5', to: '10' })])]);
      const r = cmp.zones()[0].rates[0];
      cmp.toggleUnbounded(1, r, true);
      expect(cmp.zones()[0].rates[0].to).toBe('');
      cmp.toggleUnbounded(1, cmp.zones()[0].rates[0], false);
      expect(cmp.zones()[0].rates[0].to).toBe('5');
      expect(cmp.validateRange(cmp.zones()[0].rates[0], cmp.groupedZones()[0].groups[0])).toBe(false);
    });

    it('a new range starts with a real To to fill in, not "no upper limit"', async () => {
      await setup([zone([rate()])]);
      cmp.addRangeToGroup(1, group());
      expect(cmp.zones()[0].rates[1].to).toBe('0');
    });
  });

  describe('services: type groups that share a rate name', () => {
    it('groups by name, and lists the types still free', async () => {
      await setup([zone([rate({ name: 'Standard', type: 'weight' }), rate({ name: 'Standard', type: 'total' }), rate({ name: 'Express', type: 'weight' })])]);
      const services = cmp.groupedZones()[0].services;
      expect(services.map(s => [s.name, s.groups.map(g => g.type)])).toEqual([['Standard', ['weight', 'total']], ['Express', ['weight']]]);
      expect(cmp.availableTypes(cmp.zones()[0], 'Standard')).toEqual(['dimension']);
      expect(cmp.availableTypes(cmp.zones()[0], 'Express')).toEqual(['total', 'dimension']);
    });

    it('"Add another type" adds the next free type under the same name and opens its edit panel', async () => {
      await setup([zone([rate({ name: 'Standard', type: 'weight' })])]);
      cmp.addTypeToService(1, 'Standard');
      const added = cmp.zones()[0].rates[1];
      expect(added).toMatchObject({ name: 'Standard', type: 'total', to: '0' });
      expect(cmp.editingGroup()).toBe('1:Standard:total');
    });

    it('does nothing when every type is already there', async () => {
      await setup([zone([rate({ type: 'weight' }), rate({ type: 'total' }), rate({ type: 'dimension' })])]);
      cmp.addTypeToService(1, 'Standard');
      expect(cmp.zones()[0].rates.length).toBe(3);
    });

    it('hints when only some types of a service have a note', async () => {
      await setup([zone([rate({ type: 'weight', note: 'Up to 3 days' }), rate({ type: 'total', note: '' })])]);
      expect(cmp.hasMixedNotes(cmp.groupedZones()[0].services[0].groups)).toBe(true);
      await setup([zone([rate({ type: 'weight', note: 'a' }), rate({ type: 'total', note: 'b' })])]);
      expect(cmp.hasMixedNotes(cmp.groupedZones()[0].services[0].groups)).toBe(false);
    });
  });

  describe('save', () => {
    it('does not call the server while ranges overlap', async () => {
      await setup([zone([rate({ from: '0', to: '5' }), rate({ from: '3', to: '10' })])]);
      cmp.setRange(1, cmp.zones()[0].rates[0].id, 'price', '2'); // make it dirty
      await cmp.save();
      expect(service.saveZones).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalled();
    });

    it('marks each row the server refused with its own message, and clears it when that row is edited', async () => {
      await setup([zone([rate({ from: '0', to: '5' }), rate({ from: '5', to: '10' })])]);
      const [first, second] = cmp.zones()[0].rates;
      cmp.setRange(1, first.id, 'price', '9');
      service.saveZones.mockResolvedValue({ success: false, violations: [{ zone: 'Gulf', type: 'weight', name: 'Standard', rowIndex: 1, message: 'Overlaps the previous tier' }] });
      await cmp.save();
      expect(cmp.rowErrors()).toEqual({ [second.id]: 'Overlaps the previous tier' });
      expect(toast.error).toHaveBeenCalled();
      cmp.setRange(1, second.id, 'price', '3');
      expect(cmp.rowErrors()).toEqual({});
    });

    it('a good save clears the row marks', async () => {
      await setup([zone([rate()])]);
      cmp.setRange(1, cmp.zones()[0].rates[0].id, 'price', '2');
      service.saveZones.mockResolvedValue({ success: true });
      await cmp.save();
      expect(toast.success).toHaveBeenCalledWith('COMMON.SAVED_OK');
      expect(cmp.rowErrors()).toEqual({});
      expect(cmp.hasUnsavedChanges()).toBe(false);
    });
  });
});
