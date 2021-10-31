import { utils } from "elmer-common";
import { ServerSocket, AServerModel, TypeMsgData, TypeServerMessageEvent } from "../src/core";

class ServerModel extends AServerModel {
    static uid: string = "ServerModel";
    onMessage (message:TypeServerMessageEvent, msgData: TypeMsgData) {
        if(msgData.msgType === "Chat") {
            this.sendTo({
                msgType: "Chat",
                data: "Message from server",
                toUser: [message.uid]
            });
        }
        console.log("---ServerModel---", message.uid, msgData);
    }
    public undeliveredMessages?(message: MessageEvent<any>): boolean | undefined{
        if(message.type === "message" && utils.isString(message.data)) {
            const msgData: TypeMsgData = JSON.parse(message.data);
            if(msgData.msgType === "Chat") {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }
    onConnection(): void {
        console.log("onServerOpen");
        setTimeout(() => {
            console.log("replay message");
            this.sendToAll<"N", {}>({
                msgType: "Chat",
                toUser: [],
                data: "send message"
            }).then((rsp) => {
                console.log("SendToAll", rsp)
            }).catch((err) => {
                console.error(err);
            })
        }, 3000);
    }
}

(new ServerSocket({
    models: [ ServerModel ]
})).listen();