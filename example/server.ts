import { createInstance } from "elmer-common";
import { Application } from "../src/ServerClicnt";
import { SevController } from "./SevController";


const app = createInstance(Application);

app.controller(SevController)
    .listen();

setTimeout(() => {
    app.sendToAll<any>({
        type: "json",
        data: {
            name: "string"
        }
    });
    app.sendToAll({
        type: "text",
        data: "ssss"
    })
}, 5000);