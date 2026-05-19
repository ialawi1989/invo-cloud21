import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { SEO_VARIABLE_GROUPS, SeoVariable } from './seo-variables';

/**
 * SEO template input with a "+ Add Variable" dropdown.
 *
 * Renders a contenteditable field where every `{{ token }}` is
 * shown as a black pill (atomic, non-editable inside) and free text
 * flows around it. Picking a variable inserts a fresh chip at the
 * caret position. Persistence shape stays a plain template string
 * with `{{ varName }}` markers, so the storefront renderer keeps
 * working unchanged.
 *
 * The variables popover is rendered as a **detached DOM tree**
 * appended to the drawer's overlay pane (or document.body when not
 * inside one). That way it can never be clipped by the drawer's
 * `overflow: auto` body, and it survives Angular's view encapsulation
 * because we own its DOM directly. Position is computed from the
 * trigger button's `getBoundingClientRect()` on open / scroll / resize.
 */
@Component({
  selector: 'app-seo-var-input',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The popover and chip elements are created via raw DOM
  // (`document.createElement`) and appended outside the component
  // subtree — the popover into the drawer's overlay pane so it can
  // escape `overflow: auto`, chips into the contenteditable. Angular's
  // emulated encapsulation tags only template-rendered elements with
  // the host's `_ngcontent` attribute, so encapsulated styles never
  // match those detached nodes. Switching to `None` lets the
  // component's CSS apply globally. Class names are namespaced under
  // `vi__*` to keep collisions unlikely.
  encapsulation: ViewEncapsulation.None,
  templateUrl: './seo-var-input.component.html',
  styleUrl: './seo-var-input.component.scss',
})
export class SeoVarInputComponent implements AfterViewInit, OnDestroy {
  private translate = inject(TranslateService);

  /** Field label shown above the input. */
  label       = input<string>('');
  /** When true, render a multi-line editor instead of single-line. */
  textarea    = input<boolean>(false);
  /** Optional placeholder for the field. */
  placeholder = input<string>('');
  /** Bound value — current template string with `{{ token }}` markers. */
  value       = input<string>('');

  /** Emits the patched string after a token is inserted or the user
   *  edits the contenteditable. */
  valueChange = output<string>();

  /** Element ref for the underlying contenteditable. */
  @ViewChild('field')  field?: ElementRef<HTMLDivElement>;
  /** "+ Add Variable" trigger button — used as the anchor for the
   *  portalled popover's position. */
  @ViewChild('addBtn') addBtn?: ElementRef<HTMLButtonElement>;

  readonly groups = SEO_VARIABLE_GROUPS;

  /** Popover visibility — drives `togglePopover()`. */
  open = signal(false);

  /** Map of token → localised display label, used to paint chips
   *  with human text on insert / initial render. */
  private labelByToken = new Map<string, string>();

  constructor(host: ElementRef<HTMLElement>) {
    this.hostEl = host.nativeElement;
    for (const g of SEO_VARIABLE_GROUPS) {
      for (const v of g.variables) {
        this.labelByToken.set(v.token, this.translate.instant(v.labelKey));
      }
    }

    // Re-render the contenteditable when the bound `value` changes
    // from an external source (e.g. parent Discard / slug switch).
    // The serialize-then-compare check skips the rewrite during
    // normal typing so the caret position stays intact.
    effect(() => {
      const next = this.value() ?? '';
      const el   = untracked(() => this.field?.nativeElement);
      if (!el) return;
      const current = serializeNode(el);
      if (current === next) return;
      el.innerHTML = renderTemplateToHtml(next, this.labelByToken);
    });
  }

  ngAfterViewInit(): void {
    const el = this.field?.nativeElement;
    if (el) el.innerHTML = renderTemplateToHtml(this.value() ?? '', this.labelByToken);
  }

  ngOnDestroy(): void { this.destroyPopover(); }

  // ─── Popover (portalled to escape drawer overflow) ──────────────────────
  private popoverEl: HTMLDivElement | null = null;
  /** Container we appended the popover to, so we can clean up on
   *  destroy / close without re-walking the DOM. */
  private popoverHost: HTMLElement | null = null;

  togglePopover(): void {
    if (this.open()) {
      this.destroyPopover();
      this.open.set(false);
    } else {
      this.captureRange();
      this.openPopover();
      this.open.set(true);
    }
  }

  private openPopover(): void {
    // Anchor inside the drawer's overlay pane when present — the
    // pane has the slide-in transform so we use absolute positioning
    // relative to its client rect. Falls back to body otherwise.
    const host =
      this.hostEl.closest<HTMLElement>('.cdk-overlay-pane') ??
      this.hostEl.closest<HTMLElement>('.cdk-overlay-container') ??
      document.body;
    this.popoverHost = host;

    const pop = document.createElement('div');
    pop.className = 'vi__popover';
    pop.setAttribute('role', 'listbox');
    pop.appendChild(this.renderPopoverContents());
    host.appendChild(pop);
    this.popoverEl = pop;

    this.positionPopover();
  }

  private destroyPopover(): void {
    this.popoverEl?.remove();
    this.popoverEl = null;
    this.popoverHost = null;
  }

