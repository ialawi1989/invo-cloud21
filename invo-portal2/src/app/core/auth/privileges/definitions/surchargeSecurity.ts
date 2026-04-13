import { PrivilegeSetting } from "../models/privilege-setting.model";

export function surchargeSecurity() {
  return new PrivilegeSetting({
    name: "Surcharge Settings Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "add/edit Surcharge",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Surcharge",
        securityType: "cloud",
      })
    }
  });
}
