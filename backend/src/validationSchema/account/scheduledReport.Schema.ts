import { ValidateReq } from "../validator";

export class ScheduledReportValidator {
    public static async scheduledReportValidation(data: any) {
      const schema = {
        type: "object",
        properties: {
          id: { type: ["string", "null"], format: "uuid" },
  
          companyId:  { type: "string", format: "uuid" },
          employeeId: { type: "string", format: "uuid" },
          startDate:  { type: "string", format: "date" },
          reportType: { type: "string" },
          attachmentType: {
            type: "string",
            enum: ["pdf", "xlsx"]
          },
          scheduleTime: {
            type: "string",
            pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$"
          },
          frequency: {
            type: "string",
            enum: ["daily", "weekly", "monthly", "yearly"]
          },

          nextRun:  { type: ["string", "null"], format: "date-time" },
          previousRun:  { type: ["string", "null"], format: "date-time" },
          isActive: { type: "boolean" },
          filter:   { type: 'object' } ,

          recipients:          { type: 'array', items: { type: 'string', format: 'uuid' } },
          additionalRecipient: { type: 'array', items: { type: 'string', format: 'email' }},
         
        },
        required: [
          "companyId",
          "employeeId",
          "reportType",
          "attachmentType",
          "scheduleTime",
          "frequency"
        ],
        additionalProperties: true,
        errorMessage: {
          properties: {
            id: "id must be a UUID or null",
            companyId: "companyId must be a valid UUID",
            employeeId: "employeeId must be a valid UUID",
            reportType: "reportType must be a string",
            attachmentType: "attachmentType must be one of: pdf, xlsx",
            scheduleTime: "scheduleTime must be in HH:mm or HH:mm:ss format",
            frequency: "frequency must be one of: daily, weekly, monthly, yearly",
            nextRun: "nextRun must be a valid ISO timestamp",
            previousRun: "previousRun must be a valid ISO timestamp",
            isActive: "isActive must be a boolean",
            recipients: 'recipients must be an array of valid UUIDs',
            additionalRecipient: 'additionalRecipient must be an array of valid email addresses',
            filter: 'filter must be a valid JSON object',
            startDate: 'startDate must be a valid date'
            
          },
          required: {
            companyId: "companyId is required",
            employeeId: "employeeId is required",
            reportType: "reportType is required",
            attachmentType: "attachmentType is required",
            frequency: "frequency is required",
            startDate: 'startDate is required',
            scheduleTime: "scheduleTime is required",
            
          }
        }
      };
  
      return await ValidateReq.reqValidate(schema, data);
    }
  }
  