import ClientReceiveFile from "./ClientReceiveFile";
import { TypeFileSendProgress, TypeMsgData, TypePluginLifeCycle } from "../server/IServerSocket";
import { StaticCommon as utils, Common} from "elmer-common";

type TypeSocketClientOption = {
    host: string;
    port: number;
    plugin?: any[];
    canRetryConnect?: boolean;
    enableBeat?: boolean;
    beatTime?: number;
    beatTimeout?: number;
};

export class SocketClient<T={}> extends Common {
    options: TypeSocketClientOption;
    socket: WebSocket;
    fileObj: ClientReceiveFile;
    msgListener: any = {};
    private retryHandler: any;
    private beatTimeCount: number = 0;
    private beatTimeHandler: any;
    private isConnecting: boolean = false;
    constructor(option: TypeSocketClientOption) {
        super();
        this.options = option;
        this.connection(option);
        if(this.options.enableBeat) {
            this.beatTime();
        }
    }
    connection(option: TypeSocketClientOption): void {
        try {
            const connectionString = `ws://${option.host}:${option.port}`;
            this.isConnecting = true;
            this.socket = this.createSocket(connectionString);
            this.socket.onmessage = this.onMessage.bind(this);
            this.socket.onopen = this.onConnected.bind(this);
            this.socket.onerror = this.onError.bind(this);
            this.socket.onclose = this.onClose.bind(this);
            this.fileObj = new ClientReceiveFile(this.socket, {
                sendTo: (msgData: TypeMsgData, toUser: string[]) => {
                    msgData.toUser = toUser;
                },
                send: (msgData: TypeMsgData):void => {
                    this.send(<any>msgData);
                },
                sendAsync: (msgData: TypeMsgData, timeout: number = 30000) => {
                    return this.sendAsync(<any>msgData, timeout);
                }
            });
            this.fileObj.on("Start", this.onStartReceiveFile.bind(this));
            this.fileObj.on("End", this.onEndReceiveFile.bind(this));
            this.fileObj.on("Progress", this.onReceivePropress.bind(this));
            this.initPlugin();
        } catch(e) {
            this.onError(e);
        }
    }
    send(msgData: TypeMsgData<T>): void {
        const msgTypeValue = utils.getType(msgData.data);
        if(msgTypeValue === "[object Blob]" || msgTypeValue === "[object Buffer]" || msgTypeValue==="[object Uint8Array]" || msgTypeValue === "[object ArrayBuffer]") {
            this.socket.send(<any>msgData.data);
        } else {
            if(utils.isEmpty(msgData.msgId)) {
                msgData.msgId = utils.guid();
            }
            if(utils.isEmpty(msgData.data)) {
                msgData.data = "";
            }
            this.socket.send(JSON.stringify(msgData));
        }
    }
    sendAsync(msgData: TypeMsgData<T>, timeout=30000): Promise<any> {
        return new Promise((resolve, reject) => {
            const msgId = utils.guid();
            msgData.msgId = msgId;
            const timHandler = (() => {
                const timeHandler = setInterval(() => {
                    reject({
                        statusCode: "TIMEOUT",
                        message: "Sending message timed out, no information returned or no application response。"
                    });
                    clearInterval(timeHandler);
                    delete this.msgListener[msgId];
                }, timeout);
                return timeHandler;
            })();
            (<any>msgData.backMsgType) = "Promise_" + msgData.msgType;
            msgData.shouldBack = true;
            this.msgListener[msgId] = {
                timeHandler: timHandler,
                resolve,
                reject
            };
            this.send(msgData);
        });
    }
    dispose(): void {
        if(this.beatTimeHandler && this.beatTimeHandler > 0) {
            clearInterval(this.beatTimeHandler);
            if(!this.socket.CLOSED && !this.socket.CLOSING) {
                this.socket.close();
            }
        }
    }
    private beatTime(): void {
        let timeout = undefined !== this.options.beatTime && this.options?.beatTime > 0 ? this.options.beatTime : 10;
        let beatTimeout = undefined !== this.options.beatTimeout && this.options.beatTimeout > 3 ? this.options.beatTimeout : 10;
        this.beatTimeHandler = setInterval(()=>{
            if(!this.isConnecting) {
                // 不在连接过程中的时候才做检测，正在连接跳过此步骤
                if(this.beatTimeCount > 0 && this.beatTimeCount >= timeout) {
                    timeout += beatTimeout
                    this.sendAsync({
                        msgType: "Beat",
                        data: "hello wold",
                        shouldBack: true
                    }, beatTimeout * 1000).then(() => {
                        this.beatTimeCount = 0;
                    }).catch((err:any) => {
                        this.beatTimeCount = 0;
                        if(this.socket && this.socket.readyState !== 2 && this.socket.readyState !==3) {
                            // readState !== 2 and readState !== 3 then the server is availabel, but server not response the Beat msg,
                            // plase upgrade  
                            console.error(err);
                            console.error("Can not get beat resonse from websocket server. server side need do a upgrade.");
                        } else {
                            this.connection(this.options); // 心跳包未返回结果，连接失败，开启重连
                        }
                    });
                } else {
                    this.beatTimeCount += 1;
                }
            }
        },1000);
    }
    private createSocket(connectionString: string):any {
        try{
            return new WebSocket(connectionString);
        } catch {
            return new (require("ws"))(connectionString);
        }
    }
    private onClose(): void {
        this.callPlugin("onClose");
    }
    private onError(err:any): void {
        const errorCode = err.error.code;
        const readState = this.socket.readyState;
        console.error(errorCode, readState);
        if(readState === 3 || (readState === 2 && err.error.code === "ECONNREFUSED")) {
            console.log(`Try reconnecting to the server [ws://${this?.options?.host}:${this?.options?.port}]`);
            this.isConnecting = true;
            this.beatTimeCount = 0;
            this.connection(this.options);
        } else {
            this.callPlugin("onError", err);
        }
    }
    private onConnected(): void {
        this.isConnecting = false;
        this.callPlugin("onConnected");
        console.log(`Connected to server 'ws://${this?.options?.host}:${this?.options?.port}'`);
        if(this.retryHandler) {
            clearInterval(this.retryHandler);
        }
    }
    private onMessage(evt:MessageEvent): void {
        if(typeof evt.data === "string" && evt.data.length > 0) {
            const msgData:TypeMsgData = JSON.parse(evt.data);
            if(!this.fileObj.onReceiveMessage(msgData, {
                clientSide: true,
                toUser: msgData.toUser
            })) {
                if(msgData.msgType === "Connected") {
                    this.callPlugin("onConnected", msgData);
                } else {
                    if(/^Promise\_/.test(msgData.msgType as any) && !utils.isEmpty(msgData.msgId)) {
                        // 针对需要以promise处理返回消息的方式
                        const listener = this.msgListener[msgData.msgId as string];
                        if(listener) {
                            clearTimeout(listener.timeHandler);
                            if(msgData.backFailResult) {
                                listener.reject(msgData);
                            } else {
                                listener.resolve(msgData);
                            }
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
            const dataType = utils.getType(evt.data);
            if(dataType === "[object Blob]") {
                this.fileObj.onReceiveBlob(evt.data, {
                    clientSide: true,
                    from: ""
                });
            } else if(dataType === "[object Buffer]") {
                this.fileObj.onReceiveBuffer(evt.data, {
                    clientSide: true,
                    from: ""
                });
            } else if(dataType === "[object Uint8Array]"){
                console.log("File_DATA");
                this.fileObj.onReceiveBuffer(evt.data, {
                    clientSide: true,
                    from: ""
                });
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
    private onReceivePropress(fileData: TypeFileSendProgress): void {
        this.callPlugin("onSendFileProgress", fileData);
    }
    private callPlugin(name: TypePluginLifeCycle, ...arg:any[]): void {
        this.options?.plugin?.map((plugin:any) => {
            typeof plugin[name] === "function" && plugin[name].apply(plugin, arg);
        });
    }
    /**
     * 在此方法绑定一些数据到Plugin对象
     */
    private initPlugin(): void {
        console.log("Initializing plug-ins");
        this.options?.plugin?.map((plugin:any) => {
            utils.defineReadOnlyProperty(plugin, "socket", this);
        });
    }
}
