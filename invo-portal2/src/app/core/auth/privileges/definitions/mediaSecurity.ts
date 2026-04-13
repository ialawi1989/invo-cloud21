import { PrivilegeSetting } from "../models/privilege-setting.model";

export function mediaSecurity() {
  return new PrivilegeSetting({
    name: "Media Security",
    securityType: "cloud",
    securityGroup: "general",
    actions: {
      "add": new PrivilegeSetting({
        name: "Add New Media",
        securityType: "cloud",
      }),
      "edit": new PrivilegeSetting({
        name: "Edit New Media",
        securityType: "cloud",
      }),
      "view": new PrivilegeSetting({
        name: "View Media",
        securityType: "cloud",
      }),
      "delete": new PrivilegeSetting({
        name: "Delete Media",
        securityType: "cloud",
      }),
      "dettach": new PrivilegeSetting({
        name: "Dettach Media",
        securityType: "cloud",
      }),
    }
  });
}
