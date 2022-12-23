import axios, { AxiosBasicCredentials } from "axios";
import { utils, Service } from "elmer-common";
import { getServiceObj } from "elmer-common/lib/decorators/Autowired";

type TypeENV = {
    host: string;
};
type TypeRuningEnv = {
    DEV: TypeENV;
    SIT: TypeENV;
    UAT: TypeENV;
    PROD: TypeENV;
    PREPROD: TypeENV;
    MOCK: TypeENV;
    LOCAL: TypeENV;
}

export type TypeServiceMethod = "GET" | "POST" | "DELETE" | "PUT" | "OPTIONS";

export type TypeServiceEndPointOption = {
    withRoute?: boolean;
    withRouteAction?: string;
    withRoutePath?: string;
};

export type TypeServiceEndPoint<T={}> = {
    url: string | any;
    method: TypeServiceMethod,
    uri?: any;
    data?: any;
    cookie?: any;
    header?: T;
    withCredentials?: boolean;
    auth?: AxiosBasicCredentials;
    options?: any;
    isDummy?: boolean;
    dummyData?: string;
};

export type TypeServiceNamespace<T={}> = {
    host?: { [H in keyof TypeRuningEnv]?: string };
    isDummy?: boolean;
    endPoints: {[P in keyof T]: TypeServiceEndPoint<T[P]>};
    options?: any;
    withCredentials?: boolean;
};

export type TypeServiceConfig<T={}, ENV = keyof TypeRuningEnv> = {
    env?: ENV;
    isDummy?: boolean;
    host: { [H in keyof TypeRuningEnv]?: string };
    config: {[P in keyof T]: TypeServiceNamespace<T[P]>};
    timeout?: number;
};

export type TypeServiceSendOptions = {
    endPoint: string;
    uri?: any;
    data?: any;
    header?: any;
    cookie?: any;
    withCredentials?: boolean;
    throwException?: boolean;
};

