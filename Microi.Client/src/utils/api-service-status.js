import { reactive } from "vue";
import { readSecurityBlockedResult, SECURITY_GUARD_DOCUMENTATION_URL } from "./security-blocked.js";

const NETWORK_STATUS_CODES = [502, 503, 504];
const HEALTH_CHECK_PATH = "/api/Diagnostics/health";
const HEALTH_CHECK_DELAY = 800;
const HEALTH_CHECK_RETRY_DELAY = 1200;
const HEALTH_CHECK_TIMEOUT = 5000;
const REQUIRED_HEALTH_FAILURES = 2;
const MIN_OUTAGE_DURATION = 1800;

export const apiServiceState = reactive({
    active: false,
    checking: false,
    mode: "connection",
    apiBase: "",
    osClient: "",
    requestUrl: "",
    requestPath: "",
    reason: "",
    errorCode: "",
    statusCode: 0,
    occurredAt: "",
    message: "",
    ip: "",
    reasonKey: "",
    securityScope: "",
    stateBackend: "",
    blockedAtUtc: "",
    expiresAtUtc: "",
    retryAfterSeconds: 0,
    autoUnblock: true,
    unblockAdvice: "",
    documentationUrl: SECURITY_GUARD_DOCUMENTATION_URL
});

let healthCheckTimer = 0;
let healthCheckPromise = null;
let evidenceVersion = 0;
let evidenceApiBase = "";
let firstFailureAt = 0;
let healthFailureCount = 0;
let pendingFailure = null;
let securityCheckTimer = 0;

function trimSlash(value) {
    return String(value || "").trim().replace(/\/+$/, "");
}

function getRequestUrl(context = {}) {
    return String(context.url || context.requestUrl || "").trim();
}

function getRequestPath(requestUrl, apiBase) {
    try {
        const resolved = new URL(requestUrl, apiBase || window.location.origin);
        return `${resolved.pathname}${resolved.search || ""}`;
    } catch (error) {
        return requestUrl || "/";
    }
}

