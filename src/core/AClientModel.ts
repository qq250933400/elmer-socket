import { OpenEvent } from "ws";
import { AModel } from "./AModel";
import { TypeClientModelOptions, TypeMsgData } from "./ISocket";

type TypeMsgTypes<T> = keyof T;

export abstract class AClientModel<MsgData={}> extends AModel {
    public socket:WebSocket;
    public msgInclude: TypeMsgTypes<MsgData>[];
    private options: TypeClientModelOptions;
    constructor(_socket: WebSocket, _options: TypeClientModelOptions) {
        super();
        this.socket = _socket;
        this.options = _options;
    }
    public onInit?(): void;
    public onClose?(event:CloseEvent):void;
    public onError?(event:ErrorEvent):void;
    public onOpen?(event: OpenEvent):void;
    public abstract onMessage?(event:MessageEvent):void;
    public static undeliveredMessages?(message: MessageEvent): boolean | undefined;
    public sendMsg<MsgType extends keyof MsgData, P={}>(msgData: TypeMsgData<MsgType, MsgData[MsgType]>): Promise<P> {
        return this.options.send<MsgType, MsgData[MsgType]>(msgData as any);
    }
}
