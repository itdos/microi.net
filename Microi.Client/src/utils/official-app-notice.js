export const OFFICIAL_STORE_API_BASE = "https://api.itdos.com";
export const OFFICIAL_STORE_OSCLIENT = "iTdos";
export const OFFICIAL_STORE_SOURCE_ID = "official";
export const OFFICIAL_STORE_LIST_PATH = "/apiengine/get-microi-store-list";
export const OFFICIAL_STORE_LEGACY_LIST_PATH = "/apiengine/get-microi-store";
export const OFFICIAL_STORE_REQUEST_TIMEOUT_MS = 25000;

export const OFFICIAL_APP_INSTALLED_FIELDS = [
    "Id",
    "StoreId",
    "AppId",
    "AppName",
    "AppVersion",
    "AppVersionInstall",
    "PackageVersion",
    "InstallStatus",
    "IsDeleted",
    "InstallTime",
    "UpdateTime",
    "LastCheckTime",
    "CreateTime"
];

function normalizedInstalledRecordTime(row) {
    for (const field of ["UpdateTime", "InstallTime", "LastCheckTime", "CreateTime"]) {
        const value = String(row?.[field] || "").trim();
        if (!value) continue;
        const parsed = Date.parse(value.replace(" ", "T"));
        if (Number.isFinite(parsed)) return parsed;
        const numeric = Number(value.replace(/[^0-9]/g, "").slice(0, 17));
        if (Number.isFinite(numeric)) return numeric;
    }
    return 0;
}

function installedRecordAliases(row) {
    return [
        ["store", row?.StoreId],
        ["app", row?.AppId],
        ["name", row?.AppName],
        ["id", row?.Id]
    ]
        .map(([prefix, value]) => [prefix, String(value || "").trim().toLowerCase()])
        .filter(([, value]) => value)
        .map(([prefix, value]) => `${prefix}:${value}`);
}

// The notification check needs only a small install-state projection. Collapse
// duplicate history before crossing the public-store boundary, but retain the
// newest tombstone because it authoritatively means "uninstalled".
export function normalizeInstalledVersionsForOfficialCheck(rows, maxRows = 5000) {
    const projected = (Array.isArray(rows) ? rows : [])
        .map((row, index) => ({
            row: Object.fromEntries(OFFICIAL_APP_INSTALLED_FIELDS
                .filter((field) => Object.prototype.hasOwnProperty.call(row || {}, field))
                .map((field) => [field, row[field]])),
            index,
            time: normalizedInstalledRecordTime(row)
        }))
        .filter((item) => installedRecordAliases(item.row).length > 0)
        .sort((left, right) => right.time - left.time || left.index - right.index);

    const selected = [];
    const aliases = new Set();
    for (const item of projected) {
        const itemAliases = installedRecordAliases(item.row);
        if (itemAliases.some((alias) => aliases.has(alias))) continue;
        selected.push(item.row);
        itemAliases.forEach((alias) => aliases.add(alias));
        if (selected.length >= Math.max(1, Number(maxRows) || 5000)) break;
    }
    return selected;
}

// Single-flight runner with a durable trailing request. Calls made while a run is
// awaiting I/O are coalesced, but at least one further run is guaranteed after
// the active one completes. This keeps task-completion refreshes from being lost
// behind a 25-30 second marketplace request.
export function createCoalescedTrailingRunner(run, mergePending = (_pending, next) => next) {
    if (typeof run !== "function") {
        throw new TypeError("run must be a function");
    }

    let activePromise = null;
    let hasPending = false;
    let pendingValue;

    const startDrain = () => {
        const drainPromise = (async () => {
            let result;
            let firstError = null;
            while (hasPending) {
                const currentValue = pendingValue;
                hasPending = false;
                pendingValue = undefined;
                try {
                    result = await run(currentValue);
                } catch (error) {
                    firstError ||= error;
                }
            }
            if (firstError) throw firstError;
            return result;
        })();

        const wrappedPromise = drainPromise.finally(() => {
            // A request may arrive in the microtask window after the drain saw
            // no pending work but before this finalizer runs. Clear and restart
            // synchronously so that request can never be stranded.
            activePromise = null;
            if (hasPending) return startDrain();
        });
        activePromise = wrappedPromise;
        return wrappedPromise;
    };

    return function request(value) {
        pendingValue = hasPending ? mergePending(pendingValue, value) : value;
        hasPending = true;
        if (activePromise) return activePromise;

        return startDrain();
    };
}

