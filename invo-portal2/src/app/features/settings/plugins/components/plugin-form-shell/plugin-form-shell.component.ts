import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';
import { LoadingOverlayComponent } from '@shared/components/spinner/loading-overlay.component';

/**
 * Shared chrome for a single-plugin configuration page.
 *
 * Wraps the repeated header (breadcrumbs + logo + title + intro), the
 * card body (projected fields), and the sticky Save/Back footer every
 * plugin form needs. Forms project their fields as default content and
 * own their own state — the shell only renders frame + emits `save`.
 */
@Component({
  selector: 'app-plugin-form-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    BreadcrumbsComponent,
    FormStickyFooterComponent,
    LoadingOverlayComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pf-page">
      <header class="pf-header">
        @if (breadcrumbs?.length) {
          <app-breadcrumbs [items]="breadcrumbs ?? []" separator="chevron"/>
        }
        <div class="pf-header__row">
          @if (logo) {
            <img class="pf-header__logo" [src]="logo" [alt]="title"/>
          }
          <div>
            <h1 class="pf-title">{{ title }}</h1>
            @if (intro) { <p class="pf-intro">{{ intro }}</p> }
          </div>
        </div>
      </header>

      <ng-content/>

      @if (showFooter) {
        <app-form-sticky-footer>
          <button type="button" class="btn btn-ghost" (click)="back.emit()">
            {{ 'PLUGINS.COMMON.BACK' | translate }}
          </button>
          <button type="button" class="btn btn-primary"
                  [disabled]="saving || !canSave"
                  (click)="save.emit()">
            {{ 'PLUGINS.COMMON.SAVE' | translate }}
          </button>
        </app-form-sticky-footer>
      }
    </div>

    <app-loading-overlay [show]="loading"/>
  `,
  styles: [`
    .pf-page { max-width: 880px; margin: 0 auto; padding: 16px 24px 110px; position: relative; }
    .pf-header { margin-bottom: 20px; }
    .pf-header__row { display: flex; align-items: center; gap: 14px; margin-top: 8px; }
    .pf-header__logo {
      width: 48px; height: 48px; border-radius: 10px; object-fit: contain;
      background: #f8fafc; border: 1px solid #f1f5f9; flex-shrink: 0;
    }
    .pf-title { margin: 0 0 2px; font-size: 22px; font-weight: 700; color: #0f172a; }
    .pf-intro { margin: 0; font-size: 14px; color: #64748b; max-width: 60ch; }
  `],
})
export class PluginFormShellComponent {
  @Input() title = '';
  @Input() intro = '';
  @Input() logo = '';
  @Input() breadcrumbs: BreadcrumbItem[] | null = null;
  @Input() loading = false;
  @Input() saving = false;
  @Input() canSave = true;
  @Input() showFooter = true;

  @Output() save = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
}
