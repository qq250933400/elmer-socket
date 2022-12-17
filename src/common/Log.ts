import { AppService } from "elmer-common";
import { CommonUtils } from "../utils/CommonUtils";
import { GetConfig } from "./decorators";
import { CONST_SERVER_CONFIG_FILENAME, CONST_SERVER_CONFIG_INITDATA } from "../data/const";
import { IServerConfig } from "../config/IServerConfig";
import { checkDir } from "../utils/file";
import * as fs from "fs";

export type TypeLogType = "ERROR" | "INFO" | "DEBUG" | "WARN" | "SUCCESS";

@AppService
export class Log extends CommonUtils {

    @GetConfig(CONST_SERVER_CONFIG_FILENAME, CONST_SERVER_CONFIG_INITDATA)
    private config: IServerConfig​​;
    private mode: "node"|"web" = "web";
    private savePath: string;
    init() {
        this.mode = this.config.log?.mode || "web";
        if(this.mode === "node") {
            const path = require("path");
            const logPath = path.resolve(process.cwd(), this.config.log.savePath || "./log");
            this.savePath = logPath;
            checkDir(logPath, process.cwd());
        }
    }
    log(msg: any, type: TypeLogType = "INFO"): void {
        const now = new Date();
        const dateStr = [this.formatLen(now.getFullYear(), 4), this.formatLen(now.getMonth(), 2), this.formatLen(now.getDate(),2)].join("-");
        const timeStr = [this.formatLen(now.getHours(), 2), this.formatLen(now.getMinutes(), 2), this.formatLen(now.getSeconds(),2)].join(":");
        const dateTimeStr = dateStr + " " + timeStr;
        let saveMessage = `[${type}][${dateTimeStr}] ${msg}`;
        if(type === "INFO") {
            console.info(saveMessage);
        } else if(type === "ERROR") {
            console.error(saveMessage);
        } else if(type === "WARN") {
            this.config.log?.level === "DEBUG" && console.warn(saveMessage);
        } else if(type === "SUCCESS") {
            console.log(saveMessage);
        } else {
            console.log(saveMessage);
        }
        this.saveToFile(type, saveMessage);
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
    private saveToFile(type: TypeLogType,msg: string): void {
        const shouldSaveToFile = type !== "DEBUG" || (this.config.log?.level === "DEBUG" && type === "DEBUG");
        if(this.mode === "node" && shouldSaveToFile) {
            // const fs = require("fs");
            const path = require("path");
            const now = new Date();
            const dateNow = [this.formatLen(now.getFullYear(), 4), this.formatLen(now.getMonth(), 2), this.formatLen(now.getDate(),2)].join("-");
            const savePath = path.resolve(this.savePath, `./${dateNow}`);
            const fileName = this.formatLen(now.getHours(), 2) + ".log";
            const saveFileName = path.resolve(savePath, "./" + fileName);
            checkDir(savePath);
            const ws: fs.WriteStream = fs.createWriteStream(saveFileName, {
                encoding: "utf-8",
                autoClose: true
            });
            ws.write(msg + "\r\n", () => {
                ws.close();
            });
        }
    }
}