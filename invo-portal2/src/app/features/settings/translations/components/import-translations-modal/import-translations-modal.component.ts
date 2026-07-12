import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';

import { ParsedImport } from '../../services/translation-csv';

export interface ImportModalData {
  entityLabel: string;
  parsed: ParsedImport;
}

/**
 * Wix-style import confirmation. Summarises what the CSV will replace,
 * lists validation warnings (unknown / blank ids) and blocks confirmation
 * on fatal errors (missing columns, empty file, nothing matched). Returns
 * `true` on confirm so the grid applies the parsed values.
 */
@Component({
  selector: 'app-import-translations-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="itm">
      <header class="itm__head">
        <h2 class="itm__title">{{ 'TRANSLATIONS.IMPORT.TITLE' | translate }}</h2>
        <p class="itm__sub">{{ 'TRANSLATIONS.IMPORT.SUBTITLE' | translate:{ entity: data.entityLabel } }}</p>
      </header>

      <div class="itm__body">
        @if (hasErrors()) {
          <div class="itm__alert itm__alert--error">
            <ul>
              @for (err of data.parsed.errors; track err) {
                <li>{{ err | translate }}</li>
              }
            </ul>
          </div>
        } @else {
          <div class="itm__stat">
            <span class="itm__stat-num">{{ data.parsed.values.length }}</span>
            <span class="itm__stat-label">{{ 'TRANSLATIONS.IMPORT.WILL_REPLACE' | translate }}</span>
          </div>

          <p class="itm__warn-note">{{ 'TRANSLATIONS.IMPORT.REPLACE_HINT' | translate }}</p>
        }

        @if (unknownIds().length) {
          <div class="itm__alert itm__alert--warn">
            <p class="itm__alert-title">
              {{ 'TRANSLATIONS.IMPORT.SKIPPED' | translate:{ count: unknownIds().length } }}
            </p>
            <ul class="itm__id-list">
              @for (id of unknownIds().slice(0, 8); track id) {
                <li>{{ id }}</li>
              }
              @if (unknownIds().length > 8) {
                <li>{{ 'TRANSLATIONS.IMPORT.AND_MORE' | translate:{ count: unknownIds().length - 8 } }}</li>
              }
            </ul>
          </div>
        }

        @if (blankIdCount()) {
          <p class="itm__warn-note">
            {{ 'TRANSLATIONS.IMPORT.BLANK_IDS' | translate:{ count: blankIdCount() } }}
          </p>
        }
      </div>

      <footer class="itm__foot">
        <button type="button" class="btn btn-default" (click)="cancel()">
          {{ 'COMMON.CANCEL' | translate }}
        </button>
        <button type="button" class="btn btn-primary" [disabled]="hasErrors()" (click)="confirm()">
          {{ 'TRANSLATIONS.IMPORT.CONFIRM' | translate }}
        </button>
      </footer>
    </div>
  `,
  styles: [`
    .itm { display: flex; flex-direction: column; }
    .itm__head { padding: 20px 24px 4px; }
    .itm__title { margin: 0 0 4px; font-size: 17px; font-weight: 700; color: #0f172a; }
    .itm__sub { margin: 0; font-size: 13px; color: #64748b; }

    .itm__body { padding: 16px 24px; display: flex; flex-direction: column; gap: 14px; }

    .itm__stat { display: flex; align-items: baseline; gap: 8px; }
    .itm__stat-num { font-size: 28px; font-weight: 800; color: #0f172a; }
    .itm__stat-label { font-size: 13px; color: #475569; }

    .itm__warn-note { margin: 0; font-size: 12px; color: #94a3b8; }

    .itm__alert { border-radius: 10px; padding: 12px 14px; font-size: 12px; }
    .itm__alert ul { margin: 0; padding-inline-start: 18px; }
    .itm__alert--error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
    .itm__alert--warn  { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
    .itm__alert-title { margin: 0 0 6px; font-weight: 700; }
    .itm__id-list { margin: 0; padding-inline-start: 18px; font-family: ui-monospace, monospace; }

    .itm__foot {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 14px 24px 20px;
      border-top: 1px solid #f1f5f9;
    }
  `],
})
export class ImportTranslationsModalComponent {
  data = inject<ImportModalData>(MODAL_DATA);
  ref = inject<ModalRef<boolean>>(MODAL_REF);

  hasErrors = computed(() => this.data.parsed.errors.length > 0);

  blankIdCount = computed(
    () => this.data.parsed.warnings.filter(w => w === 'TRANSLATIONS.IMPORT.WARN_BLANK_ID').length,
  );

  /** Warnings that are raw unknown ids (not i18n keys). */
  unknownIds = computed(
    () => this.data.parsed.warnings.filter(w => w !== 'TRANSLATIONS.IMPORT.WARN_BLANK_ID'),
  );

  confirm(): void {
    this.ref.close(true);
  }

  cancel(): void {
    this.ref.dismiss();
  }
}
