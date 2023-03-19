import "reflect-metadata";
import ConfigSchema from "../config/ClientConfig.schema";
import { AppService } from "elmer-common";
import {
    CONST_CLIENT_CONFIG_FILENAME,
    CONST_CLIENT_CONFIG_INITDATA
} from "../data/const";
import { IClientConfig } from "../config/IClientConfig";
import { GetConfig } from "../common/decorators";
import { Log } from "../common/Log";
import { CommonUtils } from "../utils/CommonUtils";
import { WebClient } from "./WebClient";
import WebSocket from "ws";

@AppService
export class WSClient<IMsg={}, UseModel={}> extends WebClient<IMsg,UseModel> {
    /** 是否已连接到服务器 */
    public isConnected: boolean = false;

    @GetConfig(CONST_CLIENT_CONFIG_FILENAME, CONST_CLIENT_CONFIG_INITDATA, ConfigSchema)
    private configForNode: IClientConfig;

     
    constructor(
        logX: Log,
        comX: CommonUtils
    ) {
        super(logX, comX, WebSocket as any);
        Object.defineProperty(this, "config", {
            get: () => {
                return this.configForNode;
            }
        });
    }
}