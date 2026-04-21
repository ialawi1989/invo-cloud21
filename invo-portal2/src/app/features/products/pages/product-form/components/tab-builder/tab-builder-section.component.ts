import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { TabDataEditorComponent } from '@shared/components/tab-builder/tab-data-editor.component';
import { TabDataMap, TabTemplate } from '@shared/components/tab-builder/tab-builder.types';
import { TabBuilderSettingsService } from '../../../../../settings/services/tab-builder.service';
import { Product } from '../../../../models/product-form.model';
import { Fields } from '../../../../models/product-fields.model';

/**
 * Product-form section mounting the shared `TabDataEditorComponent`.
 * Fetches the company-wide templates once, then renders only active tabs
 * for the user to fill in. Writes back to `productInfo.tabBuilder`.
 */
@Component({
  selector: 'app-pf-tab-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslateModule, TabDataEditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="pf-card">
      <header class="pf-card__header">
        <div class="pf-card__icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="5" x2="9" y2="9"/>
          </svg>
        </div>
        <h2 class="pf-card__title">{{ 'PRODUCTS.FORM.TAB_BUILDER' | translate }}</h2>
      </header>

      <div class="pf-card__body">
        <div class="hint-banner">
          <svg class="hint-banner__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9"  x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p class="hint-banner__text">{{ 'PRODUCTS.FORM.TAB_BUILDER_HINT' | translate }}</p>
          <a
            routerLink="/settings/tab-builder"
            target="_blank"
            rel="noopener"
            class="hint-banner__link"
          >
            {{ 'PRODUCTS.FORM.TAB_BUILDER_OPEN_SETTINGS' | translate }}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>

        @if (loading()) {
          <div class="loading"><span class="spinner"></span></div>
        } @else if (templates().length === 0) {
          <p class="muted">{{ 'PRODUCTS.FORM.TAB_BUILDER_NO_TEMPLATES' | translate }}</p>
        } @else {
          <app-tab-data-editor
            [templates]="templates()"
            [productType]="productInfo().type || null"
            [value]="value()"
            (valueChange)="onChange($event)"
          />
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }

    .pf-card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      overflow: hidden;
    }
    .pf-card__header {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 18px; border-bottom: 1px solid #f1f5f9;
    }
    .pf-card__icon {
      width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
      background: #eff9fb; color: #32acc1;
      display: flex; align-items: center; justify-content: center;
    }
    .pf-card__title { font-size: 14px; font-weight: 600; color: #1e293b; margin: 0; }
    .pf-card__body  { padding: 14px 18px; }

    .hint-banner {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; margin: 0 0 14px;
      background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px;
      color: #92400e;

      &__icon { color: #d97706; flex-shrink: 0; }
      &__text { margin: 0; font-size: 12px; line-height: 1.5; flex: 1; }
      &__link {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 5px 10px; border-radius: 6px;
        background: #fcd34d; color: #78350f;
        font-size: 12px; font-weight: 600;
        text-decoration: none; flex-shrink: 0;
        transition: background .12s;

        &:hover { background: #fbbf24; color: #451a03; }
      }

      @media (max-width: 640px) {
        flex-wrap: wrap;
        &__link { width: 100%; justify-content: center; }
      }
    }

    .muted   { color: #94a3b8; font-size: 13px; margin: 0; }
    .loading { display: flex; justify-content: center; padding: 28px 0; }
    .spinner {
      width: 22px; height: 22px; border-radius: 50%;
      border: 3px solid #e2e8f0; border-top-color: #32acc1;
      display: inline-block; animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class ProductTabBuilderSectionComponent implements OnInit {
  private tabBuilderSvc = inject(TabBuilderSettingsService);

  productInfo   = input.required<Product>();
  productForm   = input.required<FormGroup>();
  fieldsOptions = input<Fields | null>(null);

  templates = signal<TabTemplate[]>([]);
  value     = signal<TabDataMap>({});
  loading   = signal<boolean>(true);

  async ngOnInit(): Promise<void> {
    // Seed local value from the product first so the editor renders saved data
    // even while templates are still loading.
    const p = this.productInfo();
    this.value.set({ ...((p?.tabBuilder as TabDataMap) ?? {}) });

    try {
      this.templates.set(await this.tabBuilderSvc.getTemplates());
    } finally {
      this.loading.set(false);
    }
  }

  onChange(next: TabDataMap): void {
    this.value.set(next);
    const p = this.productInfo();
    if (p) p.tabBuilder = next;
    this.productForm().markAsDirty();
  }
}
