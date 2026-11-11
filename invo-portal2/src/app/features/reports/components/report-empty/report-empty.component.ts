import { Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * The "nothing to show" state of a report: an illustration, a title and a hint to widen the period or the filters.
 * Every report body uses it, so an empty report looks the same everywhere.
 */
@Component({
  selector: 'app-report-empty',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './report-empty.component.html',
  styleUrl: './report-empty.component.scss',
})
export class ReportEmptyComponent {
  /** i18n keys; the defaults fit every report. */
  titleKey = input('REPORTS.EMPTY.TITLE');
  hintKey = input('REPORTS.EMPTY.HINT');
}
