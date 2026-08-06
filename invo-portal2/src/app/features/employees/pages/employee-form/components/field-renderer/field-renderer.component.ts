import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DropdownLoadFn } from '@shared/components/dropdown/search-dropdown.types';
import { DatePickerComponent } from '@shared/components/datepicker/date-picker.component';

import {
  FieldDescriptor,
  FieldOption,
  RequiredMode,
} from '../../../../models/field-manifest.types';
import {
  buildRowGroup,
  isFieldRequired,
  isFieldVisible,
} from '../../../../services/manifest-form.util';

/**
 * Manifest field renderer
 * ───────────────────────
 * Renders a list of {@link FieldDescriptor}s onto the shared controls the
 * employee form already uses — `<app-toggle>`, `<app-date-picker>`,
 * `<app-search-dropdown>` and the module's `.input` markup. No native
 * `<select>` or checkbox anywhere.
 *
 * Two deliberate choices:
 *
 *  • Controls bind with `[formControl]`, not `formControlName`. The renderer
 *    resolves controls out of the `FormGroup` it's handed, which keeps nested
 *    groups and repeatable rows working through `ngTemplateOutlet` recursion
 *    without depending on where the view happens to be inserted.
 *
 *  • Conditions are evaluated against `values` — the *root* form value handed
 *    down by the host and refreshed on its `formTick`. Validators for the same
 *    conditions are applied by the host via `applyManifestRules()`, so the two
 *    can't disagree: both read the same descriptors through the same helpers.
 *
 * The renderer never writes to the record. Adding or removing a repeatable row
 * mutates the `FormArray`, which the host's `valueChanges` subscription already
 * observes for its `dirty` flag.
 */
@Component({
  selector: 'app-field-renderer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    ToggleComponent,
    SearchDropdownComponent,
    DatePickerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './field-renderer.component.html',
  styleUrl: './field-renderer.component.scss',
})
export class FieldRendererComponent {
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  /** Descriptors to render (one manifest group's `fields`). */
  descriptors = input.required<FieldDescriptor[]>();
  /** The `FormGroup` those descriptors were built into. */
  group = input.required<FormGroup>();
  /** Root path of `group` — `'profile'` / `'employment'`. Conditions name full
   *  paths, so this is what makes a descriptor's `key` resolvable. */
  path = input<string>('');
  /** Whole-form raw value, for condition evaluation. */
  values = input<Record<string, any>>({});
  /** Dynamic option lists by `optionSource` name. */
  optionSources = input<Record<string, FieldOption[]>>({});
  /** Paged option loaders by `loaderSource` name — the dropdown searches and
   *  pages against these instead of holding the whole table in memory. */
  optionLoaders = input<Record<string, DropdownLoadFn<FieldOption>>>({});
  /** Free-text autocomplete lists by `suggestionSource` name. */
  suggestionSources = input<Record<string, string[]>>({});
  /** Read-only display values for `computed` fields, keyed by full path. */
  computedValues = input<Record<string, string>>({});
  /** How hard `required` bites — see {@link RequiredMode}. */
  requiredMode = input<RequiredMode>('strict');

  /** Bumped when translations load so `optionDisplay` re-renders. */
  private i18nTick = signal(0);

  /** Unique-ish suffix so two renderers on one page don't collide on
   *  `<datalist>` / label ids. */
  readonly uid = Math.random().toString(36).slice(2, 8);

