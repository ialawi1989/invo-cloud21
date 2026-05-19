import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Renders plain text or HTML and wraps `#hashtag` patterns in styled
 * `<a>` tags pointing at `/blog/tag/:slug`. Used in comment content
 * previews and inside category/tag chips so admins can spot tagged
 * content at a glance.
 */
@Component({
  selector: 'app-hashtag-text',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [innerHTML]="rendered()"></span>`,
  styles: [`
    :host ::ng-deep .hashtag {
      color: var(--color-brand-600, #0e7490);
      font-weight: 500;
      text-decoration: none;
      transition: text-decoration 100ms ease;
    }
    :host ::ng-deep .hashtag:hover { text-decoration: underline; }
  `],
})
export class HashtagTextComponent {
  text = input<string>('');

  rendered = computed(() => {
    const escaped = escapeHtml(this.text() ?? '');
    return escaped.replace(
      /#([\p{L}\p{N}_]+)/gu,
      (_, tag: string) =>
        `<a class="hashtag" href="/blog/tag/${encodeURIComponent(tag.toLowerCase())}">#${tag}</a>`,
    );
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;'
    : ch === '<' ? '&lt;'
    : ch === '>' ? '&gt;'
    : ch === '"' ? '&quot;' : '&#39;'
  ));
}
