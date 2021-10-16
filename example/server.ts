import { utils } from "elmer-common";
import { ServerSocket, AServerModel } from "../src/app";

class ServerModel extends AServerModel {
    static uid: string = "ServerModel";
    onMessage (message:MessageEvent, msgData: any) {
        console.log("---ServerModel---", message.type, msgData);
    }
    public undeliveredMessages?(message: MessageEvent<any>): boolean | undefined{
        if(message.type === "message" && utils.isString(message.data)) {
            const msgData = JSON.parse(message.data);
            console.log(msgData);
            return true;
        } else {
            return false;
        }
    }
}

(new ServerSocket({
    models: [ ServerModel ]
})).listen();