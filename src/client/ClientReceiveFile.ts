import { queueCallFunc, TypeQueueCallParam } from "elmer-common";
import fileTypes from "./fileTypes";
import { SendFileTypes } from "./IClient";
import { TypeMsgData, TypeSendFileInfo } from "../server/IServerSocket";
import { CommonUtils, TypeMsgPackage } from "../utils/CommonUtils";
import * as fs from "fs";

type TypeReceiveFileEventName = "Start" | "End" | "Progress";
type TypeSocketEventOptions = {
    sendTo(msgData:TypeMsgData, toUser: string[]): void;
    send(msgData: TypeMsgData): void;
    sendAsync(msgData: TypeMsgData):Promise<any>;
};
type TypeClientSendFileInfo = {[P in Exclude<keyof TypeSendFileInfo, "fileData"|"toUser">]: TypeSendFileInfo[P]} & {
    fileData:Blob;
    toUser?: string;
};
type TypeReceiveFileMessageOptions = {
    from?: string;
    toUser?: string[]|null;
    clientSide: boolean;
};

const SEND_FILE_PACKAGE_TAG = "WSF";

export default class ClientReceiveFile extends CommonUtils {
    private reciveFileData: any = {};
    private socket:WebSocket;
    private eventListener:any = {};
    private options: TypeSocketEventOptions;
    private isFileSending: boolean = false;
    private sendFileTime: Date;
    private sendFileResolve: Function;
    private sendFileReject: Function;
    constructor(socket:WebSocket, options: TypeSocketEventOptions) {
        super();
        this.socket = socket;
        this.options = options;
    }
    on(eventName: TypeReceiveFileEventName, callback:Function): void {
        if(!this.eventListener[eventName]) {
            this.eventListener[eventName] = [];
        }
        this.eventListener[eventName].push(callback);
    }
     /**
     * 发送文件，此方法只能用户服务端Nodejs环境，在浏览器端发送文件请使用，sendFile
     * @param fileName 
     * @param toUser 发送给指定用户，通过proxy服务器做转发
     * @param timeout 
     */
    sendFileInNode(fileName: string, toUser?: string, timeout: number = 30000): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            try{
                if(!fs.existsSync(fileName)) {
                    reject({
                        statusCode: "F_404",
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
                                return this.sendFileBuffer(param, toUser, timeout);
                            }).then(() => {
                                console.log("All chunk was send success");
                            }).catch((err) => {
                                reject(err);
                            });
                        });
                        this.sendFileResolve = resolve;
                        this.sendFileReject = reject;
                    }
                }
            }catch(e) {
                console.error(e);
                reject({
                    statusCode: "F_500",
                    message: e.message,
                    error: e
                });
            }
        });
    }
    /**
     * 分段发送Buffer数据，当前方法只使用与Nodejs环境
     * @param fileData 文件数据
     * @param timeout 超时时间
     */
    private sendFileBuffer(fileData: TypeSendFileInfo, toUser: string = "", timeout: number = 30000): Promise<any> {
        const now = new Date();
        return new Promise<any>((resolve, reject) => {
            try{
                if(!this.sendFileTime || now.getTime() - this.sendFileTime.getTime() > timeout) {
                    reject({
                        statusCode: "SEND_FILE_TIMEOUT",
                        message: "timeout no reponse from client"
                    });
                } else {
                    this.options.sendAsync({
                        msgType: "SendFileProcessing",
                        data: {
                            fileName: fileData.fileName,
                            fileType: fileData.fileType,
                            fileLength: fileData.fileLength,
                            fileId: fileData.fileId,
                            index: fileData.index
                        },
                        toUser: toUser !== undefined && !this.isEmpty(toUser) ? [ toUser] : [],
                        shouldBack: true
                    }).then((myMsgData: TypeMsgData) => {
                        try{
                            const respData: any = myMsgData.data;
                            const msgData = {
                                index: respData.index,
                                id: respData.id,
                                toUser: myMsgData.toUser ? myMsgData.toUser : myMsgData.from
                            };
                            const newData = this.encodeMsgPackage(fileData.fileData, msgData, this.isNode(), SEND_FILE_PACKAGE_TAG);
                            this.options.send({
                                msgType: "SendFileResp",
                                data: newData
                            });
                            resolve({});
                        } catch(e) {
                            console.error(e);
                            reject({
                                statusCode: "F_500",
                                message: e.message,
                                error: e
                            });
                        }
                    }).catch((err) => {
                        reject(err);
                    });
                }
            }catch(e) {
                console.error(e);
                reject({
                    statusCode: "F_500",
                    message: e.message,
                    error: e
                });
            }
        });
    }
    /**
     * 发送文件Blob数据，用于Browser端
     * @param fileInfo 文件信息
     * @param toUID 发送socket id, 通过server转发至指定的client
     * @param timeout 单个请求超时时间
     */
    sendFile(fileInfo:TypeClientSendFileInfo, toUID:string = "", timeout: number = 30000): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if(!fileInfo || !fileInfo.fileData) {
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
                    const fileId = this.guid();
                    const fileLength = fileInfo.fileData.size;
                    this.sendFileTime = new Date();
                    let fileParams:TypeQueueCallParam[] = [];
                    let chunkSize: number = 4089;
                    let maxLen = Math.ceil(fileLength / chunkSize);
                    for(let i=0;i<maxLen;i++) {
                        const chunkLen = i > maxLen - 1 ? chunkSize : fileLength - ((i-1)*chunkSize);
                        const chunk = fileInfo.fileData.slice(i*chunkSize, chunkLen);
                        const fileParam: TypeClientSendFileInfo = {
                            fileName: fileInfo.fileName,
                            fileLength,
                            fileType: fileInfo.fileType,
                            fileData: chunk,
                            fileId,
                            index: i,
                            toUser: toUID
                        };
                        fileParams.push({
                            id: fileId + "_" + i,
                            params: fileParam
                        });
                    }
                    queueCallFunc(fileParams, ({}, params:any):any => {
                        return this.sendFileBlob(params, toUID, timeout);
                    }, {
                        throwException: true
                    }).then(() => {
                        console.log("Send File Process Complete");
                    }).catch((err:any) => {
                        reject(err);
                    });
                    this.sendFileResolve = resolve;
                    this.sendFileReject = reject;
                }
            }
        });
    }
    sendFileBlob(fileData: TypeSendFileInfo, toUID:string = "", timeout: number = 30000): Promise<any> {
        const now = new Date();
        return new Promise<any>((resolve, reject) => {
            if(!this.sendFileTime || now.getTime() - this.sendFileTime.getTime() > timeout) {
                reject({
                    statusCode: "SEND_FILE_TIMEOUT",
                    message: "timeout no reponse from client"
                });
            } else {
                this.options.sendAsync({
                    msgType: "SendFileProcessing",
                    data: {
                        fileName: fileData.fileName,
                        fileType: fileData.fileType,
                        fileLength: fileData.fileLength,
                        fileId: fileData.fileId,
                        index: fileData.index,
                    },
                    toUser: this.isEmpty(toUID) ? [toUID] : null,
                    shouldBack: true,
                    backMsgType: "SendFileResp"
                }).then((myMsgData: TypeMsgData) => {
                    const respData:any = myMsgData.data;
                    const msgData = {
                        index: respData.index,
                        id: respData.id,
                        toUser: myMsgData.toUser ? myMsgData.toUser[0] : myMsgData.from
                    };
                    const newData = this.encodeMsgPackage(fileData.fileData, msgData, this.isNode(), SEND_FILE_PACKAGE_TAG);
                    this.options.send({
                        msgType: "SendFileResp",
                        data: newData
                    });
                    resolve({});
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }
    onReceiveBlob(blobData:Blob,option: TypeReceiveFileMessageOptions): void {
        this.receiveBinaryData(blobData, option);
    }
    onReceiveBuffer(data:Buffer, option: TypeReceiveFileMessageOptions): void {
        this.receiveBinaryData(data, option);
    }
    onReceiveMessage(msgData: TypeMsgData, option: TypeReceiveFileMessageOptions): boolean {
        if(msgData.msgType === "SendFileProcessing") {
            const msgId = msgData.msgId;
            const msgIndex = (<any>msgData.data).index;
            const msgFileId = (<any>msgData.data).fileId;
            const toUser = msgData.toUser; // 这是一个数组
            if(this.isEmpty(toUser) || (this.isArray(toUser) && toUser.length <= 0)) {
                if(this.reciveFileData[msgFileId]) {
                    this.reciveFileData[msgFileId]["fileData"][msgIndex] = "";
                } else {
                    this.reciveFileData[msgFileId] = {
                        fileName: (<any>msgData.data).fileName,
                        fileType: (<any>msgData.data).fileType,
                        fileLength: (<any>msgData.data).fileLength,
                        fileData: {}
                    };
                    this.reciveFileData[msgFileId]["fileData"][msgIndex] = "";
                    this.callListener("Start", {
                        fileName: (<any>msgData.data).fileName,
                        fileType: (<any>msgData.data).fileType,
                        fileLength: (<any>msgData.data).fileLength,
                        fileId: msgFileId
                    });
                }
                this.socket.send(JSON.stringify({
                    msgType: msgData.backMsgType,
                    msgId,
                    callback: true,
                    toUser: [msgData.from], // 当从一个客户端传到另一个客户端时通过服务端中转以后消息里面带有from值，在转消息是传回原来的客户端
                    data: {
                        index: msgIndex,
                        id: msgFileId
                    }
                }));
            } else {
                // option.clientSide === false, 服务端接收到消息，即可从请求header拿到客户端id
                // option.clientSide === true, 即是当前在客户端接收到需要转发的消息, 这种情况是不应该出现的，所有的消息都必须经过服务器，如果有转发数据服务端已经处理，是不应该出现在这里的
                // toUser不为空时当前消息需要做转发，转发以后清空toUser，下一个接收到的节点不在做转发
                // (<any>msgData.data).toUser = null;
                if(!option.clientSide && this.isArray(toUser)) {
                    // 在服务端接收到转发消息，toUser不为空时直接转发至客户端
                    // 将from设置为当前接入的socket id，这样在client端需要直接对话可以将from设置为toUser
                    msgData.from = option.from;
                    this.options.sendTo(msgData, toUser);
                } else {
                    console.error("错误消息，当前消息转发至错误客户端", msgData);
                }
            }
            return true;
        } else if(msgData.msgType === "SendFileComplete") {
            if(this.isArray(msgData.toUser) && msgData.toUser.length > 0) {
                // toUser不是空标识需要做转发
                this.options.sendTo(msgData, msgData.toUser);
            } else {
                // 文件发送结束，清除记录
                if(msgData.backFailResult) {
                    this.sendFileReject(msgData.data);
                } else {
                    this.sendFileResolve(msgData.data);
                }
            }
            return true;
        } else {
            return false;
        }
    }
    /**
     * 接收到二进制数据，判断运行环境，调用对应的方法解析数据结构
     * @param data 二进制数据包
     */
    private receiveBinaryData(data: Blob|Buffer, option: TypeReceiveFileMessageOptions): void {
        const isNode = this.isNode();
        this.decodeMsgPackage(data, isNode, SEND_FILE_PACKAGE_TAG)
            .then((packageData: TypeMsgPackage) => {
                if(this.isEmpty(packageData.info.toUser)) {
                    // 保存文件到本地，判断是否完成文件传输
                    const fileId = packageData.info.id;
                    const fileIndex = packageData.info.index;
                    const saveFileInfo = this.reciveFileData[fileId];
                    const allFileLength:number = this.reciveFileData[fileId]["fileLength"];
                    let saveLength = 0;
                    this.reciveFileData[fileId]["fileData"][fileIndex] = packageData.data;
                    // 读取所有数据做判断
                    const saveFileData = saveFileInfo["fileData"] || {};
                    Object.keys(saveFileData).map((sIndex) => {
                        const fType = this.getType(saveFileData[sIndex]);
                        if(!isNode) {
                            if(fType === "[object Blob]" || fType === "[object Uint8Array]") {
                                saveLength += (saveFileData[sIndex] as Blob).size;
                            }
                        } else {
                            if(fType === "[object Buffer]" || fType === "[object Uint8Array]") {
                                saveLength += (saveFileData[sIndex] as Buffer).length;
                            }
                        }
                    });
                    if(saveLength >= allFileLength) {
                        // 文件传输完成
                        // 合并文件
                        const fileAllData = this.reciveFileData[fileId];
                        const fileBinaryData = fileAllData["fileData"];
                        const allBinaryDataParts:any[] = [];
                        let fileBinary: any;
                        Object.keys(fileBinaryData).map((fKey) => {
                            allBinaryDataParts.push(fileBinaryData[fKey]);
                        });
                        if(!isNode) {
                            // Browser端，没有Buffer需要使用Blob来合并二进制数据
                            const fileType = this.getFileType(fileAllData.fileType);
                            fileBinary = new Blob(allBinaryDataParts, {type: fileType});
                        } else {
                            // NodeJs环境，只能使用Buffer合并数据
                            fileBinary = Buffer.concat(allBinaryDataParts);
                        }
                        this.socket.send(JSON.stringify({
                            msgType: SendFileTypes.complete,
                            msgId: this.guid(),
                            data: fileId,
                            from: option.from,
                            toUser: !this.isEmpty(packageData.info.from) ? [packageData.info.from] : null
                        }));
                        this.callListener("End", {
                            ...fileAllData,
                            fileData: fileBinary,
                            percent: "100%",
                            total: allFileLength,
                            loaded: saveLength
                        });
                        delete this.reciveFileData[fileId];
                    } else {
                        this.socket.send(JSON.stringify({
                            msgType: SendFileTypes.response,
                            msgId: fileId,
                            callback: true
                        }));
                        this.callListener("Progress", {
                            fileId,
                            fileName: saveFileInfo.fileName,
                            fileType: saveFileInfo.fileType,
                            percent: ((saveLength / allFileLength) * 100).toFixed(2) + "%",
                            total: allFileLength,
                            loaded: saveLength
                        });
                    }
                } else {
                    // toUser不为空，表示当前数据需要做转发, 转发数据包到指定client, 删除toUser防止再次做转发陷入死循环
                    const toUser = packageData.info.toUser;
                    const infoData = packageData.info;
                    const fileData = packageData.data;
                    infoData.toUser = "";
                    infoData.from = option.from;
                    const sendData = this.encodeMsgPackage(fileData, infoData, isNode, SEND_FILE_PACKAGE_TAG);
                    this.options.sendTo({
                        msgType: "SendFileResp",
                        data: sendData
                    }, [toUser]);
                }
            }).catch((err:any) => {
                console.error(err);
            })
    }
    private getFileType(fileType: string): string {
        const fType:any = /^\./.test(fileType) ? fileType : "." + fileType;
        return (fileTypes as any)[fType] || "*.*";
    }
    private callListener(eventName: TypeReceiveFileEventName, ...arg:any[]): void {
        const listener = this.eventListener[eventName];
        if(listener && this.isArray(listener) && listener.length > 0) {
            listener.map((callback:Function) => {
                callback.apply(this, arg);
            });
        }
    }
}
