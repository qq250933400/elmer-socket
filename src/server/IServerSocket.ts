import { ServerSocket } from "./ServerSocket";

export type TypeWebsocketConfig = {
    host?: string;
    port?: number;
};

export type TypeBaseMsgType = "Connected" | "Chat" | "SendFileProcessing" | "SendFileEnd" | "SendFileResp"|"SendFileComplete";
export type TypePluginLifeCycle = "onMessage"|"onConnection"|"onClose"|"onError";


export type TypeMsgData<T={}> = {
    data: string|object|number|Array<{}>|ArrayBuffer|SharedArrayBuffer|Blob|ArrayBufferView;
    msgId?: string;
    msgType: TypeBaseMsgType | T;
    shouldBack?: boolean;
    backMsgType?: TypeBaseMsgType | T;
    backFailResult?: boolean;
    callback?: boolean;
};

export type TypeSocketEvent<T = {}> = {
    break?: boolean;
    argvs?: any[];
    socket: ServerSocket;
    uid: string;
    data: TypeMsgData<T>;
};