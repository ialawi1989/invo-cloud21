import { PrivilegeSetting } from "../models/privilege-setting.model";

export function brandSecurity() {
  return new PrivilegeSetting({
    name: "Brand Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add/Edit New Brand",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Brand",
        securityType: "cloud",
      }),

     }
  });
}
