import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, untracked, viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { debounceTime, startWith } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

import type { RestaurantTable, TableShape, TableSize } from '../../../services/table-management.service';

/** One edit of the open table, applied to the canvas as it happens (the page-level Save persists everything). */
export interface TableEdit {
  scope: 'table' | 'props' | 'settings';
  key: string;
  value: unknown;
}

const notBlank = (c: AbstractControl): ValidationErrors | null => (String(c.value ?? '').trim() ? null : { required: true });
const wholeNumber = (c: AbstractControl): ValidationErrors | null => (Number.isInteger(Number(c.value)) ? null : { whole: true });

/**
 * The properties of one table, as the sidebar's detail view. Presentational: it shows the table it is given and emits {@link TableEdit}s,
 * debounced (about 150 ms) so the canvas previews changes live without a call per key press. It never changes data itself.
 *
 * Validation: the name is required (and a name another table already uses only shows a warning, it does not block); seats must be a
 * whole number of at least 1. An invalid value is not emitted, so the canvas keeps the last good one.
 */
@Component({
  selector: 'app-table-inspector',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table-inspector.component.html',
  styleUrl: './table-inspector.component.scss',
})
export class TableInspectorComponent {
  private fb = inject(FormBuilder);
  private injector = inject(Injector);

  table = input.required<RestaurantTable>();
  /** Names of the other tables of the floor, for the duplicate-name warning. */
  otherNames = input<readonly string[]>([]);
  /** How long to wait after the last change before telling the canvas. */
  debounceMs = input(150);

  edit = output<TableEdit>();

  readonly shapes: readonly TableShape[] = ['circle', 'square', 'rectangle'];
  readonly sizes: readonly TableSize[] = ['small', 'medium', 'large'];

  form = this.fb.nonNullable.group({
    name: ['', [notBlank]],
    maxSeat: [1, [Validators.required, Validators.min(1), wholeNumber]],
    type: ['circle' as TableShape],
    size: ['medium' as TableSize],
    angle: [0],
    showSeats: [true],
    visible: [true],
    minimumCharge: [0, [Validators.min(0)]],
    chargePerHour: [0, [Validators.min(0)]],
    chargeAfter: [0, [Validators.min(0)]],
  });

  private nameField = viewChild<ElementRef<HTMLInputElement>>('nameField');
  private nameValue = toSignal(this.form.controls.name.valueChanges.pipe(startWith('')), { initialValue: '' });

  /** Another table already has this name: a warning, not an error. */
  duplicateName = computed(() => {
    const n = this.nameValue().trim().toLowerCase();
    return !!n && this.otherNames().some(o => o.trim().toLowerCase() === n);
  });

  constructor() {
    // Show the table that is open. Fields are only written when they differ, so typing is never overwritten by its own echo.
    effect(() => {
      const t = this.table();
      untracked(() => {
        const cur = this.form.getRawValue();
        const next = {
          name: cur.name.trim() === t.name.trim() ? cur.name : t.name,
          maxSeat: Number(cur.maxSeat) === t.maxSeat ? cur.maxSeat : t.maxSeat,
          type: t.properties.type,
          size: t.properties.size,
          angle: t.properties.angle,
          showSeats: !t.properties.hideSeats,
          visible: t.properties.visible,
          minimumCharge: t.settings.minimumCharge,
          chargePerHour: t.settings.chargePerHour,
          chargeAfter: t.settings.chargeAfter,
        };
        this.form.patchValue(next, { emitEvent: false });
        this.form.markAsPristine();
      });
    });

    this.form.valueChanges.pipe(debounceTime(this.debounceMs()), takeUntilDestroyed()).subscribe(() => this.flush());

    // Opening the detail puts the cursor in the name.
    afterNextRender(() => this.nameField()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Sends what differs from the table as the canvas has it. Invalid fields are skipped. */
  private flush(): void {
    const t = this.table();
    const f = this.form.controls;
    const v = this.form.getRawValue();
    const out: TableEdit[] = [];

    const name = v.name.trim();
    if (f.name.valid && name !== t.name) out.push({ scope: 'table', key: 'name', value: name });
    if (f.maxSeat.valid && Number(v.maxSeat) !== t.maxSeat) out.push({ scope: 'table', key: 'maxSeat', value: Number(v.maxSeat) });
    if (v.type !== t.properties.type) out.push({ scope: 'props', key: 'type', value: v.type });
    if (v.size !== t.properties.size) out.push({ scope: 'props', key: 'size', value: v.size });
    if (Number(v.angle) !== t.properties.angle) out.push({ scope: 'props', key: 'angle', value: Number(v.angle) });
    if (!v.showSeats !== !!t.properties.hideSeats) out.push({ scope: 'props', key: 'hideSeats', value: !v.showSeats });
    if (v.visible !== t.properties.visible) out.push({ scope: 'props', key: 'visible', value: v.visible });
    if (f.minimumCharge.valid && Number(v.minimumCharge) !== t.settings.minimumCharge) out.push({ scope: 'settings', key: 'minimumCharge', value: Number(v.minimumCharge) });
    if (f.chargePerHour.valid && Number(v.chargePerHour) !== t.settings.chargePerHour) out.push({ scope: 'settings', key: 'chargePerHour', value: Number(v.chargePerHour) });
    if (f.chargeAfter.valid && Number(v.chargeAfter) !== t.settings.chargeAfter) out.push({ scope: 'settings', key: 'chargeAfter', value: Number(v.chargeAfter) });
    for (const e of out) this.edit.emit(e);
  }

  // ── Controls that are not plain inputs ──
  setShape(s: TableShape): void { this.form.controls.type.setValue(s); }
  setSize(s: TableSize): void { this.form.controls.size.setValue(s); }
  rotateBy(delta: 45 | -45): void {
    const a = Number(this.form.controls.angle.value) + delta;
    this.form.controls.angle.setValue(((a % 360) + 360) % 360);
  }
  stepSeats(delta: 1 | -1): void {
    const n = Math.max(1, (Number(this.form.controls.maxSeat.value) || 0) + delta);
    this.form.controls.maxSeat.setValue(n);
  }
}
