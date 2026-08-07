const API_ROOT = "/api/IdentityVerification";

function toBase64Url(value) {
    const bytes = value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new Uint8Array(value?.buffer || value || []);
    let binary = "";
    for (let index = 0; index < bytes.byteLength; index += 1) {
        binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
}

function preparePublicKey(options) {
    const publicKey = { ...(options || {}) };
    publicKey.challenge = fromBase64Url(publicKey.challenge);
    if (publicKey.user?.id) {
        publicKey.user = { ...publicKey.user, id: fromBase64Url(publicKey.user.id) };
    }
    ["allowCredentials", "excludeCredentials"].forEach((name) => {
        if (Array.isArray(publicKey[name])) {
            publicKey[name] = publicKey[name].map((item) => ({
                ...item,
                id: fromBase64Url(item.id)
            }));
        }
    });
    return publicKey;
}

function serializeCredential(credential) {
    if (!credential) throw new Error("浏览器未返回身份凭据。");
    const response = credential.response || {};
    const result = {
        id: credential.id,
        rawId: toBase64Url(credential.rawId),
        type: credential.type,
        authenticatorAttachment: credential.authenticatorAttachment || null,
        clientExtensionResults: credential.getClientExtensionResults?.() || {},
        response: {
            clientDataJSON: toBase64Url(response.clientDataJSON)
        }
    };
    if (response.attestationObject) result.response.attestationObject = toBase64Url(response.attestationObject);
    if (response.authenticatorData) result.response.authenticatorData = toBase64Url(response.authenticatorData);
    if (response.signature) result.response.signature = toBase64Url(response.signature);
    if (response.userHandle) result.response.userHandle = toBase64Url(response.userHandle);
    if (typeof response.getTransports === "function") result.response.transports = response.getTransports();
    return result;
}

async function post(diyCommon, action, payload) {
    if (!diyCommon?.PostAsync) throw new Error("DiyCommon.PostAsync 不可用。");
    return diyCommon.PostAsync(`${API_ROOT}/${action}`, payload || {}, null, null, "json");
}

function resultData(result) {
    if (!result || result.Code !== 1) throw new Error(result?.Msg || "身份验证请求失败。");
    return result.Data || {};
}

export function isPasskeySupported() {
    return typeof window !== "undefined"
        && window.isSecureContext
        && typeof window.PublicKeyCredential !== "undefined"
        && typeof navigator !== "undefined"
        && typeof navigator.credentials?.get === "function";
}

export async function getIdentityCapabilities(diyCommon, osClient) {
    const result = await post(diyCommon, "GetCapabilities", { OsClient: osClient });
    return resultData(result);
}

export async function registerPasskey({ diyCommon, deviceName, did }) {
    if (!isPasskeySupported() || typeof navigator.credentials.create !== "function") {
        throw new Error("当前浏览器或访问方式不支持 Passkey，请使用 HTTPS、Windows Hello、Face ID、Touch ID 或安全密钥。");
    }
    const begin = resultData(await post(diyCommon, "BeginPasskeyRegistration", { DeviceName: deviceName }));
    const credential = await navigator.credentials.create({ publicKey: preparePublicKey(begin.PublicKey) });
    return post(diyCommon, "CompletePasskeyRegistration", {
        ChallengeId: begin.ChallengeId,
        Response: serializeCredential(credential),
        DeviceName: deviceName,
        Did: did || diyCommon.GetDid?.() || ""
    });
}

export async function verifyWithPasskey({
    diyCommon,
    osClient,
    account = "",
    purpose = "Login",
    actionHash = "",
    clientType = "PC",
    did = ""
}) {
    if (!isPasskeySupported()) {
        throw new Error("当前浏览器或访问方式不支持 Passkey，请使用 HTTPS 或本机安全上下文。");
    }
    const begin = resultData(await post(diyCommon, "BeginPasskeyAuthentication", {
        OsClient: osClient,
        Account: account,
        Purpose: purpose,
        ActionHash: actionHash
    }));
    const credential = await navigator.credentials.get({ publicKey: preparePublicKey(begin.PublicKey) });
    return post(diyCommon, "CompletePasskeyAuthentication", {
        OsClient: osClient,
        ChallengeId: begin.ChallengeId,
        Response: serializeCredential(credential),
        Did: did || diyCommon.GetDid?.() || "",
        _ClientType: clientType
    });
}

export async function sha256Hex(value) {
    if (!globalThis.crypto?.subtle) throw new Error("当前环境不支持安全摘要计算。");
    const bytes = new TextEncoder().encode(String(value || ""));
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("");
}

export async function createPasswordChangeActionHash(userId, encodedNewPassword) {
    return sha256Hex(`Microi:ChangePassword:v1:${userId || ""}:${encodedNewPassword || ""}`);
}

export async function requestPasswordChangeTicket({ diyCommon, osClient, account, userId, encodedNewPassword, clientType }) {
    const capabilities = await getIdentityCapabilities(diyCommon, osClient);
    if (!capabilities.Enabled || !capabilities.PasswordChangeStepUp) return "";
    const actionHash = await createPasswordChangeActionHash(userId, encodedNewPassword);
    let result;
    if (capabilities.PasskeyEnabled && capabilities.HasPasskey) {
        result = await verifyWithPasskey({
            diyCommon,
            osClient,
            account,
            purpose: "ChangePassword",
            actionHash,
            clientType
        });
    } else if (capabilities.FaceEnabled && capabilities.HasFace) {
        result = await verifyWithFace({
            diyCommon,
            osClient,
            account,
            purpose: "ChangePassword",
            actionHash,
            clientType
        });
    } else {
        return "";
    }
    return resultData(result).Ticket || "";
}

export async function listAuthenticators(diyCommon) {
    return resultData(await post(diyCommon, "ListAuthenticators", {}));
}

export async function renameAuthenticator(diyCommon, id, deviceName) {
    return post(diyCommon, "RenameAuthenticator", { Id: id, DeviceName: deviceName });
}

export async function revokeAuthenticator(diyCommon, id) {
    return post(diyCommon, "RevokeAuthenticator", { Id: id });
}

function wait(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function verifyWithFace({
    diyCommon,
    osClient,
    account = "",
    purpose = "Login",
    actionHash = "",
    mode = "Verify",
    clientType = "PC",
    did = "",
    returnUrl = ""
}) {
    const popup = window.open("about:blank", "microi-face-verification", "popup,width=520,height=760");
    if (!popup) throw new Error("浏览器阻止了人脸验证窗口，请允许本站弹出窗口后重试。");
    try {
        popup.document.title = "正在创建人脸验证会话…";
        const begin = resultData(await post(diyCommon, "BeginFaceVerification", {
            OsClient: osClient,
            Account: account,
            Purpose: purpose,
            ActionHash: actionHash,
            Mode: mode,
            ReturnUrl: returnUrl || window.location.href
        }));
        popup.location.replace(begin.SessionUrl);
        const deadline = Date.now() + Math.min(Number(begin.ExpiresInSeconds || 300), 300) * 1000;
        while (Date.now() < deadline) {
            await wait(1500);
            const result = await post(diyCommon, "CompleteFaceVerification", {
                OsClient: osClient,
                ChallengeId: begin.ChallengeId,
                Did: did || diyCommon.GetDid?.() || "",
                _ClientType: clientType
            });
            if (result?.Code === 1) {
                try { popup.close(); } catch (_) {}
                return result;
            }
            if (result?.Code !== 2) throw new Error(result?.Msg || "人脸验证失败。");
            if (popup.closed) throw new Error("人脸验证窗口已关闭。");
        }
        throw new Error("人脸验证已超时，请重新发起。");
    } catch (error) {
        try { popup.close(); } catch (_) {}
        throw error;
    }
}

export const IdentityVerification = {
    getCapabilities: getIdentityCapabilities,
    isPasskeySupported,
    registerPasskey,
    verifyWithPasskey,
    createPasswordChangeActionHash,
    requestPasswordChangeTicket,
    listAuthenticators,
    renameAuthenticator,
    revokeAuthenticator,
    verifyWithFace,
    serializeCredential,
    preparePublicKey
};

export default IdentityVerification;
