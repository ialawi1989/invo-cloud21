// service.model.ts
  
export class ServiceOptions {
  lockMenu: boolean = false;
  locKChangeService: boolean = false;

  constructor(lockMenu: boolean = false, locKChangeService: boolean = false) {
    this.lockMenu = lockMenu;
    this.locKChangeService = locKChangeService;
  }

  ParseJson(json: any): void {
    if (!json) return;
    this.lockMenu = json.lockMenu ?? false;
    this.locKChangeService = json.locKChangeService ?? false;
  }
}


  export class Service {
     id: string = "";
  name: string = "";
  type: string = "";
  translation: string = "{}";
  index: number = 0;
  settings: string = "";
  priceLabelId?: string;
  chargeId?: string;
  image?: string;
  menuId?: string;
  isDeleted: boolean = false;
  invoiceCount: number = 0;
  options: ServiceOptions = new ServiceOptions();

  constructor(init?: Partial<Service>) {
    if (init) {
      Object.assign(this, init);
    }
  }

  ParseJson(json: any): void {
    if (!json) return;
    this.id = json.id ?? "";
    this.name = json.name ?? "";
    this.type = json.type ?? "";
    this.translation = json.translation ?? "{}";
    this.index = json.index ?? 0;
    this.settings = json.settings ?? "";
    this.priceLabelId = json.priceLabelId;
    this.chargeId = json.chargeId;
    this.image = json.image;
    this.menuId = json.menuId;
    this.isDeleted = json.isDeleted ?? false;
    this.invoiceCount = json.invoiceCount ?? 0;
    const opts = new ServiceOptions();
    opts.ParseJson(json.options ?? {});
    this.options = opts;
  }

    // Get the translated name based on the provided language
    getTranslatedName(lang: string): string {
      try {
        if (this.translation !== '') {
          const translationObject = JSON.parse(this.translation);
          if (translationObject['name']) {
            const nameMap = translationObject['name'];
            if (nameMap[lang]) {
              return nameMap[lang];
            }
          }
        }
        return this.name;
      } catch (e) {
        return this.name;
      }
    }
  
    // Settings related getters
    get enabled(): boolean {
      return this._getSetting('enabled') === true;
    }
  
    get enforceGuestCount(): boolean {
      return this._getSetting('enforceGuestCount') === true;
    }
  
    get onlyOneTicketPerTable(): boolean {
      return this._getSetting('onlyOneTicketPerTable') === true;
    }
  
    get showTableSelection(): boolean {
      return this._getSetting('showTableSelection') === true;
    }
  
    // Private method to get settings value
    private _getSetting(key: string): any {
      try {
        if (this.settings !== '') {
          const settingsObject = JSON.parse(this.settings);
          return settingsObject[key];
        }
      } catch (e) {
        return undefined;
      }
    }
  }
