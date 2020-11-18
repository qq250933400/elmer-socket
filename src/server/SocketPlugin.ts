import { TypeMsgData, TypeServerSocketEvent } from "./IServerSocket";
import { CommonUtils } from "../utils/CommonUtils";
import { IncomingMessage } from "http";

export default abstract class SocketPlugin extends CommonUtils {
    /**
     * 接收socket消息
     * @param event 服务端消息事件
     * @param msgData 消息数据
     * @param msgEvent 原始消息事件对象
     */
    onMessage?(event: TypeServerSocketEvent, msgData: TypeMsgData, msgEvent: MessageEvent):void;
    onConnection?(event: TypeServerSocketEvent, invMsg: IncomingMessage): void;
    onClose?(event: TypeServerSocketEvent, uid: string): void;
    onError?(event: TypeServerSocketEvent, error:any): void;
}