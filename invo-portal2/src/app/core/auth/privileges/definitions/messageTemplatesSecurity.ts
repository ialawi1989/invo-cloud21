import { PrivilegeSetting } from "../models/privilege-setting.model";

export function messageTemplatesSecurity() {
  return new PrivilegeSetting({
    name: "Message Templates Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Message Templates",
        securityType: "cloud",
      }),
      "edit": new PrivilegeSetting({
        name: "Add/Edit Message Templates",
        securityType: "cloud",
      }),
    }
  });
}
