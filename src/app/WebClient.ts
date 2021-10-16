import { GetConfig } from "../utils/file";
import { Base } from "./Base";
import { TypeWebclientConfig, TypeWebClientOptions, TypeMsgData } from "./ISocket";
import WSWebSocket, { OpenEvent } from "ws";
import { utils } from "elmer-common";
import { WebClientModel } from "./WebClientModel";

export class WebClient extends Base {
    @GetConfig<TypeWebclientConfig>("./config/server_socket.json", {
        host: "127.0.0.1",
        port: 8000
    })
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
    constructor(config: TypeWebClientOptions) {
        super();
        this.models = [
            WebClientModel,
            ...(config.models || []) as any
        ];
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
    start(isRetry?: boolean) {
        const connectionString = `ws://${this.config.host}:${this.config.port}`;
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
    private startBeatListen(){
        if(!this.beatTimer) {
            this.lastBeatTime = (new Date()).getTime();
            this.beatTimer = setInterval(() => {
                const now = new Date().getTime();
                const effTime = now - this.lastBeatTime;
                if(effTime > 3000 && this.isConnected) {
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
        if(event.error.code === "ECONNREFUSED") {
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
        this.callModelApi("onMessage", d);
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
        const AllModels: any[] = this.models || [];
        const targetMatch = eventName.match(/^([a-z0-9_-]{1,})\.([a-z0-9_-]{1,})$/i);
        const targetId = targetMatch ? targetMatch[1] : null;
        const targetName = targetMatch ? targetMatch[2] : null;
        let callApiResult: any;
        for(const modelFactory of AllModels){
            const uid = modelFactory.uid;
            if(!utils.isEmpty(uid) && (utils.isEmpty(targetId) || (!utils.isEmpty(targetId) && targetId === uid))) {
                const callEventName = targetName && !utils.isEmpty(targetName) ? targetName : eventName;
                let modelObj = this.modelObjs[uid];
                if(!modelObj) {
                    modelObj = new modelFactory(this.socket);
                    this.modelObjs[uid] = modelObj;
                }
                if(typeof modelObj[callEventName] === "function"){
                    callApiResult = modelObj[callEventName].apply(modelObj, args);
                    if(callApiResult) {
                        return callApiResult;
                    }
                    if(typeof modelObj.undeliveredMessages === "function" && modelObj.undeliveredMessages.apply(modelObj, args)) {
                        break;
                    }
                }
            }
        }
    }
}