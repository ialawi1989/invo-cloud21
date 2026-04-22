

import Decimal from 'decimal.js'
import { createHash } from "crypto";
import { Request } from 'express';
import jwt from "jsonwebtoken";

export class Helper {
    public static signPendingLoginToken(payload: { userId: string; termsVersion: string ,ip?:string|null,user_agent?:string|null }) {
        const ttl = Number(process.env.PENDING_TTL_SECONDS ?? 300);
        return jwt.sign(payload, process.env.JWT_PENDING_SECRET as string, { expiresIn: ttl });
    }

    public static verifyPendingLoginToken(token: string) {
        return jwt.verify(token, process.env.JWT_PENDING_SECRET as string) as { userId: string; termsVersion: string ,ip?:string|null,user_agent?:string|null };
    }
    // static roundNum(b: number ,afterDecimal:number) {

    //     return Number((b).toFixed(afterDecimal))
    // }
    // static sub(b: number, c: number , afterDecimal:number) {
    //     if (c == null)
    //         return b;
    //     return Number((b - c).toFixed(afterDecimal))
    // }

    // static add(b: number, c: number, afterDecimal:number) {

    //     return Number((b + c).toFixed(afterDecimal))
    // }

    // static multiply(b: number, c: number,afterDecimal:number) {

    //     return Number((b * c).toFixed(afterDecimal))
    // }

    // static division(b: number, c: number,afterDecimal:number) {
    //     return Number((b / c).toFixed(afterDecimal))
    // }
    static getClientIp(req: Request) {
        // behind proxy? ensure app.set("trust proxy", true)
        const xf = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
        return xf || req.socket.remoteAddress || null;
    }
    static getCountryCode(contact: string): string {
        // Match + followed by 1 to 3 digits at the start
        const match = contact.match(/^\+\d{1,3}/);
        return match ? match[0] : "";
    }

    static roundNum(b: number, afterDecimal: number | null = null) {

        // return Number((b).toFixed(afterDecimal))
        const a = new Decimal(b);
        // const d = new Decimal(c);
        const res: any = a
        return +res

    }

    static roundDecimal(b: number, afterDecimal: number) {
        if (!afterDecimal) {
            const warningMessage = `[Settings Warning] Missing 'afterDecimal'`;
            console.warn(warningMessage);
            // captureException({
            //     level: "error",
            //     tags: { context: `After Decimal ${afterDecimal}` },
            // });
        }
        return Number((b).toFixed(afterDecimal))
        // console.log( typeof b)
        // console.log( "roundNumber" , b)
        // const a = new Decimal(b);
        // const d = new Decimal(c);
        // const res:any =  a
        // return  +res

    }

    static sub(b: number, c: number, afterDecimal: number | null = null) {
        if (c == null)
            return b;
        // return Number((b - c).toFixed(afterDecimal))
        const a = new Decimal(b);
        const d = new Decimal(c);
        const res: any = a.minus(d)
        return +res

    }

    static add(b: number, c: number, afterDecimal: number | null = null) {

        // return Number((b + c).toFixed(afterDecimal)) 

        const a = new Decimal(b);
        const d = new Decimal(c);
        const res: any = a.plus(d)
        return +res
    }

    static multiply(b: number, c: number, afterDecimal: number | null = null) {

        // return Number((b * c).toFixed(afterDecimal))
        const a = new Decimal(b);
        const d = new Decimal(c);
        const res: any = a.mul(d)
        return +res
    }

    static division(b: number, c: number, afterDecimal: number | null = null) {
        // return Number((b / c).toFixed(afterDecimal))
        const a = new Decimal(b);
        const d = new Decimal(c);
        const res: any = a.div(d)
        return +res
    }


    static addWithRounding(b: number, c: number, afterDecimal: number) {
        return Number((b + c).toFixed(afterDecimal))

    }


    static createGuid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }
    public static trim_nulls(data: any) {
        let y;
        for (const x in data) {
            y = data[x];
            if (y === "null" || JSON.stringify(y) === "{}" || y === null || y === "" || typeof y === "undefined" || (y instanceof Object && Object.keys(y).length == 0)) {
                delete data[x];

            }
            if (y instanceof Object) y = Helper.trim_nulls(y);
        }
        return data;
    }

    public static async generateCode(length: any) {
        // Declare a string variable 
        // which stores all string
        const string = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let OTP = '';

        // Find the length of string
        const len = string.length;
        for (let i = 0; i < length; i++) {
            OTP += string[Math.floor(Math.random() * len)];
        }
        return OTP;
    }

    public static async generateOTPCode(length: any) {
        // Declare a string variable 
        // which stores all string
        const string = '0123456789';
        let OTP = '';

        // Find the length of string
        const len = string.length;
        for (let i = 0; i < length; i++) {
            OTP += string[Math.floor(Math.random() * len)];
        }
        return OTP;
    }
    public static async renameKey(obj: any) {
        for (const key in obj) {
            if (key.startsWith('_')) {
                const newKey: any = key.split('_')[1];
                obj[newKey] = obj[key];
                delete obj[key];
            }
        }
        return obj
    }

    public static async generateNumber(lastNumber: string) {
        try {

            const temp = lastNumber.split("-");
            const char = temp[0];
            let number = +temp[1]
            number++;
            const generatedNumber = char + '-' + number.toString()
            return generatedNumber;
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    public static async roundNumbers(afterDecimal: number, obj: any) {
        try {
            for (const key in obj) {
                const element: any = obj[key];
                if ((typeof element) == "number") {
                    const number: any = Number((element).toFixed(afterDecimal))
                    obj[key] = number
                }
            }
        } catch (error: any) {
            throw new Error(error.message)
        }
    }

    public static escapeSQLString(str: String) {
        return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
            switch (char) {
                case "\0":
                    return "\\0";
                case "\x08":
                    return "\\b";
                case "\x09":
                    return "\\t";
                case "\x1a":
                    return "\\z";
                case "\n":
                    return "\\n";
                case "\r":
                    return "\\r";
                case "\"":
                case "'":
                case "\\":
                case "%":
                    return "\\" + char; // prepends a backslash to backslash, percent,
                // and double/single quotes
                default:
                    return char;
            }
        });
    }

    public static checkAndParseArrayOpjects(obj: any) {
        try {

            let temp = obj
            return JSON.parse(temp)
            // obj.forEach((element:any) => {
            //     newArray.push(JSON.parse(element))
            // });
            // console.log("newwwwwwwww",newArray)


        } catch (error) {
            console.log(obj)
            // If an error occurs, the object is not stringifiable
            return obj; // or handle accordingly
        }
    }
    static generate6Code(id: string) {

        const hash = createHash("sha256").update(id).digest();
        return this.bytesToBase62(hash).slice(0, 6);
    }

    private static bytesToBase62(buffer: Buffer): string {
        let digits = [0];
        const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

        for (const byte of buffer) {
            let carry = byte;
            for (let i = 0; i < digits.length; i++) {
                const val = digits[i] * 256 + carry;
                digits[i] = val % 62;
                carry = Math.floor(val / 62);
            }
            while (carry > 0) {
                digits.push(carry % 62);
                carry = Math.floor(carry / 62);
            }
        }
        return digits.reverse().map(d => BASE62[d]).join("");
    }

}