import { WSClient } from "../src/WebClient";
import { createInstance } from "elmer-common";

(createInstance(WSClient)).start({
    env: "DEV"
});