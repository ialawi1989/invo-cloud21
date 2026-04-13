import { PrivilegeSetting } from "../models/privilege-setting.model";

export function recurringJournalSecurity() {
  return new PrivilegeSetting({
    name: "Recurring Journal Security",
    securityType: "cloud",
    securityGroup: "account",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Recurring Journal",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Recurring Journal",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Recurring Journal",
        securityType: "cloud",
      })
    }
  });
}
