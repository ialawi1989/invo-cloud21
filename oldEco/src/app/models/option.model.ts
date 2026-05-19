export class Option {
  optionName: string = "";
  translation: {
    name: { [key: string]: string };
    displayName: { [key: string]: string };
    description: { [key: string]: string };
  } = {
    name: {},
    displayName: {},
    description: {}
  };
  optionId: string = "";
  optionPrice: number = 0;
  isSelected: boolean = false;
  index: number = 0;
  mediaUrl: string ='';

  constructor(initialData?: Partial<Option>) {
    if (initialData) Object.assign(this, initialData);
  }

  ParseJson(json: any): void {
    if (!json) return;

    this.optionName = json.optionName?.toString() ?? "";
    this.translation = {
      name: json.translation?.name ?? {},
      displayName: json.translation?.displayName ?? {},
      description: json.translation?.description ?? {},
    };
    this.optionId = json.optionId?.toString() ?? "";
    this.optionPrice = Number(json.optionPrice ?? 0);
    this.isSelected = Boolean(json.isSelected ?? false);
    this.index = Number(json.index ?? 0);
    this.mediaUrl = json.mediaUrl ?? '';
  }
}
