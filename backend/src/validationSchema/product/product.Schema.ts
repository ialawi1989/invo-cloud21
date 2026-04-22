import { BranchProductsValidation } from '@src/validationSchema/product/branchProducts.Schema';
import { BatchValidation } from '@src/validationSchema/product/ProductBatch.Schema';
import { ValidateReq } from '@src/validationSchema/validator';
import { SerialValidation } from './serials.Schema';


export class ProductValidation {

  public static productMediaSchema = {
    type: "string",
  }

  public static tabBuilderSchema = {
    type: "object",
    properties: {
      specifications: { type: "object", additionalProperties: true },
      faq: { type: "array", items: { type: "object", additionalProperties: true } }
    },
    additionalProperties: true
  }
  public static async serviceValidation(data: any) {

    const employeePricesSchema = {
      type: "object",
      properties: {
        employeeId: { type: "string" },
        price: { type: "number" },
        serviceTime: { type: "integer" }
      },
      required: ["employeeId", "price"],
      additionalProperties: true
    };

    const schema = {
      type: "object",
      properties: {

        type: { type: "string" },
        name: { type: "string", transform: ["trim"], "isNotEmpty": true },
        defaultPrice: { type: "number" },
        description: { type: "string" },
        categoryId: { type: ["string", "null"] },
        warning: { type: "string" },
        serviceTime: { type: "integer", minimum: 1 },
        barcode: { type: "string", transform: ["trim"] },
        commissionPercentage: { type: "boolean" },
        commissionAmount: { type: "number" },
        tags: { "type": "array", "items": { type: ["string",] } },
        branchProduct: { type: "array", items: BranchProductsValidation.branchProductSchema },
        employeePrices: { "type": "array", "items": employeePricesSchema },
        defaultImage: { "type": "string" },
        productMedia: { "type": "array", "items": this.productMediaSchema },
        tabBuilder: this.tabBuilderSchema
      },
      required: ["name", "defaultPrice", "barcode", "serviceTime"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "name Must Be String",
          defaultPrice: "defaultPrice Must Be Number",
          barcode: "barcode Must Be String",
          serviceTime: "serviceTime must be integer"
        },
        required: {
          name: "name is Required",
          defaultPrice: "defaultPrice is Required",
          barcode: "barcode is Required",
          serviceTime: "serviceTime is Required",
        },
      }
    }
    return await ValidateReq.reqValidate(schema, data);

  }

  public static async InventoryValidation(data: any) {

    const barcodeSchema = {
      type: "object",
      properties: {
        barcode: { type: "string", transform: ["trim"] },
      },
      required: ["barcode"],
      additionalProperties: true
    }
    const schema = {
      type: "object",
      properties: {

        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        parentId: { type: ["string", "null"] },
        defaultPrice: { type: "number" },
        description: { type: "string" },
        categoryId: { type: ["string", "null"] },
        warning: { type: "string" },
        UOM: { type: "string" }, //uom
        childQty: { type: "number" },
        commissionPercentage: { type: "boolean" },
        commissionAmount: { type: "number" },
        unitCost: { type: "number" },
        barcode: { type: "string", transform: ["trim"], /*pattern: '^(?!(21|20|22))\\d{13}$', errorMessage: "barcode must be 13 digit and not startwith (20,21,22)"*/ },
        orderByWeight: { type: ["boolean", "null"], default: false },
        branchProduct: { type: "array", items: BranchProductsValidation.inventorySchema },
        tags: { "type": "array" },
        barcodes: { "type": "array", "items": barcodeSchema },
        productMedia: { "type": "array", "items": this.productMediaSchema },
        tabBuilder: this.tabBuilderSchema
      },
      required: ["name", "defaultPrice", "barcode", "UOM", "unitCost"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "name Must Be String",
          defaultPrice: "defaultPrice Must Be Number",
          barcode: "barcode Must Be String",
          UOM: "UOM must be String",
          unitCost: "unitCost must be integer"
        },
        required: {
          name: "name is Required",
          defaultPrice: "defaultPrice is Required",
          barcode: "barcode is Required",
          UOM: "UOM is Required",
          unitCost: "unitCost is Required",
        },
      }
    }

    if (data.parentId != null) {
      if (data.childQty == null) {
        return { valid: false, error: "child Qty required" }
      }
    }

    return await ValidateReq.reqValidate(schema, data);
  }

  public static async kitValidation(data: any) {

    const kitBuilderSchema = {
      type: "object",
      properties: {
        productId: { type: "string" },
        qty: { type: "number", exclusiveMinimum: 0, errorMessage: 'qty must be greater than zero.' },
      },
      required: ["productId", "qty"],
      additionalProperties: true,
      errorMessage: {

        properties: {
          productId: "productId Must Be String",
          qty: "qty Must Be Number",
        },
        required: {
          productId: "productId is Required",
          qty: "qty is Required"
        },
      }
    };

    const schema = {
      type: "object",
      properties: {

        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        defaultPrice: { type: "number" },
        description: { type: "string" },
        UOM: { type: "string", "isNotEmpty": true },
        categoryId: { type: ["string", "null"] },
        warning: { type: "string" },
        serviceTime: { type: "integer", minimum: 1 },
        commissionPercentage: { type: "boolean" },
        commissionAmount: { type: "number" },
        barcode: { type: "string", transform: ["trim"] },
        tags: { "type": "array", "items": { "type": "string" } },
        kitBuilder: { "type": "array", "items": kitBuilderSchema },
        branchProduct: { type: "array", items: BranchProductsValidation.inventorySchema },
        productMedia: { "type": "array", "items": this.productMediaSchema },
        tabBuilder: this.tabBuilderSchema
      },
      required: ["name", "defaultPrice", "barcode", "UOM"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "name Must Be String",
          defaultPrice: "defaultPrice Must Be Number",
          barcode: "defaultPrice Must Be String",
          UOM: "UOM Must Be String",
        },
        required: {
          name: "name is Required",
          defaultPrice: "defaultPrice is Required",
          barcode: "barcode is Required",
          kitBuilder: "kitBuilder is Required",
          UOM: "UOM is Required",
        },
      }
    }
    const validation = await ValidateReq.reqValidate(schema, data);
    return validation;
  }

  public static async packageValidation(data: any) {
    const packageSchema = {
      type: "object",
      properties: {
        productId: { type: "string" },
        qty: { type: "number" },
      },
      required: ["productId", "qty"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          productId: "productId Must Be String",
          qty: "qty Must Be Number"
        },
        required: {
          productId: "productId is Required",
          qty: "qty is Required"
        },
      }
    };

    const priceModelSchema = {
      type: "object",
      properties: {
        discount: { type: "number" },
        model: { type: ["string", "null"], enum: ["fixedPrice", "fixedPriceWOption", 'totalPrice', 'totalPriceWithDiscount'] },
      },
      required: [],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "name Must Be String",
          defaultPrice: "defaultPrice Must Be Number",
          barcode: "defaultPrice Must Be String",
          kitBuilder: "kitBuilder Must Be array",
          UOM: "UOM Must Be String",
        },
        required: {
          name: "name is Required",
          defaultPrice: "defaultPrice is Required",
          barcode: "barcode is Required",
          kitBuilder: "kitBuilder is Required",
          UOM: "UOM is Required",
        },
      }
    };




    const schema = {
      type: "object",
      properties: {

        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        defaultPrice: { type: "number" },
        description: { type: "string" },
        categoryId: { type: ["string", "null"] },
        warning: { type: "string" },
        serviceTime: { type: "integer" },
        barcode: { type: "string", transform: ["trim"] },
        tags: { "type": "array", "items": { "type": "string" } },
        branchProduct: { type: "array", items: BranchProductsValidation.branchProductSchema },
        priceModel: priceModelSchema,
        commissionPercentage: { type: "boolean" },
        commissionAmount: { type: "number" },
        package: { "type": "array", "items": packageSchema },
        productMedia: { "type": "array", "items": this.productMediaSchema },
        tabBuilder: this.tabBuilderSchema
      },
      required: ["name", "defaultPrice", "barcode", "package", "priceModel"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "name Must Be String",
          defaultPrice: "defaultPrice Must Be Number",
          barcode: "barcode Must Be String",
          package: "package must be array",
          priceModel: "priceModel must be object"
        },
        required: {
          name: "name is Required",
          productId: "productId is Required",
          package: "package is Required",
          priceModel: "priceModel is Required",
        },
      }
    }
    const validation = await ValidateReq.reqValidate(schema, data);
    return validation;
  }

  public static async BatchValidation(data: any) {


    const schema = {
      type: "object",
      properties: {

        type: { type: "string" },
        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        defaultPrice: { type: "number" },
        description: { type: "string" },
        categoryId: { type: ["string", "null"] },
        warning: { type: "string" },
        serviceTime: { type: "integer" },
        commissionPercentage: { type: "boolean" },
        commissionAmount: { type: "number" },
        branchProduct: { type: 'array', items: BranchProductsValidation.batchSchema },
        barcode: { type: "string", transform: ["trim"] },
        tags: { "type": "array", "items": { type: "string" } },
        productMedia: { "type": "array", "items": this.productMediaSchema },
        tabBuilder: this.tabBuilderSchema

      },
      required: ["name", "defaultPrice", "barcode"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "name Must Be String",
          defaultPrice: "defaultPrice Must Be Number",
          barcode: "defaultPrice Must Be String",

        },
        required: {
          name: "name is Required",
          defaultPrice: "defaultPrice is Required",
          barcode: "barcode is Required",

        },
      }
    }
    const validation = await ValidateReq.reqValidate(schema, data);
    return validation;
  }

  public static async SerialValidation(data: any) {
    const schema = {
      type: "object",
      properties: {

        type: { type: "string" },
        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        defaultPrice: { type: "number" },
        description: { type: "string" },
        unitCost: { type: "number" },
        categoryId: { type: ["string", "null"] },
        warning: { type: "string" },
        serviceTime: { type: "integer" },
        commissionPercentage: { type: "boolean" },
        commissionAmount: { type: "number" },
        branchProduct: { type: 'array', items: BranchProductsValidation.serialSchema },
        barcode: { type: "string", transform: ["trim"] },
        tags: { "type": "array", "items": { type: "string" } },
        productMedia: { "type": "array", "items": this.productMediaSchema },
        tabBuilder: this.tabBuilderSchema
      },
      required: ["name", "defaultPrice", "barcode"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "name Must Be String",
          defaultPrice: "defaultPrice Must Be Number",
          barcode: "defaultPrice Must Be String",

        },
        required: {
          name: "name is Required",
          defaultPrice: "defaultPrice is Required",
          barcode: "barcode is Required",

        },
      }
    }
    const validation = await ValidateReq.reqValidate(schema, data);
    return validation;
  }

  public static async MenuItemValidation(data: any) {
    const optionGroupsSchema = {
      type: "object",
      properties: {
        index: { type: "number" },
        optionGroupId: { type: "string" },
      },
      required: ["index", "optionGroupId"],
      additionalProperties: true
    };

    const defaultOptions = {
      type: "object",
      properties: {
        optionId: { type: "string" },
        qty: { type: "number", exclusiveMinimum: 0, errorMessage: ' Default Option qty must be greater than zero.' },
        index: { type: ["string","number"] }
      },
      required: ["optionId", "qty", "index"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          qty: "qty must be greater than zero.",
          optionId: "optionId Must Be string",
          index: "index Must Be number",

        },
        required: {
          qty: "qty is Required",
          optionId: "optionId is Required",
          index: "index is Required",
        },
      }
    };
    const recipeschema = {
      type: "object",
      anyOf: [
        {
          properties: {
            usages: {
              type: "number",
              exclusiveMinimum: 0,  // Ensures usages > 0
              errorMessage: 'qty must be greater than zero.'  // Custom error message for invalid usages
            },
            inventoryId: {
              type: "string"
            },
          },
          required: ["inventoryId", "usages"],
          additionalProperties: true,
        },
        {
          properties: {
            usages: {
              type: "number",
              exclusiveMinimum: 0,  // Ensures usages > 0
              errorMessage: 'qty must be greater than zero.'  // Custom error message for invalid usages
            },
            recipeId: {
              type: "string"
            },
          },
          required: ["recipeId", "usages"],
          additionalProperties: true,
          errorMessage: {
            properties: {
              anyOf: "Either inventoryId or recipeId and usages are required",
              inventoryId: "inventoryId Must Be String",
              usages: "usages Must Be Number",
            },
            required: {
              anyOf: "Either inventoryId or recipeId and usages are required",
              recipeId: "recipeId is Required",
              usages: "usages is Required",
            },
          },
        },
      ],
      errorMessage: {
        // Global error message in case the data doesn't match any schema in 'anyOf'
        anyOf: "Either the inventoryId / recipeId with usages Greater than 0 is required ",
      },
    };

    const schema = {
      type: "object",
      properties: {

        type: { type: 'string' },
        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        defaultPrice: { type: "number" },
        description: { type: "string" },
        categoryId: { type: ["string", "null"] },
        warning: { type: "string" },
        serviceTime: { type: "integer" },
        barcode: { type: "string", transform: ["trim"] },
        tags: { "type": "array", "items": { type: "string" } },
        optionGroups: { "type": "array", "items": optionGroupsSchema },
        defaultOptions: { "type": "array", "items": defaultOptions },
        quickOptions: { "type": "array", "items": { type: "object" } },
        commissionPercentage: { type: "boolean" },
        commissionAmount: { type: "number" },
        branchProduct: { type: "array", items: BranchProductsValidation.branchProductSchema },
        recipes: { "type": "array", "items": recipeschema },
        productMedia: { "type": "array", "items": this.productMediaSchema },
        tabBuilder: this.tabBuilderSchema
      },
      required: ["name", "defaultPrice", "barcode"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "name Must Be String",
          defaultPrice: "defaultPrice Must Be Number",
          barcode: "defaultPrice Must Be String",

        },
        required: {
          name: "name is Required",
          defaultPrice: "defaultPrice is Required",
          barcode: "barcode is Required",
        },
      }
    }
    const validation = await ValidateReq.reqValidate(schema, data);
    return validation;
  }

  public static async MenuSelectionValidation(data: any) {
    const itemsSchema = {
      type: "object",
      properties: {
        productId: { type: "string" },
        index: { type: "integer" },
      },
      required: ["productId", "index"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          productId: "productId Must Be String",
          index: "index Must Be integer",

        },
        required: {
          productId: "productId is required",
          index: "index is required",
        },
      }
    };

    const selectionSchema = {
      type: "object",
      properties: {
        items: { "type": "array", "items": itemsSchema },
        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        noOfSelection: { type: "integer" },
        index: { type: "integer" },
      },
      required: ["noOfSelection", "index"],
      additionalProperties: true,
      errorMessage: {
        properties: {

          noOfSelection: "noOfSelection Must Be integer",
          index: "index Must Be integer",

        },
        required: {
          noOfSelection: "noOfSelection is Required",
          index: "index is Required",

        },
      }
    };

    const priceModelSchema = {
      type: "object",
      properties: {
        discount: { type: "number" },
        model: { type: ["string", "null"], enum: ["fixedPrice", "fixedPriceWOption", 'totalPrice', 'totalPriceWithDiscount'] },
      },
      required: [],
      additionalProperties: true
    };

    const schema = {
      type: "object",
      properties: {

        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        defaultPrice: { type: "number" },
        description: { type: "string" },
        categoryId: { type: ["string", "null"] },
        warning: { type: "string" },
        serviceTime: { type: "integer" },
        barcode: { type: "string", transform: ["trim"] },
        tags: { "type": "array", "items": { type: "string" } },
        branchProduct: { type: "array", items: BranchProductsValidation.branchProductSchema },
        priceModel: priceModelSchema,
        commissionPercentage: { type: "boolean" },
        commissionAmount: { type: "number" },
        selection: { "type": "array", "items": selectionSchema },
        productMedia: { "type": "array", "items": this.productMediaSchema },
        tabBuilder: this.tabBuilderSchema
      },
      required: ["name", "defaultPrice", "barcode"],
      additionalProperties: true,
      errorMessage: {
        properties: {

          name: "name Must Be String",
          defaultPrice: "defaultPrice Must Be Number",
          barcode: "barcode Must Be String",

        },
        required: {
          name: "name is Required",
          defaultPrice: "defaultPrice is Required",
          barcode: "barcode is Required",

        },
      }
    }
    const validation = await ValidateReq.reqValidate(schema, data);
    return validation;
  }  
  
  public static async AddMatrixValidation2(data: unknown) {
    const baseString = { type: "string", nullable: false, transform: ["trim"] };

    const attributeSchema = {
      type: "object",
      properties: {
        name: baseString,
        code: baseString,
        displayValue: { type: "string" }
      },
      required: ["name", "code"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "Attribute name must be a non-empty string.",
          code: "Attribute code must be a string.",
        },
        required: {
          name: "Attribute name is required.",
          code: "Attribute code is required.",
        },
      },
    };

    const dimensionSchema = {
      type: "object",
      properties: {
        name: baseString,
        displayType: {
          type: "string",
          enum: ["buttons", "dropdown", "radio"],
          nullable: true,
          errorMessage: "The displayType must be one of: buttons, dropdown or radio"
        },
        attributes: {
          type: "array",
          items: attributeSchema,
          uniqueAttributesBy: ["name", "code"],
          minItems: 1,

        },
      },
      required: ["name", "attributes"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "Dimension name must be a non-empty string.",
          displayType: "DisplayType must be one of: buttons, dropdown or radio.",
          attributes: "Attributes must be a non-empty array",
        },
        required: {
          name: "Dimension name is required.",
          attributes: "Attributes array is required in dimension.",
        },
      },
    };

    const productSchema = {
      type: "object",
      properties: {
        name: baseString,
        barcode: { type: "string", nullable: true },
      },
      required: ["name"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "Product name must be a non-empty string.",
          barcode: "Product barcode must be a string.",
        },
        required: {
          name: "Product name is required.",
        },
      },
    };

    const schema = {
      type: "object",
      properties: {
        name: baseString,
        barcode: { type: "string", isNotEmpty: true },
        defaultPrice: { type: "number", nullable: false },
        dimensions: {
          type: "array",
          items: dimensionSchema,
          minItems: 1
        },
        products: {
          type: "array",
          items: productSchema,
          minItems: 1
        },
      },
      required: ["name", "barcode", "dimensions", "products"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "Matrix name must be a non-empty string.",
          barcode: "Matrix barcode must be a string.",
          products: "Products must be an array ",
        },
        required: {
          name: "Matrix name is required.",
          barcode: "Matrix barcode is required.",
          dimensions: "At least one dimension is required.",
          products: "products cannot be an empty array",
        },
      },
    };

    const validated = await ValidateReq.reqValidate2(schema, data);
    return validated;
  }


  public static async AddMatrixValidation(data: any) {
    const productSchema = {
      type: "object",
      properties: {
        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        barcode: { type: "string", transform: ["trim"] },
      },
      required: ["name"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "name Must Be String",
        },
        required: {
          name: "name is Required",
        },
      }
    }
    const attributeSchema = {
      type: "object",
      properties: {
        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        code: { type: "string" }
      },
      required: ["name"],
      additionalProperties: true,
      errorMessage: {
        properties: {

          name: "name Must Be String",


        },
        required: {
          name: "name is Required",


        },
      }
    }


    const dimensionSchema = {
      type: "object",
      properties: {
        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        displayType :{ type: ["string","null"], enum: ["buttons", "dropdown" , "radio"] },
        attributes: { type: "array", items: attributeSchema ,uniqueAttributesBy: ["name", "code"] }
      },
      required: ["name", "attributes"],
      additionalProperties: true,
      errorMessage: {
        properties: {

          name: "name Must Be String",
          attributes: "attributes Must Be array",
          displayType: "displayType Must Be one of :[buttons, dropdown or radio]"


        },
        required: {
          name: "name is Required",
          attributes: "attributes is Required",


        },
      }
    }
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", "isNotEmpty": true, transform: ["trim"] },
        barcode: { type: "string", transform: ["trim"] },
        defaultPrice: { type: "number" },
        base64Image: { type: ["string", "null"] },
        defaultImage: { type: ["string", "null"] },
        dimensions: { type: "array", items: dimensionSchema },
        products: { type: "array", items: productSchema }

      },
      required: ["name", "dimensions", "barcode"],
      additionalProperties: true,
      errorMessage: {
        properties: {
          name: "name Must Be String",
         dimensions: "dimensions Must Be array",
          barcode: "barcode Must Be String",
        },
        required: {
          name: "name is Required",
          dimensions: "dimensions is Required",
          barcode: "barcode is Required",
        },
      }
    }

    const validation = await ValidateReq.reqValidate(schema, data);
    return validation;
  }

  
 


}


