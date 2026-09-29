import '../../account-i18n';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ApiService } from '@core/http/api.service';
import { PrivilegeService } from '@core/auth/privileges/privilege.service';
import { SearchDropdownComponent } from '@shared/components/dropdown';
import { ModalRef } from '@shared/modal/modal.service';
import { MODAL_REF } from '@shared/modal/modal.tokens';
import { ModalHeaderComponent } from '@shared/modal/modal-header.component';

export interface SalespersonRow { id: string; name: string; email: string; }

const PAGE = 20;

/**
 * "Manage Salespersons": the employees flagged as Salesperson, with search; more load as you scroll.
 * Picking a row closes the dialog with it. Employees are flagged on their own form ("Salesperson"),
 * so "New Salesperson" opens that screen in a new tab and the open document is not lost.
 */
@Component({
  selector: 'app-manage-salespersons-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ModalHeaderComponent, SearchDropdownComponent],
  template: `
    <app-modal-header [title]="'DOC_SALES.TITLE' | translate"/>
    <div class="ms">
      <div class="ms__bar">
        <input class="ms__search" type="text" autofocus [placeholder]="'DOC_SALES.SEARCH' | translate"
          [ngModel]="term()" (ngModelChange)="onTerm($event)"/>
        <div class="ms__role">
          <app-search-dropdown [items]="roles()" [displayWith]="roleLabel" [compareWith]="sameRole" [searchable]="false"
            [value]="role()" (valueChange)="onRole($any($event))" [clearable]="true" [placeholder]="'DOC_SALES.ALL_ROLES' | translate"/>
        </div>
        <button type="button" class="ms__new" (click)="createNew()">+ {{ 'DOC_SALES.NEW' | translate }}</button>
      </div>
      <div class="ms__scroll" (scroll)="onScroll($event)">
        <table class="ms__table">
          <thead><tr><th>{{ 'DOC_SALES.NAME' | translate }}</th><th>{{ 'DOC_SALES.EMAIL' | translate }}</th></tr></thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr (click)="ref.close(r)"><td>{{ r.name }}</td><td>{{ r.email }}</td></tr>
            } @empty {
              <tr><td colspan="2" class="ms__empty">{{ (loading() ? 'DOC_LINES.LOADING' : 'DOC_SALES.EMPTY') | translate }}</td></tr>
            }
          </tbody>
        </table>
        @if (loading() && rows().length) { <div class="ms__more">{{ 'DOC_LINES.LOADING' | translate }}</div> }
      </div>
    </div>
  `,
  styles: [`
    .ms { width: 100%; box-sizing: border-box; }
    .ms__bar { display: flex; justify-content: space-between; gap: 12px; padding: 16px 20px; flex-wrap: wrap; }
    .ms__search { flex: 1 1 240px; max-width: 360px; border: 1px solid #d0d5dd; border-radius: 8px; padding: 9px 12px; font: inherit; font-size: 13.5px; }
    .ms__search:focus { outline: none; border-color: #2691a4; box-shadow: 0 0 0 3px rgba(38, 145, 164, .12); }
    .ms__role { flex: 0 1 220px; min-width: 160px; }
    .ms__new { border: 1px solid #2691a4; background: #2691a4; color: #fff; border-radius: 8px; padding: 9px 16px; font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .ms__new:hover { background: #227d8d; }
    .ms__scroll { max-height: 52vh; overflow-y: auto; border-top: 1px solid #eef2f6; }
    .ms__table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .ms__table th { position: sticky; top: 0; text-align: start; background: #f8f9fc; color: #64748b; font-size: 12px; text-transform: uppercase; padding: 10px 20px; }
    .ms__table td { padding: 12px 20px; border-top: 1px solid #f1f5f9; }
    .ms__table tbody tr { cursor: pointer; }
    .ms__table tbody tr:hover td { background: #f0fafb; }
    .ms__empty { text-align: center; color: #94a3b8; padding: 32px !important; cursor: default; }
    .ms__more { text-align: center; color: #94a3b8; padding: 10px; font-size: 12.5px; }
  `],
})
export class ManageSalespersonsModalComponent implements OnInit {
  ref = inject<ModalRef<SalespersonRow | null>>(MODAL_REF);
  private api = inject(ApiService);
  private privileges = inject(PrivilegeService);

  roles = signal<{ id: string; name: string }[]>([]);
  role = signal<{ id: string; name: string } | null>(null);
  roleLabel = (r: { name: string }) => r?.name ?? '';
  sameRole = (a: any, b: any) => a?.id === b?.id;
  onRole(r: { id: string; name: string } | null): void { this.role.set(r ?? null); void this.load(true); }

  term = signal('');
  rows = signal<SalespersonRow[]>([]);
  loading = signal(false);
  private page = 1;
  private hasMore = true;
  private timer: any;
  private seq = 0;

  async ngOnInit(): Promise<void> {
    void this.load(true);
    try {
      const res: any = await this.privileges.getPrivilegeList({ page: 1, limit: 1000, searchTerm: '', sortBy: {} });
      const list: any[] = Array.isArray(res) ? res : res?.list ?? [];
      this.roles.set(list.map(p => ({ id: p.id ?? '', name: p.name ?? '' })).filter(p => p.id));
    } catch { this.roles.set([]); }
  }

  private async load(reset: boolean): Promise<void> {
    if (this.loading() && !reset) return;
    if (reset) { this.page = 1; this.hasMore = true; }
    if (!this.hasMore) return;
    const id = ++this.seq;
    this.loading.set(true);
    try {
      const res = await this.api.request<any>(this.api.post('employee/getEmployeeList', {
        page: this.page, limit: PAGE, searchTerm: this.term(), sortBy: {}, salesPersonsOnly: true, privilegeId: this.role()?.id ?? undefined,
      }));
      if (id !== this.seq) return;
      const list: SalespersonRow[] = (res?.data?.list ?? []).map((e: any) => ({ id: e.id, name: e.name, email: e.email ?? '' }));
      this.rows.update(cur => (reset ? list : [...cur, ...list]));
      this.hasMore = this.page < (res?.data?.pageCount ?? 1);
      this.page++;
    } finally {
      if (id === this.seq) this.loading.set(false);
    }
  }

  onTerm(v: string): void {
    this.term.set(v);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.load(true), 350);
  }

  onScroll(ev: Event): void {
    const el = ev.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) void this.load(false);
  }

  createNew(): void { window.open('/employees/invitation/0', '_blank', 'noopener'); }
}
