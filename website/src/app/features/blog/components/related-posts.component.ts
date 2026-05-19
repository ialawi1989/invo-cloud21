import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PostSummary } from '../models/blog.types';
import { PublicBlogDisplaySettings } from '../models/blog-settings.types';
import { PostCardComponent } from './post-card.component';
import { t } from '../i18n/i18n';

@Component({
  selector: 'app-related-posts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PostCardComponent],
  template: `
    @if (posts?.length) {
      <section class="related">
        <h2>{{ t(lang, 'related_posts') }}</h2>
        <div class="row">
          @for (p of posts; track p.id) {
            <app-post-card variant="compact"
                           [post]="p" [lang]="lang" [display]="display"></app-post-card>
          }
        </div>
      </section>
    }
  `,
  styles: [`
    :host { display: block; }
    .related { margin: 48px 0; }
    h2 { font-size: 22px; margin: 0 0 16px; }
    .row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 20px;
    }
    @media (max-width: 768px) {
      .row { grid-auto-flow: column; grid-auto-columns: 75vw; grid-template-columns: none; overflow-x: auto; padding-bottom: 8px; }
    }
  `],
})
export class RelatedPostsComponent {
  @Input() posts: PostSummary[] | null = null;
  @Input({ required: true }) lang = 'en';
  @Input({ required: true }) display!: PublicBlogDisplaySettings;
  t = t;
}
