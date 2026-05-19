import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { BlogTaxonomy } from '../models/blog.types';
import { t } from '../i18n/i18n';

@Component({
  selector: 'app-category-menu-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="strip" [attr.aria-label]="t('category')">
      <a class="pill"
         [routerLink]="['/', lang, 'blog']"
         routerLinkActive="active"
         [routerLinkActiveOptions]="{ exact: true }">
        {{ t('all_posts') }}
      </a>
      @for (c of categories; track c.id) {
        <a class="pill"
           [routerLink]="['/', lang, 'blog', 'category', c.slug]"
           routerLinkActive="active">
          {{ c.name }}
        </a>
      }
    </nav>
  `,
  styles: [`
    :host { display: block; }
    .strip {
      display: flex; gap: 8px;
      overflow-x: auto;
      padding: 4px 0 12px;
      scrollbar-width: thin;
    }
    .pill {
      padding: 8px 16px;
      border-radius: 999px;
      border: 1px solid rgba(0,0,0,.08);
      background: transparent;
      color: inherit;
      font-size: 14px;
      text-decoration: none;
      white-space: nowrap;
      transition: background .15s, color .15s;
    }
    .pill:hover { background: rgba(0,0,0,.04); }
    .pill.active { background: var(--primary, #6366f1); color: #fff; border-color: transparent; }
  `],
})
export class CategoryMenuStripComponent {
  @Input({ required: true }) lang = 'en';
  @Input({ required: true }) categories: BlogTaxonomy[] = [];

  t = (k: string) => t(this.lang, k);
}
