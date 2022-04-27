import { Base } from "./Base";
import { TypeWebclientConfig, TypeWebClientOptions, TypeMsgData, TypeBaseModelMethod } from "./ISocket";
import WSWebSocket, { OpenEvent } from "ws";
import { utils } from "elmer-common";
import { WebClientModel } from "./WebClientModel";
import { callModelApi, callModelHandleMsg } from "./decorators";

type TypeOverrideConnect = {
    host: string;
    port: number;
};


export class WebClient<UseModel={}> extends Base {
    private config: TypeWebclientConfig;
    private socket: WebSocket;
    private isConnected: boolean = false;
    private models: (new(...args: any[]) => any)[] = [];
    private modelObjs: any = {};
    private retryTimer: any;
    private retryCount: number = 0;
    private retryTimeoutCount: number = 5;
    private startConnected?: boolean = false;
    private autoConnect: boolean = false;
    private lastBeatTime: number = 0;
    private beatTimer: any;
    private msgHooks: any = {};
    constructor(config: TypeWebClientOptions<UseModel>) {
        super();
        this.models = {
            ...(config.models || {}) as any,
            "wct_ee63fe05-83dd-ac39-9874-bf36b663": WebClientModel
        };
        this.config = {
            host: config.host,
            port: config.port
        };
        this.retryTimeoutCount = config.retryTime || 5;
        this.autoConnect = config.autoConnect || false;
         
        if(this.models.length > 0) {
            for(const Factory of this.models) {
                if(utils.isEmpty((Factory as any).uid)) {
                    throw new Error("定义Model缺少uid静态类属性设置。");
                }
            }
        }
    }
    start(isRetry?: boolean, connect?: TypeOverrideConnect) {
        const host = connect?.host || this.config.host;
        const port = connect?.port || this.config.port;
        const connectionString = `ws://${host}:${port}`;
        if(!isRetry && this.retryTimer) {
            clearInterval(this.retryTimer);
        }
        this.startConnected = true;
        this.socket = this.createSocket(connectionString);
        this.socket.addEventListener("message", this.onMessage.bind(this));
        this.socket.addEventListener("open", this.onWebsocketOpen.bind(this));
        this.socket.addEventListener("close", this.onWebsocketClose.bind(this));
        this.socket.addEventListener("error", this.onWebsocketError.bind(this));
        this.startBeatListen();
    }
    close() {
        this.autoConnect = false;
        this.beatTimer && clearInterval(this.beatTimer);
        this.retryTimer && clearInterval(this.retryTimer);
        this.isConnected && this.socket.close();
    }
    get isConnect():boolean {
        return this.isConnected;
    }
    callApi<M extends keyof UseModel>(model: M, method: Exclude<keyof UseModel[M], TypeBaseModelMethod>, ...args:any[]): any {
        const TargetModel:any = this.models[model as any];
        if(TargetModel) {
            const uid = TargetModel.uid;
            const obj = this.modelObjs[uid] || new TargetModel(this.socket, this.exportClientApi());
            if(!this.modelObjs[uid]) {
                this.modelObjs[uid] = obj;
            }
            if(typeof obj[method as any] === "function") {
                return obj[method as any].apply(obj, args);
            }
        }
    }
    private startBeatListen(){
        if(!this.beatTimer) {
            this.lastBeatTime = (new Date()).getTime();
            this.beatTimer = setInterval(() => {
                const now = new Date().getTime();
                const effTime = now - this.lastBeatTime;
                if(effTime > 30000 && this.isConnected) {
                    this.socket.send(JSON.stringify(({
                        msgType: "Beat",
                        msgId: "beat_" + now
                    }) as TypeMsgData));
                    this.lastBeatTime = now;
                    this.log("心跳包检测。。。", "INFO");
                }
            }, 1000);
        }
    }
    private onWebsocketError(event: ErrorEvent): void {
        if(event.error?.code === "ECONNREFUSED") {
            this.startConnected = false;
            if(!this.retryTimer) {
                this.retryTimer = setInterval(() =>{
                    if(!this.startConnected) {
                        if(this.retryCount + 1 <= this.retryTimeoutCount || this.autoConnect) {
                            this.socket.removeEventListener("message", this.onMessage.bind(this));
                            this.socket.removeEventListener("open", this.onWebsocketOpen.bind(this));
                            this.socket.removeEventListener("close", this.onWebsocketClose.bind(this));
                            this.socket.removeEventListener("error", this.onWebsocketError.bind(this));
                            this.retryCount += 1;
                            this.log(`重新尝试连接(${this.retryCount})。。。`, "INFO");
                            this.start(true);
                        } else {
                            this.log("重试失败，请检查网络设置。", "WARN");
                            this.retryCount = 0;
                            clearTimeout(this.retryTimer);
                            this.retryTimer = null;
                        }
                    }
                }, 1000);
            }
        } else {
            this.callModelApi("onError", event);
        }
    }
    private onWebsocketClose(evt:CloseEvent) {
        this.isConnected = false;
        this.callModelApi("onClose", evt);
        this.log("断开连接。。。", "DEBUG");
        if(this.autoConnect && !this.retryTimer) {
            this.log("尝试自动连接。。。", "INFO");
            this.start(true);
        }
    }
    private onWebsocketOpen(evt: OpenEvent) {
        this.isConnected = true;
        this.startConnected = false;
        if(this.retryTimer) {
            clearInterval(this.retryTimer);
            this.retryTimer = null;
        }
        this.callModelApi("onOpen", evt);
        this.log("连接成功。。。", "DEBUG");
    }
    private onMessage(d: MessageEvent) {
        const data: TypeMsgData = typeof d.data === "string" ? JSON.parse(d.data) : d.data;
        const objResult = callModelHandleMsg​​(data?.msgType, { ...this.exportClientApi() });
        if(objResult) {
            objResult.target[objResult.method]({
                message: d,
                data,
                ...this.exportClientApi()
            });
        } else {
            if(!this.callModelApi("onMessage", {
                message: d,
                data,
                ...this.exportClientApi()
            })) {
                console.error("No message handle for the request.", data);
            }
        }
    }
    private createSocket(connectionString: string):any {
        try{
            return new WebSocket(connectionString);
        } catch {
            return new WSWebSocket(connectionString);
        }
    }
    /**
     * 调用自定义模块方法
     * @param eventName - 指定模块和调用方法名
     * @param args - 传递参数
     * @returns 返回值
     */
     private callModelApi(eventName: string, ...args: any[]): any {
        const AllModels: any = this.models || {};
        const targetMatch = eventName.match(/^([a-z0-9_-]{1,})\.([a-z0-9_-]{1,})$/i);
        const targetId = targetMatch ? targetMatch[1] : null;
        const targetName = targetMatch ? targetMatch[2] : null;
        let callApiResult: any;
        for(const keyId of Object.keys(AllModels)) {
            const modelFactory = AllModels[keyId];
            const uid = modelFactory.uid;
            if(!utils.isEmpty(uid) && (utils.isEmpty(targetId) || (!utils.isEmpty(targetId) && targetId === uid))) {
                const callEventName = targetName && !utils.isEmpty(targetName) ? targetName : eventName;
                if(typeof modelFactory.undeliveredMessages === "function" && modelFactory.undeliveredMessages(...args)) {
                    let modelObj = this.modelObjs[uid];
                    if(!modelObj) {
                        modelObj = new modelFactory(this.socket, this.exportClientApi());
                        this.modelObjs[uid] = modelObj;
                        typeof modelObj.onInit === "function" && modelObj.onInit();
                    }
                    if(typeof modelObj[callEventName] === "function"){
                        callApiResult = modelObj[callEventName].apply(modelObj, args);
                        if(callApiResult) {
                            return callApiResult;
                        }
                    }
                }
            }
        };
    }
    /**
     * 调用decorator装载的模块方法
     * @param uid - 指定模块ID
     * @param method - 调用方法名
     * @param args - [可选]调用参数
     * @returns 
     */
    callApiEx(uid: string, method: string, ...args: any[]) {
        return callModelApi({
            uid,
            method,
            initOpt: {
                ...this.exportClientApi()
            }
        }, ...args);
    }
    private exportClientApi() {
        return {
            send: <T="None",Attr={}>(data: TypeMsgData<T,Attr>): Promise<any> => {
                return new Promise<any>((resolve, reject) => {
                    const msgId = "wci_msg_" + utils.guid();
                    if(data.msgType !== "Binary") {
                        this.socket.send(JSON.stringify({
                            ...data,
                            msgId
                        }));
                    } else {
                        // 发送二进制包
                        console.error("not surpport");
                    }
                    if(data.rNotify) {
                        this.msgHooks[msgId] = {
                            resolve,
                            reject
                        }
                    } else {
                        resolve({
                            statusCode: 200,
                            message: "sent success"
                        });
                    }
                });
            }
        }
    }
}