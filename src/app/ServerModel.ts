import { utils } from "elmer-common";
import { AServerModel, TypeUndeliveredMessageEvent } from "./AServerModel";
import { TypeMsgData, TypeServerMessageEvent } from "./ISocket";

export class ServerModel extends AServerModel {
    static uid: string = "ServerModel_ec84d2ce-e8cc-89c6-02b2-9d10021b";
    public undeliveredMessages?(event: TypeUndeliveredMessageEvent): boolean | undefined{
        if(event.type === "message" && utils.isString(event.data)) {
            const msgData: TypeMsgData = JSON.parse(event.data);
            return ["Beat"].indexOf(msgData.msgType) >= 0;
        } else {
            return false;
        }
    }
    onMessage (event:TypeServerMessageEvent, msgData: TypeMsgData) {
        switch(msgData.msgType) {
            case "Beat": {
                event.reply({
                    msgType: "Beat",
                    toUser: [event.uid],
                    isBacked: true
                });
                console.log("send message back: ", event.uid);
                break;
            }
        }
    }
}
