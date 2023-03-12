import "reflect-metadata";
import { Observe } from "elmer-common";
import { IMsgData, IMsgEvent } from "../data/IMessage";
import { CONST_CLIENT_CONFIG_FILENAME, CONST_CLIENT_CONFIG_INITDATA } from "../data/const";
import { GetConfig } from "../common/decorators";
import { IClientConfig } from "../config/IClientConfig";

interface ISocketOption {
    send(data: any):Promise<any>;
}

export abstract class AModel<TypeMsg={}> {
    @GetConfig(CONST_CLIENT_CONFIG_FILENAME, CONST_CLIENT_CONFIG_INITDATA)
    public config: IClientConfig;

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
    public abstract onMessage(event: MessageEvent): void;
    public on<Name extends keyof IMsgEvent>(eventName: Name, callback: IMsgEvent[Name]): void {
        if(eventName === "onMessage") {
            this.event.on("onMessage", callback as any);
        } else {
            this.event.on("onClose", callback as any);
        }
    }
    public send<Name extends keyof (TypeMsg & TypeMsg)>(data: Omit<IMsgData<(TypeMsg & TypeMsg)[Name]>, "fromUser">): Promise<any> {
        return this.option.send(data);
    }
    protected close(): void {
        this.event.emit("onClose");
    }
    protected message(event: MessageEvent): void {
        typeof this.onMessage === "function" && this.onMessage(event);
        typeof this.onMessage !== "function"  && this.event.emit("onMessage", event);
    }
}