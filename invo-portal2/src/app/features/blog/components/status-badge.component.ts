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
    .b[data-tone="deleted"]  { background: #f1f5f9; color: #475569; }
    .b[data-tone="published"],
    .b[data-tone="visible"]  { background: #ecfdf5; color: #047857; }
    .b[data-tone="scheduled"] { background: #eff6ff; color: #1d4ed8; }
    .b[data-tone="pending"]   { background: #fffbeb; color: #b45309; }
    .b[data-tone="flagged"]   { background: #fef2f2; color: #b91c1c; }
  `],
})
export class StatusBadgeComponent {
  status = input.required<string>();
}
