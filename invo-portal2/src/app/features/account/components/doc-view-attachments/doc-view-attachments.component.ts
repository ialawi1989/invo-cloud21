import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ToastService } from '@shared/components/toast/toast.service';
import { MediaService } from '../../../settings/media/services/media.service';
import { DocAttachment, DocAttachmentsComponent } from '../doc-attachments/doc-attachments.component';

/**
 * The collapsible "Attachments" card on a document's view page. Unlike the form (which defers to its own
 * Save) the view persists immediately — matching legacy's `autoUpload` + immediate-save: add and remove use
 * the media API's own two endpoints, queued through one chain so an add followed by a remove can't race
 * (a later failure-rollback must never restore a snapshot older than an earlier successful call).
 * Drop it in a view with `<app-doc-view-attachments beforePaper type="creditNote" [docId]="id" [attachments]="doc.attachment"/>`.
 */
@Component({
  selector: 'app-doc-view-attachments',
  standalone: true,
  imports: [TranslateModule, DocAttachmentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dv-card">
      <button type="button" class="dv-card__head" (click)="collapsed.set(!collapsed())">
        <h2 class="dv-card__title">
          {{ 'DOC_FORM.ATTACHMENTS' | translate }}
          @if (list().length) { <span class="dv-card__count">{{ list().length }}</span> }
        </h2>
        <svg class="dv-card__chev" [class.dv-card__chev--open]="!collapsed()" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      @if (!collapsed()) {
        <div class="dv-card__body">
          <app-doc-attachments [attachments]="list()" (added)="onAdded($event)" (removed)="onRemoved($event)"/>
        </div>
      }
    </div>
  `,
})
export class DocViewAttachmentsComponent {
  private media = inject(MediaService);
  private toast = inject(ToastService);

  /** Media type of the document (`invoice`, `creditNote`, …). */
  type = input.required<string>();
  docId = input.required<string>();
  attachments = input<DocAttachment[]>([]);

  collapsed = signal(true);
  /** Follows the document's list whenever it reloads; optimistic edits live here until then. */
  list = linkedSignal<DocAttachment[]>(() => this.attachments() ?? []);

  private queue: Promise<void> = Promise.resolve();

  onAdded(list: DocAttachment[]): void { this.queue = this.queue.then(() => this.persistAdd(list)); }
  onRemoved(a: DocAttachment): void { this.queue = this.queue.then(() => this.persistRemove(a)); }

  private async persistAdd(list: DocAttachment[]): Promise<void> {
    const previous = this.list();
    this.list.set(list);
    try {
      const ok = await this.media.appendAttachment({ type: this.type(), id: this.docId(), attachment: list.map(a => ({ id: a.id })) } as any);
      if (!ok) throw new Error();
    } catch {
      this.list.set(previous);
      this.toast.error('COMMON.SAVE_FAILED');
    }
  }

  private async persistRemove(a: DocAttachment): Promise<void> {
    const previous = this.list();
    this.list.set(previous.filter(x => x.id !== a.id));
    try {
      const ok = await this.media.deleteAttachment({ type: this.type(), id: this.docId(), mediaId: a.id } as any);
      if (!ok) throw new Error();
    } catch {
      this.list.set(previous);
      this.toast.error('COMMON.DELETE_FAILED');
    }
  }
}