  constructor() {
    this.translate.onTranslationChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.i18nTick.update((n) => n + 1));
  }

  // ─── Control access ──────────────────────────────────────────────────────

  control(group: FormGroup, key: string): FormControl {
    return group.get(key) as FormControl;
  }

  childGroup(group: FormGroup, key: string): FormGroup {
    return group.get(key) as FormGroup;
  }

  rows(group: FormGroup, key: string): FormGroup[] {
    const array = group.get(key) as FormArray | null;
    return (array?.controls ?? []) as FormGroup[];
  }

  fullPath(parentPath: string, d: FieldDescriptor): string {
    return parentPath ? `${parentPath}.${d.key}` : d.key;
  }

  /** Field ids are per-renderer so labels stay clickable with two on a page. */
  fieldId(parentPath: string, d: FieldDescriptor): string {
    return `fr-${this.uid}-${this.fullPath(parentPath, d).replace(/\./g, '-')}`;
  }

  // ─── Visibility / requiredness ───────────────────────────────────────────

  visible(d: FieldDescriptor): boolean {
    return isFieldVisible(d, this.values());
  }

  /** Only shows the asterisk — the validators themselves come from the host's
   *  `applyManifestRules()`, using this same helper. */
  required(d: FieldDescriptor, group: FormGroup, inRow = false): boolean {
    // A row you chose to add is validated strictly, whatever the record's age.
    if (inRow) return !!d.required;
    return isFieldRequired(d, this.values(), this.requiredMode(), group.get(d.key)?.value);
  }

  // ─── Repeatable rows ─────────────────────────────────────────────────────

  addRow(group: FormGroup, d: FieldDescriptor): void {
    const array = group.get(d.key) as FormArray;
    array.push(buildRowGroup(this.fb, d.fields ?? []));
  }

  removeRow(group: FormGroup, d: FieldDescriptor, index: number): void {
    const array = group.get(d.key) as FormArray;
    array.removeAt(index);
  }

  /** Row heading: "Contact 1", "Dependant 2", … */
  rowLabel(d: FieldDescriptor, index: number): string {
    this.i18nTick();
    const key = d.rowLabelKey ?? d.labelKey;
    return `${this.translate.instant(key)} ${index + 1}`;
  }

  // ─── Options ─────────────────────────────────────────────────────────────

  optionsFor(d: FieldDescriptor): FieldOption[] {
    if (d.optionSource) return this.optionSources()[d.optionSource] ?? [];
    return d.options ?? [];
  }

  /** The paged loader for a descriptor, or null when its options are static. */
  loaderFor(d: FieldDescriptor): DropdownLoadFn<FieldOption> | null {
    return d.loaderSource ? this.optionLoaders()[d.loaderSource] ?? null : null;
  }

  suggestionsFor(d: FieldDescriptor): string[] {
    return d.suggestionSource ? this.suggestionSources()[d.suggestionSource] ?? [] : [];
  }

  computedText(parentPath: string, d: FieldDescriptor): string {
    return this.computedValues()[this.fullPath(parentPath, d)] ?? '—';
  }

  optionDisplay = (o: FieldOption): string => {
    this.i18nTick();
    if (!o) return '';
    return o.labelKey ? this.translate.instant(o.labelKey) : o.label ?? o.value;
  };
  optionToValue = (o: FieldOption): string => o?.value ?? (o as unknown as string);
  optionCompare = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);

  // ─── Errors ──────────────────────────────────────────────────────────────

  /** First error on a control, as a translation key + params. `null` when the
   *  control is untouched or valid. */
  errorFor(control: FormControl | null): { key: string; params?: Record<string, any> } | null {
    if (!control || !control.touched || !control.errors) return null;
    const e = control.errors;
    if (e['required'])  return { key: 'EMPLOYEES.FORM.REQUIRED' };
    if (e['email'])     return { key: 'EMPLOYEES.FORM.EMAIL_INVALID' };
    if (e['pattern'])   return { key: 'EMPLOYEES.FIELDS.VALIDATION.FORMAT' };
    if (e['maxlength']) return { key: 'EMPLOYEES.FIELDS.VALIDATION.MAX_LENGTH', params: { max: e['maxlength'].requiredLength } };
    if (e['min'])       return { key: 'EMPLOYEES.FIELDS.VALIDATION.MIN', params: { min: e['min'].min } };
    if (e['max'])       return { key: 'EMPLOYEES.FIELDS.VALIDATION.MAX', params: { max: e['max'].max } };
    return { key: 'EMPLOYEES.FIELDS.VALIDATION.INVALID' };
  }

  invalid(control: FormControl | null): boolean {
    return !!control && control.touched && control.invalid;
  }
}
