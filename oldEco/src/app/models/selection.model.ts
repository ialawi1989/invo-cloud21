import { Item } from "./item.model";

export class Selection {
  index: number = 0;
  name: string = "";
  noOfSelection: number = 0;
  items: Item[] = [];

  constructor(initialData?: Partial<Selection>) {
    if (initialData) {
      Object.assign(this, initialData);
    }
  }

  ParseJson(json: any): void {
    if (!json) return;

    for (const key in json) {
      if (key === "items" && Array.isArray(json[key])) {
        this.items = json[key].map((item: any) => {
          const i = new Item();
          i.ParseJson(item);
          return i;
        });
      } else if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }
}
