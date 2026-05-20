import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
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
import { ColorPickerComponent } from '@shared/components/color-picker/color-picker.component';

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
type ResizeDir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

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
  imports: [CommonModule, FormsModule, OverlayModule, TooltipDirective, ColorPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichEditorComponent),
      multi: true,
    },
  ],
  template: `
    <div class="re" [class.re--disabled]="disabled()" [class.re--bare]="bare()">
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

      <!-- Optional projected content sits between the toolbar and
           the editable surface. Used by the Wix-style post composer
           to slot the giant "Add Title" input between the pinned
           toolbar and the body text, so the toolbar stays at the top
           of the canvas. -->
      <div class="re__slot"><ng-content></ng-content></div>

      <!-- Editable surface (WYSIWYG). Position-relative so the
           floating "+" button below it can be parked inside the
           surface bounds (never overlapping the sticky toolbar). -->
      <div class="re__surfaceWrap">
        @if (addButton() && addBtn().show) {
          <button type="button"
                  class="re__addBtn"
                  [style.top.px]="addBtn().top"
                  [style.left.px]="addBtn().left"
                  (mousedown)="onAddBtn($event)"
                  aria-label="Add">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        }

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
        (focus)="onSelectionMaybeChanged()"
        (mouseup)="onSelectionMaybeChanged()"
        (keyup)="onSelectionMaybeChanged()"
        (paste)="onPaste($event)"
        (click)="onSurfaceClick($event)"
        (dblclick)="onSurfaceDblClick($event)"
      ></div>

      <!-- Draggable floating Image panel (Settings + Design tabs).
           Lives in the surface wrap so it positions against the
           editor canvas. Title bar is grabbable; the panel can be
           moved anywhere within the surface bounds. -->
      @if (figPanel() && figPanelPos()) {
        <div class="re__figPanel"
             [style.top.px]="figPanelPos()?.top"
             [style.left.px]="figPanelPos()?.left"
             (mousedown)="$event.stopPropagation()">
          <header class="re__figPanelHead" (mousedown)="startPanelDrag($event)">
            <h4>{{ figPanel() === 'banner-design' || figPanel() === 'banner-layout' ? 'Layout section' : 'Image' }}</h4>
            <button type="button" class="re__figPanelClose" (click)="closeFigPanel()" aria-label="Close">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </header>
          @if (figPanel() === 'settings' || figPanel() === 'design') {
            <nav class="re__figPanelTabs">
              <button type="button" class="re__figPanelTab" [class.is-on]="figPanel() === 'settings'" (click)="openFigPanel('settings')">Settings</button>
              <button type="button" class="re__figPanelTab" [class.is-on]="figPanel() === 'design'"   (click)="openFigPanel('design')">Design</button>
            </nav>
          }

          @if (figPanel() === 'banner-design' || figPanel() === 'banner-layout') {
            <!-- Layout section panel — only renders when the figure
                 is in banner mode. Two tabs: Design (background +
                 column layout) and Layout (spacing + responsive). -->
            <nav class="re__figPanelTabs">
              <button type="button" class="re__figPanelTab" [class.is-on]="figPanel() === 'banner-design'"  (click)="openFigPanel('banner-design')">Design</button>
              <button type="button" class="re__figPanelTab" [class.is-on]="figPanel() === 'banner-layout'" (click)="openFigPanel('banner-layout')">Layout</button>
            </nav>
            @if (figPanel() === 'banner-design') {
              <div class="re__figPanelBody">
                <!-- Column background — styles applied uniformly to
                     every .re-banner-col inside the figure. -->
                <h5 class="re__figPanelSection">Column background</h5>
                <div class="re__figSegment">
                  <button type="button" class="re__figSegBtn" [class.is-on]="colBgKind() === 'color'" (click)="setColBgKind('color')">Color</button>
                  <button type="button" class="re__figSegBtn" [class.is-on]="colBgKind() === 'image'" (click)="setColBgKind('image')">Image</button>
                </div>
                <div class="re__figRow">
                  <label class="re__figTbLabel">Fill color</label>
                  <div class="re__figCtrl">
                    <div class="re__figTbNum">
                      <input type="number" min="0" max="100" class="re__figTbInput re__figTbInput--num"
                             [ngModel]="colFillOpacity()"
                             (ngModelChange)="setColFillOpacity($event)"/>
                      <span class="re__figTbUnit">%</span>
                    </div>
                    <app-color-picker [ngModel]="colFillColor()" (ngModelChange)="setColFillColor($event)" class="re__figSwatch"/>
                  </div>
                </div>
                <div class="re__figRow">
                  <label class="re__figTbLabel">Border color</label>
                  <div class="re__figCtrl">
                    <div class="re__figTbNum">
                      <input type="number" min="0" max="100" class="re__figTbInput re__figTbInput--num"
                             [ngModel]="colBorderOpacity()"
                             (ngModelChange)="setColBorderOpacity($event)"/>
                      <span class="re__figTbUnit">%</span>
                    </div>
                    <app-color-picker [ngModel]="colBorderColor()" (ngModelChange)="setColBorderColor($event)" class="re__figSwatch"/>
                  </div>
                </div>
                <div class="re__figRow">
                  <label class="re__figTbLabel">Border width</label>
                  <div class="re__figCtrl">
                    <div class="re__figTbNum">
                      <input type="number" min="0" max="32" class="re__figTbInput re__figTbInput--num"
                             [ngModel]="colBorderWidth()"
                             (ngModelChange)="setColBorderWidth($event)"/>
                      <span class="re__figTbUnit">px</span>
                    </div>
                    <input type="range" min="0" max="32" class="re__figSlider"
                           [ngModel]="colBorderWidth()"
                           (ngModelChange)="setColBorderWidth($event)"/>
                  </div>
                </div>
                <div class="re__figRow">
                  <label class="re__figTbLabel">Corner radius</label>
                  <div class="re__figCtrl">
                    <div class="re__figTbNum">
                      <input type="number" min="0" max="200" class="re__figTbInput re__figTbInput--num"
                             [ngModel]="colCornerRadius()"
                             (ngModelChange)="setColCornerRadius($event)"/>
                      <span class="re__figTbUnit">px</span>
                    </div>
                    <input type="range" min="0" max="200" class="re__figSlider"
                           [ngModel]="colCornerRadius()"
                           (ngModelChange)="setColCornerRadius($event)"/>
                  </div>
                </div>

                <!-- Section background -->
                <h5 class="re__figPanelSection">Section background</h5>
                <div class="re__figTbRow">
                  <span class="re__figLabelGroup">
                    Show background
                    <span class="re__figInfo" [appTooltip]="'Turn off to remove the banner backdrop.'">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </span>
                  </span>
                  <span class="re__figTbToggle" [class.is-on]="bannerBgShow()" (click)="setBannerBgShow(!bannerBgShow())"></span>
                </div>
                @if (bannerBgShow()) {
                  <div class="re__figSegment">
                    <button type="button" class="re__figSegBtn" [class.is-on]="bannerBgKind() === 'color'" (click)="setBannerBgKind('color')">Color</button>
                    <button type="button" class="re__figSegBtn" [class.is-on]="bannerBgKind() === 'image'" (click)="setBannerBgKind('image')">Image</button>
                  </div>
                  @if (bannerBgKind() === 'color') {
                    <div class="re__figRow">
                      <label class="re__figTbLabel">Fill color</label>
                      <div class="re__figCtrl">
                        <div class="re__figTbNum">
                          <input type="number" min="0" max="100" class="re__figTbInput re__figTbInput--num"
                                 [ngModel]="bannerBgOpacity()"
                                 (ngModelChange)="setBannerBgOpacity($event)"/>
                          <span class="re__figTbUnit">%</span>
                        </div>
                        <app-color-picker
                          [ngModel]="bannerBgColor()"
                          (ngModelChange)="setBannerBgColor($event)"
                          class="re__figSwatch"/>
                      </div>
                    </div>
                  } @else {
                    <div class="re__figBgImage">
                      @if (bannerBgImage()) {
                        <img [src]="bannerBgImage()" alt=""/>
                        <button type="button" class="re__figTbBtnGhost" (click)="pickBannerBgImage()">Replace</button>
                      } @else {
                        <button type="button" class="re__figBgImageEmpty" (click)="pickBannerBgImage()">
                          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                      }
                    </div>
                    @if (bannerBgImage()) {
                      <div class="re__figRow">
                        <label class="re__figTbLabel">Image opacity</label>
                        <div class="re__figCtrl">
                          <div class="re__figTbNum">
                            <input type="number" min="0" max="100" class="re__figTbInput re__figTbInput--num"
                                   [ngModel]="sectionImageOpacity()"
                                   (ngModelChange)="setSectionImageOpacity($event)"/>
                            <span class="re__figTbUnit">%</span>
                          </div>
                          <input type="range" min="0" max="100" class="re__figSlider"
                                 [ngModel]="sectionImageOpacity()"
                                 (ngModelChange)="setSectionImageOpacity($event)"/>
                        </div>
                      </div>
                      <div class="re__figRow">
                        <label class="re__figTbLabel">Background overlay</label>
                        <div class="re__figCtrl">
                          <div class="re__figTbNum">
                            <input type="number" min="0" max="100" class="re__figTbInput re__figTbInput--num"
                                   [ngModel]="sectionOverlayOpacity()"
                                   (ngModelChange)="setSectionOverlayOpacity($event)"/>
                            <span class="re__figTbUnit">%</span>
                          </div>
                          <app-color-picker [ngModel]="sectionOverlayColor()" (ngModelChange)="setSectionOverlayColor($event)" class="re__figSwatch"/>
                        </div>
                      </div>
                      <div class="re__figRow">
                        <label class="re__figTbLabel">Image scaling</label>
                        <select class="re__figSelect"
                                [ngModel]="sectionImageScaling()"
                                (ngModelChange)="setSectionImageScaling($event)">
                          <option value="cover">Cover</option>
                          <option value="contain">Contain</option>
                          <option value="fill">Fill</option>
                          <option value="tile">Tile</option>
                        </select>
                      </div>
                      <div class="re__figRow re__figRow--stack">
                        <label class="re__figTbLabel">Image position</label>
                        <div class="re__figPosGrid">
                          @for (n of [1,2,3,4,5,6,7,8,9]; track n) {
                            <button type="button"
                                    class="re__figPosCell"
                                    [class.is-on]="sectionImagePosition() === ('' + n)"
                                    (click)="setSectionImagePosition('' + n)"
                                    [attr.aria-label]="'Position ' + n">
                              <span class="re__figPosDot"></span>
                            </button>
                          }
                        </div>
                      </div>
                    }
                  }
                }

                <!-- Column layout -->
                <h5 class="re__figPanelSection">Column layout</h5>
                <div class="re__figSegment">
                  <button type="button" class="re__figSegBtn re__figSegBtn--icon" [class.is-on]="bannerColumns() === 1" (click)="setBannerColumns(1)" title="One column">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>
                  </button>
                  <button type="button" class="re__figSegBtn re__figSegBtn--icon" [class.is-on]="bannerColumns() === 2" (click)="setBannerColumns(2)" title="Two columns">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="8" height="16" rx="1"/><rect x="13" y="4" width="8" height="16" rx="1"/></svg>
                  </button>
                </div>
              </div>
            } @else {
              <!-- Layout tab -->
              <div class="re__figPanelBody">
                <h5 class="re__figPanelSection">Spacing</h5>
                <!-- Column gap: cross-arrows leading icon. -->
                <div class="re__figRow">
                  <label class="re__figTbLabel re__figTbLabel--info">
                    Column gap
                    <span class="re__figInfo" [appTooltip]="'Horizontal space between columns.'">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </span>
                  </label>
                  <div class="re__figCtrl">
                    <div class="re__figTbNum">
                      <svg class="re__figTbNumIcon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
                      </svg>
                      <input type="number" min="0" max="200" class="re__figTbInput re__figTbInput--num"
                             [ngModel]="bannerColGap()"
                             (ngModelChange)="setBannerGap($event)"/>
                      <span class="re__figTbUnit">px</span>
                    </div>
                    <input type="range" min="0" max="200" class="re__figSlider"
                           [ngModel]="bannerColGap()"
                           (ngModelChange)="setBannerGap($event)"/>
                  </div>
                </div>
                <!-- Column padding: side-by-side X + Y with link/unlink toggle. -->
                <div class="re__figRow re__figRow--stack">
                  <div class="re__figLabelLine">
                    <label class="re__figTbLabel re__figTbLabel--info">
                      Column padding
                      <span class="re__figInfo" [appTooltip]="'Padding inside each column. Click the link icon to keep X and Y in sync.'">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      </span>
                    </label>
                    <button type="button" class="re__figLinkBtn" [class.is-on]="bannerPadLinked()" (click)="toggleBannerPadLinked()" title="Link X and Y">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                      </svg>
                    </button>
                  </div>
                  <div class="re__figPadPair">
                    <div class="re__figCtrl re__figCtrl--inline">
                      <div class="re__figTbNum re__figTbNum--wide">
                        <svg class="re__figTbNumIcon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="4" x2="6" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/></svg>
                        <input type="number" min="0" max="200" class="re__figTbInput re__figTbInput--num"
                               [ngModel]="bannerColPadX()"
                               (ngModelChange)="onPadX($event)"/>
                        <span class="re__figTbUnit">px</span>
                      </div>
                      <input type="range" min="0" max="200" class="re__figSlider"
                             [ngModel]="bannerColPadX()"
                             (ngModelChange)="onPadX($event)"/>
                    </div>
                    <div class="re__figCtrl re__figCtrl--inline">
                      <div class="re__figTbNum re__figTbNum--wide">
                        <svg class="re__figTbNumIcon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                        <input type="number" min="0" max="200" class="re__figTbInput re__figTbInput--num"
                               [ngModel]="bannerColPadY()"
                               (ngModelChange)="onPadY($event)"/>
                        <span class="re__figTbUnit">px</span>
                      </div>
                      <input type="range" min="0" max="200" class="re__figSlider"
                             [ngModel]="bannerColPadY()"
                             (ngModelChange)="onPadY($event)"/>
                    </div>
                  </div>
                </div>
                <!-- Vertical margins: horizontal-bars leading icon. -->
                <div class="re__figRow">
                  <label class="re__figTbLabel re__figTbLabel--info">
                    Vertical margins
                    <span class="re__figInfo" [appTooltip]="'Space above and below the banner.'">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </span>
                  </label>
                  <div class="re__figCtrl">
                    <div class="re__figTbNum">
                      <svg class="re__figTbNumIcon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                      <input type="number" min="0" max="200" class="re__figTbInput re__figTbInput--num"
                             [ngModel]="bannerVMargin()"
                             (ngModelChange)="setBannerVMargin($event)"/>
                      <span class="re__figTbUnit">px</span>
                    </div>
                    <input type="range" min="0" max="200" class="re__figSlider"
                           [ngModel]="bannerVMargin()"
                           (ngModelChange)="setBannerVMargin($event)"/>
                  </div>
                </div>
                <!-- Responsive behavior (collapsible). -->
                <button type="button" class="re__figPanelSection re__figPanelSection--toggle"
                        (click)="bannerResponsiveOpen.set(!bannerResponsiveOpen())">
                  <span>Responsive behavior</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                       [style.transform]="bannerResponsiveOpen() ? 'rotate(180deg)' : 'none'">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                @if (bannerResponsiveOpen()) {
                  <div class="re__figRow">
                    <label class="re__figTbLabel re__figTbLabel--info">
                      Behavior
                      <span class="re__figInfo" [appTooltip]="'How the banner reflows below the breakpoint.'">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      </span>
                    </label>
                    <div class="re__figSegment re__figSegment--icon">
                      <button type="button" class="re__figSegBtn re__figSegBtn--icon" [class.is-on]="bannerBehavior() === 'stacked'" (click)="setBannerBehavior('stacked')" title="Stack vertically">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="6" rx="1"/><rect x="4" y="13" width="16" height="6" rx="1"/></svg>
                      </button>
                      <button type="button" class="re__figSegBtn re__figSegBtn--icon" [class.is-on]="bannerBehavior() === 'horizontal'" (click)="setBannerBehavior('horizontal')" title="Keep horizontal">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="8" height="12" rx="1"/><rect x="13" y="6" width="8" height="12" rx="1"/></svg>
                      </button>
                    </div>
                  </div>
                  <div class="re__figRow">
                    <label class="re__figTbLabel re__figTbLabel--info">
                      Breakpoint
                      <span class="re__figInfo" [appTooltip]="'Viewport width (px) below which the banner adopts the chosen Behavior.'">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      </span>
                    </label>
                    <div class="re__figCtrl">
                      <div class="re__figTbNum">
                        <input type="number" min="200" max="1600" class="re__figTbInput re__figTbInput--num"
                               [ngModel]="bannerBreakpoint()"
                               (ngModelChange)="setBannerBreakpoint($event)"/>
                        <span class="re__figTbUnit">px</span>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          } @else if (figPanel() === 'settings') {
            <div class="re__figPanelBody">
              <label class="re__figTbLabel">Alt text</label>
              <textarea class="re__figTbInput" rows="2"
                        placeholder="e.g., A cat sleeping on a white blanket"
                        [disabled]="imageDecorative()"
                        [ngModel]="imageAlt()"
                        (ngModelChange)="imageAlt.set($event)"></textarea>
              <div class="re__figTbRow">
                <span class="re__figLabelGroup">
                  Mark as decorative
                  <span class="re__figInfo" [appTooltip]="'Decorative images won\\'t be announced by screen readers. Use for visual elements that don\\'t add information to the content of a page.'">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                  </span>
                </span>
                <span class="re__figTbToggle" [class.is-on]="imageDecorative()" (click)="imageDecorative.set(!imageDecorative())"></span>
              </div>
              <h5 class="re__figPanelSection">Options</h5>
              <div class="re__figTbRow">
                <span class="re__figLabelGroup">
                  Click to expand
                  <span class="re__figInfo" [appTooltip]="'When on, visitors can click the image to view a larger version in a lightbox.'">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                  </span>
                </span>
                <span class="re__figTbToggle" [class.is-on]="imageClickExpand()" (click)="imageClickExpand.set(!imageClickExpand())"></span>
              </div>
              <div class="re__figTbRow">
                <span class="re__figLabelGroup">
                  Allow download
                  <span class="re__figInfo" [appTooltip]="'When on, visitors can right-click and save the image to their device.'">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                  </span>
                </span>
                <span class="re__figTbToggle" [class.is-on]="imageAllowDownload()" (click)="imageAllowDownload.set(!imageAllowDownload())"></span>
              </div>
              <div class="re__figTbActions">
                <button type="button" class="re__figTbBtnGhost" (click)="closeFigPanel()">Cancel</button>
                <button type="button" class="re__figTbBtnPrimary" (click)="applyImageSettings()">Save</button>
              </div>
            </div>
          } @else {
            <div class="re__figPanelBody">
              <!-- Border color: opacity % + swatch + opacity slider -->
              <div class="re__figRow">
                <label class="re__figTbLabel">Border color</label>
                <div class="re__figCtrl">
                  <div class="re__figTbNum">
                    <input type="number" min="0" max="100" class="re__figTbInput re__figTbInput--num"
                           [ngModel]="designBorderOpacity()"
                           (ngModelChange)="onDesignBorderOpacity($event)"/>
                    <span class="re__figTbUnit">%</span>
                  </div>
                  <app-color-picker
                    [ngModel]="designBorderColor()"
                    (ngModelChange)="onDesignBorderColor($event)"
                    class="re__figSwatch"/>
                  <input type="range" min="0" max="100" class="re__figSlider re__figSlider--opacity"
                         [style.--c]="designBorderColor()"
                         [ngModel]="designBorderOpacity()"
                         (ngModelChange)="onDesignBorderOpacity($event)"/>
                </div>
              </div>
              <!-- Border width: number + slider -->
              <div class="re__figRow">
                <label class="re__figTbLabel">Border width</label>
                <div class="re__figCtrl">
                  <div class="re__figTbNum">
                    <input type="number" min="0" max="32" class="re__figTbInput re__figTbInput--num"
                           [ngModel]="designBorderWidth()"
                           (ngModelChange)="onDesignBorderWidth($event)"/>
                    <span class="re__figTbUnit">px</span>
                  </div>
                  <input type="range" min="0" max="32" class="re__figSlider"
                         [ngModel]="designBorderWidth()"
                         (ngModelChange)="onDesignBorderWidth($event)"/>
                </div>
              </div>
              <!-- Corner radius: number + slider -->
              <div class="re__figRow">
                <label class="re__figTbLabel">Corner radius</label>
                <div class="re__figCtrl">
                  <div class="re__figTbNum">
                    <input type="number" min="0" max="200" class="re__figTbInput re__figTbInput--num"
                           [ngModel]="designCornerRadius()"
                           (ngModelChange)="onDesignCornerRadius($event)"/>
                    <span class="re__figTbUnit">px</span>
                  </div>
                  <input type="range" min="0" max="200" class="re__figSlider"
                         [ngModel]="designCornerRadius()"
                         (ngModelChange)="onDesignCornerRadius($event)"/>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- Banner-column toolbar — secondary floating bar that appears
           above the selected column inside a banner figure. Add /
           reorder / delete column actions. -->
      @if (selectedColumn() && columnToolbar().show) {
        <div class="re__colTb"
             [style.top.px]="columnToolbar().top"
             [style.left.px]="columnToolbar().left"
             (mousedown)="$event.stopPropagation()">
          <div class="re__figTbDd">
            <button type="button" class="re__figTbBtn" (click)="toggleColumnMenu($event, 'add')" title="Add column">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            @if (columnMenu() === 'add') {
              <div class="re__figTbMenu">
                <button type="button" class="re__figTbItem" (click)="addColumnBefore()">+ Add column before</button>
                <button type="button" class="re__figTbItem" (click)="addColumnAfter()">+ Add column after</button>
              </div>
            }
          </div>
          <button type="button" class="re__figTbBtn" (click)="moveColumnLeft()" title="Move column left">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <button type="button" class="re__figTbBtn" (click)="moveColumnRight()" title="Move column right">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
          <span class="re__figTbSep"></span>
          <button type="button" class="re__figTbBtn re__figTbBtn--danger" (click)="deleteSelectedColumn()" title="Delete column">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      }

      <!-- Floating selection toolbar for embed blocks (video iframe,
           hosted video). Position tracks the selected figure's
           bounding rect. Click-outside deselects. -->
      @if (selectedFigure() && figureToolbar().show) {
        <div class="re__figTb"
             [style.top.px]="figureToolbar().top"
             [style.left.px]="figureToolbar().left"
             (mousedown)="$event.stopPropagation()">
          <!-- Size + Align — hidden in banner mode, where the figure
               only resizes horizontally and uses its own valign +
               column controls. -->
          @if (!isBannerFigure()) {
            <!-- Size -->
            <div class="re__figTbDd">
              <button type="button" class="re__figTbBtn" (click)="toggleFigMenu($event, 'size')" title="Size">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="6" width="18" height="12" rx="1"/>
                </svg>
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              @if (figMenu() === 'size') {
                <div class="re__figTbMenu">
                  <button type="button" class="re__figTbItem" [class.is-on]="figureSize() === 'compact'"  (click)="setFigSize('compact')">Compact</button>
                  <button type="button" class="re__figTbItem" [class.is-on]="figureSize() === 'standard'" (click)="setFigSize('standard')">Standard</button>
                  <button type="button" class="re__figTbItem" [class.is-on]="figureSize() === 'extended'" (click)="setFigSize('extended')">Extended</button>
                  <button type="button" class="re__figTbItem" [class.is-on]="figureSize() === 'original'" (click)="setFigSize('original')">Original size</button>
                </div>
              }
            </div>
            <!-- Align -->
            <div class="re__figTbDd">
              <button type="button" class="re__figTbBtn" (click)="toggleFigMenu($event, 'align')" title="Alignment">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="3" y1="6"  x2="21" y2="6"/>
                  <line x1="6" y1="12" x2="18" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              @if (figMenu() === 'align') {
                <div class="re__figTbMenu">
                  <button type="button" class="re__figTbItem" [class.is-on]="figureAlign() === 'left'"   (click)="setFigAlign('left')">Align left</button>
                  <button type="button" class="re__figTbItem" [class.is-on]="figureAlign() === 'center'" (click)="setFigAlign('center')">Align center</button>
                  <button type="button" class="re__figTbItem" [class.is-on]="figureAlign() === 'right'"  (click)="setFigAlign('right')">Align right</button>
                  <div class="re__figTbDivider"></div>
                  <button type="button" class="re__figTbItem" (click)="toggleFigWrap()">
                    <span>Wrap text</span>
                    <span class="re__figTbToggle" [class.is-on]="figureWrap()"></span>
                  </button>
                </div>
              }
            </div>
          }
          <!-- Banner toggle (image only) -->
          @if (isImageFigure()) {
            <button type="button" class="re__figTbBtn" [class.is-on]="isBannerFigure()" (click)="toggleBanner()" title="Banner">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="1"/>
                <line x1="2" y1="11" x2="22" y2="11"/>
              </svg>
            </button>
            @if (isBannerFigure()) {
              <!-- Vertical-alignment dropdown (banner only) -->
              <div class="re__figTbDd">
                <button type="button" class="re__figTbBtn" (click)="toggleFigMenu($event, 'valign')" title="Vertical alignment">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <rect x="9" y="9" width="6" height="9"/>
                    <line x1="3" y1="20" x2="21" y2="20"/>
                  </svg>
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                @if (figMenu() === 'valign') {
                  <div class="re__figTbMenu">
                    <button type="button" class="re__figTbItem" [class.is-on]="bannerVAlign() === 'top'"    (click)="setBannerVAlign('top')">Align top</button>
                    <button type="button" class="re__figTbItem" [class.is-on]="bannerVAlign() === 'middle'" (click)="setBannerVAlign('middle')">Align middle</button>
                    <button type="button" class="re__figTbItem" [class.is-on]="bannerVAlign() === 'bottom'" (click)="setBannerVAlign('bottom')">Align bottom</button>
                  </div>
                }
              </div>
              <!-- Add column (banner only) -->
              <button type="button" class="re__figTbBtn" (click)="addBannerColumn()" title="Add column">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            }
          }
          <!-- Settings (every figure type — opens Image panel for
               normal images, Layout-section panel for banners). -->
          @if (isImageFigure()) {
            <button type="button" class="re__figTbBtn" [class.is-on]="figPanel() === 'settings' || figPanel() === 'banner-design' || figPanel() === 'banner-layout'" (click)="openFigPanel('settings')" title="Settings">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          }
          <!-- Design — image-only (banner uses Layout section panel
               accessed via Settings). -->
          @if (isImageFigure() && !isBannerFigure()) {
            <button type="button" class="re__figTbBtn" [class.is-on]="figPanel() === 'design'" (click)="openFigPanel('design')" title="Design">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z"/>
                <line x1="2" y1="2" x2="9.586" y2="9.586"/>
                <circle cx="11" cy="11" r="2"/>
              </svg>
            </button>
          }
          <!-- Link (normal image figures only — hidden in banner). -->
          @if (isImageFigure() && !isBannerFigure()) {
            <div class="re__figTbDd">
              <button type="button" class="re__figTbBtn" [class.is-on]="figMenu() === 'link'" (click)="toggleFigMenu($event, 'link')" title="Link">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </button>
              @if (figMenu() === 'link') {
                <div class="re__figTbPanel re__figTbPanel--lg">
                  <div class="re__figTbPanelHead">
                    <h4>Link</h4>
                    <button type="button" class="re__figTbPanelClose" (click)="figMenu.set(null)" aria-label="Close">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <label class="re__figTbLabel">URL</label>
                  <input type="url" class="re__figTbInput"
                         placeholder="Enter or paste a link"
                         [ngModel]="linkUrl()"
                         (ngModelChange)="linkUrl.set($event)"/>
                  <div class="re__figTbRow">
                    <span>Open link in a new tab</span>
                    <span class="re__figTbToggle" [class.is-on]="linkNewTab()" (click)="linkNewTab.set(!linkNewTab())"></span>
                  </div>
                  <div class="re__figTbRow">
                    <span>Noreferrer</span>
                    <span class="re__figTbToggle" [class.is-on]="linkNoReferrer()" (click)="linkNoReferrer.set(!linkNoReferrer())"></span>
                  </div>
                  <div class="re__figTbRow">
                    <span>Nofollow</span>
                    <span class="re__figTbToggle" [class.is-on]="linkNoFollow()" (click)="linkNoFollow.set(!linkNoFollow())"></span>
                  </div>
                  <div class="re__figTbActions">
                    <button type="button" class="re__figTbBtnGhost" (click)="figMenu.set(null)">Cancel</button>
                    <button type="button" class="re__figTbBtnPrimary" (click)="applyLink()">Save</button>
                  </div>
                </div>
              }
            </div>
          }
          <span class="re__figTbSep"></span>
          <!-- Replace -->
          <button type="button" class="re__figTbBtn" (click)="onReplaceFigure()" title="Replace">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          <!-- Delete -->
          <button type="button" class="re__figTbBtn re__figTbBtn--danger" (click)="deleteSelectedFigure()" title="Delete">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      }

      </div>

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

    .re__slot:empty { display: none; }
    .re__slot { background: inherit; }

    /* Wraps the editable surface so the floating "+" button is
       absolutely positioned against the surface only — guarantees it
       can never overlap the sticky toolbar above. */
    .re__surfaceWrap { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; }

    /* Floating "+" button — same layout idea as Wix Ricos. Lives
       above the surface, positioned by the component based on the
       active block's bounding rect. */
    .re__addBtn {
      position: absolute;
      width: 26px; height: 26px;
      display: inline-flex; align-items: center; justify-content: center;
      background: #fff;
      color: #64748b;
      border: 1px solid #e2e8f0;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(15,23,42,.06);
      transition: transform 120ms ease, background 120ms ease, color 120ms ease, border-color 120ms ease;
      z-index: 5;
    }
    .re__addBtn:hover { background: #e6f7fa; color: #32acc1; border-color: #a6d8df; transform: scale(1.05); }
    .re__addBtn:active { transform: scale(.95); }

    /* Floating selection toolbar for embed blocks (videos). Mirrors
       the project's pill-button look so it slots into the same
       visual vocabulary as the ConfirmModal / VideoModal buttons. */
    .re__figTb {
      position: absolute;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      box-shadow: 0 8px 24px rgba(15,23,42,.12);
      z-index: 8;
      white-space: nowrap;
    }
    .re__figTbBtn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 6px 8px;
      background: transparent;
      border: none;
      border-radius: 999px;
      color: #475569;
      cursor: pointer;
      transition: background 120ms, color 120ms;
    }
    .re__figTbBtn:hover { background: #f1f5f9; color: #0f172a; }
    .re__figTbBtn--danger:hover { background: #fef2f2; color: #b91c1c; }
    .re__figTbSep { width: 1px; height: 18px; background: #e2e8f0; margin: 0 4px; }
    .re__figTbDd { position: relative; display: inline-flex; }
    .re__figTbMenu {
      position: absolute;
      /* Open upward — the toolbar sits below the figure and often
         lands near the viewport bottom; opening downward (top:100%)
         clipped the last option ("Extended" / "Wrap text") on
         shorter viewports. The figure above the toolbar always has
         enough space upward to fit a 3-item menu. */
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      min-width: 180px;
      padding: 6px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(15,23,42,.14);
      display: flex;
      flex-direction: column;
      gap: 2px;
      z-index: 9;
    }
    .re__figTbItem {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 12px;
      background: transparent;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      color: #1e293b;
      cursor: pointer;
      text-align: start;
    }
    .re__figTbItem:hover { background: #f1f5f9; }
    .re__figTbItem.is-on { background: #32acc1; color: #fff; }
    .re__figTbDivider { height: 1px; background: #e2e8f0; margin: 4px 6px; }
    .re__figTbToggle {
      display: inline-block;
      width: 28px;
      height: 16px;
      background: #cbd5e1;
      border-radius: 999px;
      position: relative;
      transition: background 120ms;
    }
    .re__figTbToggle::after {
      content: '';
      position: absolute;
      top: 2px; left: 2px;
      width: 12px; height: 12px;
      background: #fff;
      border-radius: 50%;
      transition: transform 120ms;
    }
    .re__figTbToggle.is-on { background: #32acc1; }
    .re__figTbToggle.is-on::after { transform: translateX(12px); }
    .re__figTbItem.is-on .re__figTbToggle { background: rgba(255,255,255,.4); }

    /* Larger popover used for Link / Settings / Design panels.
       Floats above the toolbar, anchored to the parent dropdown. */
    .re__figTbPanel {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      min-width: 240px;
      padding: 12px 14px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(15,23,42,.14);
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 9;
    }
    .re__figTbPanel--lg { min-width: 280px; }
    .re__figTbPanelHead {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 2px;
    }
    .re__figTbPanelHead h4 { margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; }
    .re__figTbPanelClose {
      width: 22px; height: 22px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 50%; color: #64748b; cursor: pointer;
    }
    .re__figTbPanelClose:hover { background: #f1f5f9; color: #0f172a; }
    .re__figTbLabel { font-size: 12px; font-weight: 500; color: #475569; }
    .re__figTbInput {
      width: 100%;
      padding: 8px 10px;
      font: inherit;
      font-size: 13px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #0f172a;
    }
    .re__figTbInput:focus { outline: none; border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.15); }
    .re__figTbInput:disabled { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; opacity: .8; }
    .re__figTbRow { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #1e293b; padding: 2px 0; }
    .re__figTbRow--grid { gap: 12px; }
    .re__figTbRow .re__figTbToggle { cursor: pointer; }
    /* Number + unit combined into a single rounded "chip" — visually
       one control. Tap the input to type, the unit on the right is
       static muted text. */
    .re__figTbNum {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 0 10px 0 12px;
      height: 32px;
      width: 96px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      transition: border-color 120ms, box-shadow 120ms;
    }
    .re__figTbNum:focus-within { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.15); }
    .re__figTbInput--num {
      flex: 1;
      width: auto !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      font: inherit;
      font-size: 13px;
      text-align: end;
      color: #0f172a;
    }
    .re__figTbInput--num:focus { outline: none !important; box-shadow: none !important; border: 0 !important; }
    /* Hide the native number spinner buttons — the slider popover
       and direct typing cover the same UX without the visual noise. */
    .re__figTbInput--num::-webkit-outer-spin-button,
    .re__figTbInput--num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .re__figTbInput--num[type=number] { -moz-appearance: textfield; }
    .re__figTbUnit { font-size: 12px; color: #94a3b8; flex-shrink: 0; }
    .re__figTbActions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
    .re__figTbBtnGhost {
      padding: 6px 14px;
      background: #f1f5f9;
      border: none;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
    }
    .re__figTbBtnGhost:hover { background: #e2e8f0; color: #0f172a; }
    .re__figTbBtnPrimary {
      padding: 6px 14px;
      background: #32acc1;
      border: none;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
    }
    .re__figTbBtnPrimary:hover { background: #2a93a6; }
    .re__figTbBtn.is-on { background: #e6f7fa; color: #0e7490; }

    /* Column toolbar — same pill chrome as the figure toolbar, sits
       above the selected column inside a banner. */
    .re__colTb {
      position: absolute;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      box-shadow: 0 8px 24px rgba(15,23,42,.12);
      z-index: 9;
      white-space: nowrap;
    }
    /* Selected column outline — distinct from the figure outline so
       it's clear which slot the toolbar is targeting. */
    :host ::ng-deep .re__surface .re-banner-col.is-selected-col {
      outline: 1.5px solid #32acc1 !important;
      outline-offset: 2px !important;
      background: rgba(50,172,193,.04) !important;
    }

    /* Floating, draggable Image panel — Wix's right-side "Image"
       window with Settings + Design tabs. The whole panel is
       positioned absolutely against the surface wrap so it floats
       on top of the canvas without disturbing the contenteditable
       text flow underneath. */
    .re__figPanel {
      position: absolute;
      width: 300px;
      max-height: calc(100% - 32px);
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(15,23,42,.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10;
    }
    .re__figPanelHead {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px 10px;
      cursor: grab;
      user-select: none;
    }
    .re__figPanelHead:active { cursor: grabbing; }
    .re__figPanelHead h4 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
    .re__figPanelClose {
      width: 26px; height: 26px;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent; border: none; border-radius: 50%; color: #64748b; cursor: pointer;
    }
    .re__figPanelClose:hover { background: #f1f5f9; color: #0f172a; }
    .re__figPanelTabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #e2e8f0;
    }
    .re__figPanelTab {
      padding: 10px 6px;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
    }
    .re__figPanelTab:hover { color: #0f172a; }
    .re__figPanelTab.is-on { color: #32acc1; border-bottom-color: #32acc1; }
    .re__figPanelBody { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
    .re__figPanelSection { margin: 6px 0 2px; font-size: 13px; font-weight: 700; color: #0f172a; }

    /* Segmented selector used inside the Layout-section panel
       (Color/Image, One/Two column). Pill-style with the active
       segment in teal. */
    .re__figSegment { display: flex; gap: 6px; padding: 4px; background: #f1f5f9; border-radius: 10px; }
    .re__figSegBtn {
      flex: 1;
      padding: 6px 10px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .re__figSegBtn:hover { color: #0f172a; }
    .re__figSegBtn.is-on { background: #fff; color: #32acc1; border-color: #32acc1; box-shadow: 0 1px 2px rgba(15,23,42,.05); }
    .re__figSegBtn--icon { padding: 8px; }

    /* Section-background image picker tile. Big "+" when empty,
       compact thumbnail + Replace button once filled. */
    .re__figBgImage { display: flex; flex-direction: column; gap: 6px; }
    .re__figBgImage img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; }
    .re__figBgImageEmpty {
      width: 100%;
      aspect-ratio: 4/3;
      background: #f8fafc;
      border: 2px dashed #cbd5e1;
      border-radius: 8px;
      color: #94a3b8;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .re__figBgImageEmpty:hover { border-color: #32acc1; color: #32acc1; }

    /* Native <select> styled to match the panel inputs. */
    .re__figSelect {
      flex: 1;
      padding: 6px 30px 6px 12px;
      height: 32px;
      font: inherit;
      font-size: 13px;
      color: #0f172a;
      background: #fff url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e") no-repeat right 10px center;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      -webkit-appearance: none;
      appearance: none;
      cursor: pointer;
    }
    .re__figSelect:focus { outline: none; border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.15); }

    /* 3x3 image-position grid. Each cell is a button with a small
       dot — clicking sets the picked position. */
    .re__figPosGrid {
      display: grid;
      grid-template-columns: repeat(3, 28px);
      grid-template-rows: repeat(3, 28px);
      gap: 4px;
      justify-content: end;
    }
    .re__figPosCell {
      width: 28px; height: 28px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .re__figPosCell:hover { border-color: #cbd5e1; }
    .re__figPosCell.is-on { background: #32acc1; border-color: #32acc1; }
    .re__figPosDot { width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; opacity: 0; transition: opacity 100ms; }
    .re__figPosCell.is-on .re__figPosDot { background: #fff; opacity: 1; }

    /* Variants used by the new Layout-tab rows. */
    .re__figRow--stack { flex-direction: column; align-items: stretch; gap: 6px; }
    .re__figLabelLine { display: flex; align-items: center; justify-content: space-between; }
    .re__figLabelLine .re__figTbLabel { flex: 1; }
    .re__figLinkBtn {
      width: 26px; height: 26px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      color: #64748b;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .re__figLinkBtn:hover { color: #0f172a; border-color: #cbd5e1; }
    .re__figLinkBtn.is-on { background: #e6f7fa; color: #0e7490; border-color: #32acc1; }
    .re__figPadPair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .re__figCtrl--inline { flex-direction: column; align-items: stretch; gap: 4px; }
    .re__figTbNum--wide { width: 100%; }
    .re__figTbNumIcon { color: #94a3b8; flex-shrink: 0; }
    .re__figSegment--icon { padding: 4px; gap: 4px; }
    .re__figTbLabel--info { display: inline-flex; align-items: center; gap: 4px; }
    /* Section header that doubles as a collapsible toggle. */
    .re__figPanelSection--toggle {
      display: flex !important;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 0;
      background: transparent;
      border: none;
      cursor: pointer;
      color: #0f172a;
      font-size: 13px;
      font-weight: 700;
      text-align: start;
    }
    .re__figPanelSection--toggle svg { color: #64748b; transition: transform 120ms; }
    /* Design-tab rows — label on the LEFT, control group on the
       RIGHT, vertically centred. The unit pill (px / %) sits INSIDE
       the same rounded box as the number for a single visual
       element per setting. The slider still floats in as a popover
       on focus. */
    .re__figRow { display: flex; align-items: center; justify-content: space-between; gap: 12px; position: relative; min-height: 32px; }
    .re__figRow > .re__figTbLabel { flex: 1; font-size: 13px; color: #1e293b; font-weight: 500; }
    .re__figCtrl { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    /* Squash the shared <app-color-picker> down to just its swatch.
       Keep the swatch's native size + inline-style background so the
       picked colour stays visible — only the hex text and chevron
       are hidden. The picker's popover still opens normally on click. */
    .re__figSwatch { flex-shrink: 0; display: inline-flex; }
    .re__figSwatch ::ng-deep button {
      width: auto !important;
      padding: 3px !important;
      border-color: #e2e8f0 !important;
      border-radius: 6px !important;
    }
    /* Hide the hex text wrapper (anything that isn't the swatch
       inside the inner group) and the chevron icon. */
    .re__figSwatch ::ng-deep button > span > span:nth-child(2),
    .re__figSwatch ::ng-deep button > svg { display: none !important; }
    /* Make the colour square a touch larger so it reads as a single
       chip rather than a tiny dot. */
    .re__figSwatch ::ng-deep button > span > span:first-child {
      width: 22px !important;
      height: 22px !important;
      border-radius: 4px !important;
    }
    .re__figSlider {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 6px;
      padding: 10px 12px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 6px 18px rgba(15,23,42,.12);
      z-index: 12;
      -webkit-appearance: none;
      appearance: none;
      height: auto;
      box-sizing: border-box;
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-4px);
      transition: opacity 120ms ease, transform 120ms ease, visibility 0s linear 120ms;
    }
    /* Reveal when the parent row has focus inside (number input OR
       the slider itself — keeps the popover open while the user is
       actually dragging the thumb). */
    .re__figRow:focus-within .re__figSlider {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
      transition: opacity 120ms ease, transform 120ms ease, visibility 0s;
    }
    /* The native range input renders its own thin track inside the
       popover container. */
    .re__figSlider::-webkit-slider-runnable-track,
    .re__figSlider::-moz-range-track {
      height: 6px;
      background: linear-gradient(to right, #e2e8f0, #32acc1);
      border-radius: 999px;
    }
    .re__figSlider--opacity {
      /* Opacity track shows the active colour fading from transparent
         to fully opaque — same visual cue Wix uses. */
      background: linear-gradient(to right, rgba(0,0,0,0), var(--c, #000));
    }
    .re__figSlider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 16px; height: 16px;
      background: #32acc1;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(15,23,42,.2);
    }
    .re__figSlider::-moz-range-thumb {
      width: 16px; height: 16px;
      background: #32acc1;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(15,23,42,.2);
    }
    /* Label + info-icon pair used in the Settings rows. The (i)
       carries an appTooltip that explains the toggle, mirroring the
       Wix help affordance the user flagged. */
    .re__figLabelGroup { display: inline-flex; align-items: center; gap: 4px; }
    .re__figInfo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px; height: 16px;
      color: #94a3b8;
      cursor: help;
    }
    .re__figInfo:hover { color: #32acc1; }

    /* Selected-figure highlight + size/align variants applied to
       inserted <figure.re-embed-figure> blocks. The classes are
       added by the rich-editor's selection toolbar; consumers
       rendering the post outside the editor get the same look. */
    /* Selected outline — the CSS outline property follows the
       figure's border-radius in modern browsers, so we leave the
       radius alone and let any user-set rounding show through. */
    :host ::ng-deep .re__surface figure.re-embed-figure.is-selected {
      outline: 2px solid #32acc1 !important;
      outline-offset: 4px !important;
    }
    /* Drag-to-resize handles — 8 dots positioned by JS to wrap the
       inner <img> (or <iframe> for video), NOT the figure's outer
       box. The figure also contains the caption underneath, so
       positioning the handles against the figure edge would put the
       south handles in the caption area. JS reads the img's offset
       rect each refresh and sets each handle's top/left in px. */
    :host ::ng-deep .re__surface .re__resizer {
      position: absolute !important;
      width: 12px !important;
      height: 12px !important;
      background: #fff !important;
      border: 2px solid #32acc1 !important;
      border-radius: 50% !important;
      z-index: 6 !important;
      box-shadow: 0 1px 2px rgba(15,23,42,.15) !important;
      margin: -6px 0 0 -6px !important;
    }
    :host ::ng-deep .re__surface .re__resizer--n,
    :host ::ng-deep .re__surface .re__resizer--s  { cursor: ns-resize; }
    :host ::ng-deep .re__surface .re__resizer--e,
    :host ::ng-deep .re__surface .re__resizer--w  { cursor: ew-resize; }
    :host ::ng-deep .re__surface .re__resizer--ne,
    :host ::ng-deep .re__surface .re__resizer--sw { cursor: nesw-resize; }
    :host ::ng-deep .re__surface .re__resizer--nw,
    :host ::ng-deep .re__surface .re__resizer--se { cursor: nwse-resize; }

    /* The .re-has-radius class is a hook for any consumer that
       wants to react when the image has rounded corners (e.g. to
       tighten the caption's gap). The figure box itself stays
       rectangular — only the inner img is rounded. */

    /* Inline radius drag-grip — small square handle that sits on the
       rounded corner curve. Dragging diagonally inward / outward
       adjusts the corner radius live, the same way Wix exposes it. */
    :host ::ng-deep .re__surface .re__radiusGrip {
      position: absolute !important;
      width: 10px !important;
      height: 10px !important;
      margin: -5px 0 0 -5px !important;
      background: #fff !important;
      border: 2px solid #32acc1 !important;
      border-radius: 3px !important;
      cursor: nwse-resize !important;
      z-index: 6 !important;
      box-shadow: 0 1px 3px rgba(15,23,42,.2) !important;
    }
    :host ::ng-deep .re__surface .re__radiusGrip:hover { background: #e6f7fa !important; }

    /* Transient "Radius N" feedback chip — same visual language as
       the size indicator that appears on Wix's media blocks while
       you tweak the corner radius. Auto-removed by JS after 900ms. */
    :host ::ng-deep .re__surface .re__radiusChip {
      position: absolute !important;
      top: 8px !important;
      left: 8px !important;
      padding: 4px 10px !important;
      background: #e6f7fa !important;
      color: #0e7490 !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      border-radius: 999px !important;
      box-shadow: 0 1px 3px rgba(15,23,42,.1) !important;
      pointer-events: none !important;
      z-index: 7 !important;
      animation: re__chipPop .15s ease-out !important;
    }
    @keyframes re__chipPop { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
    /* Size + align rules use COMPOUND class selectors so they beat
       the single-class base rule's specificity. Without the second
       class anchor the base rule (declared later in source order)
       wins because of its width/max-width !important pair, and the
       Compact / Extended variants would become no-ops. */
    :host ::ng-deep .re__surface figure.re-embed-figure.re-size-compact  { max-width: 50% !important; width: 50% !important; }
    :host ::ng-deep .re__surface figure.re-embed-figure.re-size-standard { max-width: 100% !important; width: 100% !important; }
    :host ::ng-deep .re__surface figure.re-embed-figure.re-size-extended {
      max-width: none !important;
      width: calc(100% + 64px) !important;
      margin-left: -32px !important;
      margin-right: -32px !important;
    }
    /* Render at the image's intrinsic size — let the <img> own its
       dimensions. Useful for small assets (icons, illustrations,
       screenshots) where stretching to 100% looks blurry. */
    :host ::ng-deep .re__surface figure.re-embed-figure.re-size-original {
      width: auto !important;
      max-width: 100% !important;
    }
    /* Descendant selector (no direct-child combinator) so the rule
       still matches when the img is wrapped in an anchor from the
       Link popover. */
    :host ::ng-deep .re__surface figure.re-embed-figure.re-size-original img {
      width: auto !important;
      max-width: 100% !important;
    }
    :host ::ng-deep .re__surface figure.re-embed-figure.re-align-left   { margin-inline-start: 0    !important; margin-inline-end: auto !important; }
    :host ::ng-deep .re__surface figure.re-embed-figure.re-align-center { margin-inline-start: auto !important; margin-inline-end: auto !important; }
    :host ::ng-deep .re__surface figure.re-embed-figure.re-align-right  { margin-inline-start: auto !important; margin-inline-end: 0    !important; }
    :host ::ng-deep .re__surface figure.re-embed-figure.re-wrap-text.re-align-left  { float: left  !important; margin: 0 16px 8px 0 !important; }
    :host ::ng-deep .re__surface figure.re-embed-figure.re-wrap-text.re-align-right { float: right !important; margin: 0 0 8px 16px !important; }

    /* Banner-mode figure rendering. Drives layout from CSS vars set
       by applyBannerStyles() so the markup stays declarative and
       round-trips through saved HTML correctly. */
    :host ::ng-deep .re__surface figure.re-embed-figure.re-banner {
      position: relative !important;
      min-height: 220px !important;
      margin-block: var(--re-banner-margin, 50px) !important;
      overflow: hidden !important;
      background-color: var(--re-banner-bg, transparent) !important;
      background-image: var(--re-banner-bg-image, none) !important;
      background-size: cover !important;
      background-position: center !important;
    }
    :host ::ng-deep .re__surface .re-banner .re-embed-video,
    :host ::ng-deep .re__surface .re-banner > img {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      pointer-events: none !important;
    }
    :host ::ng-deep .re__surface .re-banner .re-banner-overlay {
      position: relative !important;
      z-index: 1 !important;
      display: grid !important;
      grid-template-columns: repeat(var(--re-banner-cols, 1), 1fr) !important;
      gap: var(--re-banner-gap, 20px) !important;
      padding: var(--re-banner-pad-y, 18px) var(--re-banner-pad-x, 0px) !important;
      width: 100% !important;
      /* Stretch to the full figure height (within the column flex
         layout) so vertical alignment has space to redistribute the
         columns. Without this, align-items on the grid is a no-op
         because the overlay would just shrink to content height. */
      flex: 1 1 auto !important;
      min-height: 220px !important;
      align-content: start !important;
      box-sizing: border-box !important;
    }
    :host ::ng-deep .re__surface .re-banner.re-banner-vtop .re-banner-overlay { align-content: start  !important; }
    :host ::ng-deep .re__surface .re-banner.re-banner-vmid .re-banner-overlay { align-content: center !important; }
    :host ::ng-deep .re__surface .re-banner.re-banner-vbot .re-banner-overlay { align-content: end    !important; }
    /* align-content (below, on .re-banner-overlay) handles the
       per-figure vertical alignment — using align-items here would
       only stretch each column individually instead of moving the
       whole row. */
    /* Banner columns — invisible by default, like Wix. Only when the
       banner is actively selected do we show a faint outline so the
       user can see column boundaries while editing. Hover bumps the
       outline to teal; selecting a specific column gets a solid
       teal border via the .is-selected-col rule above. */
    :host ::ng-deep .re__surface .re-banner .re-banner-col {
      padding: 12px 16px !important;
      min-height: 60px !important;
      border-radius: 6px !important;
      transition: outline-color 120ms ease, background 120ms ease;
    }
    :host ::ng-deep .re__surface .re-banner.is-selected .re-banner-col {
      outline: 1px solid rgba(255, 255, 255, .35) !important;
    }
    :host ::ng-deep .re__surface .re-banner.is-selected .re-banner-col:hover {
      outline: 1.5px solid rgba(50, 172, 193, .8) !important;
    }
    /* Column background driven by CSS vars set on the figure. */
    :host ::ng-deep .re__surface .re-banner .re-banner-col {
      background: var(--re-col-bg, transparent) !important;
      border: var(--re-col-border-w, 0px) solid var(--re-col-border, transparent) !important;
      border-radius: var(--re-col-radius, 0px) !important;
    }
    /* Section background image — render through ::before so the
       overlay rgba can layer on top without a second wrapper. */
    :host ::ng-deep .re__surface figure.re-embed-figure.re-banner {
      background-image: var(--re-banner-bg-image, none) !important;
      background-size: var(--re-banner-bg-size, cover) !important;
      background-position: var(--re-banner-bg-pos, center) !important;
      background-repeat: var(--re-banner-bg-repeat, no-repeat) !important;
      opacity: 1 !important;
    }
    :host ::ng-deep .re__surface figure.re-embed-figure.re-banner::before {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--re-banner-overlay, transparent);
      pointer-events: none;
      z-index: 0;
    }
    /* The actual <img>/<iframe>/<video> child gets the image-opacity
       so the section's chosen opacity is respected. */
    :host ::ng-deep .re__surface .re-banner > .re-embed-video,
    :host ::ng-deep .re__surface .re-banner > img {
      opacity: var(--re-banner-img-opacity, 1) !important;
    }

    /* "Borderless" mode used by the Wix-style post composer — the
       editor sheds its border, padding, and toolbar background so it
       blends into the canvas. Toggle by adding [class.re--bare] on
       the host element. Also turns the layout into a true flex
       column so the surface scrolls inside its allotted space
       instead of growing past the viewport with tall content. */
    .re--bare { border: 0; border-radius: 0; display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .re--bare .re__toolbar { background: #fff; flex-shrink: 0; }
    .re--bare .re__slot { flex-shrink: 0; }
    .re--bare .re__surfaceWrap { flex: 1 1 0; min-height: 0; }
    .re--bare .re__surface {
      flex: 1 1 0 !important;
      min-height: 0 !important;
      overflow-y: auto !important;
    }

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
    /* Default img treatment — keep it responsive without forcing
       a radius, so per-image radius set via the Design panel can
       actually win. The 8px default would override every inline
       border-radius the user picked. */
    :host ::ng-deep .re__surface img { max-width: 100% !important; margin: 8px 0 !important; }

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

    /* Video / iframe block + caption — Wix-style "Write a caption"
       affordance. The caption stays contenteditable inside the
       editor; the iframe wrapper is non-editable so users can't type
       on top of the video. Uses margin-block only — the inline
       margins stay untouched so align rules can set them to auto. */
    :host ::ng-deep .re__surface figure.re-embed-figure {
      margin-block: 14px !important;
      /* Default to centered horizontally — without an explicit
         margin-inline the figure hugs the left edge, contradicting
         the toolbar's "Align center" indicator. The align rules
         below override these per user choice. */
      margin-inline: auto !important;
      width: 100% !important;
      max-width: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 6px !important;
      box-sizing: border-box;
      transition: outline-color 120ms ease;
      cursor: pointer;
    }
    /* Hover hint — a darker outline so the container box is clearly
       visible before the user commits to selecting it. Mirrors the
       Wix UX where hovering a media block previews its bounds with
       a near-black ring. */
    :host ::ng-deep .re__surface figure.re-embed-figure:not(.is-selected):hover {
      outline: 1px solid rgba(15,23,42,.6) !important;
      outline-offset: 4px !important;
    }
    :host ::ng-deep .re__surface .re-embed-figure .re-embed-video { margin: 0 !important; }
    /* Block iframe / <video> interactions while the figure isn't
       selected so clicks go to the wrapper (which bubbles to the
       editor) instead of being swallowed by the embed. Once selected
       the user can click again to interact with the video controls. */
    :host ::ng-deep .re__surface .re-embed-figure:not(.is-selected) .re-embed-video iframe,
    :host ::ng-deep .re__surface .re-embed-figure:not(.is-selected) .re-embed-video video {
      pointer-events: none !important;
    }
    :host ::ng-deep .re__surface .re-embed-caption {
      display: block !important;
      text-align: center !important;
      padding: 6px 12px !important;
      font-size: 13px !important;
      color: #475569 !important;
      outline: none !important;
      min-height: 1.6em !important;
    }
    :host ::ng-deep .re__surface .re-embed-caption:empty::before {
      content: attr(data-placeholder) !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 4px 12px !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: 999px !important;
      background: #fff !important;
      color: #64748b !important;
      font-size: 12px !important;
      cursor: text !important;
      pointer-events: none;
    }
    :host ::ng-deep .re__surface .re-embed-caption:focus:empty::before { opacity: .55 !important; }

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
  /** "Bare" mode — drops the editor's border/background so it blends
   *  into a larger canvas (Wix-style composer). The toolbar still
   *  pins to the top; the surface fills the rest. */
  bare = input<boolean>(false);
  /** When true, an "Add plugin" floating button appears to the left
   *  of empty paragraphs while the caret is on that line. Click
   *  emits `addClick` — the composer wires this to opening the Add
   *  panel, matching the Wix Ricos UX. */
  addButton = input<boolean>(false);
  /** Lets the parent observe blur/commit events (on top of CVA onChange). */
  changed = output<string>();
  /** Fired when the floating "+" button (see `addButton` input) is
   *  clicked. The caller is expected to open whatever insert UI it
   *  owns — typically an Add panel listing image / video / divider
   *  / table / etc. */
  addClick = output<void>();
  /** Fired when the user clicks the "Replace" action on a selected
   *  embed block (video iframe / hosted video). The caller is
   *  responsible for opening its own picker / modal and calling
   *  back into `replaceSelectedFigure(html)` with the new HTML. */
  blockReplace = output<HTMLElement>();
  /** Fired when the user clicks the "+" image-fill placeholder in the
   *  Banner / Layout-section panel. The caller is expected to open
   *  its own media picker and call back into `setBannerBgImage(url)`. */
  bgImageClick = output<void>();

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

  onSelectionMaybeChanged(): void {
    this.refreshState();
    this.refreshAddBtn();
  }

  /** Position + visibility for the floating "+" button. Recomputed
   *  on every selection / input event when `addButton` is enabled. */
  addBtn = signal<{ show: boolean; top: number; left: number }>({ show: false, top: 0, left: 0 });

  private refreshAddBtn(): void {
    if (!this.addButton()) return;
    const editable = this.editable?.nativeElement;
    if (!editable) { this.hideAddBtn(); return; }

    // The button only shows when the caret is on an empty block —
    // mirroring Wix's "click + to add a plugin" UX. Anything else
    // hides it so the toolbar above and the typed text below stay
    // uncluttered. Coordinates are relative to the SURFACE element
    // (its parent in the DOM), so the button can never escape into
    // the toolbar above it.
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { this.hideAddBtn(); return; }
    if (!editable.contains(sel.anchorNode)) { this.hideAddBtn(); return; }

    const block = this.nearestBlock(sel.anchorNode, editable);
    const isEmpty = block ? (block.textContent ?? '').trim() === '' : false;
    if (!block || !isEmpty) { this.hideAddBtn(); return; }

    const surfaceRect = editable.getBoundingClientRect();
    const blockRect   = block.getBoundingClientRect();
    // Centre on the line, parked just inside the surface's left edge.
    const top  = blockRect.top  - surfaceRect.top + (blockRect.height - 26) / 2;
    const left = Math.max(2, blockRect.left - surfaceRect.left - 32);
    this.addBtn.set({ show: true, top, left });
  }

  private hideAddBtn(): void {
    if (this.addBtn().show) this.addBtn.set({ show: false, top: 0, left: 0 });
  }

  /** Click handler for the floating "+". Stops the default mousedown
   *  so the editor surface keeps its caret, then bubbles up to the
   *  parent via `addClick`. */
  onAddBtn(ev: MouseEvent): void {
    ev.preventDefault();
    this.addClick.emit();
  }

  // ─── Banner-column selection ───────────────────────────────────────────
  /** Currently-selected banner column within a banner figure, or
   *  null. Drives the secondary "Add column / Move / Delete" toolbar
   *  that floats above the column. */
  selectedColumn = signal<HTMLElement | null>(null);
  columnToolbar  = signal<{ show: boolean; top: number; left: number }>({ show: false, top: 0, left: 0 });
  columnMenu     = signal<'add' | null>(null);

  // ─── Embed-block selection ─────────────────────────────────────────────
  /** Currently-selected `figure.re-embed-figure`, or null when nothing
   *  is selected. Drives the floating selection toolbar. */
  selectedFigure = signal<HTMLElement | null>(null);
  figMenu        = signal<'size' | 'align' | 'link' | 'settings' | 'design' | 'valign' | null>(null);

  // ─── Link popover state ───
  linkUrl       = signal<string>('');
  linkNewTab    = signal<boolean>(true);
  linkNoFollow  = signal<boolean>(false);
  linkNoReferrer = signal<boolean>(true);

  // ─── Settings popover state ───
  imageAlt          = signal<string>('');
  imageDecorative   = signal<boolean>(false);
  imageClickExpand  = signal<boolean>(false);
  imageAllowDownload = signal<boolean>(false);

  // ─── Design popover state ───
  designBorderWidth   = signal<number>(0);
  designCornerRadius  = signal<number>(0);
  designBorderColor   = signal<string>('#000000');
  designBorderOpacity = signal<number>(100);

  // ─── Banner state ───
  bannerVAlign = signal<'top' | 'middle' | 'bottom'>('top');

  // ─── Banner Layout-section panel state ───
  bannerBgShow      = signal<boolean>(true);
  bannerBgKind      = signal<'color' | 'image'>('color');
  bannerBgColor     = signal<string>('#ffffff');
  bannerBgOpacity   = signal<number>(100);
  bannerBgImage     = signal<string>('');
  bannerColumns     = signal<1 | 2>(1);
  bannerColGap      = signal<number>(20);
  bannerColPadX     = signal<number>(0);
  bannerColPadY     = signal<number>(18);
  bannerVMargin     = signal<number>(50);
  bannerBreakpoint  = signal<number>(440);
  /** When true, the X / Y padding inputs move together (single value
   *  applied to both). Mirrors the link-button in Wix's spacing UI. */
  bannerPadLinked      = signal<boolean>(false);
  bannerResponsiveOpen = signal<boolean>(false);
  bannerBehavior       = signal<'stacked' | 'horizontal'>('stacked');

  // ─── Column background (applied to all .re-banner-col children) ───
  colBgKind        = signal<'color' | 'image'>('color');
  colFillColor     = signal<string>('#ffffff');
  colFillOpacity   = signal<number>(0);
  colBorderColor   = signal<string>('#000000');
  colBorderOpacity = signal<number>(0);
  colBorderWidth   = signal<number>(0);
  colCornerRadius  = signal<number>(0);

  // ─── Section background image extras ───
  sectionImageOpacity = signal<number>(100);
  sectionOverlayColor = signal<string>('#000000');
  sectionOverlayOpacity = signal<number>(0);
  sectionImageScaling = signal<'cover' | 'contain' | 'fill' | 'tile'>('cover');
  sectionImagePosition = signal<string>('5'); // 1-9, where 5 is center.

  // ─── Draggable Image panel (Settings + Design tabs) ───
  // Lives at the top-right of the surface initially; the user can
  // grab the title bar and drag it anywhere within the editor.
  // Closed state = null; opened with active tab = 'settings' | 'design'.
  figPanel    = signal<'settings' | 'design' | 'banner-design' | 'banner-layout' | null>(null);
  figPanelPos = signal<{ top: number; left: number } | null>(null);
  private dragOffset: { x: number; y: number } | null = null;

  openFigPanel(tab: 'settings' | 'design' | 'banner-design' | 'banner-layout'): void {
    // Banner figures use a completely different panel (Layout
    // section) so the toolbar's gear button routes there instead.
    if ((tab === 'settings' || tab === 'design') && this.isBannerFigure()) {
      tab = 'banner-design';
    }
    if (tab === 'settings')      this.seedSettingsState();
    else if (tab === 'design')   this.seedDesignState();
    else                          this.seedBannerState();
    this.figMenu.set(null);
    this.figPanel.set(tab);
    // Default position: top-right of the surface (~16px gutter).
    if (!this.figPanelPos()) {
      const surface = this.editable?.nativeElement;
      if (surface) {
        const rect = surface.getBoundingClientRect();
        this.figPanelPos.set({ top: 16, left: Math.max(16, rect.width - 320) });
      } else {
        this.figPanelPos.set({ top: 16, left: 16 });
      }
    }
  }

  closeFigPanel(): void {
    this.figPanel.set(null);
  }

  /** mousedown on the panel header — start dragging. */
  startPanelDrag(ev: MouseEvent): void {
    ev.preventDefault();
    const pos = this.figPanelPos();
    if (!pos) return;
    this.dragOffset = { x: ev.clientX - pos.left, y: ev.clientY - pos.top };
    document.addEventListener('mousemove', this.onPanelDrag);
    document.addEventListener('mouseup', this.onPanelDragEnd);
  }
  private onPanelDrag = (ev: MouseEvent): void => {
    if (!this.dragOffset) return;
    const surface = this.editable?.nativeElement;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    // Keep the panel inside the surface bounds, with a small inset
    // so the close button always remains reachable.
    const left = Math.max(0, Math.min(rect.width  - 280, ev.clientX - this.dragOffset.x));
    const top  = Math.max(0, Math.min(rect.height -  80, ev.clientY - this.dragOffset.y));
    this.figPanelPos.set({ top, left });
  };
  private onPanelDragEnd = (): void => {
    this.dragOffset = null;
    document.removeEventListener('mousemove', this.onPanelDrag);
    document.removeEventListener('mouseup', this.onPanelDragEnd);
  };
  figureToolbar  = signal<{ show: boolean; top: number; left: number }>({ show: false, top: 0, left: 0 });
  // Mirrored signal state so the toolbar's active dot updates without
  // re-querying the DOM on every change-detection pass.
  figureSize  = signal<'compact' | 'standard' | 'extended' | 'original'>('standard');
  figureAlign = signal<'left' | 'center' | 'right'>('center');
  figureWrap  = signal<boolean>(false);

  /** Double-click on an image figure opens the Design tab of the
   *  floating panel, jumping straight to the corner-radius / border
   *  controls — matches the Wix UX where dbl-click on media opens
   *  its "look & feel" editor. */
  onSurfaceDblClick(ev: MouseEvent): void {
    const target = ev.target as HTMLElement | null;
    const figure = target?.closest('figure.re-embed-figure') as HTMLElement | null;
    if (!figure) return;
    if (!figure.classList.contains('re-embed-figure--image')) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.selectFigure(figure);
    this.openFigPanel('design');
  }

  /** Surface click delegate — selects the clicked embed figure or
   *  clears the selection if the click landed elsewhere. Also blocks
   *  any link navigation that would otherwise fire when an image has
   *  been wrapped in <a> via the Link popover — inside the editor a
   *  click means "select", never "follow the link". */
  onSurfaceClick(ev: MouseEvent): void {
    const target = ev.target as HTMLElement | null;
    const figure = target?.closest('figure.re-embed-figure') as HTMLElement | null;
    const inAnchor = !!target?.closest('a[href]');
    if (figure && inAnchor) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    // Clicks on the editable <figcaption> inside a figure stay focused
    // on the caption (user is editing the caption text) — don't show
    // the toolbar in that case.
    const inCaption = !!target?.closest('.re-embed-caption');
    // Banner column click — select the column and show its toolbar.
    // Columns are nested inside the banner figure, so figure selection
    // is also kept so the figure toolbar stays visible above.
    const column = target?.closest('.re-banner-col') as HTMLElement | null;
    if (figure && column) {
      this.selectFigure(figure);
      this.selectColumn(column);
      return;
    }
    if (figure && !inCaption) {
      this.selectFigure(figure);
      this.clearColumnSelection();
    } else if (!target?.closest('.re__figTb') && !target?.closest('.re__colTb')) {
      this.clearFigureSelection();
      this.clearColumnSelection();
    }
  }

  private selectColumn(col: HTMLElement): void {
    const prev = this.selectedColumn();
    if (prev && prev !== col) prev.classList.remove('is-selected-col');
    this.selectedColumn.set(col);
    col.classList.add('is-selected-col');
    this.columnMenu.set(null);
    this.refreshColumnToolbar();
  }

  private clearColumnSelection(): void {
    const c = this.selectedColumn();
    if (c) c.classList.remove('is-selected-col');
    this.selectedColumn.set(null);
    this.columnMenu.set(null);
    this.columnToolbar.set({ show: false, top: 0, left: 0 });
  }

  private refreshColumnToolbar(): void {
    const col = this.selectedColumn();
    const editable = this.editable?.nativeElement;
    if (!col || !editable) { this.columnToolbar.set({ show: false, top: 0, left: 0 }); return; }
    const surfaceRect = editable.getBoundingClientRect();
    const r = col.getBoundingClientRect();
    // Park the toolbar a few px ABOVE the column, centred horizontally.
    const top  = Math.max(8, r.top - surfaceRect.top - 36);
    const left = r.left - surfaceRect.left + r.width / 2;
    this.columnToolbar.set({ show: true, top, left });
  }

  toggleColumnMenu(ev: Event, key: 'add'): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.columnMenu.set(this.columnMenu() === key ? null : key);
  }

  /** Insert a new column adjacent to the selected one. */
  addColumnBefore(): void { this.insertColumn('before'); }
  addColumnAfter():  void { this.insertColumn('after'); }
  private insertColumn(pos: 'before' | 'after'): void {
    const col = this.selectedColumn();
    const f   = this.selectedFigure();
    if (!col || !f) return;
    const next = document.createElement('div');
    next.className = 're-banner-col';
    next.innerHTML = '<p>Add your text</p>';
    if (pos === 'before') col.parentNode!.insertBefore(next, col);
    else                  col.parentNode!.insertBefore(next, col.nextSibling);
    // Auto-grow column-count to fit the new column.
    const total = f.querySelectorAll('.re-banner-col').length;
    if (total > this.bannerColumns()) this.setBannerColumns(Math.min(2, total) as 1 | 2);
    this.columnMenu.set(null);
    this.emit();
    queueMicrotask(() => this.refreshColumnToolbar());
  }

  moveColumnLeft():  void { this.swapColumn(-1); }
  moveColumnRight(): void { this.swapColumn(1); }
  private swapColumn(dir: -1 | 1): void {
    const col = this.selectedColumn(); if (!col) return;
    const sibling = dir === -1
      ? col.previousElementSibling as HTMLElement | null
      : col.nextElementSibling as HTMLElement | null;
    if (!sibling || !sibling.classList.contains('re-banner-col')) return;
    if (dir === -1) col.parentNode!.insertBefore(col, sibling);
    else            col.parentNode!.insertBefore(sibling, col);
    this.emit();
    queueMicrotask(() => this.refreshColumnToolbar());
  }

  deleteSelectedColumn(): void {
    const col = this.selectedColumn(); if (!col) return;
    const parent = col.parentNode;
    col.remove();
    this.clearColumnSelection();
    // If we just deleted the last column, drop a fresh empty one so
    // the banner overlay isn't completely blank.
    if (parent && parent instanceof HTMLElement && !parent.querySelector('.re-banner-col')) {
      const fresh = document.createElement('div');
      fresh.className = 're-banner-col';
      fresh.innerHTML = '<p>Add your text</p>';
      parent.appendChild(fresh);
    }
    this.emit();
  }

  private selectFigure(figure: HTMLElement): void {
    // Strip is-selected from any previously-selected figure so we
    // never end up with multiple outlines on screen at once.
    const prev = this.selectedFigure();
    if (prev && prev !== figure) {
      prev.classList.remove('is-selected');
      this.removeResizeHandles(prev);
    }
    this.selectedFigure.set(figure);
    figure.classList.add('is-selected');
    // Keep the writable mirrors of type / banner state in sync.
    this.isImageFigure.set(figure.classList.contains('re-embed-figure--image'));
    this.isBannerFigure.set(figure.classList.contains('re-banner'));
    this.attachResizeHandles(figure);
    // Read existing classes to pre-fill toolbar state.
    this.figureSize.set(
      figure.classList.contains('re-size-compact') ? 'compact'
        : figure.classList.contains('re-size-extended') ? 'extended'
        : figure.classList.contains('re-size-original') ? 'original'
        : 'standard',
    );
    this.figureAlign.set(
      figure.classList.contains('re-align-left')  ? 'left'
        : figure.classList.contains('re-align-right') ? 'right'
        : 'center',
    );
    this.figureWrap.set(figure.classList.contains('re-wrap-text'));
    this.figMenu.set(null);
    this.refreshFigureToolbar();
  }

  private clearFigureSelection(): void {
    const f = this.selectedFigure();
    if (f) { f.classList.remove('is-selected'); this.removeResizeHandles(f); }
    this.selectedFigure.set(null);
    this.isImageFigure.set(false);
    this.isBannerFigure.set(false);
    this.figMenu.set(null);
    this.figureToolbar.set({ show: false, top: 0, left: 0 });
    // Floating panels are tied to the selection — close them on
    // deselect so they don't linger on the canvas with no anchor.
    this.figPanel.set(null);
    // Column selection only makes sense inside the active figure.
    this.clearColumnSelection();
  }

  // ─── Resize handles ─────────────────────────────────────────────────────
  /** Drop 8 drag handles around the figure (4 corners + 4 edge
   *  midpoints) + a separate "radius" grip parked inside the
   *  top-left rounded corner for image figures. The handles are
   *  appended as `.re__resizer` children with a `data-dir` attribute;
   *  the radius grip is `.re__radiusGrip`. Saved HTML strips both —
   *  see emit(). */
  private attachResizeHandles(figure: HTMLElement): void {
    if (figure.querySelector('.re__resizer')) return;
    // Force `position: relative` so the absolutely-positioned handle
    // children anchor to the figure (not the editor surface above
    // it). `||=` could miss when a computed style sneaks in static.
    figure.style.position = 'relative';
    // Banner figures resize horizontally only — width controls how
    // far the banner stretches across the canvas. Vertical handles
    // would let the user squash the banner into nothing without a
    // useful outcome.
    const isBanner = figure.classList.contains('re-banner');
    const dirs: ResizeDir[] = isBanner ? ['e', 'w'] : ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
    for (const d of dirs) {
      const h = document.createElement('div');
      h.className = `re__resizer re__resizer--${d}`;
      h.setAttribute('contenteditable', 'false');
      h.setAttribute('data-dir', d);
      h.addEventListener('mousedown', (ev) => this.startResize(ev, d));
      figure.appendChild(h);
    }
    this.positionResizeHandles(figure);
    // Also reposition on image-load so newly-attached handles snap
    // to the right place once the image's natural dimensions arrive.
    const inner = this.resizeAnchor(figure);
    if (inner instanceof HTMLImageElement && !inner.complete) {
      inner.addEventListener('load', () => this.positionResizeHandles(figure), { once: true });
    }
    // Add a radius grip ONLY on image figures — videos/galleries
    // don't currently expose a single child element with a radius
    // we can drive.
    if (figure.classList.contains('re-embed-figure--image')) {
      const grip = document.createElement('div');
      grip.className = 're__radiusGrip';
      grip.setAttribute('contenteditable', 'false');
      grip.title = 'Drag to set corner radius';
      grip.addEventListener('mousedown', (ev) => this.startRadiusDrag(ev));
      figure.appendChild(grip);
      this.positionRadiusGrip(figure);
    }
  }

  private removeResizeHandles(figure: HTMLElement): void {
    figure.querySelectorAll('.re__resizer').forEach(n => n.remove());
    figure.querySelectorAll('.re__radiusGrip').forEach(n => n.remove());
  }

  /** The element the resize handles should hug — the inner media
   *  (img / iframe / video), NOT the figure (which also contains the
   *  caption). Falls back to the figure when no media is found. */
  private resizeAnchor(figure: HTMLElement): HTMLElement {
    return (figure.querySelector('img, iframe, video') as HTMLElement | null) ?? figure;
  }

  /** Recompute every handle's `top`/`left` so the 8-dot ring wraps
   *  the inner media tightly. Called after attaching, after every
   *  resize move, and when the figure toolbar refreshes. */
  private positionResizeHandles(figure: HTMLElement): void {
    const anchor = this.resizeAnchor(figure);
    const x = anchor.offsetLeft;
    const y = anchor.offsetTop;
    const w = anchor.offsetWidth;
    const h = anchor.offsetHeight;
    const place = (dir: ResizeDir, top: number, left: number) => {
      const el = figure.querySelector(`.re__resizer--${dir}`) as HTMLElement | null;
      if (!el) return;
      el.style.top  = `${top}px`;
      el.style.left = `${left}px`;
    };
    place('nw', y,         x);
    place('n',  y,         x + w / 2);
    place('ne', y,         x + w);
    place('e',  y + h / 2, x + w);
    place('se', y + h,     x + w);
    place('s',  y + h,     x + w / 2);
    place('sw', y + h,     x);
    place('w',  y + h / 2, x);
  }

  /** Place the radius grip at `(r, r)` from the top-left of the
   *  inner image — that's where the rounded curve "starts", so the
   *  grip visually sits on the curve itself. */
  private positionRadiusGrip(figure: HTMLElement): void {
    const grip = figure.querySelector('.re__radiusGrip') as HTMLElement | null;
    const img  = figure.querySelector('img') as HTMLElement | null;
    if (!grip || !img) return;
    const r = parseFloat(img.style.borderRadius || '0') || 0;
    // Position relative to the figure (which contains the img). Use
    // the image's offset within the figure so the grip lands on the
    // image edge regardless of figure padding.
    const left = img.offsetLeft + Math.max(8, r);
    const top  = img.offsetTop  + Math.max(8, r);
    grip.style.left = `${left}px`;
    grip.style.top  = `${top}px`;
  }

  /** Drag the radius grip diagonally — distance from the image's
   *  top-left corner becomes the new corner-radius value. */
  private startRadiusDrag(ev: MouseEvent): void {
    const figure = this.selectedFigure(); if (!figure) return;
    const img = figure.querySelector('img') as HTMLImageElement | null;
    if (!img) return;
    ev.preventDefault();
    ev.stopPropagation();
    const figureRect = figure.getBoundingClientRect();
    const cornerX = figureRect.left + img.offsetLeft;
    const cornerY = figureRect.top  + img.offsetTop;
    const max = Math.min(img.offsetWidth, img.offsetHeight) / 2;

    const onMove = (m: MouseEvent) => {
      const dx = Math.max(0, m.clientX - cornerX);
      const dy = Math.max(0, m.clientY - cornerY);
      const r  = Math.round(Math.max(0, Math.min(max, Math.min(dx, dy))));
      this.designCornerRadius.set(r);
      // Radius lives on the img only — keep the figure rectangular.
      img.style.borderRadius = `${r}px`;
      figure.style.removeProperty('border-radius');
      figure.classList.toggle('re-has-radius', r > 0);
      this.showRadiusChip(r);
      this.positionRadiusGrip(figure);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this.emit();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /** Mouse-down on a handle starts a drag. Bound listeners run on the
   *  document so the user can keep dragging past the figure's edges
   *  without losing the resize. */
  private startResize(ev: MouseEvent, dir: ResizeDir): void {
    const f = this.selectedFigure(); if (!f) return;
    ev.preventDefault();
    ev.stopPropagation();
    const startX = ev.clientX;
    const startY = ev.clientY;
    const rect   = f.getBoundingClientRect();
    const startW = rect.width;
    const startH = rect.height;
    const aspect = startW / Math.max(1, startH);
    // Corner drags maintain aspect ratio; edge drags free one axis.
    const isCorner = dir.length === 2;

    // Drop any preset size (Compact/Standard/Extended/Original) the
    // moment the user starts dragging — manual resize implies the
    // figure should follow the cursor, not snap back to a preset.
    f.classList.remove('re-size-compact', 're-size-standard', 're-size-extended', 're-size-original');

    // Lock the image to fill the figure with object-fit:cover. The
    // image's intrinsic `height: auto` would otherwise ignore any
    // vertical drag, leaving the figure box short while the image
    // kept its natural height (or vice-versa). With `cover` the
    // image always matches the figure's current size — vertical
    // edge drags actually trim / extend the visible area.
    const innerImg = f.querySelector('img') as HTMLImageElement | null;
    if (innerImg) {
      innerImg.style.width = '100%';
      innerImg.style.height = '100%';
      innerImg.style.objectFit = 'cover';
      innerImg.style.display = 'block';
    }

    const onMove = (m: MouseEvent) => {
      const dx = m.clientX - startX;
      const dy = m.clientY - startY;
      let w = startW;
      let h = startH;
      if (dir.includes('e')) w = startW + dx;
      if (dir.includes('w')) w = startW - dx;
      if (dir.includes('s')) h = startH + dy;
      if (dir.includes('n')) h = startH - dy;
      if (isCorner) {
        // Lock to original aspect — let width drive height.
        h = Math.max(40, w / aspect);
      }
      w = Math.max(60, w);
      h = Math.max(40, h);
      // The base CSS forces `width: 100% !important` on figures, so
      // a plain inline `style.width = ...` would lose to it. Use
      // setProperty with the !important priority so the drag wins.
      f.style.setProperty('width', `${Math.round(w)}px`, 'important');
      f.style.setProperty('max-width', 'none', 'important');
      if (isCorner) {
        f.style.removeProperty('height');
      } else if (dir === 'n' || dir === 's') {
        f.style.setProperty('height', `${Math.round(h)}px`, 'important');
      }
      this.positionResizeHandles(f);
      this.refreshFigureToolbar();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this.emit();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /** Recompute the toolbar's position relative to the surface. */
  private refreshFigureToolbar(): void {
    const figure = this.selectedFigure();
    const editable = this.editable?.nativeElement;
    if (!figure || !editable) { this.figureToolbar.set({ show: false, top: 0, left: 0 }); return; }
    const surfaceRect = editable.getBoundingClientRect();
    const fRect = figure.getBoundingClientRect();
    // Sit a few pixels below the figure, centred horizontally.
    const top  = fRect.bottom - surfaceRect.top + 8;
    const left = fRect.left   - surfaceRect.left + (fRect.width / 2);
    this.figureToolbar.set({ show: true, top, left });
  }

  /** True when the selected figure renders a single <img> (vs gallery
   *  / video). Writable signal for the same reason as isBannerFigure
   *  — classList mutations would otherwise be invisible to Angular. */
  isImageFigure = signal<boolean>(false);

  toggleFigMenu(ev: Event, key: 'size' | 'align' | 'link' | 'settings' | 'design' | 'valign'): void {
    ev.preventDefault();
    ev.stopPropagation();
    const next = this.figMenu() === key ? null : key;
    // Seed popover state from the selected figure when opening so the
    // controls show the figure's current values, not stale defaults.
    if (next === 'link')     this.seedLinkState();
    if (next === 'settings') this.seedSettingsState();
    if (next === 'design')   this.seedDesignState();
    this.figMenu.set(next);
  }

  private getFigureImg(): HTMLImageElement | null {
    return (this.selectedFigure()?.querySelector('img') as HTMLImageElement | null) ?? null;
  }

  private seedLinkState(): void {
    const f = this.selectedFigure(); if (!f) return;
    const a = f.querySelector('a[href]') as HTMLAnchorElement | null;
    if (a) {
      this.linkUrl.set(a.getAttribute('href') ?? '');
      this.linkNewTab.set(a.target === '_blank');
      const rel = (a.getAttribute('rel') ?? '').split(/\s+/);
      this.linkNoReferrer.set(rel.includes('noreferrer'));
      this.linkNoFollow.set(rel.includes('nofollow'));
    } else {
      this.linkUrl.set('');
      this.linkNewTab.set(true);
      this.linkNoReferrer.set(true);
      this.linkNoFollow.set(false);
    }
  }

  private seedSettingsState(): void {
    const img = this.getFigureImg();
    if (!img) return;
    this.imageAlt.set(img.getAttribute('alt') ?? '');
    this.imageDecorative.set(img.getAttribute('role') === 'presentation');
    const f = this.selectedFigure();
    this.imageClickExpand.set(f?.dataset['clickExpand'] === 'true');
    this.imageAllowDownload.set(f?.dataset['allowDownload'] === 'true');
  }

  private seedDesignState(): void {
    const img = this.getFigureImg();
    if (!img) return;
    const bw = parseInt(img.style.borderWidth || '0', 10);
    const cr = parseInt(img.style.borderRadius || '0', 10);
    this.designBorderWidth.set(Number.isFinite(bw) ? bw : 0);
    this.designCornerRadius.set(Number.isFinite(cr) ? cr : 0);
    // Read back the existing border color so the picker shows what's
    // currently applied instead of a stale default each open.
    const parsed = parseColor(img.style.borderColor);
    if (parsed) {
      this.designBorderColor.set(parsed.hex);
      this.designBorderOpacity.set(Math.round(parsed.alpha * 100));
    } else {
      this.designBorderColor.set('#000000');
      this.designBorderOpacity.set(100);
    }
  }

  /** Recompose `rgba(...)` border-color from the current colour + opacity
   *  and push it onto the img. Called whenever either input changes. */
  private applyBorderColor(): void {
    const img = this.getFigureImg(); if (!img) return;
    const w = this.designBorderWidth();
    if (w <= 0) return; // No visible border yet — colour will pick up when width > 0.
    const { r, g, b } = hexToRgb(this.designBorderColor());
    const a = Math.max(0, Math.min(1, this.designBorderOpacity() / 100));
    img.style.borderColor = `rgba(${r},${g},${b},${a})`;
    this.emit();
  }

  onDesignBorderColor(hex: string): void {
    this.designBorderColor.set(hex || '#000000');
    this.applyBorderColor();
  }
  onDesignBorderOpacity(v: number): void {
    const op = Math.max(0, Math.min(100, Number(v) || 0));
    this.designBorderOpacity.set(op);
    this.applyBorderColor();
  }

  /** Wrap (or unwrap) the figure's <img> in an <a href>. Empty URL
   *  removes any existing link. */
  applyLink(): void {
    const f = this.selectedFigure(); if (!f) return;
    const img = f.querySelector('img'); if (!img) return;
    const url = this.linkUrl().trim();
    const existing = img.closest('a[href]') as HTMLAnchorElement | null;

    if (!url) {
      // Unwrap any existing <a> wrapping the image.
      if (existing) {
        const parent = existing.parentNode!;
        parent.insertBefore(img, existing);
        parent.removeChild(existing);
      }
      this.figMenu.set(null);
      this.emit();
      return;
    }

    const rel = [
      this.linkNoReferrer() ? 'noreferrer' : '',
      this.linkNoFollow()   ? 'nofollow'   : '',
      this.linkNewTab()     ? 'noopener'   : '',
    ].filter(Boolean).join(' ');

    if (existing) {
      existing.setAttribute('href', url);
      if (this.linkNewTab()) existing.setAttribute('target', '_blank'); else existing.removeAttribute('target');
      if (rel) existing.setAttribute('rel', rel); else existing.removeAttribute('rel');
    } else {
      const a = document.createElement('a');
      a.setAttribute('href', url);
      if (this.linkNewTab()) a.setAttribute('target', '_blank');
      if (rel) a.setAttribute('rel', rel);
      img.parentNode!.insertBefore(a, img);
      a.appendChild(img);
    }
    this.figMenu.set(null);
    this.emit();
  }

  /** Live-update the image's border width as the user drags / types. */
  onDesignBorderWidth(v: number): void {
    const width = Math.max(0, Math.min(32, Number(v) || 0));
    this.designBorderWidth.set(width);
    const img = this.getFigureImg(); if (!img) return;
    img.style.borderWidth = `${width}px`;
    img.style.borderStyle = width > 0 ? 'solid' : '';
    img.style.borderColor = width > 0 ? '#0f172a' : '';
    this.emit();
  }

  /** Live-update the image's corner radius. Sets the value on BOTH
   *  the img AND the figure (with overflow:hidden via the
   *  re-has-radius class) so the rounding is actually visible —
   *  setting it on the img alone gets clobbered when the figure
   *  doesn't clip its overflow. The chip + grip update in sync. */
  private radiusChipTimer: any = null;
  onDesignCornerRadius(v: number): void {
    const radius = Math.max(0, Math.min(999, Number(v) || 0));
    this.designCornerRadius.set(radius);
    const f = this.selectedFigure();
    const img = this.getFigureImg();
    // Radius is an IMAGE property — the figure boundary stays
    // rectangular so the caption underneath sits cleanly below the
    // rounded image, not inside an oddly-curved container.
    if (img) img.style.borderRadius = `${radius}px`;
    if (f) {
      f.style.removeProperty('border-radius');
      f.classList.toggle('re-has-radius', radius > 0);
      this.positionRadiusGrip(f);
    }
    this.showRadiusChip(radius);
    this.emit();
  }

  private showRadiusChip(value: number): void {
    const f = this.selectedFigure(); if (!f) return;
    let chip = f.querySelector('.re__radiusChip') as HTMLElement | null;
    if (!chip) {
      chip = document.createElement('div');
      chip.className = 're__radiusChip';
      chip.setAttribute('contenteditable', 'false');
      f.appendChild(chip);
    }
    chip.textContent = `Radius ${value}`;
    chip.classList.add('is-visible');
    if (this.radiusChipTimer) clearTimeout(this.radiusChipTimer);
    this.radiusChipTimer = setTimeout(() => {
      const c = this.selectedFigure()?.querySelector('.re__radiusChip');
      if (c) c.remove();
    }, 900);
  }

  // ─── Banner mode ───
  /** True when the selected figure has the re-banner class. Held as
   *  a writable signal (not a computed off classList) because
   *  classList mutations don't trigger Angular's change detection —
   *  the computed would only re-run when selectedFigure() itself
   *  swaps. We update this manually in selectFigure / toggleBanner /
   *  clearFigureSelection so the toolbar variant flips instantly. */
  isBannerFigure = signal<boolean>(false);

  toggleBanner(): void {
    const f = this.selectedFigure(); if (!f || !this.isImageFigure()) return;
    if (f.classList.contains('re-banner')) {
      f.classList.remove('re-banner', 're-banner-vtop', 're-banner-vmid', 're-banner-vbot');
      f.querySelectorAll('.re-banner-overlay').forEach(o => o.remove());
      this.isBannerFigure.set(false);
    } else {
      f.classList.add('re-banner', 're-banner-vtop');
      this.bannerVAlign.set('top');
      if (!f.querySelector('.re-banner-overlay')) {
        const o = document.createElement('div');
        o.className = 're-banner-overlay';
        o.setAttribute('contenteditable', 'true');
        o.innerHTML = '<div class="re-banner-col"><p>Add your text</p></div>';
        f.appendChild(o);
      }
      this.isBannerFigure.set(true);
    }
    this.emit();
    // Banner toggle changes which handles apply — drop + re-attach
    // so the e/w-only set is in use when banner is on, full 8-set
    // when it's off.
    this.removeResizeHandles(f);
    this.attachResizeHandles(f);
    // If the floating panel was open, swap it to the matching kind
    // so it doesn't keep showing Image/Settings while the figure is
    // now a banner (or vice-versa). The user shouldn't have to
    // deselect + reselect to see the right panel.
    const open = this.figPanel();
    if (open) {
      const isBanner = f.classList.contains('re-banner');
      if (isBanner && (open === 'settings' || open === 'design')) {
        this.openFigPanel('banner-design');
      } else if (!isBanner && (open === 'banner-design' || open === 'banner-layout')) {
        this.openFigPanel('settings');
      }
    }
    queueMicrotask(() => this.refreshFigureToolbar());
  }

  setBannerVAlign(pos: 'top' | 'middle' | 'bottom'): void {
    const f = this.selectedFigure(); if (!f) return;
    f.classList.remove('re-banner-vtop', 're-banner-vmid', 're-banner-vbot');
    const cls = pos === 'middle' ? 're-banner-vmid' : pos === 'bottom' ? 're-banner-vbot' : 're-banner-vtop';
    f.classList.add(cls);
    this.bannerVAlign.set(pos);
    this.figMenu.set(null);
    this.emit();
  }

  addBannerColumn(): void {
    const f = this.selectedFigure(); if (!f) return;
    const overlay = f.querySelector('.re-banner-overlay') as HTMLElement | null;
    if (!overlay) return;
    const col = document.createElement('div');
    col.className = 're-banner-col';
    col.innerHTML = '<p>Add your text</p>';
    overlay.appendChild(col);
    // Auto-switch to 2-column layout so the new column actually
    // renders side-by-side instead of stacking under the first.
    if (this.bannerColumns() === 1) this.setBannerColumns(2);
    this.emit();
  }

  /** Read the figure's current banner-layout state into the signal
   *  mirror so the panel shows what's actually applied. */
  private seedBannerState(): void {
    const f = this.selectedFigure(); if (!f) return;
    const ds = f.dataset;
    const bgKind = (ds['bgKind'] as 'color' | 'image' | undefined) ?? 'color';
    this.bannerBgShow.set(ds['bgShow'] !== 'false');
    this.bannerBgKind.set(bgKind);
    this.bannerBgColor.set(ds['bgColor']   || '#ffffff');
    this.bannerBgOpacity.set(num(ds['bgOpacity'], 100));
    this.bannerBgImage.set(ds['bgImage']   || '');
    this.bannerColumns.set((num(ds['cols'], 1) === 2 ? 2 : 1));
    this.bannerColGap.set(num(ds['gap'], 20));
    this.bannerColPadX.set(num(ds['padX'], 0));
    this.bannerColPadY.set(num(ds['padY'], 18));
    this.bannerVMargin.set(num(ds['vMargin'], 50));
    this.bannerBreakpoint.set(num(ds['breakpoint'], 440));
    // Column background
    this.colBgKind.set((ds['colBgKind'] as 'color' | 'image' | undefined) ?? 'color');
    this.colFillColor.set(ds['colFillColor']     || '#ffffff');
    this.colFillOpacity.set(num(ds['colFillOpacity'], 0));
    this.colBorderColor.set(ds['colBorderColor'] || '#000000');
    this.colBorderOpacity.set(num(ds['colBorderOpacity'], 0));
    this.colBorderWidth.set(num(ds['colBorderWidth'], 0));
    this.colCornerRadius.set(num(ds['colCornerRadius'], 0));
    // Section image extras
    this.sectionImageOpacity.set(num(ds['imgOpacity'], 100));
    this.sectionOverlayColor.set(ds['overlayColor'] || '#000000');
    this.sectionOverlayOpacity.set(num(ds['overlayOpacity'], 0));
    const scaling = (ds['imgScaling'] as any) || 'cover';
    this.sectionImageScaling.set(['cover','contain','fill','tile'].includes(scaling) ? scaling : 'cover');
    this.sectionImagePosition.set(ds['imgPos'] || '5');
    this.applyBannerStyles();
  }

  /** Push the current banner-layout state to the figure as CSS vars
   *  + data-attrs. The figure renders against those vars (see
   *  .re-banner styles) and round-trips through saved HTML. */
  private applyBannerStyles(): void {
    const f = this.selectedFigure(); if (!f) return;

    // Background
    if (this.bannerBgShow()) {
      if (this.bannerBgKind() === 'color') {
        const { r, g, b } = hexToRgb(this.bannerBgColor());
        const a = Math.max(0, Math.min(1, this.bannerBgOpacity() / 100));
        f.style.setProperty('--re-banner-bg', `rgba(${r},${g},${b},${a})`);
        f.style.removeProperty('--re-banner-bg-image');
      } else {
        f.style.removeProperty('--re-banner-bg');
        f.style.setProperty('--re-banner-bg-image', this.bannerBgImage() ? `url(${this.bannerBgImage()})` : 'none');
      }
      f.dataset['bgShow'] = 'true';
    } else {
      f.style.removeProperty('--re-banner-bg');
      f.style.removeProperty('--re-banner-bg-image');
      f.dataset['bgShow'] = 'false';
    }
    f.dataset['bgKind']    = this.bannerBgKind();
    f.dataset['bgColor']   = this.bannerBgColor();
    f.dataset['bgOpacity'] = String(this.bannerBgOpacity());
    f.dataset['bgImage']   = this.bannerBgImage();

    // Columns
    f.style.setProperty('--re-banner-cols', String(this.bannerColumns()));
    f.dataset['cols'] = String(this.bannerColumns());

    // Spacing
    f.style.setProperty('--re-banner-gap',   `${this.bannerColGap()}px`);
    f.style.setProperty('--re-banner-pad-x', `${this.bannerColPadX()}px`);
    f.style.setProperty('--re-banner-pad-y', `${this.bannerColPadY()}px`);
    f.style.setProperty('--re-banner-margin', `${this.bannerVMargin()}px`);
    f.dataset['gap']     = String(this.bannerColGap());
    f.dataset['padX']    = String(this.bannerColPadX());
    f.dataset['padY']    = String(this.bannerColPadY());
    f.dataset['vMargin'] = String(this.bannerVMargin());
    f.dataset['breakpoint'] = String(this.bannerBreakpoint());

    // ─── Column background — applies to every .re-banner-col via vars
    if (this.colBgKind() === 'color') {
      const { r, g, b } = hexToRgb(this.colFillColor());
      const a = Math.max(0, Math.min(1, this.colFillOpacity() / 100));
      f.style.setProperty('--re-col-bg', `rgba(${r},${g},${b},${a})`);
    } else {
      f.style.setProperty('--re-col-bg', 'transparent');
    }
    {
      const { r, g, b } = hexToRgb(this.colBorderColor());
      const a = Math.max(0, Math.min(1, this.colBorderOpacity() / 100));
      f.style.setProperty('--re-col-border', `rgba(${r},${g},${b},${a})`);
    }
    f.style.setProperty('--re-col-border-w', `${this.colBorderWidth()}px`);
    f.style.setProperty('--re-col-radius',  `${this.colCornerRadius()}px`);
    f.dataset['colBgKind']       = this.colBgKind();
    f.dataset['colFillColor']    = this.colFillColor();
    f.dataset['colFillOpacity']  = String(this.colFillOpacity());
    f.dataset['colBorderColor']  = this.colBorderColor();
    f.dataset['colBorderOpacity']= String(this.colBorderOpacity());
    f.dataset['colBorderWidth']  = String(this.colBorderWidth());
    f.dataset['colCornerRadius'] = String(this.colCornerRadius());

    // ─── Section image extras
    f.style.setProperty('--re-banner-img-opacity', `${this.sectionImageOpacity() / 100}`);
    {
      const { r, g, b } = hexToRgb(this.sectionOverlayColor());
      const a = Math.max(0, Math.min(1, this.sectionOverlayOpacity() / 100));
      f.style.setProperty('--re-banner-overlay', `rgba(${r},${g},${b},${a})`);
    }
    const sizeMap: Record<string, string> = { cover: 'cover', contain: 'contain', fill: '100% 100%', tile: 'auto' };
    const repeatMap: Record<string, string> = { tile: 'repeat', cover: 'no-repeat', contain: 'no-repeat', fill: 'no-repeat' };
    f.style.setProperty('--re-banner-bg-size',   sizeMap[this.sectionImageScaling()]   ?? 'cover');
    f.style.setProperty('--re-banner-bg-repeat', repeatMap[this.sectionImageScaling()] ?? 'no-repeat');
    const posMap: Record<string, string> = {
      '1': 'left top',   '2': 'center top',   '3': 'right top',
      '4': 'left center','5': 'center center','6': 'right center',
      '7': 'left bottom','8': 'center bottom','9': 'right bottom',
    };
    f.style.setProperty('--re-banner-bg-pos', posMap[this.sectionImagePosition()] ?? 'center');
    f.dataset['imgOpacity']     = String(this.sectionImageOpacity());
    f.dataset['overlayColor']   = this.sectionOverlayColor();
    f.dataset['overlayOpacity'] = String(this.sectionOverlayOpacity());
    f.dataset['imgScaling']     = this.sectionImageScaling();
    f.dataset['imgPos']         = this.sectionImagePosition();
  }

  // Banner panel setters — each updates the mirror signal then
  // re-applies styles. Kept as one-liners so the template stays
  // readable and the side-effect is localised.
  setBannerBgShow(v: boolean): void { this.bannerBgShow.set(v); this.applyBannerStyles(); this.emit(); }
  setBannerBgKind(v: 'color' | 'image'): void { this.bannerBgKind.set(v); this.applyBannerStyles(); this.emit(); }
  setBannerBgColor(v: string): void { this.bannerBgColor.set(v); this.applyBannerStyles(); this.emit(); }
  setBannerBgOpacity(v: number): void { this.bannerBgOpacity.set(clamp(v, 0, 100)); this.applyBannerStyles(); this.emit(); }
  setBannerColumns(v: 1 | 2): void {
    this.bannerColumns.set(v);
    // Trim extra columns if shrinking.
    const f = this.selectedFigure();
    const cols = f?.querySelectorAll('.re-banner-col');
    if (cols && cols.length > v) for (let i = v; i < cols.length; i++) cols[i].remove();
    this.applyBannerStyles();
    this.emit();
  }
  setBannerGap(v: number): void { this.bannerColGap.set(clamp(v, 0, 200)); this.applyBannerStyles(); this.emit(); }
  setBannerPadX(v: number): void { this.bannerColPadX.set(clamp(v, 0, 200)); this.applyBannerStyles(); this.emit(); }
  setBannerPadY(v: number): void { this.bannerColPadY.set(clamp(v, 0, 200)); this.applyBannerStyles(); this.emit(); }
  setBannerVMargin(v: number): void { this.bannerVMargin.set(clamp(v, 0, 200)); this.applyBannerStyles(); this.emit(); }
  setBannerBreakpoint(v: number): void { this.bannerBreakpoint.set(clamp(v, 200, 1600)); this.applyBannerStyles(); this.emit(); }

  /** Toggle the link icon on Column padding — when enabled, X and
   *  Y move together (single value applied to both axes). */
  toggleBannerPadLinked(): void {
    const next = !this.bannerPadLinked();
    this.bannerPadLinked.set(next);
    // When linking, sync Y to current X so the two stay in step.
    if (next) this.setBannerPadY(this.bannerColPadX());
  }
  onPadX(v: number): void {
    this.setBannerPadX(v);
    if (this.bannerPadLinked()) this.setBannerPadY(v);
  }
  onPadY(v: number): void {
    this.setBannerPadY(v);
    if (this.bannerPadLinked()) this.setBannerPadX(v);
  }

  // ─── Column-background setters ───
  setColBgKind(v: 'color' | 'image'): void { this.colBgKind.set(v); this.applyBannerStyles(); this.emit(); }
  setColFillColor(v: string): void { this.colFillColor.set(v); this.applyBannerStyles(); this.emit(); }
  setColFillOpacity(v: number): void { this.colFillOpacity.set(clamp(v, 0, 100)); this.applyBannerStyles(); this.emit(); }
  setColBorderColor(v: string): void { this.colBorderColor.set(v); this.applyBannerStyles(); this.emit(); }
  setColBorderOpacity(v: number): void { this.colBorderOpacity.set(clamp(v, 0, 100)); this.applyBannerStyles(); this.emit(); }
  setColBorderWidth(v: number): void { this.colBorderWidth.set(clamp(v, 0, 32)); this.applyBannerStyles(); this.emit(); }
  setColCornerRadius(v: number): void { this.colCornerRadius.set(clamp(v, 0, 200)); this.applyBannerStyles(); this.emit(); }

  // ─── Section image-extras setters ───
  setSectionImageOpacity(v: number): void { this.sectionImageOpacity.set(clamp(v, 0, 100)); this.applyBannerStyles(); this.emit(); }
  setSectionOverlayColor(v: string): void { this.sectionOverlayColor.set(v); this.applyBannerStyles(); this.emit(); }
  setSectionOverlayOpacity(v: number): void { this.sectionOverlayOpacity.set(clamp(v, 0, 100)); this.applyBannerStyles(); this.emit(); }
  setSectionImageScaling(v: 'cover' | 'contain' | 'fill' | 'tile'): void { this.sectionImageScaling.set(v); this.applyBannerStyles(); this.emit(); }
  setSectionImagePosition(v: string): void { this.sectionImagePosition.set(v); this.applyBannerStyles(); this.emit(); }

  setBannerBehavior(v: 'stacked' | 'horizontal'): void {
    this.bannerBehavior.set(v);
    const f = this.selectedFigure();
    if (f) f.dataset['behavior'] = v;
    this.emit();
  }

  /** Public API used by the parent (post-composer) after picking a
   *  background image via the media library. */
  setBannerBgImage(url: string): void {
    this.bannerBgImage.set(url || '');
    this.bannerBgKind.set('image');
    this.applyBannerStyles();
    this.emit();
  }

  /** Triggered by the "+ image" tile in the Layout-section panel.
   *  Just bubbles up — the parent owns the media library modal. */
  pickBannerBgImage(): void {
    this.bgImageClick.emit();
  }

  applyImageSettings(): void {
    const f = this.selectedFigure(); if (!f) return;
    const img = this.getFigureImg(); if (!img) return;
    if (this.imageDecorative()) {
      img.setAttribute('alt', '');
      img.setAttribute('role', 'presentation');
    } else {
      img.setAttribute('alt', this.imageAlt());
      img.removeAttribute('role');
    }
    f.dataset['clickExpand']   = this.imageClickExpand()  ? 'true' : 'false';
    f.dataset['allowDownload'] = this.imageAllowDownload() ? 'true' : 'false';
    this.figMenu.set(null);
    this.emit();
  }

  setFigSize(size: 'compact' | 'standard' | 'extended' | 'original'): void {
    const f = this.selectedFigure(); if (!f) return;
    f.classList.remove('re-size-compact', 're-size-standard', 're-size-extended', 're-size-original');
    // Strip any inline dimensions left over from a previous manual
    // drag-resize. Without this, the !important inline width/height
    // would beat the preset CSS — Original size in particular would
    // be ignored because the inline px width still applied.
    f.style.removeProperty('width');
    f.style.removeProperty('max-width');
    f.style.removeProperty('height');
    f.classList.add(`re-size-${size}`);
    this.figureSize.set(size);
    this.figMenu.set(null);
    this.emit();
    queueMicrotask(() => {
      this.refreshFigureToolbar();
      this.positionResizeHandles(f);
    });
  }

  setFigAlign(align: 'left' | 'center' | 'right'): void {
    const f = this.selectedFigure(); if (!f) return;
    f.classList.remove('re-align-left', 're-align-center', 're-align-right');
    f.classList.add(`re-align-${align}`);
    this.figureAlign.set(align);
    this.figMenu.set(null);
    this.emit();
    queueMicrotask(() => this.refreshFigureToolbar());
  }

  toggleFigWrap(): void {
    const f = this.selectedFigure(); if (!f) return;
    const next = !this.figureWrap();
    f.classList.toggle('re-wrap-text', next);
    this.figureWrap.set(next);
    this.emit();
    queueMicrotask(() => this.refreshFigureToolbar());
  }

  onReplaceFigure(): void {
    const f = this.selectedFigure(); if (!f) return;
    this.blockReplace.emit(f);
  }

  /** Public API — parent calls this in response to `blockReplace` to
   *  swap the figure's media in place. The replacement HTML must
   *  produce a single block element (typically another <figure>). */
  replaceSelectedFigure(html: string): void {
    const f = this.selectedFigure(); if (!f) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const next = tpl.content.firstElementChild as HTMLElement | null;
    if (!next) return;
    f.replaceWith(next);
    // Re-select the new figure so the toolbar keeps tracking it.
    this.selectedFigure.set(null);
    this.selectFigure(next);
    this.emit();
  }

  deleteSelectedFigure(): void {
    const f = this.selectedFigure(); if (!f) return;
    f.remove();
    this.clearFigureSelection();
    this.emit();
  }

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
    // Seed an empty editor with a single empty paragraph so the caret
    // always lands inside a block when the user clicks in. Without
    // this, contenteditable on a blank div creates raw text nodes and
    // toolbar commands (formatBlock, lists, align) become no-ops on
    // first use.
    const next = html || '<p><br></p>';
    if (this.editable.nativeElement.innerHTML !== next) {
      this.editable.nativeElement.innerHTML = next;
    }
  }

  private emit(): void {
    // Strip transient selection-state classes AND resize handle nodes
    // from the saved HTML so they don't leak into the persisted post
    // content. Selection / handles are re-applied via DOM when a
    // figure is reselected.
    const raw = this.editable.nativeElement.innerHTML;
    const html = raw
      .replace(/\sis-selected(?=["\s])/g, '')
      .replace(/<div[^>]*class="re__resizer[^"]*"[^>]*><\/div>/g, '')
      .replace(/<div[^>]*class="re__radiusGrip[^"]*"[^>]*><\/div>/g, '')
      .replace(/<div[^>]*class="re__radiusChip[^"]*"[^>]*>[\s\S]*?<\/div>/g, '');
    this.onChange(html);
    this.changed.emit(html);
  }

  onInput(): void {
    this.normalizeBlockNesting();
    this.emit();
    this.refreshState();
    this.refreshAddBtn();
  }
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
  /** Close the figure toolbar dropdown when clicking outside the
   *  toolbar itself. Selection (the underlying figure) is cleared by
   *  onSurfaceClick when the click landed inside the surface. */
  @HostListener('document:mousedown', ['$event'])
  onDocMousedown(ev: MouseEvent): void {
    const target = ev.target as HTMLElement | null;
    if (this.figMenu() && !target?.closest('.re__figTb')) this.figMenu.set(null);
    if (this.columnMenu() && !target?.closest('.re__colTb')) this.columnMenu.set(null);
  }

  /** Keep the toolbar pinned to the selected figure when the user
   *  scrolls the editable surface. */
  @HostListener('document:scroll')
  onDocScroll(): void {
    if (this.selectedFigure()) this.refreshFigureToolbar();
    if (this.selectedColumn()) this.refreshColumnToolbar();
  }

  /** Document-level handler so the Delete / Backspace shortcut works
   *  whether the editable surface has focus or not. When a figure
   *  is selected the user often isn't typing — the focus is on the
   *  body / a panel button — but the key should still nuke the
   *  selected element. Skipped when the user is typing in an input
   *  / textarea / contenteditable so it doesn't eat normal text
   *  deletes. */
  @HostListener('document:keydown', ['$event'])
  onDocKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (!this.selectedFigure()) return;
    const target = e.target as HTMLElement | null;
    const inInput = !!target?.closest('input, textarea, [contenteditable="true"]');
    if (inInput) return;
    e.preventDefault();
    this.deleteSelectedFigure();
  }

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
  return `<figure class="re-embed-figure re-align-center">
    <div class="re-embed-video" contenteditable="false">
      <iframe src="${safeSrc}" title="${safeTitle}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe>
    </div>
    <figcaption class="re-embed-caption" data-placeholder="Write a caption"></figcaption>
  </figure>`;
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

/** Parse a dataset string into a number with fallback. dataset values
 *  arrive as strings; this trims, parses, and substitutes the default
 *  when the input is empty or not a finite number. */
function num(v: string | undefined, def: number): number {
  const n = parseFloat((v ?? '').trim());
  return Number.isFinite(n) ? n : def;
}

/** Clamp a numeric input to [min, max]. Treats non-finite as min so a
 *  caller can hand in `null` or junk without blowing up the slider. */
function clamp(v: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** Convert a #RRGGBB / #RGB hex string to its RGB components. Falls
 *  back to black on bad input so callers don't have to null-check. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = (hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Parse the limited subset of CSS colour strings we round-trip on
 *  the image's border (rgba / rgb / hex). Returns the hex form +
 *  alpha so the Design panel can show the same colour the next time
 *  the user opens it. Returns null when the input is unrecognised. */
function parseColor(input: string): { hex: string; alpha: number } | null {
  if (!input) return null;
  const s = input.trim();
  // rgba(...) / rgb(...)
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([0-9.]+))?\s*\)$/i.exec(s);
  if (m) {
    const r = +m[1], g = +m[2], b = +m[3];
    const a = m[4] != null ? Math.max(0, Math.min(1, +m[4])) : 1;
    const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
    return { hex, alpha: a };
  }
  // #RRGGBB / #RGB
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s)) {
    return { hex: s.length === 4 ? '#' + s.slice(1).split('').map(c => c + c).join('') : s.toLowerCase(), alpha: 1 };
  }
  return null;
}
