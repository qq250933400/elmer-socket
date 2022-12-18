import { RequestService } from "elmer-common";

@RequestService
export class Client {
    public uid!: string;
    public dispose!: Function;
    private socket!: WebSocket;
    constructor() {
        // this.option = reqOption;
    }
    listen() {
        this.socket.addEventListener("message", (msgEvent: MessageEvent) => {
            console.log(msgEvent.type, msgEvent.data);
        });
        this.socket.addEventListener("close", this.onClose.bind(this));
    }
    private onClose(): void {
        this.dispose(this);
    }
}
