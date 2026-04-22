import * as crypto from 'crypto'

export class HashingALgorithm {

    hashedValue = "";



    public hashPassword(toHashString: any) {
        const salt:any = process.env.HASHING_SALT;
        this.hashedValue = crypto.pbkdf2Sync(toHashString, salt,
            1000, 64, `sha512`).toString(`hex`);
    }

    public validateHashString(value: any) {
        const salt:any = process.env.HASHING_SALT;
        const hash = crypto.pbkdf2Sync(value,salt,
            1000, 64, `sha512`).toString(`hex`);
        return this.hashedValue === hash
    }
}