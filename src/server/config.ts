import fs from "fs";
import { utils } from "elmer-common";

export const getHost = () => {
    return function(target: any, attrKey: string) {
        Object.defineProperty(target, attrKey, {
            configurable: false,
            enumerable: true,
            get: function() {
                return utils.getValue(this.config, "host");
            }
        });
    }
}
export const getPort = () => {
    return function(target: any, attrKey: string) {
        Object.defineProperty(target, attrKey, {
            configurable: false,
            enumerable: true,
            get: function() {
                return utils.getValue(this.config, "port");
            }
        });
    }
}

export default (target:Function) => {
    const packageFile = process.cwd() + "/package.json";
    if(fs.existsSync(packageFile)) {
        const jsonData = JSON.parse(fs.readFileSync(packageFile, "utf8"));
        Object.defineProperty(target.prototype, "config", {
            configurable: false,
            writable: false,
            enumerable: true,
            value: jsonData["websocket"] || {}
        });
    } else {
        console.error("Can not find the package.json");
    }
}
