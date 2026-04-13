import { PrivilegeSetting } from "../models/privilege-setting.model";

export function openingBalances() {
  return new PrivilegeSetting({
    name: "Opening Balances Security",
    securityType: "cloud",
    securityGroup: "account",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Opening Balances",
        securityType: "cloud",
      }),
      "importExport": new PrivilegeSetting({
        name: "Import/Export Inventory Assets",
        securityType: "cloud",
      })
    }
  });
}
