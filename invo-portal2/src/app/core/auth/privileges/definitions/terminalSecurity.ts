import { PrivilegeSetting } from "../models/privilege-setting.model";

export function terminalSecurity() {
  return new PrivilegeSetting({
    name: "Terminal Security",
    securityType: "POS",
    securityGroup: "settings",
    actions: {
      "terminalSettings": new PrivilegeSetting({
        name: "Access Terminal Settings",
        securityType: "POS",
      }),
      "minimize": new PrivilegeSetting({
        name: "minimize",
        securityType: "POS",
      }),
      "changeConnection": new PrivilegeSetting({
        name: "Change Connection",
        securityType: "POS",
      }),
    }
  });
}