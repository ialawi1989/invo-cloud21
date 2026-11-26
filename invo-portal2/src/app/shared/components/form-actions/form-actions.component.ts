import {
  ChangeDetectionStrategy, Component, DestroyRef, Directive, ElementRef, HostListener, computed, contentChildren, effect, inject, signal, viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Markers for the buttons placed inside `<app-form-actions>`. The page keeps its own buttons, handlers, disabled and
 * loading state exactly as they were; the markers only say where a button goes:
 *
 *   formActionExtra      a page-specific action (tour, History, Print, Options…) — before Cancel
 *   formActionSecondary  Cancel, Back, Save as draft … — outlined, before the primary
 *   formActionOverflow   rarely used extras ("Reset all to defaults") — inside the "…" menu
 *   formActionPrimary    the ONE primary action (Save) — filled, always last
 *   formActionSplit      a primary with a caret menu beside it (wrapper around the primary button + its caret)
 *
 * The look of all of them is owned by `app-form-actions`, so every form's actions are identical.
 */
@Directive({ selector: '[formActionPrimary]', standalone: true, host: { class: 'fa-btn fa-btn--primary' } })
export class FormActionPrimaryDirective {}

@Directive({ selector: '[formActionSecondary]', standalone: true, host: { class: 'fa-btn fa-btn--secondary' } })
export class FormActionSecondaryDirective {}

/** Marks the split primary (`<app-form-split>`): it takes its slot in the row / bottom bar. */
@Directive({ selector: '[formActionSplit]', standalone: true, host: { class: 'fa-split' } })
export class FormActionSplitDirective {}

/** A page-specific action (tour, History, Print…): inline before Cancel on wide screens, inside the "⋮" menu on phones. */
@Directive({ selector: '[formActionExtra]', standalone: true, host: { class: 'fa-extra' } })
export class FormActionExtraDirective {}

@Directive({ selector: '[formActionOverflow]', standalone: true, host: { class: 'fa-menu-item', role: 'menuitem' } })
export class FormActionOverflowDirective {}

/** Phones only (< 640px): the actions become one fixed bottom bar instead of a row in the header. */
const PHONE_QUERY = '(max-width: 639px)';

/**
 * The actions of a form page, shown at the END of the page header (project it into `<app-page-header>`'s
 * `pageActions` slot). Order, whatever order the page writes them in: page-specific actions, secondary actions, the "…"
 * menu, then the single primary action. When the header scrolls out of view the header turns them into a slim bar under
 * the top bar — the same elements, so focus order and behaviour never change.
 *
 * On phones (< 640px) the same elements are laid out as a fixed bottom bar: a round "⋮" button at the inline start that
 * opens a menu holding every secondary action (page-specific first, then Cancel), and the primary action filling the
 * rest of the row as a tall pill. The bar publishes its height as `--mobile-action-bar-h` (safe area included) so the
 * page frame can reserve room for it, and lifts itself above the on-screen keyboard.
 *
 * ```html
 * <app-page-header [title]="…" [trail]="…">
 *   <app-form-actions pageActions>
 *     <button type="button" formActionOverflow (click)="resetToDefaults()">Reset all to defaults</button>
 *     <button type="button" formActionSecondary (click)="cancel()">Cancel</button>
 *     <button type="button" formActionPrimary (click)="save()" [disabled]="…">Save</button>
 *   </app-form-actions>
 * </app-page-header>
 * ```
 */
@Component({
  selector: 'app-form-actions',
  standalone: true,
  imports: [TranslateModule, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- One <ng-content> per selector (Angular projects into the first only), each in a template that the active layout renders. -->
    <ng-template #tExtra><ng-content select="[formActionExtra]"/></ng-template>
    <ng-template #tSecondary><ng-content select="[formActionSecondary]"/></ng-template>
    <ng-template #tOverflow><ng-content select="[formActionOverflow]"/></ng-template>
    <ng-template #tSplit><ng-content select="[formActionSplit]"/></ng-template>
    <ng-template #tPrimary><ng-content select="[formActionPrimary]"/></ng-template>
    <ng-template #tDefault><ng-content/></ng-template>

    @if (phone()) {
      <div class="fm" role="group" #bar>
        @if (hasMenu()) {
          <div class="fm__more">
            <button type="button" class="fm__more-btn" #moreBtn aria-haspopup="menu"
                    [attr.aria-expanded]="open()" [attr.aria-label]="'COMMON.MORE_ACTIONS' | translate"
                    (click)="toggle()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/>
              </svg>
            </button>
            <div class="fm__menu" role="menu" [hidden]="!open()" (click)="close(true)" (keydown)="onMenuKey($event)">
              <ng-container *ngTemplateOutlet="tExtra"/>
              <ng-container *ngTemplateOutlet="tDefault"/>
              <ng-container *ngTemplateOutlet="tOverflow"/>
              @if (hasPrimary()) { <ng-container *ngTemplateOutlet="tSecondary"/> }
            </div>
          </div>
        }
        @if (!hasPrimary()) { <ng-container *ngTemplateOutlet="tSecondary"/> }
        <ng-container *ngTemplateOutlet="tSplit"/>
        <ng-container *ngTemplateOutlet="tPrimary"/>
      </div>
    } @else {
      <div class="fa" role="group">
        <ng-container *ngTemplateOutlet="tExtra"/>
        <ng-container *ngTemplateOutlet="tSecondary"/>
        @if (hasOverflow()) {
          <div class="fa__more">
            <button type="button" class="fa-btn fa-btn--secondary fa__more-btn" aria-haspopup="menu"
                    [attr.aria-expanded]="open()" [attr.aria-label]="'COMMON.MORE_ACTIONS' | translate"
                    (click)="toggle()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>
              </svg>
            </button>
            <div class="fa__menu" role="menu" [hidden]="!open()" (click)="close()">
              <ng-container *ngTemplateOutlet="tOverflow"/>
            </div>
          </div>
        }
        <ng-container *ngTemplateOutlet="tSplit"/>
        <ng-container *ngTemplateOutlet="tPrimary"/>
        <ng-container *ngTemplateOutlet="tDefault"/>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .fa { display: flex; align-items: center; flex-wrap: nowrap; gap: 8px; }

    /* One look for every form's actions (the page's own button classes are not used). */
    :host ::ng-deep .fa-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      height: 36px; padding: 0 16px; border-radius: 8px; box-sizing: border-box;
      font: inherit; font-size: 13.5px; font-weight: 500; line-height: 1; white-space: nowrap;
      cursor: pointer; text-decoration: none; transition: background .12s, border-color .12s, box-shadow .12s;
    }
    :host ::ng-deep .fa-btn--secondary { background: var(--ui-surface); color: var(--ui-text); border: 1px solid var(--ui-line-strong); }
    :host ::ng-deep .fa-btn--secondary:hover:not(:disabled) { background: var(--ui-surface-2); }
    :host ::ng-deep .fa-btn--primary { background: var(--ui-brand-t700); color: #fff; border: 1px solid var(--ui-brand-t700); } /* theme-ok: text on the brand fill */
    :host ::ng-deep .fa-btn--primary:hover:not(:disabled) { filter: brightness(.94); }
    :host ::ng-deep .fa-btn:disabled { opacity: .5; cursor: not-allowed; }
    :host ::ng-deep .fa-btn:focus-visible { outline: 2px solid var(--ui-brand-t700); outline-offset: 2px; }

    /* Order, whatever order the page writes the buttons in: other content (hints, summaries) · secondary · … menu · primary. */
    .fa ::ng-deep .fa-extra { order: 0; }
    .fa ::ng-deep .fa-btn--secondary { order: 1; }
    .fa > ::ng-deep app-dropdown-menu-btn { order: 1; display: inline-flex; }
    .fa__more { order: 2; }
    .fa ::ng-deep .fa-btn--primary, .fa ::ng-deep .fa-split { order: 3; }
    /* The split primary (app-form-split) draws itself; here it only takes its place in the row. */

    .fa__more { position: relative; }
    .fa__more-btn { padding: 0 10px; }
    .fa__menu {
      position: absolute; inset-block-start: calc(100% + 6px); inset-inline-end: 0; z-index: 60; min-width: 220px;
      padding: 6px; background: var(--ui-surface); border: 1px solid var(--ui-line); border-radius: 10px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, .12); /* theme-ok: shadow */
    }
    .fa__menu ::ng-deep .fa-menu-item {
      display: block; width: 100%; padding: 8px 10px; border: 0; border-radius: 6px; background: transparent;
      color: var(--ui-text); font: inherit; font-size: 13.5px; text-align: start; cursor: pointer;
    }
    .fa__menu ::ng-deep .fa-menu-item:hover:not(:disabled) { background: var(--ui-surface-2); }
    .fa__menu ::ng-deep .fa-menu-item:disabled { opacity: .5; cursor: not-allowed; }

    /* Tablet and desktop keep the row above; only the phone gets the bottom bar below. */
    @media print { :host { display: none; } }

    /* ── Phone: fixed bottom bar ───────────────────────────────────────────────────────────────────────────────────
       [ ⋮ ]  [        Primary (pill)        ]      Logical properties only, so Arabic mirrors by itself. */
    .fm {
      position: fixed; inset-inline: 0; bottom: var(--kb-inset, 0px); z-index: 40;
      display: flex; align-items: center; gap: 12px; box-sizing: border-box;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
      background: var(--ui-surface); border-top: 1px solid var(--ui-line);
    }
    .fm__more { position: relative; flex: 0 0 auto; }
    .fm__more-btn {
      display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; padding: 0;
      border-radius: 50%; background: var(--ui-surface); color: var(--ui-text); border: 1px solid var(--ui-line-strong); cursor: pointer;
    }
    .fm__more-btn:focus-visible { outline: 2px solid var(--ui-brand-t700); outline-offset: 2px; }
    .fm__menu {
      position: absolute; inset-inline-start: 0; bottom: calc(100% + 12px); z-index: 41; min-width: 240px; max-width: calc(100vw - 32px);
      max-height: 60vh; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px;
      background: var(--ui-surface); border: 1px solid var(--ui-line); border-radius: 14px;
      box-shadow: 0 -8px 28px rgba(15, 23, 42, .18); /* theme-ok: shadow */
    }
    .fm__menu[hidden] { display: none; }
    /* Every action in the menu is a full-width, 48px row, whatever class the page gave its button. */
    .fm__menu ::ng-deep button, .fm__menu ::ng-deep a, .fm__menu ::ng-deep app-dropdown-menu-btn {
      display: flex; width: 100%; min-height: 48px; align-items: center; justify-content: flex-start; gap: 10px; box-sizing: border-box;
      padding: 0 14px; border: 0; border-radius: 10px; background: transparent; color: var(--ui-text);
      font: inherit; font-size: 15px; font-weight: 500; text-align: start; cursor: pointer; box-shadow: none; height: auto;
    }
    .fm__menu ::ng-deep app-dropdown-menu-btn button { padding: 0; min-height: 48px; }
    .fm__menu ::ng-deep button:hover:not(:disabled) { background: var(--ui-surface-2); }
    .fm__menu ::ng-deep button:focus-visible { outline: 2px solid var(--ui-brand-t700); outline-offset: -2px; }
    .fm__menu ::ng-deep button:disabled { opacity: .5; cursor: not-allowed; }
    .fm__menu ::ng-deep .tour-btn span[aria-hidden] { flex: none; }

    /* The primary action: one tall, high-contrast pill filling the rest of the row. */
    .fm ::ng-deep > .fa-btn--primary {
      flex: 1 1 auto; min-width: 0; height: 48px; border-radius: 24px; font-size: 16px; font-weight: 600;
    }
    .fm ::ng-deep > .fa-btn--primary { padding: 0 20px; }
    .fm ::ng-deep > .fa-btn--primary:disabled { opacity: .5; }
    .fm ::ng-deep > .fa-btn--secondary { flex: 1 1 auto; height: 48px; border-radius: 24px; font-size: 16px; }
    .fm ::ng-deep .fa-btn:focus-visible { outline: 2px solid var(--ui-brand-t700); outline-offset: 2px; }
    @media print { .fm { display: none; } }
  `]
})
export class FormActionsComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  private readonly overflowItems = contentChildren(FormActionOverflowDirective, { descendants: true });
  private readonly extraItems = contentChildren(FormActionExtraDirective, { descendants: true });
  private readonly secondaryItems = contentChildren(FormActionSecondaryDirective, { descendants: true });
  private readonly primaryItems = contentChildren(FormActionPrimaryDirective, { descendants: true });
  private readonly splitItems = contentChildren(FormActionSplitDirective, { descendants: true });
  private readonly bar = viewChild<ElementRef<HTMLElement>>('bar');
  private readonly moreBtn = viewChild<ElementRef<HTMLElement>>('moreBtn');

  /** Phone width: the actions live in a fixed bottom bar. */
  protected readonly phone = signal(false);
  protected readonly open = signal(false);
  protected readonly hasOverflow = computed(() => this.overflowItems().length > 0);
  protected readonly hasPrimary = computed(() => this.primaryItems().length > 0 || this.splitItems().length > 0);
  /** The "⋮" exists only when there is something to put in it. */
  protected readonly hasMenu = computed(() => this.hasOverflow() || this.extraItems().length > 0 || (this.hasPrimary() && this.secondaryItems().length > 0));

  constructor() {
    if (typeof matchMedia === 'function') {
      const mq = matchMedia(PHONE_QUERY);
      this.phone.set(mq.matches);
      const on = (e: MediaQueryListEvent) => this.phone.set(e.matches);
      mq.addEventListener('change', on);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', on));
    }

    // Publish the bar's height (safe area included) so the page frame reserves room for it; withdraw it when the bar goes away.
    effect(onCleanup => {
      const el = this.bar()?.nativeElement;
      if (!el) return;
      const root = document.documentElement;
      const set = () => root.style.setProperty('--mobile-action-bar-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
      set();
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
      ro?.observe(el);
      onCleanup(() => { ro?.disconnect(); root.style.removeProperty('--mobile-action-bar-h'); });
    });

    // On-screen keyboard (iOS Safari does not resize the layout viewport): lift the bar by the part of the layout viewport the keyboard covers.
    effect(onCleanup => {
      if (!this.phone() || typeof visualViewport === 'undefined' || !visualViewport) return;
      const vv = visualViewport, root = document.documentElement;
      const sync = () => root.style.setProperty('--kb-inset', `${Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop))}px`);
      sync();
      vv.addEventListener('resize', sync); vv.addEventListener('scroll', sync);
      onCleanup(() => { vv.removeEventListener('resize', sync); vv.removeEventListener('scroll', sync); root.style.removeProperty('--kb-inset'); });
    });
  }

  protected toggle(): void {
    if (this.open()) { this.close(true); return; }
    this.open.set(true);
    // Keyboard users land on the first action.
    setTimeout(() => this.items()[0]?.focus());
  }

  protected close(returnFocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.moreBtn()?.nativeElement.focus();
  }

  protected onMenuKey(e: KeyboardEvent): void {
    const items = this.items(); if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    else if (e.key === 'Tab') this.close();
  }

  private items(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.fm__menu button:not(:disabled), .fm__menu a'));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.close(true); }
}
