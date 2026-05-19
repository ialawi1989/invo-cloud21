
export class BannerSectionStyle1 {

  text1 :string = "";
  text1Color: string = "#fff";
  text2: string = "";
  text2Color: string = "#fff";
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