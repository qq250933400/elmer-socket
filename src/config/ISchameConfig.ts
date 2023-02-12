import { ISchemaProperties } from "elmer-common/lib/Validation/Schema";


export declare interface ISchemaConfig<T={}, FormatCallback={}> {
    properties: ISchemaProperties<T, FormatCallback>;
    formatCallback?: FormatCallback;
}