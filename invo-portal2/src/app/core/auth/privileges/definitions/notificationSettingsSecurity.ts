import { PrivilegeSetting } from "../models/privilege-setting.model";

export function notificationSettingsSecurity() {
  return new PrivilegeSetting({
    name: "Notification Settings Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Notification Settings",
        securityType: "cloud",
      }),
      "edit": new PrivilegeSetting({
        name: "Edit Notification Settings",
        securityType: "cloud",
      }),
    }
  });
}
