import { IMsgData } from "../data/IMessage";

interface IServerModelOption {
    sendToAll: <T={}>(msgData: IMsgData​<T>​) => Promise<any>;
    sendTo: <T={}>(toUsers: string[], msgData: IMsgData<T>) => Promise<any>;
}
export abstract class ASevModel<IMsgDataStruct={}> {
    protected options!: IServerModelOption;
    public abstract onMessage?(event: MessageEvent<IMsgDataStruct>): void ;
    public sendToAll(msgData: Exclude<IMsgData<IMsgDataStruct>​, "toUsers"|"fromUser">): Promise<any> {
        return this.options.sendToAll(msgData);
    }
}
