import { IServerConfig } from "../config/IServerConfig";

export const CONST_SERVER_CONFIG_FILENAME = "config.socket.json";
export const CONST_SERVER_CONFIG_INITDATA = {
    host: "0.0.0.0",
    port: 3000,
    log: {
        level: "INFO",
        savePath: "./log",
        mode: "web"
    }
} as IServerConfig;