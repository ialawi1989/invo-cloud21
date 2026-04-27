import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnChanges,
  OnInit,
  SimpleChanges,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import {
  CustomField,
  CustomFieldType,
  TEXTUAL_TYPES,
} from '../../models/custom-field.types';
import { CustomFieldsService } from '../../services/custom-fields.service';
import { CustomFieldRendererComponent } from '../custom-field-renderer/custom-field-renderer.component';

/** Dictionary written back to the entity's `customFields` map. */
type CustomFieldValues = Record<string, unknown>;

/**
 * <app-entity-custom-fields>
 * ──────────────────────────
 * Generic "Custom fields" section for any entity form (product,
 * branch, customer, invoice, …). Loads the entity's custom-field
 * definitions from settings, builds a FormGroup keyed by `field.abbr`
 * with the right validators per type, and renders each field through
 * `<app-custom-field-renderer>` inside a 12-column responsive grid.
 *
 * Two-way contract with the parent form:
 *
 *   1. The component registers a child FormGroup on `parentForm` under
 *      `controlName` (default `customFields`). Saving the parent form
 *      gets the values for free.
 *
 *   2. Initial values come from `valueSource` (the entity object's
 *      `customFields` map). Subsequent edits write back to the same
 *      object so the parent's `productInfo / branchInfo / …` instance
 *      always reflects the latest state.
 */
@Component({
  selector: 'app-entity-custom-fields',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    TranslateModule,
    CustomFieldRendererComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './entity-custom-fields.component.html',
  styleUrl: './entity-custom-fields.component.scss',
})
export class EntityCustomFieldsComponent implements OnInit, OnChanges {
  private fb         = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private cfService  = inject(CustomFieldsService);

  /** Entity slug — drives which custom-field set we load. */
  entityType = input.required<string>();

  /** Parent form group we register our FormGroup on. */
  parentForm = input.required<FormGroup>();

  /** Key under `parentForm` to expose this group as. Defaults to `customFields`. */
  controlName = input<string>('customFields');

  /**
   * Object that owns the persisted values. We seed the FormGroup from
   * `valueSource[abbr]` and write changes back to the same object —
   * matches the convention the legacy backend / parent forms expect.
   */
  valueSource = input<CustomFieldValues | null>(null);

  /** Optional override for the section's translated title. */
  titleKey = input<string>('SETTINGS.CUSTOM_FIELDS.SECTION_TITLE');

  /** ID prefix for the rendered inputs — keep it short and stable. */
  idPrefix = input<string>('cf');

  group!: FormGroup;
  fields = signal<CustomField[]>([]);
  hasFields = computed<boolean>(() => this.fields().length > 0);

  async ngOnInit(): Promise<void> {
    this.group = this.fb.group({});
    this.parentForm().setControl(this.controlName(), this.group);

    const all = await this.cfService.getByType(this.entityType());
    const active = (all ?? []).filter((f) => !f.isDeleted);
    this.fields.set(active);
    this.rebuildControls(active);

    this.group.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        const target = this.valueSource();
        if (target) Object.assign(target, v);
      });
  }

  /** Reseed values when the parent swaps in a different entity object. */
  ngOnChanges(changes: SimpleChanges): void {
    if (!this.group) return;          // not initialised yet — ngOnInit will handle it
    if (!changes['valueSource'])  return;
    this.reseedFromValueSource();
  }

  controlOf(f: CustomField): FormControl {
    return this.group.get(f.abbr) as FormControl;
  }

  // ─── Internal ──────────────────────────────────────────────────────────
  private rebuildControls(active: CustomField[]): void {
    const source = this.valueSource() ?? {};
    for (const f of active) {
      const initial = this.coerce(
        source[f.abbr] ?? f.defaultValue ?? this.emptyFor(f.type),
        f.type,
      );
      this.group.addControl(f.abbr, this.fb.control(initial, this.validatorsFor(f)));
    }
  }

  private reseedFromValueSource(): void {
    const source = this.valueSource() ?? {};
    for (const f of this.fields()) {
      const ctrl = this.group.get(f.abbr);
      if (!ctrl) continue;
      const next = this.coerce(
        source[f.abbr] ?? f.defaultValue ?? this.emptyFor(f.type),
        f.type,
      );
      ctrl.setValue(next, { emitEvent: false });
    }
  }

  private emptyFor(type: CustomFieldType): unknown {
    switch (type) {
      case 'boolean': return false;
      case 'number':  return null;
      default:        return '';
    }
  }

  private coerce(v: unknown, type: CustomFieldType): unknown {
    if (v == null || v === '') return this.emptyFor(type);
    if (type === 'number')  return Number(v);
    if (type === 'boolean') return !!v;
    return v;
  }

  private validatorsFor(f: CustomField): ValidatorFn[] {
    const out: ValidatorFn[] = [];
    if (f.required && f.type !== 'boolean') out.push(Validators.required);
    if (f.charLimit && (TEXTUAL_TYPES as readonly string[]).includes(f.type)) {
      out.push(Validators.maxLength(f.charLimit));
    }
    if (f.type === 'number') {
      if (f.minNumber != null) out.push(Validators.min(f.minNumber));
      if (f.maxNumber != null) out.push(Validators.max(f.maxNumber));
    }
    if (f.type === 'email') out.push(Validators.email);
    return out;
  }
}
