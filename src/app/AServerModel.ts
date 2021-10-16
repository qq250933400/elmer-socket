import { TypeMsgData } from "./ISocket";
import { ServerSocket } from "./ServerSocket";

export type TypeUndeliveredMessageEvent = {
    type: string;
    data: any
}

export abstract class AServerModel {
    private server: ServerSocket;
    constructor(_server: ServerSocket) {
        this.server = _server;
    }
    public abstract undeliveredMessages?(message: TypeUndeliveredMessageEvent): boolean| undefined;
    sendTo<T="None",P={}>(msgData: TypeMsgData<T>): Promise<P> {
        return new Promise<P>((resolve, reject) => {
            const toUsers = msgData.toUser || [];
            const sendStatus:any = {};
            const sendResult: any = {};
            msgData.toUser = [];
            const checkSendStatus = (): void => {
                let pass = true;
                let sendAll = true;
                Object.keys(sendStatus).forEach((sid: string) => {
                    const status = sendStatus[sid];
                    if(status === "Send") {
                        sendAll = false;
                    }
                    if(status === "Fail") {
                        pass = false;
                    }
                });
                if(sendAll) {
                    if(pass) {
                        resolve(sendResult);
                    } else {
                        reject(sendResult);
                    }
                }
            }
            toUsers.forEach((uid: string) => {
                sendStatus[uid] = "Send";
                ((suid: string) => {
                    this.server.sendTo(msgData, uid)
                        .then((data:any) => {
                            sendResult[suid] = data;
                            sendStatus[suid] = "Success";
                            checkSendStatus();
                        }).catch((err) => {
                            sendResult[suid] = err;
                            sendStatus[suid] = "Fail";
                            checkSendStatus();
                        });
                })(uid);
            });
        });
    }
    sendToAll<T="None",P={}>(msgData: TypeMsgData<T,P>): void {
        return this.sendToAll<T,P>(msgData);
    }
}
