import ClientReceiveFile from "./ClientReceiveFIle";
import { TypeMsgData } from "../server/IServerSocket";

type TypeSocketClientOption = {
    host: string;
    port: number;
    plugin?: any[];
};

type PluginLifeCycle = "onClose" | "onError" | "onConnected" | "onMessage" | "onStartReceiveFile" | "onEndReceiveFile";

export class SocketClient {
    options: TypeSocketClientOption;
    socket: WebSocket;
    fileObj: ClientReceiveFile;
    constructor(option: TypeSocketClientOption) {
        this.options = option;
        this.connection(option);
    }
    connection(option: TypeSocketClientOption): void {
        try {
            this.socket = new WebSocket(`ws://${option.host}:${option.port}`);
            this.socket.onmessage = this.onMessage.bind(this);
            this.socket.onopen = this.onConnected.bind(this);
            this.socket.onerror = this.onError.bind(this);
            this.socket.onclose = this.onClose.bind(this);
            this.fileObj = new ClientReceiveFile(this.socket);
            this.fileObj.on("Start", this.onStartReceiveFile.bind(this));
            this.fileObj.on("End", this.onEndReceiveFile.bind(this));
        } catch(e) {
            this.onError(e);
        }
    }
    private onClose(): void {
        this.callPlugin("onClose");
    }
    private onError(err:any): void {
        this.callPlugin("onError", err);
    }
    private onConnected(): void {
        this.callPlugin("onConnected");
    }
    private onMessage(evt:MessageEvent): void {
        if(typeof evt.data === "string" && evt.data.length > 0) {
            const msgData:TypeMsgData = JSON.parse(evt.data);
            if(!this.fileObj.onReceiveMessage(msgData)) {
                if(msgData.msgType === "Connected") {
                    this.callPlugin("onConnected", msgData);
                } else {
                    this.callPlugin("onMessage", msgData);
                }
            }
        } else {
            if(evt.data instanceof Blob) {
                this.fileObj.onReceiveBlob(evt.data);
            } else if(evt.data instanceof Buffer) {
                this.fileObj.onReceiveBuffer(evt.data);
            } else {
                // tslint:disable-next-line: no-console
                console.log("Not Support Data", evt.data);
                this.callPlugin("onError", {
                    statusCode: "C_T_500",
                    message: "Unsupported data type"
                });
            }
        }
    }
    private onStartReceiveFile(msgData:any): void {
        this.callPlugin("onStartReceiveFile", msgData);
    }
    private onEndReceiveFile(msgData:any): void {
        this.callPlugin("onEndReceiveFile", msgData);
    }
    private callPlugin(name: PluginLifeCycle, ...arg:any[]): void {
        this.options?.plugin?.map((plugin:any) => {
            typeof plugin[name] === "function" && plugin[name].apply(plugin, arg);
        });
    }
}
