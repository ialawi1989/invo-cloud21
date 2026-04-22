import { Server } from 'socket.io'
import { sign, verify } from 'jsonwebtoken'
import { SocketEvents } from './repo/socket/socketEvents';
import { RedisClient } from './redisClient';
import { Helper } from './utilts/helper';
import { terminalRepo } from './repo/app/terminal/terminal.repo';
import { createAdapter } from 'socket.io-redis';
import redis from 'redis';
import { createClient } from "redis";





// import { DriverRepo } from './repo/deliveryApp/driver';
// import { DriverSocketRepo } from './repo/socket/driver.socket';
import { decode } from 'punycode';
import { DriverSocketEvents } from './repo/socket/delivery/driverSocketEvents';
import { DriverSocketHandler } from './repo/socket/delivery/authenticateDriverSocket';
import { BranchesRepo } from './repo/admin/branches.repo';
// import { DriverSocketEvents } from './repo/socket/driverSocketEvents';


let instance: SocketController;

export class SocketController {
    //singleton
    pendingTerminals: any[] = [];
    io: Server;
    redisClient: RedisClient;

    K = { //keys
        branchOnline: (b: string) => `branch:online:${b}`,  // value "1" 
    };

    constructor(server: any) {

        this.redisClient = RedisClient.getRedisClient();
        this.io = new Server(server, {
            cors: { origin: "*" }
        })

        const redisAdapter = createAdapter(process.env.REDIS_CLIENT_URL as string)
        this.io.adapter(redisAdapter);

        this.registerBaseListeners()
        //authinticated namespace
        this.registerApiNamespace()
        this.registerDriverNamespace()



    }

    static createInstance(server: any) {
        if (instance == null) {
            instance = new SocketController(server);
        }
        return instance;
    }

    static getInstance() {
        return instance;
    }



    static responseToTerminal(data: any) {

        try {


            const terminal = instance.pendingTerminals.find(f => f.data.terminalId == data.terminalId);


            clearInterval(terminal.timerKey)
            instance.io.in(terminal.client.id).emit("terminalAuthinticated", JSON.stringify({ code: data.apiToken }))
            // terminal.client.emit("terminalAuthinticated", JSON.stringify({ code: data.apiToken }));
            instance.pendingTerminals.splice(instance.pendingTerminals.indexOf(terminal), 1)
        } catch (error: any) {
            console.log(error)

            throw new Error(error)
        }

    }


    private registerBaseListeners() {

        this.io.on('connection', (client) => {
            try {
                client.emit('message', 'Connected to server :' + JSON.stringify(process.env.pm_id));

                client.on('message', (msg) => {
                    console.log(`Received message: ${msg}`);
                    this.io.emit('message', msg + 'cc :' + JSON.stringify(process.env.pm_id)); // Broadcast message to all clients
                });




                client.once("newTerminal", async (data) => {
                    try {
                        console.log("testing")

                        const encryptedData = sign(data, process.env.Terminal_TOKEN_SECRET as string, { expiresIn: "5m" });
                        const code = await Helper.generateCode(6);
                        const url = terminalRepo.getConnectTerminalUrl(code);
                        const index = this.pendingTerminals.indexOf((f: any) => f.data.terminalId == data.terminalId);
                        data.terminalCode = code;


                        if (index > -1) {
                            this.pendingTerminals[index].client = client
                            client.emit('terminalToken', code)
                            client.emit('terminalConnection', JSON.stringify({ url: url?.data }))

                        } else {
                            client.emit('terminalToken', code)
                            client.emit('terminalConnection', JSON.stringify({ url: url?.data }))

                            const timerKey = setInterval(async () => {
                                const code = await Helper.generateCode(6);
                                data.terminalCode = code;
                                const url = terminalRepo.getConnectTerminalUrl(code);
                                const encryptedData = sign(data, process.env.Terminal_TOKEN_SECRET as string, { expiresIn: "5m" });
                                client.emit('terminalToken', code);
                                client.emit('terminalConnection', JSON.stringify({ url: url?.data }))

                            }, 1000 * 60 * 10) //5 min
                            const terminalData = instance.pendingTerminals.find(f => f.data.terminalId == data.terminalId);
                            //clear old interval
                            if (terminalData) {
                                clearInterval(terminalData.timerKey)
                                instance.pendingTerminals.splice(instance.pendingTerminals.indexOf(terminalData), 1)
                            }
                            this.pendingTerminals.push({ client: client, data: data, timerKey: timerKey });
                        }

                        client.once('disconnect', async (reason: any) => {
                            //remove to clinetId

                            client.emit("error", reason);
                            //;
                            //setExtra("branchId", branchId);
                            //setExtra("reason", reason);
                            const terminalData = instance.pendingTerminals.find(f => f.data.terminalId == data.terminalId);
                            //clear interval
                            if (terminalData) {
                                clearInterval(terminalData.timerKey)
                            }
                            instance.pendingTerminals.splice(instance.pendingTerminals.indexOf(terminalData), 1)

                        })
                    } catch (error) {
                        console.log(error)

                    }
                })
            } catch (error) {
                console.log(error)
        

            }

        });
    }

