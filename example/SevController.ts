import { ASevModel } from "../src/Server/ASevModel";
import { IServerClientData } from "../src/data/IMessage";

interface IMsgData {
    proxy: {
        host: string;
        port: number;
    }
}

export class SevController extends ASevModel<IMsgData> {
    public onClientClose?(uid: string): void {
        console.log("---",uid);
        // throw new Error("Method not implemented.");
    }
    public onMessage?(event: MessageEvent<IMsgData>, api: IServerClientData): void {
       console.log(event.data, "--------onController---Server side");
       api.cookie.set("username", "elmer");
       api.cookie.set("password", "validation");
       this.sendToAll({
            type: "text",
            data: "Message from websocket server"
       });
    }
    init(): void {
        this.sendToAll({
            type: "proxy",
            data: {
                port: 1000,
                host: "0.0.0.0"
            }
        });
    }
}