  /** Build the popover body — sticky group headers + clickable
   *  variable rows. Items dispatch through the directive's own
   *  `pick()` method so the caret-restore + serialise + emit path
   *  stays in one place. */
  private renderPopoverContents(): DocumentFragment {
    const frag = document.createDocumentFragment();
    for (const g of SEO_VARIABLE_GROUPS) {
      const h = document.createElement('div');
      h.className = 'vi__group-head';
      h.textContent = this.translate.instant(g.labelKey);
      frag.appendChild(h);

      for (const v of g.variables) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vi__item';
        btn.setAttribute('role', 'option');

        const title = document.createElement('span');
        title.className = 'vi__item-title';
        title.textContent = this.translate.instant(v.labelKey);
        btn.appendChild(title);

        if (v.hintKey) {
          const hint = document.createElement('span');
          hint.className = 'vi__item-hint';
          hint.textContent = this.translate.instant(v.hintKey);
          btn.appendChild(hint);
        }

        btn.addEventListener('click', () => this.pick(v));
        frag.appendChild(btn);
      }
    }
    return frag;
  }

  /** Compute the popover's absolute position from the trigger
   *  button's viewport rect. When the popover lives inside an
   *  overlay pane (which has its own transform), translate the
   *  viewport coords into pane-local space. */
  private positionPopover(): void {
    const btn = this.addBtn?.nativeElement;
    const pop = this.popoverEl;
    const host = this.popoverHost;
    if (!btn || !pop || !host) return;

    const btnRect  = btn.getBoundingClientRect();
    const hostRect = host === document.body
      ? { left: 0, top: 0 }
      : host.getBoundingClientRect();

    pop.style.position = 'absolute';
    pop.style.top  = `${Math.round(btnRect.bottom - hostRect.top + 4)}px`;
    // Anchor by the right edge so the popover stays aligned with
    // the trigger label even on RTL pages and tight columns.
    pop.style.left = `${Math.round(btnRect.right - hostRect.left - pop.offsetWidth)}px`;
  }

  /** Reposition the popover on scroll / resize while open — the
   *  drawer body scrolls under the popover, so the anchor coords
   *  shift relative to the pane. */
  @HostListener('window:resize')
  @HostListener('window:scroll')
  onWindowReflow(): void {
    if (this.open()) this.positionPopover();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    if (!this.open()) return;
    const target = ev.target as HTMLElement;
    // Clicks inside the trigger row or inside the floating popover
    // are "ours" — anything else dismisses.
    if (this.hostEl.contains(target))           return;
    if (this.popoverEl?.contains(target))       return;
    this.destroyPopover();
    this.open.set(false);
  }

  // ─── Caret tracking ─────────────────────────────────────────────────────
  private savedRange: Range | null = null;
  /** Public so the template can call it on `blur` — when the field
   *  loses focus we snapshot the caret so the popover insert lands
   *  at the user's last edit position instead of the end. */
  captureRange(): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { this.savedRange = null; return; }
    const range = sel.getRangeAt(0);
    const el = this.field?.nativeElement;
    if (el && el.contains(range.startContainer)) this.savedRange = range.cloneRange();
    else                                          this.savedRange = null;
  }
  private hostEl: HTMLElement;

  // ─── Insertion ──────────────────────────────────────────────────────────
  pick(v: SeoVariable): void {
    const el = this.field?.nativeElement;
    if (!el) return;
    el.focus();

    let range: Range;
    if (this.savedRange) {
      range = this.savedRange;
    } else {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }

    range.deleteContents();
    const chip = makeChip(v.token, this.labelByToken.get(v.token) ?? v.token);
    const tail = document.createTextNode('​');
    range.insertNode(tail);
    range.insertNode(chip);

    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      const r = document.createRange();
      r.setStartAfter(tail);
      r.collapse(true);
      sel.addRange(r);
      this.savedRange = r.cloneRange();
    }

    this.emitChange();
    this.destroyPopover();
    this.open.set(false);
  }

  // ─── Field change passthrough ───────────────────────────────────────────
  onInput(): void {
    this.captureRange();
    this.emitChange();
  }

  onKeydown(ev: KeyboardEvent): void {
    if (!this.textarea() && ev.key === 'Enter') ev.preventDefault();
  }

  private emitChange(): void {
    const el = this.field?.nativeElement;
    if (!el) return;
    this.valueChange.emit(serializeNode(el));
  }
}

// ─── DOM helpers ───────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeChip(token: string, label: string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'vi__chip';
  chip.setAttribute('contenteditable', 'false');
  chip.setAttribute('data-token', token);
  chip.textContent = label;
  return chip;
}

function renderTemplateToHtml(s: string, labels: Map<string, string>): string {
  const parts = parseTemplate(s);
  let html = '';
  for (const p of parts) {
    if (p.type === 'text') html += escapeHtml(p.value).replace(/\n/g, '<br>');
    else html += `<span class="vi__chip" contenteditable="false" data-token="${escapeHtml(p.token)}">${escapeHtml(labels.get(p.token) ?? p.token)}</span>`;
  }
  return html;
}

function parseTemplate(s: string): Array<{ type: 'text'; value: string } | { type: 'chip'; token: string }> {
  const out: Array<{ type: 'text'; value: string } | { type: 'chip'; token: string }> = [];
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > lastIndex) out.push({ type: 'text', value: s.slice(lastIndex, m.index) });
    out.push({ type: 'chip', token: m[1] });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < s.length) out.push({ type: 'text', value: s.slice(lastIndex) });
  return out;
}

function serializeNode(root: Node): string {
  let out = '';
  for (const child of Array.from(root.childNodes)) {
    out += serializeChild(child);
  }
  return out;

  function serializeChild(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? '').replace(/​/g, '');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    if (el.classList.contains('vi__chip')) {
      const token = el.getAttribute('data-token') ?? '';
      return token ? `{{ ${token} }}` : '';
    }
    if (el.tagName === 'BR') return '\n';
    let inner = '';
    for (const c of Array.from(el.childNodes)) inner += serializeChild(c);
    if (el.tagName === 'DIV' || el.tagName === 'P') {
      return (out.length && !out.endsWith('\n') ? '\n' : '') + inner;
    }
    return inner;
  }
}
