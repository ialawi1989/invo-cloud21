import { Option } from "./option.model";

export class OptionGroup {
  index: number = 0;
  title: string = "";
  alias: string = "";
  isSelected: boolean = false;
  translation: {
    name: { [key: string]: string };
    alias: { [key: string]: string };
    title: { [key: string]: string };
    description: { [key: string]: string };
    displayName: { [key: string]: string };
  } = {
    name: {},
    alias: {},
    title: {},
    description: {},
    displayName: {}
  };
  optionGroupId: string = "";
  minSelectable: number = 0;
  maxSelectable: number = 0;
  options: Option[] = [];

  constructor(initialData?: Partial<OptionGroup>) {
    if (initialData) Object.assign(this, initialData);
  }

  ParseJson(json: any): void {
    if (!json) return;

    this.index = Number(json.index ?? 0)
    this.title = json.title?.toString() ?? "";
    this.alias = json.alias?.toString() ?? "";
    this.isSelected = Boolean(json.isSelected ?? false);
    this.translation = {
      name: json.translation?.name ?? {},
      alias: json.translation?.alias ?? {},
      title: json.translation?.title ?? {},
      description: json.translation?.description ?? {},
      displayName: json.translation?.displayName ?? {},
    };
    this.optionGroupId = json.optionGroupId?.toString() ?? "";
    this.minSelectable = Number(json.minSelectable ?? 0);
    this.maxSelectable = Number(json.maxSelectable ?? 0);
    this.options = Array.isArray(json.options)
      ? json.options.map((o: any) => {
          const option = new Option();
          option.ParseJson(o);
          return option;
        })
      : [];
  }
}
