import { WebClient } from "../src/app/WebClient";
import { AClientModel } from "../src/app/AClientModel";
import { utils } from "elmer-common";

class ClientModel extends AClientModel {
    static uid: string = "AClientModel";
    onMessage(event: MessageEvent): void {
        console.log("Client-Recieve: ",event.type, event.data);
    }
    onOpen() {
        setTimeout(() => {
            console.log("Send message to server");
            this.sendMsg({
                msgType: "Chat",
                data: "App",
                toUser: ["SendToServer"]
            });
            this.sendMsg({
                msgType: "Chat",
                data: "App+++++",
                toUser: ["SendToServer"]
            });
        }, 3000);
        
        console.log("Connected success!!!");
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

(new WebClient({
    models: [ ClientModel ],
    retryTime: 30,
    autoConnect: true
})).start();