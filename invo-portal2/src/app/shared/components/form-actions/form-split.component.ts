import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, computed, inject, input, output, signal, viewChild,
} from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TooltipDirective } from '@shared/directives/tooltip.directive';
import type { DropdownMenuBtnItem } from '@shared/components/dropdown-menu-btn/dropdown-menu-btn.component';

/**
 * The primary action of a form with extra ways to save ("Save and Send" | ▾ Save and Print, Save and Share …).
 * Project it into `<app-form-actions>`; the label text is the content.
 *
 * ```html
 * <app-form-split formActionSplit [items]="saveMenu()" [disabled]="submitting()" (action)="save()">
 *   Save and Send
 * </app-form-split>
 * ```
 *
 * One pill, one radius: [ label | divider | chevron ], in DOM order, so right-to-left mirrors by itself (logical
 * properties only). Clicking the label runs `action`; clicking the chevron only opens the menu (each segment has its
 * own accessible name). The menu opens below the pill (above it on phones, where the pill sits in the bottom bar),
 * aligned to the inline-end edge and at least as wide as the pill. With no `items` it is a plain primary button.
 *
 * Keyboard: Enter / Space / ArrowDown on the chevron open the menu, arrows move, Home / End jump, Esc closes and
 * returns focus to the chevron, Tab closes.
 */
