import { Common, queueCallFunc, Service } from "elmer-common";

export interface IArrayBufferMsg<T={}> {
    info: T;
    data: Buffer | ArrayBuffer | Blob;
};

@Service
export class CommonUtils extends Common {
    constructor() {
        super();
        if(!this.isNode()) {
            if(typeof (<any>Blob.prototype).text !== "function") {
                (<any>Blob.prototype).text = function():Promise<any> {
                    return new Promise<any>((resolve: Function) => {
                        const fileReader = new FileReader();
                        fileReader.onload = (res) => {
                            resolve(res.target?.result);
                        };
                        fileReader.readAsText(this);
                    });
                }
            }
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
            // const msg = this.getValue(resp, "message") || this.getValue(resp, "info") || "Unknow System Error";
            return false;
        }
    }
    isNode(): boolean {
        try{
            return globalThis !== window;
        } catch {
            return true;
        }
    }
    /**
     * 创建数据包
     * @param data 二进制数据，Blob|Buffer
     * @param info 对数据包的描述信息
     */
    encodeMsgPackage<T>(data: any, info: T, isNode: boolean, tag?:string): any {
        let packageTag = "EWB";
        if(undefined !== tag && this.isEmpty(tag) && this.isString(tag)) {
            packageTag = tag;
        }
        if(packageTag.length !== 3 && /^[a-z0-9]{3}$/i.test(packageTag)) {
            throw new Error("The tag is not in the correct format");
        }
        if(isNode) {
            return this.encodePackageInNode(data, info, packageTag);
        } else {
            return this.encodePackageInBrowser(data, info, packageTag);
        }
    }
    /**
     * 解码数据包
     * @param data 数据包
     * @param tag 数据包标识,三个字节长度
     */
    decodeMsgPackage(data:any, isNode: boolean, tag?: string): Promise<any> {
        let packageTag = "EWB";
        if(undefined !== tag && this.isEmpty(tag) && this.isString(tag)) {
            packageTag = tag;
        }
        if(packageTag.length !== 3 && /^[a-z0-9]{3}$/i.test(packageTag)) {
            throw new Error("The tag is not in the correct format");
        }
        if(isNode) {
            // 当前代码在Nodejs环境，调用node代码解析
            return this.decodePackageInNode(data, packageTag);
        } else {
            return this.decodePackageInBrowser(data, packageTag);
        }
    }
    private encodePackageInBrowser(data: Blob, info:any, type: string): Blob {
        const typeData = new Blob([type]);
        const infoData = new Blob([JSON.stringify(info)], {type: "application/json"});
        const infoLength = infoData.size;
        const infoLengthBuffer = new Uint16Array(1);
        const infoDataView = new DataView(infoLengthBuffer.buffer, 0);
        infoDataView.setUint16(0, infoLength);
        return new Blob([data, infoData, infoLengthBuffer.buffer, typeData]);
    }
    private encodePackageInNode(data:Buffer, info: any, type: string): Buffer {
        const infoBuffer = Buffer.from(JSON.stringify(info));
        const lenBuffer = Buffer.alloc(2);
        const typeBuffer = Buffer.from(type);
        lenBuffer.writeInt16BE(infoBuffer.length);
        return Buffer.concat([data, infoBuffer, lenBuffer, typeBuffer]);
    }
    private decodePackageInBrowser<T={}>(data: Blob, tag: string): Promise<T> {
        return new Promise<any>((resolve, reject) => {
            queueCallFunc([{
                id: "tag",
                params: tag,
                fn: ():any => {
                    return new Promise<any>((_resolve, _reject) => {
                        // 验证数据包标识，不匹配
                        const tagData = data.slice(data.size - 3);
                        (tagData as any).text().then((dTag:string) => {
                            if(dTag !== tag) {
                                _reject({
                                    statusCode: "T_801",
                                    message: "tag not matched"
                                });
                            } else {
                                _resolve({
                                    pass: true
                                });
                            }
                        }).catch((err:any) => {
                            _resolve({
                                statusCode: "T_800",
                                err
                            });
                        })
                    });
                }
            }, {
                id: "readInfo",
                params: "",
                fn: ():any => {
                    return new Promise<any>((_resolve, _reject) => {
                        const lenBlob = data.slice(data.size - 5, data.size - 3);
                        (lenBlob as any).arrayBuffer().then((lenBuffer:ArrayBuffer) => {
                            const mData = new DataView(lenBuffer, 0);
                            const lenValue = mData.getUint16(0);
                            const infoData = data.slice(data.size - lenValue - 5, data.size - 5);
                            (infoData as any).text().then((jsonData: string) => {
                                _resolve({
                                    info: JSON.parse(jsonData),
                                    data: data.slice(0, data.size - lenValue - 5)
                                });
                            }).catch((_err:any) => {
                                _reject({
                                    statusCode: "T_803",
                                    message: _err.message,
                                    exception: _err
                                });
                            });
                        }).catch((err:any) => {
                            _reject({
                                statusCode: "T_802",
                                err
                            });
                        })
                    });
                }
            }], undefined, {
                throwException: true
            }).then((resp:any) => {
                resolve(resp.readInfo);
            }).catch((err) => {
                reject(err);
            });
        });
    }
    /**
     * 在NodeJS环境解析数据包
     * @param data 解析数据
     * @param tag 数据包标识
     */
    private decodePackageInNode(data:Buffer, tag: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            const tagBuffer = Buffer.alloc(3);
            data.copy(tagBuffer, 0, data.length - 3);
            if(tagBuffer.toString() !== tag) {
                reject({
                    statusCode: "T_8004",
                    message: "Data tag not matched"
                });
            } else {
                const sizeBuffer = Buffer.alloc(2);
                let sizeValue = 0;
                data.copy(sizeBuffer, 0, data.length - 5, data.length - 3);
                sizeValue = sizeBuffer.readUInt16BE(0);
                // ----------
                const infoBuffer = Buffer.alloc(sizeValue);
                const dataSize = data.length - sizeValue - 5;
                const dataBuffer = Buffer.alloc(dataSize);
                data.copy(infoBuffer, 0, data.length - sizeValue - 5, data.length - 5);
                data.copy(dataBuffer, 0, 0, dataSize);
                resolve({
                    info: JSON.parse(infoBuffer.toString()),
                    data: dataBuffer
                });
            }
        });
    }
}