import { Fields } from './interfaces';

// Per-type field config ported from InvoCloudFront2.

export const tailoringFields: Fields = {
  name: {
    isVisible: true,
    isDisabled: false,
    isRequired: true,
  },
  barcode: {
    isVisible: true,
    isDisabled: false,
    isRequired: true,
  },
  SKU: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  description: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  pricing: {
    defaultPrice: {
      isVisible: true,
      isDisabled: false,
      isRequired: true,
    },
    compareAtPrice: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    unitCost: {
      isVisible: true,
      isDisabled: true,
      isRequired: false,
    },
    adjustUnitCost: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    profit: {
      isVisible: true,
      isDisabled: true,
      isRequired: false,
    },
    tax: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    commissionAmount: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    priceModel: {
      isVisible: false,
      isDisabled: false,
      isRequired: false,
    },
    discount: {
      isVisible: true,
      isDisabled: false,
      isRequired: true,
    },
  },
  suppliers: {
    isVisible: false,
    isDisabled: false,
    isRequired: false,
    code: {
      isVisible: false,
      isDisabled: false,
      isRequired: false,
    },
    minOrder: {
      isVisible: false,
      isDisabled: false,
      isRequired: false,
    },
    unitCost: {
      isVisible: false,
      isDisabled: false,
      isRequired: false,
    },
  },
  image: true,
  department: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  category: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  brand: {
    isVisible: false,
    isDisabled: false,
    isRequired: false,
  },
  preparationTime: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  serviceTime: {
    isVisible: false,
    isDisabled: false,
    isRequired: false,
  },
  orderByWeight: {
    isVisible: false,
    isDisabled: false,
    isRequired: false,
  },
  discountableInPOS: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  maxItemPerTicket: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  kitchenName: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  tags: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  itemMessage: {
    isVisible: false,
    isDisabled: false,
    isRequired: false,
  },
  afterServiceDescription: {
    isVisible: false,
    isDisabled: false,
    isRequired: false,
  },
  warning: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  aliasBarcodes: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  aliasBarcodesList: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  altProduct: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  branchProduct: {
    available: true,
    availableOnline: true,
    differentPrice: true,
    onHand: {
      isVisible: false,
      isDisabled: false,
      isRequired: false,
    },
    reorderPoint: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    reorderLevel: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    price: {
      isVisible: true,
      isDisabled: false,
      isRequired: true,
    },
    location: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    pricingType: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    buyDownPrice: {
      isVisible: true,
      isDisabled: false,
      isRequired: true,
    },
    buyDownQty: {
      isVisible: true,
      isDisabled: false,
      isRequired: true,
    },
    priceBoundriesFrom: {
      isVisible: true,
      isDisabled: false,
      isRequired: true,
    },
    priceBoundriesTo: {
      isVisible: true,
      isDisabled: false,
      isRequired: true,
    },
    priceByQty: {
      qty: {
        isVisible: true,
        isDisabled: false,
        isRequired: true,
      },
      price: {
        isVisible: true,
        isDisabled: false,
        isRequired: true,
      },
    },
    buildBreak: false,

    serials: {
      isVisible: false,
      isDisabled: false,
      isRequired: false,
      unitCost: {
        isVisible: false,
        isDisabled: false,
        isRequired: false,
      },
    },
    batches: {
      isVisible: false,
      isDisabled: false,
      isRequired: false,
      barcode: {
        isVisible: false,
        isDisabled: false,
        isRequired: false,
      },
      batch: {
        isVisible: false,
        isDisabled: false,
        isRequired: false,
      },
      onHand: {
        isVisible: false,
        isDisabled: false,
        isRequired: false,
      },
      unitCost: {
        isVisible: false,
        isDisabled: false,
        isRequired: false,
      },
      productDate: {
        isVisible: false,
        isDisabled: false,
        isRequired: false,
      },
      expireDate: {
        isVisible: false,
        isDisabled: false,
        isRequired: false,
      },
    },
  },
  optionGroups: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  customFields: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },

  recipe: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
    usages: {
      isVisible: true,
      isDisabled: false,
      isRequired: true,
    },
  },
  measurements: {
    isVisible: true,
    isDisabled: false,
    isRequired: true,
    minSelect: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    shoulder: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    sleeve: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    armholeGrith: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    upperarmGrith: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    wristGrith: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    frontShoulderToWaist: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    bustGrith: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    waistGrith: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    hipGrith: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    acrossShoulder: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    thigh: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    ankle: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    bodyHeight: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    napeOfNeckToWaist: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    outsteam: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    insideLeg: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
  },
  isTaxable: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  saleAccount: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
};
