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

import { withTranslations } from '@core/i18n/with-translations';
import { SettingsFieldsComponent } from './settings-fields.component';
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
  imports: [CommonModule, SettingsFieldsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- The fields themselves are drawn by the shared renderer, which also
         draws website settings. One form builder, two schemas — the split that
         let the old dashboard and storefront drift is exactly what this
         registry exists to prevent. -->
    <app-settings-fields
      [groups]="groups()"
      [values]="values()"
      [source]="source()"
      (valuesChange)="onChange($event)"/>
  `,
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

  /** The type's groups, straight from the manifest. */
  groups = computed(() => this.registry.typeDef(this.pageType())?.settings ?? []);

  /** Stored values with the manifest's defaults applied, so a page saved
   *  before a field existed still shows something sensible. */
  values = computed<Record<string, any>>(() =>
    this.registry.withDefaults(this.pageType(), this.settings()),
  );

  onChange(values: Record<string, any>): void {
    this.settingsChange.emit(values);
  }
}
