interface IMsgDataEx {
    text: string,
    binary: BinaryData,
    blob: Blob;
    Beat: string;
}

type TypeUseData<T, NType extends keyof T> = T[NType];

export interface IMsgData<T={}, MsgType = keyof (IMsgDataEx & T)> {
    type: MsgType;
    toUsers: string[];
    fromUser?: string;
    data: TypeUseData<T & IMsgDataEx, keyof (IMsgDataEx & T)>;
}
