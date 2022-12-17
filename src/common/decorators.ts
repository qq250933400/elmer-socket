import { checkDir, getFilePath } from "../utils/file";
import * as path from "path";
import * as fs from "fs";
import { ISchemaProperties, getObjFromInstance, Schema } from "elmer-common";

/**
 * 读取配置文件
 * @param fileName - 配置文件相对路径 
 * @param initData - 默认参数，当配置文件不存在时将会使用此数据并生成配置文件
 * @returns 
 */
export const GetConfig = <T={}>(fileName: string, initData?: Partial<T>, schema?: ISchemaProperties<any>):Function => {
    return (target: any, attr: string):T => {
        const configFileName = path.resolve(process.cwd(), "./config/" + fileName);
        const schemaObj: Schema = getObjFromInstance(Schema, target)
        if(fs.existsSync(configFileName)) {
             
            const txt = fs.readFileSync(configFileName, "utf-8");
            const txtData = {
                ...(initData || {}),
                ...JSON.parse(txt)
            };
            Object.defineProperty(target, attr, {
                value: txtData,
                configurable: false,
                writable: false
            });
            if(schema) {
                if(!schemaObj.validate(txtData, schema as any)){
                    throw new Error(schemaObj.message);
                }
            }
            return txtData;
        } else {
            if(initData) {
                Object.defineProperty(target, attr, {
                    value: initData,
                    configurable: false,
                    writable: false
                });
                const savePath = getFilePath(configFileName);
                if(schema) {
                    if(!schemaObj.validate(initData, schema as any)){
                        throw new Error(schemaObj.message);
                    }
                }
                checkDir(savePath, process.cwd());
                fs.writeFileSync(configFileName, JSON.stringify(initData, null, 4), "utf-8");
                return initData as any;
            } else {
                throw new Error("Can not found the configuration file. please check the ENV config");
            }
        }
    }
};