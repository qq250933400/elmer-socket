import "reflect-metadata";
import { Observe } from "elmer-common";
import { IMsgData, IMsgEvent } from "../data/IMessage";
import { IClientConfig } from "../config/IClientConfig";
import { BaseLog } from "../common/BaseLog";
import { ISendFileOptions } from "src/common/FileTransfer";

interface ISocketOption<IMsg = {},UseModel={}> {
    send(data: IMsgData<IMsg>):Promise<any>;
    invoke: <ModelName extends keyof UseModel>(model: ModelName, method: keyof UseModel[ModelName], ...args: any[]) => Promise<any>;
}

interface IReplyData<T={}> {
    data: T,
    exception: {
        statusCode?: string;
        message: string;
    }
}

export interface IClientApi<T={}> {
    socket: WebSocket;
    fromUser: string|null;
    reply: (data: IReplyData<T>) => void;
}

type TypeExtendsEvent = Omit<IMsgEvent, "onMessage">;

interface IModelEvent<IMsg={}> extends TypeExtendsEvent {
    onMessage<MsgType extends keyof IMsg>(event: MessageEvent<{ type: MsgType, data: IMsg[MsgType] }>, api: IClientApi): void;
}

export abstract class AModel<TypeMsg={}, UseModel={}> {

    public config: IClientConfig;
    public log!: BaseLog;
    public readonly cookies!: string;

    public static modelId: string;
    public option!: ISocketOption<UseModel>;
    public sendFile!: (options: ISendFileOptions) => Promise<Blob>;

    private event: Observe<IModelEvent>;
    
    constructor() {
        this.event = new Observe<IModelEvent>();
        this.event.on("onClose", () => {
            this.event.unBind("onMessage");
            this.event.unBind("onClose");
        });
    }
    public abstract onMessage(event: MessageEvent, api: IClientApi<any>): void;
    public on<Name extends keyof IMsgEvent>(eventName: Name, callback: IMsgEvent[Name]): void {
        if(eventName === "onMessage") {
            this.event.on("onMessage", callback as any);
        } else {
            this.event.on("onClose", callback as any);
        }
    }
    public send<Name extends keyof (TypeMsg & TypeMsg)>(data: Omit<IMsgData<(TypeMsg & TypeMsg)[Name]>, "fromUser">): Promise<any> {
        return this.option.send(data as any);
    }
    public invoke<ModelName extends keyof UseModel>(model: ModelName, method: keyof UseModel[ModelName], ...args: any[]): Promise<any> {
        return (this.option.invoke as any)(model, method, ...args);
    }
    protected close(): void {
        this.event.emit("onClose");
    }
    protected message(event: MessageEvent, api: IClientApi): void {
        typeof this.onMessage === "function" && this.onMessage(event, api);
        typeof this.onMessage !== "function"  && this.event.emit("onMessage", event, api);
    }
}