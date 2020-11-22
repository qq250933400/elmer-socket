require("mocha");
var assert = require("assert");
var CommonUtils = require("../lib/utils/CommonUtils").CommonUtils;

const com = new CommonUtils();

describe("Buffer and Arraybuffer are converted to each other", () => {
    describe("encode and decode websocket msg package", () => {
        it("encode and decode package in nodeJS", () => {
            const msg = Buffer.alloc(10);
            const info = {
                version: 1,
                auther: "elmer"
            };
            const resultData = com.encodeMsgPackage(msg, info, true);
            const decodeData = com.decodeMsgPackage(resultData, true);
            assert.strictEqual(com.getType(resultData), "[object Uint8Array]");
            assert.strictEqual(info.auther, decodeData.info.auther);
        });
        it("encode and decode package in Browser", () => {
            const msg = new Uint16Array(10);
            const info = {
                version: 2,
                auther: "elmer"
            };
            const resultData = com.encodeMsgPackage(msg, info, false);
            const decodeData = com.decodeMsgPackage(resultData, false);
            assert.strictEqual(com.getType(resultData), "[object Uint8Array]");
            assert.strictEqual(info.auther, decodeData.info.auther);
        });
    });
});