import { IMsgData, IServerClientData } from "../data/IMessage";
import { GetConfig } from "../common/decorators";
import { IServerConfig } from "../config/IServerConfig";
import { CONST_SERVER_CONFIG_FILENAME, CONST_SERVER_CONFIG_INITDATA } from "../data/const";

interface IServerModelOption {
    sendToAll: <T={}>(msgData: IMsgData​<T>​) => Promise<any>;
    sendTo: <T={}>(toUsers: string[], msgData: IMsgData<T>) => Promise<any>;
}

export abstract class ASevModel<IMsgDataStruct={}> {

    @GetConfig(CONST_SERVER_CONFIG_FILENAME, CONST_SERVER_CONFIG_INITDATA)
    public config: IServerConfig;

    protected options!: IServerModelOption;
    public abstract onMessage?(event: MessageEvent<IMsgDataStruct> & { dataType: keyof IMsgDataStruct }, data: IServerClientData): void ;
    public sendToAll(msgData: Exclude<IMsgData<IMsgDataStruct>​, "toUsers"|"fromUser">): Promise<any> {
        return this.options.sendToAll(msgData);
    }

}
