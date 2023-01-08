import "reflect-metadata";
import { Observe } from "elmer-common";
import { IMsgData, IMsgEvent } from "../data/IMessage";

interface ISocketOption {
    send(data: any):Promise<any>;
}

export abstract class AModel<TypeMsg={}> {
    public static modelId: string;
    private event: Observe<IMsgEvent>;
    private option: ISocketOption;
    constructor(option: ISocketOption) {
        this.option = option;
        this.event = new Observe<IMsgEvent>();
        this.event.on("onClose", () => {
            this.event.unBind("onMessage");
            this.event.unBind("onClose");
        });
    }
    on<Name extends keyof IMsgEvent>(eventName: Name, callback: IMsgEvent[Name]): void {
        if(eventName === "onMessage") {
            this.event.on("onMessage", callback as any);
        } else {
            this.event.on("onClose", callback as any);
        }
    }
    send<Name extends keyof TypeMsg>(data: Omit<IMsgData​​<TypeMsg[Name]>, "fromUser">): Promise<any> {
        return this.option.send(data);
    }
    close(): void {
        this.event.emit("onClose");
    }
    message(event: MessageEvent): void {
        this.event.emit("onMessage", event);
    }
}