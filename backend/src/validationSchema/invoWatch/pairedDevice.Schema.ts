import { ValidateReq } from "../validator";

export class PairedDeviceValidator {

    public static async pairedDeviceValidation(data: any) {
      if (data.pairedAt && data.pairedAt instanceof Date) {
        data.pairedAt = data.pairedAt.toISOString();
      }

      const schema = {
        type: "object",
        properties: {
          branchId:  { type: "string", format: "uuid" },
          deviceId:  { type: "string" },
          employeeId: { type: ["string", "null"], format: "uuid" },
          token: { type: "string" },
          type: { type: "string" }
        },
        required: ["branchId", "deviceId", "token", "type"],
        additionalProperties: true,
        errorMessage: {
          properties: {
            deviceId: "deviceId must be a string",
            type: "type must be a string",
            token: "token must be a string",
            branchId: "branchId must be a valid UUID",
            employeeId: "employeeId must be a valid UUID",
            
          },
          required: {
            token: "token is required",
            deviceId: "deviceId is required",
            branchId: "branchId is required",
            type: "type is required",
          }
        }
      };
  
      return await ValidateReq.reqValidate(schema, data);
    }

    public static async deviceInfoValidation(data: any) {
      const schema = {
        type: "object",
        properties: {
          deviceToken: { type: "string"},
          deviceType:  { type: "string" }
        },
        required: ["deviceToken", "deviceType"],
        additionalProperties: true,
        errorMessage: {
          properties: {
            deviceToken: "deviceToken must be a string",
            deviceType: "deviceType must be a string"  
          },
          required: {
            deviceToken: "deviceToken is required",
            deviceType: "deviceType is required"
          }
        }
      };
  
      return await ValidateReq.reqValidate(schema, data);
    }

    public static async pairingValidation(data: any) {
      const schema = {
        type: "object",
        properties: {
          code: { type: "string"},
          branchId:  { type: "string", format: "uuid" }
        },
        required: ["code", "branchId"],
        additionalProperties: true,
        errorMessage: {
          properties: {
            code: "code must be a string",
            branchId: "branchId must be a valid UUID",
          },
          required: {
            code: "code is required",
            branchId: "branchId  is required for completing pairing."
          }
        }
      };
  
      return await ValidateReq.reqValidate(schema, data);
    }

    public static async unPairedDataValidation(data: any) {
      const schema = {
        type: "object",
        properties: {
          deviceId: { type: "string"},
          branchId:  { type: "string", format: "uuid" }
        },
        required: ["deviceId", "branchId"],
        additionalProperties: true,
        errorMessage: {
          properties: {
            deviceId: "deviceId must be a string",
            branchId: "branchId must be a valid UUID",
          },
          required: {
            deviceId: "deviceId is required",
            branchId: "branchId  is required for completing pairing."
          }
        }
      };
     return await ValidateReq.reqValidate(schema, data);
    }

    public static async notificationValidation(data: any) {
      const schema = {
        type: "object",
        properties: {
          title: { type: ["string", "null"]},
          body:  { type: "string" },
          extraData : { type: "object"}
        },
        required: [ "body"],
        additionalProperties: true,
        errorMessage: {
          properties: {
            title: "title must be a string or null",
            body: "title must be a body",
          },
          required: {
            body: "Notification body is required"
          }
        }
      };
  
      return await ValidateReq.reqValidate(schema, data);
    }

}

export class PairedDeviceNotificationValidator {

  public static async NotificationTemplateSchema(data: any) {
    const schema = {

      type: "object",
      properties: {
        id: { type: "string", format: "uuid", nullable: true },
        title: { type: ["string", "null"], minLength: 3 },
        body: { type: "string", minLength: 3 },
        extraData: { type: "object", nullable: true }
      },
      required: [ "body"],
      additionalProperties: true,
      errorMessage: {
        required: {
          body: "body is required",
        },
        properties: {
          title: "title must be string or null",
          body: "body must be a non-empty string",
          id: "id must be a valid UUID or null",
          extraData: "extraData must be a key-value object or null",
        }
      }
    };




    return await ValidateReq.reqValidate(schema, data);
  }

  public static async sendNotificationSchema(data: any) {

    const schema = {
      type: "object",
      properties: {
        companyId: { type: "string", format: "uuid" },
        branchId: { type: "string", format: "uuid" },
        id: { type: "string", format: "uuid" },
      },
      required: ["companyId", "branchId", "id"],
      additionalProperties: false,
      errorMessage: {
        required: {
          companyId: "companyId is required",
          branchId: "branchId is required",
          id: "id is required"
        },
        properties: {
          companyId: "companyId must be a UUID",
          branchId: "branchId must be a UUID",
          id: "id must be a UUID"
        }
      }
    };

    return await ValidateReq.reqValidate(schema, data);
  }

}
  
  