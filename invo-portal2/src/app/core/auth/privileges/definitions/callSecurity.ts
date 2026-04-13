import { PrivilegeSetting } from "../models/privilege-setting.model";

export function callSecurity() {
  return new PrivilegeSetting({
    name: "Call Security",
    securityType: "POS",
    securityGroup: "settings",
    actions: {
      "callHistory": new PrivilegeSetting({
        name: "View Call History",
        securityType: "POS",
      }),
      "pickupCall": new PrivilegeSetting({
        name: "Pickup Call",
        securityType: "POS",
      }),
      "deliveryCall": new PrivilegeSetting({
        name: "Delivery Call",
        securityType: "POS",
      })
    }
  });
}
