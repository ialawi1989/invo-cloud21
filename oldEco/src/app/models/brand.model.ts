export class Brand {
  id: string = "";
  name: string = "";
  count: number = 0;
  translation:any = {};

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof this] = json[key] ?? this[key as keyof this];
      }
    }
  }
}
