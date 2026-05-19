
export class BannerSectionStyle4 {

  text1 :string = "";
  text1Color: string = "#fff";
  text2: string = "";
  text2Color: string = "#fff";
  text3 :string = "";
  text3Color: string = "#fff";
  text4 :string = "";
  text4Color: string = "red";
  text5 :string = "";
  text5Color: string = "#fff";
  translation:any = {};
  
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