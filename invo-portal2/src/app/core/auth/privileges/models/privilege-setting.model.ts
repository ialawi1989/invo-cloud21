export class PrivilegeSetting {
  name: string = '';
  access: boolean | null = null;
  securityType: 'cloud' | 'POS' | 'common' = 'common';
  securityGroup?: string;
  actions: Record<string, PrivilegeSetting> | null = null;

  constructor(config?: {
    name?: string;
    securityType?: 'cloud' | 'POS' | 'common';
    securityGroup?: string;
    actions?: Record<string, PrivilegeSetting>;
  }) {
    if (config?.name)          this.name          = config.name;
    if (config?.securityType)  this.securityType  = config.securityType;
    if (config?.securityGroup) this.securityGroup = config.securityGroup;
    if (config?.actions)       this.actions       = config.actions;
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
