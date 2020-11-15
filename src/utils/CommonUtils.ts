import "colors";
import { Common } from "elmer-common";

type TypeLogType = "ERROR" | "INFO" | "WARN" | "SUCCESS";

export class CommonUtils extends Common {
    log(msg: any, type: TypeLogType = "INFO"): void {
        const now = new Date();
        const dateStr = [this.formatLen(now.getFullYear(), 4), this.formatLen(now.getMonth(), 2), this.formatLen(now.getDate(),2)].join("-");
        const timeStr = [this.formatLen(now.getHours(), 2), this.formatLen(now.getMinutes(), 2), this.formatLen(now.getSeconds(),2)].join(":");
        const dateTimeStr = dateStr + " " + timeStr;
        if(type === "INFO") {
            console.log(`[${type}][${dateTimeStr}] ${msg}`.white);
        } else if(type === "ERROR") {
            console.log(`[${type}][${dateTimeStr}] ${msg}`.red);
        } else if(type === "WARN") {
            console.log(`[${type}][${dateTimeStr}] ${msg}`.yellow);
        } else if(type === "SUCCESS") {
            console.log(`[${type}][${dateTimeStr}] ${msg}`.green);
        } else {
            console.log(`[${type}][${dateTimeStr}] ${msg}`);
        }
    }
    formatLen(num: number, numLen: number = 0): string {
        const numStr = num.toString();
         if(numStr.length >= numLen) {
             return numStr;
         } else {
             return "0".repeat(numLen - numStr.length) + numStr;
         }
    }
    ajaxHandler(resp:any): boolean {
        const statusCode:any = this.getValue(resp, "statusCode") || "Unknow";
        if(/^200$/.test(statusCode)) {
            return true;
        } else {
            const msg = this.getValue(resp, "message") || this.getValue(resp, "info") || "Unknow System Error";
            this.log(msg, "ERROR");
            return false;
        }
    }
} 