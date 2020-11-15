import { IncomingMessage } from "http";
import { Server as WebSocketServer } from "ws";
import { CommonUtils } from "../utils/CommonUtils";
import Config from "./config";
import { ServerSocket } from "./ServerSocket";
import { TypeWebsocketConfig } from "./IServerSocket";

@Config
export class SocketServer extends CommonUtils{
    config: TypeWebsocketConfig;
    connections: any = {};
    plugins: any[] = [];
    /**
     * 
     * @param {object[]} plugin 自定义业务处理插件, 引入插件需要创建实例化对象
     */
    constructor(plugin?:any[]) {
        super();
        if(this.isArray(plugin)) {
            this.plugins.splice(this.plugins.length, 0, ...plugin);
        }
    }
    listen(): void {
        const host = this.config.host || "localhost";
        const port = this.config.port || 3000;
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
    private onSocketConnection(socket: WebSocket, req:IncomingMessage): void {
        // const ip = req.headers['x-forwarded-for'].split(/\s*,\s*/)[0];
        const uid = this.guid();
        (<any>socket).uid = uid;
        this.connections[uid] = new ServerSocket(socket, {
            id: uid,
            plugin: this.plugins,
            request: req,
            onClose: (_id: string) => {
                this.connections[_id] = null;
                delete this.connections[_id];
            }
        });
    }
}