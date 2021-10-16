import *  as fs from "fs";
import * as path from "path";
import { utils } from "elmer-common";

/**
 * 获取文件保存路径
 * @param fileName - 检查文件路径
 * @returns 
 */
export const getFilePath = (fileName: string): string => {
    const checkFileName = fileName.replace(/\\/g, "/");
    const lastIndex = checkFileName.lastIndexOf("/");
    return lastIndex > 0 ? checkFileName.substr(0, lastIndex) : fileName;
};
/**
 * 检查指定路径，不存在则创建
 * @param checkPath - 检查路径
 * @param securityPath - 安全目录
 */
export const checkDir = (checkPath: string, securityPath?: string): void => {
    const resPath = checkPath.replace(/\\/g, "/");
    const secPath = securityPath && !utils.isEmpty(securityPath) ? securityPath.replace(/\\/g, "/") : "";
    const resArr = resPath.split("/");
    if(!utils.isEmpty(securityPath)  && secPath !== resPath.substr(0, secPath.length)) {
        throw new Error("没有权限创建目录");
    } else {
        let fPath = "";
        let fIndex = 0;
        while(fIndex < resArr.length) {
            if(/\/$/.test(fPath)) {
                fPath += resArr[fIndex];
            } else {
                fPath += "/" + resArr[fIndex];
            }
            fIndex++;
            if(
                utils.isEmpty(securityPath) ||
                (!utils.isEmpty(securityPath) && fPath.length >= secPath.length && fPath.substr(0,secPath.length) === secPath)
            ) {
                if(!fs.existsSync(fPath)) {
                    // 检查目录不存在则创建新目录
                    fs.mkdirSync(fPath);
                }
            }
        }
    }
}
/**
 * 读取配置文件
 * @param fileName - 配置文件相对路径 
 * @param initData - 默认参数，当配置文件不存在时将会使用此数据并生成配置文件
 * @returns 
 */
export const GetConfig = <T={}>(fileName: string, initData?: T):Function => {
    return (target: any, attr: string):T => {
        const configFileName = path.resolve(process.cwd(), fileName);
        if(fs.existsSync(configFileName)) {
            const txt = fs.readFileSync(configFileName, "utf-8");
            const txtData = JSON.parse(txt);
            Object.defineProperty(target, attr, {
                value: txtData,
                configurable: false,
                writable: false
            });
            return txtData;
        } else {
            if(initData) {
                Object.defineProperty(target, attr, {
                    value: initData,
                    configurable: false,
                    writable: false
                });
                const savePath = getFilePath(configFileName);
                checkDir(savePath, process.cwd());
                fs.writeFileSync(configFileName, JSON.stringify(initData, null, 4), "utf-8");
                return initData;
            } else {
                throw new Error("Can not found the configuration file. please check the ENV config");
            }
        }
    }
};