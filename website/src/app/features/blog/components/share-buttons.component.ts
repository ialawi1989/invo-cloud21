import { Component, Input, ChangeDetectionStrategy, signal, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { t } from '../i18n/i18n';

/**
 * Social share row. Opens each network's share URL in a new tab; the
 * Copy Link button uses the Clipboard API with a manual fallback for
 * older browsers. SSR-safe — every interaction is gated on platform.
 */
@Component({
  selector: 'app-share-buttons',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="share" role="group" [attr.aria-label]="t('share')">
      <a class="btn" target="_blank" rel="noopener" [href]="fbUrl()">Facebook</a>
      <a class="btn" target="_blank" rel="noopener" [href]="twUrl()">X</a>
      <a class="btn" target="_blank" rel="noopener" [href]="liUrl()">LinkedIn</a>
      <a class="btn mobile-only" target="_blank" rel="noopener" [href]="waUrl()">WhatsApp</a>
      <button class="btn" type="button" (click)="copy()">
        {{ copied() ? t('link_copied') : t('copy_link') }}
      </button>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .share { display: flex; flex-wrap: wrap; gap: 8px; }
    .btn {
      padding: 8px 14px;
      border-radius: 6px;
      border: 1px solid rgba(0,0,0,.12);
      background: transparent;
      color: inherit;
      text-decoration: none;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    .btn:hover { background: rgba(0,0,0,.04); }
    @media (min-width: 769px) { .mobile-only { display: none; } }
  `],
})
export class ShareButtonsComponent {
  @Input({ required: true }) url = '';
  @Input({ required: true }) title = '';
  @Input() lang = 'en';

  private platformId = inject(PLATFORM_ID);
  copied = signal(false);

  t = (k: string) => t(this.lang, k);

  fbUrl(): string { return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.url)}`; }
  twUrl(): string { return `https://twitter.com/intent/tweet?url=${encodeURIComponent(this.url)}&text=${encodeURIComponent(this.title)}`; }
  liUrl(): string { return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(this.url)}`; }
  waUrl(): string { return `https://wa.me/?text=${encodeURIComponent(this.title + ' ' + this.url)}`; }

  async copy(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      await navigator.clipboard.writeText(this.url);
    } catch {
      // Older browsers — fall back to a textarea selection.
      const ta = document.createElement('textarea');
      ta.value = this.url; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
    }
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1800);
  }
}
