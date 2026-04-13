import { PrivilegeSetting } from "../models/privilege-setting.model";

export function kitchenSectionSecurity() {
  return new PrivilegeSetting({
    name: "Kitchen Sections Security",
    securityType: "cloud",
    securityGroup: "kitchen",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add New Kitchen Sections",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Kitchen Sections",
        securityType: "cloud",
      })
    }
  });
}
