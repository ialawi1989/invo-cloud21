import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/** Shared loading / error / empty panel for the Business Overview reports. */
@Component({
  selector: 'app-bo-state',
  standalone: true,
  imports: [TranslateModule],
  template: `
    @if (loading()) {
      <div class="st-skel" aria-busy="true">
        @for (r of rows; track r) { <div class="st-line" [style.width.%]="40 + ((r * 17) % 55)"></div> }
      </div>
    } @else if (error()) {
      <div class="st-box st-error" role="alert">
        <p>{{ error() }}</p>
        <button type="button" class="btn btn-default btn-sm" (click)="retry.emit()">{{ 'REPORTS.VIEW.RETRY' | translate }}</button>
      </div>
    } @else if (empty()) {
      <div class="st-box">
        <p class="st-title">{{ 'REPORTS.BO.NO_DATA' | translate }}</p>
        <p class="st-sub">{{ 'REPORTS.BO.NO_DATA_HINT' | translate }}</p>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .st-skel { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:12px; }
    .st-line { height:14px; border-radius:6px; background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 37%,#f1f5f9 63%); background-size:400% 100%; animation:st-sh 1.3s ease infinite; }
    @keyframes st-sh { 0%{background-position:100% 50%} 100%{background-position:0 50%} }
    .st-box { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:40px 20px; text-align:center; color:#64748b; }
    .st-error { color:#b91c1c; }
    .st-title { font-weight:600; color:#334155; margin:0 0 4px; }
    .st-sub { margin:0; font-size:13px; }
  `],
})
export class BoStateComponent {
  loading = input(false);
  error = input<string | null>(null);
  empty = input(false);
  retry = output<void>();
  readonly rows = Array.from({ length: 10 }, (_, i) => i);
}
