import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ToastService } from '@shared/components/toast/toast.service';
import { SearchDropdownComponent } from '@shared/components/dropdown/search-dropdown.component';
import { ServiceListService, ServiceMini } from '@core/layout/services/service-list.service';
import { BranchSettingsService } from '../../../services/branch-settings.service';
import { PluginFormShellComponent } from '../../components/plugin-form-shell/plugin-form-shell.component';
import { PluginFormBase } from './plugin-form.base';
import { BranchPlugin } from '../../services/plugin.types';

/**
 * GrubTech — menu/order aggregator.
 *
 * Maps order-source channels (Talabat / Jahez / ChatFood) to internal
 * services, and per branch lets the user enter a GrubTech store + menu
 * id and push the menu (`uploadGrupTechMenu`). The API token is a
 * preserved secret.
 */
@Component({
  selector: 'app-plugin-grubtech',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    PluginFormShellComponent, SearchDropdownComponent,
  ],
  styleUrls: ['./plugin-fields.scss'],
  templateUrl: './grubtech.component.html',
})
export class GrubtechComponent extends PluginFormBase implements OnInit {
  protected pluginName = 'GrubTech';
  protected titleKey = 'PLUGINS.GRUBTECH.TITLE';

  private branchService  = inject(BranchSettingsService);
  private serviceList    = inject(ServiceListService);
  private toastSvc       = inject(ToastService);

  branches = signal<{ id: string; name: string }[]>([]);
  services = signal<ServiceMini[]>([]);
  syncing  = signal<Record<string, boolean>>({});

  serviceLabel = (s: ServiceMini) => s.name;
  /** The dropdown holds/emits the full item, so compare + resolve by id. */
  serviceEquals = (a: ServiceMini | null, b: ServiceMini | null) => (a?.id ?? null) === (b?.id ?? null);
  serviceById = (id?: string | null): ServiceMini | null =>
    this.services().find(s => s.id === id) ?? null;

  async ngOnInit(): Promise<void> {
    await this.init(['Token']);
    if (!this.plugin.settings.services) this.plugin.settings.services = {};
    const [branchRes, svc] = await Promise.all([
      this.branchService.getList({ limit: 200 }),
      this.serviceList.load(),
    ]);
    this.branches.set(branchRes.list.map(b => ({ id: b.id, name: b.name })));
    this.services.set(svc);
    this.ensureBranchRows();
  }

  private ensureBranchRows(): void {
    const rows = this.plugin.settings.branches ?? [];
    for (const b of this.branches()) {
      if (!rows.find(r => r.branchId === b.id)) {
        rows.push({ branchId: b.id, branchName: b.name, storeId: '', menuId: '', isSynced: false });
      }
    }
    this.plugin.settings.branches = rows;
  }

  branchRows(): BranchPlugin[] { return this.plugin.settings.branches ?? []; }

  async syncBranch(br: BranchPlugin): Promise<void> {
    if (!br.storeId) return;
    if (br.isSynced && !confirm(this.translate.instant('PLUGINS.GRUBTECH.CONFIRM_RESYNC'))) return;
    this.syncing.update(m => ({ ...m, [br.branchId]: true }));
    try {
      const res: any = await this.service.uploadGrubTechMenu(
        br.storeId, br.menuId, this.plugin.settings.Token, br.branchId,
      );
      if (res?.success) {
        br.isSynced = true;
        this.toastSvc.success('PLUGINS.COMMON.SAVED');
      } else {
        this.toastSvc.error(res?.msg || res?.message || 'PLUGINS.COMMON.SAVE_FAILED');
      }
    } finally {
      this.syncing.update(m => ({ ...m, [br.branchId]: false }));
    }
  }

  save(): void {
    this.submitted.set(true);
    // Drop empty-store branch rows + preserve blank token.
    const settings: any = { ...this.plugin.settings };
    settings.branches = (settings.branches ?? []).filter((b: BranchPlugin) => (b.storeId ?? '') !== '');
    if (!this.shouldSendSecret('Token') || !(settings.Token ?? '').trim()) delete settings.Token;
    void this.persist({ ...this.basePayload(), settings });
  }
}
