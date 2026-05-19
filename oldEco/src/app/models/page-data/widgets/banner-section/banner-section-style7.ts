
export class BannerSectionStyle7 {

  text1: string = "";
  text1Color: string = "#ffffff";
  text2: string = "";
  text2Color: string = "#ffffff";
  text3: string = "";
  text3Color: string = "#eeeeee";
  buttonText : string = "";
  buttonColor: string = "#fff";
  buttonTextColor: string = "#fff";
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