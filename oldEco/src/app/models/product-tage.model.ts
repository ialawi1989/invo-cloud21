export class ProductTag {
  tags: string;
  count: string;

  constructor(tags: string = "", count: string = "") {
    this.tags = tags;
    this.count = count;
  }

  ParseJson(json: any): void {
    if (!json) return;
    this.tags = json['tags']?.toString() ?? "";
    this.count = json['count']?.toString() ?? "";
  }
}
