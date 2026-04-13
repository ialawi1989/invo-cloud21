import { PrivilegeSetting } from "../models/privilege-setting.model";

export function estimateSecurity() {
  return new PrivilegeSetting({
    name: "Estimate Security",
    securityType: "cloud",
    securityGroup: "sales",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Estimate",
        securityType: "cloud",
      }),
      "print": new PrivilegeSetting({
        name: "Print Estimates",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Estimates",
        securityType: "cloud",
      }),
      "convert": new PrivilegeSetting({
        name: "Convert Estimates to Invoice",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Estimate",
        securityType: "cloud",
      }),
      "viewJournals": new PrivilegeSetting({
        name: "View Journals",
        securityType: "cloud",
      }),
    }
  });
}
