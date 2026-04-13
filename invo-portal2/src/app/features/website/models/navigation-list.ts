import { Validators } from '@angular/forms';

export class MegaMenuColumn {
  uId: string = '';
  title: string = '';
  items: NavigationListItem1[] = [];
  width?: number = 0; // percentage

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class NavigationListItemImage {
  defaultUrl: string | null = '';
  thumbnailUrl: string | null = '';

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class NavigationListItem1 {
  index: number = 0;
  uId: string = '';
  name: string = '';
  originalName: string = '';
  customUrl?: string = '';
  type: string = '';
  abbr?: string = '';
  parentId?: string = '';
  depth: number = 0;
  children?: NavigationListItem1[] = [];
  expanded?: boolean = false;
  // Mega menu properties
  isMegaMenu?: boolean = false;
  megaColumns?: MegaMenuColumn[] | any[] = [];
  megaWidth?: string = '';
  customWidth: number = 0;
  // Drag state
  isDragging?: boolean;
  dragDepth?: number;

  mediaId?: string = '';
  mediaUrl?: NavigationListItemImage = new NavigationListItemImage();

  translation?:any = {};

  static validatorsMap = {
    name: [Validators.required],
  };

  constructor() {
    this.uId = crypto.randomUUID();
  }

  ParseJson(json: any): void {
    let _menuListItem: NavigationListItem1;
    let _megaMenuColumn: MegaMenuColumn;
    let temp;
    for (const key in json) {
      if (key == 'children') {
        this.children = [];
        temp = json[key];

        for (const propName in temp) {
          _menuListItem = new NavigationListItem1();
          _menuListItem.ParseJson(temp[propName]);
          this.children.push(_menuListItem);
        }
      } else if (key == 'megaColumns') {
        this.megaColumns = [];
        temp = json[key];

        for (const propName in temp) {
          _megaMenuColumn = new MegaMenuColumn();
          _megaMenuColumn.ParseJson(temp[propName]);
          this.megaColumns.push(_megaMenuColumn);
        }
      } else if (key == 'mediaUrl') {
        const _MediaUrl = new NavigationListItemImage();
        _MediaUrl.ParseJson(json[key]);
        this[key] = _MediaUrl;
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
export class NavigationListItem {
  index: number = 0;
  name: string = '';
  originalName: string = '';
  uId: string;
  type: string = '';
  customUrl: string = '';
  abbr: string = '';
  children: NavigationListItem[] = [];
  level = 0;
  tempLevel = 0;
  parent: NavigationListItem | null = null;
  placeholder?: boolean;

  isDragging = false;

  constructor() {
    this.uId = crypto.randomUUID();
  }

  isCollapsed: boolean = false; // for preview
  isEditMode: boolean = false; // for preview
  isParent: boolean = false;
  // for preview
  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }
  edit() {
    this.isEditMode = true;
  }
  done() {
    this.isEditMode = false;
  }

  removeSelf(
    parent: NavigationListItem | null,
    root: NavigationListItem[]
  ): void {
    if (parent && parent.children) {
      const index = parent.children.findIndex(
        (child) => child.uId === this.uId
      );
      if (index !== -1) {
        parent.children.splice(index, 1);
      }
    } else {
      const rootIndex = this.findIndexOfItem(this, root);
      console.log(rootIndex);
      if (rootIndex !== -1) {
        root.splice(rootIndex, 1);
      }
    }
  }

  private findIndexOfItem(
    item: NavigationListItem,
    items: NavigationListItem[]
  ): number {
    return items.findIndex((i) => i.uId === item.uId);
  }

  ParseJson(json: any): void {
    let _menuListItem: NavigationListItem;
    let temp;
    for (const key in json) {
      if (key == 'children') {
        this.children = [];
        temp = json[key];

        for (const propName in temp) {
          _menuListItem = new NavigationListItem();
          _menuListItem.ParseJson(temp[propName]);
          this.children.push(_menuListItem);
        }
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class NavigationList {
  id = '';
  name = '';
  options: NavigationOptions = new NavigationOptions();
  list: NavigationListItem1[] = [];

  static validatorsMap = {
    name: [Validators.required],
  };

  ParseJson(json: any): void {
    let _menuList: NavigationListItem1;
    let temp;
    let index = 0;
    for (const key in json) {
      if (key == 'list') {
        this.list = [];
        temp = json[key];

        for (const propName in temp) {
          _menuList = new NavigationListItem1();
          _menuList.ParseJson(temp[propName]);
          _menuList.index = index;
          this.list.push(_menuList);
          index++;
        }
      } else if (key == 'options') {
        const _thiemeMenuOption = new NavigationOptions();
        _thiemeMenuOption.ParseJson(json[key]);
        this[key] = _thiemeMenuOption;
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
    console.log(this.list);
  }
}

export class NavigationOptions {
  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
