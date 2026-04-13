import { PrivilegeSetting } from "../models/privilege-setting.model";

export function customerSegmentsSecurity() {
  return new PrivilegeSetting({
    name: "Customer Segments Security",
    securityType: "cloud",
    securityGroup: "sales",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit Customer Segments",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Customer Segments",
        securityType: "cloud",
      })
    }
  });
}
