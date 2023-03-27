import { ISchemaProperties } from "elmer-common/lib/Validation/Schema";
import * as NodeFs from "fs";
import * as NodePath from "path";

declare var env: "DEV"|"SIT"|"UAT"|"PROD";

declare interface ISchemaConfig<T={}, FormatCallback={}> {
    properties: ISchemaProperties<T, FormatCallback>;
    formatCallback: FormatCallback;
}
declare var fs: NodeFs;
declare var path: NodePath;

declare var sessionStorage: Storage;