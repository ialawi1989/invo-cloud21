import { Injectable, inject } from '@angular/core';
import { PrivilegeService } from '../../../core/auth/privileges/privilege.service';
import { FeatureService } from '../../../core/auth/feature.service';
import { ModalService } from '../../../shared/modal/modal.service';
import { SETTINGS_GROUPS, SettingGroup, SettingItem } from '../settings.catalog';

/**
 * Which Settings tiles the current user may see, and how a popup tile opens. One implementation
 * shared by the Settings landing page and the settings menu, so the two can never disagree.
 */
@Injectable({ providedIn: 'root' })
export class SettingsAccessService {
  private readonly privileges = inject(PrivilegeService);
  private readonly features   = inject(FeatureService);
  private readonly modal      = inject(ModalService);

  canAccess(item: SettingItem): boolean {
    if (item.feature && !this.features.isEnabled(item.feature)) return false;
    if (!item.privilege) return true;
    if (!this.privileges.privileges) return true;
    return this.privileges.check(item.privilege);
  }

  accessibleItems(group: SettingGroup): SettingItem[] {
    return group.items.filter(i => this.canAccess(i));
  }

  /** Groups with at least one tile the user can open (a group with none is hidden). */
  visibleGroups(): SettingGroup[] {
    return SETTINGS_GROUPS.filter(g => this.accessibleItems(g).length > 0);
  }

  /** The tile a group click lands on: the first accessible one that has a route (popup tiles are skipped). */
  firstRoutable(group: SettingGroup): SettingItem | undefined {
    return this.accessibleItems(group).find(i => !!i.link);
  }

  async openPopup(popup: { component: any; size?: string }): Promise<void> {
    const component = typeof popup.component === 'function'
      ? await popup.component()
      : popup.component;
    this.modal.open(component, { size: (popup.size as any) ?? 'md', closeOnBackdrop: true });
  }
}
