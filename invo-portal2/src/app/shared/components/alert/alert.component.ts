import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AlertVariant = 'warning' | 'info' | 'danger';

/**
 * <app-alert>
 * ───────────
 * Inline callout: icon, message and an optional action on the right.
 *
 *   <app-alert variant="warning">
 *     No leave entitlement is set…
 *     <button alertAction class="btn btn-default btn-sm">Set entitlement</button>
 *   </app-alert>
 *
 * The message is the default slot; the action is projected with `alertAction`.
 * The colour tokens live on `:host` so a re-theme touches one block.
 */
@Component({
  selector: 'app-alert',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"alert alert--" + variant()',
    '[attr.role]': 'variant() === "danger" ? "alert" : "status"',
  },
  template: `
    <svg class="alert__icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @if (variant() === 'info') {
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      } @else {
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      }
    </svg>
    <div class="alert__body"><ng-content/></div>
    <div class="alert__action"><ng-content select="[alertAction]"/></div>
  `,
  styles: [`
    :host {
      --alert-bg: #fffbeb;
      --alert-border: #fde68a;
      --alert-fg: #92400e;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid var(--alert-border);
      background: var(--alert-bg);
      color: var(--alert-fg);
      font-size: 13px;
      line-height: 1.5;
    }
    :host(.alert--info) {
      --alert-bg: var(--color-brand-50);
      --alert-border: var(--color-brand-200);
      --alert-fg: var(--color-brand-800);
    }
    :host(.alert--danger) {
      --alert-bg: #fef2f2;
      --alert-border: #fecaca;
      --alert-fg: #991b1b;
    }
    .alert__icon { flex-shrink: 0; }
    .alert__body { flex: 1; min-width: 0; }
    .alert__action { flex-shrink: 0; display: flex; gap: 8px; }
    .alert__action:empty { display: none; }
  `],
})
export class AlertComponent {
  readonly variant = input<AlertVariant>('warning');
}
