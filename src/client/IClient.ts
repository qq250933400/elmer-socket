
export const SendFileTypes = {
    processing: "SendFileProcessing",
    end: "SendFileEnd",
    response: "SendFileResp",
    complete: "SendFileComplete"
};


export type TypeReceiveFileEvent = {
    fileName: string;
    fileType: string;
    fileLength: number;
    fileId: string;
    fileData: Blob;
};
