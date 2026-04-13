import { PrivilegeSetting } from "../models/privilege-setting.model";

export function dailyOpertionSecurity() {
  return new PrivilegeSetting({
    name: "Daily Opertion Security",
    securityType: "POS",
    securityGroup: "settings",
    actions: {
      "dailyOpertion": new PrivilegeSetting({
        name: "Access Daily Opertion",
        securityType: "POS",
      }),
      "dailySalesReport": new PrivilegeSetting({
        name: "View Daily Sales Reports",
        securityType: "POS",
      }),
      "cashierHistory": new PrivilegeSetting({
        name: "View Cashier History",
        securityType: "POS",
      }),
      "manageCashierOut": new PrivilegeSetting({
        name: "Manage CashierOut",
        securityType: "POS",
      })
    }
  });
}
