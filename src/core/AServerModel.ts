import { TypeMsgData } from "./ISocket";
import { ServerSocket } from "./ServerSocket";
import { AModel } from "./AModel";

export type TypeUndeliveredMessageEvent = {
    type: string;
    data: any
}

export abstract class AServerModel extends AModel{
    private server: ServerSocket;
    constructor(_server: ServerSocket) {
        super();
        this.server = _server;
    }
    public abstract undeliveredMessages?(message: TypeUndeliveredMessageEvent): boolean| undefined;
    sendTo<T="None",P={}>(msgData: TypeMsgData<T>): Promise<P> {
        return this.server.sendTo(msgData);
    }
    sendToAll<T="None",P={}>(msgData: TypeMsgData<T,P>): Promise<any> {
        return this.server.sendToAll<T,P>(msgData);
    }
}
