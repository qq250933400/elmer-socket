import { TypeMsgData, TypeServerMessageEvent } from "./ISocket";
import { ServerSocket } from "./ServerSocket";
import { AModel } from "./AModel";

export type TypeUndeliveredMessageEvent = {
    type: string;
    data: any
}

export abstract class AServerModel<MsgType="NONE"> extends AModel{
    private server: ServerSocket;
    constructor(_server: ServerSocket) {
        super();
        this.server = _server;
    }
    public static undeliveredMessages?(message: TypeUndeliveredMessageEvent): boolean| undefined;
    public sendTo<T="None",P={}>(msgData: TypeMsgData<T>): Promise<P> {
        return this.server.sendTo(msgData);
    }
    public sendToAll<T="None",P={}>(msgData: TypeMsgData<T,P>): Promise<any> {
        return this.server.sendToAll<T,P>(msgData);
    }
    public abstract onMessage(event:TypeServerMessageEvent, msgData: TypeMsgData<MsgType>): void;
}
