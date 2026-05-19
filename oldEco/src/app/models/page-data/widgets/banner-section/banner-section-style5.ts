
export class BannerSectionStyle5 {

  text1 :string = "";
  text1Color: string = "#fff";
  text2: string = "";
  text2Color: string = "#fff";
  text3 :string = "";
  text3Color: string = "#fff";
  text4: string = "";
  text4Color: string = "gold";

  button1Text : string = "";
  button1Color: string = "gold";
  button1TextColor: string = "gold";
  button1Url: string = "";
  button1Link:any = {};

  button2Text : string = "";
  button2Color: string = "gold";
  button2TextColor: string = "#fff";
  button2Url: string = "";
  button2Link:any = {};

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