import { GetConfig } from "../utils/file";
import {
    TypeMsgData,
    TypeServerSocketConfig,
    TypeServerSocketOptions
} from "./ISocket";
import { IncomingMessage } from "http";
import { Server as WebSocketServer } from "ws";
import { utils } from "elmer-common";
import { ServerClient } from "./ServerClient";
import { Base } from "./Base";
import { ServerModel } from "./ServerModel";

export class ServerSocket extends Base {
    @GetConfig<TypeServerSocketConfig>("./config/server_socket.json", {
        host: "0.0.0.0",
        port: 8000
    })
    private config: TypeServerSocketConfig;

    private models: any[] = [];
    private modelObjs: any = {};
    private socketServer: WebSocketServer;
    private connections: any = {};
    private msgHooks: any = {};
    constructor(options: TypeServerSocketOptions) {
        super();
        this.models = [ ServerModel, ...(options.models || []) ];
        if(this.models.length > 0) {
            for(const Factory of this.models) {
                if(utils.isEmpty((Factory as any).uid)) {
                    throw new Error("定义Model缺少uid静态类属性设置。");
                }
            }
        }
    }
    listen() {
        this.socketServer = new WebSocketServer({
            host: this.config.host,
            port: this.config.port,
        });
        this.socketServer.on("connection", this.onSocketConnection.bind(this));
        this.log(`Socket server runing: http://${this.config.host}:${this.config.port}`, "SUCCESS");
    }
    private onSocketConnection(socket: WebSocket, req:IncomingMessage): void {
        // const ip = req.headers['x-forwarded-for'].split(/\s*,\s*/)[0];
        const uid = "io_sev_" + utils.guid();
        (<any>socket).uid = uid;
        this.connections[uid] = new ServerClient(socket, {
            id: uid,
            request: req,
            callApi: this.callModelApi.bind(this),
            onClose: (evt: CloseEvent) => {
                const client = evt.target;
                const cid = (client as any).uid;
                this.connections[cid] = null;
                delete this.connections[cid];
                console.log("client", client);
                this.log("释放连接： " + cid, "DEBUG");
            },
            sendToAll: this.sendToAll.bind(this),
            sendTo: this.sendTo.bind(this)
        });
        this.callModelApi("Connection", socket, req);
        this.log("客户端连接：" + uid, "DEBUG");
    }
    sendToAll<T="None", P={}>(msgData: TypeMsgData<T, P>): void {
        const msgId = "sev_msg_" + utils.guid();
        const sendMsg: any = msgData.msgType !== "Binary" ? msgData.data : JSON.stringify({
            ...msgData,
            msgId
        });
        Object.keys(this.connections).forEach((cid: string) => {
            const client:ServerClient = this.connections[cid];
            client.send(sendMsg)
        });
    }
    sendTo<T="None", P={}>(msgData: TypeMsgData<T>, toUser: string): Promise<P> {
        return new Promise<P>((resolve, reject) =>{
            const msgId = "sev_msg_" + utils.guid();
            const sendMsg = msgData.msgType !== "Binary" ? JSON.stringify({
                ...msgData,
                msgId,
            }) : msgData.data;
            if(this.connections[toUser]) {
                (this.connections[toUser] as ServerClient).send<T,P>(sendMsg as any);
            }
            if(msgData.rNotify) {
                this.msgHooks[msgId] = {
                    resolve,
                    reject
                };
            } else {
                resolve({
                    statusCode: 200,
                    message: "send success"
                } as any);
            }
        });
    }
    /**
     * 调用自定义模块方法
     * @param eventName - 指定模块和调用方法名
     * @param args - 传递参数
     * @returns 返回值
     */
    private callModelApi(eventName: string, ...args: any[]): any {
        const AllModels: any[] = this.models || [];
        const targetMatch = eventName.match(/^([a-z0-9_-]{1,})\.([a-z0-9_-]{1,})$/i);
        const targetId = targetMatch ? targetMatch[1] : null;
        const targetName = targetMatch ? targetMatch[2] : null;
        let callApiResult: any;
        for(const modelFactory of AllModels){
            const uid = modelFactory.uid;
            if(!utils.isEmpty(uid) && (utils.isEmpty(targetId) || (!utils.isEmpty(targetId) && targetId === uid))) {
                const callEventName = targetName && !utils.isEmpty(targetName) ? targetName : eventName;
                let modelObj = this.modelObjs[uid];
                if(!modelObj) {
                    modelObj = new modelFactory();
                    this.modelObjs[uid] = modelObj;
                }
                if(typeof modelObj[callEventName] === "function"){
                    callApiResult = modelObj[callEventName].apply(modelObj, args);
                    if(callApiResult) {
                        return callApiResult;
                    }
                    if(typeof modelObj.undeliveredMessages === "function" && modelObj.undeliveredMessages.apply(modelObj, args)) {
                        break;
                    }
                }
            }
        }
    }
}