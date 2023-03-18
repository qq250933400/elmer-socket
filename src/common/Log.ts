import { AppService } from "elmer-common";
import { CommonUtils } from "../utils/CommonUtils";
import { GetConfig } from "./decorators";
import { CONST_LOG_CONFIG_FILENAME, CONST_LOG_CONFIG_INITDATA } from "../data/const";
import { ILogConfig } from "../config/ILogConfig";
import { checkDir } from "../utils/file";
import LogConfigSchema from "../config/LogConfig.schema";
import { BaseLog } from "./BaseLog";

export type TypeLogType = "ERROR" | "INFO" | "DEBUG" | "WARN" | "SUCCESS";

@AppService
export class Log extends BaseLog {
    @GetConfig(CONST_LOG_CONFIG_FILENAME, CONST_LOG_CONFIG_INITDATA, LogConfigSchema)
    private nodeConfig: ILogConfig;
    private mode: "node"|"web" = "web";
    private savePath: string;
    constructor(
        comx: CommonUtils
    ) {
        super(comx);
        this.config = this.nodeConfig;
    }
    init() {
        this.mode = this.config?.mode || "web";
        if(this.mode === "node") {
            const path = require("path");
            const logPath = path.resolve(process.cwd(), this.config.savePath || "./log");
            this.savePath = logPath;
            checkDir(logPath, process.cwd());
        }
    }
    log(msg: any, type: TypeLogType = "INFO"): string {
        const saveMessage = super.log(msg, type);
        this.saveToFile(type, saveMessage);
        return saveMessage;
    }
    private saveToFile(type: TypeLogType,msg: string): void {
        const shouldSaveToFile = type !== "DEBUG" || (this.config?.level === "DEBUG" && type === "DEBUG");
        if(this.mode === "node" && shouldSaveToFile) {
            const fs = require("fs");
            const path = require("path");
            const now = new Date();
            const dateNow = [this.com.formatLen(now.getFullYear(), 4), this.com.formatLen(now.getMonth(), 2), this.com.formatLen(now.getDate(),2)].join("-");
            const savePath = path.resolve(this.savePath, `./${dateNow}`);
            const fileName = this.com.formatLen(now.getHours(), 2) + ".log";
            const saveFileName = path.resolve(savePath, "./" + fileName);
            checkDir(savePath);
            if(fs.existsSync(saveFileName)) {
                fs.appendFile(saveFileName, msg + "\r\n", (err: any) => {
                    if(err) {
                        console.error(err);
                    }
                });
            } else {
                const ws = fs.createWriteStream(saveFileName, {
                    encoding: "utf-8",
                    autoClose: true
                });
                ws.write(msg + "\r\n", () => {
                    ws.close();
                });
            }
        }
    }
}