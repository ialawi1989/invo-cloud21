import { ResponseData } from "@src/models/ResponseData";
import { RedisClient } from "@src/redisClient"

export class RedisCaching {


    /** USE ONLY WHEN DATA ARE NOT ALREADY CATCHED + OR NOT EXIT */
    public static async setCatchData(key: string, value: any,expireAt: number | null = null) {
        try {
            let redisClient = RedisClient.getRedisClient();
            await redisClient.set(key, JSON.stringify(value),expireAt);
        } catch (error: any) {
            throw new Error(error)
        }
    }

    /** GET CATCHED DATA */
    public static async getCatchingData(key: string) {
        try {
            let redisClient = RedisClient.getRedisClient();
            let data = await redisClient.get(key)
            if (data == null) {
                return new ResponseData(false, "", []);
            }else{
                return new ResponseData(true,"",data);
            }
        } catch (error: any) {
            throw new Error(error)
        }
    }


    /** THE FOLLOWING IS TO DELETE CATCHED DATA WHEN EVER THERE IS AN EDIT ON DATA  */
    public static async deleteCatchedData(key: string) {
        try {
            let redisClient = RedisClient.getRedisClient();
            await redisClient.deletKey(key)
        } catch (error: any) {
            throw new Error(error)
        }
    }
}