import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { FormStickyFooterComponent } from '@shared/components/form-sticky-footer/form-sticky-footer.component';

/**
 * The action bar pinned to the bottom of the viewport: "Unsaved changes" on the leading side (only when dirty), Cancel and the one
 * primary "Save menu" on the trailing side. Presentational. It sits on the shared sticky footer; the page adds scroll-padding at the
 * bottom so a focused field is never hidden behind it.
 */
@Component({
  selector: 'app-sticky-save-bar',
  standalone: true,
  imports: [TranslateModule, FormStickyFooterComponent],
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
