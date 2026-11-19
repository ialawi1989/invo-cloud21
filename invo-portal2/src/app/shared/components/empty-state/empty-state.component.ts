import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The illustration shown for the section the empty state belongs to. */
export type EmptyStateIcon =
  | 'document' | 'box' | 'star' | 'book' | 'shield' | 'calendar' | 'wallet' | 'list'
  | 'search' | 'users' | 'receipt' | 'tag' | 'cart' | 'truck' | 'package' | 'error';

/**
 * <app-empty-state>
 * ─────────────────
 * The one "no data" / "could not load" message of the app: a soft illustration (picked by `icon`, so each section
 * shows its own), a bold headline, a one-line body and an optional action row.
 *
 *   <app-empty-state icon="package" [title]="…" [body]="…">
 *     <button class="btn btn-primary">Add item</button>
 *   </app-empty-state>
 *
 * Pick the illustration by section: `document` (documents/templates), `box` / `package` (products, items, stock),
 * `users` (customers/employees/suppliers), `receipt` (invoices/bills), `wallet` (payments/accounts), `calendar`
 * (appointments/schedule), `tag` (discounts/labels), `cart` (orders), `truck` (shipping), `shield` (security),
 * `star` (reviews/performance), `book` (catalogs/knowledge), `search` (no results), `error` (failed to load),
 * `list` (anything else). `tone="error"` tints it red; `icon="error"` implies it.
 * Any projected content is the action row.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="es__art" [class.es__art--error]="isError()" aria-hidden="true">
      <svg viewBox="0 0 160 120" width="160" height="120" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <!-- backdrop: soft blob + sparkles, shared by every illustration -->
        <ellipse class="es__blob" cx="80" cy="62" rx="62" ry="46"/>
        <circle class="es__dot" cx="22" cy="30" r="3"/>
        <circle class="es__dot" cx="140" cy="20" r="4"/>
        <circle class="es__dot" cx="132" cy="100" r="2.5"/>
        <path class="es__spark" d="M28 92v8M24 96h8"/>
        <path class="es__spark" d="M138 56v6M135 59h6"/>
        <ellipse class="es__shadow" cx="80" cy="108" rx="30" ry="4"/>
        <g class="es__glyph" transform="translate(50 26) scale(2.5)">
          @switch (icon()) {
            @case ('document') { <path class="es__fill" d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/> }
            @case ('box') { <path class="es__fill" d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/> }
            @case ('package') { <path class="es__fill" d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8M7.5 5.5l9 5"/> }
            @case ('star') { <path class="es__fill" d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/> }
            @case ('book') { <path class="es__fill" d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M9 8h6"/> }
            @case ('shield') { <path class="es__fill" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/> }
            @case ('calendar') { <rect class="es__fill" x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/> }
            @case ('wallet') { <path class="es__fill" d="M3 7a2 2 0 0 1 2-2h13v4"/><path class="es__fill" d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1"/> }
            @case ('search') { <circle class="es__fill" cx="11" cy="11" r="7"/><path d="m20 20-4-4M8.5 11h5"/> }
            @case ('users') { <circle class="es__fill" cx="9" cy="8" r="3.5"/><path class="es__fill" d="M2.5 20a6.5 6.5 0 0 1 13 0z"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/> }
            @case ('receipt') { <path class="es__fill" d="M5 3h14v18l-2.3-1.6L14.3 21 12 19.4 9.7 21l-2.4-1.6L5 21z"/><path d="M9 8h6M9 12h6M9 16h3"/> }
            @case ('tag') { <path class="es__fill" d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.4"/> }
            @case ('cart') { <path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21 7H6"/><path class="es__fill" d="M6 7h15l-1.6 6.8a2 2 0 0 1-2 1.5H9.4a2 2 0 0 1-2-1.6z"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/> }
            @case ('truck') { <path class="es__fill" d="M2 6h12v10H2z"/><path class="es__fill" d="M14 9h4l3 3.5V16h-7z"/><circle cx="7" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/> }
            @case ('error') { <circle class="es__fill" cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5"/><circle cx="12" cy="16.6" r=".6"/> }
            @default { <rect class="es__fill" x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h4"/> }
          }
        </g>
      </svg>
    </div>
    <h3 class="es__title">{{ title() }}</h3>
    @if (body()) { <p class="es__body">{{ body() }}</p> }
    <div class="es__action"><ng-content/></div>
  `,
  styles: [`
    :host {
      --es-main: var(--color-brand-700, #2691a4);
      --es-soft: var(--color-brand-50, var(--ui-x-e8f6f9));
      --es-mid: var(--color-brand-200, #b7e0e8);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 6px;
      padding: 28px 16px;
    }
    .es__art--error { --es-main: #b42318; --es-soft: var(--ui-x-fef3f2); --es-mid: #fecdca; }
    .es__art svg { display: block; max-width: 100%; height: auto; }
    .es__blob { fill: var(--es-soft); }
    .es__dot { fill: var(--es-mid); }
    .es__spark { stroke: var(--es-mid); stroke-width: 2; }
    .es__shadow { fill: var(--es-mid); opacity: .45; }
    .es__glyph { stroke: var(--es-main); stroke-width: 1.4; fill: none; }
    .es__fill { fill: #fff; }
    .es__title { margin: 6px 0 0; font-size: 15px; font-weight: 700; color: var(--ui-text); }
    .es__body { margin: 0; font-size: 13px; line-height: 1.5; color: var(--ui-muted); max-width: 420px; }
    .es__art--error ~ .es__title { color: var(--ui-t-b42318); }
    .es__action { margin-top: 10px; display: flex; gap: 8px; }
    .es__action:empty { display: none; }
  `],
})
export class EmptyStateComponent {
  readonly icon = input<EmptyStateIcon>('list');
  readonly title = input.required<string>();
  readonly body = input<string>('');
  /** `error` tints the illustration and headline red (a failed load, as opposed to "nothing here yet"). */
  readonly tone = input<'neutral' | 'error'>('neutral');

  isError(): boolean { return this.tone() === 'error' || this.icon() === 'error'; }
}
