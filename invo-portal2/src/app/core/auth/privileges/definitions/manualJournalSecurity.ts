import { PrivilegeSetting } from "../models/privilege-setting.model";

export function manualJournalSecurity() {
  return new PrivilegeSetting({
    name: "Manual Journal Security",
    securityType: "cloud",
    securityGroup: "account",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Manual Journal",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Manual Journal",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Manual Journal",
        securityType: "cloud",
      })
    }
  });
}
