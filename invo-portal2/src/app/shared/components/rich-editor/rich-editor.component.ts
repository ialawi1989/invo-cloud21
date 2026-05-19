import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { TooltipDirective } from '@shared/directives/tooltip.directive';

/**
 * Block-format options surfaced in the "Paragraph" dropdown.
 * Mapped 1:1 onto `formatBlock` execCommand values.
 */
interface BlockOption { tag: 'P' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6' | 'BLOCKQUOTE' | 'PRE'; label: string; cls: string; }

/**
 * Alignment options in the toolbar's align dropdown — each maps to
 * one of `justifyLeft|Center|Right|Full` execCommands.
 */
interface AlignOption { value: 'left' | 'center' | 'right' | 'justify'; cmd: string; iconPath: string; label: string; }

const BLOCKS: readonly BlockOption[] = [
  { tag: 'P',          label: 'Paragraph',  cls: 're-block-p'   },
  { tag: 'H1',         label: 'Heading 1',  cls: 're-block-h1'  },
  { tag: 'H2',         label: 'Heading 2',  cls: 're-block-h2'  },
  { tag: 'H3',         label: 'Heading 3',  cls: 're-block-h3'  },
  { tag: 'H4',         label: 'Heading 4',  cls: 're-block-h4'  },
  { tag: 'H5',         label: 'Heading 5',  cls: 're-block-h5'  },
  { tag: 'H6',         label: 'Heading 6',  cls: 're-block-h6'  },
  { tag: 'BLOCKQUOTE', label: 'Quote',      cls: 're-block-q'   },
  { tag: 'PRE',        label: 'Code block', cls: 're-block-pre' },
];

const SIZES: readonly string[] = ['10','12','14','16','18','20','24','28','32','40','48'];
const LINE_HEIGHTS: readonly string[] = ['1.0','1.15','1.25','1.5','1.75','2.0'];

const PALETTE: readonly string[] = [
  '#000000','#1e293b','#475569','#94a3b8','#cbd5e1','#ffffff',
  '#dc2626','#ea580c','#d97706','#ca8a04','#65a30d','#16a34a',
  '#0d9488','#0284c7','#2563eb','#7c3aed','#c026d3','#db2777',
];

const HIGHLIGHTS: readonly string[] = [
  'transparent','#fde68a','#fca5a5','#fdba74','#fcd34d','#bef264',
  '#86efac','#67e8f9','#93c5fd','#c4b5fd','#f9a8d4','#fda4af',
];

const ALIGNS: readonly AlignOption[] = [
  { value: 'left',    cmd: 'justifyLeft',   label: 'Left',    iconPath: 'M3 6h18M3 12h12M3 18h18' },
  { value: 'center',  cmd: 'justifyCenter', label: 'Center',  iconPath: 'M3 6h18M6 12h12M3 18h18' },
  { value: 'right',   cmd: 'justifyRight',  label: 'Right',   iconPath: 'M3 6h18M9 12h12M3 18h18' },
  { value: 'justify', cmd: 'justifyFull',   label: 'Justify', iconPath: 'M3 6h18M3 12h18M3 18h18' },
];

type MenuKey = 'block' | 'size' | 'color' | 'highlight' | 'align' | 'lineheight' | 'info' | null;

/**
 * Tiny built-in WYSIWYG editor — zero third-party dependencies.
 *
 * Relies on `document.execCommand` to apply formatting to the
 * selection inside a single `contenteditable` root and reads the
 * resulting innerHTML back out as the model value. Implements
 * `ControlValueAccessor` so it plugs into reactive forms,
 * template-driven forms, and the `[(value)]` signal shorthand.
 *
 * Toolbar (left → right): Paragraph picker · Font-size picker ·
 * Bold / Italic / Underline · Text colour · Highlight · Link /
 * Quote / Code · Bullet / Numbered list · Alignment · Line height ·
 * Indent / Outdent · Info · HTML toggle.
 *
 * Intentionally small — if you need image uploads, tables, or a
 * block-level structured model, reach for a proper editor
 * (ProseMirror / Lexical / TipTap). This one handles ~95% of
 * product-description-sized text and strips rich HTML on paste so
 * editors don't smuggle in attacker-supplied styles.
 */
@Component({
  selector: 'app-rich-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichEditorComponent),
      multi: true,
    },
  ],
  template: `
    <div class="re" [class.re--disabled]="disabled()">
      <!-- Toolbar — most buttons are disabled in HTML-source mode.
           Wrapped in two regions: a scrollable rail of editing
           controls and a pinned end-cap with the HTML toggle so the
           toggle stays visible at any width. -->
      <div class="re__toolbar" role="toolbar" [attr.aria-disabled]="disabled()">
        <div class="re__rail">
        @if (mode() === 'wysiwyg') {
          <!-- Block format dropdown -->
          <button #blockTrigger="cdkOverlayOrigin" cdkOverlayOrigin
                  type="button" class="re__btn re__btn--dd"
                  (mousedown)="toggleMenu($event, 'block')"
                  [attr.aria-expanded]="openMenu() === 'block'"
                  [appTooltip]="'Paragraph style'">
            <span class="re__btn-text">{{ currentBlockLabel() }}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="blockTrigger"
            [cdkConnectedOverlayOpen]="openMenu() === 'block'"
            [cdkConnectedOverlayPositions]="overlayPositions"
            (overlayOutsideClick)="closeMenu()">
            <div class="re__menu re__menu--block">
              @for (b of blocks; track b.tag) {
                <button type="button" class="re__menu-item" [class]="b.cls"
                        (mousedown)="pickBlock($event, b.tag)">
                  {{ b.label }}
                </button>
              }
            </div>
          </ng-template>

          <!-- Font-size dropdown -->
          <button #sizeTrigger="cdkOverlayOrigin" cdkOverlayOrigin
                  type="button" class="re__btn re__btn--dd re__btn--size"
                  (mousedown)="toggleMenu($event, 'size')"
                  [attr.aria-expanded]="openMenu() === 'size'"
                  [appTooltip]="'Font size'">
            <span class="re__btn-text">{{ currentSize() }}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="sizeTrigger"
            [cdkConnectedOverlayOpen]="openMenu() === 'size'"
            [cdkConnectedOverlayPositions]="overlayPositions"
            (overlayOutsideClick)="closeMenu()">
            <div class="re__menu re__menu--size">
              @for (s of sizes; track s) {
                <button type="button" class="re__menu-item"
                        (mousedown)="pickSize($event, s)">{{ s }}</button>
              }
            </div>
          </ng-template>

          <span class="re__sep"></span>

          <button type="button" class="re__btn" [class.is-on]="state().bold"
                  (mousedown)="cmd($event, 'bold')" [appTooltip]="'Bold (Ctrl+B)'">
            <span class="re__btn-label"><b>B</b></span>
          </button>
          <button type="button" class="re__btn" [class.is-on]="state().italic"
                  (mousedown)="cmd($event, 'italic')" [appTooltip]="'Italic (Ctrl+I)'">
            <span class="re__btn-label"><i>I</i></span>
          </button>
          <button type="button" class="re__btn" [class.is-on]="state().underline"
                  (mousedown)="cmd($event, 'underline')" [appTooltip]="'Underline (Ctrl+U)'">
            <span class="re__btn-label"><u>U</u></span>
          </button>

          <!-- Text colour -->
          <button #colorTrigger="cdkOverlayOrigin" cdkOverlayOrigin
                  type="button" class="re__btn re__btn--swatch"
                  (mousedown)="toggleMenu($event, 'color')"
                  [attr.aria-expanded]="openMenu() === 'color'"
                  [appTooltip]="'Text colour'">
            <span class="re__btn-label re__btn-label--color">
              A<span class="re__swatch-bar" [style.background]="lastColor()"></span>
            </span>
          </button>
          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="colorTrigger"
            [cdkConnectedOverlayOpen]="openMenu() === 'color'"
            [cdkConnectedOverlayPositions]="overlayPositions"
            (overlayOutsideClick)="closeMenu()">
            <div class="re__menu re__menu--palette">
              @for (c of palette; track c) {
                <button type="button" class="re__swatch"
                        [style.background]="c"
                        [title]="c"
                        (mousedown)="pickColor($event, c)"></button>
              }
            </div>
          </ng-template>

          <!-- Highlight colour -->
          <button #highlightTrigger="cdkOverlayOrigin" cdkOverlayOrigin
                  type="button" class="re__btn re__btn--swatch"
                  (mousedown)="toggleMenu($event, 'highlight')"
                  [attr.aria-expanded]="openMenu() === 'highlight'"
                  [appTooltip]="'Highlight colour'">
            <span class="re__btn-label re__btn-label--color">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
              </svg>
              <span class="re__swatch-bar" [style.background]="lastHighlight()"></span>
            </span>
          </button>
          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="highlightTrigger"
            [cdkConnectedOverlayOpen]="openMenu() === 'highlight'"
            [cdkConnectedOverlayPositions]="overlayPositions"
            (overlayOutsideClick)="closeMenu()">
            <div class="re__menu re__menu--palette">
              @for (c of highlights; track c) {
                <button type="button" class="re__swatch"
                        [style.background]="c === 'transparent' ? 'transparent' : c"
                        [class.re__swatch--none]="c === 'transparent'"
                        [title]="c === 'transparent' ? 'None' : c"
                        (mousedown)="pickHighlight($event, c)"></button>
              }
            </div>
          </ng-template>

          <span class="re__sep"></span>

          <button type="button" class="re__btn" (mousedown)="linkPrompt($event)" [appTooltip]="'Insert link'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </button>
          <button type="button" class="re__btn" (mousedown)="pickBlock($event, 'BLOCKQUOTE')" [appTooltip]="'Quote'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M3 21c3 0 3-3 3-6V9H3v6h3"/><path d="M14 21c3 0 3-3 3-6V9h-3v6h3"/>
            </svg>
          </button>
          <button type="button" class="re__btn" (mousedown)="toggleCode($event)" [appTooltip]="'Inline code'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
          </button>

          <span class="re__sep"></span>

          <button type="button" class="re__btn" [class.is-on]="state().ul"
                  (mousedown)="cmd($event, 'insertUnorderedList')" [appTooltip]="'Bullet list'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/>
              <line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <button type="button" class="re__btn" [class.is-on]="state().ol"
                  (mousedown)="cmd($event, 'insertOrderedList')" [appTooltip]="'Numbered list'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <text x="1" y="8"  font-size="6" fill="currentColor" stroke="none" font-family="system-ui">1</text>
              <text x="1" y="14" font-size="6" fill="currentColor" stroke="none" font-family="system-ui">2</text>
              <text x="1" y="20" font-size="6" fill="currentColor" stroke="none" font-family="system-ui">3</text>
              <line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <!-- Alignment dropdown -->
          <button #alignTrigger="cdkOverlayOrigin" cdkOverlayOrigin
                  type="button" class="re__btn re__btn--dd"
                  (mousedown)="toggleMenu($event, 'align')"
                  [attr.aria-expanded]="openMenu() === 'align'"
                  [appTooltip]="'Alignment'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path [attr.d]="currentAlignIcon()"/>
            </svg>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="alignTrigger"
            [cdkConnectedOverlayOpen]="openMenu() === 'align'"
            [cdkConnectedOverlayPositions]="overlayPositions"
            (overlayOutsideClick)="closeMenu()">
            <div class="re__menu re__menu--align">
              @for (a of aligns; track a.value) {
                <button type="button" class="re__menu-item re__menu-item--icon"
                        (mousedown)="pickAlign($event, a)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path [attr.d]="a.iconPath"/>
                  </svg>
                  <span>{{ a.label }}</span>
                </button>
              }
            </div>
          </ng-template>

          <!-- Line-height dropdown -->
          <button #lhTrigger="cdkOverlayOrigin" cdkOverlayOrigin
                  type="button" class="re__btn re__btn--dd"
                  (mousedown)="toggleMenu($event, 'lineheight')"
                  [attr.aria-expanded]="openMenu() === 'lineheight'"
                  [appTooltip]="'Line height'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 6H3M21 12H9M21 18H3"/><path d="M5 4v4M5 16v4"/><path d="M3 6l2-2 2 2M3 18l2 2 2-2"/>
            </svg>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="lhTrigger"
            [cdkConnectedOverlayOpen]="openMenu() === 'lineheight'"
            [cdkConnectedOverlayPositions]="overlayPositions"
            (overlayOutsideClick)="closeMenu()">
            <div class="re__menu re__menu--size">
              @for (h of lineHeights; track h) {
                <button type="button" class="re__menu-item"
                        (mousedown)="pickLineHeight($event, h)">{{ h }}</button>
              }
            </div>
          </ng-template>

          <button type="button" class="re__btn" (mousedown)="cmd($event, 'outdent')" [appTooltip]="'Decrease indent'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="21" y1="6"  x2="9"  y2="6"/>
              <line x1="21" y1="18" x2="9"  y2="18"/>
              <line x1="21" y1="12" x2="11" y2="12"/>
              <polyline points="7 8 3 12 7 16"/>
            </svg>
          </button>
          <button type="button" class="re__btn" (mousedown)="cmd($event, 'indent')" [appTooltip]="'Increase indent'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3"  y1="6"  x2="21" y2="6"/>
              <line x1="3"  y1="18" x2="21" y2="18"/>
              <line x1="3"  y1="12" x2="13" y2="12"/>
              <polyline points="17 8 21 12 17 16"/>
            </svg>
          </button>

          <span class="re__sep"></span>

          <button type="button" class="re__btn" (mousedown)="clearFormat($event)" [appTooltip]="'Clear formatting'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 7V4h16v3"/><path d="M5 20l14-16"/><path d="M9 20h6"/>
            </svg>
          </button>

          <!-- Info popover -->
          <button #infoTrigger="cdkOverlayOrigin" cdkOverlayOrigin
                  type="button" class="re__btn"
                  (mousedown)="toggleMenu($event, 'info')"
                  [attr.aria-expanded]="openMenu() === 'info'"
                  [appTooltip]="'Keyboard shortcuts'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="infoTrigger"
            [cdkConnectedOverlayOpen]="openMenu() === 'info'"
            [cdkConnectedOverlayPositions]="overlayPositions"
            (overlayOutsideClick)="closeMenu()">
            <div class="re__menu re__menu--info">
              <h4>Keyboard shortcuts</h4>
              <dl>
                <dt>Ctrl+B</dt><dd>Bold</dd>
                <dt>Ctrl+I</dt><dd>Italic</dd>
                <dt>Ctrl+U</dt><dd>Underline</dd>
                <dt>Ctrl+K</dt><dd>Insert link</dd>
                <dt>Enter</dt><dd>New paragraph</dd>
                <dt>Shift+Enter</dt><dd>Soft line break</dd>
                <dt>Ctrl+Z</dt><dd>Undo</dd>
              </dl>
            </div>
          </ng-template>
        }
        </div>

        <!-- Mode toggle — pinned to the right, always visible -->
        <button type="button"
                class="re__btn re__btn--toggle"
                [class.re__btn--toggle-on]="mode() === 'html'"
                (mousedown)="toggleMode($event)"
                [title]="mode() === 'html' ? 'Visual view' : 'HTML source'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
          <span class="re__btn-label re__btn-label--text">
            {{ mode() === 'html' ? 'Visual' : 'HTML' }}
          </span>
        </button>
      </div>

      <!-- Editable surface (WYSIWYG) -->
      <div
        #editable
        class="re__surface"
        [style.min-height]="height()"
        [hidden]="mode() !== 'wysiwyg'"
        [attr.contenteditable]="disabled() ? 'false' : 'true'"
        [attr.data-placeholder]="placeholder()"
        [attr.aria-label]="placeholder() || 'Rich text editor'"
        (input)="onInput()"
        (blur)="onBlur()"
        (mouseup)="onSelectionMaybeChanged()"
        (keyup)="onSelectionMaybeChanged()"
        (paste)="onPaste($event)"
      ></div>

      <!-- HTML source editor -->
      @if (mode() === 'html') {
        <textarea
          class="re__source"
          [style.min-height]="height()"
          [attr.aria-label]="'HTML source'"
          [disabled]="disabled()"
          [ngModel]="htmlSource()"
          (ngModelChange)="onHtmlInput($event)"
          (blur)="onBlur()"
          spellcheck="false"
        ></textarea>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .re {
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: #fff;
      overflow: hidden;
      transition: border-color .12s, box-shadow .12s;
    }
    .re:focus-within {
      border-color: #32acc1;
      box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.15);
    }
    .re--disabled { opacity: .65; pointer-events: none; }

    .re__toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 6px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      position: relative;
    }
    /* Wraps onto multiple rows when the toolbar runs out of space.
       Dropdown menus are portaled to body via CDK overlay, so the
       rail can wrap freely without clipping any popovers. The HTML
       toggle stays pinned outside this rail so it's always reachable. */
    .re__rail {
      display: flex;
      align-items: center;
      gap: 2px;
      flex: 1 1 auto;
      min-width: 0;
      flex-wrap: wrap;
      row-gap: 4px;
    }

    .re__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      height: 28px;
      min-width: 28px;
      padding: 0 6px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      color: #475569;
      cursor: pointer;
      transition: background .12s, color .12s, border-color .12s;
      font-size: 13px;
      line-height: 1;
      flex-shrink: 0;
    }
    .re__btn:hover {
      background: #e6f7fa;
      color: #0f172a;
      border-color: #cfeef3;
    }
    .re__btn:active { background: #d4f0f5; }
    .re__btn.is-on {
      background: #eff9fb;
      border-color: #a6d8df;
      color: #0f172a;
    }

    .re__btn-text { font-size: 12px; font-weight: 500; }
    .re__btn--dd { padding: 0 6px 0 8px; }
    .re__btn--size .re__btn-text { font-variant-numeric: tabular-nums; min-width: 18px; text-align: end; }

    .re__btn-label {
      font-weight: 600;
      font-family: system-ui, sans-serif;
    }
    .re__btn-label sub { font-size: 10px; vertical-align: sub; }

    .re__btn-label--color {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      line-height: 1;
      gap: 1px;
    }
    .re__swatch-bar {
      display: block;
      width: 14px;
      height: 3px;
      border-radius: 1px;
      border: 1px solid #cbd5e1;
    }

    .re__sep {
      width: 1px;
      align-self: stretch;
      background: #e2e8f0;
      margin: 2px 4px;
      flex-shrink: 0;
    }
    .re__btn--toggle { flex-shrink: 0; margin-inline-start: 4px; }

    /* ── Dropdowns ─────────────────────────────────────────────── */
    /* Menu styling — rendered inside the CDK overlay container, so
       no inline absolute positioning here; CDK handles placement
       relative to the trigger button. */
    .re__menu {
      min-width: 140px;
      padding: 4px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 6px 24px rgba(15,23,42,.12);
    }
    .re__menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 10px;
      border: 0;
      background: transparent;
      border-radius: 6px;
      font-size: 13px;
      color: #1e293b;
      cursor: pointer;
      text-align: start;
    }
    .re__menu-item:hover { background: #f1f5f9; }
    .re__menu-item--icon svg { color: #64748b; }

    .re__menu--block .re-block-p   { font-size: 14px; }
    .re__menu--block .re-block-h1  { font-size: 20px; font-weight: 600; }
    .re__menu--block .re-block-h2  { font-size: 18px; font-weight: 600; }
    .re__menu--block .re-block-h3  { font-size: 16px; font-weight: 600; }
    .re__menu--block .re-block-h4  { font-size: 14px; font-weight: 600; }
    .re__menu--block .re-block-h5  { font-size: 13px; font-weight: 600; }
    .re__menu--block .re-block-h6  { font-size: 12px; font-weight: 600; color: #64748b; }
    .re__menu--block .re-block-q   { font-style: italic; color: #64748b; }
    .re__menu--block .re-block-pre { font-family: ui-monospace, monospace; font-size: 12px; }

    .re__menu--size { min-width: 72px; max-height: 240px; overflow-y: auto; }
    .re__menu--size .re__menu-item { justify-content: center; font-variant-numeric: tabular-nums; }

    .re__menu--palette {
      display: grid;
      grid-template-columns: repeat(6, 22px);
      gap: 4px;
      min-width: auto;
      padding: 8px;
    }
    .re__swatch {
      width: 22px;
      height: 22px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 0;
      cursor: pointer;
    }
    .re__swatch:hover { transform: scale(1.08); }
    .re__swatch--none {
      background-image: linear-gradient(45deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%);
    }

    .re__menu--align { min-width: 130px; }

    .re__menu--info { min-width: 220px; padding: 10px 12px; }
    .re__menu--info h4 { margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #1e293b; }
    .re__menu--info dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 12px;
      margin: 0;
      font-size: 12px;
    }
    .re__menu--info dt { color: #64748b; font-family: ui-monospace, monospace; }
    .re__menu--info dd { margin: 0; color: #1e293b; }

    /* ── HTML toggle ──────────────────────────────────────────── */
    .re__btn--toggle {
      padding: 0 8px;
      gap: 6px;
      color: #475569;
      border-color: #e2e8f0;
    }
    .re__btn--toggle-on {
      background: #eff9fb;
      border-color: #a6d8df;
      color: #0f172a;
    }
    .re__btn-label--text {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .4px;
      text-transform: uppercase;
    }

    /* ── Source textarea (HTML mode) ──────────────────────────── */
    .re__source {
      width: 100%;
      padding: 10px 14px;
      border: 0;
      outline: none;
      resize: vertical;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 1.55;
      color: #0f172a;
      background: #f8fafc;
    }
    .re__source:focus { background: #fff; }
    .re__source:disabled { opacity: .7; background: #f1f5f9; }

    /* ── WYSIWYG surface ─────────────────────────────────────── */
    /* Element-level typography uses :host ::ng-deep because
       contenteditable inserts brand-new DOM via execCommand that
       does NOT carry Angular's _ngcontent-* attribute — without
       ::ng-deep the scoped selectors never match the dynamically
       inserted h1/h2/ol/ul nodes, and Tailwind's preflight wins.
       !important guards against any other global reset further
       down the cascade. */
    .re__surface {
      padding: 10px 14px;
      outline: none;
      font-size: 14px;
      line-height: 1.55;
      color: #1e293b;
    }
    .re__surface:empty::before {
      content: attr(data-placeholder);
      color: #94a3b8;
      pointer-events: none;
    }
    :host ::ng-deep .re__surface p { margin: 0 0 8px !important; }
    :host ::ng-deep .re__surface h1 { font-size: 28px !important; font-weight: 700 !important; line-height: 1.2 !important; margin: 14px 0 8px !important; color: inherit; }
    :host ::ng-deep .re__surface h2 { font-size: 22px !important; font-weight: 700 !important; line-height: 1.25 !important; margin: 14px 0 6px !important; color: inherit; }
    :host ::ng-deep .re__surface h3 { font-size: 18px !important; font-weight: 600 !important; line-height: 1.3 !important; margin: 12px 0 6px !important; color: inherit; }
    :host ::ng-deep .re__surface h4 { font-size: 16px !important; font-weight: 600 !important; line-height: 1.3 !important; margin: 10px 0 6px !important; color: inherit; }
    :host ::ng-deep .re__surface h5 { font-size: 14px !important; font-weight: 600 !important; line-height: 1.35 !important; margin: 10px 0 6px !important; color: inherit; }
    :host ::ng-deep .re__surface h6 { font-size: 13px !important; font-weight: 600 !important; line-height: 1.35 !important; margin: 10px 0 6px !important; color: #64748b !important; }

    /* Lists — explicit list-style + outside positioning so Tailwind's
       "ul, ol { list-style: none }" reset doesn't hide the markers.
       "display: list-item" on li likewise guards against generic
       "li { display: block }" resets some frameworks ship. */
    :host ::ng-deep .re__surface ul,
    :host ::ng-deep .re__surface ol {
      margin: 6px 0 10px !important;
      padding-inline-start: 28px !important;
      list-style-position: outside !important;
    }
    :host ::ng-deep .re__surface ul { list-style-type: disc !important; }
    :host ::ng-deep .re__surface ol { list-style-type: decimal !important; }
    :host ::ng-deep .re__surface li {
      display: list-item !important;
      margin: 2px 0 !important;
    }
    :host ::ng-deep .re__surface ul ul { list-style-type: circle !important; }
    :host ::ng-deep .re__surface ul ul ul { list-style-type: square !important; }

    :host ::ng-deep .re__surface a { color: #32acc1 !important; text-decoration: underline !important; }
    :host ::ng-deep .re__surface blockquote {
      margin: 8px 0 !important;
      padding: 8px 14px !important;
      border-inline-start: 3px solid #cbd5e1 !important;
      color: #64748b !important;
      font-style: italic !important;
      background: #f8fafc !important;
    }
    :host ::ng-deep .re__surface pre {
      margin: 8px 0 !important;
      padding: 10px 12px !important;
      background: #f1f5f9 !important;
      border-radius: 6px !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important;
      font-size: 12px !important;
      white-space: pre-wrap !important;
    }
    :host ::ng-deep .re__surface code {
      background: #f1f5f9 !important;
      padding: 1px 4px !important;
      border-radius: 4px !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important;
      font-size: .9em !important;
    }
    :host ::ng-deep .re__surface strong,
    :host ::ng-deep .re__surface b { font-weight: 700 !important; }
    :host ::ng-deep .re__surface em,
    :host ::ng-deep .re__surface i { font-style: italic !important; }
    :host ::ng-deep .re__surface u { text-decoration: underline !important; }
    :host ::ng-deep .re__surface img { max-width: 100% !important; border-radius: 8px !important; margin: 8px 0 !important; }

    /* ── Inserted blocks (video embeds, link cards, dividers, buttons) ── */
    :host ::ng-deep .re__surface .re-embed-video {
      position: relative !important;
      width: 100% !important;
      aspect-ratio: 16 / 9 !important;
      margin: 12px 0 !important;
      border-radius: 10px !important;
      overflow: hidden !important;
      background: #0f172a !important;
    }
    :host ::ng-deep .re__surface .re-embed-video iframe {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      border: 0 !important;
    }
    :host ::ng-deep .re__surface .re-embed-card {
      display: block !important;
      margin: 10px 0 !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 10px !important;
      background: #f8fafc !important;
      overflow: hidden !important;
    }
    :host ::ng-deep .re__surface .re-embed-card a {
      display: flex !important;
      flex-direction: column !important;
      gap: 2px !important;
      padding: 12px 14px !important;
      text-decoration: none !important;
      color: #0f172a !important;
    }
    :host ::ng-deep .re__surface .re-embed-card__host { font-size: 12px !important; font-weight: 600 !important; color: #64748b !important; text-transform: uppercase !important; letter-spacing: .04em !important; }
    :host ::ng-deep .re__surface .re-embed-card__url  { font-size: 13px !important; color: #0f172a !important; word-break: break-all !important; }

    :host ::ng-deep .re__surface .re-btn-block {
      display: inline-block !important;
      margin: 8px 0 !important;
      padding: 8px 18px !important;
      background: #0f172a !important;
      color: #fff !important;
      border-radius: 999px !important;
      font-weight: 600 !important;
      text-decoration: none !important;
    }
    :host ::ng-deep .re__surface .re-html-raw {
      display: block !important;
      margin: 8px 0 !important;
      padding: 10px 12px !important;
      background: repeating-linear-gradient(45deg,#f8fafc,#f8fafc 6px,#fff 6px,#fff 12px) !important;
      border: 1px dashed #cbd5e1 !important;
      border-radius: 8px !important;
      font-family: ui-monospace, monospace !important;
      font-size: 12px !important;
      color: #475569 !important;
      white-space: pre-wrap !important;
    }
    :host ::ng-deep .re__surface table {
      border-collapse: collapse !important;
      width: 100% !important;
      margin: 10px 0 !important;
    }
    :host ::ng-deep .re__surface table td,
    :host ::ng-deep .re__surface table th {
      border: 1px solid #e2e8f0 !important;
      padding: 6px 10px !important;
      min-width: 60px !important;
    }
    :host ::ng-deep .re__surface table th {
      background: #f1f5f9 !important;
      font-weight: 600 !important;
    }
  `],
})
export class RichEditorComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  private cdr  = inject(ChangeDetectorRef);

  /** Optional placeholder shown when the editor is empty. */
  placeholder = input<string>('');
  /** Minimum editor height. Defaults to 220px — override per usage. */
  height      = input<string>('220px');
  /** When true, pasted URLs on their own line are converted to embed cards
   *  (YouTube/Vimeo iframe; generic link card otherwise). */
  embedOnPaste = input<boolean>(false);
  /** Lets the parent observe blur/commit events (on top of CVA onChange). */
  changed = output<string>();

  disabled = signal(false);

  /** `'wysiwyg'` (default) shows the visual editor; `'html'` shows a raw textarea. */
  mode = signal<'wysiwyg' | 'html'>('wysiwyg');
  /** Mirror of the current HTML shown in the source textarea while in html mode. */
  htmlSource = signal<string>('');

  /** Which toolbar dropdown is open. Click-outside closes it. */
  openMenu = signal<MenuKey>(null);

  /** Current block tag at the caret — drives the "Paragraph" picker label. */
  currentBlock = signal<BlockOption['tag']>('P');
  /** Current font size (px) at the caret — drives the size-picker label. */
  currentSize  = signal<string>('14');
  /** Current alignment at the caret — drives the align dropdown icon. */
  currentAlign = signal<AlignOption['value']>('left');
  /** Last applied colours — shown as the swatch under the toolbar buttons. */
  lastColor     = signal<string>('#1e293b');
  lastHighlight = signal<string>('#fde68a');

  /** Live `queryCommandState` snapshot — keeps the active-button styling
   *  in sync with the caret as the user types or selects. */
  state = signal<{ bold: boolean; italic: boolean; underline: boolean; ul: boolean; ol: boolean }>({
    bold: false, italic: false, underline: false, ul: false, ol: false,
  });

  // Static config exposed to the template.
  readonly blocks      = BLOCKS;
  readonly sizes       = SIZES;
  readonly palette     = PALETTE;
  readonly highlights  = HIGHLIGHTS;
  readonly aligns      = ALIGNS;
  readonly lineHeights = LINE_HEIGHTS;

  /** CDK overlay positioning for every dropdown — anchor below the
   *  trigger by default, flip above when there's no room. Same
   *  config for all menus so the visual rhythm stays consistent. */
  readonly overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top',    offsetY: 4 },
    { originX: 'end',   originY: 'bottom', overlayX: 'end',   overlayY: 'top',    offsetY: 4 },
    { originX: 'start', originY: 'top',    overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end',   originY: 'top',    overlayX: 'end',   overlayY: 'bottom', offsetY: -4 },
  ];

  @ViewChild('editable', { static: true }) editable!: ElementRef<HTMLDivElement>;

  // ControlValueAccessor plumbing
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};
  private pendingValue = '';
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    // Force <p> blocks on Enter so line breaks behave consistently
    // across browsers. Without this, Chromium uses <div> and Firefox
    // uses <br>, and on empty content Enter often does nothing at all.
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* legacy API */ }
    // CSS-style commands so `fontSize` etc. produce inline styles
    // instead of legacy `<font>` tags.
    try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* legacy API */ }
    this.setHtml(this.pendingValue);
    this.refreshState();
  }

  ngOnDestroy(): void {
    // Nothing to clean up — listeners are template-bound.
  }

  // ─── CVA ────────────────────────────────────────────────────────────────
  writeValue(value: unknown): void {
    const html = typeof value === 'string' ? value : '';
    this.pendingValue = html;
    this.htmlSource.set(html);
    if (this.viewReady) this.setHtml(html);
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled.set(isDisabled); }

  // ─── Selection / caret tracking ─────────────────────────────────────────
  /** Refresh `state()` / `currentBlock()` / `currentSize()` /
   *  `currentAlign()` so the toolbar reflects the caret. Called on
   *  selection-affecting input events. */
  private refreshState(): void {
    if (this.mode() !== 'wysiwyg') return;
    try {
      this.state.set({
        bold:      document.queryCommandState('bold'),
        italic:    document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        ul:        document.queryCommandState('insertUnorderedList'),
        ol:        document.queryCommandState('insertOrderedList'),
      });
    } catch { /* execCommand state may throw on detached selection */ }

    // Block tag — walk up to the first block-level ancestor inside
    // the editable root.
    const block = this.currentBlockTag();
    if (block) this.currentBlock.set(block);

    // Font size — read computed style of the anchor node's element.
    const size = this.currentFontSize();
    if (size) this.currentSize.set(size);

    // Alignment — text-align of the nearest block.
    const align = this.currentAlignValue();
    if (align) this.currentAlign.set(align);

    this.cdr.markForCheck();
  }

  onSelectionMaybeChanged(): void { this.refreshState(); }

  private nodeAtCaret(): HTMLElement | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
    const editable = this.editable?.nativeElement;
    if (!node || !editable || !editable.contains(node)) return null;
    return node as HTMLElement;
  }

  private currentBlockTag(): BlockOption['tag'] | null {
    let el = this.nodeAtCaret();
    const editable = this.editable?.nativeElement;
    while (el && el !== editable) {
      const tag = el.tagName as BlockOption['tag'];
      if (BLOCKS.some(b => b.tag === tag)) return tag;
      el = el.parentElement;
    }
    return null;
  }

  private currentFontSize(): string | null {
    const el = this.nodeAtCaret();
    if (!el) return null;
    const px = window.getComputedStyle(el).fontSize;
    const n = parseFloat(px);
    return Number.isFinite(n) ? String(Math.round(n)) : null;
  }

  private currentAlignValue(): AlignOption['value'] | null {
    let el = this.nodeAtCaret();
    const editable = this.editable?.nativeElement;
    while (el && el !== editable) {
      const ta = window.getComputedStyle(el).textAlign;
      if (ta === 'center')  return 'center';
      if (ta === 'right' || ta === 'end')   return 'right';
      if (ta === 'justify') return 'justify';
      if (ta === 'left' || ta === 'start')  return 'left';
      el = el.parentElement;
    }
    return 'left';
  }

  /** Computed labels for the dropdown buttons. */
  currentBlockLabel(): string {
    return BLOCKS.find(b => b.tag === this.currentBlock())?.label ?? 'Paragraph';
  }
  currentAlignIcon(): string {
    return ALIGNS.find(a => a.value === this.currentAlign())?.iconPath ?? ALIGNS[0].iconPath;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────
  private setHtml(html: string): void {
    if (!this.editable) return;
    if (this.editable.nativeElement.innerHTML !== html) {
      this.editable.nativeElement.innerHTML = html;
    }
  }

  private emit(): void {
    const html = this.editable.nativeElement.innerHTML;
    this.onChange(html);
    this.changed.emit(html);
  }

  onInput(): void { this.normalizeBlockNesting(); this.emit(); this.refreshState(); }
  onBlur(): void { this.onTouched(); this.emit(); }

  // ─── HTML source view ───────────────────────────────────────────────────
  /** Toolbar action — flip between WYSIWYG and raw HTML textarea. */
  toggleMode(ev: Event): void {
    ev.preventDefault();
    this.closeMenu();
    if (this.mode() === 'wysiwyg') {
      this.htmlSource.set(this.editable.nativeElement.innerHTML);
      this.mode.set('html');
    } else {
      this.setHtml(this.htmlSource());
      this.normalizeBlockNesting();
      this.mode.set('wysiwyg');
      this.emit();
    }
  }

  onHtmlInput(raw: string): void {
    this.htmlSource.set(raw ?? '');
    this.onChange(raw ?? '');
    this.changed.emit(raw ?? '');
  }

  /** Plain-text paste so users don't smuggle in attacker-supplied styles.
   *  When [embedOnPaste] is enabled and the clipboard is a single URL
   *  pasted on its own (no surrounding text), the URL is converted to
   *  an embed card — YouTube/Vimeo iframe, or a bare-link card for
   *  anything else. */
  onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const text = (e.clipboardData?.getData('text/plain') ?? '').trim();
    if (!text) return;

    if (this.embedOnPaste() && isStandaloneUrl(text)) {
      const html = buildEmbedHtml(text);
      if (html) {
        this.insertHtml(html);
        return;
      }
    }

    document.execCommand('insertText', false, text);
    this.emit();
  }

  /** Public API — insert an arbitrary HTML fragment at the current
   *  caret position. Used by parent components (e.g. the Wix-style
   *  "Add" panel) to inject blocks like videos, dividers, buttons,
   *  tables. The fragment is wrapped in a paragraph break on either
   *  side so it ends up as its own block in the flow. */
  insertHtml(html: string): void {
    if (!html) return;
    this.editable.nativeElement.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      // No caret yet — append at the end.
      this.editable.nativeElement.insertAdjacentHTML('beforeend', html);
      this.emit();
      this.refreshState();
      return;
    }
    const range = sel.getRangeAt(0);
    if (!range.collapsed) range.deleteContents();

    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const frag = tpl.content.cloneNode(true) as DocumentFragment;
    // Track the last inserted node so we can park the caret after it.
    const lastNode = frag.lastChild;
    range.insertNode(frag);

    if (lastNode) {
      const after = document.createRange();
      after.setStartAfter(lastNode);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    }
    this.normalizeBlockNesting();
    this.emit();
    this.refreshState();
  }

  // ─── Toolbar handlers ───────────────────────────────────────────────────
  /** `mousedown` + `preventDefault` preserves the editor selection
   *  (otherwise clicking the button strips focus before the command
   *  runs and execCommand operates on an empty range). */
  cmd(ev: Event, command: string, value?: string): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    document.execCommand(command, false, value);
    this.normalizeBlockNesting();
    this.emit();
    this.refreshState();
  }

  /** Fix invalid block-level nesting introduced by execCommand —
   *  most notably `<p><ol>…</ol></p>` after `insertOrderedList`
   *  /`insertUnorderedList` when the selection was already inside a
   *  paragraph. The HTML spec doesn't allow block elements inside
   *  `<p>`, and persisting that markup makes the list render as
   *  plain stacked text and round-trips badly through the HTML
   *  source view. Walks the editor once and lifts any block child
   *  out of a containing `<p>`, dropping the now-redundant wrapper
   *  if nothing else was inside. */
  private normalizeBlockNesting(): void {
    const editable = this.editable?.nativeElement;
    if (!editable) return;
    const BLOCKS = 'ul, ol, blockquote, pre, h1, h2, h3, h4, h5, h6, div';
    let changed = true;
    // Iterate until stable — unwrapping one offender may expose
    // another that was nested in the same `<p>`.
    while (changed) {
      changed = false;
      const offenders = editable.querySelectorAll<HTMLElement>(`p > :is(${BLOCKS})`);
      offenders.forEach((child) => {
        const p = child.parentElement as HTMLElement | null;
        if (!p || p.tagName !== 'P') return;
        // Split the `<p>` around the offending block. Pre / post
        // siblings keep their `<p>` wrapper so any text either side
        // of the list stays inside a paragraph.
        const beforeNodes: Node[] = [];
        const afterNodes:  Node[] = [];
        let seenChild = false;
        Array.from(p.childNodes).forEach((n) => {
          if (n === child) { seenChild = true; return; }
          (seenChild ? afterNodes : beforeNodes).push(n);
        });
        const parent = p.parentNode!;
        if (beforeNodes.length) {
          const before = document.createElement('p');
          beforeNodes.forEach((n) => before.appendChild(n));
          parent.insertBefore(before, p);
        }
        parent.insertBefore(child, p);
        if (afterNodes.length) {
          const after = document.createElement('p');
          afterNodes.forEach((n) => after.appendChild(n));
          parent.insertBefore(after, p);
        }
        parent.removeChild(p);
        changed = true;
      });
    }
  }

  /** "Clear formatting" — `execCommand('removeFormat')` only strips
   *  inline formatting (bold/italic/colors), not block-level styles.
   *  Users hit this expecting it to also undo headings/quotes, so we
   *  also reset the block to a plain `<p>`. List wrappers stay (use
   *  the list toolbar buttons to toggle them off). */
  clearFormat(ev: Event): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    document.execCommand('removeFormat');
    document.execCommand('formatBlock', false, '<p>');
    this.normalizeBlockNesting();
    this.emit();
    this.refreshState();
  }

  /** Block format dropdown — paragraph, headings, blockquote, pre.
   *  `formatBlock` only works when the caret is inside a block-level
   *  element; on a fresh, unwrapped contenteditable the user's text
   *  sits in raw text nodes and the command becomes a no-op. We wrap
   *  any orphan text in a `<p>` first so the user sees the heading
   *  style apply on the first click. */
  pickBlock(ev: Event, tag: BlockOption['tag']): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    this.ensureBlockWrapper();
    document.execCommand('formatBlock', false, `<${tag}>`);
    this.normalizeBlockNesting();
    this.closeMenu();
    this.emit();
    this.refreshState();
  }

  /** Ensure the editable root has at least one block-level child
   *  containing the caret. If the content is just raw text nodes (or
   *  empty), wrap everything in a `<p>` and move the caret inside it
   *  so subsequent `formatBlock` / `indent` / `justify*` commands
   *  have a block to operate on. */
  private ensureBlockWrapper(): void {
    const editable = this.editable.nativeElement;
    const sel = window.getSelection();
    if (!sel) return;

    // Already inside a block? Nothing to do.
    let node: Node | null = sel.anchorNode;
    while (node && node !== editable) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName;
        if (['P','DIV','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE','PRE'].includes(tag)) return;
      }
      node = node.parentNode;
    }

    // Wrap the entire editable content in a single <p>, then place
    // the caret at the end so the user keeps typing where they left off.
    const p = document.createElement('p');
    while (editable.firstChild) p.appendChild(editable.firstChild);
    editable.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(p);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /** Font-size dropdown — wraps the selection in a `<span style="font-size: Xpx">`.
   *  Falls back to `execCommand('fontSize', '1-7')` only if no selection. */
  pickSize(ev: Event, sizePx: string): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    this.applyInlineStyle('font-size', `${sizePx}px`);
    this.currentSize.set(sizePx);
    this.closeMenu();
    this.emit();
  }

  /** Wraps the current selection in a `<span>` carrying the given
   *  inline style. Falls back to a caret-position insert if the
   *  selection is collapsed (next typed character takes the style). */
  private applyInlineStyle(prop: 'font-size' | 'line-height' | 'color' | 'background-color', val: string): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) {
      // Insert a zero-width-space span that the user can type into.
      const span = document.createElement('span');
      (span.style as any)[this.camelize(prop)] = val;
      span.appendChild(document.createTextNode('​'));
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.setStart(span.firstChild!, 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      return;
    }
    const span = document.createElement('span');
    (span.style as any)[this.camelize(prop)] = val;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    // Restore selection over the wrapped content.
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  private camelize(kebab: string): string {
    return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }

  /** Colour-palette pick. `foreColor` is a stable execCommand. */
  pickColor(ev: Event, color: string): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    document.execCommand('foreColor', false, color);
    this.lastColor.set(color);
    this.closeMenu();
    this.emit();
    this.refreshState();
  }

  /** Highlight palette pick. `hiliteColor` first, fall back to
   *  `backColor` for older Chromium builds. `transparent` clears it. */
  pickHighlight(ev: Event, color: string): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    const v = color === 'transparent' ? 'transparent' : color;
    if (!document.execCommand('hiliteColor', false, v)) {
      document.execCommand('backColor', false, v);
    }
    if (color !== 'transparent') this.lastHighlight.set(color);
    this.closeMenu();
    this.emit();
    this.refreshState();
  }

  pickAlign(ev: Event, a: AlignOption): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    document.execCommand(a.cmd);
    this.normalizeBlockNesting();
    this.currentAlign.set(a.value);
    this.closeMenu();
    this.emit();
  }

  /** Line-height applies via the nearest block-level ancestor — list
   *  items, paragraphs, headings, blockquote, the editable root if
   *  nothing else is wrapping the caret. */
  pickLineHeight(ev: Event, h: string): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    let el = this.nodeAtCaret();
    const editable = this.editable.nativeElement;
    while (el && el !== editable) {
      const tag = el.tagName;
      if (['P','DIV','LI','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','PRE'].includes(tag)) {
        el.style.lineHeight = h;
        break;
      }
      el = el.parentElement;
    }
    if (!el || el === editable) editable.style.lineHeight = h;
    this.closeMenu();
    this.emit();
  }

  /** Wraps selection in `<code>` for inline code style. Toggles off
   *  if the caret sits inside an existing `<code>`. On a collapsed
   *  selection, inserts an empty `<code>` and parks the caret inside
   *  it so the next typed character is styled — same UX expectation
   *  users have for Bold / Italic when no selection is active. */
  toggleCode(ev: Event): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    // Already inside <code>? Unwrap.
    let el = this.nodeAtCaret();
    while (el && el !== this.editable.nativeElement) {
      if (el.tagName === 'CODE') {
        const parent = el.parentNode!;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        this.emit();
        return;
      }
      el = el.parentElement;
    }

    const range = sel.getRangeAt(0);
    const code = document.createElement('code');
    if (range.collapsed) {
      // Park an empty <code> at the caret with a zero-width-space so
      // the user can type inside it; the ZWSP gets removed once real
      // content lands (browsers usually swallow it on first keystroke).
      code.appendChild(document.createTextNode('​'));
      range.insertNode(code);
      const inner = document.createRange();
      inner.setStart(code.firstChild!, 1);
      inner.collapse(true);
      sel.removeAllRanges();
      sel.addRange(inner);
    } else {
      code.appendChild(range.extractContents());
      range.insertNode(code);
      const after = document.createRange();
      after.selectNodeContents(code);
      sel.removeAllRanges();
      sel.addRange(after);
    }
    this.emit();
  }

  linkPrompt(ev: Event): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    const url = window.prompt('Link URL', 'https://');
    if (!url) return;
    if (/^\s*javascript:/i.test(url)) return;
    document.execCommand('createLink', false, url);
    this.emit();
  }

  // ─── Menu / dropdown plumbing ───────────────────────────────────────────
  toggleMenu(ev: Event, key: Exclude<MenuKey, null>): void {
    ev.preventDefault();
    this.openMenu.set(this.openMenu() === key ? null : key);
  }
  closeMenu(): void { this.openMenu.set(null); }

  // CDK's `overlayOutsideClick` event handles click-outside dismissal
  // for every dropdown — no document-level mousedown listener needed.

  // ─── Keyboard ───────────────────────────────────────────────────────────
  // Enter handling is taken over completely instead of leaning on
  // browser defaults. Chromium's default `insertParagraph` is
  // unreliable inside an empty `<p>` — it may insert a stray `<br>`,
  // do nothing, or split the wrong node — and the inconsistency is
  // exactly what the user reported ("works once then stops"). Always
  // owning the action keeps every Enter press deterministic.
  //
  // Shift+Enter is still left to the browser (soft `<br>` break).
  // Ctrl+K opens the link prompt.
  @HostListener('keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      this.linkPrompt(e);
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey) return;

    const editable = this.editable?.nativeElement;
    const sel = window.getSelection();
    if (!editable || !sel || sel.rangeCount === 0) return;

    const block = this.nearestBlock(sel.anchorNode, editable);

    // Inside <li>: empty <li> → exit list (replace with <p> below the
    // list); non-empty <li> → let the browser create the next list
    // item. Owning the empty-exit case is essential because Chromium
    // sometimes refuses to break out, especially after the first
    // Enter when we just normalized the list out of a wrapping <p>.
    if (block?.tagName === 'LI') {
      const isEmpty = (block.textContent ?? '').trim() === '';
      if (!isEmpty) return;
      e.preventDefault();
      this.exitListAtCaret(block);
      this.normalizeBlockNesting();
      this.emit();
      this.refreshState();
      return;
    }

    e.preventDefault();
    // If there's no block ancestor yet (fresh editor, raw text
    // nodes), wrap the current line in <p> before splitting so the
    // resulting structure stays valid.
    if (!block) document.execCommand('formatBlock', false, '<p>');
    this.insertParagraphAtCaret();
    this.normalizeBlockNesting();
    this.emit();
    this.refreshState();
  }

  /** Pull the caret out of an empty `<li>` and park it in a new
   *  `<p>` directly after the parent list. The empty `<li>` is
   *  removed; if it was the only item in the list, the entire list
   *  is removed too. Matches the Google Docs / Wix Ricos "press
   *  Enter twice to exit a list" UX. */
  private exitListAtCaret(emptyLi: HTMLElement): void {
    const list = emptyLi.parentElement;
    if (!list) return;
    const newP = document.createElement('p');
    newP.appendChild(document.createElement('br'));
    list.parentNode!.insertBefore(newP, list.nextSibling);
    emptyLi.remove();
    if (list.children.length === 0) list.remove();
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.setStart(newP, 0);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /** Walk up from `start` to find the nearest block-level ancestor
   *  contained by `editable`. Returns null when the caret lives in
   *  raw text directly under the contenteditable root. */
  private nearestBlock(start: Node | null, editable: HTMLElement): HTMLElement | null {
    let node: Node | null = start;
    while (node && node !== editable) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName;
        if (['P','DIV','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE','PRE'].includes(tag)) {
          return node as HTMLElement;
        }
      }
      node = node.parentNode;
    }
    return null;
  }

  /** Split the current block at the caret and place the cursor at
   *  the start of the new sibling block. Always produces a fresh
   *  `<p>` so heading/quote/pre blocks return to plain paragraphs on
   *  Enter — matches the behaviour of Google Docs / Wix Ricos. */
  private insertParagraphAtCaret(): void {
    const editable = this.editable.nativeElement;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    // Collapse selection first (preserve start) so we split at one point.
    if (!range.collapsed) {
      range.deleteContents();
    }

    const block = this.nearestBlock(range.startContainer, editable) ?? editable;

    // Range from caret to end of current block — moved into the new <p>.
    const tail = document.createRange();
    tail.setStart(range.startContainer, range.startOffset);
    tail.setEndAfter(block.lastChild ?? block);

    const newP = document.createElement('p');
    newP.appendChild(tail.extractContents());
    // Empty paragraphs need a <br> to remain selectable/clickable
    // in Firefox; Chromium tolerates an empty <p> but the <br> is
    // harmless on collapse.
    if (!newP.textContent && newP.children.length === 0) {
      newP.appendChild(document.createElement('br'));
    }
    // Also leave a <br> behind if we just emptied the source block —
    // otherwise an empty <p>/<h*> collapses to zero height.
    if (block !== editable && !block.textContent && block.children.length === 0) {
      block.appendChild(document.createElement('br'));
    }

    if (block === editable) {
      editable.appendChild(newP);
    } else {
      block.parentNode!.insertBefore(newP, block.nextSibling);
    }

    // Caret to start of the new paragraph.
    const caret = document.createRange();
    caret.setStart(newP, 0);
    caret.collapse(true);
    sel.removeAllRanges();
    sel.addRange(caret);
  }
}

