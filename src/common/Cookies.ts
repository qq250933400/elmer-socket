import { AppService, utils } from "elmer-common";


@AppService
export class Cookies {
    public readonly cookies: any = {};
    public set(name: string, value: any): void {
        if(this.cookies[name]) {
            delete this.cookies[name];
        }
        Object.defineProperty(this.cookies, name, {
            configurable: false,
            enumerable: true,
            get: ((val: any) => () => val)(value),
            set: () => {
                throw new Error("Cookies are read-only properties and setting by setter is not allowed");
            }
        });
    }
    public get<T={}>(name: string): T|null {
        const val = this.cookies[name];
        return val;
    }
    public toString(): string {
        const str: string[] = [];
        Object.keys(this.cookies).forEach((name: string) => {
            const val = this.cookies[name];
            if(utils.isString(val) || utils.isNumeric(val)) {
                str.push(`${name}=${encodeURIComponent(val)}`);
            } else if(utils.isBoolean(val)) {
                str.push(`${name}=${val ? 'true' : 'false'}`);
            } else {
                str.push(`${name}=${encodeURIComponent(JSON.stringify(val))}`);
            }
        });
        return str.join("&");
    }
}