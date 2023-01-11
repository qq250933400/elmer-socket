import { createInstance } from "elmer-common";
import { Application } from "../src/ServerClicnt";
import { SevController } from "./SevController";

type TypeAppModel = {
    sev: SevController;
};

const app = createInstance(Application<TypeAppModel>);

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