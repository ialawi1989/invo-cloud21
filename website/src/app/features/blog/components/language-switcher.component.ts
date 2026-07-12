import { Component, Input, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { inject } from '@angular/core';

import { nativeLanguageName } from '../i18n/i18n';
import { BlogSettingsService } from '../services/blog-settings.service';

/**
 * Language switcher used in the blog header and on the post page.
 *
 * Two ways to override the target URL:
 *   - `urlFor(lang)` callback — for post pages, returns the hreflang
 *     alternate URL.
 *   - default — replaces the first segment of the current URL with
 *     the new lang code. Works for /:lang/blog, /:lang/blog/category/:slug,
 *     /:lang/blog/authors/:slug, etc.
 */
@Component({
  selector: 'app-language-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (languages.length > 1) {
      <div class="ls" (mouseleave)="open.set(false)">
        <button class="ls-trigger" type="button"
                (click)="open.set(!open())"
                [attr.aria-expanded]="open()">
          <span aria-hidden="true">🌐</span>
          <span>{{ name(current) }}</span>
          <span aria-hidden="true">▾</span>
        </button>
        @if (open()) {
          <ul class="ls-menu" role="menu">
            @for (lang of languages; track lang) {
              <li>
                <button type="button" role="menuitem"
                        (click)="pick(lang)"
                        [class.active]="lang === current">
                  {{ name(lang) }}
                </button>
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: inline-block; }
    .ls { position: relative; }
    .ls-trigger {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 12px; border-radius: 6px;
      background: transparent;
      border: 1px solid rgba(0,0,0,.12);
      cursor: pointer; font: inherit; color: inherit;
    }
    .ls-menu {
      position: absolute; inset-block-start: calc(100% + 4px); inset-inline-end: 0;
      min-width: 160px;
      background: #fff; color: #111;
      border: 1px solid rgba(0,0,0,.08);
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,.12);
      padding: 4px; margin: 0; list-style: none; z-index: 50;
    }
    .ls-menu button {
      width: 100%; text-align: start;
      padding: 8px 10px; border-radius: 4px;
      background: transparent; border: 0; cursor: pointer;
      font: inherit; color: inherit;
    }
    .ls-menu button.active { background: rgba(99,102,241,.1); color: var(--primary, #6366f1); }
    .ls-menu button:hover { background: rgba(0,0,0,.04); }
  `],
})
export class LanguageSwitcherComponent {
  @Input({ required: true }) languages: string[] = [];
  @Input({ required: true }) current = 'en';
  /** Custom resolver so post pages can navigate to the translated slug. */
  @Input() urlFor: ((lang: string) => string | null) | null = null;

  private router = inject(Router);
  private settingsSvc = inject(BlogSettingsService);
  open = signal(false);

  name(code: string): string { return nativeLanguageName(code); }

  pick(lang: string): void {
    this.open.set(false);
    if (lang === this.current) return;

    const s = this.settingsSvc.settings();
    const supported = s.languages.supported;

    // Custom resolver wins (e.g. the post page's translated-slug URL). It
    // returns a subdirectory-shaped path (/xx/blog/slug).
    let resolved: string | null = null;
    if (this.urlFor) resolved = this.urlFor(lang);

    if (s.languages.urlStructure === 'parameter') {
      // Parameter mode: lang-less path + `?lang=`. Default language → clean URL
      // (no param); a non-default language adds `?lang=xx`.
      const [rawPath, rawQuery] = (resolved ?? this.router.url).split('?');
      const segs = rawPath.split('/').filter(Boolean);
      if (segs.length && supported.includes(segs[0])) segs.shift(); // drop any lang segment
      const params = new URLSearchParams(rawQuery ?? '');
      if (lang === s.languages.default) params.delete('lang');
      else params.set('lang', lang);
      const q = params.toString();
      this.router.navigateByUrl('/' + segs.join('/') + (q ? '?' + q : ''));
      return;
    }

    // Subdirectory mode.
    if (resolved) { this.router.navigateByUrl(resolved); return; }
    const [path, query] = this.router.url.split('?');
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) { this.router.navigateByUrl(`/${lang}/blog`); return; }
    segments[0] = lang;
    this.router.navigateByUrl(`/${segments.join('/')}${query ? '?' + query : ''}`);
  }
}
