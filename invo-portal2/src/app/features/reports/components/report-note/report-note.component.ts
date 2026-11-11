import { Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/** The notice under a report's filters — a yellow warning ("may not be fully accurate …"), a red alert or a blue information note. */
@Component({
  selector: 'app-report-note',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <div class="rn" [class.rn-info]="type() === 'info'" [class.rn-danger]="type() === 'danger'" role="note">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        @if (type() === 'info') {
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        } @else {
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        }
      </svg>
      <span>{{ key() | translate: params() }}</span>
    </div>
  `,
  styles: [`
    :host { display: block; margin-bottom: 16px; }
    .rn {
      display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 10px; font-size: 13.5px;
      background: #fff8e1; border: 1px solid #f5d77a; color: #7a5b00;
    }
    .rn svg { flex: none; }
    .rn-info { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }
    .rn-danger { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
  `],
})
export class ReportNoteComponent {
  /** i18n key of the note text. */
  key = input.required<string>();
  type = input<'warning' | 'info' | 'danger'>('warning');
  /** Values the note text interpolates (`{{count}}`). */
  params = input<Record<string, unknown>>({});
}
