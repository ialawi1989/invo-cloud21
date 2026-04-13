import { PrivilegeSetting } from "../models/privilege-setting.model";

export function cashierSecurity() {
  return new PrivilegeSetting({
    name: "cashier Security",
    securityType: "POS",
    securityGroup: "settings",
    actions: {
      "cashier": new PrivilegeSetting({
        name: "Cashier In/Out",
        securityType: "POS",
      }),
      "manuallyOpenCashDrawer": new PrivilegeSetting({
        name: "Manually Open Cash Drawer",
        securityType: "POS",
      })
    }
  });
}
