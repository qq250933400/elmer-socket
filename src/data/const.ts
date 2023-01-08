import { IServerConfig } from "../config/IServerConfig";
import { IClientConfig } from "../config/IClientConfig";
import { ILogConfig } from "../config/ILogConfig";

export const CONST_SERVER_CONFIG_FILENAME = "config.ws.server.json";
export const CONST_SERVER_CONFIG_INITDATA = {
    host: "0.0.0.0",
    port: 3000,
    log: {
        level: "INFO",
        savePath: "./log",
        mode: "web"
    }
} as IServerConfig;

export const CONST_CLIENT_CONFIG_FILENAME = "config.ws.client.json";
export const CONST_CLIENT_CONFIG_INITDATA = {
    host: {
        DEV: "localhost"
    },
    port: 3000
} as IClientConfig;

export const CONST_LOG_CONFIG_FILENAME = "config.log.json";
export const CONST_LOG_CONFIG_INITDATA = {
    level: "INFO",
    savePath: "./log",
    mode: "web"
} as ILogConfig;

export const CONST_SERVER_REQUEST_CLIENT_ID = "WS_SEV_CLIENT_ID";

export const CONST_MESSAGE_USE_FILTERKEYS = "WS_CLIENT_FILTER_KEY";