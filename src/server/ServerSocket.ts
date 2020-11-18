import { IncomingMessage } from "http";
import { CommonUtils } from "../utils/CommonUtils";
import {
    TypePluginLifeCycle,
    TypeServerSocketEvent,
    TypeMsgData
} from "./IServerSocket";
import { queueCallFunc } from "elmer-common";

type TypeServerSorketOptions = {
    onClose?: Function;
    plugin?: any[];
    id: string;
    request: IncomingMessage;
    sendToAll: Function;
};

type TypeSendFileInfo = {
    fileName: string;
    fileType: string;
    fileLength: number;
    fileData: Buffer;
    fileId: string;
    index: number;
};


export class ServerSocket extends CommonUtils {
    socket: WebSocket;
    userAgent: string;
    private options: TypeServerSorketOptions;
    private isFileSending: boolean = false;
    private sendFileTime: Date;
    private sendFileResolve: Function;
    private sendFileReject: Function;
    private msgListeners: any = {};
    constructor(socket: WebSocket, options: TypeServerSorketOptions) {
        super();
        this.socket = socket;
        this.options = options;
        this.userAgent = <any>options?.request.headers["user-agent"];
        this.startListen();
        this.callPluginMethod("onConnection", options.request);
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
    sendAsync<T={}>(msgData: TypeMsgData<T>): Promise<any> {
        return new Promise<any>((resolve, reject)=> {
            msgData.msgId = this.guid();
            this.msgListeners[msgData.msgId] = {
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
    sendFile(fileName: string, timeout: number = 30000): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            const fs = require("fs");
            if(!fs.existsSync(fileName)) {
                reject({
                    statusCode: "FILE_NOT_FOUND",
                    message: "The file that will send to client was not exists"
                });
            } else {
                if(this.isFileSending) {
                    reject({
                        statusCode: "SEND_FILE_PROCESSING",
                        message: "already have an process for sending file"
                    });
                } else {
                    const fState = fs.lstatSync(fileName);
                    const readStream = fs.createReadStream(fileName);
                    const msgId = this.guid();
                    const fileNameM = fileName.match(/\/([^\/]*)$/i);
                    const fileTypeM = fileName.match(/\.([a-z0-9]{1,})$/i)
                    const fileLength = fState.size;
                    this.sendFileTime = new Date();
                    let index: number = 0;
                    let fileParams:any[] = [];
                    readStream.on("data", (buff:Buffer) => {
                        const fileData:TypeSendFileInfo = {
                            fileName: fileNameM ? fileNameM[1] : "ERROR",
                            fileType: fileTypeM ? fileTypeM[1] : "",
                            fileLength,
                            fileData: Buffer.alloc(0),
                            fileId: msgId,
                            index: 0
                        };
                        fileData.fileData = buff;
                        fileData.index = index;
                        this.sendFileBuffer(fileData, timeout);
                        fileParams.push({
                            id: "forFile_" + fileParams.length,
                            params:  fileData
                        });
                        index += 1;
                    });
                    readStream.on("error", (err:any) => {
                        console.error(err.stack);
                        reject({
                            statusCode:"SEND_FILE_FAIL",
                            message: err.message
                        });
                    });
                    readStream.on("end", () => {
                        queueCallFunc(fileParams, (_option, param:any) => {
                            return this.sendFileBuffer(param, timeout);
                        }).then(() => {
                            this.log("All chunk was send success");
                        }).catch((err) => {
                            reject(err);
                        });
                    });
                    this.sendFileResolve = resolve;
                    this.sendFileReject = reject;
                }
            }
        });
    }
    sendFileBuffer(fileData: TypeSendFileInfo, timeout: number = 30000): Promise<any> {
        const now = new Date();
        return new Promise<any>((resolve, reject) => {
            if(!this.sendFileTime || now.getTime() - this.sendFileTime.getTime() > timeout) {
                reject({
                    statusCode: "SEND_FILE_TIMEOUT",
                    message: "timeout no reponse from client"
                });
            } else {
                this.sendAsync({
                    msgType: "SendFileProcessing",
                    data: {
                        fileName: fileData.fileName,
                        fileType: fileData.fileType,
                        fileLength: fileData.fileLength,
                        fileId: fileData.fileId,
                        index: fileData.index
                    },
                    shouldBack: true,
                    backMsgType: "SendFileResp"
                }).then((respData: any) => {
                    const msgData = {
                        index: respData.index,
                        id: respData.id
                    };
                    const infoBuffer = Buffer.from(JSON.stringify(msgData)); // 文件信息
                    const infoLength = infoBuffer.length;
                    const newData = Buffer.alloc(fileData.fileData.length + infoBuffer.length + 2);
                    fileData.fileData.copy(newData, 0,0);
                    infoBuffer.copy(newData, fileData.fileData.length, 0);
                    // 将文件信息字节长度写入Buffer最后两个字节, 
                    // 将info字节长度值转成字符在写入最后两个字节，方便在前端读取
                    Buffer.from(infoLength.toString()).copy(newData, newData.length -2);
                    this.send({
                        msgType: "SendFileProcessing",
                        data: newData
                    });
                    resolve({});
                }).catch((err) => {
                    reject(err);
                });
            }
        });
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
                if(this.isString(msgEvt.data)) {
                    const msgData:TypeMsgData = JSON.parse(msgEvt.data);
                    if(msgData.msgType === "SendFileComplete") {
                        this.sendFileResolve({});
                    } else {
                        if(msgData.callback) {
                            if(this.isString(msgData.msgId) && this.msgListeners[msgData.msgId]) {
                                // 获取到back消息处理方法
                                if(msgData.backFailResult) {
                                    typeof this.msgListeners[msgData.msgId].reject === "function" && this.msgListeners[msgData.msgId].reject(msgData.data);
                                } else {
                                    typeof this.msgListeners[msgData.msgId].resolve === "function" && this.msgListeners[msgData.msgId].resolve(msgData.data);
                                }
                            } else {
                                msgData.msgType !== "SendFileResp" && this.callPluginMethod("onMessage", msgData, msgEvt);
                            }
                        } else {
                            msgData.msgType !== "SendFileResp" && this.callPluginMethod("onMessage", msgData, msgEvt);
                        }
                    }
                } else if(this.getType(msgEvt.data) === "[object Buffer]") {
                    console.log(msgEvt.data);
                } else {
                    this.callPluginMethod("onMessage", msgEvt);
                }
            }catch(e) {
                console.error(e);
                this.sendFileResolve({});
                this.sendFileReject({});
            }
        }
        this.socket.onerror = (ev) => {
            if(!this.ajaxHandler(ev)) {
                console.error(ev);
                this.callPluginMethod("onError", ev);
            }
        }
        this.socket.onclose = () => {
            this.callPluginMethod("onClose", this.options.id);
            typeof this?.options?.onClose === "function" && this?.options?.onClose(this?.options?.id);
        }
        this.send({
            msgType: "Connected",
            data: this?.options?.id
        });
    }
}