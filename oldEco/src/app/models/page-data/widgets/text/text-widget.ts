export class TextWidget {

  text :string = "";
  type :string = "p";
  style: TextStyle = new TextStyle();

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
class TextStyle {
  color:string = "#000";
  paddingTop:number = 0;
  paddingBottom:number = 0;
  paddingStart:number = 0;
  paddingEnd:number = 0;
  marginTop:number = 0;
  marginBottom:number = 0;
  marginStart:number = 0;
  marginEnd:number = 0;
  fontSize = 15
  align = "center"
  fontWeight = "normal"
  fontStyle = ""
  textDecoration = "none"

  ParseJson(json: any): void {
    for (const key in json) {
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
    }
  }
}
