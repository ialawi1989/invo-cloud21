import { PrivilegeSetting } from "../models/privilege-setting.model";

export function creditNoteSecurity() {
  return new PrivilegeSetting({
    name: "Credit Note Security",
    securityType: "cloud",
    securityGroup: "sales",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add New Credit Note",
        securityType: "cloud",
      }),
      "print": new PrivilegeSetting({
        name: "Print Credit Note",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Credit Note",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Credit Note",
        securityType: "cloud",
      }),
      "refund": new PrivilegeSetting({
        name: "Refund Credit Note",
        securityType: "cloud",
      }),
      "applyCredit": new PrivilegeSetting({
        name: "Apply Credit On Invoice",
        securityType: "cloud",
      })
    }
  });
}
