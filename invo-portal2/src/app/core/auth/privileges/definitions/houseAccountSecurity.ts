import { PrivilegeSetting } from "../models/privilege-setting.model";

export function houseAccountSecurity() {
  return new PrivilegeSetting({
    name: "House Account Security",
    securityType: "POS",
    securityGroup: "settings",
    actions: {
      "houseAccount": new PrivilegeSetting({
        name: "Access House Account",
        securityType: "POS",
      }),
      "moveToHouseAccount": new PrivilegeSetting({
        name: "Move to House Account",
        securityType: "POS",
      }),
      "payHouseAccount": new PrivilegeSetting({
        name: "Pay House Account",
        securityType: "POS",
      }),
      "editHouseAccountInvoice": new PrivilegeSetting({
        name: "Edit House Account Invoice",
        securityType: "POS",
      }),
    }
  });
}
