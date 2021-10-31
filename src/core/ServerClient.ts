import { utils } from "elmer-common";
import { IncomingMessage } from "http";
import { TypeMsgData } from "./ISocket";

type TypeModelMethodNames = "Connection" | "onError" | "onOpen" | "onClose" | "onMessage";
type TypeSocketCloseEventHandler = (ev:CloseEvent) => any;
type TypeCallModelApi = (eventName: TypeModelMethodNames, ...args: any[]) => any;
type TypeSendAllApi = <T="None", P={}>(msgData: TypeMsgData<T,P>) => void;
type TypeSendToApi = <T="None", P={}>(msgData: TypeMsgData<T,P>) => Promise<any>;

type TypeServerSorketOptions = {
    id: string;
    request: IncomingMessage;
    callApi: TypeCallModelApi;
    onClose: TypeSocketCloseEventHandler;
    sendToAll: TypeSendAllApi;
    sendTo: TypeSendToApi;
    // sendToAsync(msgData: TypeMsgData, toList: string[]): Promise<any>;
};

export class ServerClient {
    private socket: WebSocket;
    private options: TypeServerSorketOptions;
    private msgHooks: any = {};
    constructor(_socket: WebSocket, _option: TypeServerSorketOptions) {
        this.socket = _socket;
        this.options = _option;
        this.socket.addEventListener("close", _option.onClose as any);
        this.socket.addEventListener("open",this.socketOpen.bind(this));
        this.socket.addEventListener("message", this.onMessage.bind(this));
    }
    public send(msgData: TypeMsgData): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            const msgId: string = msgData.msgId || "sev_msg_" + utils.guid();
            if(msgData.msgType !== "Binary") {
                this.msgHooks[msgId] = {
                    resolve,
                    reject
                };
                this.socket.send(JSON.stringify(msgData))
            } else {
                this.socket.send(JSON.stringify(msgData))
                resolve({
                    status: 200,
                    message: "success"
                });
            }
        });
    }
    private socketOpen(ev: Event) {
        this.options.callApi("onOpen", ev);
    }
    private onMessage(message: MessageEvent) {
        const msgData = utils.isString(message.data) ? JSON.parse(message.data) : message.data;
        this.options.callApi("onMessage", {
            message,
            client: this.socket,
            reply: this.send.bind(this),
            type: "message",
            data: message.data,
            uid: this.options.id
        }, msgData);
    }
}