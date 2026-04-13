
export class ButtonLink {

  title: string = "";
  abbr: string = "";
  translation: any = {
    en: {
      title: ''
    },
    ar: {
      title: ''
    }
  };

  constructor() {

  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }


}