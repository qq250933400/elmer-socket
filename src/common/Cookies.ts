import { RequestService, utils } from "elmer-common";


@RequestService
export class Cookies {
    public readonly cookies: any = {};
    private updateTime: number;
    public set(name: string, value: any): void {
        this.updateTime = Date.now();
        this.cookies[name] = value;
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
        this.updateTime = Date.now();
        str.push(`timestamp=${this.updateTime}`);
        return str.join("&");
    }
}