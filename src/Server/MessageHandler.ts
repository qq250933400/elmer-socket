import { AppService } from "elmer-common";
import { Server as WebSocketServer } from "ws";
import { Client, IClientInstanceInfo } from "./Client";
import { IMsgData, IServerClientData } from "../data/IMessage";
import { Log } from "../common/Log";
import { CommonUtils } from "../utils/CommonUtils";
import { ASevModel } from "./ASevModel";
import { CONST_MESSAGE_USE_FILTERKEYS } from "../data/const";


@AppService
export class MessageHandler {
    public socketServer!: WebSocketServer;
    public getModel!: <T={}>(Factory: new(...args:[]) => {}) => T;
    public getAllModel!: () => ASevModel[];
    public getClients!: () => IClientInstanceInfo[];
    public sendToEx!: (toUsers: string[], msgData: IMsgData) => any;
    public sendToAllEx!: (msgData: IMsgData) => any;

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
    public onMessage<T={}>(clientId: string, msgData: IMsgData<T>, event: MessageEvent, info: IServerClientData): void {
        const AllModels = this.getAllModel();
        AllModels.forEach((Model: ASevModel) => {
            const useMessages: any[] = Reflect.getMetadata(CONST_MESSAGE_USE_FILTERKEYS, Model) || [];
            if(useMessages.includes(msgData.type) || useMessages.length <= 0) {
                const obj: any = this.getModel(Model as any);
                if(typeof obj.onMessage === "function") {
                    obj.onMessage({ ...event, data: { ...msgData, fromUser: clientId }, dataType: msgData.type}, info);
                } else {
                    if(useMessages.length > 0) {
                        this.log.error(`Model未实现onMessage方法。（${(Model as any).name}）`);
                    }
                }
            }
        });
    }
}