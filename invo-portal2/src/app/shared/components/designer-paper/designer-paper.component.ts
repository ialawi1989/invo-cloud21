import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';

import { BindingEngine } from '../../../features/settings/document-builder/report-engine/core/binding/binding-engine';
import { PaginationEngine } from '../../../features/settings/document-builder/report-engine/core/layout/pagination';
import { HtmlRenderer } from '../../../features/settings/document-builder/report-engine/renderers/html/html-renderer';
import { ReportTemplate } from '../../../features/settings/document-builder/report-engine/core/types/template.types';

/**
 * Renders a free-position (`ReportTemplate`) design for viewing — the counterpart of `<app-document-paper>` for templates
 * whose `renderMode` is `designer` (ported from legacy `DesignerPaperComponent`).
 *
 * The HTML renderer emits a complete standalone document (`<html>`, `@page`, the lot) — right for "open in a tab and print",
 * not for injecting into a live page. So the `<body>` markup and the `<style>` block are extracted and inlined, keeping the
 * `.page` sizing rules that make the preview match the print. Page geometry stays in millimetres; zoom is the host's job.
 *
 * `allPages` (default) stacks every page, like the classic paper, so the viewer's own page counter and scrolling work;
 * with `allPages` off only one page shows, behind a prev / next pager.
 */
@Component({
  selector: 'app-designer-paper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
  templateUrl: './designer-paper.component.html',
  styleUrl: './designer-paper.component.scss',
})
export class DesignerPaperComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly template = input.required<ReportTemplate>();
  /** The document record to bind (already adapted by `toReportData`). */
  readonly data = input<Record<string, unknown>>({});
  readonly locale = input<string | undefined>(undefined);
  readonly allPages = input(true);

  readonly currentPage = signal(1);
  /** Extracted `<style>` + page markup of the whole document — cached so paging doesn't re-run the binding / pagination engines. */
  private readonly rawBody = signal('');
  readonly pageCount = computed(() => Math.max(1, (this.rawBody().match(/class="page" data-page="/g) ?? []).length));

  /** What is shown: every page, or (single-page mode) all but the current one hidden via an inline style on its own opening tag
   *  (`@media print` shows them all). Trusted: the string comes from our own renderer, which escapes every interpolated value
   *  and sanitizes rich-text blocks. */
  readonly view = computed<SafeHtml>(() => {
    const raw = this.rawBody();
    const body = this.allPages() ? raw : raw.replace(
      /<div class="page" data-page="(\d+)">/g,
      (match, n) => (n === String(this.currentPage()) ? match : match.replace('>', ' style="display:none">')),
    );
    return this.sanitizer.bypassSecurityTrustHtml(body);
  });

  constructor() {
    // Signal inputs don't fire ngOnChanges, so the render is an effect over everything it reads.
    effect(() => {
      const template = this.template();
      const data = this.data();
      const locale = this.locale();
      this.currentPage.set(1);
      if (!template) { this.rawBody.set(''); return; }
      try {
        const engine = new BindingEngine();
        const html = new HtmlRenderer(engine, new PaginationEngine(engine)).render({ template, data: data ?? {}, locale: locale ?? template.locale });
        this.rawBody.set(extractDocumentBody(html));
      } catch (err) {
        console.error('Failed to render designer template', err);
        this.rawBody.set(`<pre style="color:#b91c1c;padding:12px;white-space:pre-wrap">${String((err as Error)?.stack ?? err).replace(/</g, '&lt;')}</pre>`);
      }
    });
  }

  prevPage(): void { this.currentPage.update(p => Math.max(1, p - 1)); }
  nextPage(): void { this.currentPage.update(p => Math.min(this.pageCount(), p + 1)); }
}

const SCOPE = '.dsp';

/** Index of the `}` closing the block whose `{` is at `open`. */
function blockEnd(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i;
  }
  return css.length - 1;
}

/**
 * Confines the renderer's stylesheet to the injected pages. It is written for a standalone document, so its `*`, `html` and
 * `body` rules would restyle the whole app: those are re-targeted (`*` → the pages' subtree, `body` → only its font) and every
 * other selector is prefixed with the wrapper class. `@page` is dropped (invalid in a fragment); `@media` is scoped inside.
 */
function scopeCss(css: string): string {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  let pos = 0;
  while (pos < src.length) {
    const open = src.indexOf('{', pos);
    if (open < 0) break;
    const end = blockEnd(src, open);
    const head = src.slice(pos, open).trim();
    const body = src.slice(open + 1, end);
    pos = end + 1;
    if (head.startsWith('@page')) continue;
    if (head.startsWith('@media')) { out += `${head}{${scopeCss(body)}}
`; continue; }
    if (head.startsWith('@')) { out += `${head}{${body}}
`; continue; }
    const selectors: string[] = [];
    let decls = body;
    for (const sel of head.split(',').map((x) => x.trim()).filter(Boolean)) {
      if (sel === 'html' || sel === 'body') {
        const font = body.match(/font-family\s*:[^;]+;?/i);
        if (font) { selectors.push(SCOPE); decls = font[0]; }
      } else if (sel === '*') selectors.push(SCOPE, `${SCOPE} *`);
      else selectors.push(`${SCOPE} ${sel}`);
    }
    if (selectors.length) out += `${selectors.join(', ')}{${decls}}
`;
  }
  return out;
}

/** The `<style>` block + `<body>` contents of a standalone HTML document; `@page` rules are dropped (invalid in a fragment). */
function extractDocumentBody(html: string): string {
  const styles = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    .map((m) => scopeCss(m[1]))
    .join('\n');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  return styles ? `<style>${styles}</style>${body}` : body;
}
