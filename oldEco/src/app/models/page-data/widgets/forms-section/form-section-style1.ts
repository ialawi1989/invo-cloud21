
export class FormSectionStyle1 {

  // text1 :string = "Up To 15% Discount";
  // text1Color: string = "#fff";
  // text2: string = "For Fitness Collection";
  // text2Color: string = "#fff";
  // text3: string = "For Fitness Collection";
  // text3Color: string = "#fff";
  buttonText : string = "";
  buttonColor: string = "gold";
  buttonTextColor: string = "#000";
  buttonUrl: string = "";
  buttonLink:any = {};
  
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