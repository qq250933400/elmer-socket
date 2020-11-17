import ClientReceiveFile from "./ClientReceiveFile";
import { TypeMsgData } from "../server/IServerSocket";
import { StaticCommon as utils } from "elmer-common";

type TypeSocketClientOption = {
    host: string;
    port: number;
    plugin?: any[];
};

type PluginLifeCycle = "onClose" | "onError" | "onConnected" | "onMessage" | "onStartReceiveFile" | "onEndReceiveFile";

export class SocketClient<T={}> {
    options: TypeSocketClientOption;
    socket: WebSocket;
    fileObj: ClientReceiveFile;
    msgListener: any = {};
    constructor(option: TypeSocketClientOption) {
        this.options = option;
        this.connection(option);
    }
    connection(option: TypeSocketClientOption): void {
        try {
            this.socket = new WebSocket(`ws://${option.host}:${option.port}`);
            this.socket.onmessage = this.onMessage.bind(this);
            this.socket.onopen = this.onConnected.bind(this);
            this.socket.onerror = this.onError.bind(this);
            this.socket.onclose = this.onClose.bind(this);
            this.fileObj = new ClientReceiveFile(this.socket);
            this.fileObj.on("Start", this.onStartReceiveFile.bind(this));
            this.fileObj.on("End", this.onEndReceiveFile.bind(this));
            this.initPlugin();
        } catch(e) {
            this.onError(e);
        }
    }
    send(msgData: TypeMsgData<T>): void {
        if(msgData.data instanceof Blob || msgData.data instanceof Buffer || msgData.data instanceof ArrayBuffer) {
            this.socket.send(msgData.data);
        } else {
            if(utils.isEmpty(msgData.msgId)) {
                msgData.msgId = utils.guid();
            }
            this.socket.send(JSON.stringify(msgData));
        }
    }
    sendAsync(msgData: TypeMsgData<T>, timeout=30000): Promise<any> {
        return new Promise((resolve, reject) => {
            const msgId = utils.guid();
            msgData.msgId = msgId;
            if(!msgData.shouldBack || utils.isEmpty(msgData.backMsgType)) {
                reject({
                    statusCode: "MISSING_DATA",
                    message: "To send a message in sendAsync mode, shouldBack must be true and backMsgType cannot be empty"
                });
            } else {
                const timeHandler = setInterval(() => {
                    reject({
                        statusCode: "TIMEOUT",
                        message: "Sending message timed out, no information returned or no application response。"
                    });
                    clearInterval(timeHandler);
                    delete this.msgListener[msgId];
                }, timeout);
                (<any>msgData.backMsgType) = "Promise_" + msgData.backMsgType;
                this.msgListener[msgId] = {
                    timeHandler,
                    resolve,
                    reject
                };
                this.send(msgData);
            }
        });
    }
    private onClose(): void {
        this.callPlugin("onClose");
    }
    private onError(err:any): void {
        this.callPlugin("onError", err);
    }
    private onConnected(): void {
        this.callPlugin("onConnected");
    }
    private onMessage(evt:MessageEvent): void {
        if(typeof evt.data === "string" && evt.data.length > 0) {
            const msgData:TypeMsgData = JSON.parse(evt.data);
            if(!this.fileObj.onReceiveMessage(msgData)) {
                if(msgData.msgType === "Connected") {
                    this.callPlugin("onConnected", msgData);
                } else {
                    if(/^Promise\_/.test(msgData.msgType as any) && !utils.isEmpty(msgData.msgId)) {
                        // 针对需要以promise处理返回消息的方式
                        const listener = this.msgListener[msgData.msgId as string];
                        if(listener) {
                            clearTimeout(listener.timeHandler);
                            listener.resolve(msgData.data);
                            delete this.msgListener[msgData.msgId as string];
                        } else {
                            this.callPlugin("onMessage", msgData);
                        }
                    } else {
                        this.callPlugin("onMessage", msgData);
                    }
                }
            }
        } else {
            if(evt.data instanceof Blob) {
                this.fileObj.onReceiveBlob(evt.data);
            } else if(evt.data instanceof Buffer) {
                this.fileObj.onReceiveBuffer(evt.data);
            } else {
                // tslint:disable-next-line: no-console
                console.log("Not Support Data", evt.data);
                this.callPlugin("onError", {
                    statusCode: "C_T_500",
                    message: "Unsupported data type"
                });
            }
        }
    }
    private onStartReceiveFile(msgData:any): void {
        this.callPlugin("onStartReceiveFile", msgData);
    }
    private onEndReceiveFile(msgData:any): void {
        this.callPlugin("onEndReceiveFile", msgData);
    }
    private callPlugin(name: PluginLifeCycle, ...arg:any[]): void {
        this.options?.plugin?.map((plugin:any) => {
            typeof plugin[name] === "function" && plugin[name].apply(plugin, arg);
        });
    }
    /**
     * 在此方法绑定一些数据到Plugin对象
     */
    private initPlugin(): void {
        console.log("初始化插件");
        this.options?.plugin?.map((plugin:any) => {
            utils.defineReadOnlyProperty(plugin, "socket", this);
        });
    }
}
