import '../../account-i18n';
import { Component, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { SearchDropdownComponent } from '@shared/components/dropdown';

export interface TagOption { label: string; value: string; }
export interface ItemFilterData {
  tags: (p: { page: number; pageSize: number; search: string }) => Promise<{ items: TagOption[]; hasMore: boolean }>;
  selected: string[];
}

/** Item filter of the document line picker (legacy "filter product list"): narrow the items offered by tag. */
@Component({
  selector: 'app-doc-item-filter-modal',
  standalone: true,
  imports: [TranslateModule, ModalHeaderComponent, ModalFooterComponent, SearchDropdownComponent],
  template: `
    <app-modal-header [title]="'DOC_LINES.FILTER_ITEMS' | translate"/>
    <div class="fi">
      <label class="fi__label">{{ 'DOC_LINES.TAGS' | translate }}</label>
      <app-search-dropdown
        [loadFn]="data.tags" [pageSize]="20" [multiple]="true" [displayWith]="label" [compareWith]="same"
        [value]="picked()" (valueChange)="picked.set($any($event) ?? [])" [clearable]="true"
        [placeholder]="'DOC_LINES.SELECT_TAGS' | translate"/>
    </div>
    <app-modal-footer>
      <button type="button" class="fi__btn fi__btn--primary" (click)="apply()">{{ 'DOC_LINES.APPLY' | translate }}</button>
      <button type="button" class="fi__btn" (click)="ref.close([])">{{ 'DOC_LINES.CLEAR' | translate }}</button>
      <button type="button" class="fi__btn" (click)="ref.close(null)">{{ 'COMMON.CANCEL' | translate }}</button>
    </app-modal-footer>
  `,
  styles: [`
    .fi { padding: 16px 20px; min-width: min(460px, 90vw); min-height: 120px; display: flex; flex-direction: column; gap: 8px; }
    .fi__label { font-size: 13px; font-weight: 600; color: #334155; }
    .fi__btn { padding: 9px 16px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .fi__btn--primary { border-color: #2691a4; background: #2691a4; color: #fff; }
  `],
})
export class DocItemFilterModalComponent {
  data = inject<ItemFilterData>(MODAL_DATA);
  ref = inject<ModalRef<string[] | null>>(MODAL_REF);

  picked = signal<TagOption[]>(this.data.selected.map(v => ({ label: v, value: v })));
  label = (t: TagOption) => t?.label ?? '';
  same = (a: TagOption, b: TagOption) => a?.value === b?.value;
  apply(): void { this.ref.close(this.picked().map(t => t.value)); }
}
