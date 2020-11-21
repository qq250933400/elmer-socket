import { IncomingMessage } from "http";
import { Server as WebSocketServer } from "ws";
import { CommonUtils } from "../utils/CommonUtils";
import Config, { getHost, getPort } from "./config";
import { ServerSocket } from "./ServerSocket";
import { TypeMsgData, TypeWebsocketConfig } from "./IServerSocket";
import { queueCallFunc, TypeQueueCallParam } from "elmer-common";

@Config
export class SocketServer extends CommonUtils{
    config: TypeWebsocketConfig;
    connections: any = {};
    plugins: any[] = [];

    @getHost()
    private host:string;
    @getPort()
    private port:number;

    private initHost?: string;
    private initPort?: number;
    /**
     * 
     * @param {object[]} plugin 自定义业务处理插件, 引入插件需要创建实例化对象
     */
    constructor(plugin?:any[], host?: string, port?: number) {
        super();
        this.initHost = host;
        this.initPort = port;
        if(this.isArray(plugin)) {
            this.plugins.splice(this.plugins.length, 0, ...plugin);
        }
    }
    listen(): void {
        const host = this.initHost || this.host || "localhost";
        const port = this.initPort || this.port || 3000;
        const ioServer = new WebSocketServer({
            port,
            host
        });
        ioServer.on("connection", this.onSocketConnection.bind(this));
        ioServer.on("error", (err:Error) => {
            if(!this.ajaxHandler(err)) {
                console.error(err);
            }
        });
        ioServer.on("close", () => {
            Object.keys(this.connections).map((uid: string) => {
                (<ServerSocket>this.connections[uid]).close();
                this.connections[uid] = null;
                delete this.connections[uid];
            });
            this.connections = {};
        });
        this.log(`Websocket server is runing at ${host}:${port}`, "SUCCESS");
    }
    /**
     * 发送消息给所有客户端
     * @param msgData 发送消息数据
     * @param ignoreList 不需要发送的客户端id列表
     */
    sendToAll<T={}>(msgData: TypeMsgData<T>, ignoreList?: string[]): void {
        if(this.connections) {
            Object.keys(this.connections).map((clientKey: string) => {
                if(this.isArray(ignoreList) && ignoreList.length>0) {
                    if(ignoreList.indexOf(clientKey)<0) {
                        (<ServerSocket>this.connections[clientKey]).send(msgData);
                    }
                } else {
                    (<ServerSocket>this.connections[clientKey]).send(msgData);
                }
            });
        }
    }
    sendTo<T={}>(msgData: TypeMsgData<T>, uid: string): void {
        if(this.connections && this.connections[uid]) {
            (<ServerSocket>this.connections[uid]).send(msgData);
        }
    }
    sendToAsync<T={}>(msgData: TypeMsgData<T>, uid: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if(this.connections && this.connections[uid]) {
                (<ServerSocket>this.connections[uid]).sendAsync(msgData).then((resp) => {
                    resolve(resp);
                }).catch((err) => {
                    reject(err);
                });
            } else {
                reject({
                    statusCode: "SOCKET_NOTFOUND",
                    message: "target socket client not exists"
                });
            }
        });
    }
    private onSocketConnection(socket: WebSocket, req:IncomingMessage): void {
        // const ip = req.headers['x-forwarded-for'].split(/\s*,\s*/)[0];
        const uid = this.guid();
        (<any>socket).uid = uid;
        this.connections[uid] = new ServerSocket(socket, {
            id: uid,
            plugin: this.plugins,
            request: req,
            sendToAll: this.sendToAll.bind(this),
            sendTo: (msgData: TypeMsgData, toList: string[]) => {
                if(toList && toList.length > 0) {
                    toList.map((toUID) => {
                        this.sendTo(msgData, toUID);
                    });
                } else {
                    throw new Error("ToList can not be empty");
                }
            },
            sendToAsync: (msgData: TypeMsgData, toList: string[]): Promise<any> => {
                const params: TypeQueueCallParam[] = [];
                return new Promise<any>((resolve, reject) => {
                    if(toList && toList.length > 0) {
                        toList.map((toUID: string) => {
                            params.push({
                                id: toUID,
                                params: toUID
                            });
                        });
                        queueCallFunc(params, ({}, params) => {
                            return this.sendToAsync(msgData, params);
                        }).then((data) => {
                            resolve(data);
                        }).catch((err) => {
                            reject(err);
                        })
                    } else {
                        reject({
                            statusCode: "T_TO_LIST_404",
                            message: "toList is required, but no data found in arguments"
                        });
                    }
                });
            },
            onClose: (_id: string) => {
                this.connections[_id] = null;
                delete this.connections[_id];
            }
        });
    }
}