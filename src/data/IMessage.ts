interface IMsgDataEx {
    text: string,
    binary: ArrayBuffer,
    blob: Blob;
    Beat: string;
}

type TypeUseData<T, NType extends keyof T> = T[NType];

export interface IMsgData<T={}, MsgType = keyof (IMsgDataEx & T)> {
    type: MsgType;
    toUsers: string[];
    fromUser?: string;
    data: TypeUseData<T & IMsgDataEx, keyof (IMsgDataEx & T)>;
    waitReply?: boolean;
    /** 不需要传此参数，服务器返回 */
    msgId?: string;
    /** 错误场景，错误信息传此参数 */
    exception?: any;
}

export interface IMsgEvent {
    onMessage(event: MessageEvent): void;
    onClose(event: CloseEvent): void;
}

export interface IServerClientData {
    socket: WebSocket;
    ip: string;
    uid: string;
    close: Function;
}