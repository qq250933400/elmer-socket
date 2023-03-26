import { TypeLogType } from "../common/Log";

export interface IServerConfig {
    host: string;
    port: number;
    log: {
        level: TypeLogType,
        savePath: string,
        mode: "node"|"web"
    },
    security: {
        AsePublicKey: string;
    }
}