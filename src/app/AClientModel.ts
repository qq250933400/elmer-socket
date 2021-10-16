import { utils } from "elmer-common";
import { OpenEvent } from "ws";
import { TypeMsgData } from "./ISocket";

export abstract class AClientModel {
    private socket:WebSocket;
    private msgHooks: any = {};
    constructor(_socket: WebSocket) {
        this.socket = _socket;
    }
    public onClose?(event:CloseEvent):void;
    public onError?(event:ErrorEvent):void;
    public onMessage?(event:MessageEvent):void;
    public onOpen?(event: OpenEvent):void;
    public abstract undeliveredMessages?(message: MessageEvent): boolean | undefined;
    public sendMsg<T="", P={}>(msgData: TypeMsgData<T>): Promise<P> {
        const msgId = "web_socket_msg_" + utils.guid();
        return new Promise<P>((resolve, reject) => {
            if(msgData.msgType !== "Binary") {
                this.socket.send(JSON.stringify({
                    ...msgData,
                    msgId
                }));
                this.msgHooks[msgId] = {
                    resolve,
                    reject
                }
            } else {
                reject({
                    message: "Not support msgType",
                    statusCode: 500
                });
            }
        });
    };
    protected onMessageExt(event:MessageEvent):void {
        console.log(event.type, event.data);
    }
}