import { MenuSection } from "./menu-section.model";


export class Menu {
  id: string = "";
  index: number = 0;
  name: string = "";
  startAt?: Date;
  endAt?: Date;
  sections: MenuSection[] = [];

  constructor(initialData?: Partial<Menu>) {
    if (initialData) Object.assign(this, initialData);
  }

  ParseJson(json: any): void {
    if (!json) return;

    try {
      if (json.startAt && json.startAt !== "") {
        const [hours, minutes] = json.startAt.toString().split(":").map(Number);
        this.startAt = new Date();
        this.startAt.setHours(hours, minutes);
      }

      if (json.endAt && json.endAt !== "") {
        const [hours, minutes] = json.endAt.toString().split(":").map(Number);
        this.endAt = new Date();
        this.endAt.setHours(hours, minutes);
      }
    } catch (e) {
    }

    this.id = json.id?.toString() ?? "";
    this.name = json.name?.toString() ?? "";
    this.index = Number(json.index ?? 0);
    this.sections = Array.isArray(json.sections)
      ? json.sections.map((s: any) => {
          const section = new MenuSection();
          section.ParseJson(s);
          return section;
        })
      : [];
  }
}
