
export class BannerSectionStyle2 {

  text1: string = "";
  text1Color: string = "#ffffff";
  text2: string = "";
  text2Color: string = "#ffffff";
  text3: string = "";
  text3Color: string = "#ffffff";
  text4: string = "";
  text4Color: string = "#ffffff";
  text5: string = "";
  text5Color: string = "#ffffff";
  buttonText : string = "";
  buttonColor: string = "gold";
  buttonTextColor: string = "#000";
  buttonUrl: string = "";
  buttonLink:any = {};
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