import {  AppService, utils, Observe } from "elmer-common";
import { CommonUtils } from "../utils/CommonUtils";
import { BaseLog } from "../common/BaseLog";
import { IServerClientData } from "src/data/IMessage";
import mediaData from "../utils/mediaTypes";

const CONST_SEND_FILE_DATA = "SEND_FILE_DATA_DD53B78F790FE48FAEB09E004B0F";
const CONST_RECEIVE_FILE_DATA = "RECEIVE_FILE_DATA_DD53B78F790FE48FAEB09E004B0F";
const CONST_GET_FILE_META  = "GET_FILE_META_DD53B78F790FE48FAEB09E004B0F";
const CONST_READY_FILE_META  = "CONST_READY_FILE_META_DD53B78F790FE48FAEB09E004B0F";
const CONST_GET_FILE_DATA = "GET_FILE_DATA_DD53B78F790FE48FAEB09E004B0F";
const CONST_COMPLETED = "COMPLETED_DD53B78F790FE48FAEB09E004B0F";
const CONST_FINISHED = "CLIENT_FINISHED_DD53B78F790FE48FAEB09E004B0F"; // 全部chunk接收完成，通知客户端释放缓存数据
const CONST_RETRY_CHUNKS = "CLIENT_RETRY_CHUNKS_DD53B78F790FE48FAEB09E004B0F"; // 有部分chunk发送失败，通知客户端发起重试请求
const CONST_FAILED = "FAILED_DD53B78F790FE48FAEB09E004B0F";

const CONST_MESSAGE_LIST = [
    CONST_SEND_FILE_DATA,
    CONST_RECEIVE_FILE_DATA,
    CONST_GET_FILE_META,
    CONST_READY_FILE_META,
    CONST_GET_FILE_DATA,
    CONST_COMPLETED,
    CONST_FINISHED,
    CONST_RETRY_CHUNKS
];
export interface ITempData {
    msgId: string;
    msgType: string;
    size: number;
    blockSize: number;
    filename: string;
    name: string;
    send: Blob|ArrayBuffer|Function,
    receive: any;
    socket: WebSocket;
    toUser: string;
    eventMsgId: string;
    index?: number;
    contentType: string;
}
export type TypeReadChunk = (tempData: ITempData, offset: number, readSize: number) => Promise<{ size: number, data: Blob|ArrayBuffer }>;
export interface ISendFileOptions {
    msgId: string;
    msgType: string;
    eventMsgId: string;
    fileData: Blob | TypeReadChunk;
    filename: string;
    name: string;
    size: number;
    blockSize?: number;
    socket: WebSocket;
    toUser: string;
    contentType?: string;
}

interface IFileMsgData {
    msgId: string;
    size: number;
    index: number;
    data: Blob;
}
interface IFileMeta {
    msgId: string;
    name: string;
    filename: string;
    size: number;
    blockSize: number;
    contentType: string;
    eventMsgId: string;
}
interface IFileTransferInfo {
    fileId: string;
    msgId: string;
}
export interface IFileTransferProgressEvent extends IFileTransferInfo {
    percent: string;
}
interface IFileTransferEvent {
    onStart: (event: IFileTransferInfo) => void;
    onProgress: (event: IFileTransferProgressEvent) => void;
    onComplete: (event: IFileTransferInfo & { data: Blob|ArrayBuffer } ) => void;
}

