import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Campaigns (promotions module). Group + action keys are the legacy persisted
 * ones so saved role data keeps working; every switch defaults to OFF.
 *
 * Legacy quirks kept on purpose (they are what roles were saved against):
 *  - "Stop now" and "Extend" share ONE switch, `ExtendCampaigns`.
 *  - "Clone" is stored under `SpendCampaigns`.
 *  - "Edit" is stored under `EditRate`.
 */
const ACTIONS: { key: string; name: string }[] = [
  { key: "EditRate",           name: "Edit Campaigns" },
  { key: "AddCampaigns",       name: "Add Campaigns" },
  { key: "StartNowCampaigns",  name: "StartNow Campaigns" },
  { key: "ExtendCampaigns",    name: "Extend / Stop Campaigns" },
  { key: "SpendCampaigns",     name: "Clone Campaigns" },
];

export function campaignsPrivileges() {
  const actions: Record<string, PrivilegeSetting> = {};
  for (const a of ACTIONS) {
    const s = new PrivilegeSetting({ name: a.name, securityType: "cloud" });
    s.access = false;
    actions[a.key] = s;
  }
  const group = new PrivilegeSetting({
    name: "Campaigns",
    securityType: "cloud",
    securityGroup: "promotions",
    actions,
  });
  group.access = false;
  return group;
}
