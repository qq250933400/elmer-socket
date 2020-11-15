import fs from "fs";

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
