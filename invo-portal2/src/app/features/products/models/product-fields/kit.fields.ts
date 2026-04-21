import { Fields } from './interfaces';

// Per-type field config ported from InvoCloudFront2.

export const kitFields: Fields = {
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
      isRequired: true,
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
  productDeduction: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  suppliers: {
    isVisible: false,
    isDisabled: false,
    isRequired: false,

    code: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    minOrder: {
      isVisible: true,
      isDisabled: false,
      isRequired: true,
    },
    unitCost: {
      isVisible: true,
      isDisabled: false,
      isRequired: true,
    },
  },
  kitBuilder: {
    isVisible: true,
    isDisabled: false,
    isRequired: true,
    qty: {
      isVisible: true,
      isDisabled: false,
      isRequired: true,
    },
  },
  kitDetails: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
    UOM: {
      isVisible: true,
      isDisabled: false,
      isRequired: true,
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
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  preparationTime: {
    isVisible: false,
    isDisabled: false,
    isRequired: false,
  },
  serviceTime: {
    isVisible: false,
    isDisabled: false,
    isRequired: false,
  },
  orderByWeight: {
    isVisible: true,
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
  productAttributes: {
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
    buildBreak: true,

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
  customFields: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
  },
  shippingOptions: {
    isVisible: true,
    isDisabled: false,
    isRequired: false,
    weight: {
      isVisible: true,
      isDisabled: false,
      isRequired: false,
    },
    weightUOM: {
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
