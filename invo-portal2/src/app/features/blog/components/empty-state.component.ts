import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Centered illustration + title + description + optional action(s).
 *
 * Used across the blog pages for:
 *   - "No posts yet" first-run empty state
 *   - "No comments match your filters" filtered empty
 *   - "Couldn't load …" error retry state
 *
 * Tone (`info` / `error`) controls the illustration colour palette so the
 * same component covers "happy empty" and "failed to load" without each
 * caller having to swap classes.
 */
@Component({
  selector: 'app-blog-empty-state',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="es" [attr.data-tone]="tone()">
      <div class="es__art">
        @switch (icon()) {
          @case ('posts') {
            <svg viewBox="0 0 80 80" fill="none">
              <rect x="14" y="14" width="46" height="56" rx="6" fill="currentColor" opacity=".10"/>
              <rect x="20" y="8"  width="46" height="56" rx="6" fill="#fff" stroke="currentColor" stroke-width="2"/>
              <rect x="27" y="20" width="32" height="4"  rx="2" fill="currentColor" opacity=".55"/>
              <rect x="27" y="30" width="24" height="3"  rx="1.5" fill="currentColor" opacity=".25"/>
              <rect x="27" y="37" width="28" height="3"  rx="1.5" fill="currentColor" opacity=".25"/>
              <rect x="27" y="44" width="20" height="3"  rx="1.5" fill="currentColor" opacity=".25"/>
            </svg>
          }
          @case ('comments') {
            <svg viewBox="0 0 80 80" fill="none">
              <path d="M16 22a6 6 0 0 1 6-6h28a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H34l-10 8v-8h-2a6 6 0 0 1-6-6z"
                    fill="currentColor" opacity=".10"/>
              <path d="M22 18a6 6 0 0 0-6 6v18a6 6 0 0 0 6 6h2v10l12-10h22a6 6 0 0 0 6-6V24a6 6 0 0 0-6-6z"
                    stroke="currentColor" stroke-width="2" fill="#fff"/>
              <circle cx="30" cy="33" r="2.5" fill="currentColor" opacity=".55"/>
              <circle cx="40" cy="33" r="2.5" fill="currentColor" opacity=".55"/>
              <circle cx="50" cy="33" r="2.5" fill="currentColor" opacity=".55"/>
            </svg>
          }
          @case ('tags') {
            <svg viewBox="0 0 80 80" fill="none">
              <path d="M14 38v-18a6 6 0 0 1 6-6h18l28 28-24 24z"
                    fill="currentColor" opacity=".10"/>
              <path d="M18 34V16a6 6 0 0 1 6-6h18l28 28-24 24z"
                    stroke="currentColor" stroke-width="2" fill="#fff"/>
              <circle cx="30" cy="22" r="3.5" stroke="currentColor" stroke-width="2" fill="#fff"/>
            </svg>
          }
          @case ('error') {
            <svg viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="28" fill="currentColor" opacity=".10"/>
              <circle cx="40" cy="40" r="28" stroke="currentColor" stroke-width="2" fill="#fff"/>
              <path d="M40 28v16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              <circle cx="40" cy="52" r="2.2" fill="currentColor"/>
            </svg>
          }
          @case ('search') {
            <svg viewBox="0 0 80 80" fill="none">
              <circle cx="36" cy="36" r="20" stroke="currentColor" stroke-width="2" fill="#fff"/>
              <circle cx="36" cy="36" r="20" fill="currentColor" opacity=".10"/>
              <path d="M50 50l14 14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              <path d="M28 36h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".55"/>
            </svg>
          }
          @default {
            <svg viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="30" fill="currentColor" opacity=".10"/>
              <circle cx="40" cy="40" r="30" stroke="currentColor" stroke-width="2" fill="#fff"/>
            </svg>
          }
        }
      </div>

      <h3 class="es__title">{{ title() }}</h3>
      @if (description()) {
        <p class="es__desc">{{ description() }}</p>
      }

      @if (primaryLabel() || secondaryLabel()) {
        <div class="es__actions">
          @if (secondaryLabel()) {
            <button type="button" class="es__btn es__btn--ghost" (click)="secondary.emit()">
              {{ secondaryLabel() }}
            </button>
          }
          @if (primaryLabel()) {
            <button type="button" class="es__btn es__btn--primary" (click)="primary.emit()">
              {{ primaryLabel() }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .es {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 56px 24px;
      text-align: center;
      color: var(--color-brand-600, #0e7490);
    }
    .es[data-tone="error"] { color: #ef4444; }
    .es[data-tone="warn"]  { color: #f59e0b; }

    .es__art {
      width: 96px;
      height: 96px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
    }
    .es__art svg { width: 100%; height: 100%; display: block; }

    .es__title {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .es__desc {
      margin: 0;
      max-width: 360px;
      font-size: 13px;
      line-height: 1.55;
      color: #64748b;
    }

    .es__actions {
      display: inline-flex;
      gap: 8px;
      margin-top: 14px;
    }
    .es__btn {
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid transparent;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
    }
    .es__btn--primary {
      background: #32acc1;
      color: #fff;
      &:hover { background: #2a93a6; }
    }
    .es__btn--ghost {
      background: transparent;
      color: #475569;
      border-color: #e2e8f0;
      &:hover { background: #f1f5f9; color: #0f172a; }
    }
  `],
})
export class EmptyStateComponent {
  /** Pre-baked SVG illustration. Pick the one that matches the page. */
  icon = input<'posts' | 'comments' | 'tags' | 'error' | 'search' | 'default'>('default');

  /** Visual tone — controls the illustration tint. */
  tone = input<'info' | 'error' | 'warn'>('info');

  title       = input.required<string>();
  description = input<string>('');

  primaryLabel   = input<string>('');
  secondaryLabel = input<string>('');

  primary   = output<void>();
  secondary = output<void>();
}
