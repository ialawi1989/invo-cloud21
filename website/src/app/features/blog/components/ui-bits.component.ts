import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { t } from '../i18n/i18n';

/**
 * Small dumb chrome — loading skeleton, empty state, and an inline
 * error banner. Bundled here so we don't sprinkle five-line files
 * across the feature folder.
 */

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="skel-grid">
      @for (_ of fillArray(); track $index) {
        <div class="skel-card">
          <div class="skel cover"></div>
          <div class="skel line w70"></div>
          <div class="skel line w40"></div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .skel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    @media (max-width: 1024px) { .skel-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 640px) { .skel-grid { grid-template-columns: 1fr; } }
    .skel-card { display: flex; flex-direction: column; gap: 10px; }
    .skel {
      background: linear-gradient(90deg, rgba(0,0,0,.05), rgba(0,0,0,.09), rgba(0,0,0,.05));
      background-size: 200% 100%;
      animation: pulse 1.4s linear infinite;
      border-radius: 6px;
    }
    .skel.cover { aspect-ratio: 16 / 9; }
    .skel.line { height: 12px; }
    .w70 { width: 70%; } .w40 { width: 40%; }
    @keyframes pulse { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  `],
})
export class LoadingSkeletonComponent {
  @Input() count = 6;
  fillArray() { return Array.from({ length: this.count }); }
}

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="empty">
      <div class="icon" aria-hidden="true">📰</div>
      <h3>{{ title }}</h3>
      @if (body) { <p>{{ body }}</p> }
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .empty { text-align: center; padding: 80px 24px; color: rgba(0,0,0,.55); }
    .icon { font-size: 56px; margin-bottom: 8px; }
    h3 { margin: 0 0 6px; }
    p { margin: 0; }
  `],
})
export class EmptyStateComponent {
  @Input() title = '';
  @Input() body = '';
}

@Component({
  selector: 'app-error-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="err" role="alert">
      <strong>{{ t(lang, 'error_title') }}</strong>
      <p>{{ message || t(lang, 'error_body') }}</p>
      @if (showRetry) {
        <button type="button" (click)="retry.emit()">{{ t(lang, 'retry') }}</button>
      }
    </div>
  `,
  styles: [`
    .err { padding: 20px; border: 1px solid rgba(220,50,50,.3); background: rgba(220,50,50,.06); border-radius: 8px; }
    .err p { margin: 6px 0 10px; }
    .err button { padding: 6px 14px; border: 1px solid currentColor; background: transparent; cursor: pointer; border-radius: 4px; font: inherit; color: inherit; }
  `],
})
export class ErrorBannerComponent {
  @Input() lang = 'en';
  @Input() message = '';
  @Input() showRetry = false;
  @Output() retry = new EventEmitter<void>();
  t = t;
}
