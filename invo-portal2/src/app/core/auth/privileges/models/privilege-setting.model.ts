export class PrivilegeSetting {
  name: string = '';
  access: boolean | null = null;
  securityType: 'cloud' | 'POS' | 'common' = 'common';
  securityGroup?: string;
  actions: Record<string, PrivilegeSetting> | null = null;
  /**
   * UI-only (never serialized). false (default, every group — the legacy
   * Promotions behaviour): enabling a group does NOT tick its actions; they are
   * picked one by one or with the "Select All" button, and unticking the last
   * action leaves the enable switch as the user set it.
   * true: the enable switch also ticks every action and unticking the last
   * action disables the group. Opt in per group if one needs it.
   */
  selectAllChildren = false;

  constructor(config?: {
    name?: string;
    securityType?: 'cloud' | 'POS' | 'common';
    securityGroup?: string;
    actions?: Record<string, PrivilegeSetting>;
    selectAllChildren?: boolean;
  }) {
    if (config?.name)          this.name          = config.name;
    if (config?.securityType)  this.securityType  = config.securityType;
    if (config?.securityGroup) this.securityGroup = config.securityGroup;
    if (config?.actions)       this.actions       = config.actions;
    if (config?.selectAllChildren !== undefined) this.selectAllChildren = config.selectAllChildren;
  }

  ToJson(): any {
    const result: any = {
      name:         this.name,
      access:       this.access,
      securityType: this.securityType,
    };
    if (this.securityGroup) result.securityGroup = this.securityGroup;
    if (this.actions) {
      result.actions = {};
      for (const key in this.actions) {
        result.actions[key] = this.actions[key].ToJson();
      }
    }
    return result;
  }
}
