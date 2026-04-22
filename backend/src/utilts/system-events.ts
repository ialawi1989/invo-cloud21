import { publishSqsEvent } from "@src/AWS-SERVICES/sqsPublisher";
import { EventEmitter } from "events";

const systemEventEmitter = new EventEmitter();

export function onEvent<T extends object>(
    eventName: string,
    handler: (payload: T) => Promise<any>
) {
    systemEventEmitter.on(eventName, async (payload) => {
        try {
            await handler(payload);
        } catch (err) {
            console.error(`Error in handler for ${eventName}:`, err);
        }
    });

    //TODO: to use sqs instead use the code below
    //   (async () => {
    //     try {
    //       if (process.env.localWebHookUrl) {
    //         const res = await Subscribe(
    //           "Invoice-paid",
    //           //TODO: get from proc.env...
    //           process.env.localWebHookUrl + '/systemEvents/Invoice-paid'
    //         );
    //         console.log("Subscribe result:", res);
    //       }
    //     } catch (err) {
    //       console.error("Subscribe failed:", err);
    //     }
    //   })();
}

export async function publishEvent<T extends object>(
    eventName: string,
    payload: T,
    delaySeconds?: number
) {
    if (delaySeconds && delaySeconds > 0) {
        setTimeout(() => {
            systemEventEmitter.emit(eventName, payload);
        }, delaySeconds * 1000);
    } else {
        setTimeout(() => {
            systemEventEmitter.emit(eventName, payload);
        }, 1);
    }
    
    return publishSqsEvent(eventName, payload, delaySeconds);
}