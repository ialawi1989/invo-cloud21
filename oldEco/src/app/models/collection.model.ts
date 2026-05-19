export class Collection {
  id: string = "";
  title: string = "";
  translation: { [key: string]: any } = {};
  slug: string = "";
  style: string = "";

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        // Keep objects as-is for translation
        if (typeof this[key as keyof this] === "object" && this[key as keyof this] !== null) {
          this[key as keyof this] = { ...json[key] };
        } else {
          this[key as keyof this] = json[key] ?? "";
        }
      }
    }
  }
}
