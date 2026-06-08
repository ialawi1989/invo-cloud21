import { Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { linkifyHashtags } from '../utils/hashtag-linker';

/**
 * Renders post HTML with hashtag auto-linking applied. We trust the
 * backend to sanitise editor output (the dashboard uses a curated
 * rich-text editor) and use `bypassSecurityTrustHtml` so the rendered
 * markup survives Angular's sanitiser intact. If your backend doesn't
 * sanitise, do it server-side before serving — never disable trust
 * client-side without that guarantee.
 */
@Component({
  selector: 'app-post-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `<div class="prose" [innerHTML]="safe"></div>`,
  styles: [`
    :host { display: block; }
    .prose {
      --ink: var(--body-text, #1a1a1a);
      --muted: color-mix(in srgb, var(--ink) 60%, transparent);
      --hair: color-mix(in srgb, var(--ink) 12%, transparent);
      --surface: color-mix(in srgb, var(--ink) 4%, transparent);
      max-width: 720px;
      margin: 0 auto;
      font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      font-size: 19px;
      line-height: 1.8;
      color: var(--ink);
      letter-spacing: .003em;
    }
    @media (max-width: 768px) { .prose { font-size: 17px; line-height: 1.72; } }

    /* ── Headings & text ─────────────────────────────────────────── */
    .prose ::ng-deep h2 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px; line-height: 1.22; margin: 56px 0 18px; font-weight: 700;
      letter-spacing: -.01em;
    }
    .prose ::ng-deep h3 { font-size: 23px; line-height: 1.3; margin: 40px 0 12px; font-weight: 700; }
    .prose ::ng-deep h4 { font-size: 19px; line-height: 1.35; margin: 30px 0 10px; font-weight: 700; }
    .prose ::ng-deep p  { margin: 20px 0; }
    .prose ::ng-deep a  { color: var(--primary, #6366f1); text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .prose ::ng-deep a:hover { text-decoration: underline; }
    .prose ::ng-deep strong { font-weight: 700; }
    .prose ::ng-deep hr { border: 0; height: 1px; background: var(--hair); margin: 48px auto; width: 60%; }
    /* Elegant magazine drop-cap on the opening paragraph. */
    .prose ::ng-deep > p:first-of-type::first-letter {
      float: inline-start;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 4.2em; line-height: .82; font-weight: 700;
      margin-inline-end: .08em; margin-block-start: .05em;
      color: var(--primary, #6366f1);
    }

    /* ── Lists ───────────────────────────────────────────────────── */
    .prose ::ng-deep ul, .prose ::ng-deep ol { padding-inline-start: 26px; margin: 20px 0; }
    .prose ::ng-deep li { margin: 8px 0; padding-inline-start: 4px; }
    .prose ::ng-deep li::marker { color: var(--primary, #6366f1); }

    /* ── Quotes (plain + pull-quote variants) ────────────────────── */
    .prose ::ng-deep blockquote {
      border-inline-start: 3px solid var(--primary, #6366f1);
      padding: 2px 22px; margin: 32px 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 24px; line-height: 1.45; font-style: italic; color: var(--ink);
    }
    .prose ::ng-deep blockquote p { margin: 8px 0; }
    /* Dark highlighted pull-quote (editor "quote" widget) + author line. */
    .prose ::ng-deep figure.re-quote, .prose ::ng-deep .re-pullquote {
      background: var(--ink); color: var(--body-bg, #fff);
      border-radius: 14px; padding: 28px 30px; margin: 36px 0; border: 0;
    }
    .prose ::ng-deep figure.re-quote blockquote, .prose ::ng-deep .re-pullquote blockquote {
      border: 0; padding: 0; margin: 0; color: inherit; font-size: 26px; font-weight: 600; font-style: normal;
    }
    .prose ::ng-deep figure.re-quote figcaption, .prose ::ng-deep .re-pullquote figcaption {
      margin-top: 16px; display: flex; align-items: center; gap: 10px;
      font-family: 'Inter', sans-serif; font-size: 14px; font-style: normal; opacity: .85; text-align: start;
    }

    /* ── Images / figures / captions ─────────────────────────────── */
    .prose ::ng-deep img { max-width: 100%; height: auto; border-radius: 12px; display: block; }
    .prose ::ng-deep figure { margin: 36px 0; }
    .prose ::ng-deep figure img { margin: 0 auto; }
    .prose ::ng-deep figcaption {
      font-size: 13.5px; color: var(--muted); text-align: center; margin-top: 10px; font-style: italic;
    }

    /* ── Galleries (re-gallery-item grid) ────────────────────────── */
    .prose ::ng-deep div:has(> .re-gallery-item) {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px; margin: 32px 0;
    }
    .prose ::ng-deep .re-gallery-item { margin: 0; overflow: hidden; border-radius: 10px; }
    .prose ::ng-deep .re-gallery-item img { width: 100%; height: 100%; object-fit: cover; border-radius: 10px; margin: 0; }

    /* ── Embeds / video (re-embed-*) ─────────────────────────────── */
    .prose ::ng-deep .re-embed-figure, .prose ::ng-deep .re-embed-card { margin: 36px 0; }
    .prose ::ng-deep .re-embed-video {
      position: relative; aspect-ratio: 16/9; border-radius: 12px; overflow: hidden; background: #000;
    }
    .prose ::ng-deep .re-embed-video iframe,
    .prose ::ng-deep .re-embed-video video,
    .prose ::ng-deep iframe {
      position: absolute; inset: 0; width: 100%; height: 100%; border: 0; border-radius: 12px;
    }
    .prose ::ng-deep .re-embed-card {
      display: flex; gap: 16px; align-items: center; padding: 16px;
      border: 1px solid var(--hair); border-radius: 14px; text-decoration: none; color: inherit;
    }
    .prose ::ng-deep .re-embed-caption { font-size: 13.5px; color: var(--muted); margin-top: 10px; text-align: center; }

    /* ── Call-to-action banner (section.re-banner) ───────────────── */
    .prose ::ng-deep .re-banner {
      display: grid;
      grid-template-columns: repeat(var(--re-banner-cols, 1), minmax(0, 1fr));
      gap: 0; margin: 40px 0; border-radius: 16px; overflow: hidden;
      border: 1px solid var(--hair); background: var(--surface);
    }
    .prose ::ng-deep .re-banner-col, .prose ::ng-deep .re-banner-cell {
      padding: 28px 30px; display: flex; flex-direction: column; justify-content: center; gap: 8px;
      background-size: cover; background-position: center; min-height: 120px;
    }
    .prose ::ng-deep .re-banner img { width: 100%; height: 100%; object-fit: cover; border-radius: 0; }
    @media (max-width: 640px) { .prose ::ng-deep .re-banner { grid-template-columns: 1fr; } }

    /* ── Buttons (re-btn-block) ──────────────────────────────────── */
    .prose ::ng-deep .re-btn-block { margin: 28px 0; text-align: center; }
    .prose ::ng-deep .re-btn-block a, .prose ::ng-deep a.re-btn {
      display: inline-block; padding: 12px 28px; border-radius: 999px;
      background: var(--primary, #6366f1); color: #fff !important; font-weight: 600;
      text-decoration: none; transition: filter .15s ease;
    }
    .prose ::ng-deep .re-btn-block a:hover { filter: brightness(1.08); text-decoration: none; }

    /* ── Expandable / accordion (re-expand) ──────────────────────── */
    .prose ::ng-deep .re-expand {
      border: 1px solid var(--hair); border-radius: 12px; margin: 16px 0; overflow: hidden; background: var(--body-bg, #fff);
    }
    .prose ::ng-deep .re-expand-group { margin: 28px 0; display: flex; flex-direction: column; gap: 10px; }
    .prose ::ng-deep .re-expand__head {
      display: flex; align-items: center; gap: 10px; justify-content: space-between;
      padding: 16px 18px; font-weight: 600;
    }
    .prose ::ng-deep .re-expand__head::after {
      content: '⌄'; font-size: 18px; color: var(--muted); transition: transform .2s ease;
    }
    .prose ::ng-deep .re-expand:not([data-open="true"]) .re-expand__body { display: none; }
    .prose ::ng-deep .re-expand:not([data-open="true"]) .re-expand__head::after { transform: rotate(-90deg); }
    .prose ::ng-deep .re-expand__body { padding: 0 18px 16px; color: var(--ink); }

    /* ── Poll (re-poll) — read-only presentation ─────────────────── */
    .prose ::ng-deep .re-poll {
      border: 1px solid var(--hair); border-radius: 16px; padding: 22px; margin: 32px 0; background: var(--surface);
    }
    .prose ::ng-deep .re-poll__q { font-weight: 700; font-size: 18px; margin-bottom: 14px; }
    .prose ::ng-deep .re-poll__ans {
      display: flex; align-items: center; gap: 10px; padding: 12px 16px; margin: 8px 0;
      border: 1px solid var(--hair); border-radius: 10px; background: var(--body-bg, #fff); cursor: pointer;
      transition: border-color .15s ease;
    }
    .prose ::ng-deep .re-poll__ans:hover { border-color: var(--primary, #6366f1); }
    .prose ::ng-deep .re-poll__ans-remove, .prose ::ng-deep .re-poll__add { display: none; }

    /* ── Tables ──────────────────────────────────────────────────── */
    .prose ::ng-deep table {
      width: 100%; border-collapse: collapse; margin: 32px 0; font-size: 16px;
      border: 1px solid var(--hair); border-radius: 12px; overflow: hidden;
    }
    .prose ::ng-deep th, .prose ::ng-deep td { padding: 12px 16px; border-bottom: 1px solid var(--hair); text-align: start; }
    .prose ::ng-deep th { background: var(--surface); font-weight: 700; }
    .prose ::ng-deep tr:last-child td { border-bottom: 0; }

    /* ── Code ────────────────────────────────────────────────────── */
    .prose ::ng-deep pre {
      background: #0f172a; color: #e2e8f0; padding: 18px 20px; border-radius: 12px;
      overflow-x: auto; font-size: 14px; margin: 28px 0; line-height: 1.6;
    }
    .prose ::ng-deep code {
      font-family: 'SF Mono', Menlo, Consolas, monospace;
      background: var(--surface); padding: 2px 6px; border-radius: 5px; font-size: .88em;
    }
    .prose ::ng-deep pre code { background: transparent; padding: 0; color: inherit; }

    /* ── Hashtags ────────────────────────────────────────────────── */
    .prose ::ng-deep .blog-hashtag { color: var(--primary, #6366f1); font-weight: 500; text-decoration: none; }
    .prose ::ng-deep .blog-hashtag:hover { text-decoration: underline; }

    [dir='rtl'] .prose { text-align: right; }
    [dir='rtl'] .prose ::ng-deep > p:first-of-type::first-letter { float: right; }
  `],
})
export class PostContentComponent implements OnChanges {
  @Input({ required: true }) html = '';
  @Input({ required: true }) lang = 'en';

  private sanitizer = inject(DomSanitizer);
  safe: SafeHtml = '';

  ngOnChanges(_: SimpleChanges): void {
    const linked = linkifyHashtags(this.html, this.lang);
    this.safe = this.sanitizer.bypassSecurityTrustHtml(linked);
  }
}
