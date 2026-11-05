import '../../account-i18n';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DocAttachment, DocAttachmentsComponent } from '../doc-attachments/doc-attachments.component';

/**
 * The "Attachments" card every document form shares (amber upload badge + title + the attach control),
 * as laid out in the invoice form. Drop it next to the party card inside a two-column row.
 */
@Component({
  selector: 'app-doc-attachments-card',
  standalone: true,
  imports: [TranslateModule, DocAttachmentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dac">
      <h2 class="dac__title">
        <span class="dac__ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg></span>
        {{ 'DOC_FORM.ATTACHMENTS' | translate }}
      </h2>
      <app-doc-attachments [attachments]="attachments()" (changed)="changed.emit($event)"/>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .dac { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
    .dac__title { display: flex; align-items: center; gap: 12px; margin: 0; font-size: 15px; font-weight: 700; color: #0f172a; }
    .dac__ico { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: #fef3c7; color: #b45309; }
  `],
})
export class DocAttachmentsCardComponent {
  attachments = input<DocAttachment[]>([]);
  changed = output<DocAttachment[]>();
}
