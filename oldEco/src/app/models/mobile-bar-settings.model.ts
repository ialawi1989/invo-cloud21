export class MobileIconBarSettings {
  id: any = "";
  name: any = "";
  template: any = {};

  ParseJson(json: any): MobileIconBarSettings {
    for (const key in json) {
      if (key in this) {
        this[key as keyof this] = json[key] ?? this[key as keyof this];
      }
    }
    return this;
  }

  toMap(): { [key: string]: any } {
    return {
      id: this.id,
      name: this.name,
      template: this.template
    };
  }

  private getDefaultItems() {
    return [
      {
        index: 0,
        name: "Mobile Menu Toggle",
        translation: {
          title: {
            en: "Website Menu",
            ar: "القائمة"
          }
        },
        slug: "toggleMenu",
        enabled: false
      },
      {
        index: 0,
        name: "Compare",
        translation: {
          title: {
            en: "Compare",
            ar: "مقارنة"
          }
        },
        slug: "compare",
        enabled: false
      },
      {
        index: 0,
        name: "Search",
        translation: {
          title: {
            en: "Search",
            ar: "بحث"
          }
        },
        slug: "search",
        enabled: false
      },
      {
        index: 0,
        name: "To Top",
        translation: {
          title: {
            en: "To Top",
            ar: "إلى الأعلى"
          }
        },
        slug: "toTop",
        enabled: false
      },
      {
        index: 0,
        name: "Home",
        translation: {
          title: {
            en: "Home",
            ar: "الرئيسية"
          }
        },
        slug: "/",
        enabled: true
      },
      {
        index: 1,
        name: "Categories",
        translation: {
          title: {
            en: "Categories",
            ar: "الأقسام"
          }
        },
        slug: "categories",
        enabled: true
      },
      {
        index: 2,
        name: "Wishlist",
        translation: {
          title: {
            en: "Wishlist",
            ar: "المفضلة"
          }
        },
        slug: "wishlist",
        enabled: true
      },
      {
        index: 3,
        name: "Cart",
        translation: {
          title: {
            en: "Cart",
            ar: "السلة"
          }
        },
        slug: "cart",
        enabled: true
      },
      {
        index: 4,
        name: "Profile",
        translation: {
          title: {
            en: "Account",
            ar: "الحساب"
          }
        },
        slug: "account",
        enabled: true
      },
      {
        index: 0,
        name: "Menu",
        translation: {
          title: {
            en: "Menu",
            ar: "قائمة الطعام"
          }
        },
        slug: "menu",
        enabled: false
      },
      {
        index: 0,
        name: "Store",
        translation: {
          title: {
            en: "Store",
            ar: "المتجر"
          }
        },
        slug: "shop",
        enabled: false
      },
      {
        index: 0,
        name: "Orders",
        translation: {
          title: {
            en: "Orders",
            ar: "الطلبات"
          }
        },
        slug: "my-orders",
        enabled: false
      },
      {
        index: 0,
        name: "Bookings",
        translation: {
          title: {
            en: "Bookings",
            ar: "الحجوزات"
          }
        },
        slug: "appointments",
        enabled: false
      }
    ];
  }

  // Method to initialize with default items if empty
  initializeDefaults(): void {
    if (!this.template.list || this.template.list.length === 0) {
      this.template.list = this.getDefaultItems();
    }
  }
}


