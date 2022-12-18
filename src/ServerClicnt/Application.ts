import "reflect-metadata";
import ConfigSchema from "../config/ServerConfig.schema";
import { CONST_DECORATOR_FOR_MODULE_CLASSID } from "elmer-common/lib/decorators/const";
import { GetConfig } from "../common/decorators";
import { IServerConfig } from "../config/IServerConfig";
import { AppService, getObjFromInstance, utils } from "elmer-common";
import { Server as WebSocketServer } from "ws";
import { Log } from "../common/Log";
import {
    CONST_SERVER_CONFIG_INITDATA,
    CONST_SERVER_CONFIG_FILENAME,
    CONST_SERVER_REQUEST_CLIENT_ID
} from "../data/const";
import { Client } from "./Client";

@AppService
export class Application {
    @GetConfig<IServerConfig>(CONST_SERVER_CONFIG_FILENAME, CONST_SERVER_CONFIG_INITDATA, ConfigSchema)
    ​private​ config: IServerConfig;
    private socket: WebSocketServer;

    private clientPool: any = {};

    constructor(
        private log: Log
    ) {
        this.log.init();
    }
    listen() {
        this.socket = new WebSocketServer({
            host: this.config.host,
            port: this.config.port
        });
        this.socket.on("listening", this.socketListening.bind(this));
        this.socket.on("connection", this.onConnection.bind(this));
    }
    private socketListening() {
        this.log.info(`Application running at: ws://${this.config.host}:${this.config.port}`);
    }
    private onConnection(client: WebSocket) {
        const requestClientId = "ws_sev_req_" + utils.guid();
        const clientObj: Client = getObjFromInstance(Client, this, (Factory: new(...args:any[]) => any, opt) => {
            const classId = opt.uid;
            let requestPool = this.clientPool[requestClientId];
            let obj = requestPool ? requestPool[classId] : null;
            opt.shouldInit = true;
            if(!this.clientPool[requestClientId]) {
                requestPool = {};
                this.clientPool[requestClientId] = requestPool;
            }
            if(!obj) {
                Reflect.defineMetadata(CONST_SERVER_REQUEST_CLIENT_ID, requestClientId, Factory);
                obj = new Factory(...opt.args);
                obj.socket = client;
                requestPool[classId] = obj;
            }
            return obj;
        });
        clientObj.uid = requestClientId;
        clientObj.dispose = this.releaseClient.bind(this);
        clientObj.listen();
        return clientObj;
    }
    private releaseClient(client: Client) {
        const requestId = client.uid;
        const requestPools = this.clientPool[requestId];
        const clientId = Reflect.getMetadata(CONST_DECORATOR_FOR_MODULE_CLASSID, client.constructor);
        if(requestPools) {
            Object.keys(requestPools).forEach((classId: string) => {
                const obj = requestPools[classId];
                const objId = Reflect.getMetadata(CONST_DECORATOR_FOR_MODULE_CLASSID, obj.constructor);
                if(objId !== clientId) {
                    typeof obj.dispose === "function" && obj.dispose();
                    requestPools[classId] = null;
                    delete requestPools[classId];
                }
            });
            requestPools[clientId] = null;
            delete this.clientPool[requestId];
        }
        this.log.info("连接已断开:" + requestId);
    }
}