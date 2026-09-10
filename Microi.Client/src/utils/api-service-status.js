import { reactive } from "vue";
import { readSecurityBlockedResult, SECURITY_GUARD_DOCUMENTATION_URL } from "./security-blocked.js";

const NETWORK_STATUS_CODES = [502, 503, 504];
const HEALTH_CHECK_PATH = "/apiengine/platform-service-health";
const LEGACY_HEALTH_CHECK_PATH = "/api/Diagnostics/health";
const HEALTH_CHECK_DELAY = 800;
const HEALTH_CHECK_RETRY_DELAY = 1200;
const OUTAGE_RECOVERY_CHECK_DELAY = 5000;
const HEALTH_CHECK_TIMEOUT = 5000;
const REQUIRED_HEALTH_FAILURES = 2;
const MIN_OUTAGE_DURATION = 1800;

export const apiServiceState = reactive({
    active: false,
    checking: false,
    mode: "connection",
    frontendVersion: "未知",
    backendVersion: "",
    healthCheckUrl: "",
    healthCheckMode: "fixed",
    healthCheckedAt: "",
    clientOrigin: "",
    apiBase: "",
    osClient: "",
    requestUrl: "",
    requestOrigin: "",
    requestPath: "",
    requestMethod: "",
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

function normalizeVersion(value) {
    const match = String(value || "").trim().match(/v?(\d+\.\d+\.\d+)/i);
    return match ? `v${match[1]}` : "";
}

function buildHealthUrl(apiBase, path, osClient, includeNonce = true) {
    const resolved = new URL(`${trimSlash(apiBase || window.location.origin)}${path}`);
    const tenant = String(osClient || "").trim();
    if (tenant) resolved.searchParams.set("OsClient", tenant);
    if (includeNonce) resolved.searchParams.set("_", String(Date.now()));
    return resolved.toString();
}

function updateHealthMetadata(result) {
    if (!result) return;
    if (result.healthCheckUrl) apiServiceState.healthCheckUrl = result.healthCheckUrl;
    if (result.healthCheckMode) apiServiceState.healthCheckMode = result.healthCheckMode;
    if (result.backendVersion) apiServiceState.backendVersion = normalizeVersion(result.backendVersion);
    if (result.checkedAt) apiServiceState.healthCheckedAt = result.checkedAt;
}

function getRequestUrl(context = {}) {
    return String(context.requestUrl || context.responseUrl || context.url || "").trim();
}

const SENSITIVE_QUERY_KEY = /^(?:authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|token|access[_-]?key|api[_-]?key|secret|client[_-]?secret|password|passwd|pwd|signature|sign|code)$/i;

function sanitizeRequestUrl(requestUrl, apiBase) {
    try {
        const resolved = new URL(requestUrl, apiBase || window.location.origin);
        resolved.username = "";
        resolved.password = "";
        resolved.hash = "";
        for (const key of Array.from(resolved.searchParams.keys())) {
            if (!SENSITIVE_QUERY_KEY.test(key)) continue;
            resolved.searchParams.set(key, "REDACTED");
        }
        return resolved.toString();
    } catch (error) {
        return String(requestUrl || "/").replace(
            /([?&](?:authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|token|access[_-]?key|api[_-]?key|secret|client[_-]?secret|password|passwd|pwd|signature|sign|code)=)[^&#]*/gi,
            "$1REDACTED"
        );
    }
}

function getRequestPath(requestUrl) {
    try {
        const resolved = new URL(requestUrl);
        return `${resolved.pathname}${resolved.search || ""}`;
    } catch (error) {
        return requestUrl || "/";
    }
}

function getRequestOrigin(requestUrl) {
    try {
        return new URL(requestUrl).origin;
    } catch (error) {
        return "";
    }
}

function updateRequestContext(context, apiBase) {
    const requestUrl = sanitizeRequestUrl(getRequestUrl(context), apiBase);
    apiServiceState.clientOrigin = trimSlash(window.location.origin);
    apiServiceState.requestUrl = requestUrl;
    apiServiceState.requestOrigin = getRequestOrigin(requestUrl);
    apiServiceState.requestPath = getRequestPath(requestUrl);
    apiServiceState.requestMethod = String(context.method || "").trim().toUpperCase() || "未识别";
    return requestUrl;
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

function recoverFromOutage() {
    // 冷启动已经失败时仅隐藏诊断层仍会露出失败的启动页，需重载原 URL。
    // 已就绪的页面只撤掉异常层，保留未提交表单；绝不重放触发故障的业务请求。
    const reloadStartup = (apiServiceState.active || pendingFailure)
        && window.__MICROI_APP_READY__ !== true
        && Boolean(window.__MICROI_APP_BOOT_ERROR__);
    resetOutageEvidence();
    if (reloadStartup) window.location.reload();
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
    apiServiceState.active = true;
    apiServiceState.checking = false;
    apiServiceState.mode = "security";
    apiServiceState.apiBase = apiBase;
    apiServiceState.osClient = String(context.osClient || "").trim() || apiServiceState.osClient || "未识别";
    updateRequestContext(context, apiBase);
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
    updateRequestContext(Object.assign({}, context, { requestUrl }), apiServiceState.apiBase);
    apiServiceState.reason = resolveReason(error);
    apiServiceState.errorCode = String(error?.code || "");
    apiServiceState.statusCode = statusCode;
    apiServiceState.occurredAt = new Date().toLocaleString();
}

async function fetchHealthResponse(healthUrl) {
    const controller = typeof AbortController === "undefined" ? null : new AbortController();
    const timeoutId = window.setTimeout(function () {
        controller?.abort();
    }, HEALTH_CHECK_TIMEOUT);

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
        return {
            response,
            responseData,
            securityInfo: readSecurityBlockedResult(responseData)
        };
    } finally {
        window.clearTimeout(timeoutId);
    }
}

async function probeApiService(apiBase, osClient) {
    if (typeof window.fetch !== "function") return { reachable: false, securityInfo: null };

    const fixedHealthUrl = buildHealthUrl(apiBase, HEALTH_CHECK_PATH, osClient);
    const displayHealthUrl = buildHealthUrl(apiBase, HEALTH_CHECK_PATH, osClient, false);
    apiServiceState.healthCheckUrl = displayHealthUrl;

    try {
        const fixed = await fetchHealthResponse(fixedHealthUrl);
        const fixedStatus = Number(fixed.response?.status || 0);
        if (fixed.securityInfo) {
            return {
                reachable: false,
                securityInfo: fixed.securityInfo,
                healthCheckUrl: displayHealthUrl,
                healthCheckMode: "fixed"
            };
        }

        const fixedData = fixed.responseData?.Data;
        if (
            fixedStatus >= 200
            && fixedStatus < 300
            && Number(fixed.responseData?.Code) === 1
            && String(fixedData?.Status || "").toLowerCase() === "healthy"
        ) {
            return {
                reachable: true,
                securityInfo: null,
                backendVersion: fixedData?.BackendVersion,
                checkedAt: fixedData?.CheckedAt || new Date().toISOString(),
                healthCheckUrl: displayHealthUrl,
                healthCheckMode: "fixed"
            };
        }

        // 兼容尚未安装固定接口或应用包先于后端二进制滚动升级的旧节点。
        // 网关级 502/503/504 已足以证明上游不可用，不再用旧接口覆盖该结论。
        if (NETWORK_STATUS_CODES.indexOf(fixedStatus) > -1) {
            return {
                reachable: false,
                securityInfo: null,
                healthCheckUrl: displayHealthUrl,
                healthCheckMode: "fixed"
            };
        }

        const legacyHealthUrl = buildHealthUrl(apiBase, LEGACY_HEALTH_CHECK_PATH, osClient);
        const legacy = await fetchHealthResponse(legacyHealthUrl);
        const legacyStatus = Number(legacy.response?.status || 0);
        return {
            // 自动恢复必须有健康正文，不能把反向代理的 HTML、404 或登录页当成恢复。
            reachable: legacyStatus >= 200 && legacyStatus < 300
                && String(legacy.responseData?.Data?.Status || legacy.responseData?.Status
                    || legacy.responseData?.status || '').toLowerCase() === 'healthy',
            securityInfo: legacy.securityInfo,
            healthCheckUrl: displayHealthUrl,
            healthCheckMode: "legacy",
            checkedAt: new Date().toISOString()
        };
    } catch (error) {
        return {
            reachable: false,
            securityInfo: null,
            healthCheckUrl: displayHealthUrl,
            healthCheckMode: "fixed"
        };
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
    const currentProbe = probeApiService(apiBase, apiServiceState.osClient);
    healthCheckPromise = currentProbe;
    const probeResult = await currentProbe;
    const reachable = probeResult.reachable;
    if (healthCheckPromise === currentProbe) {
        healthCheckPromise = null;
    }

    if (version !== evidenceVersion) return false;
    updateHealthMetadata(probeResult);

    if (probeResult.securityInfo) {
        activateSecurityBlock(probeResult.securityInfo, {
            apiBase,
            osClient: apiServiceState.osClient,
            url: HEALTH_CHECK_PATH
        });
        return false;
    }

    if (reachable) {
        recoverFromOutage();
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
        // 故障确认后继续串行检查，每轮结束五秒后再请求；慢响应不会堆积并发探测。
        scheduleHealthCheck(OUTAGE_RECOVERY_CHECK_DELAY);
        return false;
    }

    scheduleHealthCheck(HEALTH_CHECK_RETRY_DELAY);
    return false;
}

export function reportApiServiceFailure(error, context = {}) {
    if (typeof window === "undefined" || !error || isCanceledRequest(error)) return false;

    const apiBase = trimSlash(context.apiBase);
    const requestUrl = getRequestUrl(context);
    const securityInfo = readSecurityBlockedResult(error?.response?.data);
    // 官网应用商城等绝对外部依赖即使被拦截，也不能升级成当前客户系统的全屏故障。
    if (securityInfo) {
        return isPlatformRequest(requestUrl, apiBase)
            ? activateSecurityBlock(securityInfo, context)
            : false;
    }
    if (apiServiceState.active && apiServiceState.mode === "security") return true;

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
    apiServiceState.healthCheckUrl = buildHealthUrl(resolvedApiBase, HEALTH_CHECK_PATH, apiServiceState.osClient, false);
    scheduleHealthCheck();
    return true;
}

export function setApiServiceFrontendVersion(version) {
    apiServiceState.frontendVersion = normalizeVersion(version) || "未知";
}

export async function primeApiServiceStatus(context = {}) {
    if (typeof window === "undefined") return false;
    const apiBase = trimSlash(context.apiBase) || trimSlash(window.location.origin);
    const osClient = String(context.osClient || "").trim();
    apiServiceState.clientOrigin = trimSlash(window.location.origin);
    apiServiceState.apiBase = apiBase;
    if (osClient) apiServiceState.osClient = osClient;
    const probeResult = await probeApiService(apiBase, osClient);
    updateHealthMetadata(probeResult);
    if (probeResult.securityInfo) {
        activateSecurityBlock(probeResult.securityInfo, {
            apiBase,
            osClient,
            url: apiServiceState.healthCheckUrl,
            method: "GET"
        });
        return false;
    }
    return probeResult.reachable;
}

export function reportApiServiceResponse(responseData, context = {}) {
    if (typeof window === "undefined") return false;
    const securityInfo = readSecurityBlockedResult(responseData);
    if (!securityInfo) return false;
    const apiBase = trimSlash(context.apiBase);
    const requestUrl = getRequestUrl(context);
    return isPlatformRequest(requestUrl, apiBase)
        ? activateSecurityBlock(securityInfo, context)
        : false;
}

export function reportApiServiceRecovered(context = {}) {
    if (reportApiServiceResponse(context.responseData, context)) return;
    // 并发请求中可能仍有其它正常响应，不能让它覆盖当前 IP 的明确拦截事实。
    if (apiServiceState.active && apiServiceState.mode === "security") return;
    if (!apiServiceState.active && !pendingFailure) return;
    const apiBase = trimSlash(context.apiBase || apiServiceState.apiBase);
    const requestUrl = getRequestUrl(context);
    if (!isPlatformRequest(requestUrl, apiBase)) return;

    // 普通业务请求成功只能证明该请求成功，不能替代固定健康契约。全局故障证据
    // 只由 probeApiService/checkApiServiceNow 清除，避免并发业务响应改变健康结论。
    const requestPath = getRequestPath(sanitizeRequestUrl(requestUrl, apiBase));
    const responseData = context.responseData;
    if (
        requestPath.startsWith(HEALTH_CHECK_PATH)
        && Number(responseData?.Code) === 1
        && String(responseData?.Data?.Status || "").toLowerCase() === "healthy"
    ) {
        updateHealthMetadata({
            backendVersion: responseData.Data.BackendVersion,
            checkedAt: responseData.Data.CheckedAt || new Date().toISOString(),
            healthCheckUrl: buildHealthUrl(apiBase, HEALTH_CHECK_PATH, apiServiceState.osClient, false),
            healthCheckMode: "fixed"
        });
        recoverFromOutage();
    }
}

export async function checkApiServiceNow() {
    if (typeof window === "undefined") return false;
    if (apiServiceState.mode === 'connection' && pendingFailure) {
        // 手动“重新连接”与自动检测共用在途请求，防止重复探测及恢复时重复重载。
        clearHealthCheckTimer();
        if (healthCheckPromise) {
            const result = await healthCheckPromise;
            return result.reachable && !apiServiceState.active;
        }
        return runHealthCheck(evidenceVersion);
    }
    apiServiceState.checking = true;
    const probeBase = apiServiceState.mode === "security"
        ? (apiServiceState.requestOrigin || apiServiceState.apiBase)
        : apiServiceState.apiBase;
    const probeResult = await probeApiService(probeBase, apiServiceState.osClient);
    updateHealthMetadata(probeResult);
    if (probeResult.securityInfo) {
        activateSecurityBlock(probeResult.securityInfo, {
            apiBase: apiServiceState.apiBase,
            osClient: apiServiceState.osClient,
            url: `${trimSlash(probeBase)}${HEALTH_CHECK_PATH}`,
            method: "GET"
        });
        return false;
    }
    if (probeResult.reachable) {
        recoverFromOutage();
        return true;
    }
    apiServiceState.checking = false;
    return false;
}

export function getApiServiceDiagnostic() {
    return [
        apiServiceState.mode === "security" ? "Microi 安全防护拦截诊断" : "Microi 后端 API 服务诊断",
        `当前站点: ${apiServiceState.clientOrigin || "-"}`,
        `当前租户 ApiBase: ${apiServiceState.apiBase || "-"}`,
        `OsClient: ${apiServiceState.osClient || "-"}`,
        `前端版本: ${apiServiceState.frontendVersion || "-"}`,
        `后端版本: ${apiServiceState.backendVersion || "未获取"}`,
        `固定健康检查: ${apiServiceState.healthCheckUrl || "-"}`,
        `健康检查模式: ${apiServiceState.healthCheckMode === "fixed" ? "固定接口" : "旧版兼容"}`,
        `请求方法: ${apiServiceState.requestMethod || "-"}`,
        `实际请求目标: ${apiServiceState.requestUrl || "-"}`,
        `故障原因: ${apiServiceState.reason || "-"}`,
        `拦截IP: ${apiServiceState.ip || "-"}`,
        `原因标识: ${apiServiceState.reasonKey || "-"}`,
        `安全范围: ${apiServiceState.securityScope || "-"}`,
        `安全状态源: ${apiServiceState.stateBackend || "-"}`,
        `拦截开始时间(UTC): ${apiServiceState.blockedAtUtc || "-"}`,
        `自动解除时间(UTC): ${apiServiceState.expiresAtUtc || "-"}`,
        `剩余等待秒数: ${apiServiceState.retryAfterSeconds || "-"}`,
        `自动解除: ${apiServiceState.autoUnblock ? "是" : "否"}`,
        `解除说明: ${apiServiceState.unblockAdvice || "-"}`,
        `HTTP 状态: ${apiServiceState.statusCode || "-"}`,
        `错误代码: ${apiServiceState.errorCode || "-"}`,
        `发生时间: ${apiServiceState.occurredAt || "-"}`
    ].join("\n");
}
