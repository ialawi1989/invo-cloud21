import { PrivilegeSetting } from "../models/privilege-setting.model";

export function feedbacksSecurity() {
  return new PrivilegeSetting({
    name: "Feedbacks Cloud Security",
    securityType: "cloud",
    securityGroup: "orders",
    actions: {
      "view": new PrivilegeSetting({
        name: "Feedbacks Cloud List",
        securityType: "cloud",
      })
    }
  });
}
