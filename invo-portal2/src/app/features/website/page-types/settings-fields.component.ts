import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ToggleComponent } from '@shared/components/toggle/toggle.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';

import { PageTypeService } from './page-type.service';
import { FieldOption, ListingSource, SettingField, SettingGroup } from './page-type.types';

/**
 * Renders a group of settings from a schema.
 *
 * Deliberately knows nothing about pages: it takes groups + values and emits
 * values. That's what lets one renderer serve BOTH page settings (schema from
 * the page-type manifest) and website settings (schema from the site-config
 * manifest) — the alternative is two form builders drifting apart, which is the
 * duplication this whole registry exists to end.
 *
 * Dynamic option lists (e.g. "which listing is the primary one") arrive through
 * `optionSources`, so the schema can name a source without the backend knowing
 * a tenant's pages.
 */
@Component({
  selector: 'app-settings-fields',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ToggleComponent, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (group of groups(); track group.key) {
      <section class="sf-group">
        @if (group.title) { <h3 class="sf-group__title">{{ group.title }}</h3> }

        @for (field of group.fields; track field.key) {
          @if (visible(field)) {
            <div class="sf-field" [class.sf-field--inline]="field.type === 'boolean'">
              <label class="sf-field__label" [attr.for]="'sf-' + field.key">
                {{ field.title }}
                @if (field.hint) { <small class="sf-field__hint">{{ field.hint }}</small> }
              </label>

              @switch (field.type) {
                @case ('boolean') {
                  <app-toggle
                    [checked]="!!value(field.key)"
                    (checkedChange)="set(field.key, $event)"/>
                }
                @case ('select') {
                  <app-search-dropdown
                    [items]="optionsFor(field)"
                    [displayWith]="optionLabel"
                    [toValue]="optionValue"
                    [compareWith]="optionCompare"
                    [searchable]="optionsFor(field).length > 8"
                    [value]="value(field.key)"
                    (valueChange)="set(field.key, $any($event))"/>
                }
                @case ('multi-select') {
                  <div class="sf-checks">
                    @for (opt of optionsFor(field); track opt.value) {
                      <label class="sf-check">
                        <input type="checkbox"
                               [checked]="hasValue(field.key, opt.value)"
                               (change)="toggleMulti(field.key, opt.value)"/>
                        <span>{{ opt.title }}</span>
                      </label>
                    }
                  </div>
                }
                @case ('number') {
                  <input type="number" class="sf-input" [id]="'sf-' + field.key"
                         [value]="value(field.key) ?? ''"
                         (input)="set(field.key, +$any($event.target).value)"/>
                }
                @default {
                  <input type="text" class="sf-input" [id]="'sf-' + field.key"
                         [value]="value(field.key) ?? ''"
                         (input)="set(field.key, $any($event.target).value)"/>
                }
              }
            </div>
          }
        }
      </section>
    } @empty {
      <p class="sf-empty">{{ 'WEBSITE.PAGE_TYPES.NO_SETTINGS' | translate }}</p>
    }
  `,
  styles: [`
    .sf-group + .sf-group { margin-top: 22px; }
    .sf-group__title { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #0f172a; }
    .sf-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .sf-field--inline { flex-direction: row; align-items: center; justify-content: space-between; }
    .sf-field__label { font-size: 12px; color: #64748b; display: flex; flex-direction: column; gap: 2px; }
    .sf-field__hint { font-size: 11px; color: #94a3b8; }
    .sf-checks { display: flex; flex-wrap: wrap; gap: 10px 16px; }
    .sf-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #334155; cursor: pointer; }
    .sf-empty { font-size: 13px; color: #94a3b8; margin: 0; }
    .sf-input {
      padding: 7px 10px; font-size: 13px; border: 1px solid #dbe2ea;
      border-radius: 8px; background: #fff; color: #1e293b; width: 100%;
    }
  `],
})
export class SettingsFieldsComponent {
  private registry = inject(PageTypeService);

  groups = input<SettingGroup[]>([]);
  values = input<Record<string, any>>({});
  /** Drives `source.*` conditions (page settings only). */
  source = input<ListingSource | null>(null);
  /** Option lists the schema names but can't know: `{ listingPages: [...] }`. */
  optionSources = input<Record<string, FieldOption[]>>({});

  valuesChange = output<Record<string, any>>();

  private working = signal<Record<string, any> | null>(null);

  private current = computed<Record<string, any>>(() => this.working() ?? this.values());

  value(key: string): any { return this.current()[key]; }

  hasValue(key: string, option: string): boolean {
    const v = this.current()[key];
    return Array.isArray(v) && v.includes(option);
  }

  /** A retired option stays in storage but never in the editor. */
  visible(field: SettingField): boolean {
    if (field.deprecated) return false;
    return this.registry.isVisible(field, this.current(), this.source());
  }

  optionsFor(field: SettingField): FieldOption[] {
    if (field.optionsSource) return this.optionSources()[field.optionsSource] ?? [];
    return field.options ?? [];
  }

  set(key: string, value: any): void {
    const next = { ...this.current(), [key]: value };
    this.working.set(next);
    this.valuesChange.emit(next);
  }

  toggleMulti(key: string, option: string): void {
    const current: string[] = Array.isArray(this.current()[key]) ? [...this.current()[key]] : [];
    const at = current.indexOf(option);
    if (at >= 0) current.splice(at, 1); else current.push(option);
    this.set(key, current);
  }

  optionLabel   = (o: any): string => (typeof o === 'object' ? o?.title ?? '' : String(o ?? ''));
  optionValue   = (o: any): string => (typeof o === 'object' ? o?.value ?? '' : String(o ?? ''));
  optionCompare = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);
}
