import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Small swap button next to a rounded money figure (cost / total / profit)
 * that flips it to the exact, unrounded value and back. The parent owns the
 * boolean and passes it to `mycurrency:{ exact }`.
 */
@Component({
  selector: 'app-exact-toggle',
  standalone: true,
  imports: [TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="et" [class.is-on]="on()"
      [title]="(on() ? 'COMMON.SHOW_ROUNDED' : 'COMMON.SHOW_EXACT') | translate"
      [attr.aria-pressed]="on()" (click)="toggle.emit(); $event.stopPropagation()">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>
      </svg>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; vertical-align: middle; }
    .et {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; padding: 0; border-radius: 50%;
      border: 1px solid #d0d5dd; background: #fff; color: #64748b; cursor: pointer;
    }
    .et:hover { background: #f1f5f9; }
    .et.is-on { background: #e0f2f6; border-color: #2691a4; color: #1e6f80; }
  `],
})
export class ExactToggleComponent {
  on = input<boolean>(false);
  toggle = output<void>();
}
