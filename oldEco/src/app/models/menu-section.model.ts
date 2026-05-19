export class MenuSection {
  id: string = "";
  menuIndex: number = 0;
  name: string = "";
  translation: any = {};
  index: number = 0;

  defaultUrl : string  = ""; // get image from product

  backgroundColor?: string;
  isColorLoaded?: boolean;

  constructor(initialData?: Partial<MenuSection>) {
    if (initialData) Object.assign(this, initialData);
  }

  ParseJson(json: any): void {
    if (!json) return;

    this.id = json.id?.toString() ?? "";
    this.menuIndex = Number(json.menuIndex ?? 0);
    this.name = json.name?.toString() ?? "";
    this.translation = json.translation ?? {};
    this.index = Number(json.index ?? 0);
    this.defaultUrl = json.defaultUrl;
  }
}
