import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** One-click suggestions: each chip adds that text as a new reason. Presentational only; the parent decides what happens on pick. */
@Component({
  selector: 'app-suggestion-chips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (suggestions().length) {
      <div class="sc" role="group" [attr.aria-label]="label()">
        <span class="sc__label">{{ label() }}</span>
        @for (s of suggestions(); track s) {
          <button type="button" class="sc__chip" [disabled]="disabled()" (click)="pick.emit(s)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {{ s }}
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .sc { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .sc__label { font-size: 12px; color: var(--ui-muted); margin-inline-end: 2px; }
    .sc__chip {
      display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px;
      border: 1px dashed var(--ui-line-strong); background: var(--ui-surface); color: var(--ui-text-4); font: inherit; font-size: 12.5px; cursor: pointer;
      transition: background .12s, border-color .12s, color .12s;
    }
    .sc__chip:hover:not(:disabled) { background: var(--ui-brand-soft); border-color: var(--color-brand-600, #2691a4); color: var(--ui-brand-t700); }
    .sc__chip:focus-visible { outline: 2px solid var(--color-brand-600, #2691a4); outline-offset: 2px; }
    .sc__chip:disabled { opacity: .5; cursor: not-allowed; }
  `],
})
export class SuggestionChipsComponent {
  suggestions = input<readonly string[]>([]);
  label = input('');
  disabled = input(false);
  pick = output<string>();
}
