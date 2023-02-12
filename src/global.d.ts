import { ISchemaProperties } from "elmer-common/lib/Validation/Schema";

declare var env: "DEV"|"SIT"|"UAT"|"PROD";

declare interface ISchemaConfig<T={}, FormatCallback={}> {
    properties: ISchemaProperties<T, FormatCallback>;
    formatCallback: FormatCallback;
}