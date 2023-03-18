import { IClientConfig } from "../config/IClientConfig";
import { WebClient } from "./WebClient";
import { CommonUtils } from "../utils/CommonUtils";
import { BaseLog } from "../common/BaseLog";
import { ILogConfig } from "../config/ILogConfig";

interface IOptions {
    log: ILogConfig​​;
}

export const createClient = <IMsg={},UseModel={}>(config: IClientConfig, option?: IOptions) => {
    const com = new CommonUtils();
    WebClient.prototype.config = config;
    BaseLog.prototype.config = option?.log || {
        mode: "web",
        level: "INFO"
    };
    return new WebClient<IMsg,UseModel>(new BaseLog(com), com, WebSocket);
}