import { OpenEvent } from "ws";
import { AModel } from "./AModel";
import { TypeClientModelOptions, TypeMsgData } from "./ISocket";

export abstract class AClientModel extends AModel {
    public socket:WebSocket;
    private options: TypeClientModelOptions;
    constructor(_socket: WebSocket, _options: TypeClientModelOptions) {
        super();
        this.socket = _socket;
        this.options = _options;
    }
    public onClose?(event:CloseEvent):void;
    public onError?(event:ErrorEvent):void;
    public onOpen?(event: OpenEvent):void;
    public abstract onMessage?(event:MessageEvent):void;
    public abstract undeliveredMessages?(message: MessageEvent): boolean | undefined;
    public sendMsg<T="", P={}, Attr={}>(msgData: TypeMsgData<T, Attr>): Promise<P> {
        return this.options.send<T, Attr>(msgData as any);
    }
}