@Component({
  selector: 'app-form-split',
  standalone: true,
  imports: [TranslateModule, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fa-split', '[class.fs--open]': 'open()', '[class.fs--disabled]': 'disabled()' },
  template: `
    <div class="fs" #pill role="group" [appTooltip]="disabled() ? disabledReason() : ''">
      <button type="button" class="fs__label" [disabled]="disabled()" [attr.aria-label]="actionLabel() || null" (click)="action.emit()">
        <ng-content/>
      </button>
      @if (items().length) {
        <span class="fs__divider" aria-hidden="true"></span>
        <button type="button" class="fs__chev" #chev [disabled]="disabled()"
                aria-haspopup="menu" [attr.aria-expanded]="open()"
                [attr.aria-label]="moreLabel() || ('COMMON.MORE_SAVE_OPTIONS' | translate)"
                (click)="toggle($event)" (keydown)="onChevKey($event)">
          <svg class="fs__icon" [class.fs__icon--up]="iconUp()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      }
    </div>
    @if (open()) {
      <ul class="fs__menu" [class.fs__menu--up]="phone()" role="menu" (keydown)="onMenuKey($event)">
        @for (item of items(); track $index) {
          @if (item.separator) { <li class="fs__sep" role="separator"></li> }
          @if (item.header) { <li class="fs__header" role="presentation">{{ item.header | translate }}</li> }
          <li role="none">
            <button type="button" role="menuitem" class="fs__item" [class.fs__item--danger]="item.danger" [disabled]="!!item.disabled" (click)="pick(item)">
              {{ item.label | translate }}
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { display: inline-flex; position: relative; }

    /* One pill: a single border-radius on the container, segments inside it have none. */
    .fs {
      display: inline-flex; align-items: stretch; box-sizing: border-box; height: 36px; overflow: hidden;
      border-radius: 8px; background: var(--ui-brand-t700); color: #fff; border: 1px solid var(--ui-brand-t700); /* theme-ok: text on the brand fill */
    }
    :host(.fs--disabled) .fs { opacity: .45; cursor: not-allowed; }
    .fs__label, .fs__chev {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px; margin: 0; border: 0; border-radius: 0;
      background: transparent; color: inherit; font: inherit; font-size: 13.5px; font-weight: 500; line-height: 1; white-space: nowrap; cursor: pointer;
    }
    .fs__label { padding-inline: 16px; }
    .fs__chev { padding-inline: 10px; }
    .fs__label:hover:not(:disabled), .fs__chev:hover:not(:disabled), :host(.fs--open) .fs__chev { background: rgba(0, 0, 0, .1); } /* theme-ok: darkening overlay on the brand fill */
    .fs__label:disabled, .fs__chev:disabled { cursor: not-allowed; }
    /* Same ring on both segments, drawn inside the pill so the rounded clip never cuts it. */
    .fs__label:focus-visible, .fs__chev:focus-visible { outline: 2px solid currentColor; outline-offset: -4px; }
    /* Divider: 1px, 35% of the text colour, the pill's height minus 8px. */
    .fs__divider { align-self: center; width: 1px; height: calc(100% - 8px); background: color-mix(in srgb, currentColor 35%, transparent); }
    .fs__icon { transition: transform .15s; }
    .fs__icon--up { transform: rotate(180deg); }
    :host(.fs--open) .fs__icon { transform: rotate(180deg); }
    :host(.fs--open) .fs__icon--up { transform: none; }

    /* Under the pill, flush with its inline-end edge (logical, so RTL mirrors), at least as wide as it; above it on phones. */
    .fs__menu {
      position: absolute; inset-inline-end: 0; top: calc(100% + 4px); min-width: 100%; z-index: 60; margin: 0; padding: 6px; list-style: none; box-sizing: border-box; max-width: calc(100vw - 16px);
      max-height: 60vh; overflow-y: auto; background: var(--ui-surface); color: var(--ui-text);
      border: 1px solid var(--ui-line); border-radius: 10px; box-shadow: 0 8px 24px rgba(15, 23, 42, .16); /* theme-ok: shadow */
    }
    .fs__menu--up { top: auto; bottom: calc(100% + 8px); }
    .fs__item {
      display: flex; width: 100%; min-height: 36px; align-items: center; padding: 0 12px; border: 0; border-radius: 6px; background: transparent;
      color: inherit; font: inherit; font-size: 13.5px; font-weight: 500; text-align: start; white-space: nowrap; cursor: pointer;
    }
    .fs__item:hover:not(:disabled), .fs__item:focus-visible { background: var(--ui-surface-2); outline: none; }
    .fs__item:disabled { opacity: .5; cursor: not-allowed; }
    .fs__item--danger { color: var(--ui-red-text); }
    .fs__sep { height: 1px; margin: 4px 0; background: var(--ui-line); }
    .fs__header { padding: 6px 12px 2px; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--ui-muted); }

    /* Phone: the pill fills the bottom bar (see app-form-actions); 48px tall, fully rounded. */
    @media (max-width: 639px) {
      :host { display: flex; flex: 1 1 auto; min-width: 0; }
      .fs { flex: 1 1 auto; height: 48px; border-radius: 24px; }
      .fs__label { flex: 1 1 auto; font-size: 16px; font-weight: 600; padding-inline: 20px; }
      .fs__chev { width: 52px; padding: 0; }
      .fs__item { min-height: 48px; font-size: 15px; }
    }
    @media print { :host { display: none; } }
  `],
})
export class FormSplitComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pill = viewChild<ElementRef<HTMLElement>>('pill');
  private readonly chev = viewChild<ElementRef<HTMLElement>>('chev');

  /** The extra ways to save; none = a plain primary button. */
  readonly items = input<DropdownMenuBtnItem[]>([]);
  readonly disabled = input(false);
  /** Why it is disabled (shown as a tooltip on the disabled pill). */
  readonly disabledReason = input<string>('');
  /** Accessible name of the label segment (defaults to its text) and of the chevron segment ("More save options"). */
  readonly actionLabel = input<string>('');
  readonly moreLabel = input<string>('');
  /** Runs the primary action. */
  readonly action = output<void>();

  protected readonly open = signal(false);
  protected readonly phone = signal(false);
  /** The chevron points down in the header and up in the phone bar (where the menu opens upward); it flips while open. */
  protected readonly iconUp = computed(() => this.phone());

  constructor() {
    if (typeof matchMedia === 'function') {
      const mq = matchMedia('(max-width: 639px)');
      this.phone.set(mq.matches);
      const on = (e: MediaQueryListEvent) => this.phone.set(e.matches);
      mq.addEventListener('change', on);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', on));
    }
  }

  protected toggle(e?: MouseEvent): void {
    if (this.open()) { this.close(); return; }
    this.open.set(true);
    // Opened from the keyboard (Enter / Space fire a click with no pointer): land on the first item.
    if (e && e.detail === 0) setTimeout(() => this.items_()[0]?.focus());
  }

  private openMenu(focusFirst: boolean): void {
    this.open.set(true);
    if (focusFirst) setTimeout(() => this.items_()[0]?.focus());
  }

  protected close(returnFocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.chev()?.nativeElement.focus();
  }

  protected pick(item: DropdownMenuBtnItem): void {
    this.close(true);
    item.click();
  }

  protected onChevKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this.openMenu(true); }
  }

  protected onMenuKey(e: KeyboardEvent): void {
    const list = this.items_(); if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
    else if (e.key === 'Tab') this.close();
  }

  private items_(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.fs__item:not(:disabled)'));
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.close(true); }

  @HostListener('window:resize')
  onViewportChange(): void { this.close(); }
}
