import { Common, queueCallFunc } from "elmer-common";
import fileTypes from "./fileTypes";
import { SendFileTypes } from "./IClient";
import { TypeMsgData } from "../server/IServerSocket";

type TypeReceiveFileEventName = "Start" | "End" | "Progress";

export default class ClientReceiveFile extends Common {
    private reciveFileData: any = {};
    private socket:WebSocket;
    private eventListener:any = {};
    constructor(socket:WebSocket) {
        super();
        this.socket = socket;
    }
    on(eventName: TypeReceiveFileEventName, callback:Function): void {
        if(!this.eventListener[eventName]) {
            this.eventListener[eventName] = [];
        }
        this.eventListener[eventName].push(callback);
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
                    const infoData = option.lastResult.info;
                    const fileData = option.lastResult.data;
                    const fileId = infoData.id;
                    const fileIndex = infoData.index;
                    this.reciveFileData[fileId]["fileData"][fileIndex] = fileData;
                }
            }
        ]).then((resp:any) => {
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
        console.log(data);
    }
    onReceiveMessage(msgData: TypeMsgData): boolean {
        if(msgData.msgType === "SendFileProcessing") {
            const msgId = msgData.msgId;
            const msgIndex = (<any>msgData.data).index;
            const msgFileId = (<any>msgData.data).fileId;
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
                data: {
                    index: msgIndex,
                    id: msgFileId
                }
            }));
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
