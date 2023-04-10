import { IClientConfig } from "../config/IClientConfig";
import { WebClient } from "./WebClient";
import { CommonUtils } from "../utils/CommonUtils";
import { BaseLog } from "../common/BaseLog";
import { ILogConfig } from "../config/ILogConfig";
import { FileTransfer } from "../common/FileTransfer";

interface IOptions {
    log: ILogConfig​​;
    isNode?: boolean;
}

export const createClient = <IMsg={},UseModel={}>(config: IClientConfig, option?: IOptions) => {
    const com = new CommonUtils();
    const log = new BaseLog(com);
    const file = new FileTransfer(com);
    WebClient.prototype.config = config;
    WebClient.prototype.isNode = option?.isNode;
    BaseLog.prototype.config = option?.log || {
        mode: "web",
        level: "INFO"
    };
    (file as any).log = log;
    log.info("version: 2.0.14");
    return new WebClient<IMsg,UseModel>(log, com, WebSocket, file);
}