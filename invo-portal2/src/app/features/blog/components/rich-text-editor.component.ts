import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { BLOG_API } from '../services/blog-api';
import { estimateReadingTime } from '../utils/blog-utils';

/**
 * Minimal-but-functional rich text editor backed by the browser's
 * `contenteditable` API and `document.execCommand`. Chosen over a
 * heavyweight (TipTap / CKEditor) dependency so this slice ships
 * without pulling new packages into the bundle.
 *
 * Features the composer relies on:
 *   - Bold / italic, H2 / H3, ul / ol, blockquote, code, divider, link
 *   - Image upload via `BLOG_API.upload(file)` → inserted as `<img>`
 *   - Hashtag autocomplete: typing `#` triggers a popover with matching
 *     hashtag suggestions queried from the API (debounced).
 *   - Live word count + reading-time estimate (200 wpm).
 *
 * The component is uncontrolled — the editable div owns its DOM. The
 * parent reads/writes via `value` + `valueChange`; we re-seed the HTML
 * when `value` changes from outside (e.g. language tab switch).
 */
@Component({
  selector: 'app-blog-rich-text-editor',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rte" [class.is-rtl]="rtl()">
      <div class="rte__toolbar">
        <button type="button" class="rte__btn" title="Heading 2" (click)="cmd('formatBlock', 'h2')">H2</button>
        <button type="button" class="rte__btn" title="Heading 3" (click)="cmd('formatBlock', 'h3')">H3</button>
        <span class="rte__sep"></span>
        <button type="button" class="rte__btn rte__btn--icon" title="Bold"   (click)="cmd('bold')"><b>B</b></button>
        <button type="button" class="rte__btn rte__btn--icon" title="Italic" (click)="cmd('italic')"><i>I</i></button>
        <span class="rte__sep"></span>
        <button type="button" class="rte__btn rte__btn--icon" title="Bullet list"  (click)="cmd('insertUnorderedList')">•</button>
        <button type="button" class="rte__btn rte__btn--icon" title="Numbered list"(click)="cmd('insertOrderedList')">1.</button>
        <button type="button" class="rte__btn rte__btn--icon" title="Quote" (click)="cmd('formatBlock', 'blockquote')">"</button>
        <button type="button" class="rte__btn rte__btn--icon" title="Code"  (click)="wrapCode()">&lt;/&gt;</button>
        <span class="rte__sep"></span>
        <button type="button" class="rte__btn" title="Link"    (click)="promptLink()">Link</button>
        <button type="button" class="rte__btn" title="Image"   (click)="filePicker.click()">Image</button>
        <button type="button" class="rte__btn" title="Divider" (click)="cmd('insertHorizontalRule')">—</button>
        <input #filePicker type="file" accept="image/*" hidden (change)="onImageFile($any($event.target).files)"/>
      </div>

      <div #editor
           class="rte__area"
           contenteditable="true"
           [attr.dir]="rtl() ? 'rtl' : 'ltr'"
           (input)="onInput()"
           (keydown)="onKeydown($event)"
           (mouseup)="closeHashtagMenu()"
      ></div>

      @if (hashtagOpen()) {
        <div class="rte__hashtag" [style.top.px]="hashtagPos().top" [style.left.px]="hashtagPos().left">
          @for (s of hashtagSuggestions(); track s) {
            <button type="button" class="rte__hashtagItem" (click)="pickHashtag(s)">
              #{{ s }}
            </button>
          } @empty {
            <span class="rte__hashtagEmpty">{{ 'BLOG.COMPOSER.NO_HASHTAGS' | translate }}</span>
          }
        </div>
      }

      <div class="rte__foot">
        <span>{{ wordCount() }} {{ 'BLOG.COMPOSER.WORDS' | translate }}</span>
        <span>·</span>
        <span>{{ readingTime() }} {{ 'BLOG.COMPOSER.MIN_READ' | translate }}</span>
      </div>
    </div>
  `,
  styles: [`
    .rte {
      position: relative;
      display: flex;
      flex-direction: column;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .rte__toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px;
      padding: 6px 8px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .rte__btn {
      padding: 4px 8px;
      min-width: 28px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
    }
    .rte__btn:hover { background: #fff; border-color: #e2e8f0; color: #0f172a; }
    .rte__btn--icon b, .rte__btn--icon i { font-weight: 700; font-style: normal; }
    .rte__btn--icon i { font-style: italic; }
    .rte__sep {
      width: 1px;
      height: 16px;
      background: #e2e8f0;
      margin: 0 4px;
    }
    .rte__area {
      min-height: 360px;
      padding: 16px 18px;
      font-size: 15px;
      line-height: 1.6;
      color: #0f172a;
      outline: none;
    }
    .rte.is-rtl .rte__area { direction: rtl; text-align: right; }
    .rte__area :where(h2) { font-size: 22px; font-weight: 700; margin: 18px 0 8px; }
    .rte__area :where(h3) { font-size: 18px; font-weight: 600; margin: 14px 0 6px; }
    .rte__area :where(blockquote) {
      margin: 12px 0; padding: 8px 14px;
      border-inline-start: 3px solid #cbd5e1;
      background: #f8fafc; color: #475569;
    }
    .rte__area :where(code) {
      background: #f1f5f9; padding: 1px 6px; border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px;
    }
    .rte__area :where(ul, ol) { padding-inline-start: 24px; }
    .rte__area :where(img) { max-width: 100%; border-radius: 8px; margin: 6px 0; }
    .rte__area :where(a) { color: #0e7490; text-decoration: underline; }
    .rte__area :where(hr) { margin: 18px 0; border: 0; border-top: 1px solid #e2e8f0; }

    .rte__foot {
      display: flex;
      gap: 8px;
      padding: 6px 12px;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      background: #fafbfc;
    }

    .rte__hashtag {
      position: fixed;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(15,23,42,.08);
      padding: 4px;
      min-width: 180px;
      max-height: 220px;
      overflow-y: auto;
      z-index: 1000;
    }
    .rte__hashtagItem {
      display: block;
      width: 100%;
      padding: 6px 10px;
      text-align: start;
      background: transparent;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      color: #0f172a;
      cursor: pointer;
    }
    .rte__hashtagItem:hover { background: #f1f5f9; }
    .rte__hashtagEmpty {
      display: block;
      padding: 8px 10px;
      font-size: 12px;
      color: #94a3b8;
    }
  `],
})
export class RichTextEditorComponent {
  private api = inject(BLOG_API);

  // ── Inputs ─────────────────────────────────────────────────────────
  value = input<string>('');
  rtl   = input<boolean>(false);

  // ── Outputs ────────────────────────────────────────────────────────
  valueChange = output<string>();

  // ── DOM ────────────────────────────────────────────────────────────
  @ViewChild('editor', { static: true }) editorRef!: ElementRef<HTMLDivElement>;

  // ── State ──────────────────────────────────────────────────────────
  private syncedValue = signal<string>('');
  hashtagOpen        = signal(false);
  hashtagSuggestions = signal<string[]>([]);
  hashtagPos         = signal<{ top: number; left: number }>({ top: 0, left: 0 });
  private hashtagQuery = signal('');
  private hashtagTimer: any = null;
  private rangeBeforePicker: Range | null = null;

  wordCount   = computed(() => {
    const text = this.syncedValue().replace(/<[^>]*>/g, ' ');
    return text.split(/\s+/).filter(Boolean).length;
  });
  readingTime = computed(() => estimateReadingTime(this.syncedValue()));

  constructor() {
    // Re-seed the editor when the parent replaces the value (e.g. switching
    // language tab). Avoid round-trips: only re-set innerHTML when the
    // outside value differs from our last synced one.
    effect(() => {
      const v = this.value() ?? '';
      if (v === this.syncedValue()) return;
      this.syncedValue.set(v);
      if (this.editorRef?.nativeElement && this.editorRef.nativeElement.innerHTML !== v) {
        this.editorRef.nativeElement.innerHTML = v;
      }
    });
  }

  // ── Commands ───────────────────────────────────────────────────────
  cmd(command: string, arg?: string): void {
    this.editorRef.nativeElement.focus();
    document.execCommand(command, false, arg);
    this.onInput();
  }

  promptLink(): void {
    const url = window.prompt('https://…');
    if (!url) return;
    this.cmd('createLink', url);
  }

  wrapCode(): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const code = document.createElement('code');
    code.textContent = range.toString();
    range.deleteContents();
    range.insertNode(code);
    sel.removeAllRanges();
    this.onInput();
  }

  async onImageFile(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) return;
    const { url } = await this.api.upload(file);
    this.cmd('insertImage', url);
  }

  // ── Input handler ──────────────────────────────────────────────────
  onInput(): void {
    const html = this.editorRef.nativeElement.innerHTML;
    this.syncedValue.set(html);
    this.valueChange.emit(html);
    this.maybeOpenHashtag();
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.hashtagOpen()) {
      this.hashtagOpen.set(false);
    }
  }

  // ── Hashtag autocomplete ───────────────────────────────────────────
  private maybeOpenHashtag(): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return this.closeHashtagMenu();
    const range = sel.getRangeAt(0);
    const node  = range.endContainer;
    if (node.nodeType !== Node.TEXT_NODE) return this.closeHashtagMenu();

    const text = (node.textContent ?? '').slice(0, range.endOffset);
    // Look for the last `#word` immediately preceding the caret.
    const match = text.match(/#([\p{L}\p{N}_]*)$/u);
    if (!match) return this.closeHashtagMenu();

    this.rangeBeforePicker = range.cloneRange();
    const query = match[1] ?? '';
    this.hashtagQuery.set(query);

    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    this.hashtagPos.set({ top: rect.bottom + 4, left: rect.left });
    this.hashtagOpen.set(true);

    if (this.hashtagTimer) clearTimeout(this.hashtagTimer);
    this.hashtagTimer = setTimeout(() => this.loadHashtagSuggestions(query), 180);
  }

  private async loadHashtagSuggestions(q: string): Promise<void> {
    try {
      const rows = await this.api.listTaxonomies({ taxonomyType: 'hashtag', search: q });
      this.hashtagSuggestions.set(rows.slice(0, 8).map(r => r.slug));
    } catch {
      this.hashtagSuggestions.set([]);
    }
  }

  pickHashtag(name: string): void {
    const range = this.rangeBeforePicker;
    if (!range) { this.closeHashtagMenu(); return; }

    // Replace the partial `#xxx` typed so far with the full tag.
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);

    const node = range.endContainer;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      const start = text.slice(0, range.endOffset).search(/#[\p{L}\p{N}_]*$/u);
      if (start >= 0) {
        const before = text.slice(0, start);
        const after  = text.slice(range.endOffset);
        (node as Text).textContent = `${before}#${name} ${after}`;
        const newRange = document.createRange();
        newRange.setStart(node, before.length + name.length + 2);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    }
    this.closeHashtagMenu();
    this.onInput();
  }

  closeHashtagMenu(): void {
    if (this.hashtagOpen()) this.hashtagOpen.set(false);
  }

  @HostListener('window:click', ['$event'])
  onWindowClick(e: MouseEvent): void {
    if (!this.hashtagOpen()) return;
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.rte__hashtag') && !target?.closest('.rte__area')) {
      this.closeHashtagMenu();
    }
  }
}
