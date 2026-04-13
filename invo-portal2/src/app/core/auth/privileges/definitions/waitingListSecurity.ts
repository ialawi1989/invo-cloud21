import { PrivilegeSetting } from "../models/privilege-setting.model";

export function waitingListSecurity() {
  return new PrivilegeSetting({
    name: "Waiting List Security",
    securityType: "POS",
    securityGroup: "general",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Waiting List",
        securityType: "POS",
      })
    }
  });
}
