import { ServerSocket } from "./ServerSocket";

export type TypeFileSendProgress = {
    fileId:string;
    fileName: string;
    fileType: string;
    percent: string;
    total: number;
    loaded: number;
};
export type TypeStartSendFileEvent = {
    fileName: string;
    fileType: string;
    fileLength: number;
    fileId: string;
};
export type TypeEndSendFileEvent = {
    fileName: string;
    fileType: string;
    fileLength: number;
    fileId: string;
    fileData: Blob|Buffer;
};

export type TypeWebsocketConfig = {
    host?: string;
    port?: number;
};

export type TypeSendFileInfo = {
    fileName: string;
    fileType: string;
    fileLength: number;
    fileData: Buffer;
    fileId: string;
    index: number;
    toUser?: string;
};


export type TypeBaseMsgType = "Connected" | "Beat" | "Chat" | "SendFileProcessing" | "Promise_SendFileProcessing" | "SendFileEnd" | "SendFileResp"|"SendFileComplete";
export type TypePluginLifeCycle = "onClose" | "onError" | "onConnected" | "onMessage" | "onStartReceiveFile" | "onEndReceiveFile" | "onSendFileProgress";

export type TypeMsgData<T={}> = {
    data?: string|object|number|Array<{}>|ArrayBuffer|SharedArrayBuffer|Blob|ArrayBufferView;
    msgId?: string;
    msgType: TypeBaseMsgType | T;
    shouldBack?: boolean; // 使用promise消息设置为true,此参数不需要用户处理
    backMsgType?: TypeBaseMsgType | T; // promise模式接收到消息类型，需要在消息接收到处理此消息并返回，返回原来的msgId
    backFailResult?: boolean; // 使用promise模式时是否返回错误消息
    callback?: boolean; //
    toUser?: string[]|null; // 发送消息给指定用户
    from?: string;
};

export type TypeSocketEvent<T = {}> = {
    break?: boolean;
    argvs?: any[];
    socket: ServerSocket;
    uid: string;
    data: TypeMsgData<T>;
};

export type TypeServerSocketEvent<T={}> = TypeSocketEvent<T> & {
    sendToAll(msgData:TypeMsgData<T>, ignoreList?: string[]):void;
    sendTo(msgData: TypeMsgData<T>, toList: string[]): void;
    sendToAsync(msgData: TypeMsgData<T>, toList: string[]): Promise<any>;
};
