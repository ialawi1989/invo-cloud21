import { PrivilegeSetting } from './privilege-setting.model';
import { SECURITY_DEFINITIONS } from '../definitions/registry';

/**
 * The full permission tree — one {@link PrivilegeSetting} per security group.
 *
 * The groups are built from the central {@link SECURITY_DEFINITIONS} registry
 * (see that file), so adding a new feature's permissions is a one-line change
 * there — there is no per-group field to declare here and keep in sync.
 *
 * The wire/saved shape is unchanged: `{ <groupKey>: { name, access,
 * securityType, actions?: { <actionKey>: { name, access } } } }`. `ToJson()`
 * / `ParseJson()` produce and consume exactly that structure.
 */
export class Privilege {
  [key: string]: PrivilegeSetting | any;

  constructor() {
    const defs = SECURITY_DEFINITIONS as Record<string, () => PrivilegeSetting>;
    for (const key in defs) {
      this[key] = defs[key]();
    }
  }

  ToJson(): any {
    const result: any = {};
    for (const key in this) {
      if (typeof this[key] === 'function') continue;
      result[key] = (this[key] as PrivilegeSetting).ToJson();
    }
    return result;
  }

  ParseJson(json: any): void {
    for (const key in this) {
      if (typeof this[key] === 'function') continue;
      if (json[key] == null) continue;

      const x = this[key] as PrivilegeSetting;
      x.name   = json[key].name   ?? x.name;
      x.access = json[key].access ?? null;

      if (json[key].actions && x.actions) {
        for (const [k, v] of Object.entries(json[key].actions as any)) {
          if (x.actions[k]) {
            x.actions[k].access = (v as any).access ?? null;
            x.actions[k].name   = (v as any).name   ?? x.actions[k].name;
          }
        }
      }
    }
  }
}

// ─── Employee Privilege (the stored record) ───────────────────────────────────

export class EmployeePrivilege {
  id: string | null = null;
  name              = '';
  /** Optional human description of what this role is for (preset-role
   *  templates ship one; custom sets can set their own). Round-tripped to
   *  the backend, which simply stores the extra field. */
  description       = '';
  /** Id of the saved role this set was cloned from, if any (the "start from a
   *  role" dropdown). Empty for hand-built sets. */
  presetKey         = '';
  privileges        = new Privilege();
  companyId         = '';
  updatedDate       = new Date();
  createdAt         = new Date();

  ToJson(): any {
    return {
      id:          this.id,
      name:        this.name,
      description: this.description,
      presetKey:   this.presetKey,
      privileges:  this.privileges.ToJson(),
      companyId:   this.companyId,
      updatedDate: this.updatedDate,
      createdAt:   this.createdAt,
    };
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key === 'privileges') {
        const p = new Privilege();
        p.ParseJson(json[key]);
        this.privileges = p;
      } else {
        (this as any)[key] = json[key];
      }
    }
  }
}
