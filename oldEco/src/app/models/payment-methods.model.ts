export class PaymentMethods {
  id: string;
  name: string;
  translation: { [key: string]: any };
  icon: string;
  isEnabled: boolean;

  constructor({
    id = "",
    name = "",
    translation = {},
    icon = "",
    isEnabled = false,
  }: {
    id?: string;
    name?: string;
    translation?: { [key: string]: any };
    icon?: string;
    isEnabled?: boolean;
  } = {}) {
    this.id = id;
    this.name = name;
    this.translation = translation;
    this.icon = icon;
    this.isEnabled = isEnabled;
  }

  ParseJson(json: any): void {
    if (!json) return;
    this.id = json['id']?.toString() ?? "";
    this.name = json['name']?.toString() ?? "";
    this.translation = json['translation'] ?? {};
    this.icon = json['icon']?.toString() ?? "";
    this.isEnabled = json['isEnabled'] ?? false;
  }
}
