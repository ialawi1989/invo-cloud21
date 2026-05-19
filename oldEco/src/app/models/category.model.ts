export class SubCategory {
  id: string = "";
  name: string = "";
  mediaUrl: string = "";
  translation: any = {};
  isColorLoaded: boolean = false;
  backgroundColor: string = "#8c8c8d"; // Added for dynamic color extraction

  constructor(initialData?: Partial<SubCategory>) {
    if (initialData) {
      Object.assign(this, initialData);
    }
  }

  ParseJson(json: any): void {
    if (!json) return;
    this.id = json.id?.toString() ?? "";
    this.name = json.name?.toString() ?? "";
    this.translation = json.translation ?? {};
    this.mediaUrl = json.mediaUrl?.toString() ?? "";
  }
}

export class Category {
  id: string = "";
  name: string = "";
  categories: SubCategory[] = [];
  translation: any = {};
  
  // UI-specific field (not from backend)
  isOpen: boolean = false;

  constructor(initialData?: Partial<Category>) {
    if (initialData) {
      Object.assign(this, initialData);
    }
  }

  ParseJson(json: any): void {
    if (!json) return;
    this.id = json.id?.toString() ?? "";
    this.name = json.name?.toString() ?? "";
    this.translation = json.translation ?? {}
    this.categories = (json.categories || []).map((cat: any) => {
      const sub = new SubCategory();
      sub.ParseJson(cat);
      return sub;
    });
  }
}
