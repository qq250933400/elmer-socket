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
import { EnumSocketErrorCode } from "../data/statusCode";
import { clearInterval } from "timers";

interface IWSClientStartOption {
    env: TypeENV,
    retry?: number
}

@AppService
export class WSClient {
    /** 是否已连接到服务器 */
    public isConnected: boolean = false;

    @GetConfig(CONST_CLIENT_CONFIG_FILENAME, CONST_CLIENT_CONFIG_INITDATA, ConfigSchema)
    private config: IClientConfig;

    private socket: WebSocket;
    private isRetryConnect: boolean = false;
    private startOption: IWSClientStartOption;
    private retryCount: number = 0;
    
    // beat
    private beatTimer: NodeJS.Timeout;
    private activeTime: number;
    constructor(
        private log: Log
    ) {
        this.log.init();
    }
    start(option: IWSClientStartOption): void {
        const hostValue = utils.getValue(this.config.host, option.env || "PROD");
        const connectionString = `ws://${hostValue}:${this.config.port}`;
        this.startOption = option;
        this.socket = this.createSocket(connectionString);
        this.socket.addEventListener("open", this.onOpen.bind(this));
        this.socket.addEventListener("error", this.onError.bind(this));
        this.socket.addEventListener("close", this.onClose.bind(this));
        this.socket.addEventListener("message", this.onMessage.bind(this));
        this.beatTimer = setInterval(this.beat.bind(this), 1000);
    }
    private createSocket(connection: string): WebSocket {
        try {
            return new WebSocket(connection);
        } catch {
            return new WSWebSocket(connection) as any;
        }
    }
    private beat(): void {
        const now = Date.now();
        const effectTime = (now - this.activeTime) / 1000;
        if(effectTime > 100) {
            this.socket.send(`{type:"Beat"}`);
            this.activeTime = Date.now();
        }
    }
    private onOpen(): void {
        this.activeTime = Date.now();
        this.retryCount = 0;
        this.isRetryConnect = false;
        this.isConnected = true;
        this.log.info("Connected");
    }
    private onMessage(event: MessageEvent): void {
        this.activeTime = Date.now();
       
        console.log(event.data, event.type);
    }
    private onClose(event: CloseEvent): void {
        const code = event.code;
        const reason = event.reason;
        const exCode = utils.isString(code) || utils.isNumeric(code) ? code : reason;
        const log = utils.isEmpty(reason) ? `连接断开. [${exCode}][CT_CLOSE]` : `连接断开: ${reason}. [${code}][CT_CLOSE]`;
        (!(this.isRetryConnect && code === 1006)) && this.log.error(log);
        this.isRetryConnect = false;
        this.isConnected = false;
        if(this.beatTimer) {
            clearInterval(this.beatTimer);
        }
    }
    private onError(err: ErrorEvent): void {
        const code = (err as any).code || err.error?.code;
        switch(code) {
            case EnumSocketErrorCode.REFUSED: {
                this.tryConnect();
                break;
            }
        }
        this.log.error(`[Code: ${code}] ${err.message}`);
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