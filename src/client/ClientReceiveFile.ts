import { Common, queueCallFunc, TypeQueueCallParam } from "elmer-common";
import fileTypes from "./fileTypes";
import { SendFileTypes } from "./IClient";
import { TypeMsgData, TypeSendFileInfo } from "../server/IServerSocket";

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

export default class ClientReceiveFile extends Common {
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
                const fs = require("fs");
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
                    console.log("SendBuffer: ",this.getType(fileData.fileData));
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
                            console.log(myMsgData);
                            const msgData = {
                                index: respData.index,
                                id: respData.id,
                                toUser: myMsgData.toUser ? myMsgData.toUser : myMsgData.from
                            };
                            const infoBuffer = Buffer.from(JSON.stringify(msgData)); // 文件信息
                            const infoLength = infoBuffer.length;
                            const newData = Buffer.alloc(fileData.fileData.length + infoBuffer.length + 2);
                            fileData.fileData.copy(newData, 0,0);
                            infoBuffer.copy(newData, fileData.fileData.length, 0);

                            // 将文件信息字节长度写入Buffer最后两个字节, 
                            // 将info字节长度值转成字符在写入最后两个字节，方便在前端读取
                            const lenArrayBuffer = new Uint16Array([infoLength]);
                            const lenBuffer = Buffer.alloc(2);
                            Buffer.from(lenArrayBuffer).copy(newData, newData.length -2);
                            newData.copy(lenBuffer, 0, newData.length - 2);
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
                    // 将文件信息字节长度写入Buffer最后两个字节, 
                    // 将info字节长度值转成字符在写入最后两个字节，方便在前端读取
                    const infoBlob = new Blob([JSON.stringify(msgData)], {
                        type: "application/json"
                    });
                    const infoLength = infoBlob.size;
                    const sizeBlob = new Uint16Array([infoLength]);
                    const newData = new Blob([fileData.fileData, infoBlob, sizeBlob]);
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
    onReceiveBlob(blobData:Blob): void {
        const sizeBlob = blobData.slice(blobData.size - 2);
        queueCallFunc([
            {
                id: "readSizeBlob",
                params: "",
                fn: ():any => {
                    return new Promise<any>((resolve,reject) => {
                        const file = new FileReader();
                        file.onload = (res:any) => {
                            const infoLen = parseInt(<string>res.target.result, 10);
                            resolve(infoLen);
                        };
                        file.onerror = (err) => {
                            reject(err);
                        };
                        file.readAsBinaryString(sizeBlob);
                    });
                }
            }, {
                id: "readInfo",
                params: "",
                fn: (option):any => {
                    return new Promise<any>((resolve, reject) => {
                        const infoBlob = blobData.slice(blobData.size - option.lastResult - 2, blobData.size - 2);
                        const infoReader = new FileReader();
                        infoReader.onload = (res:any) => {
                            resolve({
                                info: JSON.parse(<string>res.target.result),
                                data: blobData.slice(0, blobData.size - option.lastResult - 2)
                            });
                        };
                        infoReader.onerror = (err) => {
                            reject(err);
                        };
                        infoReader.readAsText(infoBlob);
                    });
                }
            }, {
                id: "saveFileBlob",
                params: "",
                fn:(option): any => {
                    return new Promise<any>((resolve) => {
                        const infoData = option.lastResult.info;
                        const fileData:Blob = option.lastResult.data;
                        const toUser = infoData.toUser;
                        let dResult = {
                            proxy: false
                        };
                        if(!this.isEmpty(toUser)) {
                            infoData.toUser = "";
                            const infoBlob = new Blob(infoData, {type: "application/json"});
                            const infoLength = infoBlob.size;
                            const sizeBlob = new Uint16Array([infoLength]);
                            const newData = new Blob([fileData, infoBlob, sizeBlob]);
                            dResult.proxy = true;
                            this.options.sendTo({
                                msgType: "SendFileResp",
                                data: newData
                            }, [toUser]);
                            // 转发数据
                        } else {
                            const fileId = infoData.id;
                            const fileIndex = infoData.index;
                            this.reciveFileData[fileId]["fileData"][fileIndex] = fileData;
                        }
                        resolve(dResult);
                    });
                }
            }
        ]).then((resp:any) => {
            if(!resp.saveFileBlob.proxy) {
                const fileId = resp.readInfo.info.id;
                const saveFileInfo = this.reciveFileData[fileId];
                const saveFileData = saveFileInfo["fileData"] || {};
                const allFileLength:number = this.reciveFileData[fileId]["fileLength"];
                let saveLength = 0;
                Object.keys(saveFileData).map((sIndex) => {
                    if(!isNaN(saveFileData[sIndex].size)) {
                        saveLength += saveFileData[sIndex].size;
                    }
                });
                if(saveLength >= allFileLength) {
                    // 文件传输完成
                    // 合并文件
                    const fileAllData = this.reciveFileData[fileId];
                    const fileBinaryData = fileAllData["fileData"];
                    const allBlobData:Blob[] = [];
                    const fileType = this.getFileType(fileAllData.fileType);
                    Object.keys(fileBinaryData).map((fKey) => {
                        allBlobData.push(fileBinaryData[fKey]);
                    });
                    const mergeData = new Blob(allBlobData, {type: fileType});
                    this.socket.send(JSON.stringify({
                        msgType: SendFileTypes.complete,
                        msgId: this.guid(),
                        data: fileId
                    }));
                    this.callListener("End", {
                        ...fileAllData,
                        fileData: mergeData,
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
                console.log("Blob data transfer", resp.readInfo.info);
            }
        }).catch((error:any) => {
            // tslint:disable-next-line: no-console
            console.error(error);
            this.socket.send(JSON.stringify({
                msgType: SendFileTypes.response,
                msgId: "None",
            }));
        });
    }
    onReceiveBuffer(data:Buffer): void {
        // tslint:disable-next-line: no-console
        console.log("OnReciveBuffer", data);
        const sizeBuffer = Buffer.alloc(2);
        data.copy(sizeBuffer, 0, data.length - 2);
        queueCallFunc([
            {
                id: "readSizeBlob",
                params: "",
                fn: ():any => {
                    return new Promise<any>((resolve) => {
                        resolve(sizeBuffer.readUInt16LE(0));
                    });
                }
            }, {
                id: "readInfo",
                params: "",
                fn: (option):any => {
                    return new Promise<any>((resolve) => {
                        const infoBuffer = Buffer.alloc(option.lastResult);
                        const bodyBuffer = Buffer.alloc(data.length - option.lastResult - 2);
                        data.copy(infoBuffer, 0, data.length - option.lastResult - 2);
                        data.copy(bodyBuffer, 0, 0, bodyBuffer.length);
                        resolve({
                            info: JSON.parse(infoBuffer.toString()),
                            data: bodyBuffer
                        });
                    });
                }
            }, {
                id: "saveFileBlob",
                params: "",
                fn:(option): any => {
                    return new Promise<any>((resolve) => {
                        const infoData = option.lastResult.info;
                        const fileData:Buffer = option.lastResult.data;
                        const toUser = infoData.toUser;
                        let dResult = {
                            proxy: false
                        };
                        if(!this.isEmpty(toUser)) {
                            infoData.toUser = "";
                            const infoBuffer = Buffer.from(JSON.stringify(infoData));
                            const lenBuffer = Buffer.alloc(2);
                            const allLen = fileData.length + 2 + infoBuffer.length;
                            const msgData = Buffer.alloc(allLen);
                            lenBuffer.writeInt16BE(infoBuffer.length);
                            fileData.copy(msgData, 0,0, fileData.length)
                            infoBuffer.copy(msgData, fileData.length, 0);
                            lenBuffer.copy(msgData, fileData.length + infoBuffer.length, 0);
                            dResult.proxy = true;
                            this.options.sendTo({
                                msgType: "SendFileResp",
                                data: msgData
                            }, [toUser]);
                            // 转发数据
                        } else {
                            const fileId = infoData.id;
                            const fileIndex = infoData.index;
                            this.reciveFileData[fileId]["fileData"][fileIndex] = fileData;
                        }
                        resolve(dResult);
                    });
                }
            }
        ]).then((resp:any) => {
            if(!resp.saveFileBlob.proxy) {
                const fileId = resp.readInfo.info.id;
                const saveFileInfo = this.reciveFileData[fileId];
                const saveFileData = saveFileInfo["fileData"] || {};
                const allFileLength:number = this.reciveFileData[fileId]["fileLength"];
                let saveLength = 0;
                Object.keys(saveFileData).map((sIndex) => {
                    if(!isNaN(saveFileData[sIndex].size)) {
                        saveLength += saveFileData[sIndex].size;
                    }
                });
                if(saveLength >= allFileLength) {
                    // 文件传输完成
                    // 合并文件
                    const fileAllData = this.reciveFileData[fileId];
                    const fileBinaryData = fileAllData["fileData"];
                    const allBlobData:Blob[] = [];
                    const fileType = this.getFileType(fileAllData.fileType);
                    Object.keys(fileBinaryData).map((fKey) => {
                        allBlobData.push(fileBinaryData[fKey]);
                    });
                    const mergeData = new Blob(allBlobData, {type: fileType});
                    this.socket.send(JSON.stringify({
                        msgType: SendFileTypes.complete,
                        msgId: this.guid(),
                        data: fileId
                    }));
                    this.callListener("End", {
                        ...fileAllData,
                        fileData: mergeData,
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
                console.log("Binary Data Transfer", resp.readInfo.info);
            }
        }).catch((error:any) => {
            // tslint:disable-next-line: no-console
            console.error(error);
            this.socket.send(JSON.stringify({
                msgType: SendFileTypes.response,
                msgId: "None",
            }));
        });
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
                    console.log("------on server side -----------");
                    console.log(toUser);
                    console.log(option.from);
                    console.log(msgData);
                    this.options.sendTo(msgData, toUser);
                } else {
                    console.error("错误消息，当前消息转发至错误客户端", msgData);
                }
            }
            return true;
        } else if(msgData.msgType === "SendFileComplete") {
            // 文件发送结束，清除记录
            if(msgData.backFailResult) {
                this.sendFileReject(msgData.data);
            } else {
                this.sendFileResolve(msgData.data);
            }
            return true;
        } else {
            return false;
        }
    }
    private getFileType(fileType: string): string {
        const fType:any = /^\./.test(fileType) ? fileType : "." + fileType;
        return this.getValue(fileTypes, fType) || "*.*";
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
