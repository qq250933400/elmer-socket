import { Cookies } from "../common/Cookies";

export interface IMsgDataEx {
    text: string,
    binary: ArrayBuffer,
    blob: Blob;
    Beat: string;
    Session: string;
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
    cookie?: string;
}

export interface IMsgEvent<IMsg={}> {
    onMessage<MsgType extends keyof IMsg>(data: { type: MsgType, data: TypeUseData<IMsg, MsgType> },event: MessageEvent): void;
    onClose(event: CloseEvent): void;
    onReady(Fn: Function): void;
}

export interface IServerClientData {
    socket: WebSocket;
    ip: string;
    uid: string;
    close: Function;
    cookie: Cookies;
    reply: (data: { data?: any, exception?: any }) => void;
    aesEncode: (text: string) => string;
    aesDecode: (encodedString: string) => string;
}