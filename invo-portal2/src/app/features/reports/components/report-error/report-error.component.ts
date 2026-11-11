import { Component, computed, input, output, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * The error card of a report: an illustration, a plain-language title and hint, the technical message tucked
 * behind "Show details", and Retry. A request that never got an answer (status 0 / "Unknown Error") is shown as a
 * connection problem, since that is what it is — the server was not reached.
 */
@Component({
  selector: 'app-report-error',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './report-error.component.html',
  styleUrl: './report-error.component.scss',
})
export class ReportErrorComponent {
  /** The error message the report got (may be technical). */
  message = input<string | null>(null);
  retry = output<void>();

  open = signal(false);
  /** The server was not reached (no HTTP status) — as opposed to an answer that says the request failed. */
  offline = computed(() => /unknown error|failed to fetch|network|http failure response.*: 0\b|ERR_CONNECTION/i.test(this.message() ?? ''));
}
