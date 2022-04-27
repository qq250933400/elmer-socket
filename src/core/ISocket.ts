export type TypeServerSocketConfig = {
    host: string;
    port: number;
};

export type TypeServerSocketOptions<Models={}> = {
    models: {[P in keyof Models]: any};
};

export type TypeBaseMsgType = "Connected" | "Beat" | "Chat" | "Binary";
export type TypePluginLifeCycle = "onClose" | "onError" | "onConnected" | "onMessage" | "onStartReceiveFile" | "onEndReceiveFile" | "onSendFileProgress";
export type TypeBaseModelMethod = "onClose" | "onError" | "onOpen" | "onMessage";

export type TypeMsgData<T="None", ExtArr = {}> = {
    data?: string|object|number|Array<{}>|Blob;
    msgId?: string;
    msgType: TypeBaseMsgType | T;
    toUser?: string[]|null; // 发送消息给指定用户
    from?: string;
    rNotify?: boolean;
    isBacked?: boolean;
} & ExtArr;


// for webclient

export type TypeWebclientConfig = {
    host: string;
    port: number;
};

export type TypeWebClientOptions<Models={}> = {
    models?: {[P in keyof Models]: any};
    retryTime?: number;
    autoConnect?: boolean;
    host: string;
    port: number;
};

export type TypeServerMessageEvent<TypeDefineMsgData={}> = {
    message: MessageEvent;
    client: WebSocket;
    reply<MT extends keyof TypeDefineMsgData>(msgData: TypeMsgData<MT, TypeDefineMsgData[MT]>): any;
    type: keyof TypeDefineMsgData;
    fromUser: string;
}

export type TypeClientModelOptions = {
    send<T="None", Attr={}>(data: TypeMsgData<T, Attr>): Promise<any>;
};

export type TypeServerMessageEventEx<DefineMsgData, DefineMsgType extends keyof DefineMsgData> = {
    reply: <MsgType extends keyof DefineMsgData>(data: TypeMsgData<MsgType, DefineMsgData[MsgType]>) => Promise<any>;
    sendTo: <MsgType extends keyof DefineMsgData>(uid: string[], msgData: TypeMsgData<MsgType, DefineMsgData[MsgType]>) => Promise<any>;
    sendToAll: <MsgType extends keyof DefineMsgData>(msgData: TypeMsgData<MsgType, DefineMsgData[MsgType]>) => Promise<any>;
    data: TypeMsgData<DefineMsgType, DefineMsgData[DefineMsgType]>;
    message: MessageEvent;
};

export type TypeServerModelOption<DefineMsgData> = {
    reply: <MsgType extends keyof DefineMsgData>(data: TypeMsgData<MsgType, DefineMsgData[MsgType]>) => Promise<any>;
    sendTo: <MsgType extends keyof DefineMsgData>(uid: string[], msgData: TypeMsgData<MsgType, DefineMsgData[MsgType]>) => Promise<any>;
    sendToAll: <MsgType extends keyof DefineMsgData>(msgData: TypeMsgData<MsgType, DefineMsgData[MsgType]>) => Promise<any>;
};

export type TypeWebMessageEvent<DefineMsgData, MsgType extends keyof DefineMsgData> = {
    message: MessageEvent;
    data: DefineMsgData[MsgType];
    send: (data: DefineMsgData[MsgType]) => Promise<any>;
};

export type TypeWebModelOption<DefineMsgData> = {
    send: <MsgType extends keyof DefineMsgData>(data: TypeMsgData<MsgType, DefineMsgData[MsgType]>) => Promise<any>;
};
