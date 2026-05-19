export class Item {
  index: number = 0;
  productId: string = '';
  productName: string = '';
  translation: Record<string, string> = {}; 
  mediaUrl: string = "";
  price: number = 0;
  isSelected: boolean = false;

  constructor(initialData?: Partial<Item>) {
    if (initialData) {
      Object.assign(this, initialData);
    }
  }

  ParseJson(json: any): void {
    if (!json) return;

    for (const key in json) {
      if (key in this) {
        (this as any)[key] = json[key];
      }
    }
  }
}
