import { Lazy } from "./Lazy";
import ioredis from 'ioredis';
const redisUrl = process.env.QUEUE_REDIS_CLIENT_URL;
if (!redisUrl) throw new Error('Missing QUEUE_REDIS_CLIENT_URL env variable');
export const queueRedisConnection = new Lazy<ioredis>(() => {
  const con =new ioredis((redisUrl), {
  maxRetriesPerRequest: null,

  retryStrategy: function (times) {
    return Math.max(Math.min(Math.exp(times), 20000), 1000)
  },
});
con.on('error',(err)=>{
  console.log(err)
});
return con;
});