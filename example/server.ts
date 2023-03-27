import { createInstance } from "elmer-common";
import { Application } from "../src/Server";
import { SevController } from "./SevController";

type TypeAppModel = {
    sev: SevController;
};

const app: Application<TypeAppModel> = createInstance(Application<TypeAppModel>);

app.useModel({
    sev: SevController
}).listen();

setTimeout(() => {
    app.sendToAll<any>({
        type: "json",
        data: {
            name: "string"
        }
    });
    console.log("----Send to All");
    app.sendToAll({
        type: "text",
        data: "ssss"
    });
    app.invoke("sev", "init");
}, 5000);