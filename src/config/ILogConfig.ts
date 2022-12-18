import { TypeLogType } from "../common/Log";

export interface ILogConfig {
    level: TypeLogType;
    savePath?: string;
    mode: "node" | "web";
};