@AppService
export class FileTransfer {
    public isNode: boolean = false;
    private temp: any = {};
    private log!: BaseLog;
    private event: Observe<IFileTransferEvent> = new Observe<IFileTransferEvent>();
    constructor(private com: CommonUtils) {}
    on<EventName extends keyof IFileTransferEvent>(eventName: EventName, callback: IFileTransferEvent[EventName]): Function {
        return this.event.on(eventName, callback);
    }
    isSendFileMsg(msgType: string): boolean {
        return CONST_MESSAGE_LIST.includes(msgType);
    }
    sendFile(options: Pick<ISendFileOptions,Exclude<keyof ISendFileOptions, "msgId">>): string {
        const uid = "file_" + utils.guid();
        this.temp[uid] = {
            msgId: uid,
            msgType: options.msgType,
            filename: options.filename,
            name: options.name,
            size: options.size,
            blockSize: options.blockSize || 1024,
            send: options.fileData,
            toUser: options.toUser,
            eventMsgId: options.eventMsgId,
            socket: options.socket,
            contentType: options.contentType || this.getContentType(options.filename)
        }
        this.log.info("开始传输文件：" + options.filename);
        this.log.info("传输文件ID：" + uid);
        this.event.emit("onStart", { fileId: uid, msgId:  options.eventMsgId });
        this.startSend(uid);
        return uid;
    }
    onMessage(msgData: any, api: IServerClientData): boolean {
        if(CONST_MESSAGE_LIST.includes(msgData.type)) {
            switch(msgData.type) {
                // server端接收到客户端准备好接收文件消息，开始发送文件数据
                case CONST_READY_FILE_META: {
                    const msgId = msgData.data?.msgId || msgData.msgId;
                    this.log.info("客户端准备好接收文件: " + msgId);
                    this.sendData(msgId, 0);
                    break;
                }
                // [Server]服务端接收到请求文件chunk信息，发送指定chunkIndex数据
                case CONST_GET_FILE_DATA: {
                    const msgId = msgData.data?.msgId || msgData.msgId;
                    const chunkIndex = msgData.data?.index || 0;
                    this.sendData(msgId, chunkIndex);
                    break;
                }
                // [Server]服务端接收到发送结束消息，清楚缓存
                case CONST_FINISHED: {
                    const fileMsgId = msgData.msgId;
                    if(this.temp[fileMsgId]) {
                        this.temp[fileMsgId] = null;
                        delete this.temp[fileMsgId];
                        this.log.info("释放文件缓存：" + fileMsgId);
                    }
                    break;
                }
                // [Client]客户端接收到server端发送的数据，保存到本地
                case CONST_RECEIVE_FILE_DATA: {
                    const fileData: IFileMsgData = msgData;
                    const msgId = fileData.msgId || msgData.msgId;
                    const chunkIndex = msgData.index;
                    if(!this.temp[msgId]) {
                        this.temp[msgId] = {};
                        console.error("Client Not Ready for save data", );
                    }
                    const tmepData: ITempData = this.temp[msgId];
                    tmepData.receive[chunkIndex] = {
                        size: fileData.size,
                        data: fileData.data
                    }
                    tmepData.index = chunkIndex + 1;
                    this.log.debug("接收数据进度：" + msgData.percent);
                    this.event.emit("onProgress", {
                        fileId: msgId,
                        msgId: tmepData.eventMsgId,
                        percent: msgData.percent
                    });
                    // 接收到数据，发起下一个chunk请求
                    api.socket.send(JSON.stringify({
                        msgId: msgId,
                        type: CONST_GET_FILE_DATA,
                        data: {
                            index: tmepData.index,
                            blockSize: tmepData.blockSize
                        },
                        toUsers: [msgData.fromUser],
                    }));
                    break;
                }
                
                // 客户端接收到文件信息，准备接收数据环境
                case CONST_GET_FILE_META: {
                    const metaData:IFileMeta = msgData.data;
                    this.temp[metaData.msgId] = { ...metaData, receive: {}, index: 0 };
                    this.log.info("客户端准备接收传输数据：" + metaData.msgId);
                    api.socket.send(JSON.stringify({
                        msgId: metaData.msgId,
                        type: CONST_READY_FILE_META,
                        toUsers: [msgData.fromUser],
                        data: { msgId: metaData.msgId, index: 0 }
                    }));
                    break;
                }
                // 客户端接收文件完成，执行下一步
                case CONST_COMPLETED: {
                    const fileMsgId = msgData.msgId;
                    const lostChunkIndes = this.validateFile(fileMsgId);
                    if(lostChunkIndes.length <= 0) {
                        // 客户端校验数据接收完成，通知服务端释放缓存
                        api.socket.send(JSON.stringify({
                            msgId: fileMsgId,
                            type: CONST_FINISHED,
                            toUsers: [ msgData.fromUser ]
                        }));
                        // 合并数据，并释放缓存
                        this.combineData(fileMsgId);
                    } else {
                        // 发送重试消息
                        // 客户端校验数据接收完成，通知服务端释放缓存
                        api.socket.send(JSON.stringify({
                            msgId: fileMsgId,
                            type: CONST_RETRY_CHUNKS,
                            toUsers: [ msgData.fromUser ],
                            data: {
                                index: lostChunkIndes[0]
                            }
                        }));
                    }
                    break;
                }
            }
            return true;
        } else {
            return false;
        }
    }
    private combineData(fileMsgId: string): void {
        const tempData: ITempData = this.temp[fileMsgId];
        const reciveData = tempData.receive || {};
        const maxChunkIndex = Math.ceil(tempData.size / tempData.blockSize);
        if(this.isNode) {
            const storeData = Buffer.alloc(tempData.size);
            for(let i=0;i<maxChunkIndex;i++) {
                const chunkData: Buffer = reciveData[i].data;
                const offset = i * tempData.blockSize;
                // const fillSize = offset + tempData.blockSize <= tempData.size ? tempData.blockSize : tempData.size - offset;
                chunkData.copy(storeData, offset, 0, chunkData.length);
            }
            this.event.emit("onComplete", {
                fileId: fileMsgId,
                msgId: tempData.eventMsgId,
                name: tempData.name,
                fileName: tempData.filename,
                size: storeData.length,
                data: storeData
            });
            console.log("ReciveOnNodeJs:", storeData)
        } else {
            const storeData: any[] = [];
            for(let i=0;i<maxChunkIndex;i++) {
                const chunkData: Buffer = reciveData[i].data;
                storeData.push(chunkData);
            }
            const fileData = new Blob(storeData, { type: tempData.contentType || "plain/text "});
            this.event.emit("onComplete", {
                fileId: fileMsgId,
                msgId: tempData.eventMsgId,
                name: tempData.name,
                fileName: tempData.filename,
                size: tempData.size,
                data: fileData
            });
        }
        this.log.info("合并文件，并释放缓存");
        this.temp[fileMsgId] = null;
        delete this.temp[fileMsgId];
    }
    private validateFile(fileMsgId: string): number[] {
        this.log.info("校验文件是否完整:" + fileMsgId);
        const tempData: ITempData = this.temp[fileMsgId];
        const reciveData = tempData.receive || {};
        const maxChunkIndex = Math.ceil(tempData.size / tempData.blockSize);
        const missingChunkIndexs = [];
        for(let i=0;i<maxChunkIndex;i++) {
            if(!reciveData[i]) {
                missingChunkIndexs.push(i);
            }
        }
        return missingChunkIndexs;
    }
    private startSend(uid: string) {
        const tempData: ITempData = this.temp[uid];
        const meta: IFileMeta = {
            msgId: uid,
            name: tempData.name,
            filename: tempData.filename,
            size: tempData.size,
            blockSize: tempData.blockSize,
            contentType: tempData.contentType,
            eventMsgId: tempData.eventMsgId
        };
        const msgData = {
            msgId: uid,
            type: CONST_GET_FILE_META,
            data: meta,
            toUsers: [tempData.toUser]
        };
        const msgValue = JSON.stringify(msgData);
        tempData.socket.send(msgValue);
    }
    private sendData(msgId: string, index: number): void {
        const tempData: ITempData = this.temp[msgId];
        if(!tempData) {
            this.log.error("the send file temp data was disposed." + msgId);
        } else {
            const blockSzie = tempData.blockSize || 1024;
            const notSendSize = tempData.size - blockSzie * index;
            const readSize = notSendSize >= 0 ? ( notSendSize >= blockSzie ? blockSzie : notSendSize ) : -1;
            const percent = (notSendSize > 0 ? (((blockSzie * index) / tempData.size ) * 100).toFixed() : 100) + "%";
            // this.log.info("传输文件进度: " + percent);
            this.event.emit("onProgress", { fileId: msgId, msgId:  tempData.eventMsgId, percent });
            if(typeof tempData.send === "function") {
                if(readSize > 0) {
                    ((tempData.send as unknown) as TypeReadChunk)(tempData, blockSzie * index, readSize).then((sendData) => {
                        if(sendData) {
                            const newMsgData = this.com.encodeMsgPackage(sendData.data, ({
                                index,
                                msgId,
                                size: sendData.size,
                                type: CONST_RECEIVE_FILE_DATA,
                                toUsers: [ tempData.toUser ],
                                percent
                            } as any), this.isNode);
                            tempData.socket.send(newMsgData);
                        } else {
                            tempData.socket.send(JSON.stringify({
                                msgId,
                                type: CONST_FAILED,
                                data: { msgId: tempData.eventMsgId, index },
                                toUsers: [ tempData.toUser ]
                            }));
                        }
                    }).catch((err) => {
                        this.log.error(err?.stack || err?.message);
                        tempData.socket.send(JSON.stringify({
                            msgId,
                            type: CONST_FAILED,
                            data: { msgId: tempData.eventMsgId, index },
                            toUsers: [ tempData.toUser ]
                        }));
                    });
                } else {
                    tempData.socket.send(JSON.stringify({
                        msgId,
                        type: CONST_COMPLETED,
                        data: { msgId: tempData.eventMsgId },
                        toUsers: [ tempData.toUser ]
                    }));
                }
                
            } else {
                const sourceData: any = tempData.send;
                if(readSize > 0) {
                    const sendData = this.com.isBlob ? sourceData.slice(blockSzie * index, readSize) : (
                        this.com.isArrayBuffer(sourceData) ? sourceData.slice(blockSzie * index, readSize) : sourceData
                    );
                    tempData.socket.send(this.com.encodeMsgPackage(sendData, ({
                        index,
                        msgId,
                        type: CONST_RECEIVE_FILE_DATA,
                        size: sendData.size,
                        toUsers: [ tempData.toUser ],
                        percent
                    } as any), this.isNode));
                } else {
                    tempData.socket.send(JSON.stringify({
                        msgId,
                        type: CONST_COMPLETED,
                        data: { msgId: tempData.eventMsgId },
                        toUsers: [ tempData.toUser ]
                    }));
                }
            }
            tempData.index += 1;
        }
    }
    private getContentType(fileName: string): string {
        const matchData = /(\.[a-z0-9]{1,})/i.exec(fileName);
        if(matchData) {
            return (mediaData as any)[matchData[1]] || "plain/text";
        } else {
            return "plain/text";
        }
    }
}