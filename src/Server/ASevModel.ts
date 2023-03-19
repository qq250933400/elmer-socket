import { IMsgData, IServerClientData } from "../data/IMessage";
import { GetConfig } from "../common/decorators";
import { IServerConfig } from "../config/IServerConfig";
import { CONST_SERVER_CONFIG_FILENAME, CONST_SERVER_CONFIG_INITDATA } from "../data/const";
import { BaseLog } from "../common/BaseLog";

interface IServerModelOption {
    sendToAll: <T={}>(msgData: IMsgData​<T>​) => Promise<any>;
    sendTo: <T={}>(toUsers: string[], msgData: IMsgData<T>) => Promise<any>;
    fromUser: string;
}

type ISendToAllData<IData, DataFiled extends Exclude<keyof IMsgData<IData>​, "toUsers"|"fromUser">> = {[P in DataFiled]?: IMsgData<IData>[P]};

export abstract class ASevModel<IMsgDataStruct={}, UseModel={}> {

    @GetConfig(CONST_SERVER_CONFIG_FILENAME, CONST_SERVER_CONFIG_INITDATA)
    public config: IServerConfig;

    public log!:BaseLog;

    public invoke: <M extends keyof UseModel>(model: M, method: keyof UseModel[M], ...args: any[])=> Promise<any>;
    public sendToEx: (toUser: string, data: any) => Promise<any>;
    public sendTo: (toUsers: string[], data: any) => void;

    protected options!: IServerModelOption;
    public abstract onClientClose?(uid: string): void;
    public abstract onMessage?(event: MessageEvent<IMsgDataStruct> & { dataType: keyof IMsgDataStruct }, data: IServerClientData): void ;
    public sendToAll(msgData: ISendToAllData<IMsgDataStruct, Exclude<keyof IMsgData<IMsgDataStruct>​, "toUsers"|"fromUser">>): Promise<any> {
        return this.options.sendToAll(msgData as any);
    }
}