function marketplaceMessage(value) {
    return String(
        value?.Msg
        || value?.Message
        || value?.message
        || value?.response?.data?.Msg
        || value?.response?.data?.Message
        || ""
    ).trim();
}

function marketplaceStatus(value) {
    return Number(
        value?.status
        || value?.StatusCode
        || value?.response?.status
        || 0
    );
}

export function isMarketplaceListRouteUnavailable(value) {
    const status = marketplaceStatus(value);
    const message = marketplaceMessage(value);
    return status === 404
        || (/NoExistData\[(?:ApiAddress|ApiEngineKey)\]/i.test(message)
            && /get-microi-store-list/i.test(message));
}

function resultError(result, fallback) {
    const error = new Error(marketplaceMessage(result) || fallback);
    error.result = result;
    return error;
}

function transportError(error, fallback) {
    const normalized = error instanceof Error ? error : new Error(String(error || fallback));
    normalized.marketplaceTransportError = true;
    return normalized;
}

function protocolError(message, response, result) {
    const error = resultError(result, message);
    error.marketplaceProtocolError = true;
    error.status = Number(response?.status || 0);
    error.response = { status: error.status, data: result };
    return error;
}

function withTransportMetadata(result, route, fallback) {
    result.DataAppend = {
        ...(result.DataAppend || {}),
        SourceAuthenticated: false,
        CredentialKey: "",
        SourceId: OFFICIAL_STORE_SOURCE_ID,
        MarketplaceBrowserPublicTransport: true,
        MarketplaceListRoute: route,
        MarketplaceListRouteFallback: fallback === true
    };
    return result;
}

async function postOfficialStore(path, payload, options) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== "function") {
        throw transportError(null, "当前浏览器不支持商城公共请求。");
    }

    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutMs = Math.max(1, Number(options.timeoutMs) || OFFICIAL_STORE_REQUEST_TIMEOUT_MS);
    const timer = controller
        ? globalThis.setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
        const response = await fetchImpl(
            `${OFFICIAL_STORE_API_BASE}${path}?OsClient=${encodeURIComponent(OFFICIAL_STORE_OSCLIENT)}`,
            {
                method: "POST",
                mode: "cors",
                credentials: "omit",
                headers: {
                    "Content-Type": "application/json",
                    apiengine: "1"
                },
                body: JSON.stringify(payload || {}),
                signal: controller?.signal
            }
        );
        const responseText = await response.text();
        let result;
        try {
            result = responseText ? JSON.parse(responseText) : null;
        } catch (_) {
            const error = protocolError("商城公共接口未返回有效 JSON。", response, null);
            // 旧节点可能用 HTML 返回 404；它仍是可精确识别的正式路由缺失。
            if (response.status === 404) error.marketplaceProtocolError = false;
            throw error;
        }
        if (!response.ok) {
            throw protocolError(`商城公共接口 HTTP ${response.status}`, response, result);
        }
        return result;
    } catch (error) {
        if (isMarketplaceListRouteUnavailable(error)) throw error;
        // 已收到 HTTP/业务协议响应时必须失败关闭；只有浏览器网络、CORS 和超时
        // 这类没有可信响应的传输故障，才允许交给当前租户同源代理重试。
        if (error?.marketplaceProtocolError === true) throw error;
        throw transportError(error, "商城公共接口请求失败。");
    } finally {
        if (timer) globalThis.clearTimeout(timer);
    }
}

async function requestProxy(payload, proxyRequest) {
    if (typeof proxyRequest !== "function") {
        throw new Error("商城公共接口请求失败，且当前租户未提供同源商城代理。");
    }
    const result = await proxyRequest({
        Action: "Query",
        SourceId: OFFICIAL_STORE_SOURCE_ID,
        ApiBase: OFFICIAL_STORE_API_BASE,
        OsClient: OFFICIAL_STORE_OSCLIENT,
        Operation: "List",
        Param: payload || {}
    });
    if (!result || Number(result.Code) !== 1) {
        throw resultError(result, "商城同源代理未返回成功结果。");
    }
    result.DataAppend = {
        ...(result.DataAppend || {}),
        SourceId: OFFICIAL_STORE_SOURCE_ID,
        MarketplaceSameOriginProxyFallback: true
    };
    return result;
}

