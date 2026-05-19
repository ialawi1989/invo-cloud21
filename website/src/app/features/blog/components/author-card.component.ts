import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { PostAuthorRef } from '../models/blog.types';
import { t } from '../i18n/i18n';

@Component({
  selector: 'app-author-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  template: `
    @if (author) {
      <aside class="author-card">
        @if (author.image) {
          <img [src]="author.image" [alt]="author.name" class="avatar">
        }
        <div class="who">
          <strong>{{ author.name }}</strong>
          @if (author.publicTitle) { <div class="title">{{ author.publicTitle }}</div> }
          @if (author.publicBio) { <p class="bio">{{ author.publicBio }}</p> }
          @if (author.id) {
            <a [routerLink]="['/', lang, 'blog', 'authors', author.id]" class="btn">
              {{ t(lang, 'read_more_by', { name: author.name }) }}
            </a>
          }
        </div>
      </aside>
    }
  `,
  styles: [`
    :host { display: block; }
    .author-card {
      display: flex; gap: 20px; align-items: flex-start;
      padding: 24px;
      background: rgba(0,0,0,.03);
      border-radius: 12px;
      margin: 48px 0;
    }
    .avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .who { flex: 1; }
    .title { font-size: 13px; opacity: .7; margin-top: 2px; }
    .bio { margin: 12px 0; font-size: 15px; line-height: 1.6; }
    .btn {
      display: inline-block; padding: 8px 14px;
      border: 1px solid currentColor; border-radius: 6px;
      text-decoration: none; color: inherit; font-size: 14px;
    }
    .btn:hover { background: rgba(0,0,0,.04); }
    @media (max-width: 600px) {
      .author-card { flex-direction: column; }
    }
  `],
})
export class AuthorCardComponent {
  @Input() author: PostAuthorRef | null = null;
  @Input({ required: true }) lang = 'en';
  t = t;
}
