import { WSClient, AModel } from "../src/WebClient";
import { createInstance, utils } from "elmer-common";

interface IChat {
    logon: {
        userName: string;
        password: string;
    }
}

class ClientModel extends AModel<IChat> {
    public onMessage(event: MessageEvent<any>): void {
        console.log(event.data, "-----ClientModel");
    }

}

class UserModel extends AModel<IChat> {
    public onMessage(event: MessageEvent<any>): void {
        console.log(event.data, "----UserModel");
        if((event.data as any).type === "proxy") {
            this.send({
                type: "userName",
                data: {
                    name: "test"
                }
            } as any);
            console.log("---ToServer--");
        }
    }
    test(): void {
        console.log("do some test");
        this.on("onMessage", (event) => {
            console.log(event.data);
            if((event.data as any).type === "proxy") {
                this.send({
                    type: "userName",
                    data: {
                        name: "test"
                    }
                } as any);
                console.log("---ToServer--");
            }
        })
    }
}
// 
type TypeUseModel = {
    client: ClientModel;
    user: UserModel;
}


const app = (createInstance(WSClient<{},TypeUseModel>));
app.model({
    client: ClientModel,
    user: UserModel
});
app.start({
    env: "DEV"
}).ready(() => {
    app.send<IChat>({
        type: "logon",
        data: {
            password: "aaa",
            userName: "bbbb"
        },
        toUsers: ["aaa"]
    });
    app.invoke("user", "test");
});

console.log("----UID:", utils.guid().replace(/[-]{1,}/g, "").toUpperCase());