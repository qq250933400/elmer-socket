// import ConfigSchema from "../config/ServerConfig.schema";
import { AppService } from "elmer-common";
import { Server as WebSocketServer } from "ws";
import { Client, IClientInstanceInfo } from "./Client";
import { IMsgData, IServerClientData } from "../data/IMessage";
import { Log } from "../common/Log";
import { CommonUtils } from "../utils/CommonUtils";
import { ASevModel } from "./ASevModel";
import { CONST_MESSAGE_USE_FILTERKEYS,
    // CONST_SERVER_CONFIG_FILENAME,
    // CONST_SERVER_CONFIG_INITDATA
} from "../data/const";
import { utils } from "elmer-common";

// import { GetConfig } from "../common/decorators";
// import { IServerConfig } from "../config/IServerConfig";

@AppService
export class MessageHandler {
    // @GetConfig<IServerConfig>(CONST_SERVER_CONFIG_FILENAME, CONST_SERVER_CONFIG_INITDATA, ConfigSchema)
    // ​private​ config: IServerConfig;

    public socketServer!: WebSocketServer;
    public getModel!: <T={}>(Factory: new(...args:[]) => {}) => T;
    public getAllModel!: () => ASevModel[];
    public getClients!: () => IClientInstanceInfo[];
    public sendToEx!: (toUsers: string[], msgData: IMsgData) => any;
    public sendToAllEx!: (msgData: IMsgData) => any;
    public getClientById!: (findClientId: string) => Client|null;

    private msgHandle: any = {};

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
                fromUser: data.fromUser,
                cookie: data.cookie
            }, this.com.isNode());
            client.socket.send(sendData);
        } else {
            delete (data as any).toUsers;
            client.socket.send(JSON.stringify(data));
        }
    }
    public sendToExAsync(client: Client, data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const msgId = "msg_" + utils.guid();
            this.msgHandle[msgId] = {
                resolve,
                reject
            };
            if(client.socket.readyState === 1) {
                this.sendTo(client, {
                    ...data,
                    msgId,
                    waitReply: true
                });
            } else {
                reject({
                    message: "Client未就绪"
                });
            }
        });
    }
    public onMessage<T={}>(msgData: IMsgData<T>, event: MessageEvent, api: IServerClientData): void {
        const AllModels = this.getAllModel();
        if(msgData.toUsers && msgData.toUsers.length > 0) {
            const sendData = { ...msgData };
            sendData.toUsers = null;
            sendData.fromUser = api.uid;
            for(const userId of msgData.toUsers) {
                const client = this.getClientById(userId);
                if(client) {
                    client.socket.send(JSON.stringify(sendData));
                    if(msgData.type === "GET_FILE_META_DD53B78F790FE48FAEB09E004B0F" ||
                    msgData.type === "CONST_READY_FILE_META_DD53B78F790FE48FAEB09E004B0F" ||
                    msgData.type === "GetLogFile") {
                        console.log("redirect to:", sendData);
                        console.log("toUserId:", userId);
                    }
                }
            }
            return;
        }
        AllModels.forEach((Model: ASevModel) => {
            const useMessages: any[] = Reflect.getMetadata(CONST_MESSAGE_USE_FILTERKEYS, Model) || [];
            if(useMessages.includes(msgData.type) || useMessages.length <= 0) {
                const obj: any = this.getModel(Model as any);
                if(typeof obj.onMessage === "function") {
                    obj.onMessage({ ...event, data: { ...msgData, fromUser: api.uid }, dataType: msgData.type}, {
                        ...api,
                        reply: (data: any) => {
                            this.sendToEx([api.uid], {
                                ...data,
                                waitReply: false,
                                fromUser:  msgData.fromUser || "ApplicationServer",
                                type: msgData.type.toString() + "_Response",
                                msgId: msgData.msgId
                            });
                        }
                    });
                } else {
                    if(useMessages.length > 0) {
                        this.log.error(`Model未实现onMessage方法。（${(Model as any).name}）`);
                    }
                }
            }
        });
    }
    
}