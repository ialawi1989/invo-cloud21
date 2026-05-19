import { Company } from 'src/app/models/company.model';

interface Website {
  id: any;
  name: string;
  slug: string;
  type: string; //[Page,WebSiteSettings,Menu]  => one company => ONE WebSiteSettings AND  MANY PageBuilder
  template: any;
  isHomePage: boolean;
}

interface CompanySettings {
  type: string; // Example: 'restaurant', 'retail', etc.
}

export const BUTTONS: any = [
  {
    id: '9f64e553-692e-42ae-bd8e-ca89c734eaa9',
    color: '#575757',
    image: {
      width: 0,
    },
    title: 'Delivery',
    buttonLink: {
      uId: '94352675-9624-4dbd-a57d-1854f5c7f8ae',
      abbr: 'delivery-menu',
      name: 'Delivery (menu)',
      type: 'services',
      index: 0,
      originalName: 'Delivery (menu)',
    },
    titleColor: '#575757',
    buttonGraphic: {
      style: 'icon',
      defaultImage: {
        width: 0,
      },
    },
    subtitleColor: 'black',
  },
  {
    id: '55106f52-94e8-4e80-a9a9-0a7597f931ae',
    color: '#575757',
    image: {
      width: 0,
    },
    title: 'Pickup',
    buttonLink: {
      uId: 'dbbf5792-72f4-473f-83d0-74c731c73f21',
      abbr: 'pickup-menu',
      name: 'Pickup (menu)',
      type: 'services',
      index: 0,
      originalName: 'Pickup (menu)',
    },
    titleColor: '#575757',
    buttonGraphic: {
      style: 'icon',
      defaultImage: {
        width: 0,
      },
    },
    subtitleColor: '#575757',
  },
  {
    id: '1eb7fbb7-6adf-4484-9eb3-62bcf5e9ccae',
    color: '#575757',
    image: {
      width: 0,
    },
    title: 'Table Reservation',
    buttonLink: {
      uId: '0d04fbfa-26f0-493e-9787-b3fb39b7c896',
      abbr: 'table-reservation',
      name: 'Table Reservation',
      type: 'services',
      index: 0,
      originalName: 'Table Reservation',
    },
    titleColor: '#575757',
    buttonGraphic: {
      style: 'icon',
      defaultImage: {
        width: 0,
      },
    },
    subtitleColor: '#575757',
  },
  {
    id: '87ef7c99-0782-44a0-a702-425e274b3c85',
    color: '#575757',
    image: {
      width: 0,
    },
    title: 'Shop',
    buttonLink: {
      uId: 'b69fb03e-eae8-43d9-9c9a-07715771a659',
      abbr: 'shop',
      name: 'Shop',
      type: 'services',
      index: 0,
      originalName: 'Shop',
    },
    titleColor: '#575757',
    buttonGraphic: {
      style: 'icon',
      defaultImage: {
        width: 0,
      },
    },
    subtitleColor: 'black',
  },
  {
    id: '87ef7c99-0782-44a0-a702-425e274b3c85',
    color: '#575757',
    image: {
      width: 0,
    },
    title: 'Appointments',
    buttonLink: {
      uId: 'b69fb03e-eae8-43d9-9c9a-07715771a659',
      abbr: 'appointments',
      name: 'Appointments',
      type: 'services',
      index: 0,
      originalName: 'Appointments',
    },
    titleColor: '#575757',
    buttonGraphic: {
      style: 'icon',
      defaultImage: {
        width: 0,
      },
    },
    subtitleColor: 'black',
  },
];
export const HOME: Website = {
  id: null,
  type: 'Page',
  template: {
    slug: 'home',
    isStatic: false,
    sections: [
      {
        id: 'Section_469c1deb-72a0-45c6-9622-d05ca1edb475',
        isShow: true,
        isSelected: false,
        sectionData: {
          text1: 'Welcome to',
          text2: 'Invo Restaurant',
          buttonLink: {
            uId: 'c2c78474-2aa3-4337-a5f3-9142651dde5e',
            abbr: 'menu',
            name: 'Menu',
            type: 'plus',
            index: 0,
            originalName: 'Menu',
          },
          buttonText: 'Menu',
          text1Color: '#fff',
          text2Color: '#fff',
          buttonColor: 'gold',
          buttonTextColor: '#000',
        },
        sectionName: 'Banner section',
        sectionType: 'Banner section',
        sectionStyle: 'Style 1',
        sectionWidth: 'Boxed',
        sectionHeight: 'Full',
        sectionLayout: 1,
        marginVertical: 0,
        paddingVertical: 0,
        animationOptions: {
          name: 'fadeIn',
          duration: '1.2s',
        },
        marginHorizontal: 0,
        paddingHorizontal: 0,
        sectionBackground: {
          style: 'Color',
          isParallax: false,
          showOvarlay: false,
          defaultImage: {
            width: 0,
            color:" #40413c"
          },
          overlayColor: '#000',
          overlayOpacity: 0,
          showOvarlayPattern: false,
        },
      },
      {
        id: 'Section_bbd8df4e-987c-4c26-82d2-8012a75d85cf',
        isShow: true,
        isSelected: false,
        sectionData: {
          buttons: [],
        },
        sectionName: 'Buttons section',
        sectionType: 'Buttons section',
        sectionStyle: 'Style 2',
        sectionWidth: 'Boxed',
        sectionHeight: 'Auto',
        sectionLayout: 1,
        marginVertical: 0,
        paddingVertical: 0,
        animationOptions: {
          name: 'fadeIn',
          duration: '1.2s',
        },
        marginHorizontal: 0,
        paddingHorizontal: 0,
        sectionBackground: {
          style: 'Color',
          isParallax: false,
          showOvarlay: false,
          defaultImage: {
            width: 0,
          },
          overlayColor: '#000',
          overlayOpacity: 0,
          showOvarlayPattern: false,
        },
      },
    ],
    isHomePage: false,
    templateType: 'custom',
  },
  isHomePage: true,
  name: 'Home',
  slug: 'home',
};
