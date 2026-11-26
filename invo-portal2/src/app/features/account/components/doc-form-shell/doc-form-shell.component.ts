import { FormActionsComponent, FormActionPrimaryDirective, FormActionSecondaryDirective, FormActionSplitDirective } from '@shared/components/form-actions/form-actions.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import '../../account-i18n';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { MycurrencyPipe } from '@core/pipes/mycurrency.pipe';
import type { BreadcrumbItem } from '@shared/components/breadcrumbs/breadcrumbs.types';
import { DropdownMenuBtnComponent, DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

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
  imports: [FormActionsComponent, FormActionPrimaryDirective, FormActionSecondaryDirective, FormActionSplitDirective, PageHeaderComponent, TranslateModule, MycurrencyPipe, DropdownMenuBtnComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './doc-form-shell.component.scss',
  template: `
    <div class="df-page">
      <app-page-header [title]="title()" [trail]="breadcrumbs()">
        <app-form-actions pageActions>
          <!-- The page's own extra actions (Make recurring, Convert to invoice …) lead the row. -->
          <ng-content select="[footerExtra]" ngProjectAs="[formActionExtra]"/>
          @if (canDraft()) {
            <button type="button" formActionSecondary [disabled]="submitting() || draftDisabled()" (click)="draft.emit()">{{ draftLabel() || ('DOC_FORM.SAVE_AS_DRAFT' | translate) }}</button>
          }
          @if (showView()) {
            <button type="button" formActionSecondary (click)="view.emit()">{{ 'COMMON.VIEW' | translate }}</button>
          }
          @if (actionsMenu().length) {
            <app-dropdown-menu-btn [items]="actionsMenu()" [disabled]="submitting()" [appendToBody]="true" align="start" triggerClass="fa-btn fa-btn--secondary">{{ 'DOC_VIEW.ACTIONS' | translate }}</app-dropdown-menu-btn>
          }
          <button type="button" formActionSecondary (click)="cancel.emit()">{{ 'COMMON.CANCEL' | translate }}</button>
          <span formActionSplit>
            <button type="button" formActionPrimary [disabled]="submitting() || saveDisabled()" (click)="save.emit()">{{ saveLabel() || ('DOC_FORM.SAVE_AND_SEND' | translate) }}</button>
            @if (saveMenu().length) {
              <app-dropdown-menu-btn [items]="saveMenu()" [disabled]="submitting() || saveDisabled()" [appendToBody]="true" [chevron]="false" align="start" triggerClass="fa-btn fa-btn--primary fa-split__caret"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"/></svg></app-dropdown-menu-btn>
            }
          </span>
        </app-form-actions>
      </app-page-header>

      <ng-content/>

      <!-- Totals only (no buttons): a sticky bar at the bottom so they stay in view while editing long line items. -->
      <div class="df-totals">
        <div class="df-sum">
          <div class="df-sum__total">{{ 'DOC_FORM.TOTAL_AMOUNT' | translate }}: <b>{{ total() | mycurrency }}</b></div>
          <div class="df-sum__qty">{{ 'DOC_FORM.TOTAL_QUANTITY' | translate }}: {{ totalQty() }}</div>
        </div>
      </div>
    </div>
  `,
})
export class DocFormShellComponent {
  title = input<string>('');
  breadcrumbs = input<BreadcrumbItem[]>([]);
  canDraft = input<boolean>(true);
  submitting = input<boolean>(false);
  /** Form incomplete: Save / Save as draft stay disabled until it is. */
  saveDisabled = input<boolean>(false);
  draftDisabled = input<boolean>(false);
  showView = input<boolean>(false);
  draftLabel = input<string>('');
  saveLabel = input<string>('');
  saveMenu = input<DropdownMenuBtnItem[]>([]);
  /** Document-level "Actions" dropdown (clone, credit note, delete…) beside Cancel / View; hidden when empty. */
  actionsMenu = input<DropdownMenuBtnItem[]>([]);
  total = input<number>(0);
  totalQty = input<number>(0);

  draft = output<void>();
  save = output<void>();
  cancel = output<void>();
  view = output<void>();
}
