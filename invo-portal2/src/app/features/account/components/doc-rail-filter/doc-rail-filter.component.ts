import '../../account-i18n';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { EmployeeOptionsService } from '@core/layout/services/employee-options.service';

export interface DocRailFilterOption { value: string | null; label: string; }

/**
 * The rail's status-filter dropdown (Zoho's "Unpaid Invoices ▾" picker): a search box that
 * narrows the list, and a star per row to pin favorites to the top of the list — saved server-side
 * on `EmployeeOptions.docRailFavorites` (per employee, follows them across browsers/devices), not
 * a client-only "saved view" (that would need its own backend concept we don't have).
 */
@Component({
  selector: 'app-doc-rail-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, OverlayModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="drf" #wrap>
      <button type="button" class="drf__trigger" (click)="toggle()">
        <span class="drf__label">{{ currentLabel() }}</span>
        <svg class="drf__chev" [class.drf__chev--open]="open()" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="wrap" [cdkConnectedOverlayOpen]="open()"
        [cdkConnectedOverlayPositions]="positions" (backdropClick)="open.set(false)" [cdkConnectedOverlayHasBackdrop]="true" cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop">
        <div class="drf__panel" [style.width.px]="wrap.offsetWidth < 220 ? 220 : wrap.offsetWidth">
          <div class="drf__search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" [(ngModel)]="term" [placeholder]="'COMMON.SEARCH' | translate" autofocus/>
          </div>
          <div class="drf__list">
            @for (o of visible(); track o.value) {
              <div class="drf__row" [class.is-active]="o.value === value()" (click)="pick(o)">
                <span>{{ o.label }}</span>
                <button type="button" class="drf__star" [class.is-fav]="isFav(o.value)" (click)="toggleFav($event, o.value)" [attr.aria-label]="'DOC_VIEW.FAVORITE' | translate">
                  <svg width="14" height="14" viewBox="0 0 24 24" [attr.fill]="isFav(o.value) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
              </div>
            } @empty {
              <div class="drf__empty">{{ 'DOC_VIEW.NO_RECORDS' | translate }}</div>
            }
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .drf { display: inline-block; min-width: 0; }
    .drf__trigger { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; padding: 0; cursor: pointer; font: inherit; max-width: 100%; }
    .drf__label { font-size: 14px; font-weight: 700; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .drf__chev { color: #64748b; transition: transform .15s ease; flex: 0 0 auto; }
    .drf__chev--open { transform: rotate(180deg); }
    .drf__panel { background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; box-shadow: 0 10px 30px rgba(15, 23, 42, .12); overflow: hidden; }
    .drf__search { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #eef2f6; color: #94a3b8; }
    .drf__search input { flex: 1; border: 0; outline: none; font: inherit; font-size: 13.5px; color: #0f172a; }
    .drf__list { max-height: 320px; overflow-y: auto; padding: 6px 0; }
    .drf__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 14px; font-size: 13.5px; color: #227d8d; cursor: pointer;
      &:hover { background: #f8fafc; }
      &.is-active { background: #e6f4f6; font-weight: 600; } }
    .drf__star { border: 0; background: none; padding: 2px; color: #cbd5e1; cursor: pointer; display: inline-flex;
      &:hover { color: #94a3b8; }
      &.is-fav { color: #f59e0b; } }
    .drf__empty { padding: 16px; text-align: center; color: #94a3b8; font-size: 13px; }
  `],
})
export class DocRailFilterComponent {
  private options_ = inject(EmployeeOptionsService);

  options = input.required<DocRailFilterOption[]>();
  value = input<string | null>(null);
  /** `EmployeeOptions.docRailFavorites` key the starred favorites are kept under (per entity, e.g. `'invoiceStatus'`). */
  storageKey = input<string>('docRail');

  pickValue = output<string | null>();

  open = signal(false);
  term = signal('');
  favorites = signal<Set<string>>(new Set());

  positions: import('@angular/cdk/overlay').ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  ];

  currentLabel = computed(() => this.options().find(o => o.value === this.value())?.label ?? '');
  visible = computed(() => {
    const t = this.term().trim().toLowerCase();
    const opts = this.options();
    const list = t ? opts.filter(o => o.label.toLowerCase().includes(t)) : opts;
    const fav = this.favorites();
    return [...list].sort((a, b) => Number(fav.has(b.value ?? '')) - Number(fav.has(a.value ?? '')));
  });

  constructor() {
    void this.options_.get().then(opts => {
      const list = opts?.docRailFavorites?.[this.storageKey()];
      if (list?.length) this.favorites.set(new Set(list));
    });
  }

  isFav = (value: string | null) => this.favorites().has(value ?? '');

  toggleFav(ev: Event, value: string | null): void {
    ev.stopPropagation();
    const key = value ?? '';
    const next = new Set(this.favorites());
    next.has(key) ? next.delete(key) : next.add(key);
    this.favorites.set(next);
    void this.options_.get().then(opts => this.options_.patch({
      docRailFavorites: { ...(opts?.docRailFavorites ?? {}), [this.storageKey()]: [...next] },
    }));
  }

  toggle(): void { this.open.update(v => !v); if (this.open()) this.term.set(''); }
  pick(o: DocRailFilterOption): void { this.pickValue.emit(o.value); this.open.set(false); }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.open.set(false); }
}
