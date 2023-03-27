import { AppService } from "elmer-common";

@AppService
export class Storage {
    private dataStorage: any = {};
    set<T={}>(name: string, value: T): void {
        this.dataStorage[name] = value;
    }
    get<T={}>(name: string): T|null|undefined {
        return this.dataStorage[name];
    }
}
