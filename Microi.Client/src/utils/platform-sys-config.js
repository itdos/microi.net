const PLATFORM_SYS_CONFIG_URL = "/apiengine/platform-sys-config";
const LEGACY_SYS_CONFIG_URL = "/api/FormEngine/GetSysConfig";
const FALLBACK_HTTP_STATUSES = new Set([404, 405, 501]);

function responsePayload(value) {
    if (!value) return null;
    if (value.response && value.response.data !== undefined) return value.response.data;
    return value;
}

export function shouldFallbackPlatformSysConfig(value) {
    const status = Number(
        value?.response?.status ?? value?.status ?? value?.statusCode ?? 0
    );
    if (FALLBACK_HTTP_STATUSES.has(status)) return true;

    const payload = responsePayload(value);
    if (!payload || Number(payload.Code) === 1) return false;
    const message = String(payload.Msg || payload.Message || "").toLowerCase();
    if (!message) return false;

    // Dynamic ApiEngine routing historically returned HTTP 200 + DosResult.Code=0
    // for a missing engine.  Only this precise bootstrap absence may use the old
    // route; authorization, tenant, validation and other business failures must
    // never be hidden by a compatibility retry.
    return message.includes("sys_apiengine")
        && message.includes("platform-sys-config")
        && (
            message.includes("noexistdata")
            || message.includes("不存在的数据")
            || message.includes("不存在")
        );
}

function anonymousRequest(url, data) {
    return {
        url,
        data,
        skipAuthorization: true,
        suppressAuthFailure: true,
        suppressErrorNotification: true
    };
}

export async function getPlatformSysConfig(diyCommon, data) {
    let primaryResult;
    try {
        primaryResult = await diyCommon.PostAsync(
            anonymousRequest(PLATFORM_SYS_CONFIG_URL, data)
        );
    } catch (error) {
        if (!shouldFallbackPlatformSysConfig(error)) throw error;
        return diyCommon.PostAsync(anonymousRequest(LEGACY_SYS_CONFIG_URL, data));
    }

    if (!shouldFallbackPlatformSysConfig(primaryResult)) return primaryResult;
    return diyCommon.PostAsync(anonymousRequest(LEGACY_SYS_CONFIG_URL, data));
}

export const platformSysConfigRoutes = Object.freeze({
    primary: PLATFORM_SYS_CONFIG_URL,
    legacyFallback: LEGACY_SYS_CONFIG_URL
});
