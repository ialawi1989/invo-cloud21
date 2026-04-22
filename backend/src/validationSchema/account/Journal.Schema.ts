import { Helper } from "@src/utilts/helper"
import { ValidateReq } from "../validator"

export class JournalValidation {
  public static async journalValidation(data: any) {

    const journalLineSchema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        dbTable: { type: "string" },
        dbTableId: { type: ["string", "null"] },
        code: { type: "string" },
        description: { type: "string" },
        debit: { type: "number" },
        credit: { type: "number" },
        journalId: { type: "string" },
        accountId: { type: "string" },
      },
      required: ["accountId", "debit", "credit"],
      additionalProperties: true,
      errorMessage: {
        required: {
          accountId: "accountId is Required",
        },
      },
    }
    const schema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        createdAt: { type: "string", "isNotEmpty": true },
        branchId: { type: "string", "isNotEmpty": true },
        reference: { type: "string" },
        notes: { type: "string" },
        lines: { type: "array", items: journalLineSchema, minItems: 2 }
      },
      required: ["branchId", "lines"],
      additionalProperties: true,

      errorMessage: {
        required: {
          branchId: "branchId is Required",
        },
      },
    }

    return await ValidateReq.reqValidate(schema, data)
  }

  public static async editjournalValidation(data: any) {

    const journalLineSchema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        dbTable: { type: "string" },
        dbTableId: { type: "string" },
        code: { type: "string" },
        description: { type: "string" },
        debit: { type: "number" },
        credit: { type: "number" },
        journalId: { type: "string" },
        accountId: { type: "string" },
      },
      required: ["accountId"],
      additionalProperties: false
    }
    const schema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        date: { type: "string", "isNotEmpty": true },
        branchId: { type: "string", "isNotEmpty": true },
        reference: { type: "string" },
        system: { type: "boolean" },
        journalLines: { type: "array", items: journalLineSchema }
      },
      required: ["branchId"],
      additionalProperties: false
    }

    return await ValidateReq.reqValidate(schema, data)
  }

  public static async journalValidationForRecurringJournal(data: any) {
    data = Helper.trim_nulls(data);

    const journalLineSchema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
        dbTable: { type: "string" },
        dbTableId: { type: ["string", "null"] },
        code: { type: "string" },
        description: { type: "string" },
        debit: { type: "number" },
        credit: { type: "number" },
        journalId: { type: "string" },
        accountId: { type: "string" },
      },
      required: ["accountId", "debit", "credit"],
      additionalProperties: true,
      errorMessage: {
        required: {
          accountId: "accountId is Required",
        },
      },
    }
    const schema = {
      type: "object",
      properties: {
        id: { type: ["string", "null"] },
      
        branchId: { type: "string", "isNotEmpty": true },
        reference: { type: "string" },
        notes: { type: "string" },
        lines: { type: "array", items: journalLineSchema, minItems: 2 }
      },
      required: ["branchId", "lines"],
      additionalProperties: true,

      errorMessage: {
        required: {
          branchId: "branchId is Required",
        },
      },
    }

    return await ValidateReq.reqValidate(schema, data)
  }

}