import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { RenderMode } from '../../services/document-template.types';

/**
 * ModeChooserModalComponent
 * ─────────────────────────
 * Shown the moment the user creates a NEW template — they pick
 * either Classic (structured layout) or Designer (free-form canvas).
 *
 * The choice is locked once the template is saved: the form page
 * never exposes a render-mode switcher in edit mode, because mixing
 * Classic JSON with Designer JSON in a saved template would make
 * the view/print pages flip layouts unpredictably.
 */
@Component({
  selector: 'app-mode-chooser-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header [title]="'DOCUMENT_BUILDER.MODE_CHOOSER.TITLE' | translate" />

    <div class="body">
      <p class="subtitle">{{ 'DOCUMENT_BUILDER.MODE_CHOOSER.SUBTITLE' | translate }}</p>

      <div class="tiles">
        <button
          type="button"
          class="tile"
          [class.tile--on]="selected() === 'classic'"
          (click)="selected.set('classic')"
        >
          <div class="tile__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3"  width="18" height="4" rx="1"/>
              <rect x="3" y="10" width="18" height="3" rx="1"/>
              <rect x="3" y="15" width="11" height="2" rx="1"/>
              <rect x="3" y="19" width="18" height="2" rx="1"/>
            </svg>
          </div>
          <h4 class="tile__title">{{ 'DOCUMENT_BUILDER.MODE_CHOOSER.CLASSIC_TITLE' | translate }}</h4>
          <p class="tile__desc">{{ 'DOCUMENT_BUILDER.MODE_CHOOSER.CLASSIC_DESC' | translate }}</p>
          <ul class="tile__bullets">
            <li>{{ 'DOCUMENT_BUILDER.MODE_CHOOSER.CLASSIC_B1' | translate }}</li>
            <li>{{ 'DOCUMENT_BUILDER.MODE_CHOOSER.CLASSIC_B2' | translate }}</li>
            <li>{{ 'DOCUMENT_BUILDER.MODE_CHOOSER.CLASSIC_B3' | translate }}</li>
          </ul>
        </button>

        <button
          type="button"
          class="tile"
          [class.tile--on]="selected() === 'designer'"
          (click)="selected.set('designer')"
        >
          <div class="tile__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <rect x="6" y="6" width="6"  height="4"  rx="1"/>
              <rect x="14" y="6" width="4" height="9"  rx="1"/>
              <rect x="6" y="12" width="6" height="6"  rx="1"/>
            </svg>
          </div>
          <h4 class="tile__title">{{ 'DOCUMENT_BUILDER.MODE_CHOOSER.DESIGNER_TITLE' | translate }}</h4>
          <p class="tile__desc">{{ 'DOCUMENT_BUILDER.MODE_CHOOSER.DESIGNER_DESC' | translate }}</p>
          <ul class="tile__bullets">
            <li>{{ 'DOCUMENT_BUILDER.MODE_CHOOSER.DESIGNER_B1' | translate }}</li>
            <li>{{ 'DOCUMENT_BUILDER.MODE_CHOOSER.DESIGNER_B2' | translate }}</li>
            <li>{{ 'DOCUMENT_BUILDER.MODE_CHOOSER.DESIGNER_B3' | translate }}</li>
          </ul>
        </button>
      </div>

      <div class="lock-note">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span>{{ 'DOCUMENT_BUILDER.MODE_CHOOSER.LOCK_NOTE' | translate }}</span>
      </div>
    </div>

    <app-modal-footer>
      <button class="btn-cancel" (click)="ref.dismiss()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button
        class="btn-confirm"
        [disabled]="!selected()"
        (click)="confirm()"
      >
        {{ 'DOCUMENT_BUILDER.MODE_CHOOSER.CREATE' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    :host { display: block; }

    .body { padding: 18px 22px 22px; }

    .subtitle {
      margin: 0 0 16px;
      font-size: 13px;
      line-height: 1.5;
      color: #475569;
    }

    .tiles {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .tile {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      padding: 16px;
      background: #fff;
      border: 1.5px solid #e5e7eb;
      border-radius: 10px;
      text-align: left;
      cursor: pointer;
      transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;

      &:hover { border-color: #cbd5e1; }

      &--on,
      &--on:hover {
        border-color: var(--color-brand-500);
        background: var(--color-brand-50);
        box-shadow: 0 0 0 3px rgba(50, 172, 193, 0.15);
      }
    }

    .tile__icon {
      width: 56px; height: 56px;
      display: inline-flex; align-items: center; justify-content: center;
      background: #f1f5f9;
      border-radius: 10px;
      color: var(--color-brand-700);
      margin-bottom: 4px;

      .tile--on & { background: #fff; }
    }

    .tile__title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }

    .tile__desc {
      margin: 0;
      font-size: 12px;
      color: #475569;
      line-height: 1.5;
    }

    .tile__bullets {
      margin: 6px 0 0;
      padding: 0 0 0 16px;
      font-size: 12px;
      color: #475569;
      line-height: 1.55;

      li { margin-bottom: 2px; }
    }

    .lock-note {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding: 10px 12px;
      background: #fef3c7;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      font-size: 12px;
      color: #92400e;
      line-height: 1.5;

      svg { flex-shrink: 0; }
    }

    .btn-cancel {
      padding: 9px 20px; background: #f3f4f6; border: 1px solid #e5e7eb;
      border-radius: 8px; font-size: 13px; cursor: pointer;
      &:hover { background: #e5e7eb; }
    }
    .btn-confirm {
      padding: 9px 24px; background: #32acc1; color: #fff;
      border: none; border-radius: 8px; font-size: 13px;
      font-weight: 600; cursor: pointer;
      &:hover:not(:disabled) { background: #2b95a8; }
      &:disabled { opacity: 0.55; cursor: not-allowed; }
    }
  `],
})
export class ModeChooserModalComponent {
  ref = inject<ModalRef<RenderMode>>(MODAL_REF);

  selected = signal<RenderMode | ''>('classic');

  confirm(): void {
    const mode = this.selected();
    if (mode) this.ref.close(mode);
  }
}
