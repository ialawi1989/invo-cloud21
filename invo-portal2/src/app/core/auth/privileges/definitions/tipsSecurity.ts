import { PrivilegeSetting } from "../models/privilege-setting.model";

/** Pool tip distribution and the tip reports (names match the backend privilege). Distributions can't be edited, so there is no edit action. */
export function tipsSecurity() {
  return new PrivilegeSetting({
    name: "Tips Security",
    securityType: "cloud",
    securityGroup: "employee",
    actions: {
      "view": new PrivilegeSetting({ name: "View Tips and Tip Reports", securityType: "cloud" }),
      "add": new PrivilegeSetting({ name: "Distribute Pool Tips", securityType: "cloud" }),
      "delete": new PrivilegeSetting({ name: "Undo Tip Distributions", securityType: "cloud" }),
    }
  });
}
