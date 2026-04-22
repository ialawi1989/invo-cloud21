import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import Ajv, {JSONSchemaType,ErrorObject} from 'ajv';
import transform from 'ajv-keywords/dist/definitions/transform';
import ajvErrors from 'ajv-errors';
import addFormats from "ajv-formats"

export class ValidateReq {
    public static reqValidate = async function name(schema: any, data: any) {
        try {
            // const errors = validationResult(req);
            // if (!errors.isEmpty()) {
            //     return res.status(400).json({ errors: errors.array() });}
            // next()
            const ajv = new Ajv({
                allErrors: true,
                keywords: [
                    transform()
                ]

            });

            addFormats(ajv,  ["date", "time", "regex", "date-time", "email", "uuid"])
            

            ajv.addKeyword({
                keyword: 'isNotEmpty',
                validate: (schema: any, data: any) => {
                    if (schema) {
                        return typeof data === 'string' && data.trim() !== ''
                    }
                    else return true;
                }
            })

            ajv.addKeyword(
                {
                    keyword: "uniqueAttributesBy",
                    type: "array",
                    errors: true,

                    compile(keys: string[]) {
                        const validate = (data: any[]): boolean => {
                            const seen: Record<string, number> = {};

                            for (let i = 0; i < data.length; i++) {
                                const item = data[i];
                                for (const key of keys) {
                                    const value = item[key];
                                    if (value != null) {
                                        const uniqueKey = `${key}:${value}`;
                                        if (seen[uniqueKey] !== undefined) {
                                            // Attach error to the function itself
                                            (validate as any).errors = [
                                                {
                                                    keyword: "uniqueAttributesBy",
                                                    instancePath: `/${i}`,
                                                    schemaPath: "#/properties/attributes/uniqueAttributesBy",
                                                    message: `Duplicate ${key} "${value}" found in attributes`,
                                                    params: {
                                                        key,
                                                        value,
                                                    }
                                                } as ErrorObject
                                            ];
                                            return false;
                                        }
                                        seen[uniqueKey] = i;
                                    }
                                }
                            }

                            // Clear previous errors if validation passed
                            (validate as any).errors = null;
                            return true;
                        };

                        return validate;
                    }
                });


            // Define a custom validation keyword 'pattern'
            // ajv.addKeyword({
            //     keyword:'pattern',
            //     validate: (schema:any, data:any) => {
            //         if (typeof data !== 'string') {
            //             return true; // Skip validation for non-string properties
            //         }
            //         const regex = new RegExp(schema);
            //         return regex.test(data);
            //     },
            //     errors: false // Disable Ajv default error messages for this keyword
            // });

            // ajv.addKeyword({

            //     keyword: 'replaceEmptyStringWithNull', 
            //     validate: (schema:any, data:any)=> {
            //         if (typeof data === 'string' && data === '') {
            //           return undefined;
            //         }
            //         return true;
            //       }
            // });

            ajv.addKeyword({
                keyword: 'isGreaterThanZero',
                validate: (schema: any, data: any) => {
                    if (schema) {
                        return typeof data === 'number' && data > 0;
                    }
                    else return true;
                }
            })

            ajvErrors(ajv);
            
            const validate = ajv.compile(schema)
            const valid = validate(data);
            console.log(validate.errors)

            let error: any = "";
            if (validate.errors != null && validate.errors.length > 0) {

                error = validate.errors.length > 1 ? validate.errors[validate.errors.length - 1] : validate.errors[0]
                error = error.message || "";
            }
            return { valid: valid, error: error }
        } catch (error: any) {

            return { valid: false, error: error }
        }
    }

    public static reqValidate2 = async function name(schema: any, data: any) {
        try {



            // 1. Create and configure a single AJV instance
            const ajv = new Ajv({
                allErrors: true,
                coerceTypes: true, // Recommended for type coercion
                removeAdditional: true, // Recommended to remove extra properties
                // Add custom keywords from external libraries here
                keywords: [transform()]
            });

            // Add custom keywords and formats to the single instance
            addFormats(ajv, ["date", "time", "regex", "date-time", "email", "uuid"]);

            // Add custom 'isNotEmpty' keyword
            ajv.addKeyword({
                keyword: 'isNotEmpty',
                validate: (schema: any, data: any) => {
                    if (schema) {
                        return typeof data === 'string' && data.trim() !== '';
                    }
                    return true;
                },
                // Allows this keyword on any type of data, not just strings
                metaSchema: { type: "boolean" }
            });

            // Add custom 'uniqueAttributesBy' keyword
            ajv.addKeyword(
                {
                    keyword: "uniqueAttributesBy",
                    type: "array",
                    errors: true,

                    compile(keys: string[]) {
                        const validate = (data: any[]): boolean => {
                            const seen: Record<string, number> = {};

                            for (let i = 0; i < data.length; i++) {
                                const item = data[i];
                                for (const key of keys) {
                                    const value = item[key];
                                    if (value != null) {
                                        const uniqueKey = `${key}:${value}`;
                                        if (seen[uniqueKey] !== undefined) {
                                            // Attach error to the function itself
                                            (validate as any).errors = [
                                                {
                                                    keyword: "uniqueAttributesBy",
                                                    instancePath: `/${i}`,
                                                    schemaPath: "#/properties/attributes/uniqueAttributesBy",
                                                    message: `Duplicate ${key} "${value}" found in attributes`,
                                                    params: {
                                                        key,
                                                        value,
                                                    }
                                                } as ErrorObject
                                            ];
                                            return false;
                                        }
                                        seen[uniqueKey] = i;
                                    }
                                }
                            }

                            // Clear previous errors if validation passed
                            (validate as any).errors = null;
                            return true;
                        };

                        return validate;
                    }
                });
            // Add the 'ajv-errors' plugin for custom error messages
            ajvErrors(ajv, { keepErrors: false });


            const validate = ajv.compile(schema);
            const valid = validate(data);


            if (!valid && validate.errors) {
                const errors: string[] = validate.errors.map((err: ErrorObject) => {
                    const path = err.instancePath || "";
                    const message = err.message || "Invalid input";
                    return path ? `Path: ${path}, Message: ${message}` : message;
                });

                return {
                    valid: false,
                    error: errors[0], // first error as summary
                    errors,           // detailed list
                };
            }

            return { valid: true }


        } catch (error: any) {
            return { valid: false, error: error.message };
        }


    }

}
