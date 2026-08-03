import CryptoJS from "crypto-js";

export const LOGIN_CREDENTIAL_HISTORY_STORAGE_KEY = "microi-login-credential-history-v1";
export const MAX_REMEMBERED_LOGIN_ACCOUNTS = 8;

const STORAGE_VERSION = 1;
const PASSWORD_CIPHER_PREFIX = "aes-v1:";
const PASSWORD_SECRET_NAMESPACE = "Microi.LoginCredentialHistory.v1";
const MAX_AVATAR_DATA_URL_LENGTH = 96 * 1024;

function getDefaultStorage() {
    if (typeof window === "undefined") return null;
    return window.localStorage || null;
}

function normalizeText(value) {
    return String(value == null ? "" : value).trim();
}

function normalizeOsClient(value) {
    return normalizeText(value).toLowerCase() || "default";
}

function normalizeAccount(value) {
    return normalizeText(value).toLowerCase();
}

function getPasswordSecret(osClient) {
    // 这是浏览器本地可逆加密，只用于避免密码以明文/Base64 直接出现在 localStorage。
    // 密钥随前端代码一同分发，不能抵御已获得本机或页面脚本执行权限的攻击者。
    return PASSWORD_SECRET_NAMESPACE + "|" + normalizeOsClient(osClient);
}

function encryptPassword(password, osClient) {
    const payload = JSON.stringify({ Version: STORAGE_VERSION, Password: String(password == null ? "" : password) });
    return PASSWORD_CIPHER_PREFIX + CryptoJS.AES.encrypt(payload, getPasswordSecret(osClient)).toString();
}

function decryptPassword(cipherText, osClient) {
    const value = normalizeText(cipherText);
    if (!value.startsWith(PASSWORD_CIPHER_PREFIX)) return null;
    try {
        const decrypted = CryptoJS.AES.decrypt(
            value.slice(PASSWORD_CIPHER_PREFIX.length),
            getPasswordSecret(osClient)
        ).toString(CryptoJS.enc.Utf8);
        const payload = JSON.parse(decrypted);
        if (payload && payload.Version === STORAGE_VERSION && typeof payload.Password === "string") {
            return payload.Password;
        }
    } catch (error) {
        // 损坏、跨租户或旧密钥数据按不可用处理，绝不回退为明文。
    }
    return null;
}

function readContainer(storage) {
    const target = storage || getDefaultStorage();
    if (!target || typeof target.getItem !== "function") {
        return { Version: STORAGE_VERSION, Records: [] };
    }
    try {
        const parsed = JSON.parse(target.getItem(LOGIN_CREDENTIAL_HISTORY_STORAGE_KEY) || "{}");
        return {
            Version: STORAGE_VERSION,
            Records: Array.isArray(parsed && parsed.Records) ? parsed.Records : []
        };
    } catch (error) {
        return { Version: STORAGE_VERSION, Records: [] };
    }
}

function writeContainer(storage, records) {
    const target = storage || getDefaultStorage();
    if (!target || typeof target.setItem !== "function") return false;
    try {
        target.setItem(LOGIN_CREDENTIAL_HISTORY_STORAGE_KEY, JSON.stringify({
            Version: STORAGE_VERSION,
            Records: records
        }));
        return true;
    } catch (error) {
        return false;
    }
}

function isSameCredential(record, osClient, account) {
    return normalizeOsClient(record && record.OsClient) === normalizeOsClient(osClient)
        && normalizeAccount(record && record.Account) === normalizeAccount(account);
}

function getAvatarDataUrl(value) {
    const avatar = normalizeText(value);
    if (!/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(avatar)) return "";
    return avatar.length <= MAX_AVATAR_DATA_URL_LENGTH ? avatar : "";
}

function getNextAvatarDataUrl(value, fallback) {
    return getAvatarDataUrl(value) || getAvatarDataUrl(fallback);
}

function toPublicRecord(record, password) {
    return {
        Account: normalizeText(record.Account),
        Password: password,
        UserId: normalizeText(record.UserId),
        DisplayName: normalizeText(record.DisplayName),
        Avatar: normalizeText(record.Avatar),
        AvatarDataUrl: getAvatarDataUrl(record.AvatarDataUrl),
        UpdatedAt: Number(record.UpdatedAt) || 0
    };
}

