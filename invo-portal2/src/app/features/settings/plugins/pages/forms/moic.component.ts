import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { DatePickerComponent } from '@shared/components/datepicker';
import { BranchSettingsService } from '../../../services/branch-settings.service';
import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { PluginFormBase } from './plugin-form.base';
import { BranchPlugin } from '../../services/plugin.types';

/**
 * MOIC (Ministry of Industry & Commerce) invoice sync.
 *
 * Global credentials, or per-branch overrides when "Configure per
 * branch" is on. Supports a manual sync for a chosen date (global or
 * per branch) and shows the upload history log.
 */
@Component({
  selector: 'app-plugin-moic',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PluginFormShellComponent, SearchDropdownComponent, DatePickerComponent],
  styleUrls: ['./plugin-fields.scss'],
  templateUrl: './moic.component.html',
})
export class MoicComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'MOIC';
  protected titleKey = 'PLUGINS.MOIC.TITLE';

  branchLabel = (b: { id: string; name: string }) => b.name;
  /** The dropdown holds/emits the full item, so compare + resolve by id. */
  branchEquals = (a: { id: string } | null, b: { id: string } | null) => (a?.id ?? null) === (b?.id ?? null);
  branchById = (id: string): { id: string; name: string } | null =>
    this.branches().find(b => b.id === id) ?? null;

  private branchService = inject(BranchSettingsService);
  private toastSvc = inject(ToastService);

  branches = signal<{ id: string; name: string }[]>([]);
  activeBranchId = signal<string>('');
  syncDate = signal<Date | null>(new Date());
  syncing = signal(false);

  async ngOnInit(): Promise<void> {
    await this.init();
    // Clear masked secrets (global + per branch).
    this.plugin.settings.moic_password = '';
    for (const b of this.plugin.settings.branches ?? []) b.moic_password = '';

    const res = await this.branchService.getList({ limit: 200 });
    this.branches.set(res.list.map(b => ({ id: b.id, name: b.name })));
    this.ensureBranchRows();
    if (this.branches().length) this.activeBranchId.set(this.branches()[0].id);
  }

  get syncByBranch(): boolean { return !!this.plugin.settings.syncByBranch; }
  set syncByBranch(v: boolean) {
    this.plugin.settings.syncByBranch = v;
    if (v) this.ensureBranchRows();
    this.markDirty();
  }

  /** The branch-override row for the active branch (created on demand). */
  get activeBranch(): BranchPlugin | null {
    const id = this.activeBranchId();
    if (!id) return null;
    return (this.plugin.settings.branches ?? []).find(b => b.branchId === id) ?? null;
  }

  private ensureBranchRows(): void {
    const rows = this.plugin.settings.branches ?? [];
    for (const b of this.branches()) {
      if (!rows.find(r => r.branchId === b.id)) {
        rows.push({ branchId: b.id, branchName: b.name, enable: true });
      }
    }
    this.plugin.settings.branches = rows;
  }

  async runSync(branchId: string): Promise<void> {
    this.syncing.set(true);
    try {
      const res: any = await this.service.syncMOICManualUpload({
        date: this.formatYMD(this.syncDate()),
        ...(branchId ? { branchId } : {}),
      });
      if (res?.success) this.toastSvc.success('PLUGINS.MOIC.SYNCED');
      else this.toastSvc.error(res?.msg || res?.message || 'PLUGINS.COMMON.SAVE_FAILED');
    } finally {
      this.syncing.set(false);
    }
  }

  formatLogDate(d: string): string {
    // Legacy stored 'yyyyMMdd'.
    if (!d) return '';
    const s = String(d);
    if (/^\d{8}$/.test(s)) return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
    return s;
  }

  save(): void {
    this.submitted.set(true);
    // Strip blank secrets so the stored value is preserved.
    if (!this.shouldSendSecret('moic_password') || !(this.plugin.settings.moic_password ?? '').trim()) {
      delete (this.plugin.settings as any).moic_password;
    }
    for (const b of this.plugin.settings.branches ?? []) {
      if (!(b.moic_password ?? '').trim()) delete (b as any).moic_password;
    }
    void this.persist({ ...this.basePayload(), settings: this.plugin.settings, logs: this.plugin.logs });
  }

  /** Format a Date as `yyyy-MM-dd` for the sync API (legacy contract). */
  private formatYMD(d: Date | null): string {
    if (!d) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
}
