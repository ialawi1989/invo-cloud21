import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Storefront privilege groups (legacy `storefront*Security`, group "storefront" in the privileges form).
 * Twelve groups, each with the same two actions: `view` and `edit`. Kept under the legacy keys so the
 * privileges already stored for employees round-trip through this app's privileges form unchanged.
 */
function storefrontGroup(title: string) {
  return () =>
    new PrivilegeSetting({
      name: `Storefront ${title}`,
      securityType: "cloud",
      securityGroup: "storefront",
      actions: {
        "view": new PrivilegeSetting({ name: `View ${title}`, securityType: "cloud" }),
        "edit": new PrivilegeSetting({ name: `Edit ${title}`, securityType: "cloud" }),
      },
    });
}

export const storefrontAnalyticsSecurity   = storefrontGroup("Analytics");
export const storefrontPagesSecurity       = storefrontGroup("Pages");
export const storefrontBlogsSecurity       = storefrontGroup("Blogs");
export const storefrontMenusSecurity       = storefrontGroup("Menus");
export const storefrontMessagesSecurity    = storefrontGroup("Messages");
export const storefrontReviewsSecurity     = storefrontGroup("Reviews");
export const storefrontThemesSecurity      = storefrontGroup("Themes");
export const storefrontMarketingSecurity   = storefrontGroup("Marketing");
export const storefrontPreferencesSecurity = storefrontGroup("Preferences");
export const storefrontCheckoutSecurity    = storefrontGroup("Checkout");
export const storefrontDomainsSecurity     = storefrontGroup("Domains");
export const storefrontSitesSecurity       = storefrontGroup("Sites");
