import { Component, Input, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { LanguageSwitcherComponent } from './language-switcher.component';
import { t } from '../i18n/i18n';

@Component({
  selector: 'app-blog-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, LanguageSwitcherComponent],
  template: `
    <header class="blog-header">
      <div class="left">
        <a [routerLink]="['/', lang, 'blog']" class="brand">
          <strong>{{ siteName }}</strong>
          <span class="dot">·</span>
          <span>{{ t('blog') }}</span>
        </a>
      </div>

      <form class="search" (ngSubmit)="submit()">
        <span aria-hidden="true" class="icon">🔍</span>
        <input type="search"
               [(ngModel)]="query"
               name="q"
               [placeholder]="t('search_placeholder')"
               [attr.aria-label]="t('search')">
      </form>

      <div class="right">
        <app-language-switcher
          [languages]="languages"
          [current]="lang"
          [urlFor]="urlFor">
        </app-language-switcher>
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; }
    .blog-header {
      display: flex; align-items: center; gap: 24px;
      padding: 16px 24px;
      border-bottom: 1px solid rgba(0,0,0,.08);
    }
    .brand {
      text-decoration: none; color: inherit;
      font-size: 16px;
      display: inline-flex; align-items: center; gap: 8px;
    }
    .brand .dot { opacity: .4; }
    .search { flex: 1; max-width: 420px; position: relative; }
    .search .icon { position: absolute; inset-block-start: 50%; inset-inline-start: 12px; transform: translateY(-50%); opacity: .6; }
    .search input {
      width: 100%; padding: 10px 14px 10px 36px;
      border: 1px solid rgba(0,0,0,.12);
      border-radius: 999px;
      background: rgba(0,0,0,.03);
      font: inherit; color: inherit;
    }
    [dir='rtl'] .search input { padding: 10px 36px 10px 14px; }
    [dir='rtl'] .search .icon { inset-inline-start: auto; inset-inline-end: 12px; }
    .search input:focus { outline: 2px solid var(--primary, #6366f1); outline-offset: 1px; }
    .right { margin-inline-start: auto; }
    @media (max-width: 720px) {
      .blog-header { flex-wrap: wrap; gap: 12px; padding: 12px 16px; }
      .search { order: 3; max-width: none; flex-basis: 100%; }
    }
  `],
})
export class BlogHeaderComponent {
  @Input({ required: true }) lang = 'en';
  @Input() siteName = 'Site';
  @Input() languages: string[] = ['en'];
  @Input() urlFor: ((lang: string) => string | null) | null = null;

  query = '';
  private router = inject(Router);

  submit(): void {
    const q = this.query.trim();
    if (!q) return;
    this.router.navigate(['/', this.lang, 'blog', 'search'], { queryParams: { q } });
  }

  t = (k: string) => t(this.lang, k);
}
