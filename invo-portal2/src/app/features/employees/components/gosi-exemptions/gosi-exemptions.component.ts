import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { DateFieldComponent } from '@shared/components/date-field/date-field.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ToastService } from '@shared/components/toast/toast.service';
import { ModalService } from '@shared/modal/modal.service';
import { ConfirmModalComponent, ConfirmModalData } from '@shared/modal/demo/confirm-modal.component';

import { GosiService } from '../../services/gosi.service';
import { GosiExemption, GosiExemptionScope } from '../../services/gosi.types';

interface ScopeOption {
  value: GosiExemptionScope;
  labelKey: string;
}

const SCOPE_OPTIONS: readonly ScopeOption[] = [
  { value: 'both', labelKey: 'EMPLOYEES.GOSI.EXEMPT.SCOPE_BOTH' },
  { value: 'employee', labelKey: 'EMPLOYEES.GOSI.EXEMPT.SCOPE_EMPLOYEE' },
  { value: 'employer', labelKey: 'EMPLOYEES.GOSI.EXEMPT.SCOPE_EMPLOYER' },
];

/**
 * <app-gosi-exemptions [employeeId]="id" [canEdit]="…" (changed)="reload()"/>
 *
 * The windows during which a company waives one employee's social-insurance
 * contribution (both shares, or only the employee's / the employer's). Payroll
 * evaluates a window on the last day of the pay period. Self-contained: it loads,
 * adds and removes its own rows and only tells the parent when something changed,
 * so the parent can refresh the figures that depend on it.
 */
@Component({
  selector: 'app-gosi-exemptions',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, DateFieldComponent, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gosi-exemptions.component.html',
  styleUrl: './gosi-exemptions.component.scss',
})
export class GosiExemptionsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(GosiService);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private modal = inject(ModalService);

  readonly employeeId = input.required<string>();
  readonly canEdit = input<boolean>(false);
  readonly changed = output<void>();

  readonly rows = signal<GosiExemption[]>([]);
  readonly adding = signal(false);
  readonly saving = signal(false);
  readonly scopeOptions: ScopeOption[] = [...SCOPE_OPTIONS];

  readonly form = this.fb.group({
    fromDate: ['', Validators.required],
    toDate: [''],
    scope: ['both' as GosiExemptionScope],
    reason: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.rows.set(await this.service.exemptions(this.employeeId()).catch(() => []));
  }

  // ─── Scope dropdown ───────────────────────────────────────────────────────
  scopeDisplay = (o: ScopeOption | null) => (o ? this.translate.instant(o.labelKey) : '');
  scopeCompare = (a: ScopeOption | null, b: ScopeOption | null) => (a?.value ?? null) === (b?.value ?? null);
  scopeToValue = (o: ScopeOption | null) => o?.value ?? 'both';
  selectedScope(): ScopeOption | null {
    const v = this.form.get('scope')?.value ?? 'both';
    return this.scopeOptions.find((o) => o.value === v) ?? null;
  }
  setScope(o: ScopeOption | null): void {
    this.form.get('scope')?.setValue(o?.value ?? 'both');
  }
  scopeLabelKey(s: GosiExemptionScope): string {
    return (this.scopeOptions.find((o) => o.value === s) ?? this.scopeOptions[0]).labelKey;
  }

  /** Where a window sits relative to today — a label, never a gate. */
  status(r: GosiExemption): 'active' | 'upcoming' | 'ended' {
    const today = new Date().toLocaleDateString('en-CA');
    if (r.fromDate > today) return 'upcoming';
    if (r.toDate && r.toDate < today) return 'ended';
    return 'active';
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  openForm(): void {
    this.form.reset({ fromDate: new Date().toLocaleDateString('en-CA'), toDate: '', scope: 'both', reason: '' });
    this.adding.set(true);
  }

  cancel(): void {
    this.adding.set(false);
  }

  async save(): Promise<void> {
    if (!this.canEdit() || this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    if (v.toDate && v.toDate < v.fromDate!) {
      this.toast.error('EMPLOYEES.GOSI.EXEMPT.END_BEFORE_START');
      return;
    }
    this.saving.set(true);
    try {
      await this.service.saveExemption({
        employeeId: this.employeeId(),
        fromDate: v.fromDate!,
        toDate: v.toDate || null,
        scope: (v.scope ?? 'both') as GosiExemptionScope,
        reason: String(v.reason ?? '').trim(),
      });
      this.adding.set(false);
      await this.load();
      this.toast.success('EMPLOYEES.GOSI.EXEMPT.SAVED');
      this.changed.emit();
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(r: GosiExemption): Promise<void> {
    if (!this.canEdit() || this.saving()) return;
    const ref = this.modal.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, {
      size: 'sm',
      data: {
        title: this.translate.instant('EMPLOYEES.GOSI.EXEMPT.DELETE_TITLE'),
        message: this.translate.instant('EMPLOYEES.GOSI.EXEMPT.DELETE_CONFIRM', { from: r.fromDate }),
        confirm: this.translate.instant('EMPLOYEES.GOSI.RATES.DELETE'),
        danger: true,
      },
    });
    if (!(await ref.afterClosed())) return;
    this.saving.set(true);
    try {
      await this.service.deleteExemption(r.id);
      await this.load();
      this.toast.success('EMPLOYEES.GOSI.EXEMPT.DELETED');
      this.changed.emit();
    } catch (e: any) {
      this.toast.error('COMMON.SAVE_FAILED', e?.message);
    } finally {
      this.saving.set(false);
    }
  }
}
