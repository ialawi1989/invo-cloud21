import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { ModalService } from '@shared/modal/modal.service';

import { Product, EmployeePrice } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';
import {
  PickEmployeeModalComponent,
  PickEmployeeModalData,
  PickEmployeeResult,
  PickedEmployee,
} from './pick-employee-modal/pick-employee-modal.component';

/**
 * price-by-team
 * ─────────────
 * Per-employee service pricing/duration for `service` products. Mirrors the
 * old project's `PriceByTeamComponent`: a paginated employee picker drops
 * each employee into a row that exposes `serviceTime` + `price` inputs.
 *
 * Backed by `productInfo.employeePrices` (an `EmployeePrice[]`) — that's the
 * single source of truth the save endpoint expects (named `name` on each
 * row, not `employeeName`, to match the legacy payload shape).
 */
@Component({
  selector: 'app-pf-price-by-team',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './price-by-team.component.html',
  styleUrl: './price-by-team.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceByTeamComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private modal = inject(ModalService);
  private cdr = inject(ChangeDetectorRef);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  rows!: FormArray<FormGroup>;

  /** Search text inside the card itself (filters already-picked rows). */
  search = signal<string>('');

  /** Mirrors `ProductService.minServiceTime` from the legacy project. */
  readonly minServiceTime = 10;

  /** Indices visible after applying the in-card search filter. */
  visibleRows = computed<number[]>(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.productInfo().employeePrices ?? [];
    return list
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => !q || (row['name'] ?? '').toLowerCase().includes(q))
      .map(({ i }) => i);
  });

  ngOnInit(): void {
    const info = this.productInfo();
    if (!Array.isArray(info.employeePrices)) info.employeePrices = [];

    this.rows = this.fb.array(
      info.employeePrices.map((e) => this.buildRow(e)),
    );
    this.productForm().setControl('priceByTeam', this.rows);

    this.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncBackToModel());
  }

  private buildRow(e: EmployeePrice): FormGroup {
    const f = this.fieldsOptions()?.priceByTeam;
    return this.fb.group({
      employeeId:  [e.employeeId ?? ''],
      name:        [e['name'] ?? e.employeeName ?? ''],
      serviceTime: [e.serviceTime ?? 0,
                    f?.serviceTime?.isRequired
                      ? [Validators.required, Validators.min(this.minServiceTime)]
                      : [Validators.min(this.minServiceTime)]],
      price:       [e.price ?? 0,
                    f?.price?.isRequired
                      ? [Validators.required, Validators.min(0)]
                      : [Validators.min(0)]],
    });
  }

  private syncBackToModel(): void {
    const info = this.productInfo();
    info.employeePrices = this.rows.controls.map((grp) => {
      const v = grp.getRawValue() as any;
      return {
        employeeId:  v.employeeId,
        name:        v.name,
        serviceTime: v.serviceTime == null || v.serviceTime === '' ? null : Number(v.serviceTime),
        price:       v.price == null || v.price === '' ? null : Number(v.price),
      } as EmployeePrice;
    });
  }

  async openPicker(): Promise<void> {
    const existingIds = this.rows.controls.map((g) => g.value['employeeId']);
    const ref = this.modal.open<PickEmployeeModalComponent, PickEmployeeModalData, PickEmployeeResult>(
      PickEmployeeModalComponent,
      {
        data: { excludedIds: existingIds },
        size: 'md',
      },
    );
    const result = await ref.afterClosed();
    if (!result) return;
    if (!result.added.length && !result.removed.length) return;
    if (result.removed.length) {
      const removeSet = new Set(result.removed);
      for (let i = this.rows.length - 1; i >= 0; i--) {
        if (removeSet.has(this.rows.at(i).value['employeeId'])) this.rows.removeAt(i);
      }
    }
    result.added.forEach((p) => this.addFromPick(p));
    this.productForm().markAsDirty();
    this.cdr.markForCheck();
  }

  private addFromPick(p: PickedEmployee): void {
    const item: EmployeePrice = {
      employeeId:  p.id,
      name:        p.name,
      serviceTime: 0,
      price:       0,
    } as EmployeePrice;
    this.rows.push(this.buildRow(item));
  }

  removeRow(i: number): void {
    if (i < 0 || i >= this.rows.length) return;
    this.rows.removeAt(i);
    this.productForm().markAsDirty();
    this.cdr.markForCheck();
  }

  rowAt(i: number): FormGroup {
    return this.rows.at(i) as FormGroup;
  }

  controlAt(i: number, name: 'serviceTime' | 'price') {
    return this.rowAt(i).controls[name];
  }
}
