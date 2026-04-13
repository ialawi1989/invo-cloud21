import { PrivilegeSetting } from "../models/privilege-setting.model";

export function DomainSettingsSecurity() {
  return new PrivilegeSetting({
    name: "Domain Settings Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "view": new PrivilegeSetting({
        name: "DomainSettings",
        securityType: "cloud",
      })
    }
  });
}
