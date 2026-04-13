import { PrivilegeSetting } from "../models/privilege-setting.model";

export function menuBuilderSecurity() {
  return new PrivilegeSetting({
    name: "Menu Builder Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "add": new PrivilegeSetting({
        name: "add/edit Menu",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Menu",
        securityType: "cloud",
      })
     }
  });
}
