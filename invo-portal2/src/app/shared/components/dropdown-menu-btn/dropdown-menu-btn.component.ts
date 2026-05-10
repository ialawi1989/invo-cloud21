import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { OverlayModule, ConnectedPosition } from '@angular/cdk/overlay';

/**
 * Public item shape. Each entry becomes one row in the popover.
 *
 * `tag` renders a small chip before the label (e.g. CSV / XLSX
 * badge for the import templates); `danger` styles destructive
 * actions in red; `separator: true` renders a thin divider
 * BEFORE the item.
 */
export interface DropdownMenuBtnItem {
  label:      string;
  click:      () => void;
  disabled?:  boolean;
  danger?:    boolean;
  separator?: boolean;
  /** Optional small uppercase section label rendered ABOVE this
   *  item (e.g. "BULK OPERATIONS" before a group of bulk actions).
   *  Combine with `separator: true` to also draw a divider. */
  header?:    string;
  tag?: { label: string; variant?: 'cyan' | 'green' | 'amber' | 'slate' };
  /** Optional inline-SVG path `d` attribute. Leave undefined for
   *  items that don't carry an icon. */
  iconPath?:  string;
}

/**
 * Reusable trigger + popover menu.
 *
 * Drop-in replacement for the hand-rolled split-button + dropdown
 * we'd been duplicating across the app.
 *
 * Caller projects the trigger label/icon as `<ng-content>`; the
 * component owns the open state, chevron rotation, outside-click
 * close, and item rendering. Use `triggerClass` to pass through
 * existing button styling (`btn btn-default`, `btn-primary`, etc.)
 *
 * Two positioning modes:
 *
 * 1. **Default (absolute)** — popover renders inline, positioned
 *    relative to the trigger's wrapper. Cheap, no overlay machinery,
 *    but gets clipped if an ancestor has `overflow: hidden`.
 *
 * 2. **`[appendToBody]="true"`** — popover renders into the CDK
 *    overlay container (a body-level child) via Connected Overlay.
 *    Use this when the trigger lives inside a clipping ancestor
 *    (cards with `overflow: hidden`, scrollable lists, etc.) so
 *    the menu can escape and float above the rest of the UI.
 */
