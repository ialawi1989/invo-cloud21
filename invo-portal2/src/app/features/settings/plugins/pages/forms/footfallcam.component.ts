import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ToastService } from '@shared/components/toast/toast.service';
import { DatePickerComponent } from '@shared/components/datepicker';
import { BranchSettingsService } from '../../../services/branch-settings.service';
import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { PluginFormBase } from './plugin-form.base';
import { BranchPlugin } from '../../services/plugin.types';

/**
 * FootfallCam — footfall analytics sync.
 *
 * Auth is token-based: when no valid token exists the form shows an
 * email/password login (`footFallLogin`); once a token is present it
 * shows the token expiry, per-branch site codes, and a manual sync
 * (`syncTransactions`). Save goes through `saveFootCam` (not the
 * generic savePlugin) with `{ enable, branches }`.
 */
@Component({
  selector: 'app-plugin-footfallcam',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PluginFormShellComponent, DatePickerComponent],
  styleUrls: ['./plugin-fields.scss'],
  templateUrl: './footfallcam.component.html',
})
export class FootfallcamComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'FootfallCam';
  protected titleKey = 'PLUGINS.FOOTFALL.TITLE';

  private branchService = inject(BranchSettingsService);
  private toastSvc = inject(ToastService);

  branches = signal<{ id: string; name: string }[]>([]);
  email = signal('');
  password = signal('');
  loginError = signal('');
  syncDate = signal<Date | null>(new Date());
  syncing = signal(false);

  async ngOnInit(): Promise<void> {
    // Footfall loads via a dedicated endpoint, not getById.
    this.plugin.pluginName = this.pluginName;
    this.loading.set(true);
    try {
      const res: any = await this.service.getFootFallPlugin();
      const data = res?.data ?? {};
      this.plugin.id = data.id ? String(data.id) : '';
      this.plugin.settings.tokenExpiration = data.tokenExpiration ?? null;
      this.plugin.settings.enable = !!data.enable;
      this.plugin.settings.branches = Array.isArray(data.branches) ? data.branches : [];
      const branchRes = await this.branchService.getList({ limit: 200 });
      this.branches.set(branchRes.list.map(b => ({ id: b.id, name: b.name })));
      this.ensureBranchRows();
    } finally {
      this.loading.set(false);
    }
  }

  get tokenValid(): boolean {
    const exp = this.plugin.settings.tokenExpiration;
    if (!exp) return false;
    return new Date(exp).getTime() > Date.now();
  }

  private ensureBranchRows(): void {
    const rows = this.plugin.settings.branches ?? [];
    for (const b of this.branches()) {
      if (!rows.find(r => r.branchId === b.id)) {
        rows.push({ branchId: b.id, branchName: b.name, siteCode: '', enable: true });
      }
    }
    this.plugin.settings.branches = rows;
  }

  branchRows(): BranchPlugin[] { return this.plugin.settings.branches ?? []; }

  async login(): Promise<void> {
    this.loginError.set('');
    if (!this.email().trim() || !this.password().trim()) return;
    this.loading.set(true);
    try {
      const res: any = await this.service.footFallLogin({ email: this.email().trim(), password: this.password() });
      if (res?.success || res?.data?.tokenExpiration) {
        this.plugin.settings.tokenExpiration = res?.data?.tokenExpiration ?? res?.tokenExpiration ?? null;
        this.plugin.settings.enable = res?.data?.enable ?? true;
        this.toastSvc.success('PLUGINS.COMMON.SAVED');
      } else {
        this.loginError.set(res?.msg || res?.message || 'Login failed');
      }
    } finally {
      this.loading.set(false);
    }
  }

  regenerateToken(): void {
    this.plugin.settings.tokenExpiration = null;
    this.email.set('');
    this.password.set('');
    this.markDirty();
  }

  async runSync(): Promise<void> {
    this.syncing.set(true);
    try {
      const res: any = await this.service.syncTransactions(this.formatYMD(this.syncDate()));
      if (res?.success) this.toastSvc.success('PLUGINS.FOOTFALL.SYNCED');
      else this.toastSvc.error(res?.msg || res?.message || 'PLUGINS.COMMON.SAVE_FAILED');
    } finally {
      this.syncing.set(false);
    }
  }

  save(): void {
    void this.persistFootCam();
  }

  private async persistFootCam(): Promise<void> {
    this.saving.set(true);
    try {
      const res: any = await this.service.saveFootCam({
        enable: !!this.plugin.settings.enable,
        branches: this.plugin.settings.branches ?? [],
      });
      if (res?.success) {
        this.toastSvc.success('PLUGINS.COMMON.SAVED');
        this.back();
      } else {
        this.toastSvc.error(res?.msg || res?.message || 'PLUGINS.COMMON.SAVE_FAILED');
      }
    } finally {
      this.saving.set(false);
    }
  }

  /** Format a Date as `yyyy-MM-dd` for the sync API (legacy contract). */
  private formatYMD(d: Date | null): string {
    if (!d) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
}
