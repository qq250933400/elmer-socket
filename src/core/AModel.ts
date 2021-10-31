import { TypeMsgData } from "./ISocket";

type TypeMsgNotImplement = "None" | "End";

export class AModel {
    decodeMsgPackage<T=TypeMsgNotImplement, Attr={}>(msgData: String | Blob): TypeMsgData<T, Attr> {
        const result: TypeMsgData<T, Attr> = {
            msgType: "Chat",
            data: msgData
        } as any;
        return result as any;
    }
}