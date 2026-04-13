import { PrivilegeSetting } from "../models/privilege-setting.model";

export function deliverySecurity() {
  return new PrivilegeSetting({
    name: "Delivery Security",
    securityType: "POS",
    securityGroup: "settings",
    actions: {
      "assignDriver": new PrivilegeSetting({
        name: "Assign Driver",
        securityType: "POS",
      }),
      "driverArrival": new PrivilegeSetting({
        name: "Mark Driver as Arrive",
        securityType: "POS",
      }),
      "driverReport": new PrivilegeSetting({
        name: "View Driver Report",
        securityType: "POS",
      }),
      "driverFunctionality": new PrivilegeSetting({
        name: "Driver Functionality",
        securityType: "POS",
      }),
      "driverDispatcher": new PrivilegeSetting({
        name: "Driver Dispatcher",
        securityType: "POS",
      })
    }
  });
}
