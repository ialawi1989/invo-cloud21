import { PrivilegeSetting } from "../models/privilege-setting.model";

export function acceptRejectOrderCloudSecurity() {
  return new PrivilegeSetting({
    name: "Accept / Reject Order Cloud Security",
    securityType: "cloud",
    securityGroup: "orders",
    actions: {
      "view": new PrivilegeSetting({
        name: "Accept / Reject Order Cloud List",
        securityType: "cloud",
      })
    }
  });
}
