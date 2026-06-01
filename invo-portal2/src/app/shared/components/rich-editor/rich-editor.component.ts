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
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { RichTooltipDirective } from './rich-tooltip.directive';
import { RichNumSliderComponent } from './rich-num-slider.component';
import { ModalService } from '../../modal/modal.service';
import { BannerPresetPickerComponent, BannerPresetPickerData } from './banner-preset-picker.component';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ColorsPanelComponent } from '@shared/components/colors-panel/colors-panel.component';

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
  imports: [CommonModule, FormsModule, OverlayModule, RichTooltipDirective, RichNumSliderComponent, SearchDropdownComponent, ColorsPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichEditorComponent),
      multi: true,
    },
  ],
  template: `
    <div class="re-editor-host re"
         [class.re--disabled]="disabled()"
         [class.re--bare]="bare()"
         [class.re--fullscreen]="isFullscreen()">
      <!-- Fullscreen toggle — pinned to the top-right of the host
           regardless of mode (HTML / wysiwyg). Square 28x28 button
           with the Wix "expand corners" / "collapse corners" icon. -->
      <button type="button"
              class="re-fullscreen-toggle"
              (mousedown)="$event.preventDefault(); toggleFullscreen()"
              [appReTooltip]="isFullscreen() ? 'Exit fullscreen' : 'Fullscreen'"
              [attr.aria-pressed]="isFullscreen()"
              aria-label="Toggle fullscreen">
        @if (isFullscreen()) {
          <!-- Collapse corners (4 inward arrows) -->
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M9 3v4H5V5h2V3h2zm6 0h2v2h2v2h-4V3zM9 21H7v-2H5v-2h4v4zm6 0v-4h4v2h-2v2h-2z"/>
          </svg>
        } @else {
          <!-- Expand corners (4 outward arrows) -->
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M5 5h4V3H3v6h2V5zm14 0v4h2V3h-6v2h4zM5 19v-4H3v6h6v-2H5zm14 0h-4v2h6v-6h-2v4z"/>
          </svg>
        }
      </button>
      <!-- Ricos-style outer shell:
             .re-static-toolbar  — sticky, centred, full-width toolbar
             .re-editor-page     — scroll container
               .re-editor-column — max-width 940px, centred reading column
                 .re-editor-title   — optional textarea (showTitle())
                 .re-editor-content — wraps the contenteditable surface
           The existing .re__toolbar / .re__surfaceWrap markup stays
           inside these new wrappers so all positioning logic (floating
           panels, popovers) continues to anchor where it did. -->
      <div class="re-static-toolbar">
        <div class="re-toolbar-rail">
      <!-- Toolbar — most buttons are disabled in HTML-source mode.
           Wrapped in two regions: a scrollable rail of editing
           controls and a pinned end-cap with the HTML toggle so the
           toggle stays visible at any width. -->
      <div class="re__toolbar" role="toolbar" [attr.aria-disabled]="disabled()">
        <div class="re__rail">
        @if (mode() === 'wysiwyg') {
          <!-- ── 1. Content AI (opt-in via showContentAi()) ───────── -->
          @if (showContentAi()) {
            <button type="button" class="re__btn re__btn--ai"
                    (mousedown)="$event.preventDefault(); contentAiClick.emit()"
                    [appReTooltip]="'Content AI'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zm6 10l1 2.5 2.5 1-2.5 1L18 19l-1-2.5L14.5 15.5l2.5-1L18 12z"/>
              </svg>
            </button>
            <span class="re__sep"></span>
          }

          <!-- ── 2. Paragraph dropdown ────────────────────────────── -->
          <button #blockTrigger="cdkOverlayOrigin" cdkOverlayOrigin
                  type="button" class="re__btn re__btn--dd"
                  (mousedown)="toggleMenu($event, 'block')"
                  [attr.aria-expanded]="openMenu() === 'block'"
                  [appReTooltip]="'Paragraph style'">
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

          <span class="re__sep"></span>

          <!-- ── 3. Font size — number input + chevron-dropdown
                  The input commits on Enter / blur; the chevron opens
                  the preset-list overlay. -->
          <div #sizeTrigger="cdkOverlayOrigin" cdkOverlayOrigin
               class="re__sizeField" [appReTooltip]="'Font size'">
            <input type="number" inputmode="numeric" min="6" max="200"
                   class="re__sizeInput"
                   [value]="currentSize()"
                   (change)="commitSizeFromInput($event)"
                   (blur)="commitSizeFromInput($event)"
                   (keydown)="onSizeInputKeydown($event)"
                   aria-label="Font size">
            <button type="button" class="re__sizeChevron"
                    (mousedown)="toggleMenu($event, 'size')"
                    [attr.aria-expanded]="openMenu() === 'size'"
                    aria-label="Font size presets">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
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

          <!-- ── 4. Bold / Italic / Underline / Color / Highlight ── -->
          <button type="button" class="re__btn" [class.is-on]="state().bold"
                  (mousedown)="cmd($event, 'bold')" [appReTooltip]="'Bold (Ctrl+B)'">
            <span class="re__btn-label"><b>B</b></span>
          </button>
          <button type="button" class="re__btn" [class.is-on]="state().italic"
                  (mousedown)="cmd($event, 'italic')" [appReTooltip]="'Italic (Ctrl+I)'">
            <span class="re__btn-label"><i>I</i></span>
          </button>
          <button type="button" class="re__btn" [class.is-on]="state().underline"
                  (mousedown)="cmd($event, 'underline')" [appReTooltip]="'Underline (Ctrl+U)'">
            <span class="re__btn-label"><u>U</u></span>
          </button>

          <!-- Text colour -->
          <button #colorTrigger="cdkOverlayOrigin" cdkOverlayOrigin
                  type="button" class="re__btn re__btn--swatch"
                  (mousedown)="toggleMenu($event, 'color')"
                  [attr.aria-expanded]="openMenu() === 'color'"
                  [appReTooltip]="'Text colour'">
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
                  [appReTooltip]="'Highlight colour'">
            <span class="re__btn-label re__btn-label--color">
              <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
                <path d="M11.7 1.5l4.8 4.8-7.4 7.4H4.3l-2.8-2.8 1.4-1.4L9.7 3l2-1.5zm-1 2.4L3.5 11l1.4 1.4 7.2-7.1-1.4-1.4zM2 16h14v1.5H2V16z"/>
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

          <button type="button" class="re__btn" (mousedown)="linkPrompt($event)" [appReTooltip]="'Insert link'">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M7.5 5h-2A3.5 3.5 0 0 0 2 8.5 3.5 3.5 0 0 0 5.5 12h2v-1.5h-2a2 2 0 1 1 0-4h2V5zm3 0v1.5h2a2 2 0 1 1 0 4h-2V12h2A3.5 3.5 0 0 0 16 8.5 3.5 3.5 0 0 0 12.5 5h-2zM6 7.75h6v1.5H6v-1.5z"/>
            </svg>
          </button>
          <button type="button" class="re__btn" (mousedown)="pickBlock($event, 'BLOCKQUOTE')" [appReTooltip]="'Quote'">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M4 4H7L5.5 7.5H7V14H2V7.5L4 4ZM11 4H14L12.5 7.5H14V14H9V7.5L11 4Z"/>
            </svg>
          </button>
          <button type="button" class="re__btn" (mousedown)="toggleCode($event)" [appReTooltip]="'Inline code'">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M6 4.4L1.4 9 6 13.6 7.1 12.5 3.6 9l3.5-3.5L6 4.4zm6 0L10.9 5.5 14.4 9 10.9 12.5 12 13.6 16.6 9 12 4.4z"/>
            </svg>
          </button>

          <span class="re__sep"></span>

          <!-- Numbered first, then bulleted — matches Ricos's order. -->
          <button type="button" class="re__btn" [class.is-on]="state().ol"
                  (mousedown)="cmd($event, 'insertOrderedList')" [appReTooltip]="'Numbered list'">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M2 3h1v3H2V4H1V3h1zm0 5h2v1L3 10h1v1H1v-1l1-1H1V8zm0 5h2v1H2v1h2v1H1v-3zM7 3h10v2H7V3zm0 5h10v2H7V8zm0 5h10v2H7v-2z"/>
            </svg>
          </button>
          <button type="button" class="re__btn" [class.is-on]="state().ul"
                  (mousedown)="cmd($event, 'insertUnorderedList')" [appReTooltip]="'Bullet list'">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <circle cx="2.5" cy="4" r="1.3"/><circle cx="2.5" cy="9" r="1.3"/><circle cx="2.5" cy="14" r="1.3"/>
              <path d="M7 3h10v2H7V3zm0 5h10v2H7V8zm0 5h10v2H7v-2z"/>
            </svg>
          </button>

          <span class="re__sep"></span>

          <!-- Alignment dropdown -->
          <button #alignTrigger="cdkOverlayOrigin" cdkOverlayOrigin
                  type="button" class="re__btn re__btn--dd"
                  (mousedown)="toggleMenu($event, 'align')"
                  [attr.aria-expanded]="openMenu() === 'align'"
                  [appReTooltip]="'Alignment'">
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
                  [appReTooltip]="'Line height'">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M6 4h10v1.5H6V4zm0 4h10v1.5H6V8zm0 4h10v1.5H6V12zm0 4h10v1.5H6V16zM2 3l2 2.5h-1.25v7.5H4L2 15.5 0 13h1.25v-7.5H0L2 3z" transform="translate(0 -1)"/>
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

          <span class="re__sep"></span>

          <button type="button" class="re__btn" (mousedown)="cmd($event, 'outdent')" [appReTooltip]="'Decrease indent'">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M2 3h14v1.5H2V3zm5 4h9v1.5H7V7zm0 4h9v1.5H7V11zM2 15h14v1.5H2V15zm3.5-5.25L2 12 5.5 14.25v-4.5z"/>
            </svg>
          </button>
          <button type="button" class="re__btn" (mousedown)="cmd($event, 'indent')" [appReTooltip]="'Increase indent'">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M2 3h14v1.5H2V3zm0 4h9v1.5H2V7zm0 4h9v1.5H2V11zm0 4h14v1.5H2V15zm10.5-5.25L16 12l-3.5 2.25v-4.5z"/>
            </svg>
          </button>

          <span class="re__sep"></span>

          <!-- Info popover -->
          <button #infoTrigger="cdkOverlayOrigin" cdkOverlayOrigin
                  type="button" class="re__btn"
                  (mousedown)="toggleMenu($event, 'info')"
                  [attr.aria-expanded]="openMenu() === 'info'"
                  [appReTooltip]="'Keyboard shortcuts'">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M9 1.5A7.5 7.5 0 1 0 16.5 9 7.5 7.5 0 0 0 9 1.5zm0 13.5a6 6 0 1 1 6-6 6 6 0 0 1-6 6zm-.75-9.75h1.5V7h-1.5V5.25zm0 3h1.5v5h-1.5v-5z"/>
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

          <!-- ── Appended after Info (not in the Ricos spec order) ─
                 Clear formatting was kept as a trailing utility per
                 the consumer's request. -->
          <span class="re__sep"></span>
          <button type="button" class="re__btn" (mousedown)="clearFormat($event)" [appReTooltip]="'Clear formatting'">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <path d="M4 3h11v2H4V3zm2.5 2L4.4 16h2L8 5H6.5zm4 0L8.4 16h2L12 5h-1.5zM3 14.1L13.6 3.5l1 1L4 15.1l-1-1z"/>
            </svg>
          </button>
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

        </div><!-- /.re-toolbar-rail -->
      </div><!-- /.re-static-toolbar -->

      <div class="re-editor-page">
        <div class="re-editor-column">
          @if (showTitle()) {
            <div class="re-editor-title">
              <textarea
                class="re-editor-title__input"
                placeholder="Add a title…"
                [attr.rows]="titleRows()"
                [attr.maxlength]="titleMaxLength()"
                [attr.disabled]="disabled() ? 'disabled' : null"
                [value]="titleValue()"
                (input)="onTitleInput($event)"
                (focus)="onTitleFocus()"
                (blur)="onTitleBlur()"
                spellcheck="true"
                aria-label="Title"></textarea>
              @if (titleFocused()) {
                <div class="re-editor-title__counter"
                     [class.is-near-limit]="titleValue().length >= titleMaxLength() - 10">
                  {{ titleValue().length }}/{{ titleMaxLength() }}
                </div>
              }
            </div>
          }
          <div class="re-editor-content">
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
          <!-- Ricos floating add-plugin shell. Position math:
                 left = line-left + var(--ricos-custom-editor-add-plugin-button-position-inline-start)
               The component computes the line's left edge in pixels;
               the host CSS owns the constant offset (-36px default)
               so callers can re-theme by overriding the variable. -->
          <button type="button"
                  class="re__addBtn"
                  data-hook="floating-add-plugin-menu"
                  [style.top.px]="addBtn().top"
                  [style.left]="'calc(' + addBtn().lineLeft + 'px + var(--ricos-custom-editor-add-plugin-button-position-inline-start, -36px))'"
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
        (dragover)="onEditableDragOver($event)"
        (drop)="onEditableDrop($event)"
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
                @if (colBgKind() === 'color') {
                  <!-- Colour mode — swatch only; opacity lives in the picker. -->
                  <div class="re__figRow">
                    <label class="re__figTbLabel">Fill color</label>
                    <div class="re__figCtrl">
                      <button #colFillSwatch="cdkOverlayOrigin" cdkOverlayOrigin
                              type="button" class="re__figColorTrigger"
                              [style.--swatch-color]="composeRgba(colFillColor(), colFillOpacity())"
                              (click)="colorPanelTarget.set(colorPanelTarget() === 'colFill' ? null : 'colFill')"
                              aria-label="Edit fill colour"></button>
                      <ng-template
                        cdkConnectedOverlay
                        [cdkConnectedOverlayOrigin]="colFillSwatch"
                        [cdkConnectedOverlayOpen]="colorPanelTarget() === 'colFill'"
                        [cdkConnectedOverlayPositions]="overlayPositions"
                        [cdkConnectedOverlayHasBackdrop]="true"
                        cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                        (backdropClick)="colorPanelTarget.set(null)">
                        <app-colors-panel
                          [colorOnly]="true"
                          [alpha]="colFillOpacity()"
                          [ngModel]="colorPanelValue()"
                          (ngModelChange)="onColorPanelChange($event)"
                          (alphaChange)="setColFillOpacity($event)"
                          (closed)="colorPanelTarget.set(null)"/>
                      </ng-template>
                    </div>
                  </div>
                } @else {
                  <!-- Image mode — same picker tile pattern as the
                       Section background. When empty: drop tile;
                       when filled: preview + Replace/Remove buttons. -->
                  <div class="re__figBgImage">
                    @if (colBgImage()) {
                      <img [src]="colBgImage()" alt=""/>
                      <div class="re__figBgImageActions">
                        <button type="button" class="re__figTbBtnGhost" (click)="pickColBgImage()">Replace</button>
                        <button type="button" class="re__figTbBtnGhost" (click)="clearColBgImage()">Remove</button>
                      </div>
                    } @else {
                      <button type="button" class="re__figBgImageEmpty" (click)="pickColBgImage()">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-with="2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    }
                  </div>
                  @if (colBgImage()) {
                    <div class="re__figRow">
                      <label class="re__figTbLabel">Image opacity</label>
                      <div class="re__figCtrl">
                        <div class="re__figTbNum">
                          <input type="number" min="0" max="100" class="re__figTbInput re__figTbInput--num"
                                 [ngModel]="colImageOpacity()"
                                 (ngModelChange)="setColImageOpacity($event)"/>
                          <span class="re__figTbUnit">%</span>
                        </div>
                        <input type="range" min="0" max="100" class="re__figSlider"
                               [ngModel]="colImageOpacity()"
                               (ngModelChange)="setColImageOpacity($event)"/>
                      </div>
                    </div>
                    <div class="re__figRow">
                      <label class="re__figTbLabel" [appReTooltip]="'Background overlay'">Background overlay</label>
                      <div class="re__figCtrl">
                        <button #colOverlaySwatch="cdkOverlayOrigin" cdkOverlayOrigin
                                type="button" class="re__figColorTrigger"
                                [style.--swatch-color]="composeRgba(colOverlayColor(), colOverlayOpacity())"
                                (click)="colorPanelTarget.set(colorPanelTarget() === 'colOverlay' ? null : 'colOverlay')"
                                aria-label="Edit overlay colour"></button>
                        <ng-template
                          cdkConnectedOverlay
                          [cdkConnectedOverlayOrigin]="colOverlaySwatch"
                          [cdkConnectedOverlayOpen]="colorPanelTarget() === 'colOverlay'"
                          [cdkConnectedOverlayPositions]="overlayPositions"
                          [cdkConnectedOverlayHasBackdrop]="true"
                          cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                          (backdropClick)="colorPanelTarget.set(null)">
                          <app-colors-panel
                            [colorOnly]="true"
                            [alpha]="colOverlayOpacity()"
                            [ngModel]="colorPanelValue()"
                            (ngModelChange)="onColorPanelChange($event)"
                            (alphaChange)="setColOverlayOpacity($event)"
                            (closed)="colorPanelTarget.set(null)"/>
                        </ng-template>
                      </div>
                    </div>
                    <div class="re__figRow">
                      <label class="re__figTbLabel">Image scaling</label>
                      <div class="re__figCtrl">
                        <app-search-dropdown
                          class="re__figSelect"
                          [items]="imageScalingOptions"
                          [displayWith]="scalingDisplay"
                          [compareWith]="scalingCompare"
                          [toValue]="scalingToValue"
                          [clearable]="false"
                          [searchable]="false"
                          [ngModel]="colImageScaling()"
                          (ngModelChange)="setColImageScaling($any($event))"/>
                      </div>
                    </div>
                    <div class="re__figRow re__figRow--posrow">
                      <label class="re__figTbLabel">Image position</label>
                      <div class="re__figPosGrid">
                        @for (n of [1,2,3,4,5,6,7,8,9]; track n) {
                          <button type="button"
                                  class="re__figPosCell"
                                  [class.is-on]="colImagePosition() === ('' + n)"
                                  (click)="setColImagePosition('' + n)"
                                  [attr.aria-label]="'Position ' + n">
                            <span class="re__figPosDot"></span>
                          </button>
                        }
                      </div>
                    </div>
                  }
                }
                <div class="re__figRow">
                  <label class="re__figTbLabel">Border color</label>
                  <div class="re__figCtrl">
                    <button #colBorderSwatch="cdkOverlayOrigin" cdkOverlayOrigin
                            type="button" class="re__figColorTrigger"
                            [style.--swatch-color]="composeRgba(colBorderColor(), colBorderOpacity())"
                            (click)="colorPanelTarget.set(colorPanelTarget() === 'colBorder' ? null : 'colBorder')"
                            aria-label="Edit border colour"></button>
                    <ng-template
                      cdkConnectedOverlay
                      [cdkConnectedOverlayOrigin]="colBorderSwatch"
                      [cdkConnectedOverlayOpen]="colorPanelTarget() === 'colBorder'"
                      [cdkConnectedOverlayPositions]="overlayPositions"
                      [cdkConnectedOverlayHasBackdrop]="true"
                      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                      (backdropClick)="colorPanelTarget.set(null)">
                      <app-colors-panel
                        [colorOnly]="true"
                        [alpha]="colBorderOpacity()"
                        [ngModel]="colorPanelValue()"
                        (ngModelChange)="onColorPanelChange($event)"
                        (alphaChange)="setColBorderOpacity($event)"
                        (closed)="colorPanelTarget.set(null)"/>
                    </ng-template>
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

                <!-- Column layout — compact label-on-left, icon-toggles
                     on-right pattern. The active toggle is outlined in
                     the brand colour and shows a small checkmark badge
                     in the top-right corner. -->
                <div class="re__figRow">
                  <label class="re__figTbLabel">Column layout</label>
                  <div class="re__figCtrl re__figCtrl--toggles">
                    <button type="button" class="re__figIconToggle"
                            [class.is-on]="bannerColumns() === 1"
                            (click)="setBannerColumns(1)" title="One column">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>
                      @if (bannerColumns() === 1) {
                        <span class="re__figIconToggleCheck" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      }
                    </button>
                    <button type="button" class="re__figIconToggle"
                            [class.is-on]="bannerColumns() === 2"
                            (click)="setBannerColumns(2)" title="Two columns">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="8" height="16" rx="1"/><rect x="13" y="4" width="8" height="16" rx="1"/></svg>
                      @if (bannerColumns() === 2) {
                        <span class="re__figIconToggleCheck" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      }
                    </button>
                  </div>
                </div>

                <!-- Full height toggle — when on, the column stretches
                     to fill the banner's vertical extent instead of
                     auto-sizing to its content. -->
                <div class="re__figTbRow">
                  <span class="re__figLabelGroup">
                    Full height
                    <span class="re__figInfo" [appReTooltip]="'Stretch the column to fill the banner\\'s full height.'">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </span>
                  </span>
                  <span class="re__figTbToggle" [class.is-on]="colFullHeight()" (click)="setColFullHeight(!colFullHeight())"></span>
                </div>

                <!-- Section background -->
                <h5 class="re__figPanelSection">Section background</h5>
                <div class="re__figTbRow">
                  <span class="re__figLabelGroup">
                    Show background
                    <span class="re__figInfo" [appReTooltip]="'Turn off to remove the banner backdrop.'">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </span>
                  </span>
                  <span class="re__figTbToggle" [class.is-on]="bannerBgShow()" (click)="setBannerBgShow(!bannerBgShow())"></span>
                </div>
                @if (bannerBgShow()) {
                  <!-- Color vs Image segmented. "Color" covers both solid
                       colour and gradient (the ColorsPanel switches
                       between them internally); "Image" shows the image
                       picker. Only the controls for the active mode are
                       rendered below. -->
                  <div class="re__figSegment">
                    <button type="button" class="re__figSegBtn"
                            [class.is-on]="bannerBgKind() !== 'image'"
                            (click)="switchBgMode('color')">Color</button>
                    <button type="button" class="re__figSegBtn"
                            [class.is-on]="bannerBgKind() === 'image'"
                            (click)="switchBgMode('image')">Image</button>
                  </div>

                  @if (bannerBgKind() !== 'image') {
                    <!-- Fill color row — opacity % chip + swatch trigger.
                         Mirrors the column-fill pattern: number on the
                         left, swatch on the right. Clicking the swatch
                         opens the ColorsPanel (handles colour OR
                         gradient internally). -->
                    <div class="re__figRow">
                      <label class="re__figTbLabel">Fill color</label>
                      <div class="re__figCtrl">
                        <button #bgTriggerOrigin="cdkOverlayOrigin"
                                cdkOverlayOrigin
                                type="button"
                                class="re__figColorTrigger"
                                [style.background]="bgTriggerPreview()"
                                (click)="bgPanelOpen.set(!bgPanelOpen())"
                                aria-label="Edit background colour or gradient"></button>
                        <ng-template
                          cdkConnectedOverlay
                          [cdkConnectedOverlayOrigin]="bgTriggerOrigin"
                          [cdkConnectedOverlayOpen]="bgPanelOpen()"
                          [cdkConnectedOverlayPositions]="overlayPositions"
                          [cdkConnectedOverlayHasBackdrop]="true"
                          cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                          (backdropClick)="bgPanelOpen.set(false)">
                          <!-- Alpha is meaningful only in colour mode — a
                               single-axis opacity has no meaning against
                               a multi-stop gradient, so we hide the row
                               by passing null in gradient mode. -->
                          <app-colors-panel
                            [initialMode]="bgPanelMode()"
                            [alpha]="bgPanelMode() === 'gradient' ? null : bannerBgOpacity()"
                            [ngModel]="bgPanelValue()"
                            (ngModelChange)="onColorsPanelChange($event)"
                            (alphaChange)="setBannerBgOpacity($event)"
                            (modeChange)="onColorsPanelMode($event)"
                            (closed)="bgPanelOpen.set(false)"/>
                        </ng-template>
                      </div>
                    </div>
                  } @else {
                    <!-- Image picker: drop tile when empty, preview +
                         Replace / Remove buttons once an image is set. -->
                    <div class="re__figBgImage">
                      @if (bannerBgImage()) {
                        <img [src]="bannerBgImage()" alt=""/>
                        <div class="re__figBgImageActions">
                          <button type="button" class="re__figTbBtnGhost" (click)="pickBannerBgImage()">Replace</button>
                          <button type="button" class="re__figTbBtnGhost" (click)="clearBannerBgImage()">Remove</button>
                        </div>
                      } @else {
                        <button type="button" class="re__figBgImageEmpty" (click)="pickBannerBgImage()">
                          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                      }
                    </div>
                  }
                  @if (bannerBgKind() === 'image' && bannerBgImage()) {
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
                        <label class="re__figTbLabel" [appReTooltip]="'Background overlay'">Background overlay</label>
                        <div class="re__figCtrl">
                          <button #sectionOverlaySwatch="cdkOverlayOrigin" cdkOverlayOrigin
                                  type="button" class="re__figColorTrigger"
                                  [style.--swatch-color]="composeRgba(sectionOverlayColor(), sectionOverlayOpacity())"
                                  (click)="colorPanelTarget.set(colorPanelTarget() === 'sectionOverlay' ? null : 'sectionOverlay')"
                                  aria-label="Edit overlay colour"></button>
                          <ng-template
                            cdkConnectedOverlay
                            [cdkConnectedOverlayOrigin]="sectionOverlaySwatch"
                            [cdkConnectedOverlayOpen]="colorPanelTarget() === 'sectionOverlay'"
                            [cdkConnectedOverlayPositions]="overlayPositions"
                            [cdkConnectedOverlayHasBackdrop]="true"
                            cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                            (backdropClick)="colorPanelTarget.set(null)">
                            <app-colors-panel
                              [colorOnly]="true"
                              [alpha]="sectionOverlayOpacity()"
                              [ngModel]="colorPanelValue()"
                              (ngModelChange)="onColorPanelChange($event)"
                              (alphaChange)="setSectionOverlayOpacity($event)"
                              (closed)="colorPanelTarget.set(null)"/>
                          </ng-template>
                        </div>
                      </div>
                      <div class="re__figRow">
                        <label class="re__figTbLabel">Image scaling</label>
                        <div class="re__figCtrl">
                          <app-search-dropdown
                            class="re__figSelect"
                            [items]="imageScalingOptions"
                            [displayWith]="scalingDisplay"
                            [compareWith]="scalingCompare"
                            [toValue]="scalingToValue"
                            [clearable]="false"
                            [searchable]="false"
                            [ngModel]="sectionImageScaling()"
                            (ngModelChange)="setSectionImageScaling($any($event))"/>
                        </div>
                      </div>
                      <div class="re__figRow re__figRow--posrow">
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
              </div>
            } @else {
              <!-- Layout tab -->
              <div class="re__figPanelBody">
                <h5 class="re__figPanelSection">Spacing</h5>
                <!-- Column gap: two-vertical-columns leading icon. -->
                <div class="re__figRow">
                  <label class="re__figTbLabel re__figTbLabel--info">
                    Column gap
                    <span class="re__figInfo" [appReTooltip]="'Horizontal space between columns.'">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </span>
                  </label>
                  <div class="re__figCtrl">
                    <div class="re__figTbNum">
                      <svg class="re__figTbNumIcon" viewBox="0 0 18 18" width="18" height="18" fill="currentColor">
                        <path d="M8 3h2v1H8V3Zm0 12h2v-1H8v1Zm7-11v10c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h2c.55 0 1 .45 1 1Zm-1 0h-2v10h2V4ZM7 4v10c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h2c.55 0 1 .45 1 1ZM6 4H4v10h2V4Z"/>
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
                      <span class="re__figInfo" [appReTooltip]="'Padding inside each column. Click the link icon to keep X and Y in sync.'">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      </span>
                    </label>
                    <button type="button" class="re__figLinkBtn"
                            [class.is-on]="bannerPadLinked()"
                            (click)="toggleBannerPadLinked()"
                            [appReTooltip]="bannerPadLinked() ? 'Edit individually' : 'Link all edges'">
                      <svg viewBox="0 0 18 18" width="18" height="18" fill="currentColor">
                        <path d="M4 12V6H3v6h1Z"/>
                        <path d="M6 15h6v-1H6v1Z"/>
                        <path d="M15 12V6h-1v6h1Z"/>
                        <path d="M6 4h6V3H6v1Z"/>
                      </svg>
                    </button>
                  </div>
                  <!-- Toggle off (default): two chips — horizontal
                       padding (X = left/right) on the left, vertical
                       padding (Y = top/bottom) on the right.
                       Toggle on: four chips, one per edge.
                       The toggle button itself is bannerPadLinked(). -->
                  @if (!bannerPadLinked()) {
                    <div class="re__figPadPair re__figPadPair--quad">
                      <div class="re__figTbNum">
                        <svg class="re__figTbNumIcon" viewBox="0 0 18 18" width="18" height="18" fill="currentColor">
                          <path d="M8 3h2v1H8V3Zm0 12h2v-1H8v1Zm7-11v10c0 .55-.45 1-1 1h-2c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h2c.55 0 1 .45 1 1Zm-1 0h-2v10h2V4ZM7 4v10c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1V4c0-.55.45-1 1-1h2c.55 0 1 .45 1 1ZM6 4H4v10h2V4Z"/>
                        </svg>
                        <input type="number" min="0" max="200" class="re__figTbInput re__figTbInput--num"
                               [ngModel]="bannerColPadX()"
                               (ngModelChange)="onPadX($event)"
                               aria-label="Horizontal padding"/>
                        <span class="re__figTbUnit">px</span>
                      </div>
                      <div class="re__figTbNum">
                        <svg class="re__figTbNumIcon" viewBox="0 0 18 18" width="18" height="18" fill="currentColor">
                          <path d="M14 3H4c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1Zm0 3H4V4h10v2ZM4 10H3V8h1v2Zm10-2h1v2h-1V8Zm0 3H4c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-2c0-.55-.45-1-1-1Zm0 3H4v-2h10v2Z"/>
                        </svg>
                        <input type="number" min="0" max="200" class="re__figTbInput re__figTbInput--num"
                               [ngModel]="bannerColPadY()"
                               (ngModelChange)="onPadY($event)"
                               aria-label="Vertical padding"/>
                        <span class="re__figTbUnit">px</span>
                      </div>
                    </div>
                  } @else {
                    <div class="re__figPadPair re__figPadPair--quad">
                      <div class="re__figPadCell">
                        <div class="re__figTbNum">
                          <svg class="re__figTbNumIcon" viewBox="0 0 18 18" width="18" height="18" fill="currentColor"><path d="M14 3H4a1 1 0 00-1 1v2a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1zm0 1v2H4V4h10zM3 11h1V9H3v2zm7 4v-1H8v1h2zm5-4h-1V9h1v2zm-1 2h1v1a1 1 0 01-1 1h-1v-1h1v-1zM3 13h1v1h1v1H4a1 1 0 01-1-1v-1z"/></svg>
                          <input type="number" min="0" max="200" class="re__figTbInput re__figTbInput--num"
                                 [ngModel]="bannerColPadTop()"
                                 (ngModelChange)="setBannerPadTop($event)"
                                 aria-label="Top padding"/>
                          <span class="re__figTbUnit">px</span>
                        </div>
                        <input type="range" min="0" max="200" class="re__figSlider re__figSlider--pad"
                               [ngModel]="bannerColPadTop()"
                               (ngModelChange)="setBannerPadTop($event)"
                               aria-label="Top padding slider"/>
                      </div>
                      <div class="re__figPadCell">
                        <div class="re__figTbNum">
                          <svg class="re__figTbNumIcon" viewBox="0 0 18 18" width="18" height="18" fill="currentColor"><path d="M7 3v1h2V3H7zm-4 7h1V8H3v2zm4 5v-1h2v1H7zm-2-1v1H4a1 1 0 01-1-1v-1h1v1h1zM5 3v1H4v1H3V4a1 1 0 011-1h1zm6 1a1 1 0 011-1h2a1 1 0 011 1v10a1 1 0 01-1 1h-2a1 1 0 01-1-1V4zm1 0v10h2V4h-2z"/></svg>
                          <input type="number" min="0" max="200" class="re__figTbInput re__figTbInput--num"
                                 [ngModel]="bannerColPadRight()"
                                 (ngModelChange)="setBannerPadRight($event)"
                                 aria-label="Right padding"/>
                          <span class="re__figTbUnit">px</span>
                        </div>
                        <input type="range" min="0" max="200" class="re__figSlider re__figSlider--pad"
                               [ngModel]="bannerColPadRight()"
                               (ngModelChange)="setBannerPadRight($event)"
                               aria-label="Right padding slider"/>
                      </div>
                      <div class="re__figPadCell">
                        <div class="re__figTbNum">
                          <svg class="re__figTbNumIcon" viewBox="0 0 18 18" width="18" height="18" fill="currentColor"><path d="M8 3v1h2V3H8zm7 4h-1v2h1V7zM3 7h1v2H3V7zm1-2H3V4a1 1 0 011-1h1v1H4v1zm11 0h-1V4h-1V3h1a1 1 0 011 1v1zm-1 6a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2a1 1 0 011-1h10zm0 1H4v2h10v-2z"/></svg>
                          <input type="number" min="0" max="200" class="re__figTbInput re__figTbInput--num"
                                 [ngModel]="bannerColPadBottom()"
                                 (ngModelChange)="setBannerPadBottom($event)"
                                 aria-label="Bottom padding"/>
                          <span class="re__figTbUnit">px</span>
                        </div>
                        <input type="range" min="0" max="200" class="re__figSlider re__figSlider--pad"
                               [ngModel]="bannerColPadBottom()"
                               (ngModelChange)="setBannerPadBottom($event)"
                               aria-label="Bottom padding slider"/>
                      </div>
                      <div class="re__figPadCell">
                        <div class="re__figTbNum">
                          <svg class="re__figTbNumIcon" viewBox="0 0 18 18" width="18" height="18" fill="currentColor"><path d="M3 4a1 1 0 011-1h2a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 0v10h2V4H4zm7-1v1H9V3h2zm4 5h-1v2h1V8zm-4 7v-1H9v1h2zm2-11V3h1a1 1 0 011 1v1h-1V4h-1zm0 11v-1h1v-1h1v1a1 1 0 01-1 1h-1z"/></svg>
                          <input type="number" min="0" max="200" class="re__figTbInput re__figTbInput--num"
                                 [ngModel]="bannerColPadLeft()"
                                 (ngModelChange)="setBannerPadLeft($event)"
                                 aria-label="Left padding"/>
                          <span class="re__figTbUnit">px</span>
                        </div>
                        <input type="range" min="0" max="200" class="re__figSlider re__figSlider--pad"
                               [ngModel]="bannerColPadLeft()"
                               (ngModelChange)="setBannerPadLeft($event)"
                               aria-label="Left padding slider"/>
                      </div>
                    </div>
                  }
                </div>
                <!-- Vertical margins: horizontal-bars leading icon. -->
                <div class="re__figRow">
                  <label class="re__figTbLabel re__figTbLabel--info">
                    Vertical margins
                    <span class="re__figInfo" [appReTooltip]="'Space above and below the banner.'">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </span>
                  </label>
                  <div class="re__figCtrl">
                    <div class="re__figTbNum">
                      <svg class="re__figTbNumIcon" viewBox="0 0 18 18" width="18" height="18" fill="currentColor">
                        <path d="M14 3H4c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1Zm0 3H4V4h10v2ZM4 10H3V8h1v2Zm10-2h1v2h-1V8Zm0 3H4c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-2c0-.55-.45-1-1-1Zm0 3H4v-2h10v2Z"/>
                      </svg>
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
                  <p class="re__figPanelHint">Choose how your content behaves when the screen size changes.</p>
                  <div class="re__figRow">
                    <label class="re__figTbLabel re__figTbLabel--info">
                      Behavior
                      <span class="re__figInfo" [appReTooltip]="'How the banner reflows below the breakpoint.'">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      </span>
                    </label>
                    <div class="re__figCtrl re__figCtrl--toggles">
                      <button type="button" class="re__figIconToggle"
                              [class.is-on]="bannerBehavior() === 'stacked'"
                              (click)="setBannerBehavior('stacked')"
                              [appReTooltip]="'Stack'">
                        <svg viewBox="0 0 18 18" width="18" height="18" fill="currentColor">
                          <path d="M14 3H4c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1Zm0 4H4V4h10v3Zm0 3H4c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1Zm0 4H4v-3h10v3Z"/>
                        </svg>
                        @if (bannerBehavior() === 'stacked') {
                          <span class="re__figIconToggleCheck" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </span>
                        }
                      </button>
                      <button type="button" class="re__figIconToggle"
                              [class.is-on]="bannerBehavior() === 'horizontal'"
                              (click)="setBannerBehavior('horizontal')"
                              [appReTooltip]="'Wrap'">
                        <svg viewBox="0 0 18 18" width="18" height="18" fill="currentColor">
                          <path d="M2 13.008h5.004v1H2v-1Zm11.008-5.004H2v1h11.008c1.1 0 2.001.901 2.001 2.002 0 1.101-.9 2.002-2.001 2.002h-1.781l1.14-1.151c.19-.2.19-.51 0-.71-.2-.2-.51-.19-.71 0l-2.352 2.371 2.312 2.332c.1.1.23.15.35.15.12 0 .25-.05.35-.14.2-.19.2-.51 0-.71l-1.14-1.152h1.82A2.998 2.998 0 0 0 16 10.997a2.998 2.998 0 0 0-3.002-3.002l.01.01ZM15.009 3H2v1h13.01V3Z"/>
                        </svg>
                        @if (bannerBehavior() === 'horizontal') {
                          <span class="re__figIconToggleCheck" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </span>
                        }
                      </button>
                    </div>
                  </div>
                  <div class="re__figRow">
                    <label class="re__figTbLabel re__figTbLabel--info">
                      Breakpoint
                      <span class="re__figInfo" [appReTooltip]="'Set the screen width (in pixels) where your layout changes to fit smaller screens.'">
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
                      <input type="range" min="200" max="1600" step="20" class="re__figSlider"
                             [ngModel]="bannerBreakpoint()"
                             (ngModelChange)="setBannerBreakpoint($event)"
                             aria-label="Breakpoint slider"/>
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
                  <span class="re__figInfo" [appReTooltip]="'Decorative images won\\'t be announced by screen readers. Use for visual elements that don\\'t add information to the content of a page.'">
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
                  <span class="re__figInfo" [appReTooltip]="'When on, visitors can click the image to view a larger version in a lightbox.'">
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
                  <span class="re__figInfo" [appReTooltip]="'When on, visitors can right-click and save the image to their device.'">
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
              <!-- Border color — swatch only; opacity in the picker -->
              <div class="re__figRow">
                <label class="re__figTbLabel">Border color</label>
                <div class="re__figCtrl">
                  <button #designBorderSwatch="cdkOverlayOrigin" cdkOverlayOrigin
                          type="button" class="re__figColorTrigger"
                          [style.--swatch-color]="composeRgba(designBorderColor(), designBorderOpacity())"
                          (click)="colorPanelTarget.set(colorPanelTarget() === 'designBorder' ? null : 'designBorder')"
                          aria-label="Edit border colour"></button>
                  <ng-template
                    cdkConnectedOverlay
                    [cdkConnectedOverlayOrigin]="designBorderSwatch"
                    [cdkConnectedOverlayOpen]="colorPanelTarget() === 'designBorder'"
                    [cdkConnectedOverlayPositions]="overlayPositions"
                    [cdkConnectedOverlayHasBackdrop]="true"
                    cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                    (backdropClick)="colorPanelTarget.set(null)">
                    <app-colors-panel
                      [colorOnly]="true"
                      [alpha]="designBorderOpacity()"
                      [ngModel]="colorPanelValue()"
                      (ngModelChange)="onColorPanelChange($event)"
                      (alphaChange)="onDesignBorderOpacity($event)"
                      (closed)="colorPanelTarget.set(null)"/>
                  </ng-template>
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
      @if (selectedColumn() && columnToolbar().show && !cellElementToolbar().type) {
        <div class="re__colTb"
             [style.top.px]="columnToolbar().top + columnToolbarOffset().y"
             [style.left.px]="columnToolbar().left + columnToolbarOffset().x"
             (mousedown)="$event.stopPropagation()">
          <span class="re__tbDrag" (mousedown)="startToolbarDrag($event, 'column')" title="Drag toolbar">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="4" r="1"/><circle cx="11" cy="4" r="1"/>
              <circle cx="5" cy="8" r="1"/><circle cx="11" cy="8" r="1"/>
              <circle cx="5" cy="12" r="1"/><circle cx="11" cy="12" r="1"/>
            </svg>
          </span>
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
          <!-- Vertical alignment — top / middle / bottom for content
               inside the selected cell. -->
          <button type="button" class="re__figTbBtn" [class.is-on]="cellVAlign() === 'top'"
                  (click)="setCellVAlign('top')" title="Align top">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <rect x="3" y="3" width="18" height="2"/><rect x="6" y="8" width="12" height="3"/><rect x="6" y="14" width="12" height="3"/>
            </svg>
          </button>
          <button type="button" class="re__figTbBtn" [class.is-on]="cellVAlign() === 'middle'"
                  (click)="setCellVAlign('middle')" title="Align middle">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <rect x="3" y="11" width="18" height="2"/><rect x="6" y="5" width="12" height="3"/><rect x="6" y="16" width="12" height="3"/>
            </svg>
          </button>
          <button type="button" class="re__figTbBtn" [class.is-on]="cellVAlign() === 'bottom'"
                  (click)="setCellVAlign('bottom')" title="Align bottom">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <rect x="3" y="19" width="18" height="2"/><rect x="6" y="7" width="12" height="3"/><rect x="6" y="13" width="12" height="3"/>
            </svg>
          </button>
          <span class="re__figTbSep"></span>
          <!-- Horizontal alignment — left / center / right text-align
               inside the selected cell. -->
          <button type="button" class="re__figTbBtn" [class.is-on]="cellHAlign() === 'left'"
                  (click)="setCellHAlign('left')" title="Align left">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>
            </svg>
          </button>
          <button type="button" class="re__figTbBtn" [class.is-on]="cellHAlign() === 'center'"
                  (click)="setCellHAlign('center')" title="Align center">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
            </svg>
          </button>
          <button type="button" class="re__figTbBtn" [class.is-on]="cellHAlign() === 'right'"
                  (click)="setCellHAlign('right')" title="Align right">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span class="re__figTbSep"></span>
          <!-- Per-column Design overrides — opens a cdk-overlay popover
               with Fill / Border / Width / Radius controls that write
               inline styles directly on the selected cell (so this one
               column diverges from the banner-wide defaults). -->
          <button #colDesignOrigin="cdkOverlayOrigin" cdkOverlayOrigin
                  type="button" class="re__figTbBtn"
                  [class.is-on]="colDesignOpen()"
                  (click)="toggleColDesignPanel()"
                  title="Column design">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.21 16.9l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.31l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="colDesignOrigin"
            [cdkConnectedOverlayOpen]="colDesignOpen()"
            [cdkConnectedOverlayPositions]="overlayPositions"
            [cdkConnectedOverlayHasBackdrop]="true"
            cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
            (backdropClick)="colDesignOpen.set(false)">
            <div class="re__figPanel re__figPanel--col">
              <div class="re__figPanelHead">
                <h4 class="re__figPanelTitle">Column overrides</h4>
                <button type="button" class="re__figPanelClose" (click)="colDesignOpen.set(false)" aria-label="Close">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div class="re__figPanelBody">
                <div class="re__figRow">
                  <label class="re__figTbLabel">Fill color</label>
                  <div class="re__figCtrl">
                    <button #colOvFillSwatch="cdkOverlayOrigin" cdkOverlayOrigin
                            type="button" class="re__figColorTrigger"
                            [style.--swatch-color]="composeRgba(colOvFillColor(), colOvFillOpacity())"
                            (click)="colorPanelTarget.set(colorPanelTarget() === 'colOvFill' ? null : 'colOvFill')"
                            aria-label="Edit column fill colour"></button>
                    <ng-template
                      cdkConnectedOverlay
                      [cdkConnectedOverlayOrigin]="colOvFillSwatch"
                      [cdkConnectedOverlayOpen]="colorPanelTarget() === 'colOvFill'"
                      [cdkConnectedOverlayPositions]="overlayPositions"
                      [cdkConnectedOverlayHasBackdrop]="true"
                      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                      (backdropClick)="colorPanelTarget.set(null)">
                      <app-colors-panel
                        [colorOnly]="true"
                        [alpha]="colOvFillOpacity()"
                        [ngModel]="colorPanelValue()"
                        (ngModelChange)="onColorPanelChange($event)"
                        (alphaChange)="setColOvFillOpacity($event)"
                        (closed)="colorPanelTarget.set(null)"/>
                    </ng-template>
                  </div>
                </div>
                <div class="re__figRow">
                  <label class="re__figTbLabel">Border color</label>
                  <div class="re__figCtrl">
                    <button #colOvBorderSwatch="cdkOverlayOrigin" cdkOverlayOrigin
                            type="button" class="re__figColorTrigger"
                            [style.--swatch-color]="composeRgba(colOvBorderColor(), colOvBorderOpacity())"
                            (click)="colorPanelTarget.set(colorPanelTarget() === 'colOvBorder' ? null : 'colOvBorder')"
                            aria-label="Edit column border colour"></button>
                    <ng-template
                      cdkConnectedOverlay
                      [cdkConnectedOverlayOrigin]="colOvBorderSwatch"
                      [cdkConnectedOverlayOpen]="colorPanelTarget() === 'colOvBorder'"
                      [cdkConnectedOverlayPositions]="overlayPositions"
                      [cdkConnectedOverlayHasBackdrop]="true"
                      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                      (backdropClick)="colorPanelTarget.set(null)">
                      <app-colors-panel
                        [colorOnly]="true"
                        [alpha]="colOvBorderOpacity()"
                        [ngModel]="colorPanelValue()"
                        (ngModelChange)="onColorPanelChange($event)"
                        (alphaChange)="setColOvBorderOpacity($event)"
                        (closed)="colorPanelTarget.set(null)"/>
                    </ng-template>
                  </div>
                </div>
                <div class="re__figRow">
                  <label class="re__figTbLabel">Border width</label>
                  <div class="re__figCtrl">
                    <app-re-num-slider unit="px" label="Border width"
                                       [min]="0" [max]="32"
                                       [value]="colOvBorderWidth()"
                                       (valueChange)="setColOvBorderWidth($event)"/>
                  </div>
                </div>
                <div class="re__figRow">
                  <label class="re__figTbLabel">Corner radius</label>
                  <div class="re__figCtrl">
                    <app-re-num-slider unit="px" label="Corner radius"
                                       [min]="0" [max]="200"
                                       [value]="colOvCornerRadius()"
                                       (valueChange)="setColOvCornerRadius($event)"/>
                  </div>
                </div>
                <div class="re__figPanelActions">
                  <button type="button" class="re__figTbBtnGhost" (click)="resetColOverrides()">Reset to banner default</button>
                </div>
              </div>
            </div>
          </ng-template>
          <span class="re__figTbSep"></span>
          <button type="button" class="re__figTbBtn re__figTbBtn--danger" (click)="deleteSelectedColumn()" title="Delete column">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
          <!-- WP-style overflow menu — column-level operations. -->
          <div class="re__figTbDd">
            <button type="button" class="re__figTbBtn" (click)="toggleColumnMenu($event, 'more')" title="More options">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="5"  r="1.6"/>
                <circle cx="12" cy="12" r="1.6"/>
                <circle cx="12" cy="19" r="1.6"/>
              </svg>
            </button>
            @if (columnMenu() === 'more') {
              <div class="re__figTbMenu re__figTbMenu--more">
                <button type="button" class="re__figTbItem" (click)="columnCmd('cut')">Cut <span class="re__figTbKbd">Ctrl+X</span></button>
                <button type="button" class="re__figTbItem" (click)="columnCmd('copy')">Copy <span class="re__figTbKbd">Ctrl+C</span></button>
                <button type="button" class="re__figTbItem" (click)="columnCmd('duplicate')">Duplicate <span class="re__figTbKbd">Ctrl+Shift+D</span></button>
                <div class="re__figTbDivider"></div>
                <button type="button" class="re__figTbItem" (click)="columnCmd('addBefore')">Add column before</button>
                <button type="button" class="re__figTbItem" (click)="columnCmd('addAfter')">Add column after</button>
                <button type="button" class="re__figTbItem" (click)="columnCmd('clear')">Clear column content</button>
                <div class="re__figTbDivider"></div>
                <button type="button" class="re__figTbItem is-danger" (click)="columnCmd('delete')">Delete column <span class="re__figTbKbd">Del</span></button>
              </div>
            }
          </div>
        </div>
      }

      <!-- Per-element contextual toolbar — pops above a clicked
           button/image inside a banner cell. Different action set
           per type. Shown additively alongside the banner toolbar. -->
      @if (cellElementToolbar().type) {
        <div class="re__cellElemTb"
             [style.top.px]="cellElementToolbar().top + cellElementToolbarOffset().y"
             [style.left.px]="cellElementToolbar().left + cellElementToolbarOffset().x"
             (mousedown)="$event.stopPropagation()">
          <span class="re__tbDrag" (mousedown)="startToolbarDrag($event, 'cellElement')" title="Drag toolbar">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="4" r="1"/><circle cx="11" cy="4" r="1"/>
              <circle cx="5" cy="8" r="1"/><circle cx="11" cy="8" r="1"/>
              <circle cx="5" cy="12" r="1"/><circle cx="11" cy="12" r="1"/>
            </svg>
          </span>
          <span class="re__cellElemTbLabel">{{ cellElementToolbar().type === 'button' ? 'Button' : cellElementToolbar().type === 'image' ? 'Image' : 'Text' }}</span>
          <span class="re__figTbSep"></span>
          @if (cellElementToolbar().type === 'button') {
            <div class="re__btnAlignDd">
              <button type="button" class="re__figTbBtn" [class.is-on]="btnAlignOpen()"
                      (mousedown)="$event.preventDefault(); toggleBtnAlign()"
                      [appReTooltip]="'Alignment'">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <line x1="6" y1="12" x2="18" y2="12"/>
                  <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              @if (btnAlignOpen()) {
                <div class="re__btnAlignMenu">
                  <button type="button" [class.is-on]="btnAlign() === 'left'"   (mousedown)="$event.preventDefault(); setBtnAlign('left')">Align left</button>
                  <button type="button" [class.is-on]="btnAlign() === 'center'" (mousedown)="$event.preventDefault(); setBtnAlign('center')">Align center</button>
                  <button type="button" [class.is-on]="btnAlign() === 'right'"  (mousedown)="$event.preventDefault(); setBtnAlign('right')">Align right</button>
                  <div class="re__btnAlignMenuDivider"></div>
                  <div class="re__btnAlignMenuToggleRow">
                    <span>Wrap text</span>
                    <span class="re__figTbToggle" [class.is-on]="btnWrap()" (mousedown)="$event.preventDefault(); setBtnWrap(!btnWrap())"></span>
                  </div>
                </div>
              }
            </div>
            <button type="button" class="re__figTbBtn" (mousedown)="$event.preventDefault(); editCellButtonLink()" [appReTooltip]="'Edit link'">
              <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
                <path d="M7.5 5h-2A3.5 3.5 0 0 0 2 8.5 3.5 3.5 0 0 0 5.5 12h2v-1.5h-2a2 2 0 1 1 0-4h2V5zm3 0v1.5h2a2 2 0 1 1 0 4h-2V12h2A3.5 3.5 0 0 0 16 8.5 3.5 3.5 0 0 0 12.5 5h-2zM6 7.75h6v1.5H6v-1.5z"/>
              </svg>
            </button>
            <button type="button" class="re__figTbBtn" [class.is-on]="buttonSettingsOpen()"
                    (mousedown)="$event.preventDefault(); buttonSettingsOpen() ? closeButtonSettings() : openButtonSettings()"
                    [appReTooltip]="'Button settings'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          }
          @if (cellElementToolbar().type === 'image') {
            <button type="button" class="re__figTbBtn" (mousedown)="$event.preventDefault(); replaceCellImage()" [appReTooltip]="'Replace image'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          }
          @if (cellElementToolbar().type === 'text') {
            <button type="button" class="re__figTbBtn" (mousedown)="$event.preventDefault(); clearCellTextFormatting()" [appReTooltip]="'Clear formatting'">
              <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
                <path d="M4 3h11v2H4V3zm2.5 2L4.4 16h2L8 5H6.5zm4 0L8.4 16h2L12 5h-1.5zM3 14.1L13.6 3.5l1 1L4 15.1l-1-1z"/>
              </svg>
            </button>
          }
          <button type="button" class="re__figTbBtn re__figTbBtn--danger" (mousedown)="$event.preventDefault(); deleteCellElement()" [appReTooltip]="'Delete'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
          <!-- WP-style overflow menu — per-element operations. -->
          <div class="re__figTbDd">
            <button type="button" class="re__figTbBtn"
                    (mousedown)="$event.preventDefault(); cellElementMoreOpen.set(!cellElementMoreOpen())"
                    [appReTooltip]="'More options'">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="5"  r="1.6"/>
                <circle cx="12" cy="12" r="1.6"/>
                <circle cx="12" cy="19" r="1.6"/>
              </svg>
            </button>
            @if (cellElementMoreOpen()) {
              <div class="re__figTbMenu re__figTbMenu--more">
                <button type="button" class="re__figTbItem" (mousedown)="$event.preventDefault(); cellElementCmd('cut')">Cut <span class="re__figTbKbd">Ctrl+X</span></button>
                <button type="button" class="re__figTbItem" (mousedown)="$event.preventDefault(); cellElementCmd('copy')">Copy <span class="re__figTbKbd">Ctrl+C</span></button>
                <button type="button" class="re__figTbItem" (mousedown)="$event.preventDefault(); cellElementCmd('duplicate')">Duplicate <span class="re__figTbKbd">Ctrl+Shift+D</span></button>
                <div class="re__figTbDivider"></div>
                <button type="button" class="re__figTbItem is-danger" (mousedown)="$event.preventDefault(); cellElementCmd('delete')">Delete <span class="re__figTbKbd">Del</span></button>
              </div>
            }
          </div>
        </div>
        <!-- Link panel — pops out of the cell-element toolbar's
             link icon when a button is picked. Mirrors the Wix Link
             modal: Link-to dropdown, URL input, four rel/target
             toggles, Cancel/Save footer. Header doubles as a drag
             handle, like the Button settings panel. -->
        @if (buttonLinkOpen() && cellElementToolbar().type === 'button') {
          <div class="re__figPanel re__figPanel--btn re__figPanel--link"
               [style.top.px]="cellElementToolbar().top + cellElementToolbarOffset().y + 40 + btnLinkOffset().y"
               [style.left.px]="cellElementToolbar().left + cellElementToolbarOffset().x + btnLinkOffset().x"
               (mousedown)="$event.stopPropagation()">
            <header class="re__figPanelHead" (mousedown)="startToolbarDrag($event, 'btnLink')">
              <h4>Link</h4>
              <button type="button" class="re__figPanelClose" (click)="cancelCellButtonLink()" (mousedown)="$event.stopPropagation()" aria-label="Close">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </header>
            <div class="re__figPanelBody">
              <div class="re__figRow re__figRow--stack">
                <label class="re__figTbLabel">Link to</label>
                <app-search-dropdown
                  class="re__figSelect"
                  [items]="linkKindOptions"
                  [displayWith]="linkKindDisplay"
                  [compareWith]="linkKindCompare"
                  [toValue]="linkKindToValue"
                  [clearable]="false"
                  [searchable]="false"
                  [ngModel]="linkKind()"
                  (ngModelChange)="pickLinkKind($any($event))"/>
              </div>
              @if (linkKind() === 'web') {
                <div class="re__figRow re__figRow--stack">
                  <label class="re__figTbLabel">URL</label>
                  <input type="text" class="re__figTbInput re__figLinkUrl"
                         placeholder="Enter or paste a link"
                         [value]="linkUrl()" (input)="linkUrl.set($any($event.target).value)"/>
                </div>
              } @else if (linkKind() === 'section') {
                <div class="re__figRow re__figRow--stack">
                  <label class="re__figTbLabel">Select a section to link to</label>
                  @if (linkSections().length === 0) {
                    <div class="re__figLinkEmpty">No sections in this post yet — add a heading first.</div>
                  } @else {
                    <div class="re__figLinkSectionList">
                      @for (s of linkSections(); track s.id) {
                        <button type="button" [class.is-on]="linkUrl() === '#' + s.id" (click)="linkUrl.set('#' + s.id)">
                          <span class="re__figLinkSectionTag">{{ s.tag }}</span>
                          <span class="re__figLinkSectionLabel">{{ s.label }}</span>
                        </button>
                      }
                    </div>
                  }
                </div>
              } @else {
                <div class="re__figRow re__figRow--stack">
                  <label class="re__figTbLabel">{{ linkKind() === 'page' ? 'Page' : linkKind() === 'blog' ? 'Post' : 'Dynamic page' }}</label>
                  <div class="re__figLinkEmpty">{{ linkKind() === 'page' ? 'No pages available — wire the host to populate.' : linkKind() === 'blog' ? 'No posts available — wire the host to populate.' : 'No dynamic items available — wire the host to populate.' }}</div>
                </div>
              }
              <div class="re__figTbRow">
                <span class="re__figLabelGroup">Open link in a new tab</span>
                <span class="re__figTbToggle" [class.is-on]="linkNewTab()" (mousedown)="$event.preventDefault(); linkNewTab.set(!linkNewTab())"></span>
              </div>
              <div class="re__figTbRow">
                <span class="re__figLabelGroup">
                  Noreferrer
                  <span class="re__figInfo" [appReTooltip]="'The destination site will not receive the referring URL.'">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  </span>
                </span>
                <span class="re__figTbToggle" [class.is-on]="linkNoReferrer()" (mousedown)="$event.preventDefault(); linkNoReferrer.set(!linkNoReferrer())"></span>
              </div>
              <div class="re__figTbRow">
                <span class="re__figLabelGroup">
                  Nofollow
                  <span class="re__figInfo" [appReTooltip]="'Tells search engines not to follow this link for ranking.'">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  </span>
                </span>
                <span class="re__figTbToggle" [class.is-on]="linkNoFollow()" (mousedown)="$event.preventDefault(); linkNoFollow.set(!linkNoFollow())"></span>
              </div>
              <div class="re__figTbRow">
                <span class="re__figLabelGroup">
                  Sponsored
                  <span class="re__figInfo" [appReTooltip]="'Marks the link as paid/sponsored content.'">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  </span>
                </span>
                <span class="re__figTbToggle" [class.is-on]="linkSponsored()" (mousedown)="$event.preventDefault(); linkSponsored.set(!linkSponsored())"></span>
              </div>
            </div>
            <footer class="re__figPanelFoot">
              <button type="button" class="re__figFootBtn"
                      (mousedown)="$event.preventDefault(); $event.stopPropagation()"
                      (click)="cancelCellButtonLink()">Cancel</button>
              <button type="button" class="re__figFootBtn re__figFootBtn--primary"
                      (mousedown)="$event.preventDefault(); $event.stopPropagation()"
                      (click)="saveCellButtonLink()">Save</button>
            </footer>
          </div>
        }
        @if (buttonSettingsOpen() && cellElementToolbar().type === 'button') {
          <!-- Button settings popover — uses the same .re__figPanel*
               chrome as the Layout section panel so the two share
               typography / spacing / tabs / chip styling. Width is
               capped a bit smaller than the Layout panel because the
               button panel has fewer fields. -->
          <div class="re__figPanel re__figPanel--btn"
               [style.top.px]="cellElementToolbar().top + cellElementToolbarOffset().y + 40 + btnPanelOffset().y"
               [style.left.px]="cellElementToolbar().left + cellElementToolbarOffset().x + btnPanelOffset().x"
               (mousedown)="$event.stopPropagation()">
            <header class="re__figPanelHead" (mousedown)="startToolbarDrag($event, 'btnPanel')">
              <h4>Button</h4>
              <button type="button" class="re__figPanelClose" (click)="closeButtonSettings()" (mousedown)="$event.stopPropagation()" aria-label="Close">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </header>
            <nav class="re__figPanelTabs">
              <button type="button" class="re__figPanelTab" [class.is-on]="btnPanelTab() === 'settings'" (click)="btnPanelTab.set('settings')">Settings</button>
              <button type="button" class="re__figPanelTab" [class.is-on]="btnPanelTab() === 'design'"   (click)="btnPanelTab.set('design')">Design</button>
            </nav>
            <div class="re__figPanelBody">
              @if (btnPanelTab() === 'settings') {
                <div class="re__figRow">
                  <label class="re__figTbLabel">Button text</label>
                  <div class="re__figCtrl">
                    <input type="text" class="re__figTbInput" [value]="btnText()" (input)="setBtnText($any($event.target).value)"/>
                  </div>
                </div>
              } @else {
                <div class="re__figRow">
                  <label class="re__figTbLabel">Button size</label>
                  <div class="re__figCtrl re__figCtrl--toggles">
                    <button type="button" class="re__figIconToggle" [class.is-on]="btnSize() === 'small'"  (click)="setBtnSize('small')" title="Small">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="10" width="10" height="4" rx="1"/></svg>
                      @if (btnSize() === 'small') {<span class="re__figIconToggleCheck"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>}
                    </button>
                    <button type="button" class="re__figIconToggle" [class.is-on]="btnSize() === 'medium'" (click)="setBtnSize('medium')" title="Medium">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="9" width="14" height="6" rx="1"/></svg>
                      @if (btnSize() === 'medium') {<span class="re__figIconToggleCheck"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>}
                    </button>
                    <button type="button" class="re__figIconToggle" [class.is-on]="btnSize() === 'large'"  (click)="setBtnSize('large')" title="Large">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="8" rx="1"/></svg>
                      @if (btnSize() === 'large') {<span class="re__figIconToggleCheck"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>}
                    </button>
                  </div>
                </div>
                <div class="re__figRow">
                  <label class="re__figTbLabel">Fill color</label>
                  <div class="re__figCtrl">
                    <button #btnFillSwatch="cdkOverlayOrigin" cdkOverlayOrigin
                            type="button" class="re__figColorTrigger"
                            [style.--swatch-color]="composeRgba(btnFillColor(), btnFillOpacity())"
                            (click)="colorPanelTarget.set(colorPanelTarget() === 'btnFill' ? null : 'btnFill')"
                            aria-label="Edit fill colour"></button>
                    <ng-template cdkConnectedOverlay
                                 [cdkConnectedOverlayOrigin]="btnFillSwatch"
                                 [cdkConnectedOverlayOpen]="colorPanelTarget() === 'btnFill'"
                                 [cdkConnectedOverlayPositions]="overlayPositions"
                                 [cdkConnectedOverlayHasBackdrop]="true"
                                 cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                                 (backdropClick)="colorPanelTarget.set(null)">
                      <app-colors-panel
                        [colorOnly]="true"
                        [alpha]="btnFillOpacity()"
                        [ngModel]="colorPanelValue()"
                        (ngModelChange)="onColorPanelChange($event)"
                        (alphaChange)="setBtnFillOpacity($event)"
                        (closed)="colorPanelTarget.set(null)"/>
                    </ng-template>
                  </div>
                </div>
                <div class="re__figRow">
                  <label class="re__figTbLabel">Text color</label>
                  <div class="re__figCtrl">
                    <button #btnTextSwatch="cdkOverlayOrigin" cdkOverlayOrigin
                            type="button" class="re__figColorTrigger"
                            [style.--swatch-color]="composeRgba(btnTextColor(), btnTextOpacity())"
                            (click)="colorPanelTarget.set(colorPanelTarget() === 'btnText' ? null : 'btnText')"
                            aria-label="Edit text colour"></button>
                    <ng-template cdkConnectedOverlay
                                 [cdkConnectedOverlayOrigin]="btnTextSwatch"
                                 [cdkConnectedOverlayOpen]="colorPanelTarget() === 'btnText'"
                                 [cdkConnectedOverlayPositions]="overlayPositions"
                                 [cdkConnectedOverlayHasBackdrop]="true"
                                 cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                                 (backdropClick)="colorPanelTarget.set(null)">
                      <app-colors-panel
                        [colorOnly]="true"
                        [alpha]="btnTextOpacity()"
                        [ngModel]="colorPanelValue()"
                        (ngModelChange)="onColorPanelChange($event)"
                        (alphaChange)="setBtnTextOpacity($event)"
                        (closed)="colorPanelTarget.set(null)"/>
                    </ng-template>
                  </div>
                </div>
                <div class="re__figRow">
                  <label class="re__figTbLabel">Border color</label>
                  <div class="re__figCtrl">
                    <button #btnBorderSwatch="cdkOverlayOrigin" cdkOverlayOrigin
                            type="button" class="re__figColorTrigger"
                            [style.--swatch-color]="composeRgba(btnBorderColor(), btnBorderOpacity())"
                            (click)="colorPanelTarget.set(colorPanelTarget() === 'btnBorder' ? null : 'btnBorder')"
                            aria-label="Edit border colour"></button>
                    <ng-template cdkConnectedOverlay
                                 [cdkConnectedOverlayOrigin]="btnBorderSwatch"
                                 [cdkConnectedOverlayOpen]="colorPanelTarget() === 'btnBorder'"
                                 [cdkConnectedOverlayPositions]="overlayPositions"
                                 [cdkConnectedOverlayHasBackdrop]="true"
                                 cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
                                 (backdropClick)="colorPanelTarget.set(null)">
                      <app-colors-panel
                        [colorOnly]="true"
                        [alpha]="btnBorderOpacity()"
                        [ngModel]="colorPanelValue()"
                        (ngModelChange)="onColorPanelChange($event)"
                        (alphaChange)="setBtnBorderOpacity($event)"
                        (closed)="colorPanelTarget.set(null)"/>
                    </ng-template>
                  </div>
                </div>
                <div class="re__figRow">
                  <label class="re__figTbLabel">Border width</label>
                  <div class="re__figCtrl">
                    <app-re-num-slider unit="px" label="Border width"
                                       [min]="0" [max]="32"
                                       [value]="btnBorderWidth()"
                                       (valueChange)="setBtnBorderWidth($event)"/>
                  </div>
                </div>
                <div class="re__figRow">
                  <label class="re__figTbLabel">Corner radius</label>
                  <div class="re__figCtrl">
                    <app-re-num-slider unit="px" label="Corner radius"
                                       [min]="0" [max]="200"
                                       [value]="btnCornerRadius()"
                                       (valueChange)="setBtnCornerRadius($event)"/>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }

      <!-- Floating selection toolbar for embed blocks (video iframe,
           hosted video). Position tracks the selected figure's
           bounding rect. Click-outside deselects. -->
      @if (selectedFigure() && figureToolbar().show && !cellElementToolbar().type) {
        @if (isBannerFigure()) {
          <!-- ─── Banner toolbar ─────────────────────────────────────────
               Distinct from image: Settings + Banner are labelled (the
               two primary actions); VAlign, Add column, Replace, Delete
               are icon-only with tooltips. -->
          <div class="re__figTb re__figTb--banner"
               [style.top.px]="figureToolbar().top + figureToolbarOffset().y"
               [style.left.px]="figureToolbar().left + figureToolbarOffset().x"
               (mousedown)="$event.stopPropagation()">
            <span class="re__tbDrag" (mousedown)="startToolbarDrag($event, 'figure')" title="Drag toolbar">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="4" r="1"/><circle cx="11" cy="4" r="1"/>
                <circle cx="5" cy="8" r="1"/><circle cx="11" cy="8" r="1"/>
                <circle cx="5" cy="12" r="1"/><circle cx="11" cy="12" r="1"/>
              </svg>
            </span>
            <button type="button"
                    class="re__figTbBtn re__figTbBtn--labelled"
                    [class.is-on]="figPanel() === 'settings' || figPanel() === 'banner-design' || figPanel() === 'banner-layout'"
                    (click)="openFigPanel('settings')"
                    [appReTooltip]="'Open section settings'">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span>Settings</span>
            </button>
            <span class="re__figTbSep"></span>
            <button type="button"
                    class="re__figTbBtn re__figTbBtn--labelled is-on"
                    (click)="toggleBanner()"
                    [appReTooltip]="'Convert back to an inline image'">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="1"/>
                <line x1="2" y1="11" x2="22" y2="11"/>
              </svg>
              <span>Banner</span>
            </button>
            <div class="re__figTbDd">
              <button type="button" class="re__figTbBtn"
                      (click)="toggleFigMenu($event, 'valign')"
                      [appReTooltip]="'Vertical alignment'">
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
            <button type="button" class="re__figTbBtn"
                    (click)="addBannerColumn()"
                    [appReTooltip]="'Add a column'">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <button type="button" class="re__figTbBtn re__figTbBtn--danger"
                    (click)="deleteSelectedFigure()"
                    [appReTooltip]="'Delete banner'">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
            <!-- WP-style overflow menu — block-level operations that
                 don't need their own first-class toolbar button. -->
            <div class="re__figTbDd">
              <button type="button" class="re__figTbBtn"
                      (click)="toggleFigMenu($event, 'more')"
                      [appReTooltip]="'More options'">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="5"  r="1.6"/>
                  <circle cx="12" cy="12" r="1.6"/>
                  <circle cx="12" cy="19" r="1.6"/>
                </svg>
              </button>
              @if (figMenu() === 'more') {
                <div class="re__figTbMenu re__figTbMenu--more">
                  <button type="button" class="re__figTbItem" (click)="figureCmd('cut')">Cut <span class="re__figTbKbd">Ctrl+X</span></button>
                  <button type="button" class="re__figTbItem" (click)="figureCmd('copy')">Copy <span class="re__figTbKbd">Ctrl+C</span></button>
                  <button type="button" class="re__figTbItem" (click)="figureCmd('duplicate')">Duplicate <span class="re__figTbKbd">Ctrl+Shift+D</span></button>
                  <div class="re__figTbDivider"></div>
                  <button type="button" class="re__figTbItem" (click)="figureCmd('before')">Add empty paragraph before</button>
                  <button type="button" class="re__figTbItem" (click)="figureCmd('after')">Add empty paragraph after</button>
                  <div class="re__figTbDivider"></div>
                  <button type="button" class="re__figTbItem is-danger" (click)="figureCmd('delete')">Delete <span class="re__figTbKbd">Del</span></button>
                </div>
              }
            </div>
          </div>
        } @else {
          <!-- ─── Image / embed toolbar ──────────────────────────────────
               Used for inline images, embeds, hosted video. Size + Align
               appear for sized figures; Banner toggle + Settings + Design
               + Link + Replace + Delete are the standard set. -->
          <div class="re__figTb re__figTb--image"
               [style.top.px]="figureToolbar().top + figureToolbarOffset().y"
               [style.left.px]="figureToolbar().left + figureToolbarOffset().x"
               (mousedown)="$event.stopPropagation()">
            <span class="re__tbDrag" (mousedown)="startToolbarDrag($event, 'figure')" title="Drag toolbar">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="4" r="1"/><circle cx="11" cy="4" r="1"/>
                <circle cx="5" cy="8" r="1"/><circle cx="11" cy="8" r="1"/>
                <circle cx="5" cy="12" r="1"/><circle cx="11" cy="12" r="1"/>
              </svg>
            </span>
            <div class="re__figTbDd">
              <button type="button" class="re__figTbBtn"
                      (click)="toggleFigMenu($event, 'size')"
                      [appReTooltip]="'Change image size'">
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
            <div class="re__figTbDd">
              <button type="button" class="re__figTbBtn"
                      (click)="toggleFigMenu($event, 'align')"
                      [appReTooltip]="'Alignment'">
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
            @if (isImageFigure()) {
              <button type="button"
                      class="re__figTbBtn re__figTbBtn--labelled"
                      [class.is-on]="figPanel() === 'settings'"
                      (click)="openFigPanel('settings')"
                      [appReTooltip]="'Image settings'">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82V9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                <span>Settings</span>
              </button>
              <button type="button" class="re__figTbBtn"
                      [class.is-on]="figPanel() === 'design'"
                      (click)="openFigPanel('design')"
                      [appReTooltip]="'Design (colour, border, corners)'">
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
          <button type="button" class="re__figTbBtn re__figTbBtn--danger"
                  (click)="deleteSelectedFigure()"
                  [appReTooltip]="'Delete'">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
          <!-- WP-style overflow menu — block-level operations. -->
          <div class="re__figTbDd">
            <button type="button" class="re__figTbBtn"
                    (click)="toggleFigMenu($event, 'more')"
                    [appReTooltip]="'More options'">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="5"  r="1.6"/>
                <circle cx="12" cy="12" r="1.6"/>
                <circle cx="12" cy="19" r="1.6"/>
              </svg>
            </button>
            @if (figMenu() === 'more') {
              <div class="re__figTbMenu re__figTbMenu--more">
                <button type="button" class="re__figTbItem" (click)="figureCmd('cut')">Cut <span class="re__figTbKbd">Ctrl+X</span></button>
                <button type="button" class="re__figTbItem" (click)="figureCmd('copy')">Copy <span class="re__figTbKbd">Ctrl+C</span></button>
                <button type="button" class="re__figTbItem" (click)="figureCmd('duplicate')">Duplicate <span class="re__figTbKbd">Ctrl+Shift+D</span></button>
                <div class="re__figTbDivider"></div>
                <button type="button" class="re__figTbItem" (click)="figureCmd('before')">Add empty paragraph before</button>
                <button type="button" class="re__figTbItem" (click)="figureCmd('after')">Add empty paragraph after</button>
                <div class="re__figTbDivider"></div>
                <button type="button" class="re__figTbItem is-danger" (click)="figureCmd('delete')">Delete <span class="re__figTbKbd">Del</span></button>
              </div>
            }
          </div>
        </div>
        }
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
          </div><!-- /.re-editor-content -->
        </div><!-- /.re-editor-column -->
      </div><!-- /.re-editor-page -->
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Ricos-style outer shell ─────────────────────────────────────
       Wraps the existing .re box with three structural layers:
         .re-editor-host     — the new outer (also has the old .re class)
         .re-static-toolbar  — pins the toolbar to the top of the host
           .re-toolbar-rail  — flex row that holds the existing .re__toolbar
         .re-editor-page     — vertical scroll container for the canvas
           .re-editor-column — max-940px reading column (centered)
             .re-editor-title   — optional <textarea> title slot
             .re-editor-content — wraps existing .re__slot + .re__surfaceWrap
       The previous one-flat-box layout stayed visually similar in
       step 1 — these wrappers exist mainly so step 2+ (banner DOM,
       toolbar reorder, fullscreen, etc.) have stable anchor points. */
    .re-editor-host {
      position: relative;
      display: flex;
      flex-direction: column;

      /* ── Ricos theme variables ─────────────────────────────────────
         These are the Ricos --ricos-custom-* entry points the parent
         app can override to re-theme the editor (settings-action-color
         is the primary accent, p-color is the body text colour, etc.).
         Defaults match the editor's existing hardcoded palette so
         pages without overrides render identically.

         Add new theme overrides via:
           .my-app-shell { --ricos-custom-settings-action-color: #ff5722; }
         and the matching CSS rules below will pick them up.

         The legacy --re-banner-* vars are NOT renamed — those describe
         internal banner state, not theme overrides. They keep being
         driven by applyBannerStyles() via the --ricos-internal-layout-*
         aliases declared in the banner section block. */
      --ricos-custom-settings-action-color: #32acc1;     /* primary accent (selection / focus ring) */
      --ricos-custom-action-color:          #116DFF;     /* secondary accent (add-plugin, AI button) */
      --ricos-custom-settings-icons-color:  #0f172a;     /* toolbar icon colour */
      --ricos-custom-p-color:               #0f172a;     /* body text colour */
      --ricos-custom-bg-color:              #ffffff;     /* canvas background */
      --ricos-custom-border-color:          #e2e8f0;     /* divider / chip border */
      --ricos-custom-muted-color:           #64748b;     /* secondary text / placeholder */
    }
    .re-static-toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .re-toolbar-rail {
      display: flex;
      align-items: stretch;
      width: 100%;
    }
    /* The editor flows with the document — no internal scroll
       container. Scrolling happens on body/window so the page-level
       scrollbar is the only one the user sees. The sticky toolbar
       above still works because position:sticky tracks the nearest
       scrolling ancestor (the viewport). */
    .re-editor-page {
      display: flex;
      justify-content: center;
    }
    .re-editor-column {
      width: 100%;
      max-width: 940px;
      display: flex;
      flex-direction: column;
    }
    .re-editor-content {
      display: flex;
      flex-direction: column;
    }
    /* Title slot — opt-in via showTitle(). Auto-grows via the rows
       attribute (driven by titleRows()) plus field-sizing as a
       progressive enhancement where supported. */
    .re-editor-title {
      position: relative;
      padding: 16px 24px 4px;
    }
    .re-editor-title__input {
      width: 100%;
      border: none;
      outline: none;
      resize: none;
      background: transparent;
      font: 600 32px/1.2 inherit;
      color: #0f172a;
      letter-spacing: -0.01em;
      field-sizing: content;
      padding: 0;
    }
    .re-editor-title__input::placeholder { color: #94a3b8; font-weight: 600; }
    .re-editor-title__counter {
      position: absolute;
      right: 24px;
      bottom: 8px;
      font-size: 11px;
      color: #94a3b8;
      pointer-events: none;
    }
    .re-editor-title__counter.is-near-limit { color: #dc2626; }
    /* When the editor sits inside a Wix-style bare composer, the
       outer .re class strips its own border so the host shell flows
       into the surrounding page. */
    .re--bare.re-editor-host { background: transparent; }
    .re--bare .re-static-toolbar { background: #ffffff; }

    /* Fullscreen toggle button — pinned at the top-right corner of
       the editor host. 28×28 square with the Wix expand/collapse
       glyph. Sits above the sticky toolbar's z-index so it stays
       reachable even when the toolbar is positioned over content. */
    .re-fullscreen-toggle {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      background: var(--ricos-custom-bg-color, #ffffff);
      color: var(--ricos-custom-settings-icons-color, #0f172a);
      border: 1px solid var(--ricos-custom-border-color, #e2e8f0);
      border-radius: 6px;
      cursor: pointer;
      z-index: 30;
      transition: background-color .12s, border-color .12s, color .12s;
    }
    .re-fullscreen-toggle:hover {
      background: color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 8%, var(--ricos-custom-bg-color, #ffffff));
      border-color: color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 30%, var(--ricos-custom-border-color, #e2e8f0));
      color: var(--ricos-custom-settings-action-color, #32acc1);
    }
    .re-fullscreen-toggle:active { transform: scale(.95); }

    /* Fullscreen mode — pin the host to the viewport. The toolbar's
       sticky-top works against the new scroll container (the page
       div) so it keeps tracking the top of the visible area. */
    .re-editor-host.re--fullscreen {
      position: fixed !important;
      inset: 0 !important;
      z-index: 9999 !important;
      width: auto !important;
      height: auto !important;
      max-width: none !important;
      max-height: none !important;
      border-radius: 0 !important;
      background: var(--ricos-custom-bg-color, #ffffff);
    }
    /* Body scroll lock — the host fills the viewport so we don't want
       the background page also scrolling. Targets the :host element
       so consumer-supplied wrappers don't fight the layout. */
    :host:has(.re-editor-host.re--fullscreen) {
      position: relative;
      z-index: 9999;
    }

    .re {
      border: 1px solid var(--ricos-custom-border-color, #d1d5db);
      border-radius: 8px;
      background: var(--ricos-custom-bg-color, #fff);
      overflow: hidden;
      transition: border-color .12s, box-shadow .12s;
    }
    .re:focus-within {
      border-color: var(--ricos-custom-settings-action-color, #32acc1);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 15%, transparent);
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
      background: var(--ricos-custom-border-color, #e2e8f0);
      margin: 2px 4px;
      flex-shrink: 0;
    }

    .re__btn--toggle { flex-shrink: 0; margin-inline-start: 4px; }

    /* Content AI button — slightly larger touch target, brand colour
       to mark it as the entry point to AI features. */
    .re__btn.re__btn--ai {
      color: var(--ricos-custom-action-color, #116DFF);
    }
    .re__btn.re__btn--ai:hover {
      background: color-mix(in srgb, var(--ricos-custom-action-color, #116DFF) 8%, transparent);
    }

    /* Font-size field — Ricos pattern: a number input with an inline
       chevron that opens the preset overlay. Typing a number commits
       on Enter / blur via commitSizeFromInput(). */
    .re__sizeField {
      display: inline-flex;
      align-items: stretch;
      border: 1px solid transparent;
      border-radius: 6px;
      height: 28px;
      padding: 0 2px 0 6px;
      gap: 2px;
      transition: background-color .12s, border-color .12s;
    }
    .re__sizeField:hover { background: #eef2f6; }
    .re__sizeField:focus-within {
      background: #fff;
      border-color: #cbd5e1;
    }
    .re__sizeInput {
      width: 30px;
      border: none;
      outline: none;
      background: transparent;
      font: 13px/1 inherit;
      color: #0f172a;
      text-align: center;
      padding: 0;
      -moz-appearance: textfield;
    }
    .re__sizeInput::-webkit-outer-spin-button,
    .re__sizeInput::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .re__sizeChevron {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      border: none;
      background: transparent;
      color: #64748b;
      cursor: pointer;
      border-radius: 4px;
      padding: 0;
    }
    .re__sizeChevron:hover { background: #e2e8f0; color: #0f172a; }

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
    /* Surface wrap — flow with content (no flex grow). Page-level
       scrolling is preferred so the editor doesn't carry its own
       internal scrollbar. */
    .re__surfaceWrap { position: relative; display: flex; flex-direction: column; }

    /* Floating "+" button — Ricos floating-add-plugin shell. The
       horizontal position is composed in the template via
         calc(<line-left>px + var(--ricos-custom-editor-add-plugin-button-position-inline-start, -36px))
       so callers can re-theme the offset by overriding the CSS var
       at any ancestor (default -36px parks the button outside the
       line's left edge with a small gap). Plus-icon colour uses the
       Wix brand blue #116DFF. */
    .re-editor-host {
      --ricos-custom-editor-add-plugin-button-position-inline-start: -36px;
    }
    .re__addBtn {
      position: absolute;
      width: 26px; height: 26px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--ricos-custom-bg-color, #fff);
      color: var(--ricos-custom-action-color, #116DFF);
      border: 1px solid var(--ricos-custom-border-color, #e2e8f0);
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
      transition: transform 120ms ease, background 120ms ease, color 120ms ease, border-color 120ms ease;
      z-index: 5;
    }
    .re__addBtn:hover {
      background: color-mix(in srgb, var(--ricos-custom-action-color, #116DFF) 6%, var(--ricos-custom-bg-color, #fff));
      border-color: color-mix(in srgb, var(--ricos-custom-action-color, #116DFF) 25%, var(--ricos-custom-border-color, #e2e8f0));
      transform: scale(1.05);
    }
    .re__addBtn:active { transform: scale(0.95); }

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
    /* Labelled variant — primary actions (Settings, Banner) show the
       label text next to the icon. Slightly more horizontal padding so
       the chip reads as a button rather than a bare icon. */
    .re__figTbBtn--labelled { padding: 6px 12px; font-size: 13px; font-weight: 600; }
    .re__figTbBtn--labelled.is-on {
      background: #e6f7fa;
      color: #0e7490;
    }
    .re__figTb--banner { padding: 6px 12px; }

    /* Per-element contextual mini-toolbar — same chrome family as the
       figure / column toolbars but smaller. Shows the element type
       as a small label, then the type-specific actions. */
    .re__cellElemTb {
      position: absolute;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
      z-index: 11;
      white-space: nowrap;
    }
    .re__cellElemTbLabel {
      font: 600 11px/1 inherit;
      color: var(--ricos-custom-settings-action-color, #32acc1);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 0 4px;
    }
    /* Button-settings popover — pops out of the cell-element
       toolbar's gear icon when a button is picked. Small in-place
       panel with the essential button-design controls. */
    .re__btnSettings {
      position: absolute;
      transform: translateX(-50%);
      width: 240px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
      z-index: 12;
    }
    .re__btnSettingsHead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      cursor: grab;
      user-select: none;
    }
    .re__btnSettingsHead:active { cursor: grabbing; }
    .re__btnSettingsHead h4 { margin: 0; font: 600 14px/1 inherit; color: #0f172a; }
    .re__btnSettingsClose {
      width: 24px; height: 24px;
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      color: #475569;
      cursor: pointer;
    }
    .re__btnSettingsClose:hover { background: #f1f5f9; color: #0f172a; }
    /* Top-level tabs across the popover head — Settings | Design.
       Underline on the active tab matches the Wix layout. */
    .re__btnTabs {
      display: flex;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 12px;
    }
    .re__btnTab {
      flex: 1;
      padding: 10px 0;
      background: transparent;
      border: none;
      font: 500 13px/1 inherit;
      color: #475569;
      cursor: pointer;
      position: relative;
      transition: color .12s;
    }
    .re__btnTab:hover { color: #0f172a; }
    .re__btnTab.is-on { color: var(--ricos-custom-settings-action-color, #32acc1); }
    .re__btnTab.is-on::after {
      content: '';
      position: absolute;
      left: 0; right: 0; bottom: -1px;
      height: 2px;
      background: var(--ricos-custom-settings-action-color, #32acc1);
    }
    /* Normal / Hover sub-toggle — segmented pill at the top of the
       Design tab. */
    .re__btnStateGroup {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      padding: 0;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 4px;
    }
    .re__btnStateGroup button {
      padding: 7px 0;
      background: transparent;
      border: none;
      font: 500 12px/1 inherit;
      color: #475569;
      cursor: pointer;
    }
    .re__btnStateGroup button.is-on {
      background: color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 6%, #fff);
      border: 1px solid var(--ricos-custom-settings-action-color, #32acc1);
      color: var(--ricos-custom-settings-action-color, #32acc1);
      border-radius: 5px;
    }
    .re__btnSettingsBody {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px 12px;
    }
    .re__btnField {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 8px;
      font: 500 12px/1 inherit;
      color: #0f172a;
    }
    .re__btnField > span { color: #475569; }
    .re__btnField--row { align-items: center; }
    .re__btnField input[type="text"],
    .re__btnField input[type="number"] {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font: inherit;
      color: inherit;
      outline: none;
    }
    .re__btnField input[type="text"]:focus,
    .re__btnField input[type="number"]:focus {
      border-color: var(--ricos-custom-settings-action-color, #32acc1);
    }
    .re__btnField input[type="color"] {
      width: 32px;
      height: 24px;
      padding: 0;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
    }
    /* Per-element popovers (button settings, link panel) live inside
       the surface-wrap and anchor to surface-relative coords coming
       out of cellElementToolbar(). Override the base .re__figPanel's
       position:fixed (which expects viewport-relative coords) so the
       popover sits exactly where the math points. Also narrow the
       width since these panels have fewer fields than the Layout
       section. */
    .re__figPanel.re__figPanel--btn,
    .re__figPanel.re__figPanel--link {
      position: absolute !important;
      width: 260px;
      transform: translateX(-50%);
    }

    /* When a native <input type="color"> sits INSIDE a swatch label,
       it just provides the picker UX — visually hide it so only the
       swatch button shows. Clicking the label opens the picker. */
    .re__figColorTrigger > .re__figColorNative {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      border: none;
      padding: 0;
      margin: 0;
    }
    .re__figColorTrigger { position: relative; overflow: hidden; }

    /* Link panel — stacked rows (label above input) + a footer row
       with Cancel/Save. */
    .re__figRow--stack {
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 6px;
    }
    /* Section picker list. */
    .re__figLinkSectionList {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 4px;
    }
    .re__figLinkSectionList button {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background: transparent;
      border: none;
      border-radius: 4px;
      text-align: left;
      cursor: pointer;
    }
    .re__figLinkSectionList button:hover { background: #f1f5f9; }
    .re__figLinkSectionList button.is-on {
      background: color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 12%, #fff);
      color: var(--ricos-custom-settings-action-color, #32acc1);
    }
    .re__figLinkSectionTag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px; height: 22px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #475569;
      font: 700 10px/1 inherit;
      text-transform: uppercase;
    }
    .re__figLinkSectionLabel { font: 500 13px/1.2 inherit; color: #0f172a; }
    .re__figLinkEmpty {
      padding: 12px;
      border: 1px dashed #e2e8f0;
      border-radius: 6px;
      font: 400 12px/1.4 inherit;
      color: #64748b;
      background: #f8fafc;
    }
    .re__figLinkUrl {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font: 400 13px/1 inherit;
      color: #0f172a;
      outline: none;
    }
    .re__figLinkUrl:focus { border-color: var(--ricos-custom-settings-action-color, #32acc1); }
    .re__figPanelFoot {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid #e2e8f0;
      background: #fff;
    }
    .re__figFootBtn {
      padding: 6px 16px;
      border: 1px solid var(--ricos-custom-settings-action-color, #32acc1);
      border-radius: 999px;
      background: #fff;
      font: 600 13px/1 inherit;
      color: var(--ricos-custom-settings-action-color, #32acc1);
      cursor: pointer;
    }
    .re__figFootBtn:hover {
      background: color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 6%, #fff);
    }
    .re__figFootBtn.re__figFootBtn--primary {
      background: var(--ricos-custom-settings-action-color, #32acc1);
      color: #ffffff;
    }
    .re__figFootBtn.re__figFootBtn--primary:hover {
      background: color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 85%, #000);
    }
    /* Button-size selector — 3 icon toggles (rectangles of
       increasing size). Matches the Wix Design-tab layout. */
    .re__btnSizeGroup {
      display: inline-flex;
      gap: 4px;
    }
    .re__btnSizeGroup button {
      width: 32px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      color: #475569;
      cursor: pointer;
      position: relative;
      transition: border-color .12s, background-color .12s, color .12s;
    }
    .re__btnSizeGroup button:hover { background: #f1f5f9; color: #0f172a; }
    .re__btnSizeGroup button.is-on {
      background: color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 8%, #fff);
      border-color: var(--ricos-custom-settings-action-color, #32acc1);
      color: var(--ricos-custom-settings-action-color, #32acc1);
    }
    /* Tiny brand checkmark on the active size — matches Wix. */
    .re__btnSizeGroup button.is-on::after {
      content: '';
      position: absolute;
      top: -4px; right: -4px;
      width: 12px; height: 12px;
      background: var(--ricos-custom-settings-action-color, #32acc1);
      border-radius: 50%;
      border: 2px solid #fff;
    }

    /* Alignment dropdown — sibling of the link/settings buttons in
       the cell-element toolbar. Menu opens below the trigger. */
    .re__btnAlignDd { position: relative; display: inline-flex; }
    .re__btnAlignMenu {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      min-width: 140px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.15);
      padding: 4px;
      z-index: 13;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .re__btnAlignMenu button {
      display: block;
      width: 100%;
      padding: 6px 10px;
      background: transparent;
      border: none;
      border-radius: 4px;
      font: 500 12px/1 inherit;
      color: #0f172a;
      text-align: left;
      cursor: pointer;
    }
    .re__btnAlignMenu button:hover { background: #f1f5f9; }
    .re__btnAlignMenu button.is-on {
      background: var(--ricos-custom-settings-action-color, #32acc1);
      color: #ffffff;
    }
    .re__btnAlignMenuDivider {
      height: 1px;
      background: #e2e8f0;
      margin: 4px -4px;
    }
    .re__btnAlignMenuToggleRow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      font: 500 12px/1 inherit;
      color: #0f172a;
    }

    /* Selection ring on the picked cell-element — uses the editor's
       primary brand teal (settings-action-color) so it sits in the
       same colour family as the banner / column / handle chrome
       instead of competing with the Wix-blue action-color. */
    :host ::ng-deep .re__surface .re-cell-elem-active {
      outline: 2px solid var(--ricos-custom-settings-action-color, #32acc1) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 15%, transparent) !important;
      border-radius: inherit;
    }
    /* Picked element while being dragged — fade it out so the user
       can see the drop indicator and target blocks underneath. */
    :host ::ng-deep .re__surface .re-cell-elem-dragging {
      opacity: 0.4 !important;
      cursor: grabbing !important;
    }

    /* Drag-handle grip — small dots column at the start of any
       floating toolbar. Lets the user pull the toolbar out of the
       way when it covers content. Cursor flips to grabbing while
       the drag is active (set by the JS handler on body). */
    .re__tbDrag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 24px;
      color: #94a3b8;
      cursor: grab;
      border-radius: 4px;
      transition: background-color .12s, color .12s;
      flex-shrink: 0;
    }
    .re__tbDrag:hover { background: #f1f5f9; color: #0f172a; }
    .re__tbDrag:active { cursor: grabbing; }
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
    .re__figTbItem.is-danger { color: #dc2626; }
    .re__figTbItem.is-danger:hover { background: #fef2f2; }
    .re__figTbKbd {
      font-size: 11px;
      color: #94a3b8;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .re__figTbMenu--more { min-width: 220px; }
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
    /* Number + unit combined into a single rounded chip — number input
       in the middle, "px"/"%" suffix on the right, with an optional
       prefix icon (.re__figTbNumIcon) on the left. Same 118px Wix
       Input width regardless of whether a prefix icon is present, so
       chips line up vertically across every row in the panel. */
    .re__figTbNum {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 10px;
      height: 28px;
      width: 118px;
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
    /* ─── Banner interaction states (Wix style) ─────────────────────
       Layered on top of the existing selection / column outlines:

       1. Unfocused          — clean, no decoration
       2. Hover (not picked) — 1px brand outline at 45% alpha
       3. Selected banner    — 1.5px brand outline at 70% alpha
                               + e/w resize handles via .re__resizer
       4. Hover column       — dashed brand outline inside selected banner
       5. Selected column    — solid 2px brand outline + soft brand fill
                               + pill drag handles at top and bottom
       6. Active drag        — slightly heavier outline + ring shadow */
    :host ::ng-deep .re__surface .re-banner:hover:not(.is-selected) {
      outline: 1px solid rgba(50,172,193,.45) !important;
      outline-offset: 2px !important;
    }
    :host ::ng-deep .re__surface .re-banner.is-selected {
      outline: 1.5px solid rgba(50,172,193,.7) !important;
      outline-offset: 2px !important;
    }
    :host ::ng-deep .re__surface .re-banner.is-selected .re-banner-col:hover:not(.is-selected-col) {
      outline: 1.5px dashed rgba(50,172,193,.6) !important;
      outline-offset: 0 !important;
    }
    :host ::ng-deep .re__surface .re-banner-col.is-selected-col {
      /* Wix doesn't draw a solid outline on the selected column —
         it relies on the top/bottom pill handles + a soft brand tint
         to mark the selection. An outline that spans the full banner
         width reads as a divider stripe, especially in 1-column
         layouts, which is why we ditched it. */
      outline: none !important;
      background-color: rgba(50,172,193,.06) !important;
    }
    /* Pill drag-handles on a selected column. These are real DOM
       elements (.re-banner-col-handle) added on selection because
       the column's ::before / ::after pseudos are already used for
       the image background and overlay layers — we can't stack a
       third use on the same pseudo. */
    :host ::ng-deep .re__surface .re-banner-col-handle {
      position: absolute !important;
      left: 50% !important;
      width: 28px !important;
      height: 8px !important;
      margin-left: -14px !important;
      border-radius: 999px !important;
      pointer-events: none !important;
      z-index: 3 !important;
    }
    :host ::ng-deep .re__surface .re-banner-col-handle--top {
      top: -10px !important;
      background: #32acc1 !important;
      box-shadow: 0 1px 4px rgba(50,172,193,.4) !important;
    }
    :host ::ng-deep .re__surface .re-banner-col-handle--bottom {
      bottom: -10px !important;
      background: #ffffff !important;
      border: 1px solid #32acc1 !important;
    }
    /* Active drag state — applied while a resize handle is being
       dragged. Heavier outline + soft ring so the live feedback reads
       distinctly from the static "selected" outline. */
    :host ::ng-deep .re__surface .re-banner.is-resizing,
    :host ::ng-deep .re__surface .re-banner-col.is-resizing {
      outline: 2px solid #32acc1 !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(50,172,193,.18) !important;
    }
    /* Focused resize handle — emphasised when keyboard-focused or
       hovered, so the user can see which axis the next drag will
       move along. */
    :host ::ng-deep .re__surface .re__resizer:hover,
    :host ::ng-deep .re__surface .re__resizer:focus-visible {
      transform: scale(1.2);
      box-shadow: 0 2px 6px rgba(50,172,193,.4) !important;
    }

    /* Floating, draggable Image panel — Wix's right-side "Image"
       window with Settings + Design tabs. The whole panel is
       positioned absolutely against the surface wrap so it floats
       on top of the canvas without disturbing the contenteditable
       text flow underneath. */

    .re__figPanel {
      /* Viewport-pinned so the panel can be dragged anywhere on the
         page. Capped at min(640px, viewport-32px) so it never grows
         taller than that — content scrolls inside the body instead. */
      position: fixed;
      width: 320px;
      max-height: min(640px, calc(100vh - 32px));
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(15,23,42,.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 1000;
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
    .re__figPanelBody {
      padding: 12px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      /* flex:1 + min-height:0 lets the body fill the remaining
         vertical space inside the capped panel and actually scroll
         when the content exceeds that space (without these, the
         body grows beyond the panel's max-height and overflows). */
      flex: 1 1 auto;
      min-height: 0;
    }
    /* Sub-section hint paragraph — small grey copy beneath a section
       heading, like the reference's "Choose how your content behaves
       when the screen size changes." text under Responsive behavior. */
    .re__figPanelHint { margin: -8px 0 4px; font-size: 12px; color: #64748b; line-height: 1.4; }
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
    /* Image preview tile — shorter aspect (16/9) so the panel doesn't
       balloon vertically when an image is set. */
    .re__figBgImage img { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; }
    .re__figBgImageActions { display: flex; gap: 6px; }
    .re__figBgImageActions .re__figTbBtnGhost { flex: 1; }
    .re__figBgImageEmpty {
      width: 100%;
      aspect-ratio: 16/9;
      background: #f8fafc;
      border: 2px dashed #cbd5e1;
      border-radius: 8px;
      color: #94a3b8;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .re__figBgImageEmpty:hover { border-color: #32acc1; color: #32acc1; }
    /* Swatch chip that triggers the floating Colors panel — shows the
       current colour or gradient as its background. Subtle border so a
       white-on-white fill is still discoverable. The "is-active" state
       (i.e. this swatch's colour/gradient is what's being painted, vs an
       image taking over) gets a teal ring to make the precedence clear. */
    .re__figBgTrigger {
      width: 56px;
      height: 28px;
      padding: 0;
      border: 1px solid rgba(15,23,42,.18);
      border-radius: 6px;
      cursor: pointer;
      box-shadow: inset 0 0 0 1px #fff;
    }
    .re__figBgTrigger.is-active { border-color: #32acc1; box-shadow: 0 0 0 2px rgba(50,172,193,.18); }
    .re__figBgTrigger:hover { border-color: #94a3b8; }
    /* Compact 28×28 swatch trigger — drop-in replacement for the inline
       app-color-picker in column-fill / column-border / overlay /
       design-border rows. Opens the ColorsPanel in colour-only mode. */
    .re__figColorTrigger {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid rgba(15,23,42,.25);
      border-radius: 4px;
      cursor: pointer;
      flex-shrink: 0;
      /* Two-layer paint: the chosen colour (--swatch-color) painted
         as a flat gradient ON TOP, with a checkerboard underneath.
         When the colour is fully opaque it hides the checkers; as
         opacity drops the checkers show through, giving the user
         direct visual feedback of the alpha value. The colour is
         carried via a custom property so callers can bind to it
         without a background-image clobbering the checkerboard. */
      background-image:
        linear-gradient(var(--swatch-color, transparent), var(--swatch-color, transparent)),
        repeating-conic-gradient(#cbd5e1 0% 25%, #f1f5f9 0% 50%);
      background-size: auto, 8px 8px;
    }
    .re__figColorTrigger:hover { border-color: #94a3b8; }
    /* Icon toggle pair — used for the Column-layout selector. Each
       toggle is a 36×36 outlined button; the active one gets a brand
       border + a tiny blue checkmark badge in the top-right corner. */
    .re__figCtrl--toggles { gap: 6px; }
    .re__figIconToggle {
      position: relative;
      width: 38px;
      height: 38px;
      padding: 0;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #475569;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .re__figIconToggle:hover { color: #0f172a; border-color: #cbd5e1; }
    .re__figIconToggle.is-on {
      border-color: #32acc1;
      color: #32acc1;
      box-shadow: 0 0 0 1px #32acc1 inset;
    }
    .re__figIconToggleCheck {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 14px;
      height: 14px;
      background: #32acc1;
      border: 1.5px solid #fff;
      border-radius: 50%;
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    /* Container slot for the SearchDropdown that replaced the
       native <select>. Width matches the panel's other right-side
       chips so labels and controls line up. No background/chevron
       styling — the dropdown component owns its own chrome. */
    .re__figSelect { display: inline-flex; min-width: 140px; }

    /* 3x3 image-position grid. Each cell is a button with a small
       dot — clicking sets the picked position. */
    .re__figPosGrid {
      display: grid;
      grid-template-columns: repeat(3, 24px);
      grid-template-rows: repeat(3, 24px);
      gap: 3px;
    }
    .re__figPosCell {
      width: 24px; height: 24px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    /* The position row is a 2-column CSS grid: label auto-sized on the
       left, position-grid pinned to a fixed-width right column. The
       double-class selector boosts specificity above the base
       .re__figRow display:flex rule (which is defined later in this
       stylesheet) so the grid display actually applies — without it
       the row falls back to flex and the position grid bleeds into
       the scaling row above. */
    .re__figRow.re__figRow--posrow {
      display: grid;
      grid-template-columns: 1fr 84px;
      gap: 12px;
      align-items: center;
      /* Ensure the row is tall enough for the 78px (3×24+gaps) position
         grid; without this the row's flex/min-height inheritance lets
         the grid bleed into the next row. */
      min-height: 84px;
    }
    .re__figPosCell:hover { border-color: #cbd5e1; }
    .re__figPosCell.is-on { background: #32acc1; border-color: #32acc1; }
    .re__figPosDot { width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; opacity: 0; transition: opacity 100ms; }
    .re__figPosCell.is-on .re__figPosDot { background: #fff; opacity: 1; }

    /* Variants used by the new Layout-tab rows. */
    .re__figRow--stack { flex-direction: column; align-items: stretch; gap: 4px; }
    /* Label row above the Column-padding chip grid — label text on the
       left, link button pushed to the right edge so it lines up with
       the rightmost chip below. Mirrors the Wix .__labelRow rule. */
    .re__figLabelLine {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 8px;
    }
    .re__figLabelLine .re__figTbLabel { flex: 0 0 auto; }
    .re__figLinkBtn {
      width: 30px; height: 30px;
      padding: 4px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      color: #64748b;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .re__figLinkBtn:hover { color: #0f172a; border-color: #cbd5e1; }
    .re__figLinkBtn.is-on { background: #e6f7fa; color: #0e7490; border-color: #32acc1; }
    /* Column-padding chip layout. Default is 2 chips side-by-side
       (legacy X/Y mode); the --quad modifier opens it into a 2×2
       grid for the 4-edge view (top/right/bottom/left chips). */
    .re__figPadPair {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      align-items: center;
    }
    /* 2×2 chip grid for Column padding — chips span the full row
       width (two equal columns, stretched) and the grid itself runs
       edge-to-edge, so the rightmost chip lines up with the right
       edge of the single-chip rows (Column gap, Vertical margins). */
    .re__figPadPair--quad {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-auto-rows: auto;
      gap: 10px 6px;
      width: 100%;
    }
    .re__figPadPair--quad .re__figTbNum { width: 100%; min-width: 0; }
    /* Each padding cell stacks its number input + slider vertically.
       The slider hides until the cell is focused so the 2×2 grid
       stays compact when nothing is being edited. */
    .re__figPadCell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    /* Padding sliders — the 4 padding cells live inside the same
       .re__figRow, so the general .re__figRow:focus-within rule
       would reveal ALL four sliders when ANY chip is focused. Hide
       padding sliders by default (overriding the broader rule) and
       only reveal the one inside the focused cell. */
    .re__figRow:focus-within .re__figSlider.re__figSlider--pad {
      opacity: 0 !important;
      visibility: hidden !important;
      transform: translateX(-4px) scale(.96) !important;
      transition: opacity 120ms ease, transform 120ms ease, visibility 0s linear 120ms !important;
    }
    .re__figRow:focus-within .re__figPadCell:focus-within .re__figSlider.re__figSlider--pad {
      opacity: 1 !important;
      visibility: visible !important;
      transform: translateX(0) scale(1) !important;
      transition: opacity 120ms ease, transform 120ms ease, visibility 0s !important;
    }
    .re__figCtrl--inline {
      flex-direction: row;
      align-items: center;
      gap: 0;
    }
    .re__figTbNum--wide { width: 96px; }
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

    /* Small "no color" button — red diagonal slash inside a white
       square. Shown next to every colour picker; clicking sets the
       corresponding opacity to 0 so the colour is effectively cleared. */
    .re__figNoColor {
      width: 28px; height: 28px;
      padding: 0;
      background: transparent;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .re__figNoColor:hover { border-color: #cbd5e1; }
    .re__figNoColor.is-on { border-color: #ef4444; box-shadow: 0 0 0 2px rgba(239,68,68,.15); }
    /* Compact labeled slider row — label · chip · slider, all
       inline and vertically centred. Generous gap between the
       three elements. The label keeps natural width on the left,
       the input chip is narrow (~80px) in the middle, the slider
       expands to fill the remaining space. */
    .re__figRow { display: flex; align-items: center; gap: 14px; min-height: 32px; position: relative; }
    /* Labels are width-capped so longer copy (e.g. "Background overlay")
       truncates with ellipsis. Hovering shows the full text via the
       appTooltip directive on the label itself. Without the cap the
       label would grow into the control column and push the chip/
       dropdown off the right edge. */
    .re__figRow > .re__figTbLabel {
      flex: 0 0 auto;
      font-size: 13px;
      color: #4a4a55;
      font-weight: 500;
      min-width: 88px;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: default;
    }
    .re__figCtrl { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; justify-content: flex-end; }
    /* Gradient picker fills the panel width — its own card chrome
       (border + padding) provides the visual frame, so no row wrapper. */
    .re__figGradient { display: block; width: 100%; }
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
       chip rather than a tiny dot. Crisper border so even a
       pure-white fill is distinguishable against the white panel —
       earlier I tried an inset white box-shadow for the same
       reason but it covered the actual colour. Border alone is
       enough. The cp-checker "empty" pattern is also disabled so
       the picker's Clear all action is the single source of truth
       for transparent. */
    .re__figSwatch ::ng-deep button > span > span:first-child {
      width: 22px !important;
      height: 22px !important;
      border: 1px solid rgba(15,23,42,.25) !important;
      border-radius: 4px !important;
      background-image: none !important;
    }
    /* Pop-out slider — resting state hides it entirely, focus-within
       reveals a floating pill anchored to the right of the input
       chip. Track is thin (3px) with primary-coloured fill and a
       circular primary thumb; opacity variant uses a checkerboard
       backdrop. Sub-200px panel-friendly: tucks under the row so it
       can't escape the panel edge. */
    /* Slider popover — fixed-positioned so it escapes any clipping
       container. Repositioned by positionFigSlider() to sit to the
       RIGHT of the focused chip (Wix-style "popover to the side"),
       not below it. Narrow (88px) and wrapped in a white pill chrome
       so it reads as a proper floating popover. */
    /* ::ng-deep on these rules so they also style the slider input
       rendered inside the shared <app-re-slider> component (whose
       host attribute differs from RichEditorComponent's). */
    :host ::ng-deep .re__figSlider {
      position: fixed;
      width: 88px;
      padding: 8px 10px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      box-shadow: 0 6px 18px rgba(15,23,42,.12);
      -webkit-appearance: none;
      appearance: none;
      height: 28px;
      box-sizing: border-box;
      cursor: pointer;
      outline: none;
      opacity: 0;
      visibility: hidden;
      transform: translateX(-4px) scale(.96);
      transform-origin: center left;
      transition: opacity 120ms ease, transform 120ms ease, visibility 0s linear 120ms;
      z-index: 9999;
    }
    /* Reveal the slider only when the input chip OR the slider itself
       has focus — NOT when a sibling color-swatch button does. The
       slider is position:fixed and overlays the area to the right
       of the chip, so an unconditional :focus-within would steal
       clicks on the swatch trigger.
       The is-active class is added by JS (onHostFocusIn) so it
       works through the app-re-slider wrapper too — relying on
       a sibling selector across the wrapper proved unreliable
       under Angular view encapsulation. */
    :host ::ng-deep .re__figRow .re__figTbNum:focus-within ~ .re__figSlider,
    :host ::ng-deep .re__figRow .re__figSlider:focus,
    :host ::ng-deep .re__figRow .re__figSlider:focus-within,
    :host ::ng-deep .re__figSlider.is-active {
      opacity: 1;
      visibility: visible;
      transform: translateX(0) scale(1);
      transition: opacity 120ms ease, transform 120ms ease, visibility 0s;
    }
    :host ::ng-deep .re__figSlider::-webkit-slider-runnable-track {
      height: 4px;
      border-radius: 999px;
      background: #e2e8f0;
    }
    :host ::ng-deep .re__figSlider::-moz-range-track {
      height: 4px;
      border-radius: 999px;
      background: #e2e8f0;
    }
    :host ::ng-deep .re__figSlider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 16px; height: 16px;
      background: #32acc1;
      border: 2px solid #fff;
      border-radius: 50%;
      margin-top: -6px;
      box-shadow: 0 1px 3px rgba(15,23,42,.2);
    }
    :host ::ng-deep .re__figSlider::-moz-range-thumb {
      width: 16px; height: 16px;
      background: #32acc1;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(15,23,42,.2);
    }
    /* Opacity variant — checkerboard backdrop overlaid with the active
       colour fading in from transparent. The thumb is dark so it stays
       visible against the patterned track. */
    .re__figSlider--opacity::-webkit-slider-runnable-track,
    .re__figSlider--opacity::-moz-range-track {
      height: 8px;
      background:
        linear-gradient(to right, rgba(0,0,0,0), var(--c, #000)),
        repeating-conic-gradient(#cbd5e1 0% 25%, #f1f5f9 0% 50%) 0 0 / 8px 8px;
    }
    .re__figSlider--opacity::-webkit-slider-thumb,
    .re__figSlider--opacity::-moz-range-thumb {
      background: #0f172a;
    }
    .re__figSlider--opacity::-webkit-slider-thumb { margin-top: -4px; }
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

    /* ═══════════════════════════════════════════════════════════════
       BANNER — 5-level nested structure (matches Wix Ricos)
       ═══════════════════════════════════════════════════════════════
       Markup contract:
         section.re-banner                wrapper (CSS vars only)
           └ .re-banner-backdrop          outer image layer + T/B padding
             └ .re-banner-resizer        positions resize handles
               └ .re-banner-inner       inner grid + stripe layer
                 ├ .re-banner-cell      one per column, editable content
                 └ .re-banner-handle--* left/right/top/bottom (siblings)
       ═══════════════════════════════════════════════════════════════ */

    /* ── Level 1: wrapper ─────────────────────────────────────────── */
    :host ::ng-deep .re__surface section.re-banner {
      position: relative !important;
      /* Flex column so a vertical resize (which writes height to the
         section) gets passed down to .re-banner-backdrop via flex 1.
         Without this the backdrop stays at its content height and the
         section grows around it, leaving white space below the colored
         area and parking the left/right handles at the wrong y. */
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      margin-block: var(--re-banner-margin, 50px) !important;
      /* Establish a containment context so the per-banner @container
         rule (emitted inline by bannerStackRule) can query *this*
         banner's width — without this, the rule would resolve against
         the nearest container ancestor (likely the editor surface)
         and never fire on small banners inside a wide editor. */
      container-type: inline-size !important;

      /* Variable aliases — applyBannerStyles() writes the canonical
         --ricos-internal-layout-* vars (matching Wix Ricos's data
         contract). The legacy --re-banner-* names are kept as
         aliases so existing CSS rules in this file continue to work
         while the rest of the migration happens. Default-fall-throughs
         match Wix's empty-state values. */

      /* Backdrop (carried on the data-layout-wrapper) */
      --re-banner-backdrop-color:          var(--ricos-internal-layout-backdrop-color, #00000000);
      --re-banner-backdrop-image:          var(--ricos-internal-layout-backdrop-image-src, none);
      --re-banner-backdrop-image-opacity:  var(--ricos-internal-layout-backdrop-image-opacity, 1);
      --re-banner-backdrop-image-scaling:  var(--ricos-internal-layout-backdrop-image-scaling, cover);
      --re-banner-backdrop-image-position: var(--ricos-internal-layout-backdrop-image-position, center);
      --re-banner-backdrop-pad-top:        var(--ricos-internal-layout-backdrop-padding-top, 0px);
      --re-banner-backdrop-pad-bottom:     var(--ricos-internal-layout-backdrop-padding-bottom, 0px);

      /* Cell padding (carried on the wrapper, applied to each
         data-layout-cell) */
      --re-banner-cell-pad-top:    var(--ricos-internal-layout-cell-padding-top, 18px);
      --re-banner-cell-pad-right:  var(--ricos-internal-layout-cell-padding-right, 0px);
      --re-banner-cell-pad-bottom: var(--ricos-internal-layout-cell-padding-bottom, 18px);
      --re-banner-cell-pad-left:   var(--ricos-internal-layout-cell-padding-left, 0px);

      /* Side gutter for the inner container (data-breakout="normal" equivalent) */
      --re-banner-breakout-pad: 0px;
    }

    /* Inner container vars live on [data-layout-container] per the
       Ricos contract. The legacy aliases here cover any rule that
       still reads --re-banner-inner-* from the inner element. */
    :host ::ng-deep .re__surface .re-banner-inner,
    :host ::ng-deep .re__surface [data-layout-container] {
      --re-banner-inner-color:          var(--ricos-internal-layout-background-color, #00000000);
      --re-banner-inner-image:          var(--ricos-internal-layout-background-image-src, none);
      --re-banner-inner-image-opacity:  var(--ricos-internal-layout-background-image-opacity, 1);
      --re-banner-inner-image-scaling:  var(--ricos-internal-layout-background-image-scaling, cover);
      --re-banner-inner-image-position: var(--ricos-internal-layout-background-image-position, center);
      --re-banner-inner-cols:           var(--ricos-internal-layout-column-template, minmax(0, 1fr));
      --re-banner-inner-gap:            var(--ricos-internal-layout-gap, 20px);
    }

    /* Cell internal structure — the data-layout-cell DOM has two
       children: a contenteditable=false handle wrapper and an
       editable content wrapper. The wrapper is positioned absolutely
       (pointer-events:none) so it doesn't interfere with the cell's
       padding/flow; only the button inside re-enables pointer events
       on itself. */
    :host ::ng-deep .re__surface .re-banner-cell-handle-wrap {
      position: absolute !important;
      inset: 0 !important;
      pointer-events: none !important;
      z-index: 6 !important;
    }
    :host ::ng-deep .re__surface .re-banner-cell-handle-wrap > .re-banner-cell-handle {
      pointer-events: auto !important;
    }
    :host ::ng-deep .re__surface .re-banner-cell-content,
    :host ::ng-deep .re__surface [data-layout-cell-content] {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      position: relative !important;
      /* Kill the browser's default contenteditable focus ring — it
         paints a thick black rectangle around the editable wrapper
         and reads as a competing border vs. the banner's own outline. */
      outline: none !important;
    }
    /* Also suppress focus rings on the editable layout container
       and the inner grid so nothing inside a banner shows a stacked
       black box on focus. */
    :host ::ng-deep .re__surface .re-banner-inner:focus,
    :host ::ng-deep .re__surface [data-layout-container]:focus,
    :host ::ng-deep .re__surface .re-banner-cell-content:focus,
    :host ::ng-deep .re__surface [data-layout-cell-content]:focus {
      outline: none !important;
    }

    /* Selection + hover states */
    :host ::ng-deep .re__surface section.re-banner:hover:not(.is-selected) {
      outline: 1px solid rgba(50, 172, 193, 0.45) !important;
      outline-offset: 2px !important;
    }
    :host ::ng-deep .re__surface section.re-banner.is-selected {
      outline: 1.5px solid rgba(50, 172, 193, 0.7) !important;
      outline-offset: 2px !important;
    }
    :host ::ng-deep .re__surface section.re-banner.is-resizing {
      outline: 2px solid #32acc1 !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(50, 172, 193, 0.18) !important;
    }

    /* ── Level 2: backdrop ────────────────────────────────────────── */
    :host ::ng-deep .re__surface .re-banner-backdrop {
      position: relative !important;
      clear: both !important;
      background-color: var(--re-banner-backdrop-color) !important;
      padding-top: var(--re-banner-backdrop-pad-top) !important;
      padding-bottom: var(--re-banner-backdrop-pad-bottom) !important;
      /* Wix breakout=normal horizontal padding — caps the column at
         --ricos-content-max-width (740px default) and centres it.
         max(0, …) clamps to 0 when the banner is narrower than the
         cap so the column doesn't get negative padding. The two var
         names below match Wix's contract exactly so a theme override
         flows through. */
      --ricos-breakout-normal-padding-start: max(0px, calc((100% - var(--ricos-content-max-width, 740px)) / 2)) !important;
      --ricos-breakout-normal-padding-end:   max(0px, calc((100% - var(--ricos-content-max-width, 740px)) / 2)) !important;
      padding-inline-start: var(--ricos-breakout-normal-padding-start) !important;
      padding-inline-end:   var(--ricos-breakout-normal-padding-end) !important;
      box-sizing: border-box !important;
      /* Flex container — when the user drags the bottom handle shorter
         than the cell content's natural height, the inner overflows
         symmetrically above and below (matching Wix). Vertical-align
         classes on the section toggle align-items so the user can
         anchor the overflow to top / middle / bottom. */
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      justify-content: flex-start !important;
      /* No overflow:hidden — cells need to be visible past the
         backdrop's edges when it's shorter than their content. The
         ::before that paints the background image is itself inset:0
         so it stays clipped to the backdrop box. */
    }
    /* Vertical-alignment classes: switch where the inner sits when the
       backdrop is taller than content, AND which way it overflows when
       the backdrop is shorter. */
    :host ::ng-deep .re__surface section.re-banner.re-banner-vtop > .re-banner-backdrop { justify-content: flex-start !important; }
    :host ::ng-deep .re__surface section.re-banner.re-banner-vmid > .re-banner-backdrop { justify-content: center     !important; }
    :host ::ng-deep .re__surface section.re-banner.re-banner-vbot > .re-banner-backdrop { justify-content: flex-end   !important; }
    /* Resizer sizes naturally to its content — NO flex:1 so it does
       NOT stretch to fill the backdrop. When the backdrop is shorter
       than the resizer, the resizer overflows symmetrically (the
       backdrop's justify-content rules above decide which way). */
    :host ::ng-deep .re__surface .re-banner-backdrop > .re-banner-resizer {
      flex: 0 0 auto !important;
      width: 100% !important;
    }
    /* Full-height mode — the column stretches to fill the banner's
       full vertical extent edge-to-edge. */
    /* 1. Zero out the backdrop's top/bottom padding wells so the
          column reaches all the way to the section's edges instead
          of stopping at the vertical-margin wells. */
    :host ::ng-deep .re__surface section.re-banner.is-full-height > .re-banner-backdrop {
      padding-top: 0 !important;
      padding-bottom: 0 !important;
    }
    /* 2. Resizer fills the backdrop. */
    :host ::ng-deep .re__surface section.re-banner.is-full-height > .re-banner-backdrop > .re-banner-resizer {
      flex: 1 1 auto !important;
      align-self: stretch !important;
      display: flex !important;
      flex-direction: column !important;
      min-height: 100% !important;
    }
    /* 3. Inner grid fills the resizer. */
    :host ::ng-deep .re__surface section.re-banner.is-full-height .re-banner-inner {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      align-content: stretch !important;
      grid-auto-rows: 1fr !important;
    }
    /* 4. Cells use 100% height so their bg/border/radius reach edges. */
    :host ::ng-deep .re__surface section.re-banner.is-full-height .re-banner-cell {
      height: 100% !important;
      min-height: 0 !important;
    }
    :host ::ng-deep .re__surface .re-banner-backdrop::before {
      content: "" !important;
      position: absolute !important;
      inset: 0 !important;
      background-image: var(--re-banner-backdrop-image) !important;
      background-position: var(--re-banner-backdrop-image-position) !important;
      background-repeat: no-repeat !important;
      background-size: var(--re-banner-backdrop-image-scaling) !important;
      opacity: var(--re-banner-backdrop-image-opacity) !important;
      pointer-events: none !important;
      z-index: 0 !important;
    }
    /* Background overlay — painted via ::after on the backdrop so it
       sits ABOVE the background image (::before) but BELOW the cell
       content (which gets z-index:2). Colour + alpha composed by
       applyBannerStyles() into --re-banner-overlay-color (rgba). */
    :host ::ng-deep .re__surface .re-banner-backdrop::after {
      content: "" !important;
      position: absolute !important;
      inset: 0 !important;
      background-color: var(--re-banner-overlay-color, transparent) !important;
      pointer-events: none !important;
      z-index: 1 !important;
    }
    /* Hide inline media (img / iframe) — banner mode uses the layer system */
    :host ::ng-deep .re__surface section.re-banner > img,
    :host ::ng-deep .re__surface section.re-banner > .re-embed-video {
      display: none !important;
    }

    /* ── Level 3: resizer (the [data-resize-container]) ─────────────
       Width comes from --ricos-internal-layout-width (written inline
       by the column markers on horizontal drag). Centred within the
       backdrop's content box via margin-inline:auto so shrinking
       pulls equally from both sides. The horizontal breakout padding
       lives on the backdrop now (Wix's data-breakout=normal pattern),
       so the resizer itself has no padding-inline. */
    :host ::ng-deep .re__surface .re-banner-resizer {
      position: relative !important;
      z-index: 1 !important;
      max-width: var(--ricos-internal-layout-width, 100%) !important;
      margin-inline: auto !important;
      box-sizing: border-box !important;
    }

    /* ── Level 4: inner grid container ────────────────────────────── */
    :host ::ng-deep .re__surface .re-banner-inner {
      position: relative !important;
      display: grid !important;
      grid-template-columns: var(--re-banner-inner-cols) !important;
      gap: var(--re-banner-inner-gap) !important;
      width: 100% !important;
      background-color: var(--re-banner-inner-color) !important;
      margin: 0 auto !important;
      align-content: start !important;
    }
    :host ::ng-deep .re__surface .re-banner-inner::before {
      content: "" !important;
      position: absolute !important;
      inset: 0 !important;
      background-image: var(--re-banner-inner-image) !important;
      background-position: var(--re-banner-inner-image-position) !important;
      background-repeat: no-repeat !important;
      background-size: var(--re-banner-inner-image-scaling) !important;
      opacity: var(--re-banner-inner-image-opacity) !important;
      pointer-events: none !important;
      z-index: 0 !important;
    }

    /* Vertical alignment variants drive the inner grid */
    :host ::ng-deep .re__surface .re-banner.re-banner-vtop .re-banner-inner { align-content: start  !important; }
    :host ::ng-deep .re__surface .re-banner.re-banner-vmid .re-banner-inner { align-content: center !important; }
    :host ::ng-deep .re__surface .re-banner.re-banner-vbot .re-banner-inner { align-content: end    !important; }

    /* ── Level 5: cell ──────────────────────────────────────────────
       Cells are direct grid items of .re-banner-inner. The flex
       wrapper inside (display: flex; column) lets vertical alignment
       of cell content work without leaking onto siblings via the
       grid's align-content. */
    :host ::ng-deep .re__surface .re-banner-cell {
      position: relative !important;
      display: flex !important;
      flex-direction: column !important;
      min-width: 0 !important;
      padding:
        var(--re-banner-cell-pad-top)
        var(--re-banner-cell-pad-right)
        var(--re-banner-cell-pad-bottom)
        var(--re-banner-cell-pad-left) !important;
      /* Background + border + radius all driven by the column-bg
         panel. The bg lives on the cell itself (NOT the inner grid)
         so the cell's border-radius clips the fill correctly — no
         square fill bleeding past the rounded corners. */
      background-color: var(--re-cell-bg-color, transparent) !important;
      border: var(--re-cell-border-width, 0px) solid var(--re-cell-border-color, transparent) !important;
      border-radius: var(--re-cell-radius, 0px) !important;
      overflow: hidden !important;
      /* border-box so the column-padding (e.g. 27px each side) stays
         INSIDE the cell's grid-track width. Without this, in a 2-col
         layout each cell's outer box = track + padding, which makes
         neighbouring cells visually overlap when the columns are
         narrow. */
      box-sizing: border-box !important;
      z-index: 2 !important;
    }
    /* Image-fill layer — painted via ::before so it can carry its own
       opacity / scaling / position without affecting the cell's bg
       color. Inset:0 clips to the cell's padding-box; the cell's
       overflow:hidden + border-radius rounds the image too. */
    :host ::ng-deep .re__surface .re-banner-cell::before {
      content: '' !important;
      position: absolute !important;
      inset: 0 !important;
      background-image: var(--re-cell-bg-image, none) !important;
      background-size: var(--re-cell-bg-image-scaling, cover) !important;
      background-position: var(--re-cell-bg-image-position, center) !important;
      background-repeat: no-repeat !important;
      opacity: var(--re-cell-bg-image-opacity, 1) !important;
      pointer-events: none !important;
      z-index: 0 !important;
    }
    :host ::ng-deep .re__surface .re-banner-cell > * { position: relative; z-index: 1; }
    :host ::ng-deep .re__surface .re-banner-cell > * { position: relative !important; z-index: 1 !important; }

    /* Cell hover + selected states (inside selected banner). The
       dashed hover outline was removed — the inner-grid's solid
       border (top + bottom + vertical guide lines via markers)
       already shows the column's extent, so a dashed hover ring on
       top would just look noisy. */
    :host ::ng-deep .re__surface .re-banner-cell.is-selected-col {
      outline: none !important;
      background-color: rgba(50, 172, 193, 0.06) !important;
    }

    /* ── Resize handles (siblings of .re-banner-inner inside .re-banner-resizer)
       SOLID teal pills — the standard Wix "resize this thing" affordance.
       Distinct from the cell-handle (white pill with grab dots) so the
       user can tell at a glance which is for the banner and which is
       for a column. */
    :host ::ng-deep .re__surface .re-banner-handle {
      position: absolute !important;
      background: #32acc1 !important;
      border: 1.5px solid #fff !important;
      border-radius: 4px !important;
      z-index: 5 !important;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.2) !important;
      opacity: 0 !important;
      transition: opacity 120ms ease, transform 120ms ease !important;
    }
    :host ::ng-deep .re__surface .re-banner-handle:hover { transform: scale(1.12); }
    :host ::ng-deep .re__surface section.re-banner.is-selected .re-banner-handle {
      opacity: 1 !important;
    }
    /* Bottom resize handle — the ONLY resize affordance on a banner.
       Wix model: banners are resizable vertically only. Dragging this
       pill writes height to the .re-banner-backdrop so the colored
       area shrinks / grows with the cursor; the section auto-sizes
       around the backdrop, so this pill always sits on the visual
       bottom edge regardless of how short/tall the user dragged.
       Visual style matches Wix Ricos: a small white pill with a
       brand-coloured fill on the inner bar and a soft drop shadow. */
    :host ::ng-deep .re__surface section.re-banner > .re-banner-handle--bottom {
      bottom: -7px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      width: 36px !important;
      height: 14px !important;
      background: #ffffff !important;
      border: 1px solid var(--ricos-custom-settings-action-color, #32acc1) !important;
      border-radius: 999px !important;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12) !important;
      cursor: ns-resize !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    :host ::ng-deep .re__surface section.re-banner > .re-banner-handle--bottom::after {
      content: '' !important;
      display: block !important;
      width: 18px !important;
      height: 4px !important;
      background: var(--ricos-custom-settings-action-color, #32acc1) !important;
      border-radius: 2px !important;
      opacity: 0 !important;
      transition: opacity 120ms ease !important;
    }
    /* Inner bar appears only on hover or during an active drag —
       resting state shows just the white pill. */
    :host ::ng-deep .re__surface section.re-banner > .re-banner-handle--bottom:hover::after,
    :host ::ng-deep .re__surface section.re-banner.is-resizing > .re-banner-handle--bottom::after {
      opacity: 1 !important;
    }
    :host ::ng-deep .re__surface section.re-banner > .re-banner-handle--bottom:hover {
      transform: translateX(-50%) scale(1.04) !important;
    }

    /* Column selection markers — vertical guide lines on the column's
       left/right edges, with a small circle at vertical centre. The
       markers are children of the inner-grid ([data-layout-container]),
       so top:0/bottom:0 makes them track the GRID's height (= the
       column's height), and left:0/right:0 hugs the column edges
       (not the section's outer edges). Decorative only (no drag). */
    :host ::ng-deep .re__surface .re-banner-marker {
      position: absolute !important;
      top: 50% !important;
      bottom: auto !important;
      width: 14px !important;
      height: 14px !important;
      background: transparent !important;
      pointer-events: auto !important;
      cursor: ew-resize !important;
      opacity: 0 !important;
      transition: opacity 120ms ease !important;
      z-index: 7 !important;
    }
    /* No vertical guide line — the inner-grid's single solid outline
       already provides the column's edges. Markers are just the
       drag-affordance circle painted via ::after. */
    :host ::ng-deep .re__surface .re-banner-marker::after {
      content: '' !important;
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      width: 10px !important;
      height: 10px !important;
      background: #ffffff !important;
      border: 1.5px solid var(--ricos-custom-settings-action-color, #32acc1) !important;
      border-radius: 50% !important;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12) !important;
      transform: translate(-50%, -50%) !important;
    }
    /* Visibility is gated by banner-selected (markers live in the
       inner-grid now, so the ancestor selector reaches up to the
       wrapping section). */
    :host ::ng-deep .re__surface section.re-banner.is-selected .re-banner-marker {
      opacity: 1 !important;
    }
    /* Per-side transform — the marker's CENTRE must sit on the
       column edge. Left uses translate(-50%) so its centre lands on
       left:0; right uses translate(50%) so its centre lands on
       right:0. Without these explicit transforms, the right marker
       drifts inward by half its width. */
    :host ::ng-deep .re__surface .re-banner-marker--left  {
      left: 0 !important;
      right: auto !important;
      transform: translate(-50%, -50%) !important;
    }
    :host ::ng-deep .re__surface .re-banner-marker--right {
      right: 0 !important;
      left: auto !important;
      transform: translate(50%, -50%) !important;
    }
    /* Inner-grid needs position:relative so the markers anchor to it. */
    :host ::ng-deep .re__surface .re-banner-inner,
    :host ::ng-deep .re__surface [data-layout-container] {
      position: relative !important;
    }
    /* Column borders — each individual cell gets its own outline so
       a 2-col banner shows two separately-bordered boxes with the
       grid gap between them. Matches Wix's selection chrome where
       every column reads as its own bordered card. */
    :host ::ng-deep .re__surface section.re-banner.is-selected .re-banner-cell,
    :host ::ng-deep .re__surface section.re-banner.is-selected [data-layout-cell] {
      outline: 1px solid color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 50%, transparent) !important;
      outline-offset: 0 !important;
    }

    /* Pill cell handle — sits ABOVE the cell as a "drag column"
       affordance. Three visual states:
         1. Default / banner-selected, cell not hovered:
              white pill, brand-coloured border + dots, soft shadow.
         2. Cell hover (inside selected banner):
              white pill with light brand tint + brand border + dots.
         3. Selected column (.is-selected-col):
              SOLID brand-coloured pill with WHITE dots — matches
              Wix Ricos's "focused column" state. */
    :host ::ng-deep .re__surface .re-banner-cell-handle {
      position: absolute !important;
      /* Full pill, sits with its bottom edge resting on the column
         outline (top: -height) so it visually "lifts off" the column
         top — half pill above, half pill clipped by the outline line
         from the user's perspective. */
      top: -14px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      width: 36px !important;
      height: 14px !important;
      background: #ffffff !important;
      border: 1px solid var(--ricos-custom-settings-action-color, #32acc1) !important;
      border-radius: 999px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: grab !important;
      z-index: 6 !important;
      color: var(--ricos-custom-settings-action-color, #32acc1) !important;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12) !important;
      opacity: 0 !important;
      transition: opacity 120ms ease, transform 120ms ease,
                  background-color 120ms ease, color 120ms ease !important;
    }
    /* Hover state — light tint of the primary color, dots stay brand.
       :not(.is-selected-col) means hovering an already-selected column
       does NOT change the handle's appearance; the solid focused
       state below stays put. */
    :host ::ng-deep .re__surface .re-banner.is-selected .re-banner-cell:not(.is-selected-col):hover .re-banner-cell-handle {
      background: color-mix(in srgb, var(--ricos-custom-settings-action-color, #32acc1) 8%, #ffffff) !important;
      transform: translateX(-50%) scale(1.05) !important;
    }
    /* Focused state — solid primary color with white dots. */
    :host ::ng-deep .re__surface .re-banner-cell.is-selected-col .re-banner-cell-handle {
      background: var(--ricos-custom-settings-action-color, #32acc1) !important;
      color: #ffffff !important;
      border-color: var(--ricos-custom-settings-action-color, #32acc1) !important;
    }

    /* ── Column divider — sits between the two cells inside
       .re-banner-inner. A thin, full-height invisible hit-zone that
       reveals a teal grab-pill on hover/drag. The divider's left%
       comes from --re-banner-col-divider-left (written on drag) and
       on initial paint from the .re-banner-inner ratio. */
    :host ::ng-deep .re__surface .re-banner-col-divider {
      position: absolute !important;
      top: 0 !important;
      bottom: 0 !important;
      width: 14px !important;
      transform: translateX(-50%) !important;
      z-index: 4 !important;
      cursor: ew-resize !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      opacity: 0 !important;
      transition: opacity 120ms ease !important;
      left: var(--re-banner-col-divider-left, 50%) !important;
    }
    :host ::ng-deep .re__surface .re-banner-col-divider::before {
      content: '' !important;
      position: absolute !important;
      top: 50% !important;
      left: 50% !important;
      width: 4px !important;
      height: 40px !important;
      background: #32acc1 !important;
      border: 1.5px solid #fff !important;
      border-radius: 999px !important;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.2) !important;
      transform: translate(-50%, -50%) !important;
      transition: transform 120ms ease !important;
    }
    :host ::ng-deep .re__surface .re-banner-col-divider:hover::before {
      transform: translate(-50%, -50%) scaleY(1.15) !important;
    }
    :host ::ng-deep .re__surface section.re-banner.is-selected .re-banner-col-divider {
      opacity: 1 !important;
    }
    :host ::ng-deep .re__surface .re-banner-col-divider.is-dragging::before {
      transform: translate(-50%, -50%) scaleY(1.2) !important;
    }
    /* Snap-highlight — when the cursor lands on a smart-guide ratio
       (1/4, 1/3, 1/2, 2/3, 3/4), the inner bar pops to the primary
       brand color so the user knows the snap fired. */
    :host ::ng-deep .re__surface .re-banner-col-divider.is-snapped::before {
      background: var(--ricos-custom-action-color, #116DFF) !important;
      transform: translate(-50%, -50%) scaleY(1.25) !important;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ricos-custom-action-color, #116DFF) 25%, transparent) !important;
    }
    /* Ratio-label chip — shows the current column percentages while
       dragging. Sits just above the divider so it doesn't overlap
       the dragged bar; styled to match the Ricos dark tooltip look. */
    :host ::ng-deep .re__surface .re-banner-col-divider-label {
      position: absolute !important;
      bottom: calc(100% + 8px) !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      padding: 4px 8px !important;
      background: #162D3D !important;
      color: #ffffff !important;
      font: 500 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      white-space: nowrap !important;
      border-radius: 4px !important;
      pointer-events: none !important;
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2) !important;
      z-index: 10 !important;
    }

    :host ::ng-deep .re__surface .re-banner-cell-handle:hover { transform: translateX(-50%) scale(1.08); }
    :host ::ng-deep .re__surface .re-banner-cell-handle:active { cursor: grabbing !important; }
    :host ::ng-deep .re__surface .re-banner-cell.is-selected-col .re-banner-cell-handle,
    :host ::ng-deep .re__surface .re-banner.is-selected .re-banner-cell:hover .re-banner-cell-handle,
    :host ::ng-deep .re__surface section.re-banner.is-selected .re-banner-cell-handle {
      opacity: 1 !important;
    }

    /* ── Legacy compat shim — keeps figure.re-banner +
       .re-banner-overlay / .re-banner-col content rendering until
       it's re-saved into the new shape. Maps the old CSS vars onto
       the new ones so persisted dataset attrs still hit the right
       layers. */
    :host ::ng-deep .re__surface figure.re-embed-figure.re-banner {
      position: relative !important;
      width: 100% !important;
      max-width: 100% !important;
      aspect-ratio: 16 / 5 !important;
      min-height: 180px !important;
      margin-block: var(--re-banner-margin, 50px) !important;
      overflow: hidden !important;
      background-color: var(--re-banner-bg, transparent) !important;
    }
    :host ::ng-deep .re__surface figure.re-embed-figure.re-banner > img,
    :host ::ng-deep .re__surface figure.re-embed-figure.re-banner > .re-embed-video { display: none !important; }
    :host ::ng-deep .re__surface figure.re-embed-figure.re-banner::before {
      content: '' !important;
      position: absolute !important;
      inset: 0 !important;
      background-image: var(--re-banner-bg-image, none) !important;
      background-size: var(--re-banner-bg-size, cover) !important;
      background-position: var(--re-banner-bg-pos, center) !important;
      background-repeat: var(--re-banner-bg-repeat, no-repeat) !important;
      opacity: var(--re-banner-img-opacity, 1) !important;
      pointer-events: none !important;
      z-index: 0 !important;
    }
    :host ::ng-deep .re__surface figure.re-embed-figure.re-banner::after {
      content: '' !important;
      position: absolute !important;
      inset: 0 !important;
      background: var(--re-banner-overlay, transparent) !important;
      pointer-events: none !important;
      z-index: 1 !important;
    }
    :host ::ng-deep .re__surface .re-banner .re-banner-overlay {
      position: relative !important;
      z-index: 2 !important;
      display: grid !important;
      grid-template-columns: repeat(var(--re-banner-cols, 1), 1fr) !important;
      gap: var(--re-banner-gap, 20px) !important;
      padding-top:    var(--re-banner-pad-top,    var(--re-banner-pad-y, 18px)) !important;
      padding-right:  var(--re-banner-pad-right,  var(--re-banner-pad-x, 0px))  !important;
      padding-bottom: var(--re-banner-pad-bottom, var(--re-banner-pad-y, 18px)) !important;
      padding-left:   var(--re-banner-pad-left,   var(--re-banner-pad-x, 0px))  !important;
      width: 100% !important;
      align-content: start !important;
      box-sizing: border-box !important;
    }
    :host ::ng-deep .re__surface .re-banner.re-banner-vtop .re-banner-overlay { align-content: start  !important; }
    :host ::ng-deep .re__surface .re-banner.re-banner-vmid .re-banner-overlay { align-content: center !important; }
    :host ::ng-deep .re__surface .re-banner.re-banner-vbot .re-banner-overlay { align-content: end    !important; }
    :host ::ng-deep .re__surface .re-banner .re-banner-col {
      position: relative !important;
      padding: 12px 16px !important;
      min-height: 60px !important;
      background: var(--re-col-bg, transparent) !important;
      border: var(--re-col-border-w, 0px) solid var(--re-col-border, transparent) !important;
      border-radius: var(--re-col-radius, 0px) !important;
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
    /* In bare mode the editor flows with the document body —
       scrolling happens at the page level, so neither the surface
       wrap nor the contenteditable surface gets its own scrollbar. */
    .re--bare .re__surfaceWrap { flex: 0 0 auto; }
    .re--bare .re__surface {
      flex: 0 0 auto !important;
      overflow: visible !important;
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

    /* Inline links default to the editor's teal + underline. Button
       anchors (.re-btn-block) opt out — they style themselves via
       inline styles set by insertButton() + the Button settings
       panel, so the !important on link colour was overriding the
       user's chosen text color. */
    :host ::ng-deep .re__surface a:not(.re-btn-block) { color: #32acc1 !important; text-decoration: underline !important; }
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

    /* .re-btn-block — picks up inline styles set by insertButton()
       (background-color, color, padding, border-radius, font-size).
       The class only contributes layout (inline-block, margin,
       font-weight, no underline) so the Button settings panel can
       freely override colour / radius / padding via element.style.* */
    :host ::ng-deep .re__surface .re-btn-block {
      display: inline-block;
      margin: 8px 0;
      font-weight: 600;
      text-decoration: none;
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
  /** When true, the Content AI button is rendered at the start of the
   *  toolbar (matching Wix Ricos's order). Click emits `contentAiClick`
   *  so the caller can open its own AI panel. */
  showContentAi  = input<boolean>(false);
  contentAiClick = output<void>();
  /** Fullscreen toggle — pins the editor at `position: fixed; inset: 0;
   *  z-index: 9999` so it covers the whole viewport. Toggled by the
   *  expand-corners button at the top-right of the editor host. */
  isFullscreen = signal<boolean>(false);
  toggleFullscreen(): void { this.isFullscreen.update(v => !v); }
  /** When true, render a built-in title <textarea> above the editable
   *  surface (sits inside `.re-editor-column` above `.re-editor-content`).
   *  Off by default — consumers that already provide their own title
   *  field (e.g. post-composer) leave this off. */
  showTitle      = input<boolean>(false);
  /** Maximum length for the built-in title. Hard-clamped via maxlength
   *  on the textarea. */
  titleMaxLength = input<number>(200);
  /** Two-way bind for the built-in title value. Use [(title)] or
   *  (titleChange) — keeps the field controlled while the textarea
   *  auto-grows. */
  title          = input<string>('');
  titleChange    = output<string>();
  /** Internal mirror of the title input so we can auto-grow the
   *  textarea + show the character counter without forcing the caller
   *  to wire two-way binding. Seeded from the input via effect(). */
  titleValue     = signal<string>('');
  titleFocused   = signal<boolean>(false);
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
  /** Emitted when the user clicks the empty/replace tile inside the
   *  Column-background Image picker. Parent opens its media-library
   *  modal and pipes the picked URL back via `setColBgImage()`. */
  colBgImageClick = output<void>();
  /** Fires when the user clicks an "Add image" placeholder inside a
   *  cell. Hosts can hook this to launch their own media library and
   *  then call `replaceCellImagePlaceholder(el, url)`. If nothing
   *  detaches the placeholder, the editor falls back to a native
   *  file picker. */
  cellImageClick  = output<HTMLElement>();

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

  constructor() {
    // Mirror the [title] input into the internal titleValue signal so
    // the textarea (which binds to titleValue for auto-grow + counter)
    // stays in sync with the caller's bound value without forcing
    // two-way wiring at every consumer.
    effect(() => { this.titleValue.set(this.title() ?? ''); });
  }

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
  addBtn = signal<{ show: boolean; top: number; left: number; lineLeft: number }>(
    { show: false, top: 0, left: 0, lineLeft: 0 },
  );

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
    // Centre on the line. `lineLeft` is the block's left edge in
    // surface coords; the template adds the Ricos inline-start var
    // (-36px default) to position the button to the left of the line.
    const top      = blockRect.top  - surfaceRect.top + (blockRect.height - 26) / 2;
    const lineLeft = blockRect.left - surfaceRect.left;
    const left     = Math.max(2, lineLeft - 32);
    this.addBtn.set({ show: true, top, left, lineLeft });
  }

  private hideAddBtn(): void {
    if (this.addBtn().show) this.addBtn.set({ show: false, top: 0, left: 0, lineLeft: 0 });
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
  /** User-adjusted offsets for the floating toolbars — added on top
   *  of the auto-computed positions so the user can drag a toolbar
   *  out of the way when it covers content. Reset on every fresh
   *  selection so it doesn't follow into the wrong context. */
  columnToolbarOffset      = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  figureToolbarOffset      = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  cellElementToolbarOffset = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Drag offset for the button-settings panel that pops out of the
   *  cell-element toolbar's gear icon. */
  btnPanelOffset           = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Open/close state + drag offset for the button-LINK panel. */
  buttonLinkOpen           = signal<boolean>(false);
  btnLinkOffset            = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Sponsored rel toggle (in addition to the existing nofollow /
   *  noreferrer / new-tab signals that the main toolbar already uses). */
  linkSponsored            = signal<boolean>(false);
  /** "Link to" kind — selects which target picker the panel shows.
   *  - web:     plain URL input (default).
   *  - section: list of headings inside the editable surface.
   *  - page / blog / dynamic: stub picker; the host can populate
   *    via the (linkTargetsRequest) output. */
  linkKind                 = signal<'web' | 'section' | 'page' | 'blog' | 'dynamic'>('web');
  /** Headings found in the editable surface when the user opens the
   *  Section kind — refreshed each time the panel opens or kind
   *  changes. Used as the "Select a section to link to" options. */
  linkSections             = signal<Array<{ id: string; label: string; tag: string }>>([]);

  /** Generic drag handler for a floating toolbar. The toolbar's
   *  base position is signal-driven (auto-tracking the selected
   *  element); this drag adds a user offset that the template adds
   *  on top of the base. The `which` arg picks which offset signal
   *  to mutate. */
  startToolbarDrag(ev: MouseEvent, which: 'column' | 'figure' | 'cellElement' | 'btnPanel' | 'btnLink'): void {
    ev.preventDefault();
    ev.stopPropagation();
    const target = which === 'column'
      ? this.columnToolbarOffset
      : which === 'figure'
        ? this.figureToolbarOffset
        : which === 'cellElement'
          ? this.cellElementToolbarOffset
          : which === 'btnPanel'
            ? this.btnPanelOffset
            : this.btnLinkOffset;
    const startX = ev.clientX;
    const startY = ev.clientY;
    const start  = target();
    const onMove = (m: MouseEvent) => {
      target.set({ x: start.x + (m.clientX - startX), y: start.y + (m.clientY - startY) });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
  columnMenu     = signal<'add' | 'more' | null>(null);

  // ─── Embed-block selection ─────────────────────────────────────────────
  /** Currently-selected `figure.re-embed-figure`, or null when nothing
   *  is selected. Drives the floating selection toolbar.
   *
   *  Two shapes are recognised as "banners" today (see `isBannerEl`):
   *
   *    1. Legacy:   `<figure class="re-banner">`   — kept for content
   *                 already saved in this shape; new banners are no
   *                 longer created as figures.
   *    2. Current:  `<section class="re-banner">` — semantic landmark,
   *                 columns are real `.re-banner-col` children rather
   *                 than CSS-grid pseudo-columns inside a figure.
   *
   *  All banner data lives on the root element as `data-*` attrs (kind,
   *  colour, gradient, image, opacity, columns, gap, padding, valign,
   *  v-margin). The data shape is identical between the two — only the
   *  outer tag differs — so the read path can be polymorphic. */
  selectedFigure = signal<HTMLElement | null>(null);

  /** True if `el` is either banner shape — drop-in replacement for
   *  ad-hoc `classList.contains('re-banner')` checks scattered through
   *  the read path. Lives as a static so it's callable from places that
   *  don't have a component instance handy (e.g. parse helpers). */
  static isBannerEl(el: HTMLElement | null | undefined): boolean {
    return !!el && el.classList.contains('re-banner');
  }

  /** True only for the new `<section>`-based banner. Used by code paths
   *  that need to know whether they're operating on a structural
   *  landmark vs the legacy figure (mostly: column-children iteration,
   *  since sections hold real `.re-banner-col` children while figure
   *  banners use CSS-grid placement inside the figure). */
  static isBannerSection(el: HTMLElement | null | undefined): boolean {
    return !!el && el.tagName === 'SECTION' && el.classList.contains('re-banner');
  }
  figMenu        = signal<'size' | 'align' | 'link' | 'settings' | 'design' | 'valign' | 'more' | null>(null);

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
  bannerVAlign = signal<'top' | 'middle' | 'bottom'>('middle');

  // ─── Banner Layout-section panel state ───
  bannerBgShow      = signal<boolean>(true);
  bannerBgKind      = signal<'color' | 'gradient' | 'image'>('color');
  bannerBgColor     = signal<string>('#ffffff');
  bannerBgOpacity   = signal<number>(100);
  bannerBgGradient  = signal<string>('linear-gradient(180deg, #32acc1 0%, #ffffff 100%)');

  /** Whether the floating Colors panel popover is open. */
  bgPanelOpen = signal<boolean>(false);
  /** Whichever tab the user last interacted with in the Colors panel —
   *  drives both the panel's initial tab the next time it opens and the
   *  background kind we revert to when an image is removed. */
  bgPanelMode = signal<'color' | 'gradient'>('color');

  /** Which colour-only target (column fill, column border, section
   *  overlay, design border) is currently editing in the popover. `null`
   *  closes the popover. One shared overlay handles all four — the
   *  target id routes the emitted hex to the right signal. */
  colorPanelTarget = signal<'colFill' | 'colBorder' | 'sectionOverlay' | 'designBorder' | 'colOverlay' | 'btnFill' | 'btnText' | 'btnBorder' | 'colOvFill' | 'colOvBorder' | null>(null);

  // ─── Per-column Design overrides ────────────────────────────────────
  /** Whether the per-column design popover is open. Anchored to the
   *  Design button on the column toolbar. Edits inline styles on the
   *  selected `.re-banner-cell` so the override applies only to that
   *  column, not the banner-wide defaults. */
  colDesignOpen = signal<boolean>(false);
  colOvFillColor    = signal<string>('#ffffff');
  colOvFillOpacity  = signal<number>(0);
  colOvBorderColor  = signal<string>('#000000');
  colOvBorderOpacity = signal<number>(100);
  colOvBorderWidth  = signal<number>(0);
  colOvCornerRadius = signal<number>(0);

  /** Hex value to show in the colour-only ColorsPanel — picks the
   *  signal that matches the active target. */
  colorPanelValue = computed<string>(() => {
    switch (this.colorPanelTarget()) {
      case 'colFill':         return this.colFillColor();
      case 'colBorder':       return this.colBorderColor();
      case 'sectionOverlay':  return this.sectionOverlayColor();
      case 'designBorder':    return this.designBorderColor();
      case 'colOverlay':      return this.colOverlayColor();
      case 'btnFill':         return this.btnFillColor();
      case 'btnText':         return this.btnTextColor();
      case 'btnBorder':       return this.btnBorderColor();
      case 'colOvFill':       return this.colOvFillColor();
      case 'colOvBorder':     return this.colOvBorderColor();
      default:                return '#000000';
    }
  });

  /** Route the panel's emit back into whichever setter the active
   *  target wants. Defined as a method (not a closure) so the template
   *  binding is cheap. */
  onColorPanelChange(v: string): void {
    switch (this.colorPanelTarget()) {
      case 'colFill':         this.setColFillColor(v); break;
      case 'colBorder':       this.setColBorderColor(v); break;
      case 'sectionOverlay':  this.setSectionOverlayColor(v); break;
      case 'designBorder':    this.onDesignBorderColor(v); break;
      case 'colOverlay':      this.setColOverlayColor(v); break;
      case 'btnFill':         this.setBtnFillColor(v); break;
      case 'btnText':         this.setBtnTextColor(v); break;
      case 'btnBorder':       this.setBtnBorderColor(v); break;
      case 'colOvFill':       this.setColOvFillColor(v); break;
      case 'colOvBorder':     this.setColOvBorderColor(v); break;
    }
  }

  /** Value pushed into the ColorsPanel via ngModel — either the current
   *  solid colour or the gradient CSS string, picked by `bgPanelMode`. */
  bgPanelValue = computed<string>(() =>
    this.bgPanelMode() === 'gradient' ? this.bannerBgGradient() : this.bannerBgColor(),
  );

  /** What the trigger swatch chip in the panel shows — mirrors the
   *  current colour/gradient choice (NOT the image, which has its own
   *  preview tile right below). */
  bgTriggerPreview = computed<string>(() =>
    this.bgPanelMode() === 'gradient'
      ? this.bannerBgGradient()
      : this.composeRgba(this.bannerBgColor(), this.bannerBgOpacity()),
  );
  bannerBgImage     = signal<string>('');
  bannerColumns     = signal<1 | 2>(1);
  /** Ratio of the first column's width over the inner container's
   *  total width, in the range [0.15, 0.85]. 0.5 = equal-width columns.
   *  Driven by dragging the `.re-banner-col-divider` between the two
   *  cells. Persisted to `dataset['colRatio']`. */
  bannerColRatio    = signal<number>(0.5);
  bannerColGap      = signal<number>(20);
  bannerColPadX     = signal<number>(0);
  // Per-edge padding — added on top of the legacy X / Y values so the
  // panel can expose 4 individual chips (top/right/bottom/left).
  // Loaded from data-padTop/padRight/padBottom/padLeft when present;
  // otherwise seeded from padX (left + right) and padY (top + bottom).
  bannerColPadTop    = signal<number>(0);
  bannerColPadRight  = signal<number>(0);
  bannerColPadBottom = signal<number>(0);
  bannerColPadLeft   = signal<number>(0);
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
  /** Per-column background image URL. Empty when no image is set —
   *  the picker shows an empty "+" tile in that state. */
  colBgImage       = signal<string>('');
  /** Column image display controls — mirror of the section-background
   *  set so the per-column image gets the same opacity / overlay /
   *  scaling / position knobs. */
  colImageOpacity   = signal<number>(100);
  colOverlayColor   = signal<string>('#000000');
  colOverlayOpacity = signal<number>(0);
  colImageScaling   = signal<'cover' | 'contain' | 'fill' | 'tile'>('cover');
  colImagePosition  = signal<string>('5');
  colFillColor     = signal<string>('#ffffff');
  colFillOpacity   = signal<number>(0);
  colBorderColor   = signal<string>('#000000');
  colBorderOpacity = signal<number>(0);
  colBorderWidth   = signal<number>(0);
  colCornerRadius  = signal<number>(0);
  /** When true, the column stretches to fill the banner's full
   *  height — cells use the resizer's available height instead of
   *  auto-sizing to content. Toggled from the Column-design panel. */
  colFullHeight    = signal<boolean>(false);
  /** Per-cell content alignment — driven by the column toolbar.
   *  vertical maps to the cell's flex justify-content; horizontal
   *  maps to text-align. Both are read from / written to the
   *  selected cell so different columns can have different alignment. */
  cellVAlign = signal<'top' | 'middle' | 'bottom'>('top');
  cellHAlign = signal<'left' | 'center' | 'right'>('left');

  // ─── Section background image extras ───
  sectionImageOpacity = signal<number>(100);
  sectionOverlayColor = signal<string>('#000000');
  sectionOverlayOpacity = signal<number>(0);
  sectionImageScaling = signal<'cover' | 'contain' | 'fill' | 'tile'>('cover');
  sectionImagePosition = signal<string>('5'); // 1-9, where 5 is center.

  /** Items + display/compare helpers for the SearchDropdown that
   *  replaces the native <select> for Image scaling. Kept on the
   *  class (not inline in the template) so the array reference
   *  stays stable across change detection. */
  /** Options for the "Link to" picker in the cell-button Link panel.
   *  Matches the Wix kind list: web / section / page / blog post /
   *  dynamic page. Only web + section are fully wired in-editor; the
   *  others stub out to "No options available" until the host
   *  populates them. */
  readonly linkKindOptions = [
    { id: 'web',     label: 'Web address' },
    { id: 'section', label: 'Section' },
    { id: 'page',    label: 'Page' },
    { id: 'blog',    label: 'Blog post' },
    { id: 'dynamic', label: 'Dynamic page' },
  ];
  linkKindDisplay = (v: any): string => v?.label ?? this.linkKindOptions.find(o => o.id === v)?.label ?? '';
  linkKindCompare = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  linkKindToValue = (i: { id: string; label: string }) => i.id;

  readonly imageScalingOptions = [
    { id: 'cover',   label: 'Cover'   },
    { id: 'contain', label: 'Contain' },
    { id: 'fill',    label: 'Fill'    },
    { id: 'tile',    label: 'Tile'    },
  ];
  scalingDisplay = (v: any): string => v?.label ?? this.imageScalingOptions.find(o => o.id === v)?.label ?? v ?? '';
  scalingCompare = (a: any, b: any) => (a?.id ?? a) === (b?.id ?? b);
  scalingToValue = (i: { id: string; label: string }) => i.id;

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
    // Default position: snap to the right edge of the editor surface,
    // ~16px gutter from the top. The panel is `position: fixed`, so we
    // compute the initial top/left in viewport coordinates from the
    // surface's bounding rect (already viewport-relative).
    if (!this.figPanelPos()) {
      const surface = this.editable?.nativeElement;
      const PANEL_W = 300;
      if (surface) {
        const rect = surface.getBoundingClientRect();
        const left = Math.min(window.innerWidth - PANEL_W - 16, Math.max(16, rect.right - PANEL_W));
        const top  = Math.max(16, rect.top + 16);
        this.figPanelPos.set({ top, left });
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
    // Close any open slider popovers before the drag starts. The
    // sliders are anchored to a chip's bounding rect at focus time;
    // once the panel moves, that anchor goes stale and the popover
    // floats in space. Blurring the active element flips the row's
    // :focus-within off so the slider hides itself.
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === 'function' && active.closest('.re__figPanel')) {
      active.blur();
    }
    this.dragOffset = { x: ev.clientX - pos.left, y: ev.clientY - pos.top };
    document.addEventListener('mousemove', this.onPanelDrag);
    document.addEventListener('mouseup', this.onPanelDragEnd);
  }
  private onPanelDrag = (ev: MouseEvent): void => {
    if (!this.dragOffset) return;
    // Clamp to the VIEWPORT (not the editor surface) so the panel can
    // be dragged anywhere on the page. The 20px right / 60px bottom
    // insets ensure the close button stays clickable even when the
    // user drags into the screen corners.
    const PANEL_W = 300;
    const HEADER_MIN_VISIBLE = 60;
    const left = Math.max(0, Math.min(window.innerWidth - 20, ev.clientX - this.dragOffset.x));
    const top  = Math.max(0, Math.min(window.innerHeight - HEADER_MIN_VISIBLE, ev.clientY - this.dragOffset.y));
    this.figPanelPos.set({ top, left });
    void PANEL_W;
  };
  private onPanelDragEnd = (): void => {
    this.dragOffset = null;
    document.removeEventListener('mousemove', this.onPanelDrag);
    document.removeEventListener('mouseup', this.onPanelDragEnd);
  };
  figureToolbar  = signal<{ show: boolean; top: number; left: number }>({ show: false, top: 0, left: 0 });

  /** Per-element contextual toolbar — appears above a clicked
   *  button/anchor, image, or text block INSIDE a banner cell.
   *  Different action set per element type. Cleared when the user
   *  clicks elsewhere or the banner deselects. */
  cellElementToolbar = signal<{ type: 'button' | 'image' | 'text' | null; top: number; left: number }>({ type: null, top: 0, left: 0 });
  private cellElementRef: HTMLElement | null = null;

  /** Open/close state for the button-settings popover that pops out
   *  of the cell-element toolbar's gear icon when a button is picked. */
  buttonSettingsOpen = signal<boolean>(false);
  /** Open state for the per-element toolbar's 3-dot overflow menu
   *  (Cut / Copy / Duplicate / Delete). */
  cellElementMoreOpen = signal<boolean>(false);
  /** Top-level tab inside the popover — Settings (text only) or
   *  Design (size + colors + border + radius). */
  btnPanelTab = signal<'settings' | 'design'>('settings');
  /** Mirror signals for the picked button's properties — bound by the
   *  popover's inputs. Read/written via syncButtonState() and the
   *  set* handlers below. */
  btnText         = signal<string>('');
  btnFillColor    = signal<string>('#0f172a');
  btnFillOpacity  = signal<number>(100);
  btnTextColor    = signal<string>('#ffffff');
  btnTextOpacity  = signal<number>(100);
  btnCornerRadius = signal<number>(4);
  btnBorderWidth  = signal<number>(0);
  btnBorderColor  = signal<string>('#0f172a');
  btnBorderOpacity= signal<number>(100);
  /** Button size preset — small / medium / large. Drives padding +
   *  font-size on the picked button. */
  btnSize        = signal<'small' | 'medium' | 'large'>('medium');
  /** Open/close state for the alignment dropdown that lives next to
   *  the button-settings gear in the cell-element toolbar. */
  btnAlignOpen   = signal<boolean>(false);
  /** Horizontal alignment of the button within its parent flow.
   *  Maps to the parent block's text-align (since buttons are
   *  inline-block by default in our presets). */
  btnAlign       = signal<'left' | 'center' | 'right'>('left');
  /** Wrap text toggle in the alignment dropdown — when true, the
   *  button uses `display: inline-block` so text flows around it
   *  (the default for buttons inside paragraphs). When false, the
   *  button becomes `display: block` so it occupies its own line. */
  btnWrap        = signal<boolean>(true);

  /** Read the picked button's inline styles into the mirror signals
   *  so the popover's inputs show the button's actual current values. */
  private syncButtonState(): void {
    const el = this.cellElementRef as HTMLElement | null;
    if (!el) return;
    this.btnText.set(el.textContent?.trim() ?? '');
    const cs = getComputedStyle(el);
    // Use computed style for fill/colour so user-visible values match
    // even when set via a CSS class.
    this.btnFillColor.set(rgbToHex(cs.backgroundColor) || '#0f172a');
    this.btnFillOpacity.set(Math.round(rgbaAlphaPct(cs.backgroundColor)));
    this.btnTextColor.set(rgbToHex(cs.color) || '#ffffff');
    this.btnTextOpacity.set(Math.round(rgbaAlphaPct(cs.color)));
    const radius = parseInt(cs.borderRadius, 10);
    this.btnCornerRadius.set(Number.isFinite(radius) ? radius : 4);
    const bw = parseInt(cs.borderTopWidth, 10);
    this.btnBorderWidth.set(Number.isFinite(bw) ? bw : 0);
    this.btnBorderColor.set(rgbToHex(cs.borderTopColor) || '#0f172a');
    // Size — infer from font-size since the preset map writes that.
    const fs = parseInt(cs.fontSize, 10);
    this.btnSize.set(fs <= 12 ? 'small' : fs >= 16 ? 'large' : 'medium');
    // Alignment — read the parent block's text-align.
    const parent = el.parentElement;
    const ta = parent ? getComputedStyle(parent).textAlign : '';
    this.btnAlign.set(ta === 'center' ? 'center' : ta === 'right' ? 'right' : 'left');
    // Wrap text — inline-block flows with surrounding text;
    // block forces its own line.
    const disp = cs.display;
    this.btnWrap.set(disp !== 'block');
  }

  openButtonSettings(): void {
    this.syncButtonState();
    // Mutually exclusive — close the Link panel so the two never
    // render on top of each other at the same coords.
    this.buttonLinkOpen.set(false);
    this.buttonSettingsOpen.set(true);
  }
  closeButtonSettings(): void { this.buttonSettingsOpen.set(false); }

  /** Mutate the picked button's text content. Preserves child anchor
   *  structure: if the button is an <a>, the new text replaces its
   *  inner text but keeps existing icon spans. */
  setBtnText(v: string): void {
    this.btnText.set(v);
    const el = this.cellElementRef; if (!el) return;
    // Replace text node children only; keep nested icons/spans.
    const children = Array.from(el.childNodes);
    const textNode = children.find((n) => n.nodeType === Node.TEXT_NODE) as Text | null;
    if (textNode) { textNode.textContent = v; }
    else el.textContent = v;
    this.emit();
  }
  composeRgba(hex: string, opacityPct: number): string {
    const { r, g, b } = hexToRgb(hex);
    const a = Math.max(0, Math.min(1, opacityPct / 100));
    return `rgba(${r},${g},${b},${a})`;
  }
  private applyBtnFill(): void {
    if (this.cellElementRef) (this.cellElementRef as HTMLElement).style.backgroundColor = this.composeRgba(this.btnFillColor(), this.btnFillOpacity());
  }
  private applyBtnText(): void {
    if (this.cellElementRef) (this.cellElementRef as HTMLElement).style.color = this.composeRgba(this.btnTextColor(), this.btnTextOpacity());
  }
  setBtnFillColor(v: string): void {
    this.btnFillColor.set(v);
    this.applyBtnFill();
    this.emit();
  }
  setBtnFillOpacity(v: number): void {
    this.btnFillOpacity.set(Math.max(0, Math.min(100, Number(v) || 0)));
    this.applyBtnFill();
    this.emit();
  }
  setBtnTextColor(v: string): void {
    this.btnTextColor.set(v);
    this.applyBtnText();
    this.emit();
  }
  setBtnTextOpacity(v: number): void {
    this.btnTextOpacity.set(Math.max(0, Math.min(100, Number(v) || 0)));
    this.applyBtnText();
    this.emit();
  }
  setBtnBorderOpacity(v: number): void {
    this.btnBorderOpacity.set(Math.max(0, Math.min(100, Number(v) || 0)));
    const el = this.cellElementRef as HTMLElement | null;
    if (el && this.btnBorderWidth() > 0) {
      el.style.borderColor = this.composeRgba(this.btnBorderColor(), this.btnBorderOpacity());
    }
    this.emit();
  }
  setBtnCornerRadius(v: number): void {
    const r = Math.max(0, Math.min(200, Number(v) || 0));
    this.btnCornerRadius.set(r);
    if (this.cellElementRef) (this.cellElementRef as HTMLElement).style.borderRadius = `${r}px`;
    this.emit();
  }
  setBtnBorderWidth(v: number): void {
    const w = Math.max(0, Math.min(32, Number(v) || 0));
    this.btnBorderWidth.set(w);
    const el = this.cellElementRef as HTMLElement | null; if (!el) return;
    el.style.borderWidth = `${w}px`;
    el.style.borderStyle = w > 0 ? 'solid' : '';
    if (w > 0) el.style.borderColor = this.composeRgba(this.btnBorderColor(), this.btnBorderOpacity());
    this.emit();
  }
  setBtnBorderColor(v: string): void {
    this.btnBorderColor.set(v);
    const el = this.cellElementRef as HTMLElement | null;
    if (el && this.btnBorderWidth() > 0) {
      el.style.borderColor = this.composeRgba(this.btnBorderColor(), this.btnBorderOpacity());
    }
    this.emit();
  }
  /** Button size preset — writes inline padding + font-size so the
   *  preset survives any later inline-style edits the user makes. */
  setBtnSize(v: 'small' | 'medium' | 'large'): void {
    this.btnSize.set(v);
    const el = this.cellElementRef as HTMLElement | null; if (!el) return;
    const map: Record<typeof v, { padding: string; font: string }> = {
      small:  { padding: '6px 14px',  font: '12px' },
      medium: { padding: '8px 20px',  font: '14px' },
      large:  { padding: '12px 28px', font: '16px' },
    };
    el.style.padding  = map[v].padding;
    el.style.fontSize = map[v].font;
    this.emit();
  }
  /** Set the horizontal alignment of the picked button within its
   *  parent block by writing text-align on the parent. Closes the
   *  alignment dropdown after the choice. */
  setBtnAlign(v: 'left' | 'center' | 'right'): void {
    this.btnAlign.set(v);
    const el = this.cellElementRef as HTMLElement | null;
    const parent = el?.parentElement;
    if (parent) parent.style.textAlign = v;
    this.btnAlignOpen.set(false);
    this.emit();
  }
  toggleBtnAlign(): void { this.btnAlignOpen.update((v) => !v); }
  /** Toggle wrap-text behaviour on the picked button. inline-block
   *  (default) lets text flow around it; block forces it onto its
   *  own line — useful for hero-style centered buttons. */
  setBtnWrap(v: boolean): void {
    this.btnWrap.set(v);
    const el = this.cellElementRef as HTMLElement | null; if (!el) return;
    el.style.display = v ? 'inline-block' : 'block';
    this.emit();
  }

  /** Compute toolbar position above the given element and set the
   *  signal so the floating chrome renders. Also tags the element
   *  with `.re-cell-elem-active` so CSS can paint a selection ring
   *  around it — without that, users have no visual cue for which
   *  element the floating toolbar is acting on. */
  private showCellElementToolbar(type: 'button' | 'image' | 'text', el: HTMLElement): void {
    const surface = this.editable?.nativeElement;
    if (!surface) return;
    // Strip the active class off any previously-picked element before
    // moving the toolbar to the new one.
    if (this.cellElementRef && this.cellElementRef !== el) {
      this.cellElementRef.classList.remove('re-cell-elem-active');
      this.cellElementRef.removeAttribute('draggable');
    }
    el.classList.add('re-cell-elem-active');
    // Make the picked element draggable so the user can move it
    // elsewhere in the document. The element-level dragstart wires
    // up a custom data payload so the editable surface's drop
    // handler can move the actual DOM node (not just dump its text).
    this.attachCellElementDrag(el);
    const sr = surface.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    this.cellElementRef = el;
    // Preferred: 40px above the element. Fallback: below the element
    // if there isn't enough room above (e.g. a button parked near the
    // top of the surface would land behind the static editor toolbar).
    const toolbarH = 36;
    const aboveTop = er.top - sr.top - toolbarH - 4;
    const top = aboveTop >= 8 ? aboveTop : (er.bottom - sr.top + 8);
    this.cellElementToolbar.set({
      type,
      top,
      left: er.left - sr.left + er.width / 2,
    });
  }
  /** Per-element drag wiring — tracks which elements have already
   *  been wired so we don't double-bind dragstart listeners every
   *  time the user re-picks the same element. */
  private wiredDragHandlers = new WeakSet<HTMLElement>();
  /** Element currently being dragged via the cell-element drag flow. */
  private draggingCellElement: HTMLElement | null = null;

  /** Wire native HTML5 drag on a picked cell-element so the user can
   *  move it elsewhere in the document. The actual DOM move happens
   *  on the editable's drop handler (see onEditableDragOver / Drop). */
  private attachCellElementDrag(el: HTMLElement): void {
    el.setAttribute('draggable', 'true');
    if (this.wiredDragHandlers.has(el)) return;
    this.wiredDragHandlers.add(el);
    el.addEventListener('dragstart', (ev) => {
      this.draggingCellElement = el;
      el.classList.add('re-cell-elem-dragging');
      // Set a payload so the browser treats it as a real drag — we
      // ignore the value and move the live element on drop.
      ev.dataTransfer?.setData('text/plain', 're-cell-elem');
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('re-cell-elem-dragging');
      this.draggingCellElement = null;
      this.removeDropIndicator();
    });
  }

  /** Drop indicator — a thin teal line that shows between blocks
   *  during a drag, telling the user where the element will land. */
  private dropIndicator: HTMLElement | null = null;
  private ensureDropIndicator(): HTMLElement {
    if (!this.dropIndicator) {
      const el = document.createElement('div');
      el.className = 're-drop-indicator';
      el.style.cssText = 'position:absolute;height:3px;background:var(--ricos-custom-settings-action-color,#32acc1);border-radius:2px;pointer-events:none;z-index:30;transition:opacity .08s ease;';
      const surfaceWrap = this.editable?.nativeElement?.parentElement;
      surfaceWrap?.appendChild(el);
      this.dropIndicator = el;
    }
    return this.dropIndicator;
  }
  private removeDropIndicator(): void {
    if (this.dropIndicator) {
      this.dropIndicator.remove();
      this.dropIndicator = null;
    }
  }

  /** Walk the editable for the nearest block-level child whose top
   *  edge is closest to the drop y. Returns { target, insertBefore }
   *  where insertBefore=true means drop above target. */
  private resolveDropTarget(y: number): { target: HTMLElement; before: boolean } | null {
    const editable = this.editable?.nativeElement;
    if (!editable) return null;
    const blocks = Array.from(editable.querySelectorAll<HTMLElement>(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > blockquote, :scope > ul, :scope > ol, :scope > section, :scope > figure, :scope > div, :scope > pre'));
    if (blocks.length === 0) return null;
    let best: { target: HTMLElement; before: boolean; dist: number } | null = null;
    for (const b of blocks) {
      const r = b.getBoundingClientRect();
      const midpoint = r.top + r.height / 2;
      const dist = Math.abs(midpoint - y);
      const before = y < midpoint;
      if (!best || dist < best.dist) best = { target: b, before, dist };
    }
    return best ? { target: best.target, before: best.before } : null;
  }

  /** Editable dragover — show the drop indicator + allow drop. */
  onEditableDragOver(ev: DragEvent): void {
    if (!this.draggingCellElement) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    const hit = this.resolveDropTarget(ev.clientY);
    if (!hit) { this.removeDropIndicator(); return; }
    const indicator = this.ensureDropIndicator();
    const surface = this.editable!.nativeElement;
    const sr = surface.getBoundingClientRect();
    const r = hit.target.getBoundingClientRect();
    const top = (hit.before ? r.top : r.bottom) - sr.top;
    const left = r.left - sr.left;
    indicator.style.top  = `${top - 1}px`;
    indicator.style.left = `${left}px`;
    indicator.style.width = `${r.width}px`;
  }

  /** Editable drop — move the dragged element to the drop position. */
  onEditableDrop(ev: DragEvent): void {
    if (!this.draggingCellElement) return;
    ev.preventDefault();
    const el = this.draggingCellElement;
    const hit = this.resolveDropTarget(ev.clientY);
    if (hit && hit.target !== el && !el.contains(hit.target)) {
      // For block-level elements, move the element itself. For
      // inline elements (button/image), move their nearest block
      // ancestor (a <p> wrapping a button moves as one chunk).
      const moveNode = el.matches('a, button, img')
        ? (el.closest('p, h1, h2, h3, h4, h5, h6, blockquote, li, div') as HTMLElement | null) ?? el
        : el;
      const parent = hit.target.parentNode;
      if (parent) {
        if (hit.before) parent.insertBefore(moveNode, hit.target);
        else            parent.insertBefore(moveNode, hit.target.nextSibling);
        this.emit();
      }
    }
    this.removeDropIndicator();
    this.draggingCellElement = null;
    el.classList.remove('re-cell-elem-dragging');
  }

  private clearCellElementToolbar(): void {
    if (this.cellElementRef) {
      this.cellElementRef.classList.remove('re-cell-elem-active');
      this.cellElementRef.removeAttribute('draggable');
    }
    this.cellElementRef = null;
    this.cellElementToolbar.set({ type: null, top: 0, left: 0 });
    // Reset user drag offset so the next picked element starts at the
    // auto-tracked position above it rather than carrying over the
    // previous element's manual nudge.
    this.cellElementToolbarOffset.set({ x: 0, y: 0 });
    // Close any open per-element popover (currently only the button
    // settings panel uses one) so it doesn't linger on an unpicked
    // element.
    this.buttonSettingsOpen.set(false);
    this.btnAlignOpen.set(false);
    this.btnPanelOffset.set({ x: 0, y: 0 });
    this.buttonLinkOpen.set(false);
    this.btnLinkOffset.set({ x: 0, y: 0 });
  }

  /** Action: open the Link panel for the picked button. Seeds the
   *  existing link-state signals (url + new-tab + rel toggles) from
   *  the button's current attributes, then reveals the popover. */
  editCellButtonLink(): void {
    const el = this.cellElementRef as HTMLAnchorElement | HTMLButtonElement | null;
    if (!el) return;
    if (el.tagName === 'A') {
      const a = el as HTMLAnchorElement;
      const href = a.getAttribute('href') ?? '';
      this.linkUrl.set(href);
      this.linkNewTab.set(a.target === '_blank');
      const rel = (a.getAttribute('rel') ?? '').split(/\s+/);
      this.linkNoReferrer.set(rel.includes('noreferrer'));
      this.linkNoFollow.set(rel.includes('nofollow'));
      this.linkSponsored.set(rel.includes('sponsored'));
      // Kind round-trip: prefer the explicit data-link-kind written
      // on save (so Page / Blog / Dynamic survive a reload — those
      // have empty hrefs and would otherwise infer to Web). Fall
      // back to href-shape inference for older buttons that don't
      // carry the attribute yet.
      const savedKind = a.getAttribute('data-link-kind');
      if (savedKind === 'web' || savedKind === 'section' || savedKind === 'page' || savedKind === 'blog' || savedKind === 'dynamic') {
        this.linkKind.set(savedKind);
      } else {
        this.linkKind.set((href.length > 1 && href.startsWith('#')) ? 'section' : 'web');
      }
    } else {
      // <button> — no existing href; start with sensible defaults.
      this.linkUrl.set('');
      this.linkNewTab.set(true);
      this.linkNoReferrer.set(true);
      this.linkNoFollow.set(false);
      this.linkSponsored.set(false);
      this.linkKind.set('web');
    }
    // Always refresh the section list so the picker is populated
    // when/if the user switches to Section.
    this.scanLinkSections();
    // Mutually exclusive — close the Settings panel so the Link
    // panel isn't hidden behind it.
    this.buttonSettingsOpen.set(false);
    this.buttonLinkOpen.set(true);
  }

  /** Cancel the link edit — close the popover without writing. */
  cancelCellButtonLink(): void {
    this.buttonLinkOpen.set(false);
  }

  /** Switch the "Link to" kind from the Link panel dropdown. On
   *  selecting `section`, scan the editor surface for headings so the
   *  Section list has options. Resets the URL when switching kinds
   *  so a stale `#sectionId` doesn't leak into a Web-address pick. */
  pickLinkKind(kind: 'web' | 'section' | 'page' | 'blog' | 'dynamic'): void {
    this.linkKind.set(kind);
    if (kind === 'section') {
      this.scanLinkSections();
      // Clear non-anchor URLs so the user starts fresh.
      if (this.linkUrl() && !this.linkUrl().startsWith('#')) this.linkUrl.set('');
    } else if (kind === 'web') {
      // Drop any `#section` anchor when switching back to web.
      if (this.linkUrl().startsWith('#')) this.linkUrl.set('');
    } else {
      // Page / Blog / Dynamic — host should populate; clear meanwhile.
      this.linkUrl.set('');
    }
  }

  /** Walk the editable surface for headings (h1–h6) and populate
   *  the Section picker list. Gives each heading without an `id` a
   *  stable slug-style id so the picked anchor stays consistent
   *  across reloads. */
  private scanLinkSections(): void {
    const editable = this.editable?.nativeElement;
    if (!editable) { this.linkSections.set([]); return; }
    const heads = Array.from(editable.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
    const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'section';
    const used = new Set<string>();
    const list = heads.map((h) => {
      let id = h.id;
      if (!id) {
        let base = slug(h.textContent ?? '');
        let candidate = base;
        let n = 1;
        while (used.has(candidate)) { candidate = `${base}-${++n}`; }
        id = candidate;
        h.id = id;
      }
      used.add(id);
      return {
        id,
        tag: h.tagName,
        label: (h.textContent ?? '').trim() || `(empty ${h.tagName.toLowerCase()})`,
      };
    });
    this.linkSections.set(list);
  }

  /** Save the link panel state to the picked button: write href +
   *  target + composed rel. If the target is a <button>, swap it for
   *  an <a> so the link is followable in the rendered post. */
  saveCellButtonLink(): void {
    let el = this.cellElementRef as HTMLAnchorElement | HTMLButtonElement | null;
    if (!el) return;
    const url = (this.linkUrl() || '').trim() || '#';
    const rel = [
      this.linkNoReferrer() ? 'noreferrer' : '',
      this.linkNoFollow()   ? 'nofollow'   : '',
      this.linkSponsored()  ? 'sponsored'  : '',
      this.linkNewTab()     ? 'noopener'   : '',
    ].filter(Boolean).join(' ');
    if (el.tagName !== 'A') {
      const a = document.createElement('a');
      a.style.cssText = (el as HTMLElement).style.cssText;
      a.className = (el as HTMLElement).className;
      a.innerHTML = (el as HTMLElement).innerHTML;
      el.replaceWith(a);
      el = a;
      this.cellElementRef = a;
    }
    (el as HTMLAnchorElement).setAttribute('href', url);
    if (this.linkNewTab()) (el as HTMLAnchorElement).setAttribute('target', '_blank');
    else (el as HTMLAnchorElement).removeAttribute('target');
    if (rel) (el as HTMLAnchorElement).setAttribute('rel', rel);
    else (el as HTMLAnchorElement).removeAttribute('rel');
    // Persist the user's "Link to" choice so a Page / Blog / Dynamic
    // pick (which doesn't yet write a non-# href) round-trips. Also
    // ensures a Web-with-`#` doesn't get re-interpreted as a Section
    // on reopen.
    (el as HTMLAnchorElement).setAttribute('data-link-kind', this.linkKind());
    this.buttonLinkOpen.set(false);
    this.emit();
  }

  /** Action: ask the host to open its media library to replace the
   *  currently-selected cell image. Reuses the cellImageClick output;
   *  the host calls replaceCellImagePlaceholder on the wrapping
   *  [data-cell-image] container (or the img itself). */
  replaceCellImage(): void {
    const el = this.cellElementRef;
    if (!el) return;
    // Prefer the wrapping [data-cell-image] container — that's what
    // the host expects to swap. Fall back to the img itself.
    const slot = (el.closest('[data-cell-image]') as HTMLElement | null) ?? el;
    this.cellImageClick.emit(slot);
  }

  /** Action: clear inline formatting on the currently-picked text
   *  block. Removes inline `style` and any common formatting wrappers
   *  (font/span with styles) while preserving the text content. */
  clearCellTextFormatting(): void {
    const el = this.cellElementRef;
    if (!el) return;
    el.removeAttribute('style');
    // Unwrap inline formatting tags (span/font/strong/em/u/b/i) so the
    // text reads as plain prose. Preserve anchors so links survive.
    el.querySelectorAll('span, font, strong, em, u, b, i').forEach((node) => {
      const parent = node.parentNode;
      if (!parent) return;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
    });
    this.emit();
  }

  /** Action: delete the currently-selected cell element. */
  deleteCellElement(): void {
    const el = this.cellElementRef;
    if (!el) return;
    // For images inside a data-cell-image wrapper, remove the wrapper
    // too so we don't leave an empty placeholder div behind.
    const slot = el.closest('[data-cell-image]') as HTMLElement | null;
    (slot ?? el).remove();
    this.clearCellElementToolbar();
    this.emit();
  }

  /** WP-style overflow-menu command for the per-element toolbar.
   *  Operates on the currently-picked cell element (button / image /
   *  text wrapper). */
  cellElementCmd(cmd: 'cut' | 'copy' | 'duplicate' | 'delete'): void {
    this.cellElementMoreOpen.set(false);
    const el = this.cellElementRef;
    if (!el) return;
    const slot = el.closest('[data-cell-image]') as HTMLElement | null;
    const target = slot ?? el;
    switch (cmd) {
      case 'copy': {
        navigator.clipboard?.writeText(target.outerHTML).catch(() => {});
        break;
      }
      case 'cut': {
        navigator.clipboard?.writeText(target.outerHTML).catch(() => {});
        this.deleteCellElement();
        break;
      }
      case 'duplicate': {
        const clone = target.cloneNode(true) as HTMLElement;
        target.parentNode?.insertBefore(clone, target.nextSibling);
        this.emit();
        break;
      }
      case 'delete': this.deleteCellElement(); break;
    }
  }
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
    // Double-click is image-figure-only — sections don't have a design
    // tab with corner-radius / border controls.
    const figure = target?.closest('figure.re-embed-figure') as HTMLElement | null;
    if (!figure) return;
    if (!figure.classList.contains('re-embed-figure--image')) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.selectFigure(figure);
    this.openFigPanel('design');
  }

  /** Closest selectable banner-like element from `target` — either a
   *  legacy `<figure class="re-embed-figure">` or a new
   *  `<section class="re-banner">`. Returned as `HTMLElement | null`
   *  so callers can branch on type via `isBannerEl` / `isBannerSection`. */
  private closestSelectable(target: HTMLElement | null | undefined): HTMLElement | null {
    return (target?.closest('figure.re-embed-figure, section.re-banner') as HTMLElement | null) ?? null;
  }

  /** Surface click delegate — selects the clicked embed figure or
   *  clears the selection if the click landed elsewhere. Also blocks
   *  any link navigation that would otherwise fire when an image has
   *  been wrapped in <a> via the Link popover — inside the editor a
   *  click means "select", never "follow the link". */
  onSurfaceClick(ev: MouseEvent): void {
    const target = ev.target as HTMLElement | null;
    // Add-image placeholder click — opens a file picker scoped to the
    // clicked cell. Reading the file as a data URL and swapping the
    // placeholder for an <img> tag keeps this self-contained without
    // a server upload step.
    const addImgBtn = target?.closest('[data-add-image]') as HTMLElement | null;
    if (addImgBtn) {
      ev.preventDefault();
      this.pickCellImage(addImgBtn);
      return;
    }
    // Detect per-element clicks. Buttons + images get the contextual
    // toolbar anywhere inside the editable surface (so a button
    // inserted via the side panel into the document body still has
    // its settings UI). Text blocks are restricted to inside cells
    // so the toolbar doesn't pop on every plain-paragraph click.
    const editable = this.editable?.nativeElement;
    const inSurface = !!target && !!editable && editable.contains(target);
    // Editor chrome — floating toolbars / popovers / panels. Clicks on
    // these manage their own state; we MUST NOT clear the contextual
    // selection or the panels they open will immediately close on
    // their own button presses (e.g. the Link icon would open the
    // Link panel which the bubbled click would then dismiss).
    const inChrome = !!target?.closest('.re__cellElemTb, .re__figPanel, .re__colTb, .re__figTb, .re__btnAlignMenu');
    if (!inChrome) {
      if (inSurface) {
        const btn = target?.closest('a, button:not([data-add-image]):not(.re-banner-cell-handle)') as HTMLElement | null;
        const img = target?.closest('img') as HTMLElement | null;
        const inCellContent = target?.closest('[data-layout-cell-content], .re-banner-cell-content');
        const textBlock = inCellContent
          ? (target?.closest('h1, h2, h3, h4, h5, h6, p, blockquote, ul, ol') as HTMLElement | null)
          : null;
        // Exclude images that are the picked figure-banner / embed-figure
        // — those have their own dedicated figure toolbar.
        const imgInFigure = !!img?.closest('figure.re-embed-figure');
        if (btn) {
          this.showCellElementToolbar('button', btn);
        } else if (img && !imgInFigure) {
          this.showCellElementToolbar('image', img);
        } else if (textBlock) {
          this.showCellElementToolbar('text', textBlock);
        } else {
          this.clearCellElementToolbar();
        }
      } else {
        this.clearCellElementToolbar();
      }
    }
    // Recognise either selectable shape: image/embed figure or banner
    // section. Both are routed through the same `selectFigure` path —
    // the signal is named for legacy reasons but accepts any
    // HTMLElement (see the doc-block on `selectedFigure`).
    const selectable = this.closestSelectable(target);
    const inAnchor = !!target?.closest('a[href]');
    if (selectable && inAnchor) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    // Clicks on the editable <figcaption> inside a figure stay focused
    // on the caption (user is editing the caption text) — don't show
    // the toolbar in that case. Banner sections have no captions so the
    // guard is figure-only.
    const inCaption = !!target?.closest('.re-embed-caption');
    // Banner column click — select the column and show its toolbar.
    // Columns can live inside either a legacy figure-banner (.re-banner-col)
    // or the new section-banner (.re-banner-cell); the banner-level
    // selection is set either way.
    const column = target?.closest('.re-banner-cell, .re-banner-col') as HTMLElement | null;
    if (selectable && column) {
      this.selectFigure(selectable);
      this.selectColumn(column);
      return;
    }
    if (selectable && !inCaption) {
      this.selectFigure(selectable);
      this.clearColumnSelection();
    } else if (!inChrome && !this.cellElementToolbar().type) {
      // Skip the figure/column deselect when:
      //  - the click landed on editor chrome (its handlers manage state)
      //  - OR the detection block above just picked a cell-element
      //    (button / image / text in or out of a banner). Without the
      //    cellElementToolbar check, picking a standalone button would
      //    set the toolbar and then clearFigureSelection would wipe it
      //    in the same tick.
      this.clearFigureSelection();
      this.clearColumnSelection();
    }
  }

  private selectColumn(col: HTMLElement): void {
    const prev = this.selectedColumn();
    if (prev && prev !== col) {
      prev.classList.remove('is-selected-col');
      this.removeColumnHandles(prev);
    }
    this.selectedColumn.set(col);
    col.classList.add('is-selected-col');
    this.attachColumnHandles(col);
    this.columnMenu.set(null);
    this.syncCellAlignment(col);
    this.refreshColumnToolbar();
  }

  /** Append the transient drag-grip pill(s) to the selected column.
   *  Two shapes are supported:
   *   - New `.re-banner-cell` → one centred `.re-banner-cell-handle`
   *     span carrying a kebab-dots SVG, matching the 5-level scaffold.
   *   - Legacy `.re-banner-col` (figure-banner overlay) → the older
   *     two-pill pattern (`.re-banner-col-handle--top/--bottom`).
   *  Idempotent — checks for existing handles before appending. All
   *  handles are stripped from saved HTML in `emit()` so they stay
   *  out of the persisted shape. */
  private attachColumnHandles(col: HTMLElement): void {
    if (col.classList.contains('re-banner-cell')) {
      // New Ricos-shape cells ship a structural handle button inside
      // .re-banner-cell-handle-wrap — nothing to attach, the CSS
      // shows/hides it via the .is-selected-col / banner hover state.
      if (col.querySelector(':scope > .re-banner-cell-handle-wrap')) return;
      // Legacy cells (pre-step-2) had no structural handle — fall
      // back to attaching the transient span so they still get one.
      if (col.querySelector(':scope > .re-banner-cell-handle')) return;
      const grab = document.createElement('span');
      grab.className = 're-banner-cell-handle';
      grab.setAttribute('contenteditable', 'false');
      grab.setAttribute('aria-hidden', 'true');
      grab.innerHTML = '<svg viewBox="0 0 18 18" width="14" height="14" fill="currentColor"><circle cx="6" cy="9" r="1"/><circle cx="9" cy="9" r="1"/><circle cx="12" cy="9" r="1"/></svg>';
      col.appendChild(grab);
      return;
    }
    if (col.querySelector(':scope > .re-banner-col-handle')) return;
    const top = document.createElement('span');
    top.className = 're-banner-col-handle re-banner-col-handle--top';
    top.setAttribute('contenteditable', 'false');
    const bottom = document.createElement('span');
    bottom.className = 're-banner-col-handle re-banner-col-handle--bottom';
    bottom.setAttribute('contenteditable', 'false');
    col.appendChild(top);
    col.appendChild(bottom);
  }

  private removeColumnHandles(col: HTMLElement): void {
    col.querySelectorAll(':scope > .re-banner-col-handle').forEach((n) => n.remove());
    col.querySelectorAll(':scope > .re-banner-cell-handle').forEach((n) => n.remove());
  }

  private clearColumnSelection(): void {
    const c = this.selectedColumn();
    if (c) {
      c.classList.remove('is-selected-col');
      this.removeColumnHandles(c);
    }
    this.selectedColumn.set(null);
    this.columnMenu.set(null);
    this.columnToolbar.set({ show: false, top: 0, left: 0 });
    this.colDesignOpen.set(false);
    // Reset user drag offset so the next selection starts at the
    // auto-tracked position rather than carrying over the previous
    // column's manual offset.
    this.columnToolbarOffset.set({ x: 0, y: 0 });
  }

  private refreshColumnToolbar(): void {
    const col = this.selectedColumn();
    const editable = this.editable?.nativeElement;
    if (!col || !editable) { this.columnToolbar.set({ show: false, top: 0, left: 0 }); return; }
    const surfaceRect = editable.getBoundingClientRect();
    const r = col.getBoundingClientRect();
    // Park the toolbar just above the cell-handle pill. The pill is
    // 14px tall and sits at top:-8 of the cell (centre on the cell's
    // top edge), so its top is at cell-top - 8. We want the toolbar's
    // bottom ~4px above the pill's top. With a ~36px toolbar height:
    //   toolbar.top = cell-top - 8 - 4 - 36 = cell-top - 48
    const top  = Math.max(8, r.top - surfaceRect.top - 48);
    const left = r.left - surfaceRect.left + r.width / 2;
    this.columnToolbar.set({ show: true, top, left });
  }

  toggleColumnMenu(ev: Event, key: 'add' | 'more'): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.columnMenu.set(this.columnMenu() === key ? null : key);
  }

  /** Insert a new column adjacent to the selected one. */
  addColumnBefore(): void { this.insertColumn('before'); }
  addColumnAfter():  void { this.insertColumn('after'); }

  /** WP-style overflow-menu command for the column toolbar. Operates
   *  on the currently-selected `.re-banner-cell`. */
  columnCmd(cmd: 'cut' | 'copy' | 'duplicate' | 'addBefore' | 'addAfter' | 'clear' | 'delete'): void {
    this.columnMenu.set(null);
    const cell = this.selectedColumn();
    if (!cell) return;
    switch (cmd) {
      case 'copy': {
        navigator.clipboard?.writeText(cell.outerHTML).catch(() => {});
        break;
      }
      case 'cut': {
        navigator.clipboard?.writeText(cell.outerHTML).catch(() => {});
        this.deleteSelectedColumn();
        break;
      }
      case 'duplicate': {
        const clone = cell.cloneNode(true) as HTMLElement;
        cell.parentNode?.insertBefore(clone, cell.nextSibling);
        this.emit();
        break;
      }
      case 'addBefore': this.addColumnBefore(); break;
      case 'addAfter':  this.addColumnAfter();  break;
      case 'clear': {
        // Drop a fresh empty paragraph as the cell's only content.
        const target = (cell.querySelector(':scope > [data-layout-cell-content]') as HTMLElement | null) ?? cell;
        target.innerHTML = '<p><br></p>';
        this.emit();
        break;
      }
      case 'delete': this.deleteSelectedColumn(); break;
    }
  }
  /** Selector that catches both the new `.re-banner-cell` (5-level
   *  section scaffold) and the legacy `.re-banner-col` (figure-banner
   *  overlay) so column iteration / counting / sibling-checks work
   *  uniformly across both shapes. */
  private static readonly COL_SELECTOR = '.re-banner-cell, .re-banner-col';

  /** Build a fresh column matching the shape of `existing` — a
   *  `.re-banner-cell` (with embedded grab-pill) when the surrounding
   *  banner uses the new scaffold, a plain `.re-banner-col` when it
   *  uses the legacy overlay. */
  private cloneColumnShape(existing: HTMLElement): HTMLElement {
    if (existing.classList.contains('re-banner-cell')) {
      return this.buildBannerCell();
    }
    const next = document.createElement('div');
    next.className = 're-banner-col';
    next.innerHTML = '<p>Add your text</p>';
    return next;
  }

  private insertColumn(pos: 'before' | 'after'): void {
    const col = this.selectedColumn();
    const f   = this.selectedFigure();
    if (!col || !f) return;
    const next = this.cloneColumnShape(col);
    if (pos === 'before') col.parentNode!.insertBefore(next, col);
    else                  col.parentNode!.insertBefore(next, col.nextSibling);
    // Auto-grow column-count to fit the new column.
    const total = f.querySelectorAll(RichEditorComponent.COL_SELECTOR).length;
    if (total > this.bannerColumns()) this.setBannerColumns(Math.min(2, total) as 1 | 2);
    this.columnMenu.set(null);
    if (RichEditorComponent.isBannerSection(f)) this.ensureColDivider(f);
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
    if (!sibling || !(sibling.classList.contains('re-banner-cell') || sibling.classList.contains('re-banner-col'))) return;
    if (dir === -1) col.parentNode!.insertBefore(col, sibling);
    else            col.parentNode!.insertBefore(sibling, col);
    this.emit();
    queueMicrotask(() => this.refreshColumnToolbar());
  }

  // ─── Per-column Design panel ───────────────────────────────────────
  /** Open / close the per-column design popover. On open, seeds the
   *  override signals from the selected column's current inline
   *  styles so the controls reflect what's actually applied. */
  toggleColDesignPanel(): void {
    const next = !this.colDesignOpen();
    if (next) this.seedColOverrides();
    this.colDesignOpen.set(next);
    if (!next) this.colorPanelTarget.set(null);
  }

  /** Pull the selected cell's inline background / border / radius
   *  into the override signals. Falls back to neutral defaults when
   *  the cell has no override yet — same baseline as the banner's
   *  Column background defaults. */
  private seedColOverrides(): void {
    const cell = this.selectedColumn();
    if (!cell) return;
    const bg = parseColor(cell.style.backgroundColor);
    if (bg) {
      this.colOvFillColor.set(bg.hex);
      this.colOvFillOpacity.set(Math.round(bg.alpha * 100));
    } else {
      this.colOvFillColor.set('#ffffff');
      this.colOvFillOpacity.set(0);
    }
    const bc = parseColor(cell.style.borderColor);
    if (bc) {
      this.colOvBorderColor.set(bc.hex);
      this.colOvBorderOpacity.set(Math.round(bc.alpha * 100));
    } else {
      this.colOvBorderColor.set('#000000');
      this.colOvBorderOpacity.set(100);
    }
    const bw = parseInt(cell.style.borderWidth || '0', 10);
    const cr = parseInt(cell.style.borderRadius || '0', 10);
    this.colOvBorderWidth.set(Number.isFinite(bw) ? bw : 0);
    this.colOvCornerRadius.set(Number.isFinite(cr) ? cr : 0);
  }

  setColOvFillColor(hex: string): void { this.colOvFillColor.set(hex || '#ffffff'); this.applyColOvFill(); }
  setColOvFillOpacity(v: number): void { this.colOvFillOpacity.set(Math.max(0, Math.min(100, +v || 0))); this.applyColOvFill(); }
  setColOvBorderColor(hex: string): void { this.colOvBorderColor.set(hex || '#000000'); this.applyColOvBorder(); }
  setColOvBorderOpacity(v: number): void { this.colOvBorderOpacity.set(Math.max(0, Math.min(100, +v || 0))); this.applyColOvBorder(); }
  setColOvBorderWidth(v: number): void {
    this.colOvBorderWidth.set(Math.max(0, +v || 0));
    const cell = this.selectedColumn(); if (!cell) return;
    cell.style.borderWidth = `${this.colOvBorderWidth()}px`;
    cell.style.borderStyle = this.colOvBorderWidth() > 0 ? 'solid' : '';
    this.applyColOvBorder();
    this.emit();
  }
  setColOvCornerRadius(v: number): void {
    this.colOvCornerRadius.set(Math.max(0, +v || 0));
    const cell = this.selectedColumn(); if (!cell) return;
    cell.style.borderRadius = `${this.colOvCornerRadius()}px`;
    this.emit();
  }

  private applyColOvFill(): void {
    const cell = this.selectedColumn(); if (!cell) return;
    cell.style.backgroundColor = this.composeRgba(this.colOvFillColor(), this.colOvFillOpacity());
    this.emit();
  }
  private applyColOvBorder(): void {
    const cell = this.selectedColumn(); if (!cell) return;
    if (this.colOvBorderWidth() <= 0) return;
    cell.style.borderColor = this.composeRgba(this.colOvBorderColor(), this.colOvBorderOpacity());
    this.emit();
  }

  /** Wipe all per-column overrides so the cell falls back to the
   *  banner-wide defaults. */
  resetColOverrides(): void {
    const cell = this.selectedColumn(); if (!cell) return;
    cell.style.removeProperty('background-color');
    cell.style.removeProperty('border-color');
    cell.style.removeProperty('border-width');
    cell.style.removeProperty('border-style');
    cell.style.removeProperty('border-radius');
    this.seedColOverrides();
    this.emit();
  }

  /** WP-style block-level command shared by the figure toolbar's
   *  3-dot overflow menu. Operates on the currently-selected figure
   *  (banner or image) without leaving the editor. */
  figureCmd(cmd: 'cut' | 'copy' | 'duplicate' | 'before' | 'after' | 'delete'): void {
    const f = this.selectedFigure();
    this.figMenu.set(null);
    if (!f) return;
    switch (cmd) {
      case 'copy': {
        navigator.clipboard?.writeText(f.outerHTML).catch(() => {});
        break;
      }
      case 'cut': {
        navigator.clipboard?.writeText(f.outerHTML).catch(() => {});
        this.deleteSelectedFigure();
        break;
      }
      case 'duplicate': {
        const clone = f.cloneNode(true) as HTMLElement;
        f.parentNode?.insertBefore(clone, f.nextSibling);
        this.ensureBannerBookends();
        this.emit();
        break;
      }
      case 'before': {
        const p = document.createElement('p');
        p.appendChild(document.createElement('br'));
        f.parentNode?.insertBefore(p, f);
        this.placeCaretAtStart(p);
        this.emit();
        break;
      }
      case 'after': {
        const p = document.createElement('p');
        p.appendChild(document.createElement('br'));
        f.parentNode?.insertBefore(p, f.nextSibling);
        this.placeCaretAtStart(p);
        this.emit();
        break;
      }
      case 'delete': {
        this.deleteSelectedFigure();
        break;
      }
    }
  }

  deleteSelectedColumn(): void {
    const col = this.selectedColumn(); if (!col) return;
    const parent = col.parentNode;
    col.remove();
    this.clearColumnSelection();
    // If we just deleted the last column in the container, drop a
    // fresh one in the matching shape so the banner inner isn't
    // completely blank.
    if (parent && parent instanceof HTMLElement && !parent.querySelector(RichEditorComponent.COL_SELECTOR)) {
      const fresh = parent.classList.contains('re-banner-inner')
        ? this.buildBannerCell()
        : Object.assign(document.createElement('div'), { className: 're-banner-col', innerHTML: '<p>Add your text</p>' });
      parent.appendChild(fresh as HTMLElement);
    }
    // Falling back to one column → drop the divider; ratio resets so
    // a future re-add to 2 cols starts evenly.
    const f = this.selectedFigure();
    if (f && RichEditorComponent.isBannerSection(f)) {
      const cellCount = f.querySelectorAll(RichEditorComponent.COL_SELECTOR).length;
      if (cellCount <= 1) {
        this.bannerColumns.set(1);
        this.bannerColRatio.set(0.5);
        this.applyBannerStyles();
      }
      this.ensureColDivider(f);
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
    this.isBannerFigure.set(RichEditorComponent.isBannerEl(figure));
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
    // Reset the user's manual toolbar offset on deselect so the next
    // figure doesn't inherit the previous figure's drag offset.
    this.figureToolbarOffset.set({ x: 0, y: 0 });
    // Per-element toolbar belongs to the selected banner — clear it
    // when the banner deselects.
    this.clearCellElementToolbar();
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
  /** Per-instance set of `.re-banner-handle` nodes whose mousedown
   *  has already been wired up — prevents double-binding on re-select
   *  without persisting any flag into saved HTML. */
  private wiredBannerHandles = new WeakSet<HTMLElement>();
  private wiredColDividers   = new WeakSet<HTMLElement>();

  /** Ensure / remove the vertical divider between the two cells of a
   *  2-column banner. Idempotent: re-callable on selection or after
   *  switching cols. The divider is transient — stripped from saved
   *  HTML by the emit() regex and re-attached on selection. */
  private ensureColDivider(section: HTMLElement): void {
    const inner = section.querySelector<HTMLElement>(':scope > .re-banner-backdrop > .re-banner-resizer > .re-banner-inner');
    if (!inner) return;
    const existing = inner.querySelector<HTMLElement>(':scope > .re-banner-col-divider');
    const isTwoCol = inner.querySelectorAll(':scope > .re-banner-cell, :scope > .re-banner-col').length >= 2;
    if (!isTwoCol) { existing?.remove(); return; }
    if (existing) {
      this.positionColDivider(section);
      return;
    }
    const div = document.createElement('span');
    div.className = 're-banner-col-divider';
    div.setAttribute('contenteditable', 'false');
    div.setAttribute('aria-label', 'Resize columns');
    inner.appendChild(div);
    this.positionColDivider(section);
    if (!this.wiredColDividers.has(div)) {
      this.wiredColDividers.add(div);
      div.addEventListener('mousedown', (ev) => this.startColDividerDrag(ev, section));
    }
  }

  /** Sync the divider's CSS-var left% with the current ratio so it
   *  paints on the gap between the two cells before any drag. */
  private positionColDivider(section: HTMLElement): void {
    const inner = section.querySelector<HTMLElement>(':scope > .re-banner-backdrop > .re-banner-resizer > .re-banner-inner');
    const div   = inner?.querySelector<HTMLElement>(':scope > .re-banner-col-divider');
    if (!inner || !div) return;
    const r = clamp(this.bannerColRatio(), 0.15, 0.85);
    div.style.setProperty('--re-banner-col-divider-left', `${(r * 100).toFixed(3)}%`);
  }

  private startColDividerDrag(ev: MouseEvent, section: HTMLElement): void {
    ev.preventDefault();
    ev.stopPropagation();
    const inner = section.querySelector<HTMLElement>(':scope > .re-banner-backdrop > .re-banner-resizer > .re-banner-inner');
    const div   = inner?.querySelector<HTMLElement>(':scope > .re-banner-col-divider');
    if (!inner || !div) return;
    div.classList.add('is-dragging');

    // Smart-guide snap points — common column ratios. When the
    // cursor is within `SNAP_THRESHOLD` of any of these, the drag
    // snaps to the value and the divider gets `.is-snapped` so the
    // CSS can flash a stronger highlight.
    const SNAP_POINTS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75];
    const SNAP_THRESHOLD = 0.025; // 2.5 % of inner width

    // Transient ratio-label chip — shows the live percentages while
    // dragging (e.g. "50% / 50%"). Lives inside the divider so it
    // tracks the divider's position automatically.
    const label = document.createElement('span');
    label.className = 're-banner-col-divider-label';
    label.setAttribute('contenteditable', 'false');
    div.appendChild(label);

    const applyRatio = (ratio: number) => {
      div.style.setProperty('--re-banner-col-divider-left', `${(ratio * 100).toFixed(3)}%`);
      inner.style.setProperty(
        '--ricos-internal-layout-column-template',
        `minmax(0, ${ratio.toFixed(3)}fr) minmax(0, ${(1 - ratio).toFixed(3)}fr)`,
      );
      label.textContent = `${Math.round(ratio * 100)}% / ${Math.round((1 - ratio) * 100)}%`;
    };

    const onMove = (m: MouseEvent) => {
      const rect = inner.getBoundingClientRect();
      if (rect.width <= 0) return;
      const raw   = (m.clientX - rect.left) / rect.width;
      let ratio   = clamp(raw, 0.15, 0.85);
      // Snap to the nearest snap-point if within threshold.
      let snapped = false;
      for (const snap of SNAP_POINTS) {
        if (Math.abs(ratio - snap) < SNAP_THRESHOLD) {
          ratio = snap;
          snapped = true;
          break;
        }
      }
      div.classList.toggle('is-snapped', snapped);
      applyRatio(ratio);
    };
    const onUp = (m: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      div.classList.remove('is-dragging');
      div.classList.remove('is-snapped');
      label.remove();
      const rect = inner.getBoundingClientRect();
      if (rect.width > 0) {
        const raw = (m.clientX - rect.left) / rect.width;
        let ratio = clamp(raw, 0.15, 0.85);
        for (const snap of SNAP_POINTS) {
          if (Math.abs(ratio - snap) < SNAP_THRESHOLD) { ratio = snap; break; }
        }
        this.bannerColRatio.set(ratio);
      }
      this.applyBannerStyles();
      this.emit();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /** Re-create the bottom resize handle on a banner section that was
   *  loaded from saved HTML (transient handle markup is stripped by
   *  emit()'s regex). Wix model: banners resize vertically only via
   *  a single bottom pill. Older scaffolds that shipped left/right/top
   *  handles get cleaned up here too. */
  private ensureBannerHandles(section: HTMLElement): void {
    // Sweep any legacy left/right/top handles wherever they live —
    // they're no longer part of the model.
    section.querySelectorAll('.re-banner-handle--left, .re-banner-handle--right, .re-banner-handle--top').forEach(n => n.remove());

    if (!section.querySelector(':scope > .re-banner-handle--bottom')) {
      const h = document.createElement('span');
      h.className = 're-banner-handle re-banner-handle--bottom';
      h.setAttribute('contenteditable', 'false');
      h.setAttribute('data-dir', 'bottom');
      h.setAttribute('data-resize-handle', 'bottom');
      h.setAttribute('aria-label', 'Resize banner height');
      section.appendChild(h);
    }
    // Sweep any legacy markers that lived as direct section children
    // (older scaffold versions). The new markers sit inside the inner
    // grid so they anchor to the column's edges, not the section's.
    section.querySelectorAll(':scope > .re-banner-marker').forEach(n => n.remove());
    // Left + right column resize handles — children of the inner
    // grid so they anchor to the column's left/right edges. Dragging
    // resizes the column width.
    const inner = section.querySelector<HTMLElement>(':scope > .re-banner-backdrop > .re-banner-resizer > .re-banner-inner');
    if (inner) {
      (['left', 'right'] as const).forEach((dir) => {
        if (inner.querySelector(`:scope > .re-banner-marker--${dir}`)) return;
        const m = document.createElement('span');
        m.className = `re-banner-marker re-banner-marker--${dir}`;
        m.setAttribute('contenteditable', 'false');
        m.setAttribute('aria-hidden', 'true');
        m.setAttribute('data-dir', dir);
        m.setAttribute('data-resize-handle', dir);
        inner.appendChild(m);
      });
    }
  }

  private attachResizeHandles(figure: HTMLElement): void {
    if (figure.querySelector('.re__resizer')) return;
    // Section-banners ship their own .re-banner-handle--* children
    // as siblings of .re-banner-inner — those are positioned by CSS
    // (no JS coordinates needed). Wire the mousedown listeners on
    // those existing nodes so the same `startResize` flow drives
    // them, then bail out before the legacy `.re__resizer` dots
    // would otherwise be appended.
    if (RichEditorComponent.isBannerSection(figure)) {
      // Saved HTML strips the transient handle markup, so on first
      // selection of a reloaded section we may need to (re-)add it.
      this.ensureBannerHandles(figure);
      // Two-cell banners also get a vertical divider between cells.
      this.ensureColDivider(figure);
      // Bottom resize handle — vertical resize of the backdrop height.
      figure.querySelectorAll<HTMLElement>(':scope > .re-banner-handle--bottom').forEach((h) => {
        if (this.wiredBannerHandles.has(h)) return;
        this.wiredBannerHandles.add(h);
        h.addEventListener('mousedown', (ev) => this.startResize(ev, 's'));
      });
      // Left + right column markers — wire as HORIZONTAL column
      // resize handles. They live inside the inner-grid and drive
      // --ricos-internal-layout-width on the resize-container. The
      // section's own width stays at 100% so the banner is fixed-width;
      // only the column narrows / widens.
      figure.querySelectorAll<HTMLElement>('.re-banner-marker').forEach((h) => {
        if (this.wiredBannerHandles.has(h)) return;
        this.wiredBannerHandles.add(h);
        const dir = h.dataset['dir'] === 'left' ? 'w' : 'e';
        h.addEventListener('mousedown', (ev) => this.startColWidthDrag(ev, dir));
      });
      // Cell drag-handle (⋯) — wire each as a drag-to-swap handle so
      // the user can grab a column and drop it on another to reorder.
      figure.querySelectorAll<HTMLElement>('.re-banner-cell-handle').forEach((btn) => {
        if (this.wiredCellHandles.has(btn)) return;
        this.wiredCellHandles.add(btn);
        const cell = btn.closest('.re-banner-cell') as HTMLElement | null;
        if (cell) btn.addEventListener('mousedown', (ev) => this.startColumnDrag(ev, cell));
      });
      return;
    }
    // Force `position: relative` so the absolutely-positioned handle
    // children anchor to the figure (not the editor surface above
    // it). `||=` could miss when a computed style sneaks in static.
    figure.style.position = 'relative';
    // Legacy figure-banners resize horizontally only — width controls
    // how far the banner stretches across the canvas. Vertical
    // handles would let the user squash the banner into nothing
    // without a useful outcome.
    const isBanner = RichEditorComponent.isBannerEl(figure);
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
    // For section-banners the .re-banner-handle--* elements live in
    // the scaffold and stay around between selections — only the
    // wiring is tracked in `wiredBannerHandles`. The WeakSet entries
    // are garbage-collected automatically when the nodes detach
    // (e.g. via deleteSelectedFigure), so no explicit cleanup here.
  }

  /** The element the resize handles should hug — the inner media
   *  (img / iframe / video), NOT the figure (which also contains the
   *  caption). Banners are a special case: their inner img is hidden
   *  via `display: none` (the section background is the canonical
   *  image source), which collapses offsetWidth/Height to 0 and
   *  parks every handle at the figure's top-left corner. For banners
   *  we always use the figure itself so e/w handles land on the
   *  banner's actual edges. */
  private resizeAnchor(figure: HTMLElement): HTMLElement {
    if (RichEditorComponent.isBannerEl(figure)) return figure;
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
  private wiredCellHandles = new WeakSet<HTMLElement>();

  /** Drag-to-swap handler for the cell drag-handle (⋯) button. The
   *  user grabs a column's handle and drops it over another column's
   *  area — the two columns swap places (or the dragged one slots
   *  in at the drop target's position). Works for 2+ columns; bails
   *  out silently in 1-column banners. */
  private startColumnDrag(ev: MouseEvent, cell: HTMLElement): void {
    ev.preventDefault();
    ev.stopPropagation();
    const inner = cell.closest('.re-banner-inner') as HTMLElement | null;
    if (!inner) return;
    const allCells = Array.from(inner.querySelectorAll<HTMLElement>(':scope > .re-banner-cell'));
    if (allCells.length < 2) return;

    cell.classList.add('is-dragging-cell');
    document.body.style.cursor = 'grabbing';

    const findTarget = (m: MouseEvent): HTMLElement | null => {
      const el = document.elementFromPoint(m.clientX, m.clientY) as HTMLElement | null;
      const t  = el?.closest('.re-banner-cell') as HTMLElement | null;
      return t && t !== cell && allCells.includes(t) ? t : null;
    };

    const onMove = (m: MouseEvent) => {
      const target = findTarget(m);
      allCells.forEach((c) => c.classList.toggle('is-drop-target', c === target));
    };
    const onUp = (m: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      cell.classList.remove('is-dragging-cell');
      allCells.forEach((c) => c.classList.remove('is-drop-target'));
      document.body.style.cursor = '';

      const target = findTarget(m);
      if (target) {
        const cellIndex   = allCells.indexOf(cell);
        const targetIndex = allCells.indexOf(target);
        if (cellIndex < targetIndex) {
          inner.insertBefore(cell, target.nextSibling);
        } else {
          inner.insertBefore(cell, target);
        }
        this.emit();
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /** Drag handler for the column-edge markers on a section banner.
   *  Writes --ricos-internal-layout-width to the [data-resize-container]
   *  so the column narrows / widens. The wrapping section keeps its
   *  width:100% — only the inner column is affected. The column is
   *  centred via margin-inline:auto, so dragging either side toward the
   *  centre shrinks the column symmetrically by 2 * dx. */
  private startColWidthDrag(ev: MouseEvent, dir: 'w' | 'e'): void {
    const f = this.selectedFigure(); if (!f) return;
    if (!RichEditorComponent.isBannerSection(f)) return;
    const resizer = f.querySelector(':scope > .re-banner-backdrop > [data-resize-container]') as HTMLElement | null;
    if (!resizer) return;
    ev.preventDefault();
    ev.stopPropagation();
    f.classList.add('is-resizing');
    const startX = ev.clientX;
    const startW = resizer.getBoundingClientRect().width;
    const onMove = (m: MouseEvent) => {
      const dx = m.clientX - startX;
      // Symmetric shrink/grow: both edges move equally so the
      // centered column tracks the cursor. West drag right ⇒ narrower.
      const delta = dir === 'e' ? dx * 2 : -dx * 2;
      const w = Math.max(120, startW + delta);
      resizer.style.setProperty('--ricos-internal-layout-width', `${Math.round(w)}px`);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      f.classList.remove('is-resizing');
      this.emit();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  private startResize(ev: MouseEvent, dir: ResizeDir): void {
    const f = this.selectedFigure(); if (!f) return;
    ev.preventDefault();
    ev.stopPropagation();
    // Mark the figure as "actively dragging" — the .is-resizing class
    // is the hook for the heavier brand outline + ring shadow that
    // distinguishes live-drag from static-selected.
    f.classList.add('is-resizing');
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

    // Section-banner resize semantics (Wix model — vertical only):
    //   - Bottom drag (s) → writes height to the .re-banner-backdrop
    //     (the colored layer). The section auto-sizes around it so
    //     the handle always sits on the backdrop's actual bottom edge.
    //   - No left/right/top handles on banners.
    // Legacy figures keep the original full-direction resize.
    const isSectionBanner = RichEditorComponent.isBannerSection(f);
    const heightTarget: HTMLElement = isSectionBanner
      ? (f.querySelector(':scope > .re-banner-backdrop') as HTMLElement | null) ?? f
      : f;
    const startTargetH = isSectionBanner
      ? heightTarget.getBoundingClientRect().height
      : startH;

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

      if (isSectionBanner) {
        // Wix model — vertical-only resize. Bottom drag adjusts the
        // colored backdrop's height; everything else is ignored.
        // Minimum is the tallest column's natural content height plus
        // the backdrop's top/bottom padding wells, so dragging shorter
        // never clips a column — the banner can never be smaller than
        // its tallest column needs.
        if (dir === 's') {
          const minH = this.minBannerBackdropHeight(f, heightTarget);
          const targetH = Math.max(minH, startTargetH + dy);
          heightTarget.style.setProperty('height', `${Math.round(targetH)}px`, 'important');
        }
        this.refreshFigureToolbar();
        return;
      }

      // ── Legacy / image-figure resize (unchanged) ──────────────────
      let w = startW;
      let h = startH;
      if (dir.includes('e')) w = startW + dx;
      if (dir.includes('w')) w = startW - dx;
      if (dir.includes('s')) h = startH + dy;
      if (dir.includes('n')) h = startH - dy;
      if (isCorner) {
        h = Math.max(40, w / aspect);
      }
      w = Math.max(60, w);
      h = Math.max(40, h);
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
      // Drop the live-drag class so the figure reverts to the static
      // "selected" outline once the user releases the mouse.
      f.classList.remove('is-resizing');
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

  toggleFigMenu(ev: Event, key: 'size' | 'align' | 'link' | 'settings' | 'design' | 'valign' | 'more'): void {
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

  /** Minimum allowed height for a banner backdrop during south-handle
   *  drag — the tallest column's natural (scroll) height plus the
   *  backdrop's own top + bottom padding. Returned in CSS pixels so
   *  the caller can clamp the dragged height directly. */
  private minBannerBackdropHeight(section: HTMLElement, backdrop: HTMLElement): number {
    // Backdrop padding pulled live from computed style — banners can
    // be configured with arbitrary vertical wells.
    const cs = getComputedStyle(backdrop);
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    const cells = section.querySelectorAll<HTMLElement>(
      ':scope > .re-banner-backdrop > .re-banner-resizer > .re-banner-inner > .re-banner-cell',
    );
    let tallest = 40; // floor matches the prior hard-coded minimum
    cells.forEach((c) => { tallest = Math.max(tallest, c.scrollHeight); });
    return tallest + padTop + padBottom;
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
    const f = this.selectedFigure(); if (!f) return;

    // Three branches:
    //   1. New section-banner → convert back to image-figure (extract bgImage).
    //   2. Legacy figure-banner → revert in-place (existing class-flip path).
    //   3. Plain image figure → convert to a new section-banner.
    if (RichEditorComponent.isBannerSection(f)) {
      this.sectionBannerToImageFigure(f);
    } else if (RichEditorComponent.isBannerEl(f) && f.tagName === 'FIGURE') {
      this.revertLegacyFigureBanner(f);
    } else if (this.isImageFigure()) {
      this.imageFigureToSectionBanner(f);
    } else {
      return;
    }

    this.emit();
    // After conversion, `selectedFigure()` points at whichever element
    // is now selected (could be a brand-new section). Re-read it before
    // touching resize handles and panel state.
    const after = this.selectedFigure();
    if (after) {
      this.removeResizeHandles(after);
      this.attachResizeHandles(after);
    }
    // Flip the open panel to the matching kind so the user doesn't
    // have to deselect + reselect to see the right tab.
    const open = this.figPanel();
    if (open && after) {
      const isBanner = RichEditorComponent.isBannerEl(after);
      if (isBanner && (open === 'settings' || open === 'design')) {
        this.openFigPanel('banner-design');
      } else if (!isBanner && (open === 'banner-design' || open === 'banner-layout')) {
        this.openFigPanel('settings');
      }
    }
    queueMicrotask(() => this.refreshFigureToolbar());
  }

  /** Revert a legacy figure-banner back to an image-figure in place.
   *  Pulls off the banner classes + overlay; leaves the original <img>
   *  intact. */
  private revertLegacyFigureBanner(f: HTMLElement): void {
    f.classList.remove('re-banner', 're-banner-vtop', 're-banner-vmid', 're-banner-vbot');
    f.querySelectorAll('.re-banner-overlay').forEach(o => o.remove());
    f.style.removeProperty('width');
    f.style.removeProperty('max-width');
    f.style.removeProperty('height');
    this.isBannerFigure.set(false);
  }

  /** Convert a plain image-figure into the new `<section class="re-banner">`
   *  shape. The figure is replaced wholesale; the original image's `src`
   *  carries forward as the banner's `bgImage`. */
  private imageFigureToSectionBanner(f: HTMLElement): void {
    const img = f.querySelector('img') as HTMLImageElement | null;
    const src = img?.getAttribute('src') ?? '';

    const section = this.buildBannerScaffold();
    f.replaceWith(section);

    // Seed banner state for the new section + persist via dataset.
    this.bannerVAlign.set('top');
    this.bannerBgKind.set('image');
    this.bannerBgShow.set(true);
    if (src && !this.bannerBgImage()) this.bannerBgImage.set(src);

    // Promote the new section to the active selection so subsequent
    // calls (applyBannerStyles, toolbar refresh) target it.
    this.selectedFigure.set(section);
    this.isImageFigure.set(false);
    this.isBannerFigure.set(true);
    section.classList.add('is-selected');

    this.applyBannerStyles();
  }

  /** Monotonic counter for unique cell ids. Each cell gets a stable
   *  `data-layout-cell="cell-<n>"` so the structural drag-handle's
   *  `data-layout-cell-handle` can reference it by id (matches the
   *  Ricos contract). The counter is process-local — saved markup
   *  retains its ids; new cells get fresh ones from this counter. */
  private cellIdCounter = 0;
  private genCellId(): string { return `cell-${Date.now().toString(36)}-${++this.cellIdCounter}`; }

  /** Scope id for a banner's @container rule. Stored on the wrapper
   *  as `data-layout-scope="banner-<id>-<bp>-STACK"` — the trailing
   *  breakpoint lets the inline <style> address its own scope without
   *  cross-banner leakage. */
  private bannerScopeCounter = 0;
  private genBannerScopeBase(): string { return `banner-${Date.now().toString(36)}-${++this.bannerScopeCounter}`; }
  /** Compose the scope value from a stable base id and the current
   *  breakpoint. Both the data-attribute and the inline <style>'s
   *  selector use this exact string. */
  private bannerScopeValue(base: string, bp: number): string { return `${base}-${bp}-STACK`; }

  /** Render the @container rule that applies below the breakpoint.
   *  Two modes (driven by `bannerBehavior`):
   *    - stacked    → collapse to one column (minmax(0,1fr)), hide
   *                   the cell drag-handles. Standard Wix "Stack".
   *    - horizontal → keep columns side-by-side but use
   *                   repeat(auto-fit, minmax(120px, 1fr)) so they
   *                   shrink and wrap onto multiple rows as needed
   *                   (Wix "Wrap"). */
  private bannerStackRule(scope: string, bp: number, behavior: 'stacked' | 'horizontal' = 'stacked'): string {
    if (behavior === 'horizontal') {
      return (
        `@container (width < ${bp}px) {`
        + ` [data-layout-scope="${scope}"] [data-layout-container] {`
        +   ' --ricos-internal-layout-column-template: repeat(auto-fit, minmax(120px, 1fr)) !important;'
        +   ' --ricos-internal-layout-gap: 8px !important;'
        + ' }'
        + ' }'
      );
    }
    return (
      `@container (width < ${bp}px) {`
      + ` [data-layout-scope="${scope}"] [data-layout-container] {`
      +   ' --ricos-internal-layout-column-template: minmax(0, 1fr) !important;'
      +   ' --ricos-internal-layout-gap: 8px !important;'
      + ' }'
      + ` [data-layout-scope="${scope}"] .re-banner-cell-handle-wrap { display: none !important; }`
      + ' }'
    );
  }

  /** Build a single `.re-banner-cell` matching the Ricos data-layout
   *  shape: outer `[data-layout-cell]`, structural handle button in a
   *  contenteditable=false wrapper, and an editable
   *  `[data-layout-cell-content]` wrapper that holds the user's text.
   *  The `.re-banner-cell-handle` class is preserved so existing
   *  selection / hover CSS still targets the handle. */
  private buildBannerCell(id?: string): HTMLElement {
    const cellId = id ?? this.genCellId();
    const cell = document.createElement('div');
    cell.className = 're-banner-cell';
    cell.setAttribute('data-layout-cell', cellId);

    // Structural handle — wrapped in a contenteditable=false div so
    // the button never participates in the inner container's editable
    // tree. The kebab-dots SVG matches the prior transient handle so
    // the visual stays identical.
    const handleWrap = document.createElement('div');
    handleWrap.className = 're-banner-cell-handle-wrap';
    handleWrap.setAttribute('contenteditable', 'false');
    const handleBtn = document.createElement('button');
    handleBtn.type = 'button';
    handleBtn.className = 're-banner-cell-handle';
    handleBtn.setAttribute('data-layout-cell-handle', cellId);
    handleBtn.setAttribute('aria-label', 'Drag column');
    handleBtn.innerHTML =
      '<svg viewBox="0 0 18 18" width="14" height="14" fill="currentColor" aria-hidden="true">' +
      '<circle cx="6" cy="9" r="1"/><circle cx="9" cy="9" r="1"/><circle cx="12" cy="9" r="1"/>' +
      '</svg>';
    handleWrap.appendChild(handleBtn);

    const content = document.createElement('div');
    content.className = 're-banner-cell-content';
    content.setAttribute('data-layout-cell-content', '');
    const p = document.createElement('p');
    p.textContent = 'Add your text';
    content.appendChild(p);

    cell.appendChild(handleWrap);
    cell.appendChild(content);
    return cell;
  }

  /** Build an empty 5-level banner scaffold (wrapper → backdrop →
   *  resizer → inner → cell, plus the 4 sibling resize handles).
   *  Used by both `insertBanner()` and `imageFigureToSectionBanner()`
   *  so the two creation paths produce identical markup. */
  private buildBannerScaffold(): HTMLElement {
    // Outer layout wrapper — Ricos's `data-layout-wrapper` is the
    // anchor for the backdrop/cell-padding CSS variables. The
    // `.re-banner` class is kept so selection / hover / handle CSS
    // still targets it.
    const section = document.createElement('section');
    section.className = 're-banner re-banner-vmid';
    section.setAttribute('contenteditable', 'false');
    section.setAttribute('data-layout-wrapper', '');
    section.setAttribute('data-layout-banner', 'true');
    section.setAttribute('data-breakout', 'fullWidth');

    // Per-banner @container scope — a stable base id is generated
    // once at scaffold time and combined with the active breakpoint
    // on every applyBannerStyles() so the inline <style> rule can
    // address only this banner without touching siblings on the page.
    const scopeBase = this.genBannerScopeBase();
    section.dataset['scopeBase'] = scopeBase;
    const bp = this.bannerBreakpoint();
    section.setAttribute('data-layout-scope', this.bannerScopeValue(scopeBase, bp));

    // Inline <style> with the @container rule — saved to HTML so the
    // responsive collapse persists when the banner is reloaded.
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-banner-stack', '');
    styleEl.textContent = this.bannerStackRule(section.getAttribute('data-layout-scope')!, bp, this.bannerBehavior());
    section.appendChild(styleEl);

    // Level 2 — backdrop (carries the section background + the
    // top/bottom padding wells). `data-breakout="normal"` constrains
    // the inner content to the editor's reading column even though
    // the wrapper is full-width.
    const backdrop = document.createElement('div');
    backdrop.className = 're-banner-backdrop';
    backdrop.setAttribute('contenteditable', 'false');
    backdrop.setAttribute('data-breakout', 'normal');

    // Level 3 — resize container. The Ricos --ricos-internal-layout-width
    // var drives its max-width; we default to 100% so the banner spans
    // the column. The left/right resize handles live INSIDE this
    // container (sibling of the inner grid), matching Wix's contract.
    const resizer = document.createElement('div');
    resizer.className = 're-banner-resizer';
    resizer.setAttribute('contenteditable', 'false');
    resizer.setAttribute('data-resize-container', '');
    resizer.style.setProperty('--ricos-internal-layout-width', '100%');

    // Level 4 — the grid container ([data-layout-container]). This is
    // where the column-template / gap / background image vars live.
    const inner = document.createElement('div');
    inner.className = 're-banner-inner';
    inner.setAttribute('contenteditable', 'true');
    inner.setAttribute('data-layout-container', '');

    // Level 5 — at least one cell. Subsequent cells get added by
    // setBannerColumns(2) / insertColumn().
    const cell = this.buildBannerCell();
    inner.appendChild(cell);
    resizer.appendChild(inner);
    backdrop.appendChild(resizer);
    section.appendChild(backdrop);

    // Bottom handle — the ONLY resize affordance on a banner (Wix
    // model: banners are resizable vertically only, via this pill).
    // Dragging it changes the backdrop's height so the colored area
    // shrinks / grows with the cursor.
    const bottomHandle = document.createElement('span');
    bottomHandle.className = 're-banner-handle re-banner-handle--bottom';
    bottomHandle.setAttribute('contenteditable', 'false');
    bottomHandle.setAttribute('data-dir', 'bottom');
    bottomHandle.setAttribute('data-resize-handle', 'bottom');
    bottomHandle.setAttribute('aria-label', 'Resize banner height');
    section.appendChild(bottomHandle);

    // Left + right column resize handles — circles at vertical centre
    // with thin guide lines spanning the column's height. Placed as
    // children of the inner-grid so they anchor to the column's
    // left/right edges. Dragging adjusts the column width via
    // --ricos-internal-layout-width on the resize-container (the
    // CSS already consumes this var for max-width).
    (['left', 'right'] as const).forEach((dir) => {
      const m = document.createElement('span');
      m.className = `re-banner-marker re-banner-marker--${dir}`;
      m.setAttribute('contenteditable', 'false');
      m.setAttribute('aria-hidden', 'true');
      m.setAttribute('data-dir', dir);
      m.setAttribute('data-resize-handle', dir);
      inner.appendChild(m);
    });
    return section;
  }

  /** Convert a section-banner back to a plain image-figure. Recovers
   *  the image URL from three places, in order:
   *    1. `data-bg-image` on the section (canonical persisted source)
   *    2. The live `bannerBgImage()` signal (in-memory state)
   *    3. The computed `--re-banner-backdrop-image` CSS var (fallback
   *       when the dataset got out of sync — strips the surrounding
   *       `url("...")` wrapper). */
  private sectionBannerToImageFigure(section: HTMLElement): void {
    let src = section.dataset['bgImage'] || this.bannerBgImage() || '';
    if (!src) {
      try {
        const cssUrl = getComputedStyle(section).getPropertyValue('--re-banner-backdrop-image').trim();
        const m = /^url\(\s*"?([^"\)]*?)"?\s*\)$/.exec(cssUrl);
        if (m && m[1]) src = m[1];
      } catch { /* getComputedStyle may throw in detached subtrees */ }
    }

    const figure = document.createElement('figure');
    figure.className = 're-embed-figure re-embed-figure--image re-size-standard re-align-center';
    figure.setAttribute('contenteditable', 'false');

    if (src) {
      const img = document.createElement('img');
      img.setAttribute('src', src);
      img.setAttribute('alt', '');
      img.style.display = 'block';
      img.style.width = '100%';
      img.style.height = 'auto';
      figure.appendChild(img);
    }

    section.replaceWith(figure);

    this.selectedFigure.set(figure);
    this.isImageFigure.set(true);
    this.isBannerFigure.set(false);
    figure.classList.add('is-selected');
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
    // Prefer the new `.re-banner-inner` container (5-level scaffold);
    // fall back to the legacy `.re-banner-overlay` (figure-banner) for
    // older saved content.
    const inner = f.querySelector('.re-banner-inner') as HTMLElement | null;
    const overlay = inner ?? (f.querySelector('.re-banner-overlay') as HTMLElement | null);
    if (!overlay) return;
    const col = inner ? this.buildBannerCell() : Object.assign(
      document.createElement('div'),
      { className: 're-banner-col', innerHTML: '<p>Add your text</p>' },
    );
    overlay.appendChild(col as HTMLElement);
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
    const bgKind = (ds['bgKind'] as 'color' | 'gradient' | 'image' | undefined) ?? 'color';
    this.bannerBgShow.set(ds['bgShow'] !== 'false');
    this.bannerBgKind.set(bgKind);
    this.bannerBgColor.set(ds['bgColor']   || '#ffffff');
    this.bannerBgOpacity.set(num(ds['bgOpacity'], 100));
    this.bannerBgGradient.set(ds['bgGradient'] || 'linear-gradient(180deg, #32acc1 0%, #ffffff 100%)');
    this.bannerBgImage.set(ds['bgImage']   || '');
    this.bannerColumns.set((num(ds['cols'], 1) === 2 ? 2 : 1));
    const savedRatio = parseFloat(ds['colRatio'] ?? '');
    this.bannerColRatio.set(Number.isFinite(savedRatio) ? clamp(savedRatio, 0.15, 0.85) : 0.5);
    this.bannerColGap.set(num(ds['gap'], 20));
    this.bannerColPadX.set(num(ds['padX'], 0));
    this.bannerColPadY.set(num(ds['padY'], 18));
    // 4-edge values — prefer explicit padTop/Right/Bottom/Left; fall
    // back to seeding from the legacy padX (horizontal) / padY
    // (vertical) so older saved banners still look right.
    this.bannerColPadTop.set(num(ds['padTop'],    this.bannerColPadY()));
    this.bannerColPadRight.set(num(ds['padRight'],  this.bannerColPadX()));
    this.bannerColPadBottom.set(num(ds['padBottom'], this.bannerColPadY()));
    this.bannerColPadLeft.set(num(ds['padLeft'],   this.bannerColPadX()));
    this.bannerVMargin.set(num(ds['vMargin'], 50));
    this.bannerBreakpoint.set(num(ds['breakpoint'], 440));
    // Responsive behaviour — written by setBannerBehavior; seeded
    // here so the Layout tab's segmented toggle reflects what's
    // actually on the figure when it gets selected.
    const behavior = ds['behavior'] as 'stacked' | 'horizontal' | undefined;
    this.bannerBehavior.set(behavior === 'horizontal' ? 'horizontal' : 'stacked');
    // Column background
    this.colBgKind.set((ds['colBgKind'] as 'color' | 'image' | undefined) ?? 'color');
    this.colBgImage.set(ds['colBgImage'] || '');
    this.colImageOpacity.set(num(ds['colImgOpacity'], 100));
    this.colOverlayColor.set(ds['colOverlayColor'] || '#000000');
    this.colOverlayOpacity.set(num(ds['colOverlayOpacity'], 0));
    const colScaling = (ds['colImgScaling'] as 'cover' | 'contain' | 'fill' | 'tile' | undefined) || 'cover';
    this.colImageScaling.set(['cover','contain','fill','tile'].includes(colScaling) ? colScaling : 'cover');
    this.colImagePosition.set(ds['colImgPos'] || '5');
    this.colFillColor.set(ds['colFillColor']     || '#ffffff');
    this.colFillOpacity.set(num(ds['colFillOpacity'], 0));
    this.colBorderColor.set(ds['colBorderColor'] || '#000000');
    this.colBorderOpacity.set(num(ds['colBorderOpacity'], 0));
    this.colBorderWidth.set(num(ds['colBorderWidth'], 0));
    this.colCornerRadius.set(num(ds['colCornerRadius'], 0));
    const fullH = ds['colFullHeight'] === 'true' || f.classList.contains('is-full-height');
    this.colFullHeight.set(fullH);
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
   *  + data-attrs. Every var is written to the root `section.re-banner`
   *  — CSS variable inheritance carries them down to `.re-banner-backdrop`
   *  (::before), `.re-banner-inner` (::before), and every `.re-banner-cell`
   *  child without any per-descendant queries. Dataset writes are
   *  unchanged — they round-trip through saved HTML and feed
   *  `seedBannerState()` on reload.
   *
   *  Legacy CSS-var names (`--re-banner-bg*`, `--re-col-*`, `--re-banner-cols`,
   *  `--re-banner-gap`, `--re-banner-pad-*`) are intentionally NOT written
   *  here — the new 5-level CSS targets the new var names only. The
   *  compat shim retained in the stylesheet keeps existing legacy
   *  figure-banners visible until they're re-saved into the new
   *  scaffold (at which point this function takes over for them too). */
  private applyBannerStyles(): void {
    const f = this.selectedFigure(); if (!f) return;

    // Shared maps reused by section + inner image controls.
    const sizeMap:  Record<string, string> = { cover: 'cover', contain: 'contain', fill: '100% 100%', tile: 'auto' };
    const posMap:   Record<string, string> = {
      '1': 'left top',   '2': 'center top',   '3': 'right top',
      '4': 'left center','5': 'center center','6': 'right center',
      '7': 'left bottom','8': 'center bottom','9': 'right bottom',
    };

    // Resolve the layout container (the `data-layout-container` div,
    // matching Wix Ricos's element model). When the markup is the new
    // 5-level scaffold we always have one; fall back to the section
    // itself for legacy figure-banners so the writes never blackhole.
    const inner = (f.querySelector('[data-layout-container]') as HTMLElement | null)
      ?? (f.querySelector('.re-banner-inner') as HTMLElement | null);

    // Each Ricos variable is written once on the element the Ricos
    // contract owns (backdrop / cell-padding → wrapper; column-template
    // / background / gap → container). The legacy `--re-banner-*` aliases
    // are mapped in CSS so old rules still work for one release.

    // ─── Backdrop layer (section background) ──────────────────────
    if (this.bannerBgShow()) {
      const kind = this.bannerBgKind();
      if (kind === 'color') {
        const { r, g, b } = hexToRgb(this.bannerBgColor());
        const a = Math.max(0, Math.min(1, this.bannerBgOpacity() / 100));
        f.style.setProperty('--ricos-internal-layout-backdrop-color', `rgba(${r},${g},${b},${a})`);
        f.style.setProperty('--ricos-internal-layout-backdrop-image-src', 'none');
      } else if (kind === 'gradient') {
        f.style.setProperty('--ricos-internal-layout-backdrop-color', 'transparent');
        f.style.setProperty('--ricos-internal-layout-backdrop-image-src', this.bannerBgGradient() || 'none');
      } else {
        f.style.setProperty('--ricos-internal-layout-backdrop-color', 'transparent');
        const bgUrl = this.bannerBgImage();
        f.style.setProperty('--ricos-internal-layout-backdrop-image-src', bgUrl ? `url("${bgUrl}")` : 'none');
      }
      f.dataset['bgShow'] = 'true';
    } else {
      f.style.setProperty('--ricos-internal-layout-backdrop-color', 'transparent');
      f.style.setProperty('--ricos-internal-layout-backdrop-image-src', 'none');
      f.dataset['bgShow'] = 'false';
    }
    f.style.setProperty('--ricos-internal-layout-backdrop-image-opacity',  String(this.sectionImageOpacity() / 100));
    f.style.setProperty('--ricos-internal-layout-backdrop-image-scaling',  sizeMap[this.sectionImageScaling()] ?? 'cover');
    f.style.setProperty('--ricos-internal-layout-backdrop-image-position', posMap[this.sectionImagePosition()] ?? 'center');
    // Backdrop top/bottom padding wells — Wix calls this "Vertical
    // margins" in the panel. It adjusts the inset of the column inside
    // the banner (NOT the banner's outer margin). bannerVMargin is the
    // single source of truth; section margin-block is set to 0 below.
    const vmar = this.bannerVMargin();
    f.style.setProperty('--ricos-internal-layout-backdrop-padding-top',    `${vmar}px`);
    f.style.setProperty('--ricos-internal-layout-backdrop-padding-bottom', `${vmar}px`);

    // Dataset round-trip for the backdrop / section settings.
    f.dataset['bgKind']         = this.bannerBgKind();
    f.dataset['bgColor']        = this.bannerBgColor();
    f.dataset['bgOpacity']      = String(this.bannerBgOpacity());
    f.dataset['bgGradient']     = this.bannerBgGradient();
    f.dataset['bgImage']        = this.bannerBgImage();
    f.dataset['imgOpacity']     = String(this.sectionImageOpacity());
    f.dataset['overlayColor']   = this.sectionOverlayColor();
    f.dataset['overlayOpacity'] = String(this.sectionOverlayOpacity());
    f.dataset['imgScaling']     = this.sectionImageScaling();
    f.dataset['imgPos']         = this.sectionImagePosition();

    // ─── Inner layer (the `[data-layout-container]` grid) ─────────
    // The "Column background" panel paints the FILL on each cell
    // (so the cell's border-radius clips it). The Ricos contract var
    // --ricos-internal-layout-background-color is left transparent on
    // the inner grid; the actual fill goes to --re-cell-bg-color
    // which .re-banner-cell consumes for background-color/-image.
    const target = inner ?? f;
    target.style.setProperty('--ricos-internal-layout-background-color', 'transparent');
    target.style.setProperty('--ricos-internal-layout-background-image-src', 'none');
    if (this.colBgKind() === 'color') {
      const { r, g, b } = hexToRgb(this.colFillColor());
      const a = Math.max(0, Math.min(1, this.colFillOpacity() / 100));
      f.style.setProperty('--re-cell-bg-color', `rgba(${r},${g},${b},${a})`);
      f.style.setProperty('--re-cell-bg-image', 'none');
    } else {
      f.style.setProperty('--re-cell-bg-color', 'transparent');
      const colUrl = this.colBgImage();
      f.style.setProperty('--re-cell-bg-image', colUrl ? `url("${colUrl}")` : 'none');
    }
    f.style.setProperty('--re-cell-bg-image-opacity',  String(this.colImageOpacity() / 100));
    f.style.setProperty('--re-cell-bg-image-scaling',  sizeMap[this.colImageScaling()] ?? 'cover');
    f.style.setProperty('--re-cell-bg-image-position', posMap[this.colImagePosition()] ?? 'center');

    // Columns + gap — Ricos emits the full grid-template-columns
    // expression in `--ricos-internal-layout-column-template`.
    const cols = this.bannerColumns();
    const ratio = clamp(this.bannerColRatio(), 0.15, 0.85);
    const colsTrack = cols === 1
      ? 'minmax(0, 1fr)'
      : `minmax(0, ${ratio.toFixed(3)}fr) minmax(0, ${(1 - ratio).toFixed(3)}fr)`;
    target.style.setProperty('--ricos-internal-layout-column-template', colsTrack);
    target.style.setProperty('--ricos-internal-layout-gap', `${this.bannerColGap()}px`);
    f.dataset['cols']     = String(cols);
    f.dataset['colRatio'] = ratio.toFixed(3);
    f.dataset['gap']      = String(this.bannerColGap());

    // Dataset round-trip for the inner / column settings.
    f.dataset['colBgKind']         = this.colBgKind();
    f.dataset['colBgImage']        = this.colBgImage();
    f.dataset['colImgOpacity']     = String(this.colImageOpacity());
    f.dataset['colOverlayColor']   = this.colOverlayColor();
    f.dataset['colOverlayOpacity'] = String(this.colOverlayOpacity());
    f.dataset['colImgScaling']     = this.colImageScaling();
    f.dataset['colImgPos']         = this.colImagePosition();
    f.dataset['colFillColor']      = this.colFillColor();
    f.dataset['colFillOpacity']    = String(this.colFillOpacity());
    f.dataset['colBorderColor']    = this.colBorderColor();
    f.dataset['colBorderOpacity']  = String(this.colBorderOpacity());
    f.dataset['colBorderWidth']    = String(this.colBorderWidth());
    f.dataset['colCornerRadius']   = String(this.colCornerRadius());

    // Column border / radius — written as CSS vars so .re-banner-cell
    // can pick them up. Previously the panel updated only the dataset
    // (no visual effect on new cells); now the vars actually drive
    // the cell's border + radius.
    const bWidth = clamp(this.colBorderWidth(), 0, 32);
    const bColorHex = this.colBorderColor();
    const bAlpha = clamp(this.colBorderOpacity(), 0, 100) / 100;
    if (bWidth > 0 && bColorHex && bAlpha > 0) {
      const { r, g, b } = hexToRgb(bColorHex);
      f.style.setProperty('--re-cell-border-color', `rgba(${r},${g},${b},${bAlpha})`);
      f.style.setProperty('--re-cell-border-width', `${bWidth}px`);
    } else {
      f.style.setProperty('--re-cell-border-color', 'transparent');
      f.style.setProperty('--re-cell-border-width', '0px');
    }
    f.style.setProperty('--re-cell-radius', `${clamp(this.colCornerRadius(), 0, 200)}px`);

    // ─── Cell layer (padding inside each `[data-layout-cell]`) ────
    f.style.setProperty('--ricos-internal-layout-cell-padding-top',    `${this.bannerColPadTop()}px`);
    f.style.setProperty('--ricos-internal-layout-cell-padding-right',  `${this.bannerColPadRight()}px`);
    f.style.setProperty('--ricos-internal-layout-cell-padding-bottom', `${this.bannerColPadBottom()}px`);
    f.style.setProperty('--ricos-internal-layout-cell-padding-left',   `${this.bannerColPadLeft()}px`);
    f.dataset['padX']      = String(this.bannerColPadX());
    f.dataset['padY']      = String(this.bannerColPadY());
    f.dataset['padTop']    = String(this.bannerColPadTop());
    f.dataset['padRight']  = String(this.bannerColPadRight());
    f.dataset['padBottom'] = String(this.bannerColPadBottom());
    f.dataset['padLeft']   = String(this.bannerColPadLeft());

    // ─── Section outer margin ─────────────────────────────────────
    // bannerVMargin is now routed to the BACKDROP padding (above),
    // not the section's outer margin. The section keeps a minimal
    // default block-margin so consecutive banners don't visually
    // collide. dataset still persists vMargin for round-trip.
    f.style.setProperty('--re-banner-margin', '0px');
    f.dataset['vMargin']    = String(this.bannerVMargin());
    f.dataset['breakpoint'] = String(this.bannerBreakpoint());

    // ─── Responsive @container rule — refresh scope + inline style
    // Each banner carries a stable `scopeBase` (generated by the
    // scaffold builder). Reloaded banners that pre-date step 3 won't
    // have one, so we mint one lazily here. The active breakpoint is
    // appended to make the scope value so the rule re-emits whenever
    // the breakpoint setter fires.
    if (RichEditorComponent.isBannerSection(f)) {
      let scopeBase = f.dataset['scopeBase'];
      if (!scopeBase) {
        scopeBase = this.genBannerScopeBase();
        f.dataset['scopeBase'] = scopeBase;
      }
      const bp = this.bannerBreakpoint();
      const scope = this.bannerScopeValue(scopeBase, bp);
      f.setAttribute('data-layout-scope', scope);
      let styleEl = f.querySelector<HTMLStyleElement>(':scope > style[data-banner-stack]');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.setAttribute('data-banner-stack', '');
        f.appendChild(styleEl);
      }
      const nextRule = this.bannerStackRule(scope, bp, this.bannerBehavior());
      if (styleEl.textContent !== nextRule) styleEl.textContent = nextRule;
    }

    // Overlay layer — compose rgba from sectionOverlayColor +
    // sectionOverlayOpacity and write to --re-banner-overlay-color.
    // The CSS .re-banner-backdrop::after pseudo paints it above the
    // background image but below the cell content (z-index 1).
    const overlayHex = this.sectionOverlayColor();
    const overlayAlpha = clamp(this.sectionOverlayOpacity(), 0, 100) / 100;
    if (overlayHex && overlayAlpha > 0) {
      const { r, g, b } = hexToRgb(overlayHex);
      f.style.setProperty('--re-banner-overlay-color', `rgba(${r},${g},${b},${overlayAlpha})`);
    } else {
      f.style.setProperty('--re-banner-overlay-color', 'transparent');
    }
  }

  // Banner panel setters — each updates the mirror signal then
  // re-applies styles. Kept as one-liners so the template stays
  // readable and the side-effect is localised.
  setBannerBgShow(v: boolean): void { this.bannerBgShow.set(v); this.applyBannerStyles(); this.emit(); }
  setBannerBgKind(v: 'color' | 'gradient' | 'image'): void { this.bannerBgKind.set(v); this.applyBannerStyles(); this.emit(); }
  setBannerBgGradient(v: string): void { this.bannerBgGradient.set(v || ''); this.applyBannerStyles(); this.emit(); }
  setBannerBgColor(v: string): void {
    // Picker's "Clear all" emits an empty string — clear BOTH the
    // colour signal AND the opacity so the picker's [ngModel]
    // round-trip doesn't shove the old colour back in. Restore
    // opacity to 100 when the user picks a real colour next.
    if (v) {
      this.bannerBgColor.set(v);
      if (this.bannerBgOpacity() === 0) this.bannerBgOpacity.set(100);
    } else {
      this.bannerBgColor.set('');
      this.bannerBgOpacity.set(0);
    }
    this.applyBannerStyles();
    this.emit();
  }
  setBannerBgOpacity(v: number): void { this.bannerBgOpacity.set(clamp(v, 0, 100)); this.applyBannerStyles(); this.emit(); }

  /** ColorsPanel emitted a new value — route into colour or gradient
   *  storage based on the string shape. Switches `bannerBgKind` away
   *  from `image` only when no image is set, so an uploaded image keeps
   *  winning until the user explicitly removes it. */
  onColorsPanelChange(v: string): void {
    if (!v) return;
    const isGradient = v.startsWith('linear-gradient') || v.startsWith('radial-gradient');
    if (isGradient) {
      this.bannerBgGradient.set(v);
      this.bgPanelMode.set('gradient');
    } else {
      this.bannerBgColor.set(v);
      if (this.bannerBgOpacity() === 0) this.bannerBgOpacity.set(100);
      this.bgPanelMode.set('color');
    }
    if (this.bannerBgKind() !== 'image') {
      this.bannerBgKind.set(isGradient ? 'gradient' : 'color');
    }
    this.applyBannerStyles();
    this.emit();
  }

  /** Panel tab switched — mirror the mode so the trigger preview tracks
   *  the new tab even before the user edits a value. */
  onColorsPanelMode(m: 'color' | 'gradient'): void {
    this.bgPanelMode.set(m);
    if (this.bannerBgKind() !== 'image') {
      this.bannerBgKind.set(m);
      this.applyBannerStyles();
      this.emit();
    }
  }

  /** Color / Image segmented switch. Picking 'color' reverts to the
   *  last panel-mode kind (color or gradient); picking 'image' promotes
   *  to image (the image picker handles the upload). */
  switchBgMode(mode: 'color' | 'image'): void {
    if (mode === 'image') {
      this.bannerBgKind.set('image');
    } else {
      this.bannerBgKind.set(this.bgPanelMode());
    }
    this.applyBannerStyles();
    this.emit();
  }

  /** Remove the uploaded background image and fall back to the last
   *  colour/gradient choice. The image URL is wiped so the empty-tile
   *  placeholder shows up again. */
  clearBannerBgImage(): void {
    this.bannerBgImage.set('');
    this.bannerBgKind.set(this.bgPanelMode());
    this.applyBannerStyles();
    this.emit();
  }
  setBannerColumns(v: 1 | 2): void {
    this.bannerColumns.set(v);
    const f = this.selectedFigure();
    const cols = f?.querySelectorAll<HTMLElement>(RichEditorComponent.COL_SELECTOR);
    // Going from 2 → 1: MERGE the extra column(s) into the first one
    // instead of deleting them. Move each extra cell's content
    // children into the first cell so the user's text isn't lost.
    // (Matches Wix's "Merged" semantics — the merge button combines
    // columns, it doesn't drop their content.)
    if (cols && cols.length > v) {
      const keep = cols[0];
      const keepContent = (keep.querySelector(':scope > [data-layout-cell-content]') as HTMLElement | null) ?? keep;
      for (let i = v; i < cols.length; i++) {
        const extra = cols[i];
        const extraContent = (extra.querySelector(':scope > [data-layout-cell-content]') as HTMLElement | null) ?? extra;
        // Move every child of the extra cell's content into the
        // surviving cell's content. Iterates with a static snapshot
        // because the live NodeList shifts as we append.
        Array.from(extraContent.childNodes).forEach((node) => {
          // Skip empty text nodes — they're just whitespace artifacts.
          if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim()) return;
          keepContent.appendChild(node);
        });
        extra.remove();
      }
    }
    // Reset ratio when going to 1-col so a future switch back to 2-col
    // doesn't surprise the user with a remembered uneven split.
    if (v === 1) this.bannerColRatio.set(0.5);
    this.applyBannerStyles();
    if (f) this.ensureColDivider(f);
    this.emit();
  }
  setBannerGap(v: number): void { this.bannerColGap.set(clamp(v, 0, 200)); this.applyBannerStyles(); this.emit(); }
  setBannerPadX(v: number): void { this.bannerColPadX.set(clamp(v, 0, 200)); this.applyBannerStyles(); this.emit(); }
  setBannerPadY(v: number): void { this.bannerColPadY.set(clamp(v, 0, 200)); this.applyBannerStyles(); this.emit(); }

  /** Per-edge padding setters — only ever fired from the 4-chip
   *  "Edit individually" mode (bannerPadLinked() === true). Each
   *  setter updates only its own edge; the X/Y legacy mirrors are
   *  kept in step with the most-recent axis-mate so old consumers
   *  reading padX / padY still get a sane value. */
  setBannerPadTop(v: number): void {
    const n = clamp(v, 0, 200);
    this.bannerColPadTop.set(n);
    this.bannerColPadY.set(Math.round((this.bannerColPadTop() + this.bannerColPadBottom()) / 2));
    this.applyBannerStyles(); this.emit();
  }
  setBannerPadRight(v: number): void {
    const n = clamp(v, 0, 200);
    this.bannerColPadRight.set(n);
    this.bannerColPadX.set(Math.round((this.bannerColPadLeft() + this.bannerColPadRight()) / 2));
    this.applyBannerStyles(); this.emit();
  }
  setBannerPadBottom(v: number): void {
    const n = clamp(v, 0, 200);
    this.bannerColPadBottom.set(n);
    this.bannerColPadY.set(Math.round((this.bannerColPadTop() + this.bannerColPadBottom()) / 2));
    this.applyBannerStyles(); this.emit();
  }
  setBannerPadLeft(v: number): void {
    const n = clamp(v, 0, 200);
    this.bannerColPadLeft.set(n);
    this.bannerColPadX.set(Math.round((this.bannerColPadLeft() + this.bannerColPadRight()) / 2));
    this.applyBannerStyles(); this.emit();
  }
  setBannerVMargin(v: number): void { this.bannerVMargin.set(clamp(v, 0, 200)); this.applyBannerStyles(); this.emit(); }
  setBannerBreakpoint(v: number): void { this.bannerBreakpoint.set(clamp(v, 200, 1600)); this.applyBannerStyles(); this.emit(); }

  /** Toggle the link icon on Column padding. Toggle OFF (default)
   *  shows two chips — Horizontal (X = left/right) and Vertical
   *  (Y = top/bottom). Toggle ON opens to four chips, one per edge,
   *  letting the user edit each side individually. */
  toggleBannerPadLinked(): void {
    const next = !this.bannerPadLinked();
    this.bannerPadLinked.set(next);
    if (next) {
      // Switching ON (individual mode): make sure the 4 edges
      // reflect the current X/Y so the chips that just appeared
      // show values that match what was rendering a moment ago.
      this.bannerColPadLeft.set(this.bannerColPadX());
      this.bannerColPadRight.set(this.bannerColPadX());
      this.bannerColPadTop.set(this.bannerColPadY());
      this.bannerColPadBottom.set(this.bannerColPadY());
    }
  }
  /** Linked-mode (default, toggle off) handlers — when the user
   *  types into the Horizontal chip, mirror the value into both the
   *  left and right edges so the apply path renders it on both sides.
   *  Same for vertical mapping to top + bottom. */
  onPadX(v: number): void {
    const n = clamp(v, 0, 200);
    this.bannerColPadX.set(n);
    this.bannerColPadLeft.set(n);
    this.bannerColPadRight.set(n);
    this.applyBannerStyles(); this.emit();
  }
  onPadY(v: number): void {
    const n = clamp(v, 0, 200);
    this.bannerColPadY.set(n);
    this.bannerColPadTop.set(n);
    this.bannerColPadBottom.set(n);
    this.applyBannerStyles(); this.emit();
  }

  // ─── Column-background setters ───
  setColBgKind(v: 'color' | 'image'): void { this.colBgKind.set(v); this.applyBannerStyles(); this.emit(); }
  setColBgImage(url: string): void {
    this.colBgImage.set(url || '');
    if (url) this.colBgKind.set('image');
    this.applyBannerStyles(); this.emit();
  }
  /** Public API for the parent to call after picking from its own
   *  media-library modal. */
  pickColBgImage(): void { this.colBgImageClick.emit(); }

  /** Emits `cellImageClick` so the host can launch its own media
   *  library. The host then calls `replaceCellImagePlaceholder` with
   *  the chosen URL to swap the placeholder for an <img>. No native
   *  file-picker fallback — picking always goes through the host. */
  pickCellImage(placeholderEl: HTMLElement): void {
    this.cellImageClick.emit(placeholderEl);
  }

  /** Replace an "Add image" placeholder slot with an <img> element
   *  whose `src` is the given URL. Keeps the wrapping `data-cell-image`
   *  container so subsequent clicks can re-open the picker. */
  replaceCellImagePlaceholder(placeholderEl: HTMLElement, url: string): void {
    const slot = (placeholderEl.closest('[data-cell-image]') as HTMLElement | null) ?? placeholderEl.parentElement ?? placeholderEl;
    slot.innerHTML = `<img src="${url}" alt="" style="display:block;width:100%;height:auto;border-radius:4px;" />`;
    this.emit();
  }
  clearColBgImage(): void {
    this.colBgImage.set('');
    this.colBgKind.set('color');
    this.applyBannerStyles(); this.emit();
  }
  setColImageOpacity(v: number): void { this.colImageOpacity.set(clamp(v, 0, 100)); this.applyBannerStyles(); this.emit(); }
  setColOverlayColor(v: string): void { this.colOverlayColor.set(v || '#000000'); this.applyBannerStyles(); this.emit(); }
  setColOverlayOpacity(v: number): void { this.colOverlayOpacity.set(clamp(v, 0, 100)); this.applyBannerStyles(); this.emit(); }
  setColImageScaling(v: 'cover' | 'contain' | 'fill' | 'tile'): void { this.colImageScaling.set(v); this.applyBannerStyles(); this.emit(); }
  setColImagePosition(v: string): void { this.colImagePosition.set(v); this.applyBannerStyles(); this.emit(); }
  setColFillColor(v: string): void {
    if (v) {
      this.colFillColor.set(v);
      if (this.colFillOpacity() === 0) this.colFillOpacity.set(100);
    } else {
      this.colFillColor.set('');
      this.colFillOpacity.set(0);
    }
    this.applyBannerStyles();
    this.emit();
  }
  setColFillOpacity(v: number): void { this.colFillOpacity.set(clamp(v, 0, 100)); this.applyBannerStyles(); this.emit(); }
  setColBorderColor(v: string): void {
    if (v) {
      this.colBorderColor.set(v);
      if (this.colBorderOpacity() === 0) this.colBorderOpacity.set(100);
    } else {
      this.colBorderColor.set('');
      this.colBorderOpacity.set(0);
    }
    this.applyBannerStyles();
    this.emit();
  }
  setColBorderOpacity(v: number): void { this.colBorderOpacity.set(clamp(v, 0, 100)); this.applyBannerStyles(); this.emit(); }
  setColBorderWidth(v: number): void { this.colBorderWidth.set(clamp(v, 0, 32)); this.applyBannerStyles(); this.emit(); }
  setColCornerRadius(v: number): void { this.colCornerRadius.set(clamp(v, 0, 200)); this.applyBannerStyles(); this.emit(); }
  /** Apply vertical-content alignment to the selected cell. Writes
   *  inline `justify-content` since the cell is a flex column, and
   *  persists via `data-valign` on the cell so it round-trips. */
  setCellVAlign(v: 'top' | 'middle' | 'bottom'): void {
    this.cellVAlign.set(v);
    // Apply per-cell: justifyContent on the flex column. Only visible
    // when the cell has extra vertical space (e.g. full-height mode
    // or a tall sibling pushing the row), but kept so 2-col banners
    // with mismatched content heights still respect per-cell choice.
    const col = this.selectedColumn();
    if (col) {
      const jc = v === 'top' ? 'flex-start' : v === 'bottom' ? 'flex-end' : 'center';
      col.style.justifyContent = jc;
      col.dataset['valign'] = v;
    }
    // Also drive the banner-level vertical alignment so the toolbar
    // button has an immediately visible effect on a normal-height
    // banner (where the cell itself has no extra height to use).
    this.setBannerVAlign(v === 'top' ? 'top' : v === 'bottom' ? 'bottom' : 'middle');
  }
  /** Apply horizontal-content alignment (text-align) to the selected
   *  cell. Cascades into every text node inside. */
  setCellHAlign(v: 'left' | 'center' | 'right'): void {
    this.cellHAlign.set(v);
    const col = this.selectedColumn();
    if (!col) return;
    col.style.textAlign = v;
    col.dataset['halign'] = v;
    this.emit();
  }
  /** Seed cellVAlign / cellHAlign signals from the selected cell so
   *  the toolbar reflects the cell's current state on selection. */
  private syncCellAlignment(col: HTMLElement | null): void {
    if (!col) { this.cellVAlign.set('top'); this.cellHAlign.set('left'); return; }
    const v = col.dataset['valign'] as 'top' | 'middle' | 'bottom' | undefined;
    const h = col.dataset['halign'] as 'left' | 'center' | 'right' | undefined;
    this.cellVAlign.set(v ?? 'top');
    this.cellHAlign.set(h ?? 'left');
  }

  setColFullHeight(v: boolean): void {
    this.colFullHeight.set(v);
    const f = this.selectedFigure();
    if (f) {
      f.classList.toggle('is-full-height', v);
      f.dataset['colFullHeight'] = v ? 'true' : 'false';
    }
    this.emit();
  }

  // ─── Section image-extras setters ───
  setSectionImageOpacity(v: number): void { this.sectionImageOpacity.set(clamp(v, 0, 100)); this.applyBannerStyles(); this.emit(); }
  setSectionOverlayColor(v: string): void {
    if (v) {
      this.sectionOverlayColor.set(v);
      if (this.sectionOverlayOpacity() === 0) this.sectionOverlayOpacity.set(100);
    } else {
      this.sectionOverlayColor.set('');
      this.sectionOverlayOpacity.set(0);
    }
    this.applyBannerStyles();
    this.emit();
  }
  setSectionOverlayOpacity(v: number): void { this.sectionOverlayOpacity.set(clamp(v, 0, 100)); this.applyBannerStyles(); this.emit(); }
  setSectionImageScaling(v: 'cover' | 'contain' | 'fill' | 'tile'): void { this.sectionImageScaling.set(v); this.applyBannerStyles(); this.emit(); }
  setSectionImagePosition(v: string): void { this.sectionImagePosition.set(v); this.applyBannerStyles(); this.emit(); }

  setBannerBehavior(v: 'stacked' | 'horizontal'): void {
    this.bannerBehavior.set(v);
    const f = this.selectedFigure();
    if (f) f.dataset['behavior'] = v;
    // Re-emit the @container rule so the new behavior takes effect
    // (bannerStackRule reads bannerBehavior()).
    this.applyBannerStyles();
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
      // Loaded HTML may contain banners without editable bookends —
      // add empty paragraphs around them so the user can reach the
      // caret position immediately before/after each banner.
      this.ensureBannerBookends();
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
      .replace(/\sis-selected-col(?=["\s])/g, '')
      .replace(/\sis-resizing(?=["\s])/g, '')
      .replace(/\sre-cell-elem-active(?=["\s])/g, '')
      .replace(/<div[^>]*class="re__resizer[^"]*"[^>]*><\/div>/g, '')
      .replace(/<div[^>]*class="re__radiusGrip[^"]*"[^>]*><\/div>/g, '')
      .replace(/<div[^>]*class="re__radiusChip[^"]*"[^>]*>[\s\S]*?<\/div>/g, '')
      .replace(/<span[^>]*class="re-banner-col-handle[^"]*"[^>]*><\/span>/g, '')
      // Section-banner interactive overlays — both the cell drag-grip
      // (attached on selection) and the four resize handles (created
      // by buildBannerScaffold but re-added on load if missing). Both
      // are transient runtime decoration; the persisted markup keeps
      // only the structural backdrop / resizer / inner / cell nodes.
      .replace(/<span[^>]*class="re-banner-cell-handle[^"]*"[^>]*>[\s\S]*?<\/span>/g, '')
      .replace(/<span[^>]*class="re-banner-handle[^"]*"[^>]*><\/span>/g, '')
      .replace(/<span[^>]*class="re-banner-marker[^"]*"[^>]*><\/span>/g, '')
      .replace(/<span[^>]*class="re-banner-col-divider[^"]*"[^>]*><\/span>/g, '');
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

  /** Built-in title textarea handlers. The textarea is opt-in via the
   *  showTitle() input. We mirror to the titleValue signal (drives the
   *  auto-grow rows + char counter) and emit titleChange so the caller
   *  can two-way bind. Clamping to titleMaxLength is also enforced by
   *  the textarea's maxlength attribute. */
  onTitleInput(ev: Event): void {
    const ta = ev.target as HTMLTextAreaElement;
    const max = Math.max(1, this.titleMaxLength());
    const next = (ta.value ?? '').slice(0, max);
    if (next !== ta.value) ta.value = next;
    this.titleValue.set(next);
    this.titleChange.emit(next);
  }
  onTitleFocus(): void { this.titleFocused.set(true); }
  onTitleBlur():  void { this.titleFocused.set(false); }
  /** Roughly compute textarea rows from the current value so the
   *  field grows with content. Uses newline count + a coarse wrap
   *  estimate; the textarea also has `field-sizing: content` in CSS
   *  as a progressive enhancement for browsers that support it. */
  titleRows = computed<number>(() => {
    const v = this.titleValue();
    const explicit = (v.match(/\n/g)?.length ?? 0) + 1;
    const wrapped  = Math.ceil(v.length / 60);
    return Math.max(1, Math.min(8, Math.max(explicit, wrapped)));
  });

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
  /** Insert a fresh `<section class="re-banner">` block at the caret
   *  position. This is the public entry point for the "Banner" tile in
   *  the Add panel — it builds the same shape that
   *  `imageFigureToSectionBanner` produces (overlay + column with a
   *  placeholder paragraph), so banner behaviour is identical whether
   *  the section was inserted directly or converted from an image. */
  /** Built-in banner presets. Each one wraps a config that the
   *  insert flow applies to the freshly-scaffolded section: bg,
   *  columns, padding, cell content. Designed to be a small,
   *  curated set (matches the Wix preset row). */
  readonly bannerPresets = [
    {
      id: 'hero-card',
      name: 'Hero card',
      description: 'Soft background + centred title card',
      config: {
        bgColor: '#e0f2fe', columns: 1 as 1, vAlign: 'middle' as const,
        colFillColor: '#ffffff', colFillOpacity: 100, colCornerRadius: 8,
        padTop: 32, padRight: 40, padBottom: 32, padLeft: 40, vMargin: 24,
        cells: [{
          html: '<h2 style="margin:0 0 8px;text-align:center;">WELCOME</h2>'
              + '<p style="margin:0 0 16px;text-align:center;color:#475569;">Discover what makes us different. Start your journey with us today.</p>'
              + '<p style="text-align:center;"><a href="#" style="display:inline-block;padding:8px 20px;background:#0f172a;color:#fff;border-radius:4px;text-decoration:none;font-size:14px;">Read more</a></p>',
        }],
      },
    },
    {
      id: 'minimal',
      name: 'Minimal centered',
      description: 'Clean light background, centred content',
      config: {
        bgColor: '#f1f5f9', columns: 1 as 1, vAlign: 'middle' as const,
        colCornerRadius: 0,
        padTop: 32, padRight: 40, padBottom: 32, padLeft: 40, vMargin: 0,
        cells: [{
          html: '<h2 style="margin:0 0 8px;text-align:center;">Grow Your Vision</h2>'
              + '<p style="margin:0 0 16px;text-align:center;color:#475569;font-size:14px;">A short sentence explaining your purpose and value.</p>'
              + '<p style="text-align:center;"><a href="#" style="display:inline-block;padding:8px 20px;background:#0f172a;color:#fff;border-radius:4px;text-decoration:none;font-size:14px;">Read more</a></p>',
        }],
      },
    },
    {
      id: 'split',
      name: 'Text + image',
      description: 'Two columns: text on the left, image on the right',
      config: {
        bgColor: '#ffffff', columns: 2 as 2, vAlign: 'middle' as const,
        padTop: 24, padRight: 24, padBottom: 24, padLeft: 24, vMargin: 16,
        cells: [
          {
            html: '<h2 style="margin:0 0 8px;color:#b45309;">Empower Growth</h2>'
                + '<p style="margin:0 0 16px;color:#475569;font-size:14px;">A short paragraph explaining your offering.</p>'
                + '<p><a href="#" style="display:inline-block;padding:8px 20px;background:#0f172a;color:#fff;border-radius:4px;text-decoration:none;font-size:14px;">Read more</a></p>',
          },
          {
            html: '<div data-cell-image contenteditable="false" style="background:#e6f7fa;height:160px;border-radius:4px;overflow:hidden;">'
                + '<button type="button" data-add-image style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:transparent;border:none;color:#32acc1;font:500 14px/1.2 inherit;cursor:pointer;">'
                +   '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M19 5h-3l-1.5-2h-5L8 5H5C3.9 5 3 5.9 3 7v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-7 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"/></svg>'
                +   '<span>Add image</span>'
                + '</button>'
                + '</div>',
          },
        ],
      },
    },
    {
      id: 'dark',
      name: 'Dark hero',
      description: 'Dark background with bold title and supporting text',
      config: {
        bgColor: '#1f2937', columns: 2 as 2, vAlign: 'middle' as const,
        padTop: 32, padRight: 32, padBottom: 32, padLeft: 32, vMargin: 24,
        cells: [
          { html: '<h2 style="margin:0;color:#ffffff;font-size:24px;line-height:1.2;">Welcome<br>to Our Site</h2>' },
          { html: '<p style="margin:0;color:#cbd5e1;font-size:14px;line-height:1.6;">A short paragraph that supports the headline. Replace this with your own content.</p>' },
        ],
      },
    },
    {
      id: 'blank',
      name: 'Blank',
      description: 'Start with an empty banner',
      config: {
        bgColor: '#ffffff', columns: 1 as 1, vAlign: 'middle' as const,
        padTop: 18, padRight: 0, padBottom: 18, padLeft: 0, vMargin: 0,
        cells: [{ html: '<p>Add your text</p>' }],
      },
    },
  ] as const;

  private modalService = inject(ModalService);

  /** Open the preset picker via the project's ModalService — the
   *  picker emits the chosen preset id through ModalRef.close(); we
   *  then build the banner from that preset. Dismiss (close button /
   *  backdrop) returns undefined, no insert happens. */
  insertBanner(): void {
    const ref = this.modalService.open<BannerPresetPickerComponent, BannerPresetPickerData, string>(
      BannerPresetPickerComponent,
      {
        size: 'md',
        data: { presets: this.bannerPresets.map(p => ({ id: p.id, name: p.name, description: p.description })) },
      },
    );
    ref.afterClosed().then((id) => {
      if (id) this.applyBannerPreset(id);
    });
  }

  /** Apply a chosen preset (or `null` for "Blank") then insert the
   *  resulting banner at the caret. Replaces the cell content with
   *  the preset's sample HTML so the inserted banner looks polished
   *  out of the box. */
  applyBannerPreset(presetId: string): void {
    const preset = this.bannerPresets.find((p) => p.id === presetId) ?? this.bannerPresets[this.bannerPresets.length - 1];
    const cfg = preset.config;

    const section = this.buildBannerScaffold();
    section.dataset['bgShow']    = 'true';
    section.dataset['bgKind']    = 'color';
    section.dataset['bgColor']   = cfg.bgColor ?? '#ffffff';
    section.dataset['bgOpacity'] = '100';
    section.dataset['cols']      = String(cfg.columns);
    section.dataset['vAlign']    = cfg.vAlign ?? 'middle';
    if (cfg.padTop    !== undefined) section.dataset['padTop']    = String(cfg.padTop);
    if (cfg.padRight  !== undefined) section.dataset['padRight']  = String(cfg.padRight);
    if (cfg.padBottom !== undefined) section.dataset['padBottom'] = String(cfg.padBottom);
    if (cfg.padLeft   !== undefined) section.dataset['padLeft']   = String(cfg.padLeft);
    if (cfg.vMargin   !== undefined) section.dataset['vMargin']   = String(cfg.vMargin);
    if ('colFillColor' in cfg)   section.dataset['colFillColor']   = (cfg as { colFillColor?: string }).colFillColor ?? '';
    if ('colFillOpacity' in cfg) section.dataset['colFillOpacity'] = String((cfg as { colFillOpacity?: number }).colFillOpacity ?? 0);
    if ('colCornerRadius' in cfg) section.dataset['colCornerRadius'] = String((cfg as { colCornerRadius?: number }).colCornerRadius ?? 0);

    // Vertical-align class — cast through string so TS doesn't narrow
    // cfg.vAlign down to a single literal (all presets happen to use
    // 'middle', but future presets may pick top/bottom).
    section.classList.remove('re-banner-vtop', 're-banner-vmid', 're-banner-vbot');
    const va = (cfg.vAlign as string) ?? 'middle';
    section.classList.add(va === 'top' ? 're-banner-vtop' : va === 'bottom' ? 're-banner-vbot' : 're-banner-vmid');

    // Rebuild cells from the preset spec.
    const inner = section.querySelector(':scope > .re-banner-backdrop > .re-banner-resizer > .re-banner-inner') as HTMLElement | null;
    if (inner) {
      // Clear the default cell and re-add one per preset spec.
      Array.from(inner.querySelectorAll(':scope > .re-banner-cell')).forEach((c) => c.remove());
      cfg.cells.forEach((cellSpec) => {
        const cell = this.buildBannerCell();
        const content = cell.querySelector(':scope > .re-banner-cell-content') as HTMLElement | null;
        if (content) content.innerHTML = cellSpec.html;
        inner.appendChild(cell);
      });
    }

    this.insertHtml(section.outerHTML);
    const inserted = this.editable.nativeElement.querySelector('section.re-banner:last-of-type') as HTMLElement | null;
    if (inserted) {
      this.selectFigure(inserted);
      this.openFigPanel('settings');
    }
  }


  insertHtml(html: string): void {
    if (!html) return;
    this.editable.nativeElement.focus();
    const sel = window.getSelection();
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const frag = tpl.content.cloneNode(true) as DocumentFragment;
    const lastNode = frag.lastChild;

    // Block banner-inside-banner: if the new content includes a
    // banner section AND the insertion target is inside an existing
    // banner, escape to AFTER the outer banner so we never produce
    // a nested layout-wrapper tree.
    const fragHasBanner = !!(tpl.content.querySelector('section.re-banner, [data-layout-banner]'));
    if (fragHasBanner) {
      const col = this.selectedColumn();
      const caretEl = sel && sel.rangeCount > 0
        ? (sel.getRangeAt(0).startContainer.nodeType === Node.ELEMENT_NODE
            ? sel.getRangeAt(0).startContainer as Element
            : sel.getRangeAt(0).startContainer.parentElement)
        : null;
      const outerBanner = (col?.closest('section.re-banner') as HTMLElement | null)
                       ?? (caretEl?.closest('section.re-banner') as HTMLElement | null)
                       ?? (this.cellElementRef?.closest('section.re-banner') as HTMLElement | null);
      if (outerBanner && outerBanner.parentNode) {
        const insertedFirst = frag.firstChild as Node | null;
        outerBanner.parentNode.insertBefore(frag, outerBanner.nextSibling);
        this.ensureBannerBookends();
        // Drop the caret into the bookend AFTER the new banner so the
        // user has a reachable cursor position instead of landing on
        // the banner itself (contenteditable=false → no caret).
        const newBanner = (insertedFirst && insertedFirst.nodeType === Node.ELEMENT_NODE && (insertedFirst as Element).matches('section.re-banner'))
          ? insertedFirst as HTMLElement
          : (lastNode && lastNode.nodeType === Node.ELEMENT_NODE && (lastNode as Element).matches('section.re-banner'))
              ? lastNode as HTMLElement
              : null;
        const trailing = newBanner?.nextElementSibling as HTMLElement | null;
        if (trailing && trailing.tagName === 'P') this.placeCaretAtStart(trailing);
        this.emit();
        this.refreshState();
        return;
      }
    }

    // If a banner column is currently selected (the user just focused
    // a cell), insert INTO that cell's content area instead of at the
    // document caret. Without this, picking "Image" or "Button" from
    // the side panel would drop the element at the top-level after
    // the banner, not inside the focused column.
    const col = this.selectedColumn();
    if (col) {
      const target = (col.querySelector(':scope > [data-layout-cell-content]') as HTMLElement | null) ?? col;
      target.appendChild(frag);
      // Park caret at the end of the appended content so subsequent
      // typing continues inside the cell.
      if (lastNode) {
        const after = document.createRange();
        after.setStartAfter(lastNode);
        after.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(after);
      }
      this.normalizeBlockNesting();
      this.emit();
      this.refreshState();
      return;
    }

    if (!sel || sel.rangeCount === 0) {
      // No caret yet — append at the end.
      this.editable.nativeElement.insertAdjacentHTML('beforeend', html);
      this.emit();
      this.refreshState();
      return;
    }

    // Check if the caret sits inside an element that CAN'T hold the
    // inserted block (an <a>, <button>, <img>, etc. — inline / void
    // wrappers). If so, escape to the nearest block ancestor and
    // insert AFTER it, so a Banner doesn't end up wedged inside a
    // button's anchor markup. Picked-element ref also forces this
    // route since clicking a button doesn't always move the caret.
    const range = sel.getRangeAt(0);
    if (!range.collapsed) range.deleteContents();
    const anchorEl = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : (range.startContainer.parentElement as Element | null);
    const inlineWrap = (anchorEl?.closest('a, button, img') as HTMLElement | null)
                    ?? (this.cellElementRef && (this.cellElementRef.matches('a, button, img') ? this.cellElementRef : null));
    if (inlineWrap && this.editable.nativeElement.contains(inlineWrap)) {
      const block = (inlineWrap.closest('p, h1, h2, h3, h4, h5, h6, blockquote, li, div, section, figure') as HTMLElement | null) ?? inlineWrap;
      // Insert AFTER the block — keeps the inserted content as a
      // sibling of the host paragraph rather than nesting it inside
      // the inline button/anchor wrapper.
      const parent = block.parentNode;
      if (parent) {
        parent.insertBefore(frag, block.nextSibling);
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
        return;
      }
    }

    const insertedFirst = frag.firstChild as Node | null;
    range.insertNode(frag);

    // If the inserted content is (or contains) a banner, drop the
    // caret into the editable bookend after it so the user can keep
    // typing/pressing Enter — banners themselves are contenteditable
    // =false and won't accept the caret.
    const insertedBanner = (insertedFirst && insertedFirst.nodeType === Node.ELEMENT_NODE
        && (insertedFirst as Element).matches('section.re-banner, [data-layout-banner]'))
      ? insertedFirst as HTMLElement
      : null;
    this.ensureBannerBookends();
    if (insertedBanner) {
      const trailing = insertedBanner.nextElementSibling as HTMLElement | null;
      if (trailing && trailing.tagName === 'P') this.placeCaretAtStart(trailing);
    } else if (lastNode) {
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

  /** Banners (and other top-level contenteditable=false blocks) reject
   *  the caret, so without an editable paragraph immediately before /
   *  after them the user can't position the cursor next to the block
   *  to type or press Enter. Walk every banner and add empty
   *  `<p><br></p>` bookends where missing. Safe to call repeatedly —
   *  only inserts a bookend when the neighbour is missing or another
   *  contenteditable=false block. */
  private ensureBannerBookends(): void {
    const editable = this.editable?.nativeElement;
    if (!editable) return;
    const banners = editable.querySelectorAll<HTMLElement>('section.re-banner, [data-layout-banner]');
    const makeBookend = (): HTMLElement => {
      const p = document.createElement('p');
      p.appendChild(document.createElement('br'));
      return p;
    };
    const needsBookend = (n: ChildNode | null): boolean => {
      if (!n) return true;
      if (n.nodeType !== Node.ELEMENT_NODE) return false;
      const el = n as Element;
      // An adjacent text/inline content keeps the caret reachable; only
      // bookend when the neighbour is another non-editable block.
      if (el.matches('section.re-banner, [data-layout-banner], figure, hr')) return true;
      return false;
    };
    banners.forEach((b) => {
      const parent = b.parentElement;
      if (!parent) return;
      if (needsBookend(b.previousSibling)) parent.insertBefore(makeBookend(), b);
      if (needsBookend(b.nextSibling))     parent.insertBefore(makeBookend(), b.nextSibling);
    });
  }

  /** Place the caret at the very start of a node — used to drop the
   *  user into a freshly-created bookend paragraph after inserting a
   *  banner so they immediately have a reachable editable spot. */
  private placeCaretAtStart(node: Node): void {
    const sel = window.getSelection(); if (!sel) return;
    const r = document.createRange();
    r.setStart(node, 0);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
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

  /** Font-size dropdown — wraps the selection in a span style font-size Xpx.
   *  Falls back to `execCommand('fontSize', '1-7')` only if no selection. */
  pickSize(ev: Event, sizePx: string): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    this.applyInlineStyle('font-size', `${sizePx}px`);
    this.currentSize.set(sizePx);
    this.closeMenu();
    this.emit();
  }

  /** Commit a font-size from the toolbar's number input (Ricos pattern
   *  — typing a number then Enter / blur applies it to the selection).
   *  Clamps to a sane range and only commits valid integers; an empty
   *  value or non-numeric input is ignored (caret formatting stays). */
  commitSizeFromInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const raw = (input.value ?? '').trim();
    if (!raw) { input.value = this.currentSize(); return; }
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n) || n <= 0) { input.value = this.currentSize(); return; }
    const clamped = Math.max(6, Math.min(200, n));
    const sizePx = String(clamped);
    input.value = sizePx;
    this.editable.nativeElement.focus();
    this.applyInlineStyle('font-size', `${sizePx}px`);
    this.currentSize.set(sizePx);
    this.emit();
  }
  /** Pressing Enter inside the size input commits + blurs (closes the
   *  keyboard on touch devices and gives a clear "committed" affordance). */
  onSizeInputKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      (ev.target as HTMLInputElement).blur();
    }
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
    // The chip-anchored slider popovers are position:fixed — if the
    // page scrolls while one is visible, re-anchor it to the chip so
    // it doesn't drift off-screen.
    this.repositionVisibleFigSliders();
  }

  /** Sliders are `position: fixed` so they escape the panel's
   *  overflow-clipping. That means we set their top/left explicitly,
   *  relative to the matching chip's viewport rect, on focusin and on
   *  scroll. The host-level focusin captures every chip in any panel
   *  variant — no per-row plumbing. */
  @HostListener('focusin', ['$event'])
  onHostFocusIn(ev: FocusEvent): void {
    const t = ev.target as HTMLElement | null;
    if (!t) return;
    // Either the chip's number-input or the slider itself can have
    // focus — both should keep the popover anchored.
    const chip = t.closest('.re__figTbNum') as HTMLElement | null;
    if (chip) {
      const row = chip.closest('.re__figRow') as HTMLElement | null;
      const slider = (chip.parentElement?.querySelector(':scope > .re__figSlider') as HTMLElement | null)
                  ?? (row?.querySelector('.re__figSlider') as HTMLElement | null);
      if (slider) {
        this.activateFigSlider(slider);
        this.positionFigSlider(chip, slider);
      }
      return;
    }
    const slider = t.closest('.re__figSlider') as HTMLElement | null;
    if (slider) {
      const row = slider.closest('.re__figRow') as HTMLElement | null;
      const chipSibling = (slider.parentElement?.querySelector(':scope > .re__figTbNum') as HTMLElement | null)
                       ?? (row?.querySelector('.re__figTbNum') as HTMLElement | null);
      if (chipSibling) {
        this.activateFigSlider(slider);
        this.positionFigSlider(chipSibling, slider);
      }
    }
  }

  @HostListener('focusout', ['$event'])
  onHostFocusOut(ev: FocusEvent): void {
    const t = ev.target as HTMLElement | null;
    if (!t) return;
    const row = t.closest('.re__figRow') as HTMLElement | null;
    if (!row) return;
    const slider = row.querySelector('.re__figSlider') as HTMLElement | null;
    if (!slider) return;
    // Defer to next tick so focus moving from chip → slider (or
    // slider → chip) within the same row doesn't briefly hide the
    // popover.
    setTimeout(() => {
      if (!row.contains(document.activeElement)) {
        slider.classList.remove('is-active');
        slider.style.opacity = '';
        slider.style.visibility = '';
        slider.style.transform = '';
      }
    }, 0);
  }

  private activateFigSlider(slider: HTMLElement): void {
    slider.classList.add('is-active');
    // Inline overrides bypass any CSS specificity surprises from
    // Angular's view-encapsulation rewrite when the slider is
    // rendered inside the <app-re-slider> child component.
    slider.style.opacity = '1';
    slider.style.visibility = 'visible';
    slider.style.transform = 'translateX(0) scale(1)';
  }

  private positionFigSlider(chip: HTMLElement, slider: HTMLElement): void {
    const r = chip.getBoundingClientRect();
    const width = slider.offsetWidth || 88;
    const sliderH = slider.offsetHeight || 28;
    // Place the slider 8px to the RIGHT of the chip, vertically
    // centred on it (Wix-style side popover). If the right edge
    // would overflow the viewport, fall back to the chip's left side
    // — keeps the slider always reachable on narrow viewports.
    let left = r.right + 8;
    if (left + width > window.innerWidth - 8) left = Math.max(8, r.left - width - 8);
    const top = r.top + (r.height - sliderH) / 2;
    // Inline position:fixed defends against any encapsulation case
    // where the base CSS rule isn't applying through the wrapper.
    slider.style.position = 'fixed';
    slider.style.zIndex = '9999';
    slider.style.left = `${left}px`;
    slider.style.top  = `${top}px`;
  }

  private repositionVisibleFigSliders(): void {
    const host = this.editable?.nativeElement?.parentElement;
    if (!host) return;
    const sliders = host.querySelectorAll('.re__figSlider');
    sliders.forEach((s) => {
      const el = s as HTMLElement;
      // Only reposition if currently visible (focus-within made it
      // opaque). Skip hidden ones to save layout work.
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') return;
      // Chip lookup — direct sibling for the legacy inline slider, or
      // the chip in the same row when the slider is wrapped in
      // <app-re-slider>.
      const row = el.closest('.re__figRow') as HTMLElement | null;
      const chip = (el.parentElement?.querySelector(':scope > .re__figTbNum') as HTMLElement | null)
                ?? (row?.querySelector('.re__figTbNum') as HTMLElement | null);
      if (chip) this.positionFigSlider(chip, el);
    });
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
    const target = e.target as HTMLElement | null;
    const inInput = !!target?.closest('input, textarea, [contenteditable="true"]');
    if (inInput) return;
    // Per-element toolbar takes priority — if a button/image inside
    // a cell is picked, Delete removes that element instead of the
    // whole banner.
    if (this.cellElementToolbar().type && this.cellElementRef) {
      e.preventDefault();
      this.deleteCellElement();
      return;
    }
    if (!this.selectedFigure()) return;
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

    // Keep ArrowUp / ArrowDown inside the editable surface even when
    // the caret is at the very first / last position. Without this,
    // pressing ArrowUp at the top edge of the editor can hand focus
    // back to the previous tab-stop (the page title input or one of
    // the toolbar buttons), at which point a follow-up Enter
    // accidentally activates that button or submits the input.
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const editable = this.editable?.nativeElement;
      const sel = window.getSelection();
      if (editable && sel && sel.rangeCount > 0 && editable.contains(sel.anchorNode)) {
        // Make sure there's always an editable bookend the caret can
        // land in at the boundary, then let the browser do its
        // normal caret traversal. Stay-in-bounds is enforced by the
        // bookend (a `<p><br></p>` sibling of whatever non-editable
        // block sits at the edge).
        this.ensureBannerBookends();
      }
      return;
    }

    if (e.key !== 'Enter' || e.shiftKey) return;

    const editable = this.editable?.nativeElement;
    const sel = window.getSelection();
    if (!editable || !sel || sel.rangeCount === 0) return;

    // Look for an <li> ancestor first — the caret may be inside a
    // <p>/<div> nested inside the <li> (some browsers and paste paths
    // produce `<li><p>…</p></li>`), in which case `nearestBlock`
    // would return the inner block and miss the list. Empty <li> →
    // exit list; non-empty <li> → split the <li> at the caret so a
    // fresh sibling <li> is created deterministically (Chromium's
    // default Enter inside lists is the same `insertParagraph` path
    // that's been flaky for plain blocks).
    const li = this.findAncestor(sel.anchorNode, editable, 'LI');
    if (li) {
      const isEmpty = (li.textContent ?? '').trim() === '';
      e.preventDefault();
      if (isEmpty) {
        this.exitListAtCaret(li);
      } else {
        this.splitListItemAtCaret(li);
      }
      this.normalizeBlockNesting();
      this.emit();
      this.refreshState();
      return;
    }

    const block = this.nearestBlock(sel.anchorNode, editable);

    e.preventDefault();
    // If there's no block ancestor yet (fresh editor, raw text
    // nodes), wrap the current line in <p> before splitting so the
    // resulting structure stays valid.
    if (!block) document.execCommand('formatBlock', false, '<p>');

    // When the caret is at the very start (or end) of a paragraph
    // that wraps a styled inline like `<a class="re-btn-block">`,
    // splitting via extractContents() clones the wrapper and leaves
    // a hollow empty copy behind (e.g. an empty styled button chip).
    // Detect those edge positions and instead create a fresh
    // `<p><br></p>` sibling — keeps the original block intact.
    //
    // Only fire this path when the block actually has substantive
    // content (text or a styled inline). For an already-empty
    // paragraph, fall through to the standard split — otherwise
    // every Enter press in an empty `<p><br></p>` would spawn a
    // new empty sibling and stack them indefinitely.
    const range = sel.getRangeAt(0);
    const liveBlock = this.nearestBlock(sel.anchorNode, editable);
    if (liveBlock && this.blockHasSubstance(liveBlock)
        && this.caretAtStartOfBlock(range, liveBlock)) {
      this.insertEmptyParagraph('before', liveBlock);
    } else if (liveBlock && this.blockHasSubstance(liveBlock)
        && this.caretAtEndOfBlock(range, liveBlock)) {
      this.insertEmptyParagraph('after', liveBlock);
    } else {
      this.insertParagraphAtCaret();
    }
    this.normalizeBlockNesting();
    this.emit();
    this.refreshState();
  }

  /** True when the block contains real content — visible text or a
   *  styled inline wrapper that we don't want extractContents() to
   *  clone on split. Used to gate the "Enter at start/end of block"
   *  shortcut so it never fires inside a placeholder `<p><br></p>`. */
  private blockHasSubstance(block: HTMLElement): boolean {
    if ((block.textContent ?? '').trim().length > 0) return true;
    return !!block.querySelector('a.re-btn-block, img, button, video, iframe');
  }

  /** True when nothing of substance sits between the block's start
   *  and the caret — used to detect "Enter before this element"
   *  positions where splitting would clone styled inline wrappers
   *  (e.g. an `<a class="re-btn-block">`). */
  private caretAtStartOfBlock(range: Range, block: HTMLElement): boolean {
    const r = document.createRange();
    r.setStart(block, 0);
    r.setEnd(range.startContainer, range.startOffset);
    return (r.cloneContents().textContent ?? '').length === 0;
  }
  private caretAtEndOfBlock(range: Range, block: HTMLElement): boolean {
    const r = document.createRange();
    r.setStart(range.endContainer, range.endOffset);
    if (block.lastChild) r.setEndAfter(block.lastChild); else r.setEnd(block, 0);
    return (r.cloneContents().textContent ?? '').length === 0;
  }
  /** Insert an empty `<p><br></p>` sibling of `block` on the chosen
   *  side and park the caret in it. Leaves `block` untouched so
   *  styled inlines inside it aren't cloned by a split. */
  private insertEmptyParagraph(where: 'before' | 'after', block: HTMLElement): void {
    const newP = document.createElement('p');
    newP.appendChild(document.createElement('br'));
    const parent = block.parentNode;
    if (!parent) return;
    if (where === 'before') parent.insertBefore(newP, block);
    else                    parent.insertBefore(newP, block.nextSibling);
    this.placeCaretAtStart(newP);
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

  /** Walk up from `start` to find the nearest ancestor with the
   *  given tag, bounded by `editable`. Used by Enter handling to
   *  detect an `<li>` even when a `<p>`/`<div>` sits between the
   *  caret and the list item. */
  private findAncestor(start: Node | null, editable: HTMLElement, tag: string): HTMLElement | null {
    let node: Node | null = start;
    while (node && node !== editable) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === tag) {
        return node as HTMLElement;
      }
      node = node.parentNode;
    }
    return null;
  }

  /** Split the current `<li>` at the caret and create a fresh
   *  sibling `<li>` after it that owns the tail content. Caret is
   *  parked at the start of the new item. Owning this rather than
   *  relying on Chromium's default Enter keeps list-item creation
   *  deterministic even when the caret sits in a nested `<p>` or
   *  inline span. */
  private splitListItemAtCaret(li: HTMLElement): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) range.deleteContents();

    // Tail = everything from the caret to the end of the <li>.
    const tail = document.createRange();
    tail.setStart(range.startContainer, range.startOffset);
    tail.setEndAfter(li.lastChild ?? li);

    const newLi = document.createElement('li');
    newLi.appendChild(tail.extractContents());
    if (!newLi.textContent && newLi.children.length === 0) {
      newLi.appendChild(document.createElement('br'));
    }
    // If the source <li> just emptied, keep it visible with a <br>.
    if (!li.textContent && li.children.length === 0) {
      li.appendChild(document.createElement('br'));
    }
    li.parentNode!.insertBefore(newLi, li.nextSibling);

    const caret = document.createRange();
    caret.setStart(newLi, 0);
    caret.collapse(true);
    sel.removeAllRanges();
    sel.addRange(caret);
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

/** Parse a CSS rgb(...) / rgba(...) string and return a #rrggbb hex.
 *  Returns the empty string when the input doesn't look like a colour
 *  the editor can round-trip (transparent, currentColor, etc.). */
function rgbToHex(rgb: string): string {
  const s = (rgb || '').trim();
  if (!s || s === 'transparent') return '';
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (!m) return '';
  const to = (n: string) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0');
  return `#${to(m[1])}${to(m[2])}${to(m[3])}`;
}

/** Read the alpha channel from an rgba(...) CSS string and return it
 *  as a 0–100 percentage. rgb(...) (no alpha) or unparseable inputs
 *  default to 100. */
function rgbaAlphaPct(rgb: string): number {
  const s = (rgb || '').trim();
  if (!s || s === 'transparent') return 0;
  const m = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/.exec(s);
  if (!m) return 100;
  const a = Number(m[1]);
  return Number.isFinite(a) ? Math.max(0, Math.min(100, a * 100)) : 100;
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
