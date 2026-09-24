/** Ported 1:1 from the legacy `core/models/customer.ts`. */

export class Customer {
  id: string | null = null;
  name: string = '';
  email: string = '';
  saluation: string = '';
  phone: string = '';
  birthDay: any = null;
  MSR: string = '';
  openingBalance: any = [];
  notes: CustomerNotes[] = [];
  mobile: string = '';
  addresses: CustomerAddress[] = [];
  outStandingRecivable: any = null;
  unusedCredit: any = null;
  priceLabelId: any = null;
  discountAmount: number = 0;
  vatNumber: string = '';
  ago: string = '';
  createdAt: any = '';
  currencyId: any = null;
  options: CustomerOptions | null = null;
  msr: any = null;
  paymentTerm: string = 'net7';

  customFields: { [id: string]: any } = {};

  //for display only
  showInSearch = null;
  disabled = false;
  selectedToPick = false;

  value: any;
  constructor() {
    this.notes = [];
    this.addresses = [];
  }

  get getName() {
    return this.saluation ? this.saluation + ' ' + this.name : this.name;
  }


  get is_name_empty() {
    return this.name == '' || this.name == null;
  }

  get is_email_empty() {
    return this.email == '' || this.email == null;
  }
  get is_email_valid() {
    if (this.email == null || this.email == '') {
      return true;
    } else {
      if (this.email != '') {
        var pattern = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        let txt = this.email;
        return pattern.test(txt); // returns a boolean
      } else {
        return true;
      }
    }
  }

  companyId = '';
  companyGroup = '';

  customerCredit = 0;

  updatedAt = new Date();
  oneSignalSegment = '';


  contactName: string | null = '';
  creditLimit: number | null = null;
  type: 'Business' | 'Individual' = 'Individual';

  hasChild: boolean = false;

  parentId: string | null = '';
  parentName: string | null = '';

  priceTier = "";
  industry = "";
  crNumber: string = "";
  salesman: string = "";

  ParseJson(json: any): void {
    let temp: any;
    for (const key in json) {
      if (key == 'notes') {
        if (json[key] == null) {
          this.notes = [];
        } else {
          const customerNotes: CustomerNotes[] = [];
          let customerNote: CustomerNotes;
          json[key].forEach((line: any) => {
            customerNote = new CustomerNotes();
            customerNote.ParseJson(line);
            customerNotes.push(customerNote);
          });
          this.notes = customerNotes;
        }
      } else if (key == "customFields") {
        // Handle customFields as object with ID keys
        this.customFields = {};
        temp = json[key];

        if (temp && typeof temp === 'object') {
          // If it's already in the new format {id: value}
          if (!Array.isArray(temp)) {
            this.customFields = { ...temp };
          } else {
            // Handle old array format for backward compatibility
            temp.forEach((field: any) => {
              if (field.id) {
                this.customFields[field.id] = field.value;
              }
            });
          }
        }
      } else if (key == 'addresses') {
        const addresses: CustomerAddress[] = [];
        let address: CustomerAddress;
        json[key].forEach((line: any) => {
          address = new CustomerAddress();
          address.ParseJson(line);
          addresses.push(address);
        });
        this.addresses = addresses;
      } else if (key == "options") {
        const _options = new CustomerOptions();
        _options.ParseJson(json[key])
        this.options = _options;
      } else if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class CustomerOptions {
  allowHouseAccount: boolean = true;
  [key: string]: any;

  ParseJson(json: any): void {
    let temp: any;
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}
export class CustomerAddress {
  title: string = '';
  block: string = '';
  road: string = '';
  avenue = '';
  building: string = '';
  flat: string = '';
  house = '';
  office = '';
  city: string = '';
  note: string = '';
  lat: string = '';
  lng: string = '';
  postalCode = '';
  district = '';

  country: string = '';
  addressLine1: string = "";
  addressLine2: string = "";
  region: string = "";

  isDefault: boolean = false;

  /**
   * One-line address for the document papers, which render it by plain
   * interpolation.
   *
   * Addresses exist in two layouts: the legacy one puts the whole address into
   * `addressLine1`, the structured one splits it across `block` / `road` /
   * `building` / ... A record migrated between the two carries both (the
   * migration in add-address-modal is deliberately non-destructive), so
   * printing every non-empty field spelled the same value out twice --
   * "Address1: Road 340 ... Road: 340". A structured component is therefore
   * skipped when the free-text lines already state it.
   */
  toString() {
    let temp = '';

    // Free-text fields that may already contain a composed address.
    const lineTokens = new Set(
      [this.addressLine1, this.addressLine2, this.district]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
    );

    // Whole tokens only: "Building 3" must not be swallowed by "Road 340".
    const isRestated = (value: string): boolean => {
      const tokens = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      return tokens.length > 0 && tokens.every((token) => lineTokens.has(token));
    };

    const append = (label: string, value: string) => {
      if (value == null || value === '') return;
      temp += `${label}: ${value} `;
    };

    /** A structured component -- dropped when the free-text lines restate it. */
    const appendComponent = (label: string, value: string) => {
      if (value == null || value === '' || isRestated(value)) return;
      temp += `${label}: ${value} `;
    };

    append('Country', this.country);
    append('Region', this.region);
    append('Address1', this.addressLine1);
    append('Address2', this.addressLine2);
    append('City', this.city);
    append('Postal Code', this.postalCode);
    appendComponent('Block', this.block);
    append('District', this.district);
    appendComponent('Avenue', this.avenue);
    appendComponent('Road', this.road);
    appendComponent('Building', this.building);
    appendComponent('House', this.house);
    appendComponent('Flat', this.flat);
    appendComponent('Office', this.office);

    return temp;
  }

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class CustomerImport {
  name: string = '';
  type: string = '';
  phone: string = '';
  mobile: string = '';
  email: string = '';
  contactName: string = '';
  crNumber: string = '';
  salesman: string = '';
  vatNumber: string = '';
  birthDay: string = '';

  addresses: CustomerAddress[] = [];

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}

export class CustomerNotes {
  employeeId: string = '';
  employeeName: string = '';
  note: string = '';
  createdAt: any = new Date();
  isNew: boolean = false;

  ParseJson(json: any): void {
    for (const key in json) {
      if (key in this) {
        this[key as keyof typeof this] = json[key];
      }
    }
  }
}