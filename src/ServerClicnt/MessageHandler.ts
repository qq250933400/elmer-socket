import { AppService } from "elmer-common";
import { Server as WebSocketServer } from "ws";
import { Client } from "./Client";
import { IMsgData } from "../data/IMessage";
import { Log } from "../common/Log";
import { CommonUtils } from "../utils/CommonUtils";

@AppService
export class MessageHandler {
    public socketServer!: WebSocketServer;
    public getModel!: <T={}>(Factory: new(...args:[]) => {}) => T;
    constructor(
        private log: Log,
        private com: CommonUtils
    ) {
        this.log.init();
    }
    public sendTo<T={}>(client: Client, data: IMsgData<T>): void {
        if(["binary","blob", "file"].includes(data.type as string)) {
            const sendData = this.com.encodeMsgPackage<any>(data.data, {
                type: data.type,
                fromUser: data.fromUser
            }, this.com.isNode());
            client.socket.send(sendData);
        } else {
            delete (data as any).toUsers;
            client.socket.send(JSON.stringify(data));
        }
    }
    public onMessage<T={}>(clientId: string, msgData: IMsgData<T>): void {
        console.log(clientId, msgData);
    }
}