import { ISchemaConfig } from "./ISchameConfig";
import { TypeServiceConfig } from "../common/ApiService";

export default {
    properties: {
        env: {
            type: ["MOCK", "DEV", "SIT", "UAT", "PROD"] as any,
            isRequired: true
        },
        config: {
            type: "Object",
            isRequired: true
        },
        host: {
            type: "Object",
            properties: {
                MOCK: {
                    type: "String"
                },
                DEV: {
                    type: "String"
                },
                SIT: {
                    type: "String"
                },
                UAT: {
                    type: "String"
                },
                PROD: {
                    type: "String"
                }
            }
        },
        isDummy: {
            type: "Boolean"
        },
        timeout: {
            type: "Number",
            defaultValue: 6000
        }
    }
} as ISchemaConfig<TypeServiceConfig>;