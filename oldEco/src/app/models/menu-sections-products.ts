import { Product } from "./product.model";

export class MenuSectionProducts {
  menuSectionId: string;
  sectionName: string;
  products: Product[];
  translation: any = {};

  constructor(
    menuSectionId: string = "",
    sectionName: string = "",
    products: Product[] = [],
    translation: any = {}
  ) {
    this.menuSectionId = menuSectionId;
    this.sectionName = sectionName;
    this.products = products;
    this.translation = translation;
  }

  ParseJson(json: any): void {
    if (!json) return;

    this.menuSectionId = json.menuSectionId?.toString() ?? "";
    this.sectionName = json.sectionName?.toString() ?? "";
    this.translation = json.translation ?? {};
    this.products = Array.isArray(json.products)
      ? json.products.map((p: any) => {
          const product = new Product();
          product.ParseJson(p);
          return product;
        })
      : [];
  }
}
