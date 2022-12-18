import { WSClient } from "../src/WebClient";
import { createInstance } from "elmer-common";

const app = (createInstance(WSClient));
app.start({
    env: "DEV"
});