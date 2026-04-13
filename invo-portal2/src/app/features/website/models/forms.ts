export interface FormElement {
  type: String;

}
export class FormsList {
  id = ""
  name = ""
  list: any[] = [];

  parseType(obj: any) {
    let parsed: any;
    switch (obj.type) {
      case "SingleLineText":
        parsed = new SingleLineTextField();
        parsed.ParseJson(obj);
        break;
      case "ParagraphText":
        parsed = new ParagraphTextField();
        parsed.ParseJson(obj);
        break;
      case "Dropdown":
        parsed = new DropdownField();
        parsed.ParseJson(obj);
        break;
      case "MultipleBox":
        parsed = new MultipleBoxField();
        parsed.ParseJson(obj);
        break;
      case "CheckBox":
        parsed = new CheckBoxField();
        parsed.ParseJson(obj);
        break;
      case "Numbers":
        parsed = new NumbersField();
        parsed.ParseJson(obj);
        break;
      case "Name":
        parsed = new NameField();
        parsed.ParseJson(obj);
        break;
      case "NumberSlider":
        parsed = new NumberSliderField();
        parsed.ParseJson(obj);
        break;
      default:
        parsed = new SingleLineTextField();
        parsed.ParseJson(obj);

    }
    return parsed;
  }

  ParseJson(json: any): void {
    let temp;
    for (const key in json) {
      if (key == "recieptTemplate") {
        this.list = [];
        temp = json[key];
        for (const propName in temp) {

          this.list.push(this.parseType(temp[propName]));
        }
      } else {
        if (key in this) {
          this[key as keyof typeof this] = json[key];
        }
      }
    }
  }
}


export class SingleLineTextField implements FormElement {
  id = "";
  type: String = "SingleLineText";
  label: String = "Text";
  abbr: String = "";
  defaultValue: String = "";
  description: String = "";
  isRequired: boolean = false;
  charLimit: any = null
  placeHolder: String = "";
  inputMask: String = "";
  hideLabel: boolean = false;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class ParagraphTextField implements FormElement {
  id = "";
  type: String = "ParagraphText";
  label: String = "Text Area";
  abbr: String = "";
  defaultValue: String = "";
  description: String = "";
  isRequired: boolean = false;
  charLimit: any = null
  placeHolder: String = "";
  hideLabel: boolean = false;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class DropdownField implements FormElement {
  id = "";
  type: String = "Dropdown";
  label: String = "Dropdown";
  abbr: String = "";
  defaultValue: String = "";
  description: String = "";
  isRequired: boolean = false;
  choices: DropdownChoices[] = []
  placeHolder: String = "";
  hideLabel: boolean = false;

  ParseJson(json: any): void {
    let _choice: DropdownChoices;
    let temp;
    for (const key in json) {
      if (key == "choices") {
        this.choices = [];
        temp = json[key];
        for (const propName in temp) {
          _choice = new DropdownChoices();
          _choice.ParseJson(temp[propName]);
          this.choices.push(_choice);
        }
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class DropdownChoices {
  index: number = 0;
  label: string = ""
  value: string = "";


  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}


export class MultipleBoxField implements FormElement {
  id = "";
  type: String = "MultipleBox";
  label: String = "MultipleBox";
  abbr: String = "";
  defaultValue: String = "";
  description: String = "";
  isRequired: boolean = false;
  choices: MultipleChoices[] = []
  choiceLayout = "oneColumn"
  hideLabel: boolean = false;
  useImage: boolean = false;
  useIcon: boolean = false;

  ParseJson(json: any): void {
    let _choice: MultipleChoices;
    let temp;
    for (const key in json) {
      if (key == "choices") {
        this.choices = [];
        temp = json[key];
        for (const propName in temp) {
          _choice = new MultipleChoices();
          _choice.ParseJson(temp[propName]);
          this.choices.push(_choice);
        }
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class CheckBoxField implements FormElement {
  id = "";
  type: String = "CheckBox";
  label: String = "CheckBox";
  abbr: String = "";
  defaultValue: String = "";
  description: String = "";
  isRequired: boolean = false;
  choices: MultipleChoices[] = []
  choiceLayout = "oneColumn"
  hideLabel: boolean = false;
  useImage: boolean = false;
  useIcon: boolean = false;

  ParseJson(json: any): void {
    let _choice: MultipleChoices;
    let temp;
    for (const key in json) {
      if (key == "choices") {
        this.choices = [];
        temp = json[key];
        for (const propName in temp) {
          _choice = new MultipleChoices();
          _choice.ParseJson(temp[propName]);
          this.choices.push(_choice);
        }
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class MultipleChoices {
  index: number = 0;
  label: string = ""
  value: string = "";
  mediaUrl: ChoiceMedia = new ChoiceMedia()
  icon = "";

  ParseJson(json: any): void {
    for (const key in json) {
      if (key == "mediaUrl") {
        const _MediaUrl = new ChoiceMedia();
        _MediaUrl.ParseJson(json[key])
        this[key] = _MediaUrl
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}


export class ChoiceMedia {
  defaultUrl: string | null = "";
  thumbnailUrl: string | null = "";

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class NumbersField implements FormElement {
  id = "";
  type: String = "Numbers";
  label: String = "Numbers";
  abbr: String = "";
  defaultValue: String = "";
  description: String = "";
  isRequired: boolean = false;
  rangeFrom: any = null
  rangeTo: any = null
  placeHolder: String = "";
  hideLabel: boolean = false;


  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class NameField implements FormElement {
  id = "";
  type: String = "Name";
  label: String = "Name";
  abbr: String = "";
  format: String = "fistLast"; // simple (name), fistLast (name1 name2),  fistMiddleLast (name1 name2 name3),
  description: String = "";
  isRequired: boolean = true;
  charLimit: any = null
  hideLabel: boolean = false;
  fields: NameFieldFormat[] = []

  ParseJson(json: any): void {
    let _field: NameFieldFormat;
    let temp;
    for (const key in json) {
      if (key == "fields") {
        this.fields = [];
        temp = json[key];
        for (const propName in temp) {
          _field = new NameFieldFormat();
          _field.ParseJson(temp[propName]);
          this.fields.push(_field);
        }
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class NameFieldFormat {
  defaultValue: String = "";
  placeHolder: String = "";

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class EmailField implements FormElement {
  id = "";
  type: String = "Email";
  label: String = "Email";
  abbr: String = "";
  defaultValue: String = "";
  description: String = "";
  isRequired: boolean = false;
  placeHolder: String = "";
  inputMask: String = "";
  hideLabel: boolean = false;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class NumberSliderField implements FormElement {
  id = "";
  type: String = "Email";
  label: String = "Email";
  abbr: String = "";
  valueDisplay: String = "Selected Value: {value}";
  description: String = "";
  hideLabel: boolean = false;

  defaultValue: number = 0;
  rangeFrom: any = 0
  rangeTo: any = 10
  increment: any = 1

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
