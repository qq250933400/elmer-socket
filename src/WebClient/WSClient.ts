import "reflect-metadata";
import ConfigSchema from "../config/ClientConfig.schema";
import WSWebSocket from "ws";
import { AppService, utils, Observe, getObjFromInstance } from "elmer-common";
import {
    CONST_CLIENT_CONFIG_FILENAME,
    CONST_CLIENT_CONFIG_INITDATA,
    CONST_MESSAGE_USE_FILTERKEYS
} from "../data/const";
import { IClientConfig, TypeENV } from "../config/IClientConfig";
import { GetConfig } from "../common/decorators";
import { Log } from "../common/Log";
import { EnumSocketErrorCode } from "../data/statusCode";
import { clearInterval } from "timers";
import { AModel } from "./AModel";
import { IMsgData } from "../data/IMessage";
import { CommonUtils } from "../utils/CommonUtils";

interface IWSClientStartOption {
    env: TypeENV,
    retry?: number
}

@AppService
export class WSClient<UseModel={}> {
    /** 是否已连接到服务器 */
    public isConnected: boolean = false;

    @GetConfig(CONST_CLIENT_CONFIG_FILENAME, CONST_CLIENT_CONFIG_INITDATA, ConfigSchema)
    private config: IClientConfig;

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
    // event handler
    private event: Observe<any>;
    constructor(
        private log: Log,
        private com: CommonUtils
    ) {
        this.models = [];
        this.event = new Observe<any>();
    }
    start(option: IWSClientStartOption): Exclude<WSClient<UseModel>, "useModel" | "send" | "start"> {
        const hostValue = utils.getValue(this.config.host, option.env || "PROD");
        const connectionString = `ws://${hostValue}:${this.config.port}`;
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
    model(models: {[P in keyof UseModel]: new(...args:any) => any}): Exclude<WSClient<UseModel>, "model"> {
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
    send<T={}>(data: IMsgData<T>): Promise<any> {
        return new Promise((resolve)=>{
            if(data.type === "binary" || data.type === "blob") {
                const packData = this.com.encodeMsgPackage(data, null, false);
                this.socket.send(packData);
            } else {
                this.socket.send(JSON.stringify(data));
            }
            resolve({});
        });
    }
    ready(fn: Function): void {
        this.event.on("onReady", fn);
    }
    dispose(): void {
        this.socket.close(1, "Client was closed by user.");
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
    private mountModel(modelObj: any): void {
        modelObj.option = {
            send: this.send.bind(this)
        };
    }
    private createSocket(connection: string): WebSocket {
        try {
            return new WebSocket(connection);
        } catch {
            return new WSWebSocket(connection) as any;
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
        this.activeTime = Date.now();
        this.models.forEach((Model: AModel) => {
            const uid = (Model as any).modelId;
            const useMessages: string[] = Reflect.getMetadata(CONST_MESSAGE_USE_FILTERKEYS, Model) || [];
            if(useMessages.includes(msgData.type) || useMessages.length <= 0) {
                const obj:AModel = getObjFromInstance(Model as any, this);
                if(!this.modelPools[uid]) {
                    this.mountModel(obj);
                    this.modelPools[uid] = obj;
                }
                (obj as any).message({
                    ...event,
                    data: msgData
                });
            }
        });
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
                (modelObj as any).close();
            });
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
            if(this.retryCount > 30) {
                this.log.error("多次尝试重新连接失败。[CT_RETRY_TIMEOUT]");
                return;
            }
            if(this.startOption) {
                this.isRetryConnect = true;
                const time = setTimeout(() => {
                    this.retryCount += 1;
                    this.start(this.startOption);
                    clearTimeout(time);
                }, 2000);
            } else {
                this.log.info("尝试重新链接失败。[CT_NO_CONFIG]");
            }
        }
    }
    private decodeData(msgData: any): IMsgData {
        if(utils.isString(msgData)) {
            return JSON.parse(msgData);
        } else if(utils.isObject(msgData)) {
            return msgData as any;
        } else {
            return {} as any;
        }
    }
}