// ── Paste-to-embed helpers ───────────────────────────────────────────

/** A pasted blob is a "standalone URL" when the entire clipboard
 *  payload (after trimming) is one well-formed http(s) URL with no
 *  surrounding text — that's the signal that the user wants an embed
 *  card, not an inline link. */
function isStandaloneUrl(text: string): boolean {
  if (/\s/.test(text)) return false;
  try {
    const u = new URL(text);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Map a URL to an embed HTML fragment. YouTube + Vimeo become
 *  responsive iframe wrappers; anything else becomes a clickable
 *  "link card" showing the URL and host. Returns null for inputs
 *  that aren't safely embeddable. */
function buildEmbedHtml(url: string): string | null {
  const safe = escapeAttr(url);
  const yt = parseYouTubeId(url);
  if (yt) {
    return responsiveIframe(`https://www.youtube.com/embed/${yt}`, 'YouTube video');
  }
  const vm = parseVimeoId(url);
  if (vm) {
    return responsiveIframe(`https://player.vimeo.com/video/${vm}`, 'Vimeo video');
  }
  // Generic bare-link card.
  let host = '';
  try { host = new URL(url).host.replace(/^www\./, ''); } catch { host = url; }
  return `<div class="re-embed-card" contenteditable="false" data-embed-url="${safe}">
    <a href="${safe}" target="_blank" rel="noopener noreferrer">
      <span class="re-embed-card__host">${escapeText(host)}</span>
      <span class="re-embed-card__url">${escapeText(url)}</span>
    </a>
  </div>`;
}

function responsiveIframe(src: string, title: string): string {
  const safeSrc = escapeAttr(src);
  const safeTitle = escapeAttr(title);
  return `<div class="re-embed-video" contenteditable="false">
    <iframe src="${safeSrc}" title="${safeTitle}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen></iframe>
  </div>`;
}

function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
    return null;
  } catch { return null; }
}

function parseVimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('vimeo.com')) return null;
    const m = u.pathname.match(/^\/(\d{6,})/);
    return m ? m[1] : null;
  } catch { return null; }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
