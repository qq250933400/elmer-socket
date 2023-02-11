import { WSClient, AModel } from "../src/WebClient";
import { createInstance } from "elmer-common";

interface IChat {
    logon: {
        userName: string;
        password: string;
    }
}

class ClientModel extends AModel<IChat> {

}

class UserModel extends AModel<IChat> {
    test(): void {
        console.log("do some test");
        this.on("onMessage", (event) => {
            console.log(event.data);
        })
    }
}
// 
type TypeUseModel = {
    client: ClientModel;
    user: UserModel;
}


const app = (createInstance(WSClient<TypeUseModel>));
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
