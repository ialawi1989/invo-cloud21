import '../../account-i18n';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import { BreadcrumbsComponent } from '@shared/components/breadcrumbs/breadcrumbs.component';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';
import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';

/**
 * Page template of every sales / purchase document form: header (breadcrumbs + title), the
 * form sections (projected), and the sticky save bar — Save as Draft, the split Save button
 * with its extra actions, Cancel, View, and the running total. It also owns the shared `df-*`
 * card / field / button styles the sections use, so every document form looks the same.
 *
 * Extra bar content (e.g. "Make Recurring") goes in an element with the `footerExtra` attribute.
 */
@Component({
  selector: 'app-doc-form-shell',
  standalone: true,
  imports: [TranslateModule, MycurrencyPipe, BreadcrumbsComponent, DropdownMenuBtnComponent, FormStickyFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './doc-form-shell.component.scss',
  template: `
    <div class="df-page">
      <header class="df-header">
        <app-breadcrumbs [items]="breadcrumbs()" separator="chevron"/>
        <h1 class="df-header__title">{{ title() }}</h1>
      </header>

      <ng-content/>

      <app-form-sticky-footer>
        <div class="df-bar">
          <div class="df-bar__actions">
            @if (canDraft()) {
              <button type="button" class="df-btn" [disabled]="submitting()" (click)="draft.emit()">{{ draftLabel() || ('DOC_FORM.SAVE_AS_DRAFT' | translate) }}</button>
            }
            <span class="df-split">
              <button type="button" class="df-btn df-btn--primary df-split__main" [disabled]="submitting()" (click)="save.emit()">{{ saveLabel() || ('DOC_FORM.SAVE_AND_SEND' | translate) }}</button>
              @if (saveMenu().length) {
                <app-dropdown-menu-btn [items]="saveMenu()" [appendToBody]="true" [chevron]="false" align="start" triggerClass="df-split__caret"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"/></svg></app-dropdown-menu-btn>
              }
            </span>
            <button type="button" class="df-btn" (click)="cancel.emit()">{{ 'COMMON.CANCEL' | translate }}</button>
            @if (showView()) {
              <button type="button" class="df-btn" (click)="view.emit()">{{ 'COMMON.VIEW' | translate }}</button>
            }
          </div>
          <div class="df-bar__side">
            <ng-content select="[footerExtra]"/>
            <div class="df-sum">
              <div class="df-sum__total">{{ 'DOC_FORM.TOTAL_AMOUNT' | translate }}: <b>{{ total() | mycurrency }}</b></div>
              <div class="df-sum__qty">{{ 'DOC_FORM.TOTAL_QUANTITY' | translate }}: {{ totalQty() }}</div>
            </div>
          </div>
        </div>
      </app-form-sticky-footer>
    </div>
  `,
})
export class DocFormShellComponent {
  title = input<string>('');
  breadcrumbs = input<BreadcrumbItem[]>([]);
  canDraft = input<boolean>(true);
  submitting = input<boolean>(false);
  showView = input<boolean>(false);
  draftLabel = input<string>('');
  saveLabel = input<string>('');
  saveMenu = input<DropdownMenuBtnItem[]>([]);
  total = input<number>(0);
  totalQty = input<number>(0);

  draft = output<void>();
  save = output<void>();
  cancel = output<void>();
  view = output<void>();
}