    private async clearStaleBranchKeys() {
        const keys = await this.redisClient.client!.keys('branch:online:*');
        for (const key of keys) await this.redisClient.client!.del(key);

        const socketKeys = await this.redisClient.client!.keys('Socket*');
        for (const key of socketKeys) await this.redisClient.client!.del(key);
    }

    private _apiNsReady = false;

    private registerApiNamespace() {
        if (this._apiNsReady) return; // Prevent duplicate registration
        this._apiNsReady = true;
        //NOTE: Remove This if we use Multi server and use the TTL for the branchOnline
        this.clearStaleBranchKeys();
        const BRANCH_TTL_SECONDS = 60; //use this to set branchOnline Expire and add heartbeat
        const apiNs = this.io.of('/api');

        apiNs.on('connection', async (client) => {
            try {
                const token =
                    client.handshake.auth?.token ||
                    (client.handshake.headers as any)?.token;

                if (!token) {
                    client.emit('disconnectClient', 'Unauthorized Access');
                    return client.disconnect(true);
                }

                let decoded: any;

                try {
                    decoded = verify(token, process.env.Terminal_TOKEN_SECRET as string);
                } catch {
                    client.emit('disconnectClient', 'Invalid token');
                    return client.disconnect(true);
                }

                const branchId: string = decoded.branchId;
                const deviceId: string = decoded.terminalId;
                const cacheKey = `Socket${branchId}isActive`;
                // const isActive = await BranchesRepo.hasActiveBranches(null, branchId);
                // if (!isActive) {
                //     client.emit('disconnectClient', 'Branch not active');
                //     const stillOwner = await this.redisClient.client?.get(`Socket${branchId}`);
                //     if (stillOwner === client.id) {
                //         await this.redisClient.client?.del(`Socket${branchId}`);
                //         await this.redisClient.client?.del(this.K.branchOnline(branchId));
                //     }
                //     client.disconnect(true);
                //     await this.redisClient.client?.set(cacheKey, JSON.stringify({ isActive }), 'EX', 3600);

                //     return;
                // }

                const originalOn = client.on.bind(client);
                client.on = (event: string, handler: (...args: any[]) => any) => {
                    const wrapped = async (...args: any[]) => {
                        try {

                            // Check cached branch active status
                            const cached = await this.redisClient.client?.get(cacheKey);
                            if (cached) {
                                const { isActive } = JSON.parse(cached);
                                if (!isActive) {
                                    client.emit('disconnectClient', 'Branch not active');
                                    const stillOwner = await this.redisClient.client?.get(`Socket${branchId}`);
                                    if (stillOwner === client.id) {
                                        await this.redisClient.client?.del(`Socket${branchId}`);
                                        await this.redisClient.client?.del(this.K.branchOnline(branchId));
                                    }
                                    client.disconnect(true);
                                    return;
                                }
                                return handler.apply(client, args);
                            }

                            // Fetch fresh status
                            const isActive = await BranchesRepo.hasActiveBranches(null, branchId);
                            if (!isActive) {
                                client.emit('disconnectClient', 'Branch not active');
                                const stillOwner = await this.redisClient.client?.get(`Socket${branchId}`);
                                if (stillOwner === client.id) {
                                    await this.redisClient.client?.del(`Socket${branchId}`);
                                    await this.redisClient.client?.del(this.K.branchOnline(branchId));
                                }
                                client.disconnect(true);
                                return;
                            }

                            // Cache active status for 1 hour
                            await this.redisClient.client?.set(cacheKey, JSON.stringify({ isActive }), 'EX', 3600);

                            // Call the original event handler
                            return handler.apply(client, args);
                        } catch (err) {
                            console.error(`[SocketWrapper] Error on event ${event}:`, err);
                            client.emit('server_error', 'Internal server error');
                        }
                    };

                    return originalOn(event, wrapped);


                };

                // Read current state BEFORE taking ownership
                const [oldSocketId, prevDeviceId, onlineExistsInt] = await Promise.all([
                    this.redisClient.client?.get(`Socket${branchId}`),
                    this.redisClient.client?.get(`Device${branchId}`),
                    this.redisClient.client?.exists(this.K.branchOnline(branchId)),
                ]);
                console.log(prevDeviceId, deviceId);
                const branchOnlineExists = (onlineExistsInt ?? 0) > 0;
                const sameDevice = prevDeviceId && prevDeviceId === deviceId;

                // If another socket owns it, disconnect that one first (same namespace)
                if (oldSocketId && oldSocketId !== client.id && oldSocketId !== 'undefined') {
                    const adapter: any = apiNs.adapter;
                    if (typeof adapter?.remoteDisconnect === 'function') {
                        try {
                            if (!sameDevice) {
                                //disconnect old device
                                apiNs.to(oldSocketId).emit('disconnectClient', { reason: 'duplicate_session' })
                            }
                        } catch { }
                    } else {
                        const oldClient = apiNs.sockets.get(oldSocketId);
                        if (oldClient) {
                            oldClient.disconnect(true);
                        } else {
                            if (!sameDevice) {
                                //disconnect old device
                                apiNs.to(oldSocketId).emit('disconnectClient', { reason: 'duplicate_session' });
                            }
                        }
                    }
                }

                // Become the owner
                await this.redisClient.client?.set(`Socket${branchId}`, client.id);
                await this.redisClient.client?.set(`Device${branchId}`, deviceId);
                await this.redisClient.client?.set(this.K.branchOnline(branchId), '1');

                // Your app events (ensure it doesn't double-bind)
                await SocketEvents.events(client, branchId, decoded);

                // Fire connect_successfully iff:
                //  A) socket changed (oldSocketId !== client.id), OR
                //  B) branchOnline was not set before (first real online)
                if ((!branchOnlineExists || oldSocketId !== client.id)) {
                    client.emit('connect_successfully');
                }

                // Cleanup only if this socket is still the owner when it disconnects
                client.once('disconnect', async () => {
                    try {
                        const stillOwner = await this.redisClient.client?.get(`Socket${branchId}`);
                        if (stillOwner === client.id) {
                            await this.redisClient.client?.del(this.K.branchOnline(branchId));
                            await this.redisClient.client?.del(`Socket${branchId}`);
                        }
                    } catch (e) {
                        console.error('[cleanup]', e);
                    }
                });

            } catch (err: any) {
 
                client.emit('server_error', 'Unexpected server error');
                client.disconnect(true);
            }
        });
    }

