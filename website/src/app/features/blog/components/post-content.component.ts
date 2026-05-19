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
      max-width: 720px;
      margin: 0 auto;
      font-size: 18px;
      line-height: 1.75;
      color: inherit;
    }
    @media (max-width: 768px) { .prose { font-size: 16px; line-height: 1.7; } }
    .prose ::ng-deep h2 { font-size: 30px; line-height: 1.25; margin: 48px 0 16px; font-weight: 700; }
    .prose ::ng-deep h3 { font-size: 22px; line-height: 1.3;  margin: 36px 0 12px; font-weight: 600; }
    .prose ::ng-deep p  { margin: 18px 0; }
    .prose ::ng-deep a  { color: var(--primary, #6366f1); text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .prose ::ng-deep a:hover { text-decoration: underline; }
    .prose ::ng-deep blockquote {
      border-inline-start: 4px solid var(--primary, #6366f1);
      padding: 4px 20px; margin: 24px 0;
      font-style: italic; color: rgba(0,0,0,.7);
    }
    .prose ::ng-deep ul, .prose ::ng-deep ol { padding-inline-start: 28px; margin: 18px 0; }
    .prose ::ng-deep li { margin: 6px 0; }
    .prose ::ng-deep img { max-width: 100%; height: auto; border-radius: 8px; margin: 24px 0; }
    .prose ::ng-deep figure { margin: 24px 0; }
    .prose ::ng-deep figcaption { font-size: 13px; color: rgba(0,0,0,.55); text-align: center; margin-top: 6px; }
    .prose ::ng-deep pre {
      background: rgba(0,0,0,.05); padding: 16px; border-radius: 8px;
      overflow-x: auto; font-size: 14px;
    }
    .prose ::ng-deep code {
      font-family: 'SF Mono', Menlo, monospace;
      background: rgba(0,0,0,.06);
      padding: 2px 6px; border-radius: 4px; font-size: .9em;
    }
    .prose ::ng-deep pre code { background: transparent; padding: 0; }
    .prose ::ng-deep .blog-hashtag {
      color: var(--primary, #6366f1);
      font-weight: 500;
      text-decoration: none;
    }
    .prose ::ng-deep .blog-hashtag:hover { text-decoration: underline; }
    [dir='rtl'] .prose { text-align: right; }
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
