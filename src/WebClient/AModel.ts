import "reflect-metadata";
import { Observe } from "elmer-common";
import { IMsgData, IMsgEvent } from "../data/IMessage";
import { IClientConfig } from "../config/IClientConfig";

interface ISocketOption<IMsg = {},UseModel={}> {
    send(data: IMsgData<IMsg>):Promise<any>;
    invoke: <ModelName extends keyof UseModel>(model: ModelName, method: keyof UseModel[ModelName], ...args: any[]) => Promise<any>;
}

export abstract class AModel<TypeMsg={}, UseModel={}> {

    public config: IClientConfig;

    public static modelId: string;
    public option!: ISocketOption<UseModel>;

    private event: Observe<IMsgEvent>;
    
    constructor() {
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
        return this.option.send(data as any);
    }
    public invoke<ModelName extends keyof UseModel>(model: ModelName, method: keyof UseModel[ModelName], ...args: any[]): Promise<any> {
        return (this.option.invoke as any)(model, method, ...args);
    }
    protected close(): void {
        this.event.emit("onClose");
    }
    protected message(event: MessageEvent): void {
        typeof this.onMessage === "function" && this.onMessage(event);
        typeof this.onMessage !== "function"  && this.event.emit("onMessage", event);
    }
}