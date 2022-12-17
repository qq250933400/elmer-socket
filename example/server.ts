import { createInstance } from "elmer-common";
import { Application } from "../src/ServerClicnt";


const app = createInstance(Application);
app.listen();