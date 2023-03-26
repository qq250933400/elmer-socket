import { RequestService, utils } from "elmer-common";
import { MessageHandler } from "./MessageHandler";
import { IMsgData } from "../data/IMessage";
import { Log } from "../common/Log";
import { Crypto } from "../common/Crypto";
import { Cookies } from "../common/Cookies";
import { IServerConfig } from "../config/IServerConfig";

export interface IClientInstanceInfo {
    clientId: string;
    classId: string;
}

@RequestService
export class Client {
    public uid!: string;
    public dispose!: Function;
    public socket!: WebSocket;
    public msgHandler!: MessageHandler;
    public ip!: string;
    public config!: IServerConfig;
    constructor(
        private log: Log,
        private cookie: Cookies,
        private crypto: Crypto
    ) {
        // this.option = reqOption;
    }
    listen() {
        this.socket.addEventListener("message", this.onMessage.bind(this));
        this.socket.addEventListener("close", this.onClose.bind(this));
    }
    public send<T={}>(msgData: {[P in Exclude<keyof IMsgData<T>, "toUsers">]: IMsgData<T>[P]}): void {
        this.msgHandler.sendTo(this, {
            ...msgData,
            toUsers: [this.uid]
        } as any);
    }
    private onMessage(event: MessageEvent): void {
        try {
            if(utils.isString(event.data)) {
                const jsonData: IMsgData = JSON.parse(event.data);
                if(jsonData.type !== "Beat") {
                    this.msgHandler.onMessage(this.uid, jsonData, event, {
                        socket: this.socket,
                        ip: this.ip,
                        uid: this.uid,
                        cookie: this.cookie,
                        close: (message: string) => {
                            message && this.log.info("客户端被断开：" + message);
                            this.socket.close();
                            this.onClose.bind(this);
                        }
                    } as any);
                }
            } else {
                console.log(event.data, "==========");
            }
        } catch(e) {
            this.log.debug(event.data);
            this.log.error((e as Error).stack || e.message);
        }
    }
    private onClose(): void {
        this.dispose(this);
    }
}
