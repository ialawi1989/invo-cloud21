
export class RichTextStyle1 {

  text1 :string = "";
  text1Color: string = "#000";
  text2: string = "";
  text2Color: string = "#000";
  text3 :string = "";
  text3Color: string = "#666";
  cardData1 = new RichTextStyle1CardData();
  cardData2 = new RichTextStyle1CardData();
  cardData3 = new RichTextStyle1CardData();
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

class RichTextStyle1CardData{
  
  text1 :string = "50+";
  text1Color: string = "#000";
  text2: string = "Business Year";
  text2Color: string = "#333";
  text3 :string = "Lorem ipsum dolor sitamet, conctetur adipisci elit. viverra erat orci.";
  text3Color: string = "#666";
  translation:any = {};

  ParseJson(json: any): void {
    for (const key in json) {
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
    }
  }
}