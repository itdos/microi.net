import { reactive } from "vue";

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
    apiBase: "",
    osClient: "",
    requestUrl: "",
    requestPath: "",
    reason: "",
    errorCode: "",
    statusCode: 0,
    occurredAt: ""
});

let healthCheckTimer = 0;
let healthCheckPromise = null;
let evidenceVersion = 0;
let evidenceApiBase = "";
let firstFailureAt = 0;
let healthFailureCount = 0;
let pendingFailure = null;

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

function resetOutageEvidence(options = {}) {
    evidenceVersion += 1;
    clearHealthCheckTimer();
    healthCheckPromise = null;
    evidenceApiBase = "";
    firstFailureAt = 0;
    healthFailureCount = 0;
    pendingFailure = null;
    apiServiceState.checking = false;
    if (options.hide !== false) {
        apiServiceState.active = false;
    }
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
    if (typeof window.fetch !== "function") return false;

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

        // 404/401/500 等响应仍能证明 API 服务可达；只有网关级不可用才视为整体故障。
        return NETWORK_STATUS_CODES.indexOf(Number(response.status || 0)) === -1;
    } catch (error) {
        return false;
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
    const reachable = await currentProbe;
    if (healthCheckPromise === currentProbe) {
        healthCheckPromise = null;
    }

    if (version !== evidenceVersion) return reachable;

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

export function reportApiServiceRecovered(context = {}) {
    if (!apiServiceState.active && !pendingFailure) return;
    const apiBase = trimSlash(context.apiBase || apiServiceState.apiBase);
    const requestUrl = getRequestUrl(context);
    if (!isPlatformRequest(requestUrl, apiBase)) return;
    resetOutageEvidence();
}

export async function checkApiServiceNow() {
    if (typeof window === "undefined") return false;
    apiServiceState.checking = true;
    const reachable = await probeApiService(apiServiceState.apiBase);
    if (reachable) {
        resetOutageEvidence();
        return true;
    }
    apiServiceState.checking = false;
    return false;
}

export function getApiServiceDiagnostic() {
    return [
        "Microi 后端 API 服务诊断",
        `ApiBase: ${apiServiceState.apiBase || "-"}`,
        `OsClient: ${apiServiceState.osClient || "-"}`,
        `请求地址: ${apiServiceState.requestPath || "-"}`,
        `故障原因: ${apiServiceState.reason || "-"}`,
        `HTTP 状态: ${apiServiceState.statusCode || "-"}`,
        `错误代码: ${apiServiceState.errorCode || "-"}`,
        `发生时间: ${apiServiceState.occurredAt || "-"}`
    ].join("\n");
}
