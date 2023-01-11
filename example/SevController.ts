import { ASevModel } from "../src/ServerClicnt/ASevModel";

interface IMsgData {
    proxy: {
        host: string;
        port: number;
    }
}

export class SevController extends ASevModel<IMsgData> {
    public onMessage?(event: MessageEvent<IMsgData>): void {
       console.log(event.data, "--------onController---Server side");
        throw new Error("Method not implemented.");
    }
    init(): void {
        this.sendToAll({
            type: "proxy",
            toUsers: [],
            data: {
                port: 1000,
                host: "0.0.0.0"
            }
        });
    }
}