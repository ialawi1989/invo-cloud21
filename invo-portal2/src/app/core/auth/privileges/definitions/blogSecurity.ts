import { PrivilegeSetting } from "../models/privilege-setting.model";

/**
 * Blog privileges.
 *
 * Maps the five seeded `Privileges` rows (`blog.view`, `blog.manage_posts`,
 * `blog.manage_categories`, `blog.moderate_comments`, `blog.manage_settings`)
 * onto the camelCase action keys the rest of this app uses for privilege
 * checks. The backend's `employee/getPrivilegesFile` payload must return the
 * tree shape — `blogSecurity.actions.view.access`, etc. — for
 * `PrivilegeService.check()` to pick them up.
 */
export function blogSecurity() {
  return new PrivilegeSetting({
    name: "Blog Security",
    securityType: "cloud",
    securityGroup: "website",
    actions: {
      "view": new PrivilegeSetting({
        name: "View Blog",
        securityType: "cloud",
      }),
      "managePosts": new PrivilegeSetting({
        name: "Manage Blog Posts",
        securityType: "cloud",
      }),
      "manageCategories": new PrivilegeSetting({
        name: "Manage Blog Categories",
        securityType: "cloud",
      }),
      "moderateComments": new PrivilegeSetting({
        name: "Moderate Blog Comments",
        securityType: "cloud",
      }),
      "manageSettings": new PrivilegeSetting({
        name: "Manage Blog Settings",
        securityType: "cloud",
      }),
    }
  });
}
