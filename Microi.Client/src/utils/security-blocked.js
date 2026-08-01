export const SECURITY_GUARD_DOCUMENTATION_URL = "https://microi.net/doc/more/security";

function isTrue(value) {
    return value === true || value === 1 || String(value || "").toLowerCase() === "true";
}

/**
 * 只识别后端明确返回的 DataAppend.SecurityBlocked 标记。
 * 普通 Code=0 业务错误、HTTP 失败或可伪造的响应 Header 都不会进入安全拦截页。
 */
export function readSecurityBlockedResult(value) {
    const result = value?.Code === undefined && value?.data ? value.data : value;
    const append = result?.DataAppend;
    if (!result || !append || !isTrue(append.SecurityBlocked)) return null;

    return {
        message: String(result.Msg || "当前IP访问过于频繁，已被安全防护临时拦截，请稍后再试或联系管理员。"),
        ip: String(append.Ip || ""),
        reason: String(append.Reason || ""),
        reasonKey: String(append.ReasonKey || ""),
        securityScope: String(append.SecurityScope || ""),
        stateBackend: String(append.StateBackend || ""),
        blockedAtUtc: String(append.BlockedAtUtc || ""),
        expiresAtUtc: String(append.ExpiresAtUtc || ""),
        retryAfterSeconds: Number(append.RetryAfterSeconds || 0),
        autoUnblock: append.AutoUnblock === undefined ? true : isTrue(append.AutoUnblock),
        unblockAdvice: String(append.UnblockAdvice || "到期后会自动解除；如需立即解除，请联系平台超级管理员。"),
        documentationUrl: String(append.DocumentationUrl || SECURITY_GUARD_DOCUMENTATION_URL)
    };
}
