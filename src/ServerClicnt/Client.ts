import { RequestService, utils } from "elmer-common";
import { MessageHandler } from "./MessageHandler";
import { IMsgData } from "../data/IMessage";
import { Log } from "../common/Log";

@RequestService
export class Client {
    public uid!: string;
    public dispose!: Function;
    public socket!: WebSocket;
    public msgHandler!: MessageHandler;
    constructor(
        private log: Log
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
                    this.msgHandler.onMessage(this.uid, jsonData);
                }
            } else {
                console.log(event.data, "==========");
            }
        } catch(e) {
            this.log.error((e as Error).stack || e.message);
        }
    }
    private onClose(): void {
        this.dispose(this);
    }
}