function isPlatformRequest(requestUrl, apiBase) {
    if (!requestUrl) return true;
    if (!/^https?:\/\//i.test(requestUrl)) return true;
    if (!apiBase) return false;
    return trimSlash(requestUrl).toLowerCase().indexOf(`${trimSlash(apiBase).toLowerCase()}/`) === 0
        || trimSlash(requestUrl).toLowerCase() === trimSlash(apiBase).toLowerCase();
}

function isCanceledRequest(error) {
    const code = String(error?.code || "").toUpperCase();
    return code === "ERR_CANCELED" || code === "ECONNABORTED_CANCELED";
}

function resolveReason(error) {
    const status = Number(error?.response?.status || 0);
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    if (status === 502) return "网关未能连接到后端 API 服务";
    if (status === 503) return "后端 API 服务当前不可用";
    if (status === 504) return "网关等待后端 API 服务响应超时";
    if (code === "ECONNABORTED" || /timeout/i.test(message)) return "连接后端 API 服务超时";
    if (/certificate|ssl|tls/i.test(message)) return "HTTPS 证书或安全连接异常";
    return "浏览器无法与后端 API 服务建立连接";
}

function clearHealthCheckTimer() {
    if (!healthCheckTimer) return;
    window.clearTimeout(healthCheckTimer);
    healthCheckTimer = 0;
}

function clearSecurityCheckTimer() {
    if (!securityCheckTimer) return;
    window.clearTimeout(securityCheckTimer);
    securityCheckTimer = 0;
}

function resetOutageEvidence(options = {}) {
    evidenceVersion += 1;
    clearHealthCheckTimer();
    healthCheckPromise = null;
    evidenceApiBase = "";
    firstFailureAt = 0;
    healthFailureCount = 0;
    pendingFailure = null;
    clearSecurityCheckTimer();
    apiServiceState.checking = false;
    if (options.hide !== false) {
        apiServiceState.active = false;
        apiServiceState.mode = "connection";
    }
}

function scheduleSecurityExpiryCheck(expiresAtUtc) {
    clearSecurityCheckTimer();
    const expiresAt = Date.parse(expiresAtUtc || "");
    if (!Number.isFinite(expiresAt)) return;
    const delay = Math.max(250, expiresAt - Date.now() + 500);
    if (delay > 2147483647) return;
    securityCheckTimer = window.setTimeout(function () {
        securityCheckTimer = 0;
        checkApiServiceNow();
    }, delay);
    if (typeof securityCheckTimer?.unref === "function") securityCheckTimer.unref();
}

function activateSecurityBlock(info, context = {}) {
    resetOutageEvidence({ hide: false });
    const apiBase = trimSlash(context.apiBase) || trimSlash(window.location.origin);
    const requestUrl = getRequestUrl(context);
    apiServiceState.active = true;
    apiServiceState.checking = false;
    apiServiceState.mode = "security";
    apiServiceState.apiBase = apiBase;
    apiServiceState.osClient = String(context.osClient || "").trim() || apiServiceState.osClient || "未识别";
    apiServiceState.requestUrl = requestUrl;
    apiServiceState.requestPath = getRequestPath(requestUrl, apiBase);
    apiServiceState.message = info.message;
    apiServiceState.ip = info.ip;
    apiServiceState.reason = info.reason;
    apiServiceState.reasonKey = info.reasonKey;
    apiServiceState.securityScope = info.securityScope;
    apiServiceState.stateBackend = info.stateBackend;
    apiServiceState.blockedAtUtc = info.blockedAtUtc;
    apiServiceState.expiresAtUtc = info.expiresAtUtc;
    apiServiceState.retryAfterSeconds = info.retryAfterSeconds;
    apiServiceState.autoUnblock = info.autoUnblock;
    apiServiceState.unblockAdvice = info.unblockAdvice;
    apiServiceState.documentationUrl = info.documentationUrl || SECURITY_GUARD_DOCUMENTATION_URL;
    apiServiceState.errorCode = "SecurityBlocked";
    apiServiceState.statusCode = 200;
    apiServiceState.occurredAt = new Date().toLocaleString();
    scheduleSecurityExpiryCheck(info.expiresAtUtc);
    return true;
}

function updateDiagnostic(error, context, apiBase, requestUrl, statusCode) {
    apiServiceState.apiBase = apiBase || trimSlash(window.location.origin);
    apiServiceState.osClient = String(context.osClient || "").trim() || "未识别";
    apiServiceState.requestUrl = requestUrl;
    apiServiceState.requestPath = getRequestPath(requestUrl, apiServiceState.apiBase);
    apiServiceState.reason = resolveReason(error);
    apiServiceState.errorCode = String(error?.code || "");
    apiServiceState.statusCode = statusCode;
    apiServiceState.occurredAt = new Date().toLocaleString();
}

async function probeApiService(apiBase) {
    if (typeof window.fetch !== "function") return { reachable: false, securityInfo: null };

    const controller = typeof AbortController === "undefined" ? null : new AbortController();
    const timeoutId = window.setTimeout(function () {
        controller?.abort();
    }, HEALTH_CHECK_TIMEOUT);
    const healthUrl = `${trimSlash(apiBase || window.location.origin)}${HEALTH_CHECK_PATH}?_=${Date.now()}`;

    try {
        const response = await window.fetch(healthUrl, {
            method: "GET",
            cache: "no-store",
            credentials: "omit",
            headers: {
                Accept: "application/json"
            },
            signal: controller?.signal
        });

        let responseData = null;
        if (typeof response.json === "function") {
            try {
                responseData = await response.json();
            } catch (error) {
                responseData = null;
            }
        }
        const securityInfo = readSecurityBlockedResult(responseData);
        // 404/401/500 等响应仍能证明 API 服务可达；只有网关级不可用才视为整体故障。
        return {
            reachable: NETWORK_STATUS_CODES.indexOf(Number(response.status || 0)) === -1,
            securityInfo
        };
    } catch (error) {
        return { reachable: false, securityInfo: null };
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function scheduleHealthCheck(delay = HEALTH_CHECK_DELAY) {
    if (healthCheckTimer || healthCheckPromise || !pendingFailure) return;
    const version = evidenceVersion;
    healthCheckTimer = window.setTimeout(function () {
        healthCheckTimer = 0;
        runHealthCheck(version);
    }, delay);
}

async function runHealthCheck(version) {
    if (version !== evidenceVersion || !pendingFailure || healthCheckPromise) return false;

    const apiBase = evidenceApiBase || apiServiceState.apiBase;
    apiServiceState.checking = apiServiceState.active;
    const currentProbe = probeApiService(apiBase);
    healthCheckPromise = currentProbe;
    const probeResult = await currentProbe;
    const reachable = probeResult.reachable;
    if (healthCheckPromise === currentProbe) {
        healthCheckPromise = null;
    }

    if (version !== evidenceVersion) return reachable;

    if (probeResult.securityInfo) {
        activateSecurityBlock(probeResult.securityInfo, {
            apiBase,
            osClient: apiServiceState.osClient,
            url: HEALTH_CHECK_PATH
        });
        return false;
    }

    if (reachable) {
        resetOutageEvidence();
        return true;
    }

    healthFailureCount += 1;
    const outageDuration = Date.now() - firstFailureAt;
    if (
        healthFailureCount >= REQUIRED_HEALTH_FAILURES
        && outageDuration >= MIN_OUTAGE_DURATION
    ) {
        apiServiceState.active = true;
        apiServiceState.checking = false;
        return false;
    }

    scheduleHealthCheck(HEALTH_CHECK_RETRY_DELAY);
    return false;
}

export function reportApiServiceFailure(error, context = {}) {
    if (typeof window === "undefined" || !error || isCanceledRequest(error)) return false;

    const securityInfo = readSecurityBlockedResult(error?.response?.data);
    if (securityInfo) return activateSecurityBlock(securityInfo, context);
    if (apiServiceState.active && apiServiceState.mode === "security") return true;

    const apiBase = trimSlash(context.apiBase);
    const requestUrl = getRequestUrl(context);
    const statusCode = Number(error?.response?.status || 0);
    const isConnectionFailure = !error.response
        || NETWORK_STATUS_CODES.indexOf(statusCode) > -1
        || String(error?.code || "").toUpperCase() === "ECONNABORTED";

    if (!isConnectionFailure || !isPlatformRequest(requestUrl, apiBase)) return false;

    const resolvedApiBase = apiBase || trimSlash(window.location.origin);
    if (evidenceApiBase && evidenceApiBase !== resolvedApiBase) {
        resetOutageEvidence({ hide: false });
    }

    if (!firstFailureAt) {
        firstFailureAt = Date.now();
    }
    evidenceApiBase = resolvedApiBase;
    pendingFailure = { error, context };
    updateDiagnostic(error, context, resolvedApiBase, requestUrl, statusCode);
    scheduleHealthCheck();
    return true;
}

export function reportApiServiceResponse(responseData, context = {}) {
    if (typeof window === "undefined") return false;
    const securityInfo = readSecurityBlockedResult(responseData);
    return securityInfo ? activateSecurityBlock(securityInfo, context) : false;
}

export function reportApiServiceRecovered(context = {}) {
    if (reportApiServiceResponse(context.responseData, context)) return;
    // 并发请求中可能仍有其它正常响应，不能让它覆盖当前 IP 的明确拦截事实。
    if (apiServiceState.active && apiServiceState.mode === "security") return;
    if (!apiServiceState.active && !pendingFailure) return;
    const apiBase = trimSlash(context.apiBase || apiServiceState.apiBase);
    const requestUrl = getRequestUrl(context);
    if (!isPlatformRequest(requestUrl, apiBase)) return;
    resetOutageEvidence();
}

export async function checkApiServiceNow() {
    if (typeof window === "undefined") return false;
    apiServiceState.checking = true;
    const probeResult = await probeApiService(apiServiceState.apiBase);
    if (probeResult.securityInfo) {
        activateSecurityBlock(probeResult.securityInfo, {
            apiBase: apiServiceState.apiBase,
            osClient: apiServiceState.osClient,
            url: HEALTH_CHECK_PATH
        });
        return false;
    }
    if (probeResult.reachable) {
        resetOutageEvidence();
        return true;
    }
    apiServiceState.checking = false;
    return false;
}

export function getApiServiceDiagnostic() {
    return [
        apiServiceState.mode === "security" ? "Microi 安全防护拦截诊断" : "Microi 后端 API 服务诊断",
        `ApiBase: ${apiServiceState.apiBase || "-"}`,
        `OsClient: ${apiServiceState.osClient || "-"}`,
        `请求地址: ${apiServiceState.requestPath || "-"}`,
        `故障原因: ${apiServiceState.reason || "-"}`,
        `拦截IP: ${apiServiceState.ip || "-"}`,
        `安全状态源: ${apiServiceState.stateBackend || "-"}`,
        `自动解除时间(UTC): ${apiServiceState.expiresAtUtc || "-"}`,
        `解除说明: ${apiServiceState.unblockAdvice || "-"}`,
        `HTTP 状态: ${apiServiceState.statusCode || "-"}`,
        `错误代码: ${apiServiceState.errorCode || "-"}`,
        `发生时间: ${apiServiceState.occurredAt || "-"}`
    ].join("\n");
}
