import { Logger } from "@src/utilts/invoLogger";
import { LoggerHelper } from "@src/utilts/logger";
import { stringMap } from "aws-sdk/clients/backup";

type SocketHandler = (data: any, callback: CallableFunction) => Promise<void>;

/**
 * Wraps a Socket.IO handler to automatically:
 * - Set Logger context (branchId, event, payload)
 * - Add breadcrumb
 * - Catch errors and send to logger
 */
export function logPosErrorWithContext(
  error: any,
  data: any,
  branchId?: string | null,
  companyId?: string | null,
  eventName?: string
) {
  // Build context object
  const context: any = {

    request: {
      method: "SOCKET_EVENT",
      route: eventName ?? "unknown_event",
      body: data,
    },
  };

  // Include company only if companyId is provided
  if (companyId) {
    context.company = { id: companyId };
  }

  if (branchId) {
    context.branch = { id: branchId };
  }


    context.tags = {project:"POS"};
  
  Logger.runWithContext(context, () => {
    Logger.error(error, { eventName, branchId, companyId });
  });
}