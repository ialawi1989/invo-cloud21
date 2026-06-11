import {
  Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges,
  inject, signal, PLATFORM_ID, HostListener, ElementRef, AfterViewChecked, OnDestroy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser, DOCUMENT } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { linkifyHashtags } from '../utils/hashtag-linker';
import { neutralizeEditable } from '../utils/neutralize-editable';
import { normalizeGalleryHtml } from '../utils/normalize-gallery';
import { normalizeLinkHrefs } from '../utils/normalize-links';

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
    <div class="prose" [innerHTML]="safe" (click)="onClick($event)" (contextmenu)="onContentMenu($event)"></div>

    @if (lb(); as box) {
      <div class="lb" role="dialog" aria-modal="true" (click)="closeLb()">
        <button type="button" class="lb__btn lb__expand" (click)="toggleFs($event)" aria-label="Full screen">
          <svg width="60" height="60" viewBox="0 0 60 60"><g fill="none" fill-rule="evenodd"><g fill="#2F2E2E"><path d="M4.333 15.167H5.413V27.084H4.333z" transform="translate(17 17) rotate(45 4.873 21.125)"/><path d="M26 8h-1V1h-7V0h8v8z" transform="translate(17 17)"/><path d="M20.583 -1.083H21.666V10.834H20.583z" transform="translate(17 17) rotate(45 21.125 4.875)"/><path d="M0 26v-8h1v7h7v1H0z" transform="translate(17 17)"/></g></g></svg>
        </button>
        <button type="button" class="lb__btn lb__close" (click)="closeLb()" aria-label="Close">
          <svg width="60" height="60" viewBox="0 0 60 60"><path fill="#2F2E2E" d="M42.188 17l.812.813L30.812 30 43 42.188l-.813.812L30 30.812 17.812 43 17 42.187 29.187 30 17 17.812l.813-.812L30 29.187 42.188 17z"/></svg>
        </button>
        @if (box.items.length > 1) {
          <button type="button" class="lb__btn lb__prev" (click)="step($event, -1)" aria-label="Previous">
            <svg width="23" height="39" viewBox="0 0 23 39" style="transform: scaleX(-1)"><path fill="#2F2E2E" d="M857.005,231.479L858.5,230l18.124,18-18.127,18-1.49-1.48L873.638,248Z" transform="translate(-855 -230)"/></svg>
          </button>
          <button type="button" class="lb__btn lb__next" (click)="step($event, 1)" aria-label="Next">
            <svg width="23" height="39" viewBox="0 0 23 39"><path fill="#2F2E2E" d="M857.005,231.479L858.5,230l18.124,18-18.127,18-1.49-1.48L873.638,248Z" transform="translate(-855 -230)"/></svg>
          </button>
        }
        <figure class="lb__stage" (click)="$event.stopPropagation()">
          @for (it of [box.items[box.index]]; track it.src) {
            <img class="lb__img"
                 [class.lb__img--next]="slideDir() >= 0"
                 [class.lb__img--prev]="slideDir() < 0"
                 [src]="it.src" [alt]="it.alt"
                 (contextmenu)="onImgMenu($event, it.download)">
          }
        </figure>
        @if (box.items.length > 1 || box.items[box.index].download) {
          <div class="lb__bar">
            @if (box.items.length > 1) { <span class="lb__count">{{ box.index + 1 }} / {{ box.items.length }}</span> }
            @if (box.items[box.index].download) {
              <a class="lb__dl" [href]="box.items[box.index].src" download target="_blank" rel="noopener" (click)="$event.stopPropagation()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F2E2E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"/></svg>
                Download
              </a>
            }
          </div>
        }
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
    /* :not(.re-gal-track) so the Swiper track (which also directly holds
       .re-gallery-item tiles) doesn't inherit the gallery grid + 32px margin
       — that margin shifted the track down inside the clipped viewport. */
    .prose ::ng-deep div:has(> .re-gallery-item):not(.re-gal-track):not(.re-thumb-track):not(.re-gallery--thumbnails):not(.re-gallery--columns):not(.re-gallery--panorama) {
      display: grid;
      grid-template-columns: repeat(var(--re-gal-cols, 3), minmax(0, 1fr));
      gap: var(--re-gal-gap, 8px); margin: 32px 0;
    }
    /* Galleries with no configured column count fall back to auto-fit. */
    .prose ::ng-deep div:has(> .re-gallery-item):not([style*="--re-gal-cols"]):not(.re-gal-track):not(.re-thumb-track):not(.re-gallery--thumbnails):not(.re-gallery--columns):not(.re-gallery--panorama) {
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

    /* ── Expandable / accordion — minimal: left chevron + title, no box ── */
    .prose ::ng-deep .re-expand { border: 0; background: transparent; border-radius: 0; margin: 4px 0; overflow: visible; }
    .prose ::ng-deep .re-expand-group { margin: 24px 0; display: flex; flex-direction: column; gap: 2px; }
    .prose ::ng-deep .re-expand__head {
      display: flex; align-items: center; gap: 10px; justify-content: flex-start;
      padding: 8px 0; font-weight: 600; cursor: pointer; user-select: none;
    }
    /* Editor-only affordances — never on the public site. */
    .prose ::ng-deep .re-expand__drag,
    .prose ::ng-deep .re-expand__chev,
    .prose ::ng-deep .re-expand__add { display: none !important; }
    /* Left chevron: '›' collapsed, rotates down when open. */
    .prose ::ng-deep .re-expand__head::before {
      content: '\\203A'; order: -1; flex: none; display: inline-block;
      width: 14px; text-align: center; font-size: 20px; line-height: 1; color: var(--muted);
      transition: transform .2s ease;
    }
    .prose ::ng-deep .re-expand[data-open="true"] .re-expand__head::before { transform: rotate(90deg); }
    .prose ::ng-deep .re-expand__title { flex: 0 1 auto; text-align: start; min-width: 0; font-weight: 600; }
    .prose ::ng-deep .re-expand:not([data-open="true"]) .re-expand__body { display: none; }
    .prose ::ng-deep .re-expand__body { padding: 2px 0 8px 24px; color: var(--ink); }

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
    /* Click-to-zoom affordance for content images (not product/links). */
    .prose ::ng-deep figure.re-embed-figure img,
    .prose ::ng-deep .re-gallery img { cursor: zoom-in; }
    .prose ::ng-deep [data-click-expand="false"] img { cursor: default; }
    /* Wix-style expand glyph on hover over a zoomable figure. */
    .prose ::ng-deep figure.re-embed-figure:not([data-click-expand="false"]) { position: relative; }
    .prose ::ng-deep figure.re-embed-figure:not([data-click-expand="false"])::after {
      content: ''; position: absolute; top: 12px; inset-inline-end: 12px;
      width: 32px; height: 32px; border-radius: 50%;
      background-color: rgba(255, 255, 255, .92);
      background-repeat: no-repeat; background-position: center; background-size: 17px;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 19 19' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='%232F2E2E' fill-rule='nonzero' d='M15.071 8.371V4.585l-4.355 4.356a.2.2 0 0 1-.283 0l-.374-.374a.2.2 0 0 1 0-.283l4.356-4.355h-3.786a.2.2 0 0 1-.2-.2V3.2c0-.11.09-.2.2-.2H16v5.371a.2.2 0 0 1-.2.2h-.529a.2.2 0 0 1-.2-.2zm-6.5 6.9v.529a.2.2 0 0 1-.2.2H3v-5.371c0-.11.09-.2.2-.2h.529c.11 0 .2.09.2.2v3.786l4.355-4.356a.2.2 0 0 1 .283 0l.374.374a.2.2 0 0 1 0 .283L4.585 15.07h3.786c.11 0 .2.09.2.2z'/%3E%3C/svg%3E");
      box-shadow: 0 2px 8px rgba(0, 0, 0, .15);
      opacity: 0; transition: opacity .15s ease; pointer-events: none;
    }
    .prose ::ng-deep figure.re-embed-figure:not([data-click-expand="false"]):hover::after { opacity: 1; }
    /* Thumbnails supplies its own enlarge button ON the stage — hide the
       figure-level glyph (it sits at the figure's top-right, above the strip). */
    .prose ::ng-deep figure.re-embed-figure:has(.re-gallery--thumbnails)::after,
    .prose ::ng-deep figure.re-embed-figure:has(.re-gallery--slideshow)::after { content: none !important; }
    .prose ::ng-deep .re-thumb-expand {
      position: absolute; top: 12px; inset-inline-end: 12px; z-index: 4;
      width: 32px; height: 32px; border-radius: 50%; border: 0; padding: 0;
      background: rgba(255, 255, 255, .92); box-shadow: 0 2px 8px rgba(0, 0, 0, .15);
      cursor: pointer; display: grid; place-items: center;
      opacity: 0; transition: opacity .15s ease;
    }
    .prose ::ng-deep .re-thumb-stage:hover .re-thumb-expand { opacity: 1; }
    @media (max-width: 768px) {
      .prose ::ng-deep .re-size-compact,
      .prose ::ng-deep .re-size-extended { width: 100%; max-width: 100%; margin-inline: 0; }
    }

    /* ── Gallery: base (grid) + per-layout overrides ──────────────── */
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

    /* Masonry / Columns — multi-column, natural heights. */
    .prose ::ng-deep .re-gallery.re-gallery--masonry {
      display: block; column-count: var(--re-gal-cols, 3); column-gap: var(--re-gal-gap, 8px);
    }
    .prose ::ng-deep .re-gallery.re-gallery--masonry .re-gallery-item {
      break-inside: avoid; margin: 0 0 var(--re-gal-gap, 8px);
    }
    .prose ::ng-deep .re-gallery.re-gallery--masonry .re-gallery-item img {
      height: auto; aspect-ratio: auto;
    }

    /* Columns — fixed-width, full-height columns scrolled horizontally
       (Wix-style); a swiper strip like collage-horizontal but each tile is a
       uniform Column-width (cover-cropped), built by buildSwiper. */
    .prose ::ng-deep .re-gallery.re-gallery--columns {
      display: flex; gap: var(--re-gal-gap, 8px); height: var(--re-gal-row-h, 420px);
      overflow-x: auto; column-count: initial;
      scrollbar-width: none; -ms-overflow-style: none;
    }
    .prose ::ng-deep .re-gallery.re-gallery--columns::-webkit-scrollbar { display: none; }
    .prose ::ng-deep .re-gallery--columns .re-gallery-item {
      flex: 0 0 var(--re-gal-col-w, 200px); height: 100%; margin: 0; border-radius: 10px; overflow: hidden;
    }
    .prose ::ng-deep .re-gallery--columns .re-gallery-item img {
      width: 100%; height: 100%; object-fit: cover; aspect-ratio: auto; border-radius: 10px;
    }
    .prose ::ng-deep .re-gal-swiper.re-gallery--columns .re-gallery-item img {
      width: 100% !important; height: 100% !important; object-fit: cover !important;
    }

    /* Collage — Wix-style; the mode depends on scroll direction + image
       orientation. Default (vertical scroll): fixed-width columns with
       natural heights. */
    .prose ::ng-deep .re-gallery.re-gallery--collage {
      display: block; column-count: initial; grid-template-columns: none;
      columns: var(--re-gal-col-w, 240px) auto; column-gap: var(--re-gal-gap, 6px);
    }
    .prose ::ng-deep .re-gallery.re-gallery--collage .re-gallery-item {
      break-inside: avoid; margin: 0 0 var(--re-gal-gap, 6px); width: 100%;
      grid-column: auto; grid-row: auto; border-radius: 10px; overflow: hidden;
    }
    .prose ::ng-deep .re-gallery.re-gallery--collage .re-gallery-item img {
      width: 100%; height: auto; object-fit: cover; aspect-ratio: auto; border-radius: 10px;
    }
    /* Horizontal scroll → one full-height row, scroll sideways (arrows
       injected by enhanceGalleries). */
    .prose ::ng-deep .re-gallery.re-gallery--collage[data-scroll-dir="horizontal"] {
      display: flex; flex-wrap: nowrap; columns: auto; gap: var(--re-gal-gap, 6px);
      overflow-x: auto; height: var(--re-gal-row-h, 420px); -webkit-overflow-scrolling: touch;
    }
    .prose ::ng-deep .re-gallery.re-gallery--collage[data-scroll-dir="horizontal"] .re-gallery-item {
      flex: 0 0 auto; height: 100%; width: auto; margin: 0; break-inside: auto;
    }
    .prose ::ng-deep .re-gallery.re-gallery--collage[data-scroll-dir="horizontal"] .re-gallery-item img {
      height: 100%; width: auto; object-fit: cover; aspect-ratio: auto;
    }
    /* Vertical scroll + horizontal orientation → justified rows (same as
       masonry-horizontal; precise sizes set by layoutMasonry, this is the
       pre-JS / SSR fallback). */
    .prose ::ng-deep .re-gallery.re-gallery--collage[data-orientation="horizontal"]:not([data-scroll-dir="horizontal"]) {
      display: flex; flex-wrap: wrap; columns: auto; gap: var(--re-gal-gap, 6px); align-content: flex-start;
    }
    .prose ::ng-deep .re-gallery.re-gallery--collage[data-orientation="horizontal"]:not([data-scroll-dir="horizontal"]) .re-gallery-item {
      flex: 0 0 auto; width: auto; height: auto; margin: 0; break-inside: auto;
    }
    .prose ::ng-deep .re-gallery.re-gallery--collage[data-orientation="horizontal"]:not([data-scroll-dir="horizontal"]) .re-gallery-item img {
      width: 100%; height: 100%; object-fit: cover; aspect-ratio: auto;
    }

    /* Slider / Carousel — horizontal scroll strip. */
    .prose ::ng-deep .re-gallery.re-gallery--slider,
    .prose ::ng-deep .re-gallery.re-gallery--carousel {
      display: flex; gap: var(--re-gal-gap, 8px);
      overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch; padding-bottom: 6px;
    }
    .prose ::ng-deep .re-gallery.re-gallery--slider .re-gallery-item,
    .prose ::ng-deep .re-gallery.re-gallery--carousel .re-gallery-item {
      flex: 0 0 auto; width: clamp(220px, 46%, 460px); scroll-snap-align: start;
    }
    .prose ::ng-deep .re-gallery.re-gallery--slider .re-gallery-item img,
    .prose ::ng-deep .re-gallery.re-gallery--carousel .re-gallery-item img {
      aspect-ratio: var(--re-gal-ratio, 4 / 3);
    }

    /* Panorama — full-width images stacked vertically (Wix-style: each image
       spans the full container width at its natural height). */
    .prose ::ng-deep .re-gallery.re-gallery--panorama {
      display: flex !important; flex-direction: column; gap: var(--re-gal-gap, 8px);
      grid-template-columns: none !important; overflow: visible;
    }
    .prose ::ng-deep .re-gallery--panorama .re-gallery-item { flex: 0 0 auto; width: 100%; border-radius: 10px; overflow: hidden; }
    .prose ::ng-deep .re-gallery--panorama .re-gallery-item img {
      width: 100%; height: auto; object-fit: cover; aspect-ratio: auto; border-radius: 10px; display: block;
    }

    /* Nav arrows injected on scroll-based galleries. */
    .prose ::ng-deep .re-gal-wrap { position: relative; }
    .prose ::ng-deep .re-gal-arrow {
      position: absolute; top: 50%; transform: translateY(-50%); z-index: 2;
      padding: 8px; display: grid; place-items: center; cursor: pointer;
      border: 0; background: none; opacity: .85; transition: opacity .15s ease;
    }
    .prose ::ng-deep .re-gal-arrow:hover { opacity: 1; }
    .prose ::ng-deep .re-gal-arrow svg { display: block; filter: drop-shadow(0 1px 0px rgba(255, 255, 255, .8)); }
    .prose ::ng-deep .re-gal-arrow--prev { inset-inline-start: 12px; }
    .prose ::ng-deep .re-gal-arrow--next { inset-inline-end: 12px; }
    .prose ::ng-deep .re-gal-arrow--off { display: none; }
    /* Swiper-style transform slider (built by buildSwiper). The tiles carry
       frozen px sizes; this just makes the viewport clip + the track a row. */
    .prose ::ng-deep .re-gal-swiper {
      display: block !important; overflow: hidden !important; position: relative;
      /* kill the collage multi-column / grid context — it must not fragment the track */
      columns: auto !important; column-count: auto !important; column-width: auto !important;
      grid-template-columns: none !important;
      cursor: grab; user-select: none; -webkit-user-select: none; touch-action: pan-y;
    }
    .prose ::ng-deep .re-gal-swiper.re-gal-dragging { cursor: grabbing; }
    .prose ::ng-deep .re-gal-track {
      display: flex !important; flex-wrap: nowrap !important; align-items: stretch;
      gap: var(--re-gal-gap, 6px); width: -moz-max-content; width: max-content;
      will-change: transform;
    }
    /* Collage tiles are sized to each image's own aspect, so contain shows
       the FULL image (never cropped) with no letterbox bars, and every tile
       is the same height → no bottom gap, arrows stay centred. */
    .prose ::ng-deep .re-gal-swiper.re-gallery--collage .re-gallery-item img {
      width: 100% !important; height: 100% !important; object-fit: contain !important;
    }
    /* Carousel galleries — snap to tiles, hide the scrollbar. */
    .prose ::ng-deep .re-gallery--slideshow,
    .prose ::ng-deep .re-gallery--carousel,
    .prose ::ng-deep .re-gallery--slider,
    .prose ::ng-deep .re-gallery--collage[data-scroll-dir="horizontal"] {
      scroll-snap-type: x mandatory; scrollbar-width: none; -ms-overflow-style: none;
    }
    .prose ::ng-deep .re-gallery--slideshow::-webkit-scrollbar,
    .prose ::ng-deep .re-gallery--carousel::-webkit-scrollbar,
    .prose ::ng-deep .re-gallery--slider::-webkit-scrollbar,
    .prose ::ng-deep .re-gallery--collage[data-scroll-dir="horizontal"]::-webkit-scrollbar { display: none; }
    .prose ::ng-deep .re-gallery--slideshow .re-gallery-item,
    .prose ::ng-deep .re-gallery--carousel .re-gallery-item,
    .prose ::ng-deep .re-gallery--slider .re-gallery-item,
    .prose ::ng-deep .re-gallery--collage[data-scroll-dir="horizontal"] .re-gallery-item { scroll-snap-align: start; }

    /* Slideshow — one image per view, scroll-snap full width. */
    .prose ::ng-deep .re-gallery.re-gallery--slideshow {
      display: flex; gap: 0; overflow-x: auto; scroll-snap-type: x mandatory;
      scroll-behavior: smooth; -webkit-overflow-scrolling: touch; border-radius: 12px;
    }
    .prose ::ng-deep .re-gallery.re-gallery--slideshow .re-gallery-item {
      flex: 0 0 100%; scroll-snap-align: center; border-radius: 0;
    }
    .prose ::ng-deep .re-gallery.re-gallery--slideshow .re-gallery-item img {
      aspect-ratio: var(--re-gal-ratio, 16 / 9); object-fit: cover; border-radius: 0;
    }

    /* Thumbnails — a large active "stage" + a thumbnail strip; click a thumb
       (or the arrows) to swap the stage. Placement via data-thumb-placement
       (bottom default / top / left / right). Mirrors the cp editor preview,
       with live switching added by buildThumbnails(). */
    .prose ::ng-deep .re-gallery.re-gallery--thumbnails {
      --re-gal-thumb: 110px;
      display: flex !important; flex-wrap: wrap !important;
      grid-template-columns: none !important; gap: var(--re-gal-gap, 8px); position: relative;
    }
    /* Slideshow — just the big stage (no thumb strip). */
    .prose ::ng-deep .re-gallery.re-gallery--slideshow { display: block !important; position: relative; }
    /* The big stage — a one-image-per-view DRAGGABLE slider (swipe to change).
       Shared by Thumbnails + Slideshow (the .re-thumb-* classes are unique). */
    .prose ::ng-deep .re-thumb-stage {
      flex: 0 0 100%; order: 1; position: relative; aspect-ratio: 16 / 9; min-width: 0;
      border-radius: 12px; overflow: hidden; cursor: grab;
      user-select: none; -webkit-user-select: none; touch-action: pan-y;
    }
    .prose ::ng-deep .re-thumb-stage.re-thumb-dragging { cursor: grabbing; }
    .prose ::ng-deep .re-thumb-stage-track {
      display: flex; flex-wrap: nowrap; width: 100%; height: 100%; will-change: transform;
    }
    .prose ::ng-deep .re-thumb-slide { flex: 0 0 100%; height: 100%; }
    .prose ::ng-deep .re-thumb-slide img {
      width: 100%; height: 100%; object-fit: cover; display: block;
    }
    /* Strip — clickable thumbs in a transform track, slid by prev/next arrows
       (no scrollbar, no drag). The wrap holds the clipped strip + the arrows. */
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap {
      flex: 0 0 100%; order: 2; position: relative; min-width: 0; max-width: 100%;
    }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip {
      overflow: hidden; width: 100%; cursor: grab;
      user-select: none; -webkit-user-select: none; touch-action: pan-y;
    }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip.re-thumb-strip--drag { cursor: grabbing; }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-track {
      display: flex; gap: var(--re-gal-gap, 8px); width: -moz-max-content; width: max-content; will-change: transform;
    }
    /* Strip arrows. */
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-nav {
      position: absolute; z-index: 3; width: 30px; height: 30px; border: 0; border-radius: 50%;
      background: rgba(255, 255, 255, .94); box-shadow: 0 1px 5px rgba(0, 0, 0, .25);
      cursor: pointer; display: grid; place-items: center; opacity: .92; transition: opacity .15s ease;
    }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-nav:hover { opacity: 1; }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-nav--off { display: none; }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap:not(.re-thumb-strip-wrap--v) .re-thumb-strip-nav { top: 50%; transform: translateY(-50%); }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap:not(.re-thumb-strip-wrap--v) .re-thumb-strip-nav--prev { inset-inline-start: 4px; }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap:not(.re-thumb-strip-wrap--v) .re-thumb-strip-nav--next { inset-inline-end: 4px; }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-strip-nav { left: 50%; transform: translateX(-50%); }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-strip-nav--prev { top: 4px; }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-strip-nav--next { bottom: 4px; }
    /* Thumbs — every image stays in the strip; the active one is highlighted. */
    .prose ::ng-deep .re-gallery--thumbnails .re-gallery-item {
      flex: 0 0 var(--re-gal-thumb, 110px) !important;
      width: var(--re-gal-thumb, 110px) !important; height: var(--re-gal-thumb, 110px) !important;
      aspect-ratio: auto !important; cursor: pointer; opacity: .55;
      transition: opacity .15s ease; border-radius: 8px; overflow: hidden; margin: 0;
    }
    .prose ::ng-deep .re-gallery--thumbnails .re-gallery-item:hover { opacity: .85; }
    .prose ::ng-deep .re-gallery--thumbnails .re-gallery-item.is-active {
      opacity: 1; box-shadow: inset 0 0 0 3px var(--primary, #6366f1);
    }
    .prose ::ng-deep .re-gallery--thumbnails .re-gallery-item img {
      width: 100% !important; height: 100% !important; object-fit: cover; aspect-ratio: 1 / 1; border-radius: 8px; cursor: pointer;
    }
    /* Top — strip above the stage. */
    .prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement="top"] .re-thumb-stage { order: 2; }
    .prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement="top"] .re-thumb-strip-wrap { order: 1; }
    /* Left / right — vertical thumb column beside a SQUARE stage (Wix uses a
       620×620 square stage with the thumbs stacked on the side). */
    .prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement="left"],
    .prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement="right"] {
      display: grid !important; align-items: start;
    }
    .prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement="left"]  { grid-template-columns: var(--re-gal-thumb, 110px) 1fr !important; }
    .prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement="right"] { grid-template-columns: 1fr var(--re-gal-thumb, 110px) !important; }
    .prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement="left"]  .re-thumb-stage { grid-column: 2; grid-row: 1; aspect-ratio: 1 / 1; }
    .prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement="right"] .re-thumb-stage { grid-column: 1; grid-row: 1; aspect-ratio: 1 / 1; }
    .prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement="left"]  .re-thumb-strip-wrap { grid-column: 1; grid-row: 1; }
    .prose ::ng-deep .re-gallery--thumbnails[data-thumb-placement="right"] .re-thumb-strip-wrap { grid-column: 2; grid-row: 1; }
    /* Vertical strip: clip to the (square) stage's height — the strip is taken
       out of flow so the thumb column doesn't grow the grid row infinitely;
       the up/down arrows slide it. */
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap--v { align-self: stretch; position: relative; }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-strip { position: absolute; inset: 0; overflow: hidden; touch-action: pan-x; }
    .prose ::ng-deep .re-gallery--thumbnails .re-thumb-strip-wrap--v .re-thumb-track { flex-direction: column; width: auto; }
    /* Stage nav arrows (injected by buildThumbnails, positioned over the stage). */
    .prose ::ng-deep .re-thumb-nav {
      position: absolute; top: 50%; z-index: 3; width: 38px; height: 38px; border: 0; border-radius: 999px;
      background: rgba(255, 255, 255, .92); box-shadow: 0 1px 6px rgba(0, 0, 0, .22);
      cursor: pointer; display: grid; place-items: center; transform: translateY(-50%);
      opacity: .9; transition: opacity .15s ease;
    }
    .prose ::ng-deep .re-thumb-nav:hover { opacity: 1; }
    .prose ::ng-deep .re-thumb-nav--prev { left: 12px; }
    .prose ::ng-deep .re-thumb-nav--next { right: 12px; }

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

    /* ── Lightbox — full-screen white (Wix-style) ───────────────── */
    .lb {
      position: fixed; inset: 0; z-index: 9999;
      background: #fff;
      display: flex; align-items: center; justify-content: center; padding: 64px;
      animation: lb-in .15s ease;
    }
    @keyframes lb-in { from { opacity: 0; } to { opacity: 1; } }
    .lb__stage { margin: 0; max-width: 90vw; max-height: 88vh; display: flex; overflow: hidden; }
    .lb__img { max-width: 90vw; max-height: 86vh; object-fit: contain; display: block; }
    /* Directional slide when navigating prev/next. */
    .lb__img--next { animation: lb-slide-next .28s cubic-bezier(.22, .61, .36, 1); }
    .lb__img--prev { animation: lb-slide-prev .28s cubic-bezier(.22, .61, .36, 1); }
    @keyframes lb-slide-next { from { opacity: 0; transform: translateX(48px); } to { opacity: 1; transform: none; } }
    @keyframes lb-slide-prev { from { opacity: 0; transform: translateX(-48px); } to { opacity: 1; transform: none; } }
    .lb__bar {
      position: fixed; inset-inline: 0; bottom: 20px; display: flex; gap: 18px;
      align-items: center; justify-content: center; color: #2F2E2E; font-size: 14px;
    }
    .lb__count { opacity: .75; }
    .lb__dl { color: #2F2E2E; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; opacity: .85; }
    .lb__dl:hover { opacity: 1; text-decoration: underline; }
    .lb__btn {
      position: fixed; background: none; border: 0; cursor: pointer; padding: 6px;
      display: grid; place-items: center; opacity: .8; transition: opacity .15s ease;
    }
    .lb__btn:hover { opacity: 1; }
    .lb__btn svg { display: block; }
    .lb__expand { top: 16px; inset-inline-start: 20px; }
    .lb__close  { top: 16px; inset-inline-end: 20px; }
    .lb__prev { inset-inline-start: 24px; top: 50%; transform: translateY(-50%); }
    .lb__next { inset-inline-end: 24px; top: 50%; transform: translateY(-50%); }
    .lb__prev svg, .lb__next svg { width: 23px; height: 39px; }

    [dir='rtl'] .prose { text-align: right; }
    [dir='rtl'] .prose ::ng-deep > p:first-of-type::first-letter { float: right; }
  `],
})
export class PostContentComponent implements OnChanges, AfterViewChecked, OnDestroy {
  @Input({ required: true }) html = '';
  @Input({ required: true }) lang = 'en';

  private sanitizer = inject(DomSanitizer);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private doc = inject(DOCUMENT);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Content we've already enhanced — re-runs only when it changes. */
  private enhancedFor: string | null = null;
  /** ResizeObservers wired to justified galleries (disconnected on re-enhance). */
  private observers: ResizeObserver[] = [];
  /** Autoplay timers (cleared on re-enhance / destroy). */
  private timers: number[] = [];
  safe: SafeHtml = '';

  /** Open lightbox state, or null when closed. */
  lb = signal<LightboxState | null>(null);
  /** Last navigation direction (1 = next, -1 = prev) — drives the slide. */
  slideDir = signal<1 | -1>(1);

  ngOnChanges(_: SimpleChanges): void {
    const linked = linkifyHashtags(this.html, this.lang);
    // Render strictly read-only (no contenteditable / live form controls)
    // and strip the editor's baked-in gallery tile sizing so the site's
    // responsive layout CSS applies.
    this.safe = this.sanitizer.bypassSecurityTrustHtml(
      normalizeLinkHrefs(normalizeGalleryHtml(neutralizeEditable(linked))),
    );
  }

  ngAfterViewChecked(): void {
    // Enhance the freshly-rendered innerHTML once per content change
    // (browser only). Adds nav arrows to scroll-based galleries; the
    // lightbox already handles image clicks for every layout.
    if (!this.isBrowser || this.enhancedFor === this.html) return;
    this.enhancedFor = this.html;
    this.enhanceGalleries();
  }

  /** Enhance the rendered galleries: JS justified-rows layout for masonry
   *  (Wix-style) and prev/next arrows on scroll-based layouts. Operates on
   *  the innerHTML DOM directly. */
  private enhanceGalleries(): void {
    // Drop observers + timers from the previous content before re-wiring.
    this.observers.forEach(o => o.disconnect());
    this.observers = [];
    this.timers.forEach(t => clearInterval(t));
    this.timers = [];

    const root = this.host.nativeElement;

    // Justified rows — masonry-horizontal AND collage (vertical scroll +
    // horizontal orientation). Skip masonry-vertical (Pinterest CSS).
    const justifiedSel =
      '.re-gallery--masonry:not([data-orientation="vertical"]), ' +
      '.re-gallery--collage[data-orientation="horizontal"]:not([data-scroll-dir="horizontal"])';
    root.querySelectorAll<HTMLElement>(justifiedSel).forEach(g => {
      this.layoutMasonry(g);
      // Re-layout only when the WIDTH changes — setting item heights also
      // resizes the container, which would otherwise loop the observer.
      let lastW = g.clientWidth;
      const ro = new ResizeObserver(() => {
        const w = g.clientWidth;
        if (w === lastW) return;
        lastW = w;
        this.layoutMasonry(g);
      });
      ro.observe(g);
      this.observers.push(ro);
    });

    // Horizontal layouts → Swiper-style transform slider (buildSwiper).
    // Bail-safe: it measures the native tile sizes and only upgrades when
    // they're known, retrying on image load — so it can't break the layout.
    const scrollSel = '.re-gallery--carousel, .re-gallery--slider, .re-gallery--columns, .re-gallery--collage[data-scroll-dir="horizontal"]';
    root.querySelectorAll<HTMLElement>(scrollSel).forEach(g => {
      if (g.dataset['swiper'] === '1') return;
      const tryBuild = () => this.buildSwiper(g);
      tryBuild();
      if (g.dataset['swiper'] !== '1') {
        g.querySelectorAll('img').forEach(im => { if (!im.complete) im.addEventListener('load', tryBuild, { once: true }); });
        requestAnimationFrame(tryBuild);
        setTimeout(tryBuild, 250);
      }
    });

    // Thumbnails — interactive stage + clickable thumbnail strip.
    // Thumbnails (stage + thumb strip) and Slideshow (stage only) both use
    // the big-image stage slider.
    root.querySelectorAll<HTMLElement>('.re-gallery--thumbnails, .re-gallery--slideshow').forEach(g => this.buildThumbnails(g));
  }

  /** Wix-style justified masonry: pack images into rows at the target row
   *  height, then scale each row to fill the container width exactly.
   *  Heights vary by the images' aspect ratios. Re-runs on resize/load. */
  /**
   * Swiper-style transform slider for a horizontal gallery.
   *
   * Measures the tile sizes the per-layout CSS already produced, freezes
   * them as explicit px, then drives a translated `.re-gal-track`. Because
   * the tiles carry hard pixel sizes (not the `height:100%`/`width:auto`
   * chain that collapses once wrapped), the layout can't break. Bail-safe:
   * if the tiles aren't laid out yet (0 size / images loading) it makes NO
   * DOM change and returns — the caller retries on image load + rAF, so a
   * not-ready gallery just stays in its native CSS layout meanwhile.
   */
  private buildSwiper(g: HTMLElement): void {
    if (g.dataset['swiper'] === '1' || !g.parentElement) return;
    const items = (Array.from(g.children) as HTMLElement[]).filter(c => c.classList?.contains('re-gallery-item'));
    if (!items.length) return;

    const imgEls = items.map(it => it.querySelector('img') as HTMLImageElement | null);
    // Columns use a FIXED column width, so they don't need natural image sizes
    // and can build immediately; every other strip sizes each tile by its
    // image aspect, so it must wait until the images have loaded.
    const isColumns = g.classList.contains('re-gallery--columns');
    if (!isColumns && imgEls.some(im => !im || !im.complete || !im.naturalWidth)) return;

    // Size from STABLE inputs so a cold refresh and an HMR rebuild agree:
    // the row height from the gallery's own CSS-driven box, and each image's
    // natural aspect (modern browsers report it EXIF-corrected). Measuring
    // item rects mid-load was racy → tiles came out huge on a cold refresh.
    const tileH = Math.round(g.getBoundingClientRect().height);
    if (tileH < 8) return;   // not laid out yet → retry later
    const colW = Math.round(parseFloat(getComputedStyle(g).getPropertyValue('--re-gal-col-w')) || 200);
    const widths = imgEls.map(im => isColumns ? colW : Math.round(((im?.naturalWidth || 1) / (im?.naturalHeight || 1)) * tileH));
    if (widths.some(w => w < 4)) return;

    g.dataset['swiper'] = '1';

    const wrap = this.doc.createElement('div');
    wrap.className = 're-gal-wrap';
    g.parentElement.insertBefore(wrap, g);
    wrap.appendChild(g);

    const track = this.doc.createElement('div');
    track.className = 're-gal-track';
    items.forEach((it, i) => {
      it.style.setProperty('flex', '0 0 auto', 'important');
      it.style.setProperty('width', `${widths[i]}px`, 'important');
      it.style.setProperty('height', `${tileH}px`, 'important');
      track.appendChild(it);
    });
    g.appendChild(track);
    g.classList.add('re-gal-swiper');
    g.style.height = `${tileH}px`;
    g.querySelectorAll('img').forEach(im => im.setAttribute('draggable', 'false'));

    // Measure the REAL laid-out track (transform is still identity here) so
    // the snap points + scroll extent include flex gaps/margins exactly —
    // otherwise a cumulative estimate lets it over-scroll past the last tile.
    const trackLeft = track.getBoundingClientRect().left;
    const starts = items.map(it => Math.round(it.getBoundingClientRect().left - trackLeft));
    const trackW = Math.round(track.scrollWidth);

    let offset = 0;
    let maxOffset = Math.min(0, g.clientWidth - trackW);
    const clamp = (x: number) => Math.max(maxOffset, Math.min(0, x));
    const draw = (animate: boolean) => {
      track.style.transition = animate ? 'transform .42s cubic-bezier(.22, .61, .36, 1)' : 'none';
      track.style.transform = `translate3d(${Math.round(offset)}px, 0, 0)`;
    };
    const targets = () => starts.map(s => clamp(-s));

    const arrow = (flip: boolean) =>
      `<svg width="22" height="36" viewBox="0 0 23 39"${flip ? ' style="transform:scaleX(-1)"' : ''}>` +
      `<path fill="#2F2E2E" d="M857.005,231.479L858.5,230l18.124,18-18.127,18-1.49-1.48L873.638,248Z" transform="translate(-855 -230)"/></svg>`;
    const prev = this.doc.createElement('button');
    const next = this.doc.createElement('button');
    const syncArrows = () => {
      const noScroll = maxOffset >= -1;
      prev.classList.toggle('re-gal-arrow--off', noScroll || offset >= -1);
      next.classList.toggle('re-gal-arrow--off', noScroll || offset <= maxOffset + 1);
    };
    const step = (dir: -1 | 1) => {
      const t = targets();
      let target: number;
      if (dir > 0) { const c = t.filter(o => o < offset - 1); target = c.length ? Math.max(...c) : maxOffset; }
      else { const c = t.filter(o => o > offset + 1); target = c.length ? Math.min(...c) : 0; }
      offset = clamp(target); draw(true); syncArrows();
    };
    const snap = () => {
      const t = targets();
      let best = t.length ? t[0] : 0;
      for (const o of t) if (Math.abs(o - offset) < Math.abs(best - offset)) best = o;
      offset = clamp(best); draw(true); syncArrows();
    };
    ([[prev, -1], [next, 1]] as [HTMLButtonElement, -1 | 1][]).forEach(([btn, d]) => {
      btn.type = 'button';
      btn.className = `re-gal-arrow re-gal-arrow--${d < 0 ? 'prev' : 'next'}`;
      btn.style.top = `${Math.round(tileH / 2)}px`;   // centre on the gallery, not the wrap
      btn.setAttribute('aria-label', d < 0 ? 'Previous' : 'Next');
      btn.innerHTML = arrow(d < 0);
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); step(d); });
      wrap.appendChild(btn);
    });

    // Drag: track follows the pointer 1:1 with edge resistance; on release
    // project momentum, then ease-snap to the nearest slide.
    let down = false, moved = false, startX = 0, startOff = 0, lastX = 0, vel = 0;
    g.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      down = true; moved = false; startX = lastX = e.clientX; startOff = offset; vel = 0;
      track.style.transition = 'none';
      // Capture deferred to the first real move so a TAP reaches the image
      // and opens the lightbox (capture would steal the click).
    });
    g.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved) {
        if (Math.abs(dx) <= 4) return;
        moved = true;
        g.classList.add('re-gal-dragging');
        try { g.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      vel = e.clientX - lastX; lastX = e.clientX;
      let x = startOff + dx;
      if (x > 0) x *= 0.35;
      else if (x < maxOffset) x = maxOffset + (x - maxOffset) * 0.35;
      offset = x; draw(false);
    });
    const end = (e?: PointerEvent) => {
      if (!down) return;
      down = false;
      if (e) { try { g.releasePointerCapture(e.pointerId); } catch { /* ignore */ } }
      g.classList.remove('re-gal-dragging');
      offset = clamp(offset + vel * 6);
      snap();
    };
    g.addEventListener('pointerup', end);
    g.addEventListener('pointercancel', end);
    g.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);

    const ro = new ResizeObserver(() => {
      maxOffset = Math.min(0, g.clientWidth - trackW);
      offset = clamp(offset); draw(false); syncArrows();
    });
    ro.observe(g);
    this.observers.push(ro);
    draw(false);
    syncArrows();
  }

  /**
   * Interactive Thumbnails layout: promote the active image to a large
   * stage and show the rest as a clickable thumbnail strip — click a thumb
   * (or the arrows) to swap the stage. Placement (bottom/top/left/right) is
   * CSS-driven via data-thumb-placement; this owns the active state + arrow
   * positioning. Only the stage image opens the lightbox; thumb clicks just
   * switch the active image.
   */
  private buildThumbnails(g: HTMLElement): void {
    if (g.dataset['thumbs'] === '1') return;
    const items = Array.from(g.querySelectorAll<HTMLElement>(':scope > .re-gallery-item'));
    if (!items.length) return;
    g.dataset['thumbs'] = '1';

    const thumbImgs = items.map(it => it.querySelector('img') as HTMLImageElement | null);
    const srcOf = (im: HTMLImageElement | null) => im?.getAttribute('src') || im?.currentSrc || '';
    const N = items.length;
    let active = parseInt(g.dataset['active'] || '0', 10);
    if (isNaN(active) || active < 0 || active >= N) active = 0;

    const figure = g.closest('figure.re-embed-figure') as HTMLElement | null;
    const allowDownload = figure?.getAttribute('data-allow-download') === 'true';

    // ── Stage: a one-image-per-view DRAGGABLE slider (swipe to change). ──
    const stage = this.doc.createElement('div');
    stage.className = 're-thumb-stage';
    const stageTrack = this.doc.createElement('div');
    stageTrack.className = 're-thumb-stage-track';
    thumbImgs.forEach(im => {
      const slide = this.doc.createElement('div');
      slide.className = 're-thumb-slide';
      const img = this.doc.createElement('img');
      img.src = srcOf(im); img.alt = im?.alt || ''; img.draggable = false;
      slide.appendChild(img);
      stageTrack.appendChild(slide);
    });
    stage.appendChild(stageTrack);
    g.insertBefore(stage, items[0]);

    // ── Thumb strip: clickable thumbs in a transform track, slid by its own
    //    prev/next arrows (no scrollbar). Vertical for left/right. SLIDESHOW
    //    has no strip — just the big stage. ──
    const isSlideshow = g.classList.contains('re-gallery--slideshow');
    let scroller: { reveal: (el: HTMLElement) => void } | null = null;
    const stripWrap = this.doc.createElement('div');
    if (!isSlideshow) {
      const vertical = g.dataset['thumbPlacement'] === 'left' || g.dataset['thumbPlacement'] === 'right';
      stripWrap.className = 're-thumb-strip-wrap' + (vertical ? ' re-thumb-strip-wrap--v' : '');
      const strip = this.doc.createElement('div');
      strip.className = 're-thumb-strip' + (vertical ? ' re-thumb-strip--v' : '');
      const track = this.doc.createElement('div');
      track.className = 're-thumb-track';
      items.forEach(it => { it.querySelectorAll('img').forEach(im => im.setAttribute('draggable', 'false')); track.appendChild(it); });
      strip.appendChild(track);
      stripWrap.appendChild(strip);
      g.appendChild(stripWrap);
      scroller = this.attachThumbStripScroller(strip, track, stripWrap, vertical);
    } else {
      // Slideshow: the original tiles aren't shown (the stage slides are);
      // drop them so they don't render under the stage.
      items.forEach(it => it.remove());
    }

    const W = () => stage.clientWidth || 1;
    const drawStage = (anim: boolean, px: number) => {
      stageTrack.style.transition = anim ? 'transform .38s cubic-bezier(.22, .61, .36, 1)' : 'none';
      stageTrack.style.transform = `translate3d(${Math.round(px)}px, 0, 0)`;
    };
    const revealThumb = () => scroller?.reveal(items[active]);
    const goTo = (i: number, anim = true) => {
      active = Math.max(0, Math.min(N - 1, i));
      drawStage(anim, -active * W());
      items.forEach((it, idx) => it.classList.toggle('is-active', idx === active));
      g.dataset['active'] = String(active);
      revealThumb();
    };

    // Thumb click → jump to that image.
    items.forEach((it, i) => it.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); goTo(i); }));

    // Stage drag → change slide (one per view), with edge resistance.
    let down = false, moved = false, startX = 0, lastX = 0, vel = 0;
    stage.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      // Don't start a drag (which captures the pointer and steals the click)
      // when pressing the arrows or the enlarge button.
      if ((e.target as HTMLElement).closest('.re-thumb-nav, .re-thumb-expand')) return;
      down = true; moved = false; startX = lastX = e.clientX; vel = 0;
      drawStage(false, -active * W());
      stage.classList.add('re-thumb-dragging');
      try { stage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });
    stage.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      vel = e.clientX - lastX; lastX = e.clientX;
      const min = -(N - 1) * W();
      let px = -active * W() + dx;
      if (px > 0) px *= 0.35; else if (px < min) px = min + (px - min) * 0.35;
      drawStage(false, px);
    });
    const endStage = (e?: PointerEvent) => {
      if (!down) return;
      down = false;
      if (e) { try { stage.releasePointerCapture(e.pointerId); } catch { /* ignore */ } }
      stage.classList.remove('re-thumb-dragging');
      const dx = lastX - startX, thr = W() * 0.18;
      if (dx <= -thr || vel < -6) goTo(active + 1);
      else if (dx >= thr || vel > 6) goTo(active - 1);
      else goTo(active);   // snap back
    };
    stage.addEventListener('pointerup', endStage);
    stage.addEventListener('pointercancel', endStage);

    const openLightbox = () => {
      const lbItems: LightboxItem[] = thumbImgs.map(im => ({ src: srcOf(im), alt: im?.alt || '', download: allowDownload }));
      this.lb.set({ items: lbItems, index: active });
      this.lockScroll(true);
    };
    // The stage image itself never opens the lightbox (drag/swipe only);
    // always stop the click so it doesn't bubble to the global handler.
    stage.addEventListener('click', e => { e.stopPropagation(); if (moved) { e.preventDefault(); moved = false; } });

    // Enlarge button (top-right of the stage) — the ONLY way to open the lightbox.
    const expandBtn = this.doc.createElement('button');
    expandBtn.type = 'button';
    expandBtn.className = 're-thumb-expand';
    expandBtn.setAttribute('aria-label', 'Expand image');
    expandBtn.innerHTML = `<svg width="17" height="17" viewBox="0 0 19 19" xmlns="http://www.w3.org/2000/svg"><path fill="#2F2E2E" fill-rule="nonzero" d="M15.071 8.371V4.585l-4.355 4.356a.2.2 0 0 1-.283 0l-.374-.374a.2.2 0 0 1 0-.283l4.356-4.355h-3.786a.2.2 0 0 1-.2-.2V3.2c0-.11.09-.2.2-.2H16v5.371a.2.2 0 0 1-.2.2h-.529a.2.2 0 0 1-.2-.2zm-6.5 6.9v.529a.2.2 0 0 1-.2.2H3v-5.371c0-.11.09-.2.2-.2h.529c.11 0 .2.09.2.2v3.786l4.355-4.356a.2.2 0 0 1 .283 0l.374.374a.2.2 0 0 1 0 .283L4.585 15.07h3.786c.11 0 .2.09.2.2z"/></svg>`;
    expandBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openLightbox(); });
    stage.appendChild(expandBtn);

    // Prev/next arrows on the stage.
    if (N > 1) {
      const chevron = (flip: boolean) =>
        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"${flip ? ' style="transform:scaleX(-1)"' : ''}><polyline points="9 18 15 12 9 6"/></svg>`;
      ([-1, 1] as const).forEach(dir => {
        const b = this.doc.createElement('button');
        b.type = 'button';
        b.className = `re-thumb-nav re-thumb-nav--${dir < 0 ? 'prev' : 'next'}`;
        b.setAttribute('aria-label', dir < 0 ? 'Previous' : 'Next');
        b.innerHTML = chevron(dir < 0);
        b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); goTo(active + dir); });
        stage.appendChild(b);
      });
    }

    goTo(active, false);
    const ro = new ResizeObserver(() => drawStage(false, -active * W()));
    ro.observe(stage);
    this.observers.push(ro);

    // ── Autoplay (data-driven from the editor settings). ──
    const flag = (key: string, attr: string, def: boolean): boolean => {
      const v = g.dataset[key] ?? figure?.getAttribute(attr) ?? undefined;
      return v === undefined ? def : (v === 'true' || v === 'on');
    };
    if (N > 1 && flag('autoplay', 'data-autoplay', false)) {
      const dur = Math.max(1000, parseInt(g.dataset['slideDuration'] || figure?.getAttribute('data-slide-duration') || '5000', 10) || 5000);
      const stopMouse = flag('stopOnMouse', 'data-stop-on-mouse', true);
      const resumeMouse = flag('resumeOnMouse', 'data-resume-on-mouse', true);
      const stopClick = flag('stopOnClick', 'data-stop-on-click', true);
      const resumeClick = flag('resumeOnClick', 'data-resume-on-click', false);
      let timer = 0, halted = false;
      const start = () => { if (timer || halted) return; timer = window.setInterval(() => goTo((active + 1) % N), dur); this.timers.push(timer); };
      const stop = () => { if (timer) { clearInterval(timer); this.timers = this.timers.filter(t => t !== timer); timer = 0; } };
      if (stopMouse) {
        stage.addEventListener('pointerenter', stop);
        stage.addEventListener('pointerleave', () => { if (resumeMouse && !halted) start(); });
      }
      if (stopClick) {
        const onInteract = () => { stop(); if (!resumeClick) halted = true; };
        stage.addEventListener('pointerdown', onInteract);
        stripWrap.addEventListener('pointerdown', onInteract);
      }
      start();
    }
  }

  /** Slide a thumbnail strip with prev/next arrows (no scrollbar, no drag).
   *  Works horizontally (bottom/top) or vertically (left/right). Arrows hide
   *  at the ends; `reveal` scrolls the active thumb into view. */
  private attachThumbStripScroller(strip: HTMLElement, track: HTMLElement, wrap: HTMLElement, vertical: boolean): { reveal: (el: HTMLElement) => void } {
    let offset = 0;
    const vpSize = () => vertical ? strip.clientHeight : strip.clientWidth;
    const trSize = () => vertical ? track.scrollHeight : track.scrollWidth;
    const maxOff = () => Math.min(0, vpSize() - trSize());
    const clamp = (x: number) => Math.max(maxOff(), Math.min(0, x));
    const draw = (anim: boolean) => {
      track.style.transition = anim ? 'transform .32s cubic-bezier(.22, .61, .36, 1)' : 'none';
      track.style.transform = vertical ? `translate3d(0, ${Math.round(offset)}px, 0)` : `translate3d(${Math.round(offset)}px, 0, 0)`;
    };
    const pts = (flip: boolean) => vertical
      ? (flip ? '6 15 12 9 18 15' : '6 9 12 15 18 9')   // up / down
      : (flip ? '15 18 9 12 15 6' : '9 18 15 12 9 6');  // left / right
    const mk = (dir: -1 | 1) => {
      const b = this.doc.createElement('button');
      b.type = 'button';
      b.className = `re-thumb-strip-nav re-thumb-strip-nav--${dir < 0 ? 'prev' : 'next'}`;
      b.setAttribute('aria-label', dir < 0 ? 'Previous' : 'Next');
      b.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${pts(dir < 0)}"/></svg>`;
      // next (dir +1) scrolls content the other way → offset goes negative.
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); offset = clamp(offset - dir * vpSize() * 0.8); draw(true); sync(); });
      return b;
    };
    const prev = mk(-1), next = mk(1);
    wrap.appendChild(prev); wrap.appendChild(next);
    const sync = () => {
      const none = maxOff() >= -1;
      prev.classList.toggle('re-thumb-strip-nav--off', none || offset >= -1);
      next.classList.toggle('re-thumb-strip-nav--off', none || offset <= maxOff() + 1);
    };
    const ro = new ResizeObserver(() => { offset = clamp(offset); draw(false); sync(); });
    ro.observe(strip);
    this.observers.push(ro);
    strip.querySelectorAll('img').forEach(im => { if (!im.complete) im.addEventListener('load', sync, { once: true }); });
    sync();

    // Drag-to-browse the strip (with momentum). A real drag suppresses the
    // thumb click so it doesn't select. The axis follows the orientation.
    const axis = (e: PointerEvent) => vertical ? e.clientY : e.clientX;
    let down = false, moved = false, start = 0, startOff = 0, last = 0, vel = 0, raf = 0;
    const stopM = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    strip.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      stopM(); down = true; moved = false; start = last = axis(e); startOff = offset; vel = 0;
      // NOTE: capture is deferred to the first real move (below) so a plain
      // click still reaches the thumb (capture would steal the click).
    });
    strip.addEventListener('pointermove', e => {
      if (!down) return;
      const d = axis(e) - start;
      if (!moved) {
        if (Math.abs(d) <= 4) return;
        moved = true;
        strip.classList.add('re-thumb-strip--drag');
        try { strip.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
      vel = axis(e) - last; last = axis(e);
      const mx = maxOff();
      let x = startOff + d;
      if (x > 0) x *= 0.35; else if (x < mx) x = mx + (x - mx) * 0.35;
      offset = x; draw(false);
    });
    const endDrag = (e?: PointerEvent) => {
      if (!down) return;
      down = false;
      if (e) { try { strip.releasePointerCapture(e.pointerId); } catch { /* ignore */ } }
      strip.classList.remove('re-thumb-strip--drag');
      if (Math.abs(vel) > 1) {
        let v = vel;
        const tick = () => {
          offset += v; v *= 0.92;
          const mx = maxOff();
          if (offset > 0) { offset = 0; v = 0; } else if (offset < mx) { offset = mx; v = 0; }
          draw(false); sync();
          raf = Math.abs(v) > 0.4 ? requestAnimationFrame(tick) : 0;
        };
        raf = requestAnimationFrame(tick);
      } else { offset = clamp(offset); draw(true); sync(); }
    };
    strip.addEventListener('pointerup', endDrag);
    strip.addEventListener('pointercancel', endDrag);
    strip.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);

    const reveal = (el: HTMLElement) => {
      const sr = strip.getBoundingClientRect(), er = el.getBoundingClientRect();
      let d = 0;
      if (vertical) {
        if (er.top < sr.top + 4) d = sr.top - er.top + 8;
        else if (er.bottom > sr.bottom - 4) d = sr.bottom - er.bottom - 8;
      } else {
        if (er.left < sr.left + 4) d = sr.left - er.left + 8;
        else if (er.right > sr.right - 4) d = sr.right - er.right - 8;
      }
      if (d) { offset = clamp(offset + d); draw(true); sync(); }
    };
    return { reveal };
  }

  private layoutMasonry(g: HTMLElement): void {
    const items = Array.from(g.querySelectorAll<HTMLElement>('.re-gallery-item'));
    if (!items.length) return;
    const W = g.clientWidth;
    if (!W) return;

    const cs = getComputedStyle(g);
    const gap = parseFloat(cs.getPropertyValue('--re-gal-gap')) || 8;
    const fig = g.closest('figure');
    const targetH = parseFloat(cs.getPropertyValue('--re-gal-row-h'))
      || parseFloat(fig?.getAttribute('data-row-height') || g.getAttribute('data-row-height') || '')
      || 300;

    // Need natural dimensions; re-run once any pending image loads.
    let pending = false;
    const aspectOf = (it: HTMLElement): number => {
      const im = it.querySelector('img') as HTMLImageElement | null;
      if (im && !im.naturalWidth) {
        pending = true;
        im.addEventListener('load', () => this.layoutMasonry(g), { once: true });
      }
      return im?.naturalWidth && im?.naturalHeight ? im.naturalWidth / im.naturalHeight : 1.5;
    };

    // Make the container a wrapping flex row and clear any column layout.
    g.style.display = 'flex';
    g.style.flexWrap = 'wrap';
    g.style.alignContent = 'flex-start';
    g.style.columnCount = '';
    g.style.gap = `${gap}px`;

    // Greedily build rows, then scale each to fill the width.
    const rows: { items: HTMLElement[]; aspects: number[]; sum: number }[] = [];
    let cur = { items: [] as HTMLElement[], aspects: [] as number[], sum: 0 };
    for (const it of items) {
      const a = aspectOf(it);
      const w = a * targetH;
      if (cur.items.length && cur.sum + w + gap * cur.items.length > W) {
        rows.push(cur);
        cur = { items: [], aspects: [], sum: 0 };
      }
      cur.items.push(it); cur.aspects.push(a); cur.sum += w;
    }
    if (cur.items.length) rows.push(cur);

    for (const row of rows) {
      const n = row.items.length;
      const avail = W - gap * (n - 1);
      const rowH = Math.max(40, targetH * (avail / row.sum));
      let used = 0;
      row.items.forEach((it, j) => {
        let w = Math.floor(row.aspects[j] * rowH);
        if (j === n - 1) w = Math.max(1, Math.round(avail - used));
        used += w;
        it.style.flex = '0 0 auto';
        it.style.margin = '0';
        it.style.width = `${w}px`;
        it.style.height = `${Math.round(rowH)}px`;
        it.style.overflow = 'hidden';
        it.style.borderRadius = '10px';
        const im = it.querySelector('img') as HTMLImageElement | null;
        if (im) { im.style.width = '100%'; im.style.height = '100%'; im.style.objectFit = 'cover'; im.style.display = 'block'; }
      });
    }
    void pending;
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

    // ── Image / gallery lightbox ──
    // Any content image opens the lightbox. We DON'T gate on
    // `data-click-expand="true"` because backend HTML sanitisers often
    // strip data-* attributes (the re-* classes survive, the attrs may
    // not) — so gating on it made clicks silently do nothing. Authors
    // opt OUT with data-click-expand="false". Skip linked images,
    // product-card images, and icons.
    const img = el.closest('img') as HTMLImageElement | null;
    if (!img) return;
    if (img.closest('a, .re-product, [data-click-expand="false"]')) return;

    const gallery = img.closest('.re-gallery, figure.re-embed-figure--gallery') as HTMLElement | null;
    const figure = img.closest('figure.re-embed-figure') as HTMLElement | null;
    const scope = gallery ?? figure;
    const imgs = scope
      ? Array.from(scope.querySelectorAll<HTMLImageElement>('img'))
      : [img];
    if (!imgs.length) return;
    ev.preventDefault();

    const allowDownload = (figure?.getAttribute('data-allow-download') === 'true')
      || !!img.closest('[data-allow-download="true"]');
    const items: LightboxItem[] = imgs.map(i => ({
      src: i.getAttribute('src') || i.currentSrc || '',
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
    this.slideDir.set(delta >= 0 ? 1 : -1);
    this.lb.set({ ...box, index: (box.index + delta + n) % n });
  }

  closeLb(): void {
    this.lb.set(null);
    this.lockScroll(false);
  }

  /** Toggle browser fullscreen on the lightbox surface. */
  toggleFs(ev: Event): void {
    ev.stopPropagation();
    if (!this.isBrowser) return;
    const d = this.doc as Document & { fullscreenElement?: Element | null; exitFullscreen?: () => void };
    if (d.fullscreenElement) { d.exitFullscreen?.(); return; }
    const el = this.doc.querySelector('.lb') as (HTMLElement & { requestFullscreen?: () => void }) | null;
    el?.requestFullscreen?.();
  }

  /** Right-click on the open lightbox image: block "save image" unless
   *  the author allowed downloads for it. */
  onImgMenu(ev: MouseEvent, allowed: boolean): void {
    if (!allowed) ev.preventDefault();
  }

  /** Right-click on a content image: block saving unless its figure is
   *  flagged data-allow-download="true". */
  onContentMenu(ev: MouseEvent): void {
    const img = (ev.target as HTMLElement | null)?.closest('img');
    if (!img) return;
    const figure = img.closest('figure.re-embed-figure');
    // Only the editor's media figures carry the download setting; block
    // saving on those unless it's explicitly allowed. Leave other images
    // (logos, inline icons) alone.
    if (figure && figure.getAttribute('data-allow-download') !== 'true') ev.preventDefault();
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

  ngOnDestroy(): void {
    this.observers.forEach(o => o.disconnect());
    this.observers = [];
    this.timers.forEach(t => clearInterval(t));
    this.timers = [];
  }
}
