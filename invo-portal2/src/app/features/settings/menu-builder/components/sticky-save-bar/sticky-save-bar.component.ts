import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { FormActionsComponent, FormActionPrimaryDirective, FormActionSecondaryDirective } from '@shared/components/form-actions/form-actions.component';

/**
 * The menu builder's form actions — "Unsaved changes" on the leading side (only when dirty), Cancel, and the one primary "Save menu".
 * Presentational: it renders `<app-form-actions>` and is projected into the page header's `pageActions` slot.
 */
@Component({
  selector: 'app-sticky-save-bar',
  standalone: true,
  imports: [TranslateModule, FormActionsComponent, FormActionPrimaryDirective, FormActionSecondaryDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sticky-save-bar.component.html',
  styleUrl: './sticky-save-bar.component.scss',
})
export class StickySaveBarComponent {
  dirty = input(false);
  saving = input(false);
  cancel = output<void>();
  save = output<void>();
}
