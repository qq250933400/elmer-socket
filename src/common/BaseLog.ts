import { CommonUtils } from "../utils/CommonUtils";
import { ILogConfig } from "../config/ILogConfig";

// import * as fs from "fs";

export type TypeLogType = "ERROR" | "INFO" | "DEBUG" | "WARN" | "SUCCESS";

export class BaseLog {
    public config: ILogConfig;
    public com: CommonUtils;
    constructor(
        com: CommonUtils
    ) {
        this.com = com;
    }
    log(msg: any, type: TypeLogType = "INFO"): string {
        const now = new Date();
        const dateStr = [this.com.formatLen(now.getFullYear(), 4), this.com.formatLen(now.getMonth() + 1, 2), this.com.formatLen(now.getDate(),2)].join("-");
        const timeStr = [this.com.formatLen(now.getHours(), 2), this.com.formatLen(now.getMinutes(), 2), this.com.formatLen(now.getSeconds(),2)].join(":");
        const dateTimeStr = dateStr + " " + timeStr;
        let saveMessage = `[${type}][${dateTimeStr}] ${msg}`;
        if(type === "INFO") {
            console.info(saveMessage);
        } else if(type === "ERROR") {
            console.error(saveMessage);
        } else if(type === "WARN") {
            this.config?.level === "DEBUG" && console.warn(saveMessage);
        } else if(type === "SUCCESS") {
            console.log(saveMessage);
        } else {
            console.log(saveMessage);
        }
        return saveMessage;
    }
    info(msg: any): void {
        this.log(msg, "INFO");
    }
    warn(msg: any): void {
        this.log(msg, "WARN");
    }
    error(msg: any): void {
        this.log(msg, "ERROR");
    }
    debug(msg: any): void {
        this.log(msg, "DEBUG");
    }
    success(msg: any): void {
        this.log(msg, "SUCCESS");
    }
}