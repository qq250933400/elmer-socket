import "reflect-metadata";
import { utils } from "elmer-common";
import { DECORATORS_CLASS_TYPE } from "elmer-common/lib/decorators/base";
import { TypeMsgData } from "./ISocket";

const modelClassPool:any = {};
const modelObjPool: any = {};

const CONST_MSG_HANDLER_KEY = "msg_handler_20220427";
const DECORATORS_CLASS_TYPE_SOCKET_MODEL = "DECORATORS_CLASS_TYPE_SOCKET_MODEL";

type TypeMessageHandler = <MsgType, MsgAttr>(event: TypeMsgData​​<MsgType, MsgAttr>) => void;

interface ISocketModelOption {
    uid?: string;
};

interface IPropertyDescriptor<TypeValue> extends PropertyDescriptor {
    value: TypeValue;
}

export const SocketModel = (opt?:ISocketModelOption) => (target: new(...args:any[]) => any) => {
    const uid = opt?.uid || "socket_model_" + utils.guid();
    Reflect.defineMetadata("uid", uid, target);
    Reflect.defineMetadata(DECORATORS_CLASS_TYPE, DECORATORS_CLASS_TYPE_SOCKET_MODEL, target);
    if(!modelClassPool[uid]) {
        modelClassPool[uid] = target;
    } else {
        throw new Error("定义模块uid重复。");
    }
};

export const Message = <T="None">(msgType: T) => {
    return (target: any, attr: string, desc: IPropertyDescriptor<TypeMessageHandler>) => {
        const messageHandlers = Reflect.getMetadata(CONST_MSG_HANDLER_KEY, target.constructor);
        const handlers = { ...(messageHandlers || {}) };
        handlers[attr] = {
            type: msgType,
            callback: desc.value
        };
        delete target[attr];
        Object.defineProperty(target, attr, {
            enumerable: false,
            configurable: true,
            get: () => {
                return function() {
                    const classType = Reflect.getMetadata(DECORATORS_CLASS_TYPE, target.constructor);
                    if(classType !== DECORATORS_CLASS_TYPE_SOCKET_MODEL) {
                        throw new Error("Message处理模块必须使用SocketModel装饰器装载。");
                    }
                    return desc.value.apply(target, ...arguments);
                }
            }
        })
        Reflect.defineMetadata(CONST_MSG_HANDLER_KEY, handlers, target.constructor);
    };
};

export const createMessageDecorator = <MsgData={}>() => (msgType: keyof MsgData): any => Message(msgType)

type TypeCallHandlerResult = {
    method: string;
    target: any
};
type TypeCallModelApiOptions = {
    uid: string;
    method: string;
    initOpt: any;
};

export const callModelHandleMsg = (msgType: string, opt: any): TypeCallHandlerResult | undefined => {
    const uids = Object.keys(modelClassPool);
    for(const uid of uids) {
        const Model = modelClassPool[uid];
        const classType = Reflect.getMetadata(DECORATORS_CLASS_TYPE, Model);
        if(classType === DECORATORS_CLASS_TYPE_SOCKET_MODEL) {
            const handlers = Reflect.getMetadata(CONST_MSG_HANDLER_KEY, Model)||{};
           for(const attrKey of Object.keys(handlers)) {
               const handleInfo = handlers[attrKey];
                if(handleInfo.type === msgType) {
                    const obj = modelObjPool[uid] || (new Model(opt));
                    modelObjPool[uid] = obj;   
                    return {
                        method: attrKey,
                        target: obj
                    };
                }
           }
        }
    }
    return undefined;
};
/**
 * 调用Decorator装载的模块
 * @param option - 调用模块参数
 * @param args - 调用模块方法参数
 * @returns 
 */
export const callModelApi = (option: TypeCallModelApiOptions, ...args: any[]): any => {
    const uids = Object.keys(modelClassPool);
    for(const uid of uids) {
        const Model = modelClassPool[uid];
        const classType = Reflect.getMetadata(DECORATORS_CLASS_TYPE, Model);
        if(classType === DECORATORS_CLASS_TYPE_SOCKET_MODEL && uid === option.uid) {
            const obj = modelObjPool[uid] || (new Model(option.initOpt));
            modelObjPool[uid] = obj;
            if(typeof obj[option.method] === "function") {
                return obj[option.method].apply(obj, args);
            }
        }
    }
};