import "reflect-metadata";
import { AppService, utils, Observe, getObjFromInstance } from "elmer-common";
import {
    CONST_MESSAGE_USE_FILTERKEYS
} from "../data/const";
import { IClientConfig, TypeENV } from "../config/IClientConfig";
import { BaseLog } from "../common/BaseLog";
import { EnumSocketErrorCode } from "../data/statusCode";
import { AModel } from "./AModel";
import { IMsgData, IMsgDataEx, IMsgEvent } from "../data/IMessage";
import { CommonUtils } from "../utils/CommonUtils";
import { FileTransfer, ISendFileOptions } from "../common/FileTransfer";


interface IWSClientStartOption {
    env: TypeENV,
    retry?: number
}

export class WebClient<IMsg={}, UseModel={}> {
    /** 是否已连接到服务器 */
    public isConnected: boolean = false;

    public config!: IClientConfig;
    public isNode: boolean = false;

    private socket: WebSocket;
    private isRetryConnect: boolean = false;
    private startOption: IWSClientStartOption;
    private retryCount: number = 0;
    
    // beat
    private beatTimer: any;
    private activeTime: number;
    // controller
    private models: any[];
    private modelPools: any = {};
    private isUseModelCalled?: boolean = false;
    private msgHandler: any = {};
    // event handler
    private event: Observe<IMsgEvent>;
    private cookies!: string
    private resolveHandler: any = {};
    constructor(
        private log: BaseLog,
        private com: CommonUtils,
        private SocketClient: typeof WebSocket,
        private file: FileTransfer
    ) {
        this.models = [];
        this.event = new Observe<IMsgEvent>();
        if(!this.com.isNode()) {
            this.cookies = sessionStorage.getItem("websocket_cookie");
        }
        this.file.on("onComplete", (event) => {
            if(this.msgHandler[event.msgId]) {
                this.msgHandler[event.msgId].resolve(event);
                delete this.msgHandler[event.msgId];
            } else {
                console.error("No event to handle the download file data.", event);
            }
        });
        this.file.on("onProgress", (event) => {
            this.event.emit("onFileTransferProgress", event);
        });
    }
    start(option: IWSClientStartOption): Exclude<WebClient<IMsg,UseModel>, "useModel" | "send" | "start"> {
        const hostValue = utils.getValue(this.config.host, option.env || "PROD") as string;
        const connectionString = !/\:[\d]{1,}$/.test(hostValue) ? `ws://${hostValue}:${this.config.port}` : hostValue;
        this.log.info("连接服务器：" + connectionString);
        this.startOption = option;
        this.socket = this.createSocket(connectionString);
        this.socket.addEventListener("open", this.onOpen.bind(this));
        this.socket.addEventListener("error", this.onError.bind(this));
        this.socket.addEventListener("close", this.onClose.bind(this));
        this.socket.addEventListener("message", this.onMessage.bind(this));
        this.beatTimer = setInterval(this.beat.bind(this), 1000);
        return this;
    }
    /**
     * 装载使用模块
     * @param models - 模块配置
     * @returns 
     */
    model(models: {[P in keyof UseModel]: new(...args:any) => any}): Exclude<WebClient<IMsg,UseModel>, "model"> {
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
    send<TypeMsgData={}>(data: IMsgData<TypeMsgData>): Promise<any> {
        return new Promise((resolve, reject)=>{
            const msgId = "msg_" + utils.guid();
            try{
                if(this.socket.readyState === 1) {
                    if(data.type === "binary" || data.type === "blob") {
                        const packData = this.com.encodeMsgPackage(data, null, false);
                        this.socket.send({
                            ...packData,
                            msgId,
                            cookie: this.cookies
                        });
                    } else {
                        this.socket.send(JSON.stringify({
                            ...data,
                            msgId,
                            cookie: this.cookies
                        }));
                    }
                    if(!data.waitReply) {
                        resolve({});
                    } else {
                        this.msgHandler[msgId] = {
                            resolve,
                            reject,
                            msgType: data.type
                        };
                    }
                } else {
                    reject({
                        code: "Closed",
                        message: "未连接到服务端",
                        status: this.socket.readyState,
                        data
                    });
                }
            }catch(e) {
                console.error(data);
                reject(e);
            }
        });
    }
    sendEx<MsgType extends (keyof IMsg | keyof IMsgDataEx)>(
        msgType: MsgType,
        data: {
            data: IMsg[Exclude<MsgType, keyof IMsgDataEx>] | IMsgDataEx[Exclude<MsgType, keyof IMsg>]
        } & Partial<Pick<IMsgData, "exception"|"toUsers"|"waitReply">>
    ): Promise<any> {
        return this.send({
            type: msgType as any,
            ...(data as any)
        });
    }
    ready(fn: Function): WebClient<IMsg,UseModel> {
        this.event.on("onReady", fn as any);
        return this;
    }
    dispose(): void {
        if(this.socket) {
            this.log.info(this.socket.readyState + "|Connecting: " + this.socket.CONNECTING);
            this.socket.close(1000);
            this.socket = null;
        }
    }
    invoke<NM extends keyof UseModel, T={}>(model: NM, fnName: keyof UseModel[NM], ...args: any[]): T|null|undefined {
        let modelObj: any;
        for(const modelFactory of this.models) {
            if(modelFactory.invokeName === model) {
                modelObj = getObjFromInstance(modelFactory, this);
                const uid = (modelFactory as any).modelId;
                if(!this.modelPools[uid]) {
                    this.mountModel(modelObj);
                    this.modelPools[uid] = uid;
                }
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
    /**
     * 事件监听
     * @param eventName 
     * @param callback 
     * @returns 
     */
    on<EventName extends keyof IMsgEvent>(eventName: EventName, callback: IMsgEvent<IMsg>[EventName]): Function {
        return this.event.on(eventName, callback);
    }
    sendFile(options: ISendFileOptions) {
        return new Promise((resolve, reject) => {
            const msgId = this.file.sendFile(options);
            this.resolveHandler[msgId] = { resolve, reject };
        });
    }
    private mountModel(modelObj: any): void {
        modelObj.option = {
            send: this.send.bind(this)
        };
        Object.defineProperty(modelObj, "config", {
            get: () => this.config
        });
        Object.defineProperty(modelObj, "log", {
            get: () => this.log
        });
        Object.defineProperty(modelObj, "cookies", {
            get: () => this.cookies
        });
        Object.defineProperties(modelObj, {
            sendFile: {
                get: () => this.sendFile.bind(this)
            }
        });
    }
    private createSocket(connection: string): WebSocket {
        const connectStr = /^ws:\/\//.test(connection) ? connection : "ws://" + connection;
        try {
            return new WebSocket(connectStr);
        } catch {
            const WSWebSocket = this.SocketClient as any;
            return new WSWebSocket(connectStr) as any;
        }
    }
    private beat(): void {
        const now = Date.now();
        const effectTime = (now - this.activeTime) / 1000;
        if(effectTime > 100) {
            this.socket.send(`{"type":"Beat"}`);
            this.activeTime = Date.now();
        }
    }
    private onOpen(): void {
        this.activeTime = Date.now();
        this.retryCount = 0;
        this.isRetryConnect = false;
        this.isConnected = true;
        this.log.info("Connected");
        this.event.emit("onReady");
    }
    private onMessage(event: MessageEvent): void {
        const msgData = this.decodeData(event.data);
        const api: any = {
            fromUser: null,
            socket: this.socket,
            reply: (data: any) => {
                this.socket.send(JSON.stringify({
                    msgId: msgData.msgId,
                    msgType: msgData.type + "_Response",
                    data: data?.data,
                    exception: data?.exception,
                    toUsers: msgData.fromUser ? [msgData.fromUser] : null,
                    waitReply: false
                }));
            }
        };
        if(msgData) {
            let isResolveHandle = false;
            api.fromUser = msgData.fromUser ? msgData.fromUser : null
            this.activeTime = Date.now();
            if(this.cookies !== msgData.cookie && !utils.isEmpty(msgData.cookie)) {
                this.cookies = msgData.cookie;
                if(!this.com.isNode()) {
                    sessionStorage.setItem("websocket_cookie", this.cookies);
                }
            }
            if(!this.file.onMessage(msgData, api)) {
                // 不是发送文件消息，转到model去做处理
                this.models.forEach((Model: AModel) => {
                    const uid = (Model as any).modelId;
                    const useMessages: string[] = Reflect.getMetadata(CONST_MESSAGE_USE_FILTERKEYS, Model) || [];
                    if(useMessages.includes(msgData.type) || useMessages.length <= 0) {
                        const obj:AModel = getObjFromInstance(Model as any, this);
                        const msgHandle = this.msgHandler[msgData.msgId];
                        if(!this.modelPools[uid]) {
                            this.mountModel(obj);
                            this.modelPools[uid] = obj;
                        }
                        if(msgHandle) {
                            if(msgData.exception) {
                                msgHandle.reject(msgData.exception, msgData);
                            } else {
                                msgHandle.resolve(msgData)
                            }
                            isResolveHandle = true;
                            delete this.msgHandler[msgData.msgId]; // remove the reponse handle
                        } else {
                            (obj as any).message({
                                ...event,
                                data: msgData
                            }, api);
                        }
                    } else if(/_Response$/.test(msgData.type)) {
                        const msgHandle = this.msgHandler[msgData.msgId];
                        if(msgHandle) {
                            if(msgData.exception) {
                                msgHandle.reject(msgData.exception, msgData);
                            } else {
                                msgHandle.resolve(msgData)
                            }
                            isResolveHandle = true;
                            delete this.msgHandler[msgData.msgId];
                        }
                    }
                });
                if(/_Response$/.test(msgData.type) && this.msgHandler[msgData.msgId]) {
                    const msgHandle = this.msgHandler[msgData.msgId];
                    if(msgHandle) {
                        if(msgData.exception) {
                            msgHandle.reject(msgData.exception, msgData);
                        } else {
                            msgHandle.resolve(msgData)
                        }
                        isResolveHandle = true;
                        delete this.msgHandler[msgData.msgId];
                    }
                }
                !isResolveHandle && this.event.emit("onMessage", msgData, event);
            }
        } else {
            if(!utils.isEmpty(event.data)) {
                this.com.decodeMsgPackage(event.data, this.isNode).then((binMsgData) => {
                    if(!this.file.onMessage(binMsgData, api)) {
                        this.error("Not support data");
                    }
                }).catch((err) => {
                    this.error(err?.exception?.stack || err?.stack || err.message);
                });
            } else {
                this.error("Not data returned");
            }
        }
    }
    private onClose(event: CloseEvent): void {
        const code = event.code;
        const reason = event.reason;
        const exCode = utils.isString(code) || utils.isNumeric(code) ? code : reason;
        const log = utils.isEmpty(reason) ? `连接断开. [${exCode}][CT_CLOSE]` : `连接断开: ${reason}. [${code}][CT_CLOSE]`;
        (!(this.isRetryConnect && code === 1006)) && this.log.error(log);
        this.isRetryConnect = false;
        this.isConnected = false;
        if(this.beatTimer) {
            clearInterval(this.beatTimer);
        }
        if(this.modelPools) {
            Object.keys(this.modelPools).forEach((mdId: string) => {
                const modelObj: AModel = this.modelPools[mdId];
                modelObj && typeof (modelObj as any).close === "function" && (modelObj as any).close();
            });
        }
        if(this.config.loopRetry && ["1005","1006"].includes(exCode.toString())) {
            this.tryConnect();
        }
    }
    private onError(err: ErrorEvent): void {
        const code = (err as any).code || err.error?.code;
        switch(code) {
            case EnumSocketErrorCode.REFUSED: {
                this.tryConnect();
                break;
            }
        }
        this.log.error(`[Code: ${code}] ${err.message}`);
    }
    private tryConnect() {
        if(!this.isRetryConnect) {
            if(!this.config.loopRetry && this.retryCount > 30) {
                this.log.error("多次尝试重新连接失败。[CT_RETRY_TIMEOUT]");
                return;
            }
            if(this.startOption) {
                this.isRetryConnect = true;
                const time = setTimeout(() => {
                    this.retryCount += 1;
                    if(this.socket && (this.socket.readyState === 1 || this.socket.CONNECTING)) {
                        clearTimeout(time);
                    } else {
                        this.dispose();
                        this.start(this.startOption);
                        clearTimeout(time);
                    }
                }, 2000);
            } else {
                this.log.info("尝试重新链接失败。[CT_NO_CONFIG]");
            }
        }
    }
    private decodeData(msgData: any): IMsgData| null {
        if(utils.isString(msgData)) {
            return JSON.parse(msgData);
        } else if(utils.isObject(msgData)) {
            return msgData as any;
        } else {
            return null;
        }
    }
    info(msg: string) {
        this.log.info(msg);
    }
    error(msg: string) {
        this.log.error(msg);
    }
    debug(msg: string) {
        this.log.debug(msg);
    }
    warn(msg: string) {
        this.log.warn(msg);
    }
    success(msg: string) {
        this.log.success(msg);
    }
}