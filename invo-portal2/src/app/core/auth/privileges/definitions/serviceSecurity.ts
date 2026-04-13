import { PrivilegeSetting } from "../models/privilege-setting.model";

export function serviceSecurity() {
  return new PrivilegeSetting({
    name: "Service Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "add Service",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Service",
        securityType: "cloud",
      })
    }
  });
}
