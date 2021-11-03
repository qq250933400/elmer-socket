import { utils } from "elmer-common";
import { AClientModel } from "./AClientModel";
import { TypeMsgData } from "./ISocket";

export class WebClientModel extends AClientModel {
    static uid: string = "WebClient_ec84d2ce-e8cc-89c6-02b2-9d10021b";
    public static undeliveredMessages?(event: MessageEvent): boolean | undefined{
        if(event.type === "message" && utils.isString(event.data)) {
            const msgData: TypeMsgData = JSON.parse(event.data);
            return ["Beat"].indexOf(msgData.msgType) >= 0;
        } else {
            return false;
        }
    }
    public onMessage(event: MessageEvent): void {
        console.log(event.type);
    }
}