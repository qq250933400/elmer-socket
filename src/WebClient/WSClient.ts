import ConfigSchema from "../config/ClientConfig.schema";
import WSWebSocket from "ws";
import { AppService, utils } from "elmer-common";
import {
    CONST_CLIENT_CONFIG_FILENAME,
    CONST_CLIENT_CONFIG_INITDATA
} from "../data/const";
import { IClientConfig, TypeENV } from "../config/IClientConfig";
import { GetConfig } from "../common/decorators";
import { Log } from "../common/Log";
import { CONST_CLIENT_REFUSED } from "../data/statusCode";

interface IWSClientStartOption {
    env: TypeENV,
    retry?: number
}

@AppService
export class WSClient {
    @GetConfig(CONST_CLIENT_CONFIG_FILENAME, CONST_CLIENT_CONFIG_INITDATA, ConfigSchema)
    private config: IClientConfig;
    private socket: WSWebSocket;
    private isRetryConnect: boolean = false;
    private startOption: IWSClientStartOption;
    private retryCount: number = 0;
    constructor(
        private log: Log
    ) {
        this.log.init();
    }
    start(option: IWSClientStartOption): void {
        const hostValue = utils.getValue(this.config.host, option.env || "PROD");
        const connectionString = `ws://${hostValue}:${this.config.port}`;
        this.startOption = option;
        this.socket = new WSWebSocket(connectionString);
        this.socket.on("open", () => {
            this.retryCount = 0;
            this.isRetryConnect = false;
            this.log.info("Connected");
        });
        this.socket.on("error", this.onError.bind(this));
        this.socket.on("close", this.onClose.bind(this));
        this.socket.on("message", this.onMessage.bind(this));
    }
    private onMessage(event: MessageEvent): void {
        console.log(event.data);
    }
    private onClose(code: number, reason: string): void {
        const log = utils.isEmpty(reason) ? `连接断开. [${code}][CT_CLOSE]` : `连接断开: ${reason}. [${code}][CT_CLOSE]`;
        (!(this.isRetryConnect && code === 1006)) && this.log.error(log);
        this.isRetryConnect = false;
    }
    private onError(err: Error): void {
        const code = (err as any).code;
        switch(code) {
            case CONST_CLIENT_REFUSED: {
                this.tryConnect();
                break;
            }
        }
        this.log.error(`[Code: ${code}] ${err.stack}`);
    }
    private tryConnect() {
        if(!this.isRetryConnect) {
            if(this.retryCount > 30) {
                this.log.error("多次尝试重新连接失败。[CT_RETRY_TIMEOUT]");
                return;
            }
            if(this.startOption) {
                this.isRetryConnect = true;
                const time = setTimeout(() => {
                    this.retryCount += 1;
                    this.start(this.startOption);
                    clearTimeout(time);
                }, 2000);
            } else {
                this.log.info("尝试重新链接失败。[CT_NO_CONFIG]");
            }
        }
    }
}