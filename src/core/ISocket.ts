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
};

export type TypeServerMessageEvent = {
    message: MessageEvent;
    client: WebSocket;
    reply<T='None', P={}>(msgData: TypeMsgData<T,P>): any;
    type: string;
    fromUser: string;
}

export type TypeClientModelOptions = {
    send<T="None", Attr={}>(data: TypeMsgData<T, Attr>): Promise<any>;
};