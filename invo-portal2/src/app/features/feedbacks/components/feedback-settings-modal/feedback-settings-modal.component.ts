import { ChangeDetectionStrategy, Component, WritableSignal, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '@core/i18n/language.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { EmailChipsComponent } from '../../../account/components/email-chips/email-chips.component';

import { FeedbackSettings, RATINGS, ratingColor } from '../../models/feedback.model';
import { FeedbacksService } from '../../services/feedbacks.service';

const SORTED = [...RATINGS].sort((a, b) => a - b);

/**
 * Feedback settings popup (legacy `settings.component`): the e-mails to notify and for which ratings, plus the Google
 * review link and the ratings that should be offered it. Saved to `company/setFeedbackSettings`.
 */
@Component({
  selector: 'app-feedback-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, EmailChipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feedback-settings-modal.component.html',
  styleUrl: './feedback-settings-modal.component.scss',
})
export class FeedbackSettingsModalComponent {
  private service = inject(FeedbacksService);
  private toast = inject(ToastService);
  private lang = inject(LanguageService);
  private data = inject<Partial<FeedbackSettings> | null>(MODAL_DATA);
  readonly ref = inject(MODAL_REF);

  readonly options = SORTED;
  readonly color = ratingColor;

  readonly emails = signal<string[]>(this.data?.emailNotifications?.emails ?? []);
  readonly notifyOn = signal<number[]>(this.data?.emailNotifications?.ratings ?? []);
  readonly googleUrl = signal<string>(this.data?.googleFeedbackSettings?.url ?? '');
  readonly linkOn = signal<number[]>(this.data?.googleFeedbackSettings?.ratings ?? []);
  readonly saving = signal(false);

  label(n: number): string {
    return n === 1 ? this.lang.instant('FEEDBACKS.SETTINGS.STAR') : this.lang.instant('FEEDBACKS.SETTINGS.STARS', { n });
  }

  toggle(list: WritableSignal<number[]>, n: number): void {
    list.update(l => (l.includes(n) ? l.filter(x => x !== n) : [...l, n]));
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const feedbackSettings: FeedbackSettings = {
      emailNotifications: { emails: this.emails(), ratings: [...this.notifyOn()].sort((a, b) => a - b) },
      googleFeedbackSettings: { url: this.googleUrl(), ratings: [...this.linkOn()].sort((a, b) => a - b) },
    };
    try {
      const res = await this.service.saveSettings(feedbackSettings);
      if (res?.success) {
        this.toast.success('COMMON.SAVED_OK');
        this.ref.close(feedbackSettings);
      } else {
        this.toast.error('COMMON.OPS', typeof res?.msg === 'string' ? res.msg : undefined);
      }
    } catch (e: any) {
      this.toast.error('COMMON.OPS', e?.error?.msg ?? e?.message);
    } finally {
      this.saving.set(false);
    }
  }
}