export function readRememberedLoginAccounts(options = {}) {
    const osClient = normalizeOsClient(options.osClient);
    return readContainer(options.storage).Records
        .filter((record) => normalizeOsClient(record && record.OsClient) === osClient)
        .map((record) => ({ record, password: decryptPassword(record && record.PasswordCipher, osClient) }))
        .filter((item) => item.password !== null && normalizeText(item.record && item.record.Account))
        .map((item) => toPublicRecord(item.record, item.password))
        .sort((left, right) => right.UpdatedAt - left.UpdatedAt);
}

export function upsertRememberedLoginAccount(options = {}) {
    const account = normalizeText(options.account);
    const password = String(options.password == null ? "" : options.password);
    const osClient = normalizeOsClient(options.osClient);
    if (!account || !password) return readRememberedLoginAccounts(options);

    const container = readContainer(options.storage);
    const previous = container.Records.find((record) => isSameCredential(record, osClient, account)) || {};
    const user = options.user && typeof options.user === "object" ? options.user : {};
    const avatar = normalizeText(user.Avatar || user.HeadIcon || user.HeadImg || previous.Avatar);
    const record = {
        Version: STORAGE_VERSION,
        OsClient: osClient,
        Account: account,
        PasswordCipher: encryptPassword(password, osClient),
        UserId: normalizeText(user.Id || previous.UserId),
        DisplayName: normalizeText(user.Name || user.NickName || previous.DisplayName),
        Avatar: avatar,
        AvatarDataUrl: getNextAvatarDataUrl(options.avatarDataUrl, previous.AvatarDataUrl),
        UpdatedAt: Number(options.updatedAt) || Date.now()
    };

    const otherRecords = container.Records.filter((item) => !isSameCredential(item, osClient, account));
    const currentTenantRecords = [record]
        .concat(otherRecords.filter((item) => normalizeOsClient(item && item.OsClient) === osClient))
        .sort((left, right) => (Number(right.UpdatedAt) || 0) - (Number(left.UpdatedAt) || 0))
        .slice(0, MAX_REMEMBERED_LOGIN_ACCOUNTS);
    const records = otherRecords
        .filter((item) => normalizeOsClient(item && item.OsClient) !== osClient)
        .concat(currentTenantRecords);

    writeContainer(options.storage, records);
    return readRememberedLoginAccounts(options);
}

export function updateRememberedLoginAccountProfile(options = {}) {
    const account = normalizeText(options.account);
    const osClient = normalizeOsClient(options.osClient);
    if (!account) return readRememberedLoginAccounts(options);

    const container = readContainer(options.storage);
    const user = options.user && typeof options.user === "object" ? options.user : {};
    let changed = false;
    const records = container.Records.map((record) => {
        if (!isSameCredential(record, osClient, account)) return record;
        changed = true;
        return {
            ...record,
            UserId: normalizeText(user.Id || record.UserId),
            DisplayName: normalizeText(user.Name || user.NickName || record.DisplayName),
            Avatar: normalizeText(user.Avatar || user.HeadIcon || user.HeadImg || record.Avatar),
            AvatarDataUrl: getNextAvatarDataUrl(options.avatarDataUrl, record.AvatarDataUrl),
            UpdatedAt: Number(options.updatedAt) || Number(record.UpdatedAt) || Date.now()
        };
    });
    if (changed) writeContainer(options.storage, records);
    return readRememberedLoginAccounts(options);
}

export function removeRememberedLoginAccount(options = {}) {
    const account = normalizeText(options.account);
    const osClient = normalizeOsClient(options.osClient);
    const container = readContainer(options.storage);
    const records = container.Records.filter((record) => !isSameCredential(record, osClient, account));
    writeContainer(options.storage, records);
    return readRememberedLoginAccounts(options);
}

export function clearRememberedLoginAccounts(options = {}) {
    const osClient = normalizeOsClient(options.osClient);
    const container = readContainer(options.storage);
    const records = container.Records.filter((record) => normalizeOsClient(record && record.OsClient) !== osClient);
    writeContainer(options.storage, records);
    return [];
}
