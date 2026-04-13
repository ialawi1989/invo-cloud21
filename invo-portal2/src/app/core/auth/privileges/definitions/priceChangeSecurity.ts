import { PrivilegeSetting } from "../models/privilege-setting.model";

export function priceChangeSecurity() {
  return new PrivilegeSetting({
    name: "Price Change Security",
    securityType: "cloud",
    securityGroup: "products",
    actions: {
      // add "": new PrivilegeSetting({
      //     name: "Add New Price Change",
      //     access: true,
      //     showInSearch: null,
      // showCategory: true,
      //     securityType: "cloud",
      //     securityFiltered: null
      // },
      "view": new PrivilegeSetting({
        name: "View Price Change",
        securityType: "cloud",
      })
    }
  });
}
