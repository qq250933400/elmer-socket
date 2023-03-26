import { scryptSync, createCipheriv, createDecipheriv } from "crypto";
import { Service } from "elmer-common";

@Service
export class Crypto {
    /**
     * 对称加密
     * @param encodeText -加密文本
     * @param password - 加密密码
     * @param salt - 长度为8随机字符串
     */
    aesEncode(encodeText: string, password: string, salt: string = "elmerSJM"): string {
        const key = scryptSync(password, salt, 64);
        const iv = Buffer.alloc(16, 0);
        const algorithm = 'aes-192-cbc';
        const cipher = createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(encodeText, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }
    aesDecode(decodeText: string, password: string, salt: string = "elmerSJM"): string {
        const key = scryptSync(password, salt, 64);
        const iv = Buffer.alloc(16, 0);
        const algorithm = 'aes-192-cbc';
        const cipher = createDecipheriv(algorithm, key, iv);
        let decrypted = cipher.update(decodeText, 'hex', 'utf8');
        decrypted += cipher.final('utf8');
        return decrypted;
    }
}