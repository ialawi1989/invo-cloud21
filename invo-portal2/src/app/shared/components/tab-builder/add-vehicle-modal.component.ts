import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ModalRef } from '../../modal/modal.service';
import { MODAL_DATA, MODAL_REF } from '../../modal/modal.tokens';
import { ModalHeaderComponent } from '../../modal/modal-header.component';
import { ModalFooterComponent } from '../../modal/modal-footer.component';
import { SearchDropdownComponent } from '../dropdown/search-dropdown.component';
import { SAMPLE_MAKES, SAMPLE_MODELS, SAMPLE_YEARS, VehicleMake, VehicleModel } from './vehicle-reference';
import { VehicleConfig, VehicleFitment, generateId } from './tab-builder.types';

interface AddVehicleData {
  config: VehicleConfig;
}

@Component({
  selector: 'app-add-vehicle-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, ModalFooterComponent, SearchDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-header [title]="'TAB_BUILDER.ADD_VEHICLE' | translate"/>

    <div class="modal-body">
      <!-- Make -->
      <div class="field">
        <span class="field__label">{{ 'TAB_BUILDER.MAKE' | translate }}</span>
        <div class="grid grid--3">
          @for (m of makes; track m.id) {
            <button
              type="button"
              class="picker"
              [class.picker--selected]="make()?.id === m.id"
              (click)="selectMake(m)"
            >
              <span class="picker__logo">{{ m.logo }}</span>
              <span class="picker__label">{{ m.name }}</span>
            </button>
          }
        </div>
      </div>

      <!-- Model -->
      @if (make()) {
        <div class="field">
          <span class="field__label">{{ 'TAB_BUILDER.MODEL' | translate }}</span>
          <div class="grid grid--2">
            @for (mo of models(); track mo.id) {
              <button
                type="button"
                class="picker picker--simple"
                [class.picker--selected]="model()?.id === mo.id"
                (click)="model.set(mo)"
              >
                {{ mo.name }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Year range -->
      @if (model()) {
        <div class="field">
          <span class="field__label">
            {{ (config.allowYearRange ? 'TAB_BUILDER.YEAR_RANGE' : 'TAB_BUILDER.YEAR') | translate }}
          </span>
          <div class="years">
            <app-search-dropdown
              class="years__dd"
              [items]="years"
              [searchable]="false"
              [displayWith]="yearLabel"
              [value]="yearStartValue()"
              (valueChange)="onYearStart($any($event))"
              [placeholder]="'TAB_BUILDER.FROM' | translate"
            />
            @if (config.allowYearRange) {
              <span class="years__sep">{{ 'TAB_BUILDER.TO' | translate }}</span>
              <app-search-dropdown
                class="years__dd"
                [items]="endYears()"
                [searchable]="false"
                [displayWith]="yearLabel"
                [value]="yearEndValue()"
                (valueChange)="yearEnd.set($any($event))"
                [placeholder]="'TAB_BUILDER.TO' | translate"
              />
            }
          </div>
        </div>
      }

      <!-- Engine -->
      @if (model() && config.requireEngine) {
        <div class="field">
          <span class="field__label">{{ 'TAB_BUILDER.ENGINE_SIZE' | translate }}</span>
          <input class="input" type="text" [ngModel]="engine()" (ngModelChange)="engine.set($event)"
            [placeholder]="'TAB_BUILDER.ENGINE_PLACEHOLDER' | translate"/>
        </div>
      }
    </div>

    <app-modal-footer>
      <button type="button" class="btn btn-ghost" (click)="cancel()">
        {{ 'COMMON.CANCEL' | translate }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        [disabled]="!canAdd()"
        (click)="confirm()"
      >
        {{ 'COMMON.ADD' | translate }}
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field__label { font-size: 12px; font-weight: 600; color: #374151; }

    .grid { display: grid; gap: 8px; }
    .grid--2 { grid-template-columns: 1fr 1fr; }
    .grid--3 { grid-template-columns: 1fr 1fr 1fr; }

    .picker {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 10px 8px; border: 1px solid #e2e8f0; border-radius: 8px;
      background: #fff; cursor: pointer;
      font-size: 12px; color: #475569;
      &:hover { border-color: #cbd5e1; }
      &__logo  { font-size: 22px; line-height: 1; }
      &__label { font-size: 12px; }
      &--simple{ flex-direction: row; justify-content: center; padding: 10px; }
      &--selected { border-color: #32acc1; background: #f0fafc; color: #0f172a; }
    }

    .years { display: flex; align-items: center; gap: 8px; }
    .years__sep { font-size: 12px; color: #64748b; }
    .years__dd  { flex: 1; }

    .select, .input {
      padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px;
      font-size: 13px; outline: none; flex: 1; background: #fff;
      &:focus { border-color: #32acc1; box-shadow: 0 0 0 3px rgba(50,172,193,.15); }
    }

    .btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer;
      font-size: 14px; font-weight: 500;
    }
    .btn-ghost   { background: transparent; color: #475569; &:hover { background: #f1f5f9; } }
    .btn-primary { background: #32acc1; color: #fff;
      &:disabled { opacity: .5; cursor: not-allowed; }
      &:not(:disabled):hover { background: #2a93a6; }
    }
  `],
})
export class AddVehicleModalComponent {
  private modalRef = inject<ModalRef<VehicleFitment>>(MODAL_REF);
  private data     = inject<AddVehicleData>(MODAL_DATA);

  readonly makes = SAMPLE_MAKES;
  readonly years = SAMPLE_YEARS;
  readonly config = this.data?.config ?? { allowUniversal: true, allowYearRange: true, requireEngine: false };

  make      = signal<VehicleMake | null>(null);
  model     = signal<VehicleModel | null>(null);
  yearStart = signal<number | null>(null);
  yearEnd   = signal<number | null>(null);
  engine    = signal<string>('');

  // Dropdown bindings (null when not selected — the dropdown renders the placeholder).
  yearStartValue = computed<number | null>(() => this.yearStart());
  yearEndValue   = computed<number | null>(() => this.yearEnd());
  yearLabel      = (y: number) => String(y);

  models = computed<VehicleModel[]>(() => {
    const m = this.make();
    return m ? (SAMPLE_MODELS[m.id] ?? []) : [];
  });

  endYears = computed<number[]>(() => {
    const s = this.yearStart();
    return typeof s === 'number' ? this.years.filter(y => y >= s) : this.years;
  });

  selectMake(m: VehicleMake): void {
    this.make.set(m);
    this.model.set(null);
  }

  onYearStart(v: number | null): void {
    this.yearStart.set(v);
    const end = this.yearEnd();
    if (typeof v === 'number' && (typeof end !== 'number' || end < v)) {
      this.yearEnd.set(v);
    }
  }

  canAdd(): boolean {
    if (!this.make() || !this.model() || typeof this.yearStart() !== 'number') return false;
    if (this.config.requireEngine && !this.engine().trim()) return false;
    return true;
  }

  cancel(): void { this.modalRef.dismiss(); }

  confirm(): void {
    if (!this.canAdd()) return;
    const make = this.make()!;
    const model = this.model()!;
    const ys = this.yearStart() as number;
    const ye = this.config.allowYearRange
      ? ((this.yearEnd() as number) || ys)
      : ys;
    const fitment: VehicleFitment = {
      id: generateId('veh'),
      makeId:    make.id,
      makeName:  make.name,
      modelId:   model.id,
      modelName: model.name,
      yearStart: ys,
      yearEnd:   ye,
      engineSize: this.engine().trim() || 'All Engines',
    };
    this.modalRef.close(fitment);
  }
}
