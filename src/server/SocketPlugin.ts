import { TypeMsgData, TypeSocketEvent } from "./IServerSocket";
import { CommonUtils } from "../utils/CommonUtils";

export default abstract class SocketPlugin extends CommonUtils {
    /**
     * 接收socket消息
     * @param event 服务端消息事件
     * @param msgData 消息数据
     * @param msgEvent 原始消息事件对象
     */
    onMessage?(event: TypeSocketEvent, msgData: TypeMsgData, msgEvent: MessageEvent):void;
}