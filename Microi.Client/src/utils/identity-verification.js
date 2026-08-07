const API_ROOT = "/api/IdentityVerification";
const EXTERNAL_LOGIN_API_ROOT = "/api/ExternalLogin";

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

async function postExternalLogin(diyCommon, action, payload) {
    if (!diyCommon?.PostAsync) throw new Error("DiyCommon.PostAsync 不可用。");
    return diyCommon.PostAsync(`${EXTERNAL_LOGIN_API_ROOT}/${action}`, payload || {}, null, null, "json");
}

function resultData(result) {
    if (!result || result.Code !== 1) throw new Error(result?.Msg || "身份验证请求失败。");
    return result.Data || {};
}

function webAuthnPageContext(publicKey) {
    const location = typeof window !== "undefined" ? window.location : null;
    return {
        origin: String(location?.origin || "未知"),
        hostname: String(location?.hostname || "未知"),
        rpId: String(publicKey?.rpId || publicKey?.rp?.id || "未返回")
    };
}

export function translateWebAuthnError(error, publicKey = {}) {
    const name = String(error?.name || "");
    const rawMessage = String(error?.message || error || "");
    const context = webAuthnPageContext(publicKey);
    const relyingPartyMismatch = /relying party id|registrable domain suffix|\.well-known\/webauthn/i.test(rawMessage);

    if (relyingPartyMismatch) {
        return new Error(
            `无法使用生物识别：Passkey 域名配置与当前站点不匹配。当前页面域名为“${context.hostname}”，`
            + `后端下发的 RP ID 为“${context.rpId}”。请由租户管理员进入“系统设置 → 登录与身份”，`
            + `将 Passkey RP ID 设置为当前页面域名（最稳妥），或设置为它的可注册父域；`
            + `同时把完整 Origin“${context.origin}”加入 PasskeyOrigins，并确认页面使用 HTTPS。`
            + `如确实需要跨站点 RP ID，还必须在 RP ID 站点正确发布可访问的 /.well-known/webauthn 关联声明。`
            + "保存配置后，请重新登记通行密钥再登录。"
        );
    }
    if (name === "AbortError") {
        return new Error("设备验证等待超时，请确认系统验证窗口后重试。");
    }
    if (name === "NotAllowedError") {
        return new Error("设备验证已取消、超时，或当前通行密钥不允许此用途。");
    }
    if (name === "InvalidStateError") {
        return new Error("该通行密钥已在当前账号登记，无需重复添加；如需重建，请先在个人中心撤销旧通行密钥。");
    }
    if (name === "NotSupportedError") {
        return new Error("当前浏览器、系统验证器或安全密钥不支持服务器要求的 Passkey 算法，请升级浏览器或改用另一台受支持设备。");
    }
    if (name === "SecurityError") {
        return new Error(
            `浏览器安全策略阻止了 Passkey。当前站点为“${context.origin}”，RP ID 为“${context.rpId}”。`
            + "请确认使用 HTTPS，并检查“系统设置 → 登录与身份”中的 Passkey RP ID 与 PasskeyOrigins。"
        );
    }
    return error instanceof Error ? error : new Error(rawMessage || "设备验证失败，请重试。");
}

export function translateTotpFailure(value) {
    const rawMessage = String(value?.Msg || value?.message || value || "");
    if (!/computed authentication tag|authentication tag did not match|tag mismatch/i.test(rawMessage)) {
        return value;
    }
    const message = "Authenticator 密钥无法解密，通常是历史租户标识大小写不一致，或绑定后 AuthSecret 发生变化。"
        + "请先使用账号密码登录，在“个人中心 → 验证器”移除并重新登记 Authenticator；"
        + "管理员同时检查 SaaS 引擎 sys_osclients.AuthSecret 是否稳定且所有后端节点一致。";
    if (value instanceof Error) return new Error(message);
    return { ...(value || {}), Code: value?.Code ?? 0, Msg: message };
}

async function requestWebAuthnCredential(operation, publicKey, timeoutMilliseconds = 70000) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), timeoutMilliseconds);
    try {
        return await navigator.credentials[operation]({
            publicKey: preparePublicKey(publicKey),
            ...(controller ? { signal: controller.signal } : {})
        });
    } catch (error) {
        throw translateWebAuthnError(error, publicKey);
    } finally {
        clearTimeout(timeout);
    }
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

function popupFeatures(width, height) {
    const safeWidth = Math.max(480, Math.min(920, Number(width) || 720));
    const safeHeight = Math.max(620, Math.min(900, Number(height) || 760));
    const left = Math.max(0, Math.round((window.screenX || 0) + ((window.outerWidth || screen.width) - safeWidth) / 2));
    const top = Math.max(0, Math.round((window.screenY || 0) + ((window.outerHeight || screen.height) - safeHeight) / 2));
    return `popup=yes,width=${safeWidth},height=${safeHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}

function waitForExternalLoginPopup(popup, provider, expectedOrigin, timeoutMilliseconds = 5 * 60 * 1000) {
    return new Promise((resolve, reject) => {
        let finished = false;
        const cleanup = () => {
            window.removeEventListener("message", onMessage);
            clearInterval(closeWatcher);
            clearTimeout(timeout);
        };
        const complete = (callback) => {
            if (finished) return;
            finished = true;
            cleanup();
            callback();
        };
        const onMessage = (event) => {
            if (event.source !== popup || event.origin !== expectedOrigin) return;
            const data = event.data || {};
            if (data.type !== "microi-external-login"
                || String(data.provider || "").toLowerCase() !== String(provider || "").toLowerCase()) return;
            complete(() => data.success
                ? resolve(data)
                : reject(new Error(data.message || "外部身份验证未完成。")));
        };
        window.addEventListener("message", onMessage);
        const closeWatcher = setInterval(() => {
            if (popup.closed) complete(() => reject(new Error("外部登录窗口已关闭。")));
        }, 500);
        const timeout = setTimeout(() => {
            try { popup.close(); } catch (_) {}
            complete(() => reject(new Error("外部登录等待超时，请重新发起。")));
        }, timeoutMilliseconds);
    });
}

/**
 * 发起固定供应商 OAuth/扫码流程。授权码与 ClientSecret 始终只在后端交换，前端仅接收
 * 90 秒一次性票据；登录成功后仍由 DiyToken 返回统一会话。
 */
export async function runExternalLogin({
    diyCommon,
    osClient,
    provider,
    mode = "Login",
    clientType = "PC",
    did = ""
}) {
    if (typeof window === "undefined") throw new Error("当前环境无法打开外部登录窗口。");
    const providerKey = String(provider || "").trim();
    if (!providerKey) throw new Error("登录方式不能为空。");
    const popupName = `microi-external-login-${providerKey.toLowerCase()}`;
    const popup = window.open("about:blank", popupName, popupFeatures(720, 760));
    if (!popup) throw new Error("浏览器阻止了登录窗口，请允许本站弹出窗口后重试。");
    try {
        popup.document.title = "正在创建安全登录会话…";
        const begin = resultData(await postExternalLogin(diyCommon, "Begin", {
            OsClient: osClient,
            Provider: providerKey,
            Mode: String(mode).toLowerCase() === "bind" ? "Bind" : "Login",
            ReturnOrigin: window.location.origin
        }));
        const callbackOrigin = new URL(begin.CallbackUrl, window.location.href).origin;
        popup.resizeTo?.(Number(begin.Popup?.Width) || 720, Number(begin.Popup?.Height) || 760);
        popup.location.replace(begin.AuthorizeUrl);
        const callback = await waitForExternalLoginPopup(popup, providerKey, callbackOrigin);
        if (String(mode).toLowerCase() === "bind") return { Code: 1, Data: callback, Msg: callback.message || "绑定成功。" };
        return postExternalLogin(diyCommon, "CompleteLogin", {
            OsClient: osClient,
            Ticket: callback.ticket,
            Did: did || diyCommon.GetDid?.() || "",
            _ClientType: clientType
        });
    } catch (error) {
        try { popup.close(); } catch (_) {}
        throw error;
    }
}

export async function registerPasskey({ diyCommon, deviceName, did }) {
    if (!isPasskeySupported() || typeof navigator.credentials.create !== "function") {
        throw new Error("当前浏览器或访问方式不支持 Passkey，请使用 HTTPS、Windows Hello、Face ID、Touch ID 或安全密钥。");
    }
    const begin = resultData(await post(diyCommon, "BeginPasskeyRegistration", { DeviceName: deviceName }));
    const credential = await requestWebAuthnCredential("create", begin.PublicKey);
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
    const credential = await requestWebAuthnCredential("get", begin.PublicKey);
    return post(diyCommon, "CompletePasskeyAuthentication", {
        OsClient: osClient,
        ChallengeId: begin.ChallengeId,
        Response: serializeCredential(credential),
        Did: did || diyCommon.GetDid?.() || "",
        _ClientType: clientType
    });
}

export async function verifyWithTotp({
    diyCommon,
    osClient,
    account = "",
    code,
    purpose = "Login",
    actionHash = "",
    clientType = "PC",
    did = ""
}) {
    try {
        return translateTotpFailure(await post(diyCommon, "VerifyTotp", {
            OsClient: osClient,
            Account: String(account || "").trim(),
            Code: String(code || "").replace(/\D/g, "").slice(0, 6),
            Purpose: purpose,
            ActionHash: actionHash,
            Did: did || diyCommon.GetDid?.() || "",
            _ClientType: clientType
        }));
    } catch (error) {
        throw translateTotpFailure(error);
    }
}

export async function updateAuthenticatorPolicy(diyCommon, policy) {
    return post(diyCommon, "UpdateAuthenticatorPolicy", policy || {});
}

export async function beginTotpEnrollment(diyCommon) {
    return resultData(await post(diyCommon, "BeginTotpEnrollment", {}));
}

export async function completeTotpEnrollment(diyCommon, payload) {
    return post(diyCommon, "CompleteTotpEnrollment", payload || {});
}

export async function listTotpAuthenticators(diyCommon) {
    return resultData(await post(diyCommon, "ListTotpAuthenticators", {}));
}

export async function revokeTotpAuthenticator(diyCommon, id) {
    return post(diyCommon, "RevokeTotpAuthenticator", { Id: id });
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

export async function requestPasswordChangeTicket({ diyCommon, osClient, account, userId, encodedNewPassword, clientType, totpCode = "" }) {
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
    } else if (capabilities.TotpEnabled && capabilities.HasStepUpTotp && totpCode) {
        result = await verifyWithTotp({
            diyCommon,
            osClient,
            account,
            code: totpCode,
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
    updateAuthenticatorPolicy,
    beginTotpEnrollment,
    completeTotpEnrollment,
    listTotpAuthenticators,
    revokeTotpAuthenticator,
    verifyWithTotp,
    verifyWithFace,
    runExternalLogin,
    serializeCredential,
    preparePublicKey,
    translateWebAuthnError
};

export default IdentityVerification;
