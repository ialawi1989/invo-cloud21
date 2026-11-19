import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Color-coded status pill shared by Posts and Comments lists.
 *
 *   draft     → slate
 *   published → green
 *   scheduled → blue
 *   visible   → green
 *   pending   → amber
 *   flagged   → red
 *   deleted   → slate
 *
 * Label is rendered via i18n key `BLOG.STATUS.<UPPERCASE>`.
 */
@Component({
  selector: 'app-blog-status-badge',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="b" [attr.data-tone]="status()">
      {{ 'BLOG.STATUS.' + status().toUpperCase() | translate }}
    </span>
  `,
  styles: [`
    .b {
      display: inline-flex;
      align-items: center;
      padding: 2px 9px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .02em;
      border-radius: 999px;
      text-transform: capitalize;
      white-space: nowrap;
    }
    .b[data-tone="draft"],
    .b[data-tone="deleted"]  { background: var(--ui-surface-2); color: var(--ui-text-4); }
    .b[data-tone="published"],
    .b[data-tone="visible"]  { background: var(--ui-green-soft); color: var(--ui-green-text); }
    .b[data-tone="scheduled"] { background: var(--ui-x-eff6ff); color: var(--ui-t-1d4ed8); }
    .b[data-tone="pending"]   { background: var(--ui-amber-soft); color: var(--ui-amber-text); }
    .b[data-tone="flagged"]   { background: var(--ui-red-soft); color: var(--ui-red-text); }
  `],
})
export class StatusBadgeComponent {
  status = input.required<string>();
}
