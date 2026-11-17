// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import type { RestaurantTable } from '../../../services/table-management.service';
import { TableEdit, TableInspectorComponent } from './table-inspector.component';

const table = (over: Partial<RestaurantTable> = {}): RestaurantTable => ({
  id: 't1', name: 'T1', maxSeat: 4,
  properties: { type: 'circle', size: 'medium', angle: 0, position: { x: 0, y: 0 }, visible: true, hideSeats: false },
  settings: { minimumCharge: 0, chargePerHour: 0, chargeAfter: 0 },
  ...over,
});

describe('TableInspectorComponent', () => {
  let fixture: ComponentFixture<TableInspectorComponent>;
  let cmp: TableInspectorComponent;
  let el: HTMLElement;
  let edits: TableEdit[];

  async function setup(t = table(), others: string[] = []) {
    TestBed.configureTestingModule({ imports: [TableInspectorComponent, TranslateModule.forRoot()] });
    fixture = TestBed.createComponent(TableInspectorComponent);
    cmp = fixture.componentInstance;
    edits = [];
    cmp.edit.subscribe(e => edits.push(e));
    fixture.componentRef.setInput('table', t);
    fixture.componentRef.setInput('otherNames', others);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }
  const type = async (control: 'name' | 'maxSeat', value: string | number) => {
    cmp.form.controls[control].setValue(value as never);
    await vi.advanceTimersByTimeAsync(200);
    fixture.detectChanges();
  };

  beforeEach(() => { TestBed.resetTestingModule(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('shows the table it is given', async () => {
    await setup(table({ name: 'Window 3', maxSeat: 6 }));
    expect(cmp.form.getRawValue().name).toBe('Window 3');
    expect(cmp.form.getRawValue().maxSeat).toBe(6);
  });

  it('previews a change live, debounced, as one edit', async () => {
    await setup();
    cmp.form.controls.name.setValue('A');
    cmp.form.controls.name.setValue('AB');
    await vi.advanceTimersByTimeAsync(100);
    expect(edits).toEqual([]);
    await vi.advanceTimersByTimeAsync(100);
    expect(edits).toEqual([{ scope: 'table', key: 'name', value: 'AB' }]);
  });

  it('trims the name and does not emit a blank one', async () => {
    await setup();
    await type('name', '  Bar  ');
    expect(edits.at(-1)).toEqual({ scope: 'table', key: 'name', value: 'Bar' });
    edits.length = 0;
    await type('name', '   ');
    expect(edits).toEqual([]);
    expect(el.querySelector('[role="alert"]')).toBeTruthy();
  });

  it('only warns when another table has the same name, and still emits', async () => {
    await setup(table(), ['Patio']);
    await type('name', 'patio');
    expect(el.querySelector('.ti__warn')?.textContent).toContain('NAME_DUPLICATE');
    expect(edits.at(-1)).toEqual({ scope: 'table', key: 'name', value: 'patio' });
  });

  it('rejects seats that are below 1 or not whole', async () => {
    await setup();
    await type('maxSeat', 0);
    expect(cmp.form.controls.maxSeat.invalid).toBe(true);
    await type('maxSeat', 2.5);
    expect(cmp.form.controls.maxSeat.invalid).toBe(true);
    expect(edits).toEqual([]);
    await type('maxSeat', 5);
    expect(edits).toEqual([{ scope: 'table', key: 'maxSeat', value: 5 }]);
  });

  it('steps seats but never below 1', async () => {
    await setup(table({ maxSeat: 1 }));
    cmp.stepSeats(-1);
    expect(cmp.form.controls.maxSeat.value).toBe(1);
    cmp.stepSeats(1);
    expect(cmp.form.controls.maxSeat.value).toBe(2);
  });

  it('rotates by 45 degrees and wraps', async () => {
    await setup(table({ properties: { ...table().properties, angle: 330 } }));
    cmp.rotateBy(45);
    await vi.advanceTimersByTimeAsync(200);
    expect(edits.at(-1)).toEqual({ scope: 'props', key: 'angle', value: 15 });
  });

  it('follows the table when another one is opened, without echoing an edit', async () => {
    await setup();
    fixture.componentRef.setInput('table', table({ id: 't2', name: 'T2', maxSeat: 8 }));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(200);
    expect(cmp.form.getRawValue().name).toBe('T2');
    expect(edits).toEqual([]);
  });
});
