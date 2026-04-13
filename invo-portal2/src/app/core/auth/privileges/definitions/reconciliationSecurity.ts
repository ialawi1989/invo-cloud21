import { PrivilegeSetting } from "../models/privilege-setting.model";

export function reconciliationSecurity() {
  return new PrivilegeSetting({
    name: "Reconciliation Security",
    securityType: "cloud",
    securityGroup: "account",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Reconciliation Security",
        securityType: "cloud",
      }),
    }
  });
}
