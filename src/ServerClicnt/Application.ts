import { GetConfig } from "../common/decorators";
import { IServerConfig } from "../config/IServerConfig";
import { AppService } from "elmer-common";
import { Server as WebSocketServer } from "ws";
import { CONST_SERVER_CONFIG_INITDATA } from "../data/const";
import { Log } from "../common/Log";

@AppService
export class Application {
    @GetConfig<IServerConfig>("config.socket.json", CONST_SERVER_CONFIG_INITDATA)
    ​private​ config: IServerConfig;
    private socket: WebSocketServer;
    constructor(
        private log: Log
    ) {
        this.log.init();
    }
    listen() {
        this.socket = new WebSocketServer({
            host: this.config.host,
            port: this.config.port
        });
        this.socket.on("listening", this.socketListening.bind(this));
        this.socket.on("connection", this.onConnection.bind(this));
    }
    private socketListening() {
        this.log.info(`Application running at: http://${this.config.host}:${this.config.port}`);
    }
    private onConnection(self: any,req: any) {
        console.log(self);
        console.log(req);
    }
}