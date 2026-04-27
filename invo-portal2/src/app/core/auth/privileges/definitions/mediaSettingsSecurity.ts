import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Privilege gate for the Settings → Media section. Currently covers
 * Image Display, but the same `mediaSettingsSecurity` umbrella will
 * later cover any other company-wide media-related settings (max upload
 * size, compression quality, EXIF stripping, default folder, etc.).
 */
export function mediaSettingsSecurity() {
  return new PrivilegeSetting({
    name: "Media Settings Security",
    securityType: "cloud",
    securityGroup: "settings",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Media Settings",
        securityType: "cloud",
      }),
      "edit": new PrivilegeSetting({
        name: "Edit Media Settings",
        securityType: "cloud",
      }),
    }
  });
}
