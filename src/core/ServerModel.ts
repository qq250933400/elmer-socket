import { utils } from "elmer-common";
import { AServerModel, TypeUndeliveredMessageEvent } from "./AServerModel";
import { TypeMsgData, TypeServerMessageEvent } from "./ISocket";

type TypeServerMsgData = {
    Beat: {
        text?: string;
    };
}

export class ServerModel extends AServerModel<TypeServerMsgData> {
    static uid: string = "ServerModel_ec84d2ce-e8cc-89c6-02b2-9d10021b";
    public static undeliveredMessages?(event: TypeUndeliveredMessageEvent): boolean | undefined{
        if(event.type === "message" && utils.isString(event.data)) {
            const msgData: TypeMsgData = JSON.parse(event.data);
            return ["Beat"].indexOf(msgData.msgType) >= 0;
        } else {
            return false;
        }
    }
    public onMessage<T extends keyof TypeServerMsgData>(event: TypeServerMessageEvent<TypeServerMsgData>, msgData: TypeMsgData<T>): void {
        switch(msgData.msgType) {
            case "Beat": {
                event.reply({
                    msgType: "Beat",
                    toUser: [event.fromUser],
                    isBacked: true
                });
                break;
            }
        }
    }
}
