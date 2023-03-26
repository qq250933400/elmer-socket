import { ISchemaConfig } from "./ISchameConfig";
import { IServerConfig } from "./IServerConfig";

export default {
    properties: {
        host: {
            type: "String",
            defaultValue: "0.0.0.0"
        },
        port: {
            type: "Number",
            isRequired: true,
            defaultValue: 3000
        },
        log: {
            type: "Object",
            properties: {
                level: {
                    type: ["INFO","DEBUG","ERROR", "WARN", "SUCCESS"],
                    defaultValue: "INFO"
                }
            }
        },
        security: {
            type: "Object",
            properties: {
                AsePublicKey: {
                    type: "String",
                    defaultValue: "a06ca88776f4ad0"
                }
            }
        }
    }
} as ISchemaConfig<IServerConfig>;

