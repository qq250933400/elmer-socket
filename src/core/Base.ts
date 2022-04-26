type TypeLogType = "INFO" | "ERROR" | "WARN" | "SUCCESS" | "DEBUG";

export class Base {
    log(msg: any, type: TypeLogType = "INFO"): void {
        const now = new Date();
        const dateStr = [this.formatLen(now.getFullYear(), 4), this.formatLen(now.getMonth(), 2), this.formatLen(now.getDate(),2)].join("-");
        const timeStr = [this.formatLen(now.getHours(), 2), this.formatLen(now.getMinutes(), 2), this.formatLen(now.getSeconds(),2)].join(":");
        const dateTimeStr = dateStr + " " + timeStr;
        if(type === "INFO") {
            console.info(`[${type}][${dateTimeStr}] ${msg}`);
        } else if(type === "ERROR") {
            console.error(`[${type}][${dateTimeStr}] ${msg}`);
        } else if(type === "WARN") {
            console.warn(`[${type}][${dateTimeStr}] ${msg}`);
        } else if(type === "SUCCESS") {
            console.log(`[${type}][${dateTimeStr}] ${msg}`);
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
}