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

import { withTranslations } from '@core/i18n/with-translations';
import { PageTypeService } from './page-type.service';
import { ListingSource, SettingField } from './page-type.types';

/**
 * Renders a page's settings form from the manifest.
 *
 * Every field the merchant sees — and the exact key it saves under — comes from
 * the backend manifest, so adding a setting is a one-place change instead of
 * "edit the dashboard catalog, then edit the storefront component, then hope
 * they agree".
 *
 * Emits the full settings object on every change; the host owns saving into
 * `template.settings`, whose keys are unchanged from the legacy catalog.
 */
@Component({
  selector: 'app-page-settings-form',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ToggleComponent, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (group of groups(); track group.key) {
      <section class="ps-group">
        <h3 class="ps-group__title">{{ group.title }}</h3>

        @for (field of group.fields; track field.key) {
          @if (visible(field)) {
            <div class="ps-field" [class.ps-field--inline]="field.type === 'boolean'">
              <label class="ps-field__label" [attr.for]="'ps-' + field.key">
                {{ field.title }}
                @if (field.hint) { <small class="ps-field__hint">{{ field.hint }}</small> }
              </label>

              @switch (field.type) {
                @case ('boolean') {
                  <app-toggle
                    [checked]="!!value(field.key)"
                    (checkedChange)="set(field.key, $event)"/>
                }
                @case ('select') {
                  <app-search-dropdown
                    [items]="field.options ?? []"
                    [displayWith]="optionLabel"
                    [toValue]="optionValue"
                    [compareWith]="optionCompare"
                    [searchable]="(field.options?.length ?? 0) > 8"
                    [value]="value(field.key)"
                    (valueChange)="set(field.key, $any($event))"/>
                }
                @case ('multi-select') {
                  <div class="ps-checks">
                    @for (opt of field.options ?? []; track opt.value) {
                      <label class="ps-check">
                        <input type="checkbox"
                               [checked]="hasValue(field.key, opt.value)"
                               (change)="toggleMulti(field.key, opt.value)"/>
                        <span>{{ opt.title }}</span>
                      </label>
                    }
                  </div>
                }
                @case ('number') {
                  <input type="number" class="input" [id]="'ps-' + field.key"
                         [value]="value(field.key) ?? ''"
                         (input)="set(field.key, +$any($event.target).value)"/>
                }
                @default {
                  <!-- text + image. Image picking is the host's job (media
                       library lives in the products feature); we keep the
                       stored value intact and let the host swap in a picker. -->
                  <input type="text" class="input" [id]="'ps-' + field.key"
                         [value]="value(field.key) ?? ''"
                         (input)="set(field.key, $any($event.target).value)"/>
                }
              }
            </div>
          }
        }
      </section>
    } @empty {
      <p class="ps-empty">{{ 'WEBSITE.PAGE_TYPES.NO_SETTINGS' | translate }}</p>
    }
  `,
  styles: [`
    .ps-group + .ps-group { margin-top: 20px; }
    .ps-group__title { margin: 0 0 10px; font-size: 13px; font-weight: 700; color: #0f172a; }
    .ps-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .ps-field--inline { flex-direction: row; align-items: center; justify-content: space-between; }
    .ps-field__label { font-size: 12px; color: #64748b; display: flex; flex-direction: column; gap: 2px; }
    .ps-field__hint { font-size: 11px; color: #94a3b8; }
    .ps-checks { display: flex; flex-wrap: wrap; gap: 10px 16px; }
    .ps-check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #334155; cursor: pointer; }
    .ps-empty { font-size: 13px; color: #94a3b8; margin: 0; }
    .input {
      padding: 7px 10px; font-size: 13px; border: 1px solid #dbe2ea;
      border-radius: 8px; background: #fff; color: #1e293b; width: 100%;
    }
  `],
})
export class PageSettingsFormComponent {
  private registry = inject(PageTypeService);

  constructor() {
    withTranslations('website/page-types');
    // The schema drives the form, so it has to be here before the first render.
    void this.registry.load();
  }

  /** Page type id, e.g. `product-list`. */
  pageType = input.required<string>();
  /** Stored `template.settings` for this page. */
  settings = input<Record<string, any>>({});
  /** Listing source — drives `source.*` conditional fields. */
  source   = input<ListingSource | null>(null);

  settingsChange = output<Record<string, any>>();

  /** Working copy, seeded from the input with manifest defaults applied. */
  private working = signal<Record<string, any> | null>(null);

  private values = computed<Record<string, any>>(() =>
    this.working() ?? this.registry.withDefaults(this.pageType(), this.settings()),
  );

  groups = computed(() => this.registry.typeDef(this.pageType())?.settings ?? []);

  value(key: string): any { return this.values()[key]; }

  hasValue(key: string, option: string): boolean {
    const v = this.values()[key];
    return Array.isArray(v) && v.includes(option);
  }

  visible(field: SettingField): boolean {
    return this.registry.isVisible(field, this.values(), this.source());
  }

  set(key: string, value: any): void {
    const next = { ...this.values(), [key]: value };
    this.working.set(next);
    this.settingsChange.emit(next);
  }

  toggleMulti(key: string, option: string): void {
    const current: string[] = Array.isArray(this.values()[key]) ? [...this.values()[key]] : [];
    const at = current.indexOf(option);
    if (at >= 0) current.splice(at, 1); else current.push(option);
    this.set(key, current);
  }

  // Dropdown adapters — options are `{ title, value }`.
  optionLabel   = (o: any): string => (typeof o === 'object' ? o?.title ?? '' : String(o ?? ''));
  optionValue   = (o: any): string => (typeof o === 'object' ? o?.value ?? '' : String(o ?? ''));
  optionCompare = (a: any, b: any): boolean => (a?.value ?? a) === (b?.value ?? b);
}
