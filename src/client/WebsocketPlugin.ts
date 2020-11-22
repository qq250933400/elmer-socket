import { TypeEndSendFileEvent, TypeFileSendProgress, TypeMsgData, TypeStartSendFileEvent } from "../server/IServerSocket";
import { SocketClient } from "./client";

export default abstract class WebsocketPlugin<T={}> {
    socket: SocketClient<T>;
    /**
     * 连接断开事件
     */
    onClose?(): void;
    /**
     * 错误事件
     * @param error
     */
    onError?(error:any): void;
    /**
     * 连接服务端成功事件
     * @param msgData 消息数据
     */
    onConnected?(msgData: TypeMsgData<T>):void;
    /**
     * 接收到消息事件
     * @param msgData 消息数据
     */
    onMessage?(msgData: TypeMsgData<T>): void;
    onStartReceiveFile?(data: TypeStartSendFileEvent): void;
    onEndReceiveFile?(data: TypeEndSendFileEvent): void;
    onSendFileProgress?(data: TypeFileSendProgress): void;
}
