const SSO_API_ROOT = "/api/Sso";
const API_ENGINE_RUN = "/api/ApiEngine/Run";

async function postUrl(diyCommon, url, payload) {
    if (!diyCommon?.PostAsync) throw new Error("DiyCommon.PostAsync 不可用。");
    return diyCommon.PostAsync(url, payload || {}, null, null, "json");
}

async function postGateway(diyCommon, action, payload) {
    return postUrl(diyCommon, `${SSO_API_ROOT}/${action}`, payload);
}

async function postEngine(diyCommon, key, payload) {
    // 登录页必须在全新数据库、应用包尚未安装时仍可工作。统一入口在
    // 引擎缺失时返回标准 Code=0，而动态 /apiengine/{key} 会产生 HTTP 404。
    return postUrl(diyCommon, API_ENGINE_RUN, {
        ...(payload || {}),
        ApiEngineKey: key
    });
}

function resultData(result) {
    if (!result || result.Code !== 1) throw new Error(result?.Msg || "SSO 请求失败。");
    return result.Data || {};
}

const safeLegacyTokenName = /^[A-Za-z0-9._~-]{1,64}$/;

function decodeLegacyCredential(value) {
    const source = String(value || "").replace(/\+/g, "%20");
    if (!source || source.length > 16384) return "";
    try {
        return decodeURIComponent(source);
    } catch (_) {
        return "";
    }
}

/**
 * Read one configured legacy URL credential without treating an arbitrary
 * `?token=` parameter as authorization to start a login. The token name has
 * already been server-filtered, but is validated again before entering a
 * regular expression.
 */
export function readLegacySsoCredential(href, tokenName) {
    const name = String(tokenName || "").trim();
    if (!safeLegacyTokenName.test(name)) return "";
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?:[?&#]|%3F|%26)${escaped}(?:=|%3D)([^&#;]+)`, "i")
        .exec(String(href || ""));
    const credential = decodeLegacyCredential(match?.[1]);
    return credential === "$V8.CurrentToken$" ? "" : credential;
}

function popupFeatures(width, height) {
    const safeWidth = Math.max(520, Math.min(980, Number(width) || 740));
    const safeHeight = Math.max(640, Math.min(940, Number(height) || 780));
    const left = Math.max(0, Math.round((window.screenX || 0) + ((window.outerWidth || screen.width) - safeWidth) / 2));
    const top = Math.max(0, Math.round((window.screenY || 0) + ((window.outerHeight || screen.height) - safeHeight) / 2));
    return `popup=yes,width=${safeWidth},height=${safeHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}

function waitForCallback(popup, connectionKey, expectedOrigin, timeoutMilliseconds = 5 * 60 * 1000) {
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
            if (data.type !== "microi-sso-login"
                || String(data.provider || "").toLowerCase() !== String(connectionKey || "").toLowerCase()) return;
            complete(() => data.success
                ? resolve(data)
                : reject(new Error(data.message || "SSO 身份验证未完成。")));
        };
        window.addEventListener("message", onMessage);
        const closeWatcher = setInterval(() => {
            if (popup.closed) complete(() => reject(new Error("SSO 登录窗口已关闭。")));
        }, 500);
        const timeout = setTimeout(() => {
            try { popup.close(); } catch (_) {}
            complete(() => reject(new Error("SSO 登录等待超时，请重新发起。")));
        }, timeoutMilliseconds);
    });
}

export async function getSsoCapabilities(diyCommon, osClient) {
    return resultData(await postEngine(diyCommon, "sso_capabilities", { OsClient: osClient }));
}

export async function getLegacySsoCapabilities(diyCommon, osClient) {
    const data = resultData(await postEngine(diyCommon, "sso_legacy_capabilities", { OsClient: osClient }));
    return Array.isArray(data) ? data : [];
}

export async function runFederatedLogin({
    diyCommon,
    osClient,
    connectionKey,
    clientType = "PC",
    did = ""
}) {
    if (typeof window === "undefined") throw new Error("当前环境无法打开 SSO 登录窗口。");
    const key = String(connectionKey || "").trim();
    if (!key) throw new Error("SSO 连接不能为空。");
    const popup = window.open("about:blank", `microi-sso-${key.toLowerCase()}`, popupFeatures(740, 780));
    if (!popup) throw new Error("浏览器阻止了登录窗口，请允许本站弹出窗口后重试。");
    try {
        popup.document.title = "正在创建 SSO 安全会话…";
        const begin = resultData(await postGateway(diyCommon, "Begin", {
            OsClient: osClient,
            ConnectionKey: key,
            ReturnOrigin: window.location.origin
        }));
        const callbackOrigin = new URL(begin.CallbackUrl, window.location.href).origin;
        popup.resizeTo?.(Number(begin.Popup?.Width) || 740, Number(begin.Popup?.Height) || 780);
        popup.location.replace(begin.AuthorizeUrl);
        const callback = await waitForCallback(popup, key, callbackOrigin);
        return postEngine(diyCommon, "sso_complete_login", {
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

export default { getSsoCapabilities, getLegacySsoCapabilities, runFederatedLogin };
