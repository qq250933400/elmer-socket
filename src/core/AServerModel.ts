import { TypeMsgData, TypeServerMessageEvent } from "./ISocket";
import { ServerSocket } from "./ServerSocket";
import { AModel } from "./AModel";

type TypeMsgTypes<T> = keyof T;

export type TypeUndeliveredMessageEvent = {
    type: string;
    data: any
}

export abstract class AServerModel<MsgData={}> extends AModel{
    public msgInclude: TypeMsgTypes<MsgData>[];
    private server: ServerSocket;
    constructor(_server: ServerSocket) {
        super();
        this.server = _server;
    }
    public static undeliveredMessages?(message: TypeUndeliveredMessageEvent): boolean| undefined;
    public sendTo<T="None",P={}>(msgData: TypeMsgData<T>): Promise<P> {
        return this.server.sendTo(msgData);
    }
    public sendToAll<T extends keyof MsgData>(msgData: TypeMsgData<T,MsgData[T]>): Promise<any> {
        return this.server.sendToAll<T,MsgData[T]>(msgData);
    }
    public abstract onMessage(event:TypeServerMessageEvent, msgData: TypeMsgData<keyof MsgData>): void;
}
