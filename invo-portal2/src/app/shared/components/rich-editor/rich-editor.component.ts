import {
  AfterViewInit,
  ChangeDetectionStrategy,
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
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Tiny built-in WYSIWYG editor — zero third-party dependencies.
 *
 * Relies on the venerable (deprecated-but-still-universally-supported)
 * `document.execCommand` to apply formatting to the selection inside a
 * single `contenteditable` root, and reads the resulting innerHTML back out
 * as the model value. Implements `ControlValueAccessor` so it plugs into
 * reactive forms, template-driven forms, and the `[(value)]` signal
 * shorthand interchangeably.
 *
 * Toolbar: Bold / Italic / Underline / Heading / Bullet list / Numbered
 * list / Link / Unlink / Quote / Clear formatting.
 *
 * Intentionally small — if you need image uploads, tables, or a block-level
 * structured model, reach for a proper editor (ProseMirror / Lexical /
 * TipTap). This one handles ~95% of product-description-sized text and
 * preserves the pasted content as plain text (strips rich HTML on paste so
 * editors don't smuggle in attacker-supplied styles).
 */
@Component({
  selector: 'app-rich-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
      <!-- Toolbar — most buttons are disabled in HTML-source mode. -->
      <div class="re__toolbar" role="toolbar" [attr.aria-disabled]="disabled()">
        <ng-container *ngIf="mode() === 'wysiwyg'">
          <button type="button" class="re__btn" (mousedown)="cmd($event, 'bold')" title="Bold">
            <span class="re__btn-label"><b>B</b></span>
          </button>
          <button type="button" class="re__btn" (mousedown)="cmd($event, 'italic')" title="Italic">
            <span class="re__btn-label"><i>I</i></span>
          </button>
          <button type="button" class="re__btn" (mousedown)="cmd($event, 'underline')" title="Underline">
            <span class="re__btn-label"><u>U</u></span>
          </button>

          <span class="re__sep"></span>

          <button type="button" class="re__btn" (mousedown)="heading($event, 'H2')" title="Heading">
            <span class="re__btn-label">H<sub>2</sub></span>
          </button>
          <button type="button" class="re__btn" (mousedown)="heading($event, 'H3')" title="Subheading">
            <span class="re__btn-label">H<sub>3</sub></span>
          </button>
          <button type="button" class="re__btn" (mousedown)="heading($event, 'P')" title="Paragraph">
            <span class="re__btn-label">P</span>
          </button>

          <span class="re__sep"></span>

          <button type="button" class="re__btn" (mousedown)="cmd($event, 'insertUnorderedList')" title="Bullet list">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/>
              <line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <button type="button" class="re__btn" (mousedown)="cmd($event, 'insertOrderedList')" title="Numbered list">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <text x="1" y="8" font-size="6" fill="currentColor" stroke="none" font-family="system-ui">1</text>
              <text x="1" y="14" font-size="6" fill="currentColor" stroke="none" font-family="system-ui">2</text>
              <text x="1" y="20" font-size="6" fill="currentColor" stroke="none" font-family="system-ui">3</text>
              <line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <button type="button" class="re__btn" (mousedown)="cmd($event, 'formatBlock', 'BLOCKQUOTE')" title="Quote">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M3 21c3 0 3-3 3-6V9H3v6h3"/><path d="M14 21c3 0 3-3 3-6V9h-3v6h3"/>
            </svg>
          </button>

          <span class="re__sep"></span>

          <button type="button" class="re__btn" (mousedown)="linkPrompt($event)" title="Insert link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </button>
          <button type="button" class="re__btn" (mousedown)="cmd($event, 'unlink')" title="Remove link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 4L6 20"/>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            </svg>
          </button>

          <span class="re__sep"></span>

          <button type="button" class="re__btn" (mousedown)="cmd($event, 'removeFormat')" title="Clear formatting">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 7V4h16v3"/><path d="M5 20l14-16"/><path d="M9 20h6"/>
            </svg>
          </button>
        </ng-container>

        <!-- Spacer pushes the mode toggle to the end -->
        <span class="re__spacer"></span>

        <!-- Mode toggle — always visible -->
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

      &:focus-within {
        border-color: #32acc1;
        box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.15);
      }

      &--disabled { opacity: .65; pointer-events: none; }
    }

    .re__toolbar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 6px 8px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }

    .re__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      color: #475569;
      cursor: pointer;
      transition: background .12s, color .12s, border-color .12s;
      font-size: 13px;
      line-height: 1;

      &:hover {
        background: #e6f7fa;
        color: #0f172a;
        border-color: #cfeef3;
      }
      &:active { background: #d4f0f5; }
    }

    .re__btn-label {
      font-weight: 600;
      font-family: system-ui, sans-serif;

      sub { font-size: 10px; vertical-align: sub; }
    }

    .re__sep {
      width: 1px;
      align-self: stretch;
      background: #e2e8f0;
      margin: 2px 4px;
    }

    .re__spacer {
      flex: 1 1 auto;
    }

    .re__btn--toggle {
      width: auto;
      padding: 0 8px;
      gap: 6px;
      color: #475569;
      border-color: #e2e8f0;

      &-on {
        background: #eff9fb;
        border-color: #a6d8df;
        color: #0f172a;
      }
    }

    .re__btn-label--text {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .4px;
      text-transform: uppercase;
    }

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

      &:focus { background: #fff; }
      &:disabled { opacity: .7; background: #f1f5f9; }
    }

    .re__surface {
      padding: 10px 14px;
      outline: none;
      font-size: 14px;
      line-height: 1.55;
      color: #1e293b;

      &:empty::before {
        content: attr(data-placeholder);
        color: #94a3b8;
        pointer-events: none;
      }

      p { margin: 0 0 8px; }
      h2 { font-size: 18px; font-weight: 600; margin: 12px 0 6px; }
      h3 { font-size: 16px; font-weight: 600; margin: 10px 0 6px; }
      ul, ol { margin: 4px 0 8px; padding-inline-start: 24px; }
      li { margin-bottom: 2px; }
      a  { color: #32acc1; text-decoration: underline; }
      blockquote {
        margin: 6px 0;
        padding: 6px 12px;
        border-inline-start: 3px solid #cbd5e1;
        color: #64748b;
        font-style: italic;
      }
      code {
        background: #f1f5f9;
        padding: 1px 4px;
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
      }
    }
  `],
})
export class RichEditorComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  private sanitizer = inject(DomSanitizer);

  /** Optional placeholder shown when the editor is empty. */
  placeholder = input<string>('');
  /** Minimum editor height. Defaults to 180px — override per usage. */
  height      = input<string>('180px');
  /** Lets the parent observe blur/commit events (on top of CVA onChange). */
  changed = output<string>();

  disabled = signal(false);

  /** `'wysiwyg'` (default) shows the visual editor; `'html'` shows a raw textarea. */
  mode = signal<'wysiwyg' | 'html'>('wysiwyg');
  /** Mirror of the current HTML shown in the source textarea while in html mode. */
  htmlSource = signal<string>('');

  @ViewChild('editable', { static: true }) editable!: ElementRef<HTMLDivElement>;

  // ControlValueAccessor plumbing
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};
  private pendingValue = '';
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.setHtml(this.pendingValue);
  }

  ngOnDestroy(): void {
    // Nothing to clean up — no subscriptions or document listeners beyond HostListener.
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

  onInput(): void { this.emit(); }
  onBlur(): void { this.onTouched(); this.emit(); }

  // ─── HTML source view ───────────────────────────────────────────────────
  /** Toolbar action — flip between WYSIWYG and raw HTML textarea. */
  toggleMode(ev: Event): void {
    ev.preventDefault();
    if (this.mode() === 'wysiwyg') {
      // Flush the latest innerHTML into the textarea before switching.
      this.htmlSource.set(this.editable.nativeElement.innerHTML);
      this.mode.set('html');
    } else {
      // Apply the textarea content back onto the editable element on flip.
      this.setHtml(this.htmlSource());
      this.mode.set('wysiwyg');
      this.emit();
    }
  }

  /** Fires on every keystroke in the HTML textarea. Pushes up through CVA. */
  onHtmlInput(raw: string): void {
    this.htmlSource.set(raw ?? '');
    this.onChange(raw ?? '');
    this.changed.emit(raw ?? '');
  }

  /**
   * Strip formatting from pasted content — avoids users injecting arbitrary
   * styles / external CSS. Text-only paste keeps things predictable.
   */
  onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    document.execCommand('insertText', false, text);
    this.emit();
  }

  // ─── Toolbar handlers ───────────────────────────────────────────────────
  /** mousedown instead of click — preserves the active selection in the editor. */
  cmd(ev: Event, command: string, value?: string): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    document.execCommand(command, false, value);
    this.emit();
  }

  heading(ev: Event, tag: 'H2' | 'H3' | 'P'): void {
    // execCommand formatBlock needs the block tag wrapped in angle brackets
    // on some browsers; others accept bare names. Use both forms defensively.
    ev.preventDefault();
    this.editable.nativeElement.focus();
    document.execCommand('formatBlock', false, `<${tag}>`) ||
      document.execCommand('formatBlock', false, tag);
    this.emit();
  }

  linkPrompt(ev: Event): void {
    ev.preventDefault();
    this.editable.nativeElement.focus();
    const url = window.prompt('Link URL', 'https://');
    if (!url) return;
    // Basic sanity check — block `javascript:` schemes.
    if (/^\s*javascript:/i.test(url)) return;
    document.execCommand('createLink', false, url);
    this.emit();
  }

  // Intercept some key combos so we don't stop the browser doing its thing
  // but we do emit on common edits.
  @HostListener('keydown', ['$event'])
  onKeydown(_e: KeyboardEvent): void { /* no-op; input event handles value sync */ }
}
