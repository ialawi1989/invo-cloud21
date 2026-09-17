import { PrivilegeSetting } from "../models/privilege-setting.model";

export function mapTrackingSecurity() {
  return new PrivilegeSetting({
    name: "Tracking Map Security",
    securityType: "cloud",
    securityGroup: "reports",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Tracking Map",
        securityType: "cloud",
      }),
    }
  });
}
