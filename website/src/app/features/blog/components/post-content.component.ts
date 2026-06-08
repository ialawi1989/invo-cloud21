import {
  Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges,
  inject, signal, PLATFORM_ID, HostListener,
} from '@angular/core';
import { CommonModule, isPlatformBrowser, DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { linkifyHashtags } from '../utils/hashtag-linker';
import { neutralizeEditable } from '../utils/neutralize-editable';

interface LightboxItem { src: string; alt: string; download: boolean; }
interface LightboxState { items: LightboxItem[]; index: number; }

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
  template: `
    <div class="prose" [innerHTML]="safe" (click)="onClick($event)"></div>

    @if (lb(); as box) {
      <div class="lb" role="dialog" aria-modal="true" (click)="closeLb()">
        <button type="button" class="lb__btn lb__close" (click)="closeLb()" aria-label="Close">&times;</button>
        @if (box.items.length > 1) {
          <button type="button" class="lb__btn lb__prev" (click)="step($event, -1)" aria-label="Previous">&#8249;</button>
          <button type="button" class="lb__btn lb__next" (click)="step($event, 1)" aria-label="Next">&#8250;</button>
        }
        <figure class="lb__stage" (click)="$event.stopPropagation()">
          <img class="lb__img" [src]="box.items[box.index].src" [alt]="box.items[box.index].alt">
          <figcaption class="lb__bar">
            <span class="lb__count">{{ box.items.length > 1 ? (box.index + 1) + ' / ' + box.items.length : '' }}</span>
            @if (box.items[box.index].download) {
              <a class="lb__dl" [href]="box.items[box.index].src" download target="_blank" rel="noopener" aria-label="Download" (click)="$event.stopPropagation()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"/></svg>
              </a>
            }
          </figcaption>
        </figure>
      </div>
    }
  `,
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

    /* ── Galleries — honor editor layout vars; auto-fit fallback ──── */
    .prose ::ng-deep div:has(> .re-gallery-item) {
      display: grid;
      grid-template-columns: repeat(var(--re-gal-cols, 3), minmax(0, 1fr));
      gap: var(--re-gal-gap, 8px); margin: 32px 0;
    }
    /* Galleries with no configured column count fall back to auto-fit. */
    .prose ::ng-deep div:has(> .re-gallery-item):not([style*="--re-gal-cols"]) {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
    .prose ::ng-deep .re-gallery-item { margin: 0; overflow: hidden; border-radius: 10px; }
    .prose ::ng-deep .re-gallery-item img {
      width: 100%; height: 100%; object-fit: cover; border-radius: 10px; margin: 0;
      aspect-ratio: var(--re-gal-ratio, auto);
    }

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

    /* ── Image figure: size + alignment (re-size-* / re-align-*) ──── */
    .prose ::ng-deep figure.re-embed-figure { margin: 36px auto; }
    .prose ::ng-deep .re-size-compact  { width: 55%; }
    .prose ::ng-deep .re-size-standard { width: 100%; }
    .prose ::ng-deep .re-size-original { width: -moz-fit-content; width: fit-content; }
    .prose ::ng-deep .re-size-extended { width: calc(100% + 140px); max-width: calc(100% + 140px); margin-inline: -70px; }
    .prose ::ng-deep .re-align-left   { margin-inline: 0 auto; }
    .prose ::ng-deep .re-align-center { margin-inline: auto; }
    .prose ::ng-deep .re-align-right  { margin-inline: auto 0; }
    /* Click-to-expand affordance. */
    .prose ::ng-deep [data-click-expand="true"] img { cursor: zoom-in; }
    @media (max-width: 768px) {
      .prose ::ng-deep .re-size-compact,
      .prose ::ng-deep .re-size-extended { width: 100%; max-width: 100%; margin-inline: 0; }
    }

    /* ── Gallery: honor editor layout vars (cols / ratio / gap) ───── */
    .prose ::ng-deep .re-gallery {
      display: grid;
      grid-template-columns: repeat(var(--re-gal-cols, 3), minmax(0, 1fr));
      gap: var(--re-gal-gap, 8px);
    }
    .prose ::ng-deep .re-gallery .re-gallery-item { margin: 0; border-radius: 10px; overflow: hidden; }
    .prose ::ng-deep .re-gallery .re-gallery-item img {
      width: 100%; height: 100%; display: block; margin: 0; border-radius: 10px;
      object-fit: cover; aspect-ratio: var(--re-gal-ratio, 1 / 1);
    }
    .prose ::ng-deep .re-gallery[data-crop="fit"] .re-gallery-item img { object-fit: contain; }

    /* ── Divider variants (data-divider-*) ───────────────────────── */
    .prose ::ng-deep hr[data-divider-size="compact"]  { width: 30%; }
    .prose ::ng-deep hr[data-divider-size="standard"] { width: 60%; }
    .prose ::ng-deep hr[data-divider-size="extended"] { width: 90%; }
    .prose ::ng-deep hr[data-divider-align="left"]  { margin-inline: 0 auto; }
    .prose ::ng-deep hr[data-divider-align="right"] { margin-inline: auto 0; }

    /* ── Banner: honor data-cols (fallback for the column count) ──── */
    .prose ::ng-deep .re-banner[data-cols="2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .prose ::ng-deep .re-banner[data-cols="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .prose ::ng-deep .re-banner[data-cols="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }

    /* ── Product card (re-product) ───────────────────────────────── */
    .prose ::ng-deep .re-product { margin: 32px auto; }
    .prose ::ng-deep .re-product__card {
      display: flex; gap: 18px; align-items: center;
      border: var(--rp-bw, 1px) solid var(--rp-border, var(--hair));
      border-radius: var(--rp-radius, 14px); padding: 16px; background: var(--body-bg, #fff);
    }
    .prose ::ng-deep .re-product[data-img-pos="top"] .re-product__card { flex-direction: column; align-items: stretch; }
    .prose ::ng-deep .re-product[data-img-pos="right"] .re-product__card { flex-direction: row-reverse; }
    .prose ::ng-deep .re-product__media { position: relative; flex: 0 0 40%; border-radius: 10px; overflow: hidden; }
    .prose ::ng-deep .re-product__media img { width: 100%; height: 100%; object-fit: cover; margin: 0; border-radius: 10px; }
    .prose ::ng-deep .re-product__noimg { aspect-ratio: 1; background: var(--surface); border-radius: 10px; }
    .prose ::ng-deep .re-product__info { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .prose ::ng-deep .re-product__title { font-weight: 700; font-size: 18px; }
    .prose ::ng-deep .re-product__price { color: var(--rp-primary, var(--primary, #6366f1)); font-weight: 700; }
    .prose ::ng-deep .re-product__btn {
      align-self: flex-start; display: inline-block; padding: 10px 22px; border-radius: 999px;
      background: var(--rp-primary, var(--primary, #6366f1)); color: #fff !important;
      font-weight: 600; text-decoration: none;
    }
    .prose ::ng-deep .re-product__ribbon {
      position: absolute; inset-inline-start: 10px; inset-block-start: 10px; z-index: 2;
      background: var(--rp-secondary, #ef4444); color: #fff; font-size: 12px; font-weight: 700;
      padding: 3px 9px; border-radius: 6px;
    }
    .prose ::ng-deep .re-product__ribbon--info { position: static; align-self: flex-start; }

    /* ── Lightbox (component template, not innerHTML) ────────────── */
    .lb {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(10, 10, 12, .92);
      display: flex; align-items: center; justify-content: center; padding: 24px;
      animation: lb-in .15s ease;
    }
    @keyframes lb-in { from { opacity: 0; } to { opacity: 1; } }
    .lb__stage { margin: 0; max-width: 92vw; max-height: 92vh; display: flex; flex-direction: column; gap: 12px; }
    .lb__img {
      max-width: 92vw; max-height: 84vh; object-fit: contain;
      border-radius: 8px; box-shadow: 0 20px 60px rgba(0, 0, 0, .5);
    }
    .lb__bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; color: #fff; font-size: 14px; min-height: 18px; }
    .lb__count { opacity: .8; }
    .lb__dl { color: #fff; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; opacity: .85; }
    .lb__dl:hover { opacity: 1; }
    .lb__btn {
      position: fixed; background: rgba(255, 255, 255, .12); color: #fff; border: 0; cursor: pointer;
      width: 46px; height: 46px; border-radius: 50%; font-size: 26px; line-height: 1;
      display: grid; place-items: center; transition: background .15s ease;
    }
    .lb__btn:hover { background: rgba(255, 255, 255, .24); }
    .lb__close { top: 18px; inset-inline-end: 18px; }
    .lb__prev { inset-inline-start: 18px; top: 50%; transform: translateY(-50%); }
    .lb__next { inset-inline-end: 18px; top: 50%; transform: translateY(-50%); }

    [dir='rtl'] .prose { text-align: right; }
    [dir='rtl'] .prose ::ng-deep > p:first-of-type::first-letter { float: right; }
  `],
})
export class PostContentComponent implements OnChanges {
  @Input({ required: true }) html = '';
  @Input({ required: true }) lang = 'en';

  private sanitizer = inject(DomSanitizer);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private doc = inject(DOCUMENT);
  safe: SafeHtml = '';

  /** Open lightbox state, or null when closed. */
  lb = signal<LightboxState | null>(null);

  ngOnChanges(_: SimpleChanges): void {
    const linked = linkifyHashtags(this.html, this.lang);
    // Render strictly read-only — no contenteditable regions or live
    // form controls leaking through from the editor's saved markup.
    this.safe = this.sanitizer.bypassSecurityTrustHtml(neutralizeEditable(linked));
  }

  /** Delegated click handler for the rendered (innerHTML) content:
   *  toggles accordions and opens the image/gallery lightbox. Links and
   *  other clicks fall through untouched. Browser-only. */
  onClick(ev: MouseEvent): void {
    if (!this.isBrowser) return;
    const el = ev.target as HTMLElement | null;
    if (!el) return;

    // ── Accordion / expandable (re-expand) ──
    const head = el.closest('.re-expand__head') as HTMLElement | null;
    if (head) {
      const item = head.closest('.re-expand') as HTMLElement | null;
      if (item) {
        const group = item.closest('.re-expand-group');
        const willOpen = item.getAttribute('data-open') !== 'true';
        // "single" groups keep at most one item open.
        if (willOpen && group?.getAttribute('data-single') === 'true') {
          group.querySelectorAll('.re-expand[data-open="true"]')
            .forEach(o => o.setAttribute('data-open', 'false'));
        }
        item.setAttribute('data-open', willOpen ? 'true' : 'false');
        ev.preventDefault();
      }
      return;
    }

    // ── Image / gallery lightbox (data-click-expand) ──
    const img = el.closest('img') as HTMLImageElement | null;
    if (!img || !img.closest('[data-click-expand="true"]')) return;
    ev.preventDefault();

    const allowDownload = !!img.closest('[data-allow-download="true"]');
    const gallery = img.closest('.re-gallery');
    const imgs = gallery
      ? Array.from(gallery.querySelectorAll<HTMLImageElement>('img'))
      : [img];
    const items: LightboxItem[] = imgs.map(i => ({
      src: i.currentSrc || i.getAttribute('src') || '',
      alt: i.alt || '',
      download: allowDownload,
    }));
    this.lb.set({ items, index: Math.max(0, imgs.indexOf(img)) });
    this.lockScroll(true);
  }

  step(ev: Event, delta: number): void {
    ev.stopPropagation();
    const box = this.lb();
    if (!box) return;
    const n = box.items.length;
    this.lb.set({ ...box, index: (box.index + delta + n) % n });
  }

  closeLb(): void {
    this.lb.set(null);
    this.lockScroll(false);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent): void {
    if (!this.lb()) return;
    if (ev.key === 'Escape') this.closeLb();
    else if (ev.key === 'ArrowRight') this.step(ev, 1);
    else if (ev.key === 'ArrowLeft') this.step(ev, -1);
  }

  private lockScroll(on: boolean): void {
    if (!this.isBrowser || !this.doc?.body) return;
    this.doc.body.style.overflow = on ? 'hidden' : '';
  }
}