@Component({
  selector: 'app-dropdown-menu-btn',
  standalone: true,
  imports: [CommonModule, TranslateModule, OverlayModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dmb">
      <button type="button" #trigger
        [class]="'dmb__trigger ' + (triggerClass || '')"
        [disabled]="disabled"
        [attr.aria-haspopup]="'menu'"
        [attr.aria-expanded]="open()"
        (click)="toggle($event)">
        <ng-content/>
        @if (chevron) {
          <svg class="dmb__chev" [class.dmb__chev--open]="open()" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        }
      </button>

      <!-- Inline mode: absolute-positioned popover inside the wrapper. -->
      @if (open() && !appendToBody) {
        <ng-container *ngTemplateOutlet="menu; context: { $implicit: 'inline' }" />
      }

      <!-- Append-to-body mode: CDK Connected Overlay so the menu
           can escape clipping ancestors (overflow:hidden). The
           backdrop catches outside clicks (we set it transparent
           to feel like a regular popover). -->
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="trigger"
        [cdkConnectedOverlayOpen]="open() && appendToBody"
        [cdkConnectedOverlayHasBackdrop]="true"
        cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
        [cdkConnectedOverlayPositions]="overlayPositions"
        (backdropClick)="open.set(false)"
        (detach)="open.set(false)">
        <ng-container *ngTemplateOutlet="menu; context: { $implicit: 'overlay' }" />
      </ng-template>

      <!-- Shared menu template — same markup for both positioning
           modes, so item styling stays consistent. -->
      <ng-template #menu let-mode>
        <ul [class]="
              'dmb__menu dmb__menu--' + align +
              (mode === 'overlay' ? ' dmb__menu--overlay' : '')
            "
            role="menu" (click)="$event.stopPropagation()">
          @for (item of items; track $index) {
            @if (item.separator) { <li class="dmb__sep" aria-hidden="true"></li> }
            @if (item.header) {
              <li class="dmb__header" role="presentation">{{ item.header | translate }}</li>
            }
            <li>
              <button type="button" role="menuitem"
                [class.dmb__item--danger]="item.danger"
                [disabled]="!!item.disabled"
                (click)="pick(item)">
                @if (item.tag) {
                  <span [class]="'dmb__tag dmb__tag--' + (item.tag.variant || 'cyan')">{{ item.tag.label }}</span>
                }
                @if (item.iconPath) {
                  <svg class="dmb__item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path [attr.d]="item.iconPath"/>
                  </svg>
                }
                <span class="dmb__item-label">{{ item.label | translate }}</span>
              </button>
            </li>
          }
        </ul>
      </ng-template>
    </div>
  `,
  styles: [`
    .dmb { position: relative; display: inline-flex; }

    .dmb__trigger { display: inline-flex; align-items: center; gap: 6px; }

    .dmb__chev {
      transition: transform 150ms ease;
      &--open { transform: rotate(180deg); }
    }

    .dmb__menu {
      margin: 0;
      padding: 6px 0;
      list-style: none;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      box-shadow: 0 6px 16px -4px rgba(15, 23, 42, 0.12),
                  0 2px 4px -1px  rgba(15, 23, 42, 0.06);
      min-width: 200px;
      overflow: hidden;
      z-index: 50;
    }

    /* Inline mode: anchor to the wrapper. */
    .dmb .dmb__menu               { position: absolute; top: calc(100% + 6px); }
    .dmb .dmb__menu--start        { inset-inline-start: 0; }
    .dmb .dmb__menu--end          { inset-inline-end:   0; }

    /* Overlay mode: CDK positions us — drop the absolute anchoring. */
    .dmb__menu--overlay { position: static; }

    .dmb__menu li { margin: 0; }

    .dmb__menu button {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      background: transparent;
      border: 0;
      border-radius: 0;
      font-size: 13px;
      font-weight: 500;
      color: #1f2937;
      text-align: start;
      cursor: pointer;
      transition: background 80ms ease, color 80ms ease;

      &:hover:not(:disabled)  { background: #f8fafc; color: #0f172a; }
      &:focus                 { outline: none; }
      &:focus-visible         { background: #f1f5f9; }
      &:active:not(:disabled) { background: #f1f5f9; }
      &:disabled              { opacity: 0.5; cursor: not-allowed; }
    }

    .dmb__item--danger {
      color: #b91c1c !important;
      &:hover:not(:disabled) { background: #fef2f2 !important; color: #991b1b !important; }
    }

    .dmb__item-icon  { color: currentColor; flex-shrink: 0; opacity: 0.85; }
    .dmb__item-label { flex: 1; min-width: 0; }

    .dmb__sep {
      height: 1px;
      margin: 6px 0;
      background: #f1f5f9;
    }

    .dmb__header {
      padding: 6px 14px 4px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #94a3b8;
    }

    .dmb__tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      flex-shrink: 0;

      &--cyan  { background: #ecfeff; color: #0e7490; border: 1px solid #a5f3fc; }
      &--green { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
      &--amber { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
      &--slate { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
    }
  `],
})
export class DropdownMenuBtnComponent {
  /** Items rendered in the popover. */
  @Input() items: DropdownMenuBtnItem[] = [];
  /** Popover horizontal alignment relative to the trigger. */
  @Input() align: 'start' | 'end' = 'start';
  /** Class string passed through to the trigger button so the
   *  caller's existing button styling applies. */
  @Input() triggerClass: string = '';
  /** Whether to render the dropdown chevron. */
  @Input() chevron: boolean = true;
  /** Disable the trigger entirely. */
  @Input() disabled: boolean = false;

  /**
   * When true, the popover renders into the CDK overlay container
   * (a body-level element) via Connected Overlay. Use this when
   * the trigger lives inside a clipping ancestor (e.g. a card
   * with `overflow: hidden`, a virtualised list row) so the menu
   * can escape and float above the rest of the UI.
   *
   * Default `false` — keeps the cheap absolute-positioned path
   * for the common case.
   */
  @Input() appendToBody: boolean = false;

  /**
   * Position list passed to CDK overlay. Mirrors the `align`
   * input — `end` flips the popover to the trigger's end edge,
   * `start` to the start edge. The fallback positions let the
   * overlay flip vertically near the viewport edge.
   */
  get overlayPositions(): ConnectedPosition[] {
    return this.align === 'end'
      ? [
          { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top',    offsetY: 6 },
          { originX: 'end', originY: 'top',    overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
        ]
      : [
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top',    offsetY: 6 },
          { originX: 'start', originY: 'top',    overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
        ];
  }

  open = signal<boolean>(false);

  private host = inject(ElementRef<HTMLElement>);

  toggle(ev: Event): void {
    ev.stopPropagation();
    if (this.disabled) return;
    this.open.update(v => !v);
  }

  pick(item: DropdownMenuBtnItem): void {
    if (item.disabled) return;
    this.open.set(false);
    item.click();
  }

  /** Outside-click close — only relevant for inline mode. The
   *  overlay path uses CDK's transparent backdrop instead. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.open() || this.appendToBody) return;
    const target = ev.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.open.set(false);
  }
}
