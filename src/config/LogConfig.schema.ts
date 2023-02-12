import { ILogConfig } from "./ILogConfig";
import { ISchemaConfig } from "./ISchameConfig";

export default {
    properties: {
        level: {
            type: ["INFO","ERROR", "WARN", "DEBUG"] as any,
            isRequired: true
        }
    }
} as ISchemaConfig<ILogConfig>;