    private registerDriverNamespace() {
        this.io.of('/driver').use(DriverSocketHandler.authenticate).on('connection', async (client) => {
            //auth
            try {

                const employeeId = client.data.user.employeeId;
                let employeeOldClientId = await this.redisClient.get("Socket" + employeeId)
                if (employeeOldClientId && employeeOldClientId !== client.id) {
                    const oldSocketId = employeeOldClientId;

                    // If you are using the Redis adapter, you can disconnect remotely:
                    // @ts-expect-error - remoteDisconnect is available only with redis-adapter
                    if (typeof this.io.of("/").adapter?.remoteDisconnect === "function") {
                        const adapter = this.io.of("/").adapter as any; // <-- assert any
                        await adapter.remoteDisconnect(oldSocketId, true);
                    } else {
                        // If Redis adapter is not in use, try to find the local socket
                        const oldClient = this.io.of("/").sockets.get(oldSocketId);

                        if (oldClient) {
                            oldClient.disconnect(true); // force disconnect locally
                        } else {
                            // As a fallback, emit an event (works only if still connected locally)
                            this.io.to(oldSocketId).emit("session_kicked", { reason: "duplicate_session" });
                        }
                    }
                }
                await this.redisClient.set("Socket" + employeeId, client.id)
                await DriverSocketEvents.events(client, employeeId);
                client.emit("connect_successfully");


                client.once('disconnect', async (reason: any) => {
                    //remove to clinetId
                    console.log("disconnect", reason)
                    client.emit("error", reason);

                    //;
                    //setExtra("branchId", branchId);
                    //setExtra("reason", reason);

                    this.redisClient.client?.del("Socket" + employeeId)
                })


            } catch (error: any) {

                console.log("disconnect", error)
      
      

                client.emit("error", error);
                client.disconnect(true)
            }

        });
    }

}