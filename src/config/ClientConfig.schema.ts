import { ISchemaConfig } from "./ISchameConfig";
import { IClientConfig } from "./IClientConfig";

export default {
    properties: {
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
    }
} as ISchemaConfig<IClientConfig>;