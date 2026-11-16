import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Customer Tiers (promotions module). Group + action keys are the legacy persisted ones
 * so saved role data keeps working. Like the legacy definition every switch
 * defaults to OFF (`access: false`).
 */
const ACTIONS: { key: string; name: string }[] = [
  { key: "Edit",          name: "Edit Customer Tiers" },
  { key: "SendEmail",     name: "Send Email Customer Tiers" },
  { key: "Evaluation",    name: "Evaluation Customer Tiers" },
  { key: "EnableDisable", name: "Enable/Disable Customer Tiers" },
];

export function customerTiersPrivileges() {
  const actions: Record<string, PrivilegeSetting> = {};
  for (const a of ACTIONS) {
    const s = new PrivilegeSetting({ name: a.name, securityType: "cloud" });
    s.access = false;
    actions[a.key] = s;
  }
  const group = new PrivilegeSetting({
    name: "Customer Tiers",
    securityType: "cloud",
    securityGroup: "promotions",
    actions,
  });
  group.access = false;
  return group;
}
