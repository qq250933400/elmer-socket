import { ISchemaProperties } from "elmer-common/lib/Validation/Schema";
import { IClientConfig } from "./IClientConfig";

export default {
    host: {
        type: "Object",
        properties: {
            "DEV": {
                type: "String",
                defaultValue: "localhost"
            }
        }
    },
    port: {
        type: "Number",
        isRequired: true
    }
} as ISchemaProperties<IClientConfig>;