export async function requestOfficialStoreList(payload, options = {}) {
    let formalResult;
    try {
        formalResult = await postOfficialStore(OFFICIAL_STORE_LIST_PATH, payload, options);
        if (formalResult && Number(formalResult.Code) === 1) {
            return withTransportMetadata(formalResult, OFFICIAL_STORE_LIST_PATH, false);
        }
        if (!isMarketplaceListRouteUnavailable(formalResult)) {
            throw resultError(formalResult, "平台官方商城公共接口未返回成功结果。");
        }
    } catch (error) {
        if (!isMarketplaceListRouteUnavailable(error)) {
            if (error?.marketplaceTransportError === true) {
                return requestProxy(payload, options.proxyRequest);
            }
            throw error;
        }
    }

    try {
        const legacyResult = await postOfficialStore(OFFICIAL_STORE_LEGACY_LIST_PATH, payload, options);
        if (!legacyResult || Number(legacyResult.Code) !== 1) {
            throw resultError(legacyResult, "平台官方商城兼容接口未返回成功结果。");
        }
        return withTransportMetadata(legacyResult, OFFICIAL_STORE_LEGACY_LIST_PATH, true);
    } catch (error) {
        if (error?.marketplaceTransportError === true) {
            return requestProxy(payload, options.proxyRequest);
        }
        throw error;
    }
}

export function normalizeOfficialAppNotices(result) {
    let rows;
    if (Array.isArray(result?.Data?.Notices)) {
        rows = result.Data.Notices;
    } else if (Array.isArray(result?.Data)) {
        // 兼容尚未提供 CheckPlatformApps 聚合结果、但已经返回服务端安装状态的商城源。
        rows = result.Data;
    } else {
        throw new Error("商城源未返回可验证的平台应用检查结果。");
    }

    const actionable = rows
        .map((row) => {
            const item = { ...(row || {}) };
            item.Status = item.Status || item.StoreInstallStatus || item.AppInstallStatus || "";
            item.StoreId = item.StoreId || item.Id || "";
            item.AppId = item.AppId || item.AppKey || (item.StoreId ? `store:${item.StoreId}` : "");
            item.AppKey = item.AppKey || (String(item.AppId || "").startsWith("store:") ? "" : item.AppId);
            item.AppVersion = item.AppVersion || item.CurrentVersion || "";
            item.InstalledVersion = item.InstalledVersion || item.AppVersionInstall || "";
            item.AppVersionInstall = item.AppVersionInstall || item.InstalledVersion || "";
            if (!item.AppVersion && (item.Status === "Uninstalled" || item.Status === "Outdated")) {
                item.Status = "Abnormal";
                item.DataIntegrityIssue = item.DataIntegrityIssue || "MissingAppVersion";
            }
            return item;
        })
        .filter((item) => (!item.ApplicationType || item.ApplicationType === "Platform")
            && (item.Status === "Uninstalled" || item.Status === "Outdated" || item.Status === "Abnormal"));

    const invalid = actionable.find((item) => !item.StoreId || !item.AppId);
    if (invalid) {
        throw new Error("商城源返回了缺少 StoreId 或稳定应用标识的平台应用通知。");
    }
    return actionable;
}

export function consumeCompletedPlatformMaintenanceTransitions({
    rows,
    previousRows,
    registeredTaskIds,
    isTerminalTask,
    isMaintenanceTask
}) {
    const registry = registeredTaskIds || {};
    const previous = new Map((previousRows || []).map((item) => [String(item?.Id || ""), item]));
    const completedIds = [];

    for (const item of rows || []) {
        const taskId = String(item?.Id || item?.TaskId || item?.BackgroundTaskId || "");
        if (!taskId || !isTerminalTask(item) || !isMaintenanceTask(item)) continue;
        const old = previous.get(taskId);
        const registered = registry[taskId] === true;
        const transitioned = !!old && !isTerminalTask(old);
        if (!registered && !transitioned) continue;

        delete registry[taskId];
        completedIds.push(taskId);
    }

    return completedIds;
}
