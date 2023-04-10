import { AppService } from "elmer-common";

@AppService
export class Storage<T={}> {
    private dataStorage: any = {};
    set<DataKey extends keyof T>(name: DataKey, value: T[DataKey]): void {
        this.dataStorage[name] = value;
    }
    get<DataKey extends keyof T>(name: DataKey): T[DataKey]|null|undefined {
        return this.dataStorage[name];
    }
}
