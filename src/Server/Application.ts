import "reflect-metadata";
import ConfigSchema from "../config/ServerConfig.schema";
import ApiConfigSchema from "../config/ApiConfig.schema";
import { CONST_DECORATOR_FOR_MODULE_CLASSID } from "elmer-common/lib/decorators/const";
import { GetConfig } from "../common/decorators";
import { IServerConfig } from "../config/IServerConfig";
import { TypeServiceConfig } from "../common/ApiService";
import { AppService, getObjFromInstance, utils } from "elmer-common";
import { Server as WebSocketServer } from "ws";
import { Log } from "../common/Log";
import {
    CONST_SERVER_CONFIG_INITDATA,
    CONST_SERVER_CONFIG_FILENAME,
    CONST_SERVER_REQUEST_CLIENT_ID,
    CONST_API_CONFIG_FILENAME,
} from "../data/const";
import { Client, IClientInstanceInfo } from "./Client";
import { MessageHandler } from "./MessageHandler";
import { IMsgData } from "../data/IMessage";
import { Store } from "../data/Store";
import { ApiService } from "../common/ApiService";
import { IncomingMessage } from "http";


@AppService
export class Application<UseModel={}> {
    @GetConfig<IServerConfig>(CONST_SERVER_CONFIG_FILENAME, CONST_SERVER_CONFIG_INITDATA, ConfigSchema)
    ​private​ config: IServerConfig;
    @GetConfig<TypeServiceConfig>(CONST_API_CONFIG_FILENAME, {}, ApiConfigSchema)
    ​private​ apiConfig: TypeServiceConfig;

    private socket: WebSocketServer;

    private clientPool: any = {};
    private clients: IClientInstanceInfo[] = [];
    private isRetry: boolean = false;
    private retryCount: number = 0;
     // controller
    private models: any[];
    private modelPools: any = {};
    private isUseModelCalled?: boolean = false;
    private onReadyEvent?: Function;

    constructor(
        private log: Log,
        private msgHandler: MessageHandler,
        private store: Store,
        private service: ApiService
    ) {
        this.log.init();
        this.models = [];
        this.msgHandler.getModel = this.getModelInstance.bind(this);
        this.msgHandler.getAllModel = () => this.models;
        this.msgHandler.getClients = () => this.clients;
        this.msgHandler.sendToEx = this.sendTo.bind(this);
        this.msgHandler.sendToAllEx = this.sendToAll.bind(this);
        this.service.setConfig(this.apiConfig);
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
        this.socket.on("headers", this.onHeader.bind(this));
    }
    public ready(fn: Function) {
        this.onReadyEvent = fn;
        return this;
    }
    /**
     * 装载使用模块
     * @param models - 模块配置
     * @returns 
     */
    public useModel(models: {[P in keyof UseModel]: new(...args:any) => any}): Exclude<Application<UseModel>, "model"> {
        if(this.isUseModelCalled) {
            this.log.error("useModel方法不允许重复调用");
        } else {
            models && Object.keys(models as any).forEach((mKey: string) => {
                const ModelFactory = (models as any)[mKey];
                ModelFactory.invokeName = mKey;
                ModelFactory.modelId = utils.guid();
                AppService(ModelFactory);
                this.models.push(ModelFactory);
            });
        }
        return this;
    }
    invoke<NM extends keyof UseModel, T={}>(
        model: NM, fnName: Exclude<keyof UseModel[NM], "onMessage"|"options"|"sendToAll">, ...args: any[]): T|null|undefined {
        let modelObj: any;
        for(const modelFactory of this.models) {
            if(modelFactory.invokeName === model) {
                modelObj = this.getModelInstance(modelFactory);
                break;
            }
        }
        if(!modelObj) {
            throw new Error("未找到调用模块。");
        }
        if(typeof modelObj[fnName] === "function") {
            return modelObj[fnName].apply(modelObj, args);
        }
        return undefined;
    }
    public sendToAll<T={}>(msgData: {[ P in Exclude<keyof IMsgData<T>, "toUsers"|"fromUser">]?: IMsgData<T>[P]}): void {
        this.clients.forEach((info: IClientInstanceInfo) => {
            const clientId = info.clientId;
            const requestId = info.classId;
            const requestObjs: any = this.clientPool[clientId] || {};
            const clientObj: Client = requestObjs[requestId];
            if(clientObj) {
                const msgId: string = msgData.msgId || "msg_" + utils.guid();
                clientObj.send({
                    ...msgData,
                    fromUser: "ApplicationServer",
                    msgId
                } as any);
            } else {
                console.log(requestObjs);
            }
        });
    }
    public sendTo<T={}>(toUsers: string[], msgData: {[ P in Exclude<keyof IMsgData<T>, "toUsers">]: IMsgData<T>[P]}): void {
        this.clients.forEach((info: IClientInstanceInfo) => {
            const clientId = info.clientId;
            const requestId = info.classId;
            if(toUsers.includes(clientId)) {
                const requestObjs: any = this.clientPool[clientId];
                const clientObj: Client = requestObjs[requestId];
                const msgId: string = msgData.msgId || "msg_" + utils.guid();
                clientObj.send({
                    ...msgData,
                    fromUser: "ApplicationServer",
                    msgId
                } as any);
            }
        });
    }
    public sendToEx(toUser: string, data: any): Promise<any> {
        for(const info of this.clients) {
            const clientId = info.clientId;
            const requestId = info.classId;
            if(toUser === clientId ) {
                const requestObjs: any = this.clientPool[clientId];
                const clientObj: Client = requestObjs[requestId];
                return this.msgHandler.sendToExAsync(clientObj, data);
            }
        }
        return Promise.reject({ message: "Lost connection"});
    }
    private getModelInstance(modelFactory: new(...args:any[])=>any): void {
        const modelObj = getObjFromInstance(modelFactory, this);
        const uid = (modelFactory as any).modelId;
        if(!this.modelPools[uid]) {
            this.mountModel(modelObj);
            this.modelPools[uid] = modelObj;
        }
        return modelObj;
    }
    private mountModel(modelObj: any): void {
        modelObj.options = {
            sendToAll: this.sendToAll.bind(this),
            sendTo: this.sendTo.bind(this)
        };
        modelObj.invoke = this.invoke.bind(this);
        modelObj.sendToEx = this.sendToEx.bind(this);
        modelObj.sendTo = this.sendTo.bind(this);
        modelObj.log = this.log;
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
        typeof this.onReadyEvent === "function" && this.onReadyEvent.call(this);
    }
    private onConnection(client: WebSocket, req: IncomingMessage) {
        const requestClientId = "ws_sev_req_" + utils.guid();
        const requestClientIp = req.connection?.remoteAddress;
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
        clientObj.ip = requestClientIp;
        clientObj.listen();
        this.log.info("客户端接入：" + requestClientId);
        return clientObj;
    }
    private releaseClient(client: Client) {
        const requestId = client.uid;
        const requestPools = this.clientPool[requestId];
        const clientId = Reflect.getMetadata(CONST_DECORATOR_FOR_MODULE_CLASSID, client.constructor);
        if(this.modelPools) {
            Object.keys(this.modelPools).forEach((mid: string) => {
                const modelObj = this.modelPools[mid];
                typeof modelObj.onClientClose === "function" && modelObj.onClientClose(client.uid);
            })
        }
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
    private onHeader(headers: string[]) {

    }
}