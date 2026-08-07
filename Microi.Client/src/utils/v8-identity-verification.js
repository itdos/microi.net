import {
    getIdentityCapabilities,
    registerPasskey,
    sha256Hex,
    verifyWithFace,
    verifyWithPasskey
} from "@/utils/identity-verification.js";

function withCallback(promise, callback) {
    if (typeof callback === "function") {
        promise.then((result) => callback(result)).catch((error) => callback({ Code: 0, Msg: error?.message || String(error) }));
    }
    return promise;
}

/**
 * 为前端表单/列表 V8 注册受控身份验证能力。
 * 前端只取得短期票据；业务是否被授权必须由后端接口引擎调用
 * V8.Method.ConsumeIdentityVerificationTicket 再次原子校验。
 */
export function initV8IdentityVerification(V8) {
    if (!V8 || V8.Identity?.__microiIdentityVerification) return V8?.Identity;
    const diyCommon = V8.DiyCommon;
    const osClient = V8.OsClient || diyCommon?.GetOsClient?.() || "";
    V8.Identity = {
        __microiIdentityVerification: true,
        GetCapabilities(callback) {
            return withCallback(getIdentityCapabilities(diyCommon, osClient), callback);
        },
        CreateActionHash(value, callback) {
            return withCallback(sha256Hex(typeof value === "string" ? value : JSON.stringify(value ?? null)), callback);
        },
        RegisterPasskey(options = {}, callback) {
            return withCallback(registerPasskey({
                diyCommon,
                deviceName: options.DeviceName || options.deviceName || "我的 Passkey"
            }), callback);
        },
        Verify(options = {}, callback) {
            const promise = (async () => {
                const purpose = options.Purpose || options.purpose;
                const actionHash = options.ActionHash || options.actionHash;
                if (!purpose || purpose === "Login") throw new Error("前端 V8 只允许为登录后的敏感操作申请票据。");
                if (!actionHash) throw new Error("ActionHash 不能为空，必须绑定本次业务操作。");
                const capabilities = await getIdentityCapabilities(diyCommon, osClient);
                const method = String(options.Method || options.method || "Auto").toLowerCase();
                if (method === "face" || (method === "auto" && !capabilities.HasPasskey && capabilities.HasFace)) {
                    if (!capabilities.FaceEnabled) throw new Error("当前租户未启用严格人脸验证。");
                    return verifyWithFace({
                        diyCommon,
                        osClient,
                        account: V8.CurrentUser?.Account || "",
                        purpose,
                        actionHash,
                        clientType: V8.ClientType || "PC"
                    });
                }
                if (!capabilities.PasskeyEnabled) throw new Error("当前租户未启用 Passkey。");
                return verifyWithPasskey({
                    diyCommon,
                    osClient,
                    account: V8.CurrentUser?.Account || "",
                    purpose,
                    actionHash,
                    clientType: V8.ClientType || "PC"
                });
            })();
            return withCallback(promise, callback);
        }
    };
    return V8.Identity;
}

export default initV8IdentityVerification;
