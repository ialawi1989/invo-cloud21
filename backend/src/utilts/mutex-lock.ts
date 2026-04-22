import { Mutex } from "async-mutex";

const mutexLock = new Mutex();
//** runExclusive : automatically releases */
export async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  return mutexLock.runExclusive(async () => {
    return await fn();
  });
}