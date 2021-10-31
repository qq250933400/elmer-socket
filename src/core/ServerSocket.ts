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
                this.log("释放连接： " + cid, "DEBUG");
            },
            sendToAll: this.sendToAll.bind(this),
            sendTo: this.sendTo.bind(this)
        });
        this.callModelApi("onConnection", socket, req);
        this.log("客户端连接：" + uid, "DEBUG");
    }
    sendToAll<T="None", P={}>(msgData: TypeMsgData<T, P>): Promise<any> {
        const toUsers: string[] = [];
        Object.keys(this.connections).map((uid: string) => {
            toUsers.push(uid);
        });
        return this.sendTo<T,P>({
            ...msgData,
            toUser: toUsers
        });
    }
    sendTo<T="None", P={}>(msgData: TypeMsgData<T>): Promise<P> {
        return new Promise<P>((resolve, reject) =>{
            const msgId = "sev_msg_" + utils.guid();
            const sendStatus:any = {};
            const sendResult: any = {};
            const checkSendStatus = (): void => {
                let pass = true;
                let sendAll = true;
                Object.keys(sendStatus).forEach((sid: string) => {
                    const status = sendStatus[sid];
                    if(status === "Send") {
                        sendAll = false;
                    }
                    if(status === "Fail") {
                        pass = false;
                    }
                });
                if(sendAll) {
                    if(pass) {
                        resolve(sendResult);
                    } else {
                        reject(sendResult);
                    }
                }
            }
            if(msgData.toUser && msgData.toUser.length > 0) {
                msgData.toUser.forEach((uid: string) => {
                    if(this.connections[uid]) {
                        sendStatus[uid] = "Send";
                        ((sid: string) => {
                            (this.connections[uid] as ServerClient).send({
                                ...msgData,
                                msgId
                            } as any).then((data) => {
                                sendStatus[uid] = "Success";
                                sendResult[sid] = data;
                                checkSendStatus();
                            }).catch((err) => {
                                sendStatus[uid] = "Fail";
                                sendResult[sid] = err;
                                checkSendStatus();
                            });
                        })(uid);
                    } else {
                        sendStatus[uid] = "Fail";
                    }
                });
            } else {
                reject({
                    statusCode: "WS_404",
                    message: "未指定发送用户ID",
                    msgData
                });
            }
            if(msgData.rNotify) {
                this.msgHooks[msgId] = {
                    resolve,
                    reject,
                    toUser: msgData.toUser
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
                    modelObj = new modelFactory(this);
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