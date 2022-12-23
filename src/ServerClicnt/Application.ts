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
import { MessageHandler } from "./MessageHandler";
import { IMsgData } from "../data/IMessage";
import { Store } from "../data/Store";

interface IClientInstanceInfo {
    clientId: string;
    classId: string;
}

@AppService
export class Application {
    @GetConfig<IServerConfig>(CONST_SERVER_CONFIG_FILENAME, CONST_SERVER_CONFIG_INITDATA, ConfigSchema)
    ​private​ config: IServerConfig;

    private socket: WebSocketServer;

    private clientPool: any = {};
    private clients: IClientInstanceInfo[] = [];
    private isRetry: boolean = false;
    private retryCount: number = 0;

    private controllers: any[] = [];

    constructor(
        private log: Log,
        private msgHandler: MessageHandler,
        private store: Store
    ) {
        this.log.init();
    }
    public storeInit<T={}>(initData:T): void {
        this.store.storeInit(initData as any);
    }
    public listen() {
        this.socket = new WebSocketServer({
            host: this.config.host,
            port: this.config.port
        });
        this.socket.on("listening", this.socketListening.bind(this));
        this.socket.on("connection", this.onConnection.bind(this));
        this.socket.on("error", this.onError.bind(this));
        this.socket.on("close", this.onClose.bind(this));
    }
    public controller(Factory: new(...args:any[]) => any): Application {
        this.controllers.push(Factory);
        return this;
    }
    public sendToAll<T={}>(msgData: {[ P in Exclude<keyof IMsgData<T>, "toUsers"|"fromUser">]: IMsgData<T>[P]}): void {
        this.clients.forEach((info: IClientInstanceInfo) => {
            const requestId = info.clientId;
            const clientId = info.classId;
            const requestObjs: any = this.clientPool[requestId];
            const clientObj: Client = requestObjs[clientId];
            clientObj.send({
                ...msgData,
                fromUser: "ApplicationServer"
            } as any);
        });
    }
    private onClose(): void {
        // release all client
        this.clients.forEach((info: IClientInstanceInfo) => {
            const requestId = info.clientId;
            const clientId = info.classId;
            const requestObjs: any = this.clientPool[requestId];
            const clientObj: Client = requestObjs[clientId];
            this.releaseClient(clientObj);
        });
        this.clientPool = {};
        this.clients = [];
        if(!this.isRetry) {
            if(this.retryCount < 10) {
                this.isRetry = true;
                const time = setTimeout(() => {
                    this.socket.removeAllListeners();
                    this.listen();
                    clearTimeout(time);
                }, 3000);
            } else {
                this.log.error("尝试重新连接失败。[SEV_RETRY_TIMEOUT]");
            }
        }
    }
    private onError(err:Error): void {
        this.log.error(`[${(err as any).code}] ${err.stack}`);
    }
    private socketListening() {
        this.isRetry = false;
        this.retryCount = 0;
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
        const clientClassId = Reflect.getMetadata(CONST_DECORATOR_FOR_MODULE_CLASSID, Client);
        this.clients.push({
            clientId: requestClientId, // 用于查找Client
            classId: clientClassId // 用于查找对应的Client instance
        });
        clientObj.uid = requestClientId;
        clientObj.dispose = this.releaseClient.bind(this);
        clientObj.msgHandler = this.msgHandler;
        clientObj.listen();
        this.log.info("客户端接入：" + requestClientId);
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