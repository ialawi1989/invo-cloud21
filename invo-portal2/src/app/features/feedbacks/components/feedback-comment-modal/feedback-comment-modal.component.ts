import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { Feedback, ratingColor } from '../../models/feedback.model';

/** Full text of one feedback comment (legacy `CommentModalComponent`). */
@Component({
  selector: 'app-feedback-comment-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="data.customerName || ('FEEDBACKS.TITLE' | translate)" [subtitle]="(data.createdAt | date: 'dd/MM/yyyy hh:mm a') ?? ''" />
    <div class="body">
      <div class="meta">
        <span class="stars">@for (s of stars; track $index) { <span>{{ $index < data.rating ? '★' : '☆' }}</span> }</span>
        <span class="badge" [class]="'badge--' + color">{{ data.rating }}/5</span>
      </div>
      <p class="text">{{ data.comment || ('FEEDBACKS.NO_COMMENT' | translate) }}</p>
    </div>
    <div class="foot"><button type="button" class="btn" (click)="ref.dismiss()">{{ 'COMMON.CLOSE' | translate }}</button></div>
  `,
  styles: [`
    .body { padding: 16px 24px; }
    .meta { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .stars { color: #f59e0b; letter-spacing: 1px; }
    .badge { padding: 1px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; color: #fff; }
    .badge--success { background: #22c55e; } .badge--warning { background: #f59e0b; } .badge--danger { background: #ef4444; }
    .text { margin: 0; font-size: 14px; line-height: 1.7; color: #1e293b; white-space: pre-wrap; word-break: break-word; }
    .foot { display: flex; justify-content: flex-end; padding: 12px 24px 16px; }
    .btn { padding: 9px 20px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; cursor: pointer; }
    .btn:hover { background: #e5e7eb; }
  `],
})
export class FeedbackCommentModalComponent {
  readonly data = inject<Feedback>(MODAL_DATA);
  readonly ref = inject(MODAL_REF);
  readonly stars = [1, 2, 3, 4, 5];
  readonly color = ratingColor(this.data.rating);
}
