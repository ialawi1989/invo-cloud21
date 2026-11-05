import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type EmptyStateIcon = 'document' | 'box' | 'star' | 'book' | 'shield' | 'calendar' | 'wallet' | 'list';

/**
 * <app-empty-state>
 * ─────────────────
 * Icon, bold headline, one-line body and an optional action.
 *
 *   <app-empty-state icon="document" [title]="…" [body]="…">
 *     <button class="btn btn-primary">Add document</button>
 *   </app-empty-state>
 *
 * Any projected content is the action row.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="es__icon" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        @switch (icon()) {
          @case ('document') { <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/> }
          @case ('box') { <path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/> }
          @case ('star') { <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/> }
          @case ('book') { <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/> }
          @case ('shield') { <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/> }
          @case ('calendar') { <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/> }
          @case ('wallet') { <path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1"/> }
          @default { <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/> }
        }
      </svg>
    </div>
    <h3 class="es__title">{{ title() }}</h3>
    @if (body()) { <p class="es__body">{{ body() }}</p> }
    <div class="es__action"><ng-content/></div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 6px;
      padding: 28px 16px;
    }
    .es__icon {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--color-brand-50);
      color: var(--color-brand-700);
      margin-bottom: 4px;
    }
    .es__title { margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; }
    .es__body { margin: 0; font-size: 13px; color: #475569; max-width: 420px; }
    .es__action { margin-top: 10px; display: flex; gap: 8px; }
    .es__action:empty { display: none; }
  `],
})
export class EmptyStateComponent {
  readonly icon = input<EmptyStateIcon>('list');
  readonly title = input.required<string>();
  readonly body = input<string>('');
}