@Service
export class ElmerService {
    private config: {[P in keyof TypeServiceConfig<any>]?: TypeServiceConfig<any>[P]} = {};
    private env: String;
    constructor() {
        // this.config = serviceState.config;
        this.env = "DEV";
    }
    setENV(env:string): void {
        this.env = env;
    }
    setConfig(configData: TypeServiceConfig<any>): void {
        this.config = configData;
        // serviceState.config = configData;
    }
    setNamespace(namespace: string, data: TypeServiceNamespace<any>): void {
        if(this.config?.config) {
            this.config.config[namespace] = data;
        } else {
            this.config.config = {};
            this.config.config[namespace] = data;
        }
    }
    getConfig<T={}>(): {[P in keyof T]: TypeServiceNamespace<any>} {
        return this.config.config as any;
    }
    getEndPoint(endPointId: string): TypeServiceEndPoint<any>|undefined|null {
        const endArr = (endPointId || "").split(".");
        const namespace = endArr[0];
        const id = endArr[1];
        const allConfig = this.config?.config;
        const namespaceData = allConfig ? allConfig[namespace] : null;
        if(namespaceData) {
            const endPointConfig = (namespaceData.endPoints || {})[id];
            if(endPointConfig) {
                const endPoint = JSON.parse(JSON.stringify(endPointConfig));
                const isDummy = this.config.isDummy || namespaceData.isDummy || endPoint.isDummy;
                const env:any = this.config.env || this.env || "PROD";
                const rootHost = (this.config.host as any || {})[env];
                const namespaceHost = (namespaceData.host as any || {})[env];
                const domainPath = namespaceHost || rootHost;
                let url = endPoint.url;
                if(utils.isObject(endPoint.url)) {
                    url = endPoint.url[env];
                }
                if(isDummy) {
                    url = endPoint.dummyData || url; // 如果未设置dummy数据路径，fallback回之前的设置
                } else {
                    url = domainPath + url;
                }
                if(utils.isObject(endPoint.uri)) { // 将自定义参数合并到连接
                    url = this.mergeLinkAndUri(url, endPoint.uri);
                }
                endPoint.url = url;
                endPoint.options = {
                    ...( namespaceData.options || {} ),
                    ...( endPoint.options || {} )
                };
                endPoint.withCredentials = typeof endPoint.withCredentials === "boolean" ? endPoint.withCredentials : namespaceData.withCredentials;
                endPoint.id = endPointId;
                return endPoint;
            }
        }
    }
    getUrl(endPointId: string): string|undefined|null {
        const endPoint = this.getEndPoint(endPointId);
        return endPoint ? endPoint.url : null;
    }
    /**
     * 发送http请求
     * @param options - 请求参数
     * @param newEndPoint - 自定义API参数配置，不从全局配置数据去读取
     * @returns - 返回Promise对象
     */
    send<T = {}>(options: TypeServiceSendOptions, newEndPoint?: TypeServiceEndPoint<{}>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const endPoint = newEndPoint || this.getEndPoint(options?.endPoint);
            if(!endPoint) {
                reject({
                    message: "The endpoint is not found.",
                    status: "IT-500",
                    endPoint: ((newEndPoint || {}) as any).endPoint || options.endPoint
                });
            } else {
                const sendData = {
                    ...(endPoint.data || {}),
                    ...(options.data || {})
                };
                const url = utils.isObject(options.uri) ? this.mergeLinkAndUri(endPoint.url, options.uri) : endPoint.url;
                const type = endPoint.method || "GET";
                const headers = {
                    ...(endPoint.header || {}),
                    ...(options.header || {})
                };
                const cookieData = {
                    ...(endPoint.cookie || {}),
                    ...(options.cookie || {})
                };
                this.setCookies(cookieData);
                axios.request({
                    auth: endPoint.auth,
                    data: sendData,
                    headers,
                    method: type,
                    timeout: this.config.timeout || 30000,
                    url,
                    withCredentials: options.withCredentials || endPoint.withCredentials
                }).then((resp) => {
                    resolve(({
                        config: endPoint,
                        data: resp.data,
                        endPoint,
                        headers: resp.headers,
                        options: {
                            ...(endPoint.options || {}),
                            ...(options || {})
                        }
                    } as any));
                }).catch((error) => {
                    // tslint:disable-next-line: no-console
                    console.error(error);
                    const respData = error?.response?.data || error?.data || error;
                    reject({
                        response: error?.response || error,
                        config: endPoint,
                        endPoint,
                        headers: error?.response?.headers || error?.headers,
                        data: error?.response?.data || error?.data || error,
                        statusCode: error?.response?.status || respData.status || respData.statusCode,
                        options: {
                            ...(endPoint.options || {}),
                            ...(options || {})
                        }
                    });
                });
            }
        });
    }
    private setCookies(cookieData:any): void {
        if(cookieData) {
            Object.keys(cookieData).forEach((cookieKey):void => {
                const value = cookieData[cookieKey];
                const setValue = utils.isObject(value) ? JSON.stringify(value) : value;
                const cookieValue = `${cookieKey}=${encodeURIComponent(setValue)}`;
                document.cookie = cookieValue;
            });
        }
    }
    /**
     * 将url和uri参数合并
     * @param url 源连接
     * @param uri 合并参数
     * @returns 合并后的链接
     */
    private mergeLinkAndUri(url: string, uri: any): string {
        const uriQuery = this.uriToQuery(uri);
        return !/\?/.test(url) ? url + "?" + uriQuery :
            (/#/.test(url) ? (url as string).replace(/#/, "#" + uriQuery) :
            url + "&" + uriQuery);
    }
    private uriToQuery(uri: any): string {
        const rList: string[] = [];
        if(utils.isObject(uri)) {
            Object.keys(uri).forEach((item: string) => {
                const itemValue = (uri as any)[item];
                const itemV = utils.isObject(itemValue) ? JSON.stringify(itemValue) : itemValue;
                const itemQV = encodeURIComponent(itemV);
                rList.push(`${item}=${itemQV}`);
            });
        }
        return rList.join("&");
    }
}

export const GetUrl = (endPoint: string) => {
    return (target: any, attr: string): any => {
        const obj = getServiceObj<ElmerService>(ElmerService);
        const myUrl = obj.getUrl(endPoint);
        if(target) {
            Object.defineProperty(target, attr, {
                get: () => myUrl,
                set: () => {throw new Error(`The property of ${attr} cannot be modified directly.`);}
            });
        }
        return myUrl;
    };
};

export const GetEndPoint= (endPoint: string) => {
    return (target: any, attr: string): any => {
        const obj = getServiceObj<ElmerService>(ElmerService);
        const myEndPoint = obj.getEndPoint(endPoint);
        if(target) {
            Object.defineProperty(target, attr, {
                get: () => myEndPoint,
                set: () => {throw new Error(`The property of ${attr} cannot be modified directly.`);}
            });
        }
        return myEndPoint;
    };
};

export const SetServiceConfig = <T={}>() => {
    return (target: any, attr: string, defaultValue?: TypeServiceConfig<T>): any => {
        const obj = getServiceObj<ElmerService>(ElmerService);
        obj.setConfig(defaultValue as any);
        if(target) {
            Object.defineProperty(target, attr, {
                get: () => defaultValue,
                set: () => {throw new Error(`The property of ${attr} cannot be modified directly.`);}
            });
        }
    };
};

export const SetServiceNamespace = (namespace: string) => {
    return (target: any, attr: string, descriptor: PropertyDescriptor): any => {
        const obj = getServiceObj<ElmerService>(ElmerService);
        const configData = descriptor.value();
        obj.setNamespace(namespace, configData);
    };
};
