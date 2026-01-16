/**
 * AES 加密工具类
 * 需要安装: npm install crypto-js --save
 */
import CryptoJS from 'crypto-js';

// AES密钥（16位），生产环境建议从后端获取或使用环境变量
const AES_KEY = 'YOUR_SECRET_KEY_16_CHARS_HERE'; // 16位密钥
const AES_IV = 'YOUR_IV_16_CHARS'; // 16位初始化向量

/**
 * AES加密
 * @param {string} text 要加密的文本
 * @returns {string} 加密后的base64字符串
 */
export function encryptAES(text) {
    try {
        const key = CryptoJS.enc.Utf8.parse(AES_KEY);
        const iv = CryptoJS.enc.Utf8.parse(AES_IV);
        
        const encrypted = CryptoJS.AES.encrypt(text, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        
        return encrypted.toString();
    } catch (error) {
        console.error('AES加密失败:', error);
        return null;
    }
}

/**
 * AES解密（后端使用）
 * @param {string} encryptedText 加密的base64字符串
 * @returns {string} 解密后的文本
 */
export function decryptAES(encryptedText) {
    try {
        const key = CryptoJS.enc.Utf8.parse(AES_KEY);
        const iv = CryptoJS.enc.Utf8.parse(AES_IV);
        
        const decrypted = CryptoJS.AES.decrypt(encryptedText, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });
        
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        console.error('AES解密失败:', error);
        return null;
    }
}

/**
 * MD5哈希（用于普通数据，不建议用于密码）
 * @param {string} text 要哈希的文本
 * @returns {string} MD5哈希值
 */
export function md5Hash(text) {
    return CryptoJS.MD5(text).toString();
}

/**
 * SHA256哈希
 * @param {string} text 要哈希的文本
 * @returns {string} SHA256哈希值
 */
export function sha256Hash(text) {
    return CryptoJS.SHA256(text).toString();
}
