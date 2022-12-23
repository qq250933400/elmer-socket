import { AppService, utils } from "elmer-common";

export const StoreAction = () => {

};

@AppService
export class Store<TData={}> {
    private storeData: any = {};
    private isInit: boolean = false;
    storeInit(initData: TData): void {
        if(!this.isInit) {
            this.storeData = initData || {};
        } else {
            throw new Error("Store不允许重复执行初始化方法。");
        }
    }
    get<TKey extends keyof TData>(key: TKey): TData[TKey] {
        const keyValue = (utils.getValue(this.storeData, key as string)) as any;
        return { ...keyValue };
    }
}