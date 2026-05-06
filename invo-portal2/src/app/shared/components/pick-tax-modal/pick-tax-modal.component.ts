import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalRef } from '@shared/modal/modal.service';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';
import { ModalFooterComponent } from '@shared/modal/modal-footer.component';
import { ApiService } from '@core/http/api.service';

@Component({
  selector: 'app-pick-tax-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ModalHeaderComponent, ModalFooterComponent],
  template: `
    <app-modal-header title="Assign Tax" />

    <div class="body">
      <!-- Search -->
      <div class="search-wrap">
        <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          class="search-input"
          type="text"
          placeholder="Search taxes"
          [(ngModel)]="searchTerm"
          (input)="onSearch()"
        />
        @if (searchTerm) {
          <button class="search-clear" type="button" (click)="clearSearch()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        }
      </div>

      <!-- List -->
      <div class="list" (scroll)="onScroll($event)">
        @if (loading()) {
          <div class="state-center"><span class="spinner"></span></div>
        } @else if (taxes().length === 0) {
          <div class="state-center">No taxes found</div>
        } @else {
          @for (tax of taxes(); track tax.id) {
            <div
              class="item"
              [class.item--selected]="selectedId() === tax.id"
              (click)="select(tax.id)"
            >
              <span class="radio" [class.radio--on]="selectedId() === tax.id">
                @if (selectedId() === tax.id) {
                  <span class="radio__dot"></span>
                }
              </span>
              <div class="item__info">
                <span class="item__name">{{ tax.name }}</span>
                @if (!tax.isGroup && tax.percentage != null) {
                  <span class="item__pct">{{ tax.percentage }}%</span>
                }
              </div>
              <div class="item__badges">
                @if (tax.isGroup) {
                  <span class="badge badge--secondary">Group</span>
                }
                @if (tax.default) {
                  <span class="badge badge--teal">Default</span>
                }
              </div>
            </div>
          }
          @if (loadingMore()) {
            <div class="state-center state-center--sm"><span class="spinner"></span></div>
          }
        }
      </div>

      <div class="footer-bar">
        @if (selectedId()) {
          <span class="selected-label">
            {{ selectedName() }}
          </span>
        } @else {
          <span class="selected-hint">Pick a tax to assign</span>
        }
      </div>
    </div>

    <app-modal-footer>
      <button class="btn-cancel" type="button" (click)="ref.close()">Cancel</button>
      <button
        class="btn-submit"
        type="button"
        (click)="submit()"
        [disabled]="!selectedId()"
      >
        Assign
      </button>
    </app-modal-footer>
  `,
  styles: [`
    .body {
      display: flex;
      flex-direction: column;
      height: 420px;
      overflow: hidden;
    }

    .search-wrap {
      position: relative;
      padding: 12px 20px 8px;
      flex-shrink: 0;
    }

    .search-icon {
      position: absolute;
      left: 32px;
      top: 50%;
      transform: translateY(-50%);
      color: #94a3b8;
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 8px 32px 8px 34px;
      font-size: 13px;
      color: #0f172a;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 120ms, box-shadow 120ms;

      &:focus {
        outline: none;
        background: #fff;
        border-color: #32acc1;
        box-shadow: 0 0 0 3px rgba(50,172,193,0.12);
      }
      &::placeholder { color: #94a3b8; }
    }

    .search-clear {
      position: absolute;
      right: 32px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      &:hover { color: #475569; }
    }

    .list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 20px;
      cursor: pointer;
      transition: background 100ms;

      &:hover { background: #f8fafc; }
      &--selected { background: #f0fafb; }
    }

    .radio {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 1.5px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      flex-shrink: 0;
      transition: border-color 120ms;

      &--on { border-color: #00a8b8; }
      &__dot { width: 9px; height: 9px; border-radius: 50%; background: #00a8b8; }
    }

    .item__info {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .item__name {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item__pct {
      font-size: 12px;
      color: #64748b;
      flex-shrink: 0;
    }

    .item__badges {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }

    .badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      text-transform: uppercase;
      white-space: nowrap;

      &--teal      { background: #ccf2f6; color: #0e7490; }
      &--secondary { background: #f1f5f9; color: #475569; }
    }

    .footer-bar {
      padding: 9px 20px;
      border-top: 1px solid #f1f5f9;
      flex-shrink: 0;
    }

    .selected-label { font-size: 12px; color: #00a8b8; font-weight: 600; }
    .selected-hint  { font-size: 12px; color: #94a3b8; }

    .state-center {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 40px 20px;
      color: #94a3b8;
      font-size: 13px;

      &--sm { padding: 14px; }
    }

    .spinner {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2.5px solid #e2e8f0;
      border-top-color: #32acc1;
      display: inline-block;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .btn-cancel {
      padding: 9px 20px;
      background: #fff;
      color: #374151;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms;
      &:hover { background: #f8fafc; }
    }

    .btn-submit {
      padding: 9px 24px;
      background: #00a8b8;
      color: #fff;
      border: none;
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 120ms;
      &:hover:not(:disabled) { background: #0097a5; }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
  `]
})
export class PickTaxModalComponent implements OnInit {
  ref         = inject<ModalRef<string>>(MODAL_REF);
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  private searchSubject = new Subject<string>();

  loading     = signal(true);
  loadingMore = signal(false);
  taxes       = signal<any[]>([]);
  selectedId  = signal<string | null>(null);

  searchTerm = '';
  private page    = 1;
  private limit   = 20;
  private hasMore = true;

  selectedName = () => this.taxes().find(t => t.id === this.selectedId())?.name ?? '';

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetAndLoad());

    this.loadTaxes();
  }

  onSearch(): void { this.searchSubject.next(this.searchTerm); }

  clearSearch(): void {
    this.searchTerm = '';
    this.resetAndLoad();
  }

  private resetAndLoad(): void {
    this.page    = 1;
    this.hasMore = true;
    this.taxes.set([]);
    this.loadTaxes();
  }

  private async loadTaxes(append = false): Promise<void> {
    if (!this.hasMore && append) return;

    if (append) this.loadingMore.set(true);
    else        this.loading.set(true);

    try {
      const body: any = { page: this.page, limit: this.limit };
      if (this.searchTerm) body.searchTerm = this.searchTerm;

      const res = await this.api.request(
        this.api.post('accounts/getTaxesList', body)
      );
      const list: any[] = res?.data?.list ?? [];
      this.hasMore = list.length >= this.limit;
      this.taxes.update(prev => append ? [...prev, ...list] : list);
    } catch {
      if (!append) this.taxes.set([]);
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
  }

  onScroll(event: Event): void {
    if (!this.hasMore || this.loadingMore() || this.loading()) return;
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      this.page++;
      this.loadTaxes(true);
    }
  }

  select(id: string): void {
    this.selectedId.set(this.selectedId() === id ? null : id);
  }

  submit(): void {
    if (this.selectedId()) this.ref.close(this.selectedId()!);
  }
}
