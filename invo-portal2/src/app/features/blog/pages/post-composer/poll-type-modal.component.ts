import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';

export type PollType = 'simple' | 'image' | 'grid';

/** "Choose a Poll Type" dialog — Simple / With Image / Grid. Returns the
 *  chosen type, which the editor's `insertPoll()` turns into a poll block. */
@Component({
  selector: 'app-poll-type-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'BLOG.COMPOSER.POLL_MODAL_TITLE' | translate"
                      [subtitle]="'BLOG.COMPOSER.POLL_MODAL_SUB' | translate" />
    <div class="pm__body">
      @for (t of types; track t.id) {
        <button type="button" class="pm__tile" (click)="ref.close(t.id)">
          <span class="pm__thumb" [innerHTML]="t.thumb"></span>
          <span class="pm__name">{{ t.name | translate }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    .pm__body { padding: 18px 20px 22px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
    .pm__tile {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 16px 10px; border: 1.5px solid #e2e8f0; border-radius: 12px; background: #fff; cursor: pointer;
      transition: border-color .1s, background .1s;
    }
    .pm__tile:hover { border-color: #32acc1; background: #f0fafc; }
    .pm__thumb { display: block; width: 96px; height: 72px; }
    .pm__thumb :where(svg) { width: 100%; height: 100%; }
    .pm__name { font-size: 13px; font-weight: 600; color: #334155; }
  `],
})
export class PollTypeModalComponent {
  ref = inject<ModalRef<PollType | undefined>>(MODAL_REF);
  private san = inject(DomSanitizer);

  readonly types: { id: PollType; name: string; thumb: SafeHtml }[] = [
    { id: 'simple', name: 'BLOG.COMPOSER.POLL_SIMPLE',     thumb: this.s(this.thumbSimple()) },
    { id: 'image',  name: 'BLOG.COMPOSER.POLL_WITH_IMAGE', thumb: this.s(this.thumbImage()) },
    { id: 'grid',   name: 'BLOG.COMPOSER.POLL_GRID',       thumb: this.s(this.thumbGrid()) },
  ];

  private s(h: string): SafeHtml { return this.san.bypassSecurityTrustHtml(h); }
  private thumbSimple(): string {
    return `<svg viewBox="0 0 96 72" fill="none"><rect x="6" y="6" width="84" height="60" rx="6" fill="#f1f5f9"/><line x1="28" y1="20" x2="68" y2="20" stroke="#94a3b8" stroke-width="3"/><rect x="18" y="32" width="60" height="9" rx="3" fill="#cbd5e1"/><rect x="18" y="46" width="60" height="9" rx="3" fill="#cbd5e1"/></svg>`;
  }
  private thumbImage(): string {
    return `<svg viewBox="0 0 96 72" fill="none"><rect x="6" y="6" width="84" height="60" rx="6" fill="#f1f5f9"/><rect x="18" y="14" width="60" height="22" rx="3" fill="#cbd5e1"/><rect x="18" y="42" width="60" height="8" rx="3" fill="#cbd5e1"/><rect x="18" y="54" width="60" height="8" rx="3" fill="#cbd5e1"/></svg>`;
  }
  private thumbGrid(): string {
    return `<svg viewBox="0 0 96 72" fill="none"><rect x="6" y="6" width="84" height="60" rx="6" fill="#f1f5f9"/><rect x="18" y="16" width="26" height="40" rx="3" fill="#cbd5e1"/><rect x="52" y="16" width="26" height="40" rx="3" fill="#cbd5e1"/></svg>`;
  }
}
