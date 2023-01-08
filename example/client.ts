import { WSClient, AModel } from "../src/WebClient";
import { createInstance } from "elmer-common";

class ClientModel extends AModel {

}

const app = (createInstance(WSClient));
app.useModel(ClientModel);
app.start({
    env: "DEV"
});