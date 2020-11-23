import { IncomingMessage } from "http";
import { CommonUtils } from "../utils/CommonUtils";
import {
    TypePluginLifeCycle,
    TypeServerSocketEvent,
    TypeMsgData
} from "./IServerSocket";
import ClientReceiveFile from "../client/ClientReceiveFile";

type TypeServerSorketOptions = {
    onClose?: Function;
    plugin?: any[];
    id: string;
    request: IncomingMessage;
    sendToAll: Function;
    sendTo: Function;
    sendToAsync(msgData: TypeMsgData, toList: string[]): Promise<any>;
};

export class ServerSocket extends CommonUtils {
    socket: WebSocket;
    userAgent: string;
    fileObj: ClientReceiveFile;

    private options: TypeServerSorketOptions;
    private msgListeners: any = {};
    constructor(socket: WebSocket, options: TypeServerSorketOptions) {
        super();
        this.socket = socket;
        this.options = options;
        this.userAgent = <any>options?.request.headers["user-agent"];
        this.fileObj = new ClientReceiveFile(socket, {
            sendTo: (msgData: TypeMsgData, toUser: string[]): void => {
                msgData.toUser = [];
                this.sendTo(msgData, toUser);
            },
            send: (msgData:TypeMsgData): void => {
                this.send(<any>msgData);
            },
            sendAsync: (msgData:TypeMsgData): Promise<any> => {
                return this.sendAsync(msgData);
            }
        });
        this.fileObj.on("Start", (fileData:any) => {
            this.callPluginMethod("onStartReceiveFile", fileData);
        });
        this.fileObj.on("End", (fileData:any) => {
            this.callPluginMethod("onEndReceiveFile", fileData);
        });
        this.fileObj.on("Progress", (progressEvent:any) => {
            this.callPluginMethod("onSendFileProgress", progressEvent);
        });
        this.startListen();
        this.callPluginMethod("onConnected", options.request);
    }
    close(): void {
        try{
            this.socket && this.socket.close();
        } catch(e) {
            console.error(e);
        }
    }
    send<T={}>(msg:TypeMsgData<T>): void {
        if(this.isEmpty(msg.data) || this.isArray(msg.data) || this.isObject(msg.data) ||this.isString(msg.data) || this.isNumeric(msg.data)) {
            if(this.isEmpty(msg.msgId)) {
                msg.msgId = this.guid();
            }
            this.socket.send(JSON.stringify(msg));
        } else {
            this.socket.send(<any>msg.data);
        }
    }
    sendAsync<T={}>(msgData: TypeMsgData<T>, timeout = 3000): Promise<any> {
        return new Promise<any>((resolve, reject)=> {
            const msgId = this.guid();
            msgData.msgId = msgId;
            msgData.shouldBack = true;
            (<any>msgData).backMsgType = "Promise_" + msgData.msgType;
            const timeHandler = setInterval(() => {
                reject({
                    statusCode: "TIMEOUT",
                    message: "Sending message timed out, no information returned or no application response。"
                });
                clearInterval(timeHandler);
                delete this.msgListeners[msgId];
            }, timeout);
            this.msgListeners[msgId] = {
                resolve,
                reject
            };
            this.send(msgData);
        });
    }
    /**
     * 发送消息给所有客户端
     * @param msgData 发送消息数据
     * @param ignoreList 不需要发送的客户端id列表
     */
    sendToAll<T={}>(msgData:TypeMsgData<T>, ignoreList?: string[]): void {
        this?.options?.sendToAll(msgData, ignoreList);
    }
    sendTo<T={}>(msgData: TypeMsgData<T>, toList: string[]):void {
        this?.options?.sendTo(msgData, toList);
    }
    private callPluginMethod(callbackName: TypePluginLifeCycle, ...args:any[]): void {
        const plugin = this?.options?.plugin;
        if(plugin) {
            for(const _obj of plugin) {
                if(typeof _obj[callbackName] === "function") {
                    const event:TypeServerSocketEvent = {
                        argvs: args,
                        break: false,
                        socket: this,
                        sendToAll: this.sendToAll.bind(this),
                        sendTo: this.sendTo.bind(this),
                        sendToAsync: this.options.sendToAsync,
                        uid: this.options.id,
                        data: args[0]
                    };
                    _obj[callbackName].apply(_obj, [event, ...args]);
                    if(event.break) {
                        break;
                    }
                }
            }
        }
    }
    private startListen(): void {
        this.socket.onmessage = (msgEvt: MessageEvent) => {
            try{
                const msgDataType = this.getType(msgEvt.data);
                if(this.isString(msgEvt.data)) {
                    const msgData:TypeMsgData = JSON.parse(msgEvt.data);
                    if(!this.fileObj.onReceiveMessage(msgData, {
                        clientSide: false,
                        from: this.options.id,
                        toUser: msgData.toUser
                    })) {
                        if(this.isArray(msgData.toUser) && msgData.toUser.length > 0) {
                            const toUserList = msgData.toUser;
                            // 当有toUser字段是做消息转发即可
                            msgData.toUser = null;
                            msgData.from = this.options.id;
                            this.sendTo(msgData, toUserList);
                        } else {
                            // ClientReceiveFile类会自动处理与文件传输相关的消息不需要用户介入 
                            if(/^Promise_/.test(<any>msgData.msgType)) { // 带有Promise_前缀类型的消息需要自动处理
                                if(this.isString(msgData.msgId) && this.msgListeners[msgData.msgId]) {
                                    // 获取到back消息处理方法
                                    console.log("onServer: ",msgData.msgType, msgData);
                                    if(msgData.backFailResult) {
                                        typeof this.msgListeners[msgData.msgId].reject === "function" && this.msgListeners[msgData.msgId].reject(msgData);
                                    } else {
                                        typeof this.msgListeners[msgData.msgId].resolve === "function" && this.msgListeners[msgData.msgId].resolve(msgData);
                                    }
                                } else {
                                    this.callPluginMethod("onMessage", msgData, msgEvt);
                                }
                            } else {
                                if(msgData.msgType === "Beat") {
                                    // 心跳包检测
                                    this.send({
                                        msgType: msgData.backMsgType,
                                        msgId: msgData.msgId,
                                        data: "Welcome to use elmer-socket, auther: elmer s j mo, email: 250933400@qq.com."
                                    });
                                } else {
                                    this.callPluginMethod("onMessage", msgData, msgEvt);
                                }
                            }
                        }
                    }
                } else {
                    if(msgDataType === "[object Buffer]") {
                        this.fileObj.onReceiveBuffer(msgEvt.data,{
                            clientSide: false,
                            from: this.options?.id
                        });
                    } else if(msgDataType === "[object Uint8Array]") {
                        this.fileObj.onReceiveBuffer(msgEvt.data,{
                            clientSide: false,
                            from: this.options?.id
                        });
                    } else if(this.getType(msgEvt.data) === "[object Blob]") {
                        this.fileObj.onReceiveBlob(msgEvt.data,{
                            clientSide: false,
                            from: this.options?.id
                        });
                    } else {
                        this.callPluginMethod("onMessage", msgEvt);
                    }
                }
            }catch(e) {
                this.callPluginMethod("onError", e);
            }
        };
        this.socket.onerror = (ev) => {
            if(!this.ajaxHandler(ev)) {
                console.error(ev);
                this.callPluginMethod("onError", ev);
            }
        };
        this.socket.onclose = () => {
            this.callPluginMethod("onClose", this.options.id);
            typeof this?.options?.onClose === "function" && this?.options?.onClose(this?.options?.id);
        };
        this.fileObj.on("Start", (fileInfo:any) => {
            console.log(fileInfo);
        });
        this.fileObj.on("Progress", (progress:any) => {
            console.log(progress);
        });
        this.fileObj.on("End", (fileInfo:any) => {
            console.log(fileInfo);
        });
        this.send({
            msgType: "Connected",
            data: this?.options?.id
        });
    }
}