import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { TrackingMapService } from '../../services/tracking-map.service';

@Component({
  selector: 'app-driver-search',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="driver-search">
      <svg class="driver-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="7"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="text"
        class="driver-search__input"
        [formControl]="searchControl"
        [placeholder]="'TRACKING_MAP.SEARCH_PLACEHOLDER' | translate"
      />
      @if (searchControl.value) {
        <button type="button" class="driver-search__clear" (click)="clear()" [attr.aria-label]="'COMMON.CLEAR' | translate">×</button>
      }
    </div>
  `,
  styles: [`
    .driver-search { position: relative; display: flex; align-items: center; }
    .driver-search__icon { position: absolute; left: 10px; color: #94a3b8; pointer-events: none; }
    .driver-search__input {
      width: 100%;
      padding: 8px 30px 8px 32px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 13px;
      background: #f8fafc;
      color: #1a1d29;
      outline: none;
      transition: border-color 120ms ease, background 120ms ease;
    }
    .driver-search__input:focus { border-color: #2691a4; background: #fff; }
    .driver-search__clear {
      position: absolute;
      right: 6px;
      width: 20px;
      height: 20px;
      border: 0;
      background: transparent;
      color: #94a3b8;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      border-radius: 4px;
    }
    .driver-search__clear:hover { background: #e2e8f0; color: #475569; }
  `],
})
export class DriverSearchComponent {
  private readonly tracking = inject(TrackingMapService);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchControl = new FormControl('', { nonNullable: true });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => this.tracking.setSearchTerm(term));
  }

  clear(): void {
    this.searchControl.setValue('');
  }
}
