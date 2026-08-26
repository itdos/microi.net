/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：SaaS引擎
 * ApiEngineKey：mci-system-observability-query
 * 从可信吾码官方应用源安装、更新或重新安装“SaaS引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: mci-system-observability-query
 * Version: v1.0.9
 * Function:
 * - 系统日志/监控统一只读查询：日志统计与详情、实时/历史接口排行、跨月网络流量归因、主机和运行态快照、安全记录及平台统计。
 */

// Version: v1.0.9
// 系统日志/监控统一查询接口（Managed）。
// 普通表统计由接口引擎编排；宿主进程、Mongo 系统日志、安全运行态等缺失能力
// 只通过 V8.Method.GetSystemObservability 的受限原子方法读取。
var p = V8.Param || {};
var action = String(p.Action || "Snapshot");

var customization = V8.ApiEngine.Run("platform-runtime-custom-hook", {
    Stage: "BeforeSystemObservabilityQuery",
    SourceApiEngineKey: "mci-system-observability-query",
    Action: action
});
if (!customization || customization.Code != 1) {
    return customization || { Code: 0, Msg: "系统观测个性化 Hook 未返回结果。" };
}

var legacyMenuContracts = [
    { Id: "fe06ab66-7a10-4f3c-bced-523605f4c65e", Name: "系统日志", Url: "/syslog" },
    { Id: "01KMQNYHKVGTT7TDSQZ8A9HAFF", Name: "系统监控", Url: "/mic-system-monitor" },
    { Id: "01KW6Q2V343B07RWR28NAPJTJW", Name: "安全访问日志", Url: "/mci-security-access-log" },
    { Id: "01KW6Q2TF6Q8T8X4DEH87HQT5N", Name: "恶意攻击事件", Url: "/mci-security-attack-event" },
    { Id: "01KW6Q2TT4W3YPDQ06T8X1PXPC", Name: "IP封锁记录", Url: "/mci-security-ip-block" }
];

function getObservability(args) {
    try {
        return V8.Method.GetSystemObservability(args);
    } catch (e) {
        var message = String(e && e.message ? e.message : e || "");
        if (message.indexOf("GetSystemObservability") >= 0) {
            return { Code: 0, Msg: "当前后端版本缺少系统观测原子能力，请先升级到 v7.5.8 或更高版本。" };
        }
        return { Code: 0, Msg: "读取系统观测数据失败，请查看服务端系统日志。" };
    }
}

function getLegacyMenus() {
    var authority = getObservability({
        Action: "Snapshot",
        IncludeHost: false,
        WindowMinutes: 1,
        Top: 1
    });
    if (!authority || authority.Code != 1) return authority || { Code: 0, Msg: "平台管理员权限校验失败。" };

    var ids = [];
    for (var i = 0; i < legacyMenuContracts.length; i++) ids.push(legacyMenuContracts[i].Id);
    var result = V8.FormEngine.GetTableData("sys_menu", {
        Ids: ids,
        _SelectFields: ["Id", "Name", "Url", "ParentId", "Display", "AppDisplay"],
        _PageIndex: 1,
        _PageSize: legacyMenuContracts.length
    });
    if (!result || result.Code != 1) return result || { Code: 0, Msg: "读取旧菜单失败。" };

    var rows = result.Data || [];
    var matched = [];
    for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        var row = rows[rowIndex];
        var contract = null;
        for (var contractIndex = 0; contractIndex < legacyMenuContracts.length; contractIndex++) {
            if (String(legacyMenuContracts[contractIndex].Id) == String(row.Id)) {
                contract = legacyMenuContracts[contractIndex];
                break;
            }
        }
        if (!contract || String(row.Name || "") != contract.Name || String(row.Url || "") != contract.Url) {
            return { Code: 0, Msg: "检测到旧菜单标识已被租户改作其它用途，已停止迁移，请人工核对。" };
        }
        matched.push(row);
    }
    return { Code: 1, Data: matched, DataCount: matched.length };
}

function count(tableName, where) {
    try {
        var result = V8.FormEngine.GetTableDataCount(tableName, { _Where: where || [] });
        return result && result.Code == 1 ? Number(result.Data || result.DataCount || 0) : 0;
    } catch (e) {
        return 0;
    }
}

function firstData(result, fallback) {
    return result && result.Code == 1 && result.Data != null ? result.Data : fallback;
}

function padUtcPart(value) {
    var part = String(value);
    return part.length < 2 ? "0" + part : part;
}

function formatUtcMillis(value) {
    var date = new Date(value);
    return date.getUTCFullYear() + "-" + padUtcPart(date.getUTCMonth() + 1) + "-" + padUtcPart(date.getUTCDate())
        + " " + padUtcPart(date.getUTCHours()) + ":" + padUtcPart(date.getUTCMinutes()) + ":" + padUtcPart(date.getUTCSeconds());
}

function resolveHistoricalRange(input) {
    var key = String(input.RangeKey || input.Range || "today").toLowerCase();
    var nowLocal = new Date();
    var endUtcMillis = nowLocal.getTime();
    var startUtcMillis = endUtcMillis - 24 * 60 * 60 * 1000;
    var bucketMinutes = 5;
    var label = "当天";
    if (key == "live5") {
        startUtcMillis = endUtcMillis - 5 * 60 * 1000; label = "近 5 分钟";
    } else if (key == "today") {
        startUtcMillis = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate()).getTime(); label = "当天";
    } else if (key == "yesterday") {
        endUtcMillis = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate()).getTime();
        startUtcMillis = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate() - 1).getTime();
        label = "昨天";
    } else {
        var days = { "3d": 3, "7d": 7, "15d": 15, "30d": 30, "3m": 90, "6m": 180, "1y": 365 }[key];
        if (!days) {
            key = "today";
            startUtcMillis = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate()).getTime();
            label = "当天";
        }
        else {
            startUtcMillis = endUtcMillis - days * 24 * 60 * 60 * 1000;
            label = days == 3 ? "近 3 天" : days == 7 ? "近 7 天" : days == 15 ? "近 15 天"
                : days == 30 ? "近 30 天" : days == 90 ? "近 3 个月"
                : days == 180 ? "近 6 个月" : "近 1 年";
        }
    }
    var durationSeconds = Math.max(1, (endUtcMillis - startUtcMillis) / 1000);
    var totalDays = durationSeconds / 86400;
    if (totalDays > 15.1) bucketMinutes = 1440;
    else if (totalDays > 1.1) bucketMinutes = 60;
    return {
        Key: key,
        Label: label,
        StartUtc: formatUtcMillis(startUtcMillis),
        EndUtc: formatUtcMillis(endUtcMillis),
        BucketMinutes: bucketMinutes,
        IsLive: key == "live5",
        DurationSeconds: durationSeconds
    };
}

function getTrafficDetails(input) {
    var range = resolveHistoricalRange(input || {});
    var result = getObservability({
        Action: "TrafficDetails",
        WindowStartUtc: String(range.StartUtc).replace(" ", "T") + "Z",
        WindowEndUtc: String(range.EndUtc).replace(" ", "T") + "Z",
        PageIndex: Math.max(1, Number(input.PageIndex || 1)),
        PageSize: Math.max(1, Math.min(100, Number(input.PageSize || 15))),
        Keyword: String(input.Keyword || input._Keyword || "").substring(0, 100),
        Ip: String(input.Ip || input.IP || "").substring(0, 100),
        UserId: String(input.UserId || "").substring(0, 100),
        Endpoint: String(input.Endpoint || input.Api || "").substring(0, 500),
        TransferAction: String(input.TransferAction || input.Direction || "").substring(0, 50)
    });
    if (!result || result.Code != 1) return result || { Code: 0, Msg: "网络流量明细查询失败。" };
    result.DataAppend = range;
    return result;
}

function historyNumber(value) {
    var numberValue = Number(value || 0);
    return isNaN(numberValue) ? 0 : numberValue;
}

function historicalRisk(left, right) {
    var order = { "Normal": 0, "Info": 1, "Warning": 2, "Critical": 3 };
    return (order[String(right || "Normal")] || 0) > (order[String(left || "Normal")] || 0)
        ? String(right || "Normal")
        : String(left || "Normal");
}

function readHistoricalRows(range) {
    var rows = [];
    var pageIndex = 1;
    var pageSize = 5000;
    var maxPages = 100;
    while (pageIndex <= maxPages) {
        var result = V8.FormEngine.GetTableData("mci_network_traffic_rollup", {
            _Where: [
                ["BucketStartUtc", ">=", range.StartUtc],
                ["BucketStartUtc", "<", range.EndUtc],
                ["BucketMinutes", "=", range.BucketMinutes],
                ["DimensionType", "In", ["Total", "Endpoint", "Ip", "User", "Tenant", "ContentType"]]
            ],
            _SelectFields: [
                "Id", "BucketStartUtc", "BucketMinutes", "NodeId", "ObservedOsClient",
                "DimensionType", "DimensionKey", "RequestCount", "ErrorCount", "SlowCount",
                "ReceivedBytes", "SentBytes", "TotalBytes", "DurationMs", "MaxDurationMs",
                "AnonymousCount", "UploadCount", "DownloadCount", "SuspiciousCount", "RiskLevel",
                "LastSeenAtUtc"
            ],
            _OrderBys: { BucketStartUtc: "asc", TotalBytes: "desc" },
            _PageIndex: pageIndex,
            _PageSize: pageSize
        });
        if (!result || result.Code != 1) return result || { Code: 0, Msg: "历史汇总读取失败。" };
        var pageRows = result.Data || [];
        for (var rowIndex = 0; rowIndex < pageRows.length; rowIndex++) rows.push(pageRows[rowIndex]);
        if (pageRows.length < pageSize || rows.length >= Number(result.DataCount || rows.length)) break;
        pageIndex++;
    }
    if (pageIndex > maxPages) return { Code: 0, Msg: "历史汇总超过安全分页上限，请缩小时间范围。" };
    return { Code: 1, Data: rows, DataCount: rows.length };
}

function aggregateHistoricalDimension(rows, dimensionType, top, durationSeconds, totalDurationMs) {
    var map = {};
    for (var index = 0; index < rows.length; index++) {
        var row = rows[index] || {};
        if (String(row.DimensionType) != dimensionType) continue;
        var key = String(row.DimensionKey || "unknown");
        var item = map[key] || {
            Key: key, DimensionType: dimensionType, RequestCount: 0, ErrorCount: 0, SlowCount: 0,
            ReceivedBytes: 0, SentBytes: 0, TotalBytes: 0, DurationMs: 0, MaxDurationMs: 0,
            AnonymousCount: 0, UploadCount: 0, DownloadCount: 0, SuspiciousCount: 0,
            RiskLevel: "Normal"
        };
        item.RequestCount += historyNumber(row.RequestCount);
        item.ErrorCount += historyNumber(row.ErrorCount);
        item.SlowCount += historyNumber(row.SlowCount);
        item.ReceivedBytes += historyNumber(row.ReceivedBytes);
        item.SentBytes += historyNumber(row.SentBytes);
        item.TotalBytes += historyNumber(row.TotalBytes);
        item.DurationMs += historyNumber(row.DurationMs);
        item.MaxDurationMs = Math.max(item.MaxDurationMs, historyNumber(row.MaxDurationMs));
        item.AnonymousCount += historyNumber(row.AnonymousCount);
        item.UploadCount += historyNumber(row.UploadCount);
        item.DownloadCount += historyNumber(row.DownloadCount);
        item.SuspiciousCount += historyNumber(row.SuspiciousCount);
        item.RiskLevel = historicalRisk(item.RiskLevel, row.RiskLevel);
        map[key] = item;
    }
    var list = [];
    for (var keyName in map) if (Object.prototype.hasOwnProperty.call(map, keyName)) list.push(map[keyName]);
    var dimensionBytes = 0;
    for (var byteIndex = 0; byteIndex < list.length; byteIndex++) dimensionBytes += list[byteIndex].TotalBytes;
    for (var itemIndex = 0; itemIndex < list.length; itemIndex++) {
        var value = list[itemIndex];
        value.AverageDurationMs = value.RequestCount ? Math.round(value.DurationMs * 100 / value.RequestCount) / 100 : 0;
        value.ErrorRate = value.RequestCount ? Math.round(value.ErrorCount * 10000 / value.RequestCount) / 100 : 0;
        value.RequestsPerSecond = Math.round(value.RequestCount * 1000 / durationSeconds) / 1000;
        value.TrafficSharePercent = dimensionBytes ? Math.round(value.TotalBytes * 10000 / dimensionBytes) / 100 : 0;
        value.CostSharePercent = totalDurationMs ? Math.round(value.DurationMs * 10000 / totalDurationMs) / 100 : 0;
        value.TotalElapsedMs = value.DurationMs;
        value.SlowRequestCount = value.SlowCount;
        value.P95DurationMs = null;
        value.ActiveCount = 0;
        if (dimensionType == "Endpoint") {
            value.Route = value.Key;
            value.ApiEngineKey = value.Key.indexOf("/apiengine/") === 0 ? value.Key.substring(11).split("/")[0] : "";
            value.EndpointKind = value.Key.indexOf("/apiengine/") === 0 ? "ApiEngine"
                : value.Key.indexOf("/api/FormEngine/") === 0 ? "FormEngine" : "Controller";
        }
        if (dimensionType == "Ip") value.Ip = value.Key;
    }
    list.sort(function (left, right) {
        return dimensionType == "Endpoint"
            ? right.DurationMs - left.DurationMs || right.RequestCount - left.RequestCount
            : right.TotalBytes - left.TotalBytes || right.RequestCount - left.RequestCount;
    });
    return list.slice(0, top);
}

function aggregateHistoricalTrend(rows) {
    var map = {};
    for (var index = 0; index < rows.length; index++) {
        var row = rows[index] || {};
        if (String(row.DimensionType) != "Total") continue;
        var bucketStartUtc = String(row.BucketStartUtc || "");
        if (!bucketStartUtc) continue;
        var item = map[bucketStartUtc] || {
            BucketStartUtc: bucketStartUtc,
            BucketMinutes: historyNumber(row.BucketMinutes),
            DimensionType: "Total",
            DimensionKey: "all-nodes",
            RequestCount: 0,
            ErrorCount: 0,
            SlowCount: 0,
            ReceivedBytes: 0,
            SentBytes: 0,
            TotalBytes: 0,
            DurationMs: 0,
            MaxDurationMs: 0,
            AnonymousCount: 0,
            UploadCount: 0,
            DownloadCount: 0,
            SuspiciousCount: 0,
            RiskLevel: "Normal"
        };
        item.RequestCount += historyNumber(row.RequestCount);
        item.ErrorCount += historyNumber(row.ErrorCount);
        item.SlowCount += historyNumber(row.SlowCount);
        item.ReceivedBytes += historyNumber(row.ReceivedBytes);
        item.SentBytes += historyNumber(row.SentBytes);
        item.TotalBytes += historyNumber(row.TotalBytes);
        item.DurationMs += historyNumber(row.DurationMs);
        item.MaxDurationMs = Math.max(item.MaxDurationMs, historyNumber(row.MaxDurationMs));
        item.AnonymousCount += historyNumber(row.AnonymousCount);
        item.UploadCount += historyNumber(row.UploadCount);
        item.DownloadCount += historyNumber(row.DownloadCount);
        item.SuspiciousCount += historyNumber(row.SuspiciousCount);
        item.RiskLevel = historicalRisk(item.RiskLevel, row.RiskLevel);
        map[bucketStartUtc] = item;
    }
    var list = [];
    for (var key in map) if (Object.prototype.hasOwnProperty.call(map, key)) list.push(map[key]);
    list.sort(function (left, right) { return String(left.BucketStartUtc).localeCompare(String(right.BucketStartUtc)); });
    return list;
}

function getHistoricalDashboard(input) {
    var authority = getObservability({ Action: "Snapshot", IncludeHost: false, WindowMinutes: 1, Top: 1 });
    if (!authority || authority.Code != 1) return authority || { Code: 0, Msg: "平台管理员权限校验失败。" };
    var range = resolveHistoricalRange(input || {});
    var top = Math.max(5, Math.min(100, Number(input.Top || 20)));
    var forceRefresh = input.ForceRefresh === true || Number(input.ForceRefresh || 0) === 1;
    var cacheKey = "Microi:" + V8.OsClient + ":ObservabilityHistory:" + range.Key + ":top" + top + ":" + range.EndUtc.substring(0, 16);
    if (!forceRefresh) {
        var cached = V8.Cache.Get(cacheKey);
        if (cached) {
            try { return JSON.parse(String(cached)); } catch (ignoreCache) { }
        }
    }
    var rowsResult = readHistoricalRows(range);
    if (!rowsResult || rowsResult.Code != 1) return rowsResult;
    var rows = rowsResult.Data || [];
    var totalRows = aggregateHistoricalTrend(rows);
    var totals = { RequestCount: 0, ErrorCount: 0, SlowCount: 0, ReceivedBytes: 0, SentBytes: 0, TotalBytes: 0, DurationMs: 0, MaxDurationMs: 0, AnonymousCount: 0, UploadCount: 0, DownloadCount: 0, SuspiciousCount: 0 };
    for (var index = 0; index < rows.length; index++) {
        var row = rows[index] || {};
        if (String(row.DimensionType) != "Total") continue;
        totals.RequestCount += historyNumber(row.RequestCount);
        totals.ErrorCount += historyNumber(row.ErrorCount);
        totals.SlowCount += historyNumber(row.SlowCount);
        totals.ReceivedBytes += historyNumber(row.ReceivedBytes);
        totals.SentBytes += historyNumber(row.SentBytes);
        totals.TotalBytes += historyNumber(row.TotalBytes);
        totals.DurationMs += historyNumber(row.DurationMs);
        totals.MaxDurationMs = Math.max(totals.MaxDurationMs, historyNumber(row.MaxDurationMs));
        totals.AnonymousCount += historyNumber(row.AnonymousCount);
        totals.UploadCount += historyNumber(row.UploadCount);
        totals.DownloadCount += historyNumber(row.DownloadCount);
        totals.SuspiciousCount += historyNumber(row.SuspiciousCount);
    }
    var endpoints = aggregateHistoricalDimension(rows, "Endpoint", top, range.DurationSeconds, totals.DurationMs);
    var ips = aggregateHistoricalDimension(rows, "Ip", top, range.DurationSeconds, totals.DurationMs);
    var users = aggregateHistoricalDimension(rows, "User", top, range.DurationSeconds, totals.DurationMs);
    var tenants = aggregateHistoricalDimension(rows, "Tenant", top, range.DurationSeconds, totals.DurationMs);
    var contentTypes = aggregateHistoricalDimension(rows, "ContentType", top, range.DurationSeconds, totals.DurationMs);
    var response = {
        Code: 1,
        Data: {
            Range: range,
            Requests: {
                WindowMinutes: Math.round(range.DurationSeconds / 60),
                RequestCount: totals.RequestCount,
                BusinessRequestCount: totals.RequestCount,
                ErrorCount: totals.ErrorCount,
                SlowRequestCount: totals.SlowCount,
                ErrorRate: totals.RequestCount ? Math.round(totals.ErrorCount * 10000 / totals.RequestCount) / 100 : 0,
                RequestsPerSecond: Math.round(totals.RequestCount * 1000 / range.DurationSeconds) / 1000,
                AverageDurationMs: totals.RequestCount ? Math.round(totals.DurationMs * 100 / totals.RequestCount) / 100 : 0,
                P95DurationMs: null,
                MaxDurationMs: totals.MaxDurationMs,
                ActiveBusinessRequestCount: 0,
                IsHistorical: true
            },
            TopEndpoints: endpoints,
            TopIps: ips,
            TrafficHistory: totalRows,
            NetworkTraffic: {
                IsHistorical: true,
                AccountedHttpReceivedBytes: totals.ReceivedBytes,
                AccountedHttpSentBytes: totals.SentBytes,
                AnonymousRequestCount: totals.AnonymousCount,
                SuspiciousCount: totals.SuspiciousCount,
                LargeTransferCount: totals.UploadCount + totals.DownloadCount,
                TopEndpoints: aggregateHistoricalDimension(rows, "Endpoint", top, range.DurationSeconds, totals.DurationMs),
                TopIps: ips,
                TopUsers: users,
                TopTenants: tenants,
                TopContentTypes: contentTypes,
                RecentTransfers: [],
                Boundaries: [
                    "历史统计来自 MySQL 固定聚合桶，不扫描 MongoDB 请求明细。",
                    "当天/昨天使用 5 分钟桶、近 3-15 天使用小时桶、近 30 天及以上使用天桶。",
                    "分层保留策略：5 分钟桶 48 小时、小时桶 45 天、天桶 400 天；高价值大流量/可疑明细异步写 MongoDB。",
                    "历史排行保留每个子时间桶的 TOP 接口；P95 无法由聚合值精确还原，因此改为展示平均/最大耗时。"
                ]
            }
        }
    };
    V8.Cache.Set(cacheKey, JSON.stringify(response), range.Key == "yesterday" ? 300 : 30);
    return response;
}

if (action == "Capabilities") {
    return {
        Code: 1,
        Data: {
            Version: "1.0.8",
            Name: "系统日志/监控",
            QueryEngineKey: "mci-system-observability-query",
            ActionEngineKey: "mci-system-observability-action",
            Scope: {
                Permission: "仅平台可观测性管理员（通常 Level >= 9999）可读取敏感运行数据或执行治理动作",
                Runtime: "Snapshot、Signal、接口排名与进程指标为当前 API 节点视角",
                Network: "HTTP 可归因流量可定位接口/IP/帐号/租户；网卡或容器累计流量包含数据库、Redis、MQ、对象存储及其它非 HTTP 通信",
                Privacy: "不采集请求体、QueryString、Authorization、Cookie、Token 或文件内容；日志与标识按服务端规则脱敏"
            },
            QueryActions: [
                { Action: "Capabilities", Purpose: "读取能力目录、数据边界和 AI 调用约束" },
                { Action: "Snapshot", Purpose: "读取请求、CPU/内存、网络、进程、主机、Docker、队列与诊断快照", Bounds: "WindowMinutes 1-15，Top 5-50" },
                { Action: "Logs", Purpose: "分页检索系统日志、错误、警告、慢 SQL、慢执行与异常", Bounds: "PageSize 1-200" },
                { Action: "LogTypes", Purpose: "读取日志类型枚举与数量" },
                { Action: "LogStats", Purpose: "读取日志总数及错误、警告、慢 SQL、慢执行、异常统计" },
                { Action: "Signal", Purpose: "按时间窗、关键字、类型、来源和级别读取实时诊断信号" },
                { Action: "Trace", Purpose: "按 32 位 TraceId 读取完整调用时间线" },
                { Action: "ApiRank", Purpose: "读取热点接口、耗时占比、平均/P95 与异常率", Bounds: "Top 1-100" },
                { Action: "AppLogs", Purpose: "读取当前节点应用日志尾部", Bounds: "Lines 1-500" },
                { Action: "PlatformStats", Purpose: "读取表、菜单、接口引擎、租户、用户及平台排行" },
                { Action: "SecurityData", Purpose: "分页读取安全访问、攻击事件或 IP 封锁记录", Bounds: "Kind=Access|Attack|Block，PageSize 1-200" },
                { Action: "TrafficHistory", Purpose: "按当天、昨天、3/7/15/30 天、3/6 个月或 1 年读取网络流量固定聚合桶", Bounds: "RangeKey=live5|today|yesterday|3d|7d|15d|30d|3m|6m|1y" },
                { Action: "TrafficDetails", Purpose: "跨月分页读取高价值上传、下载、大流量与可疑传输样本，定位接口、帐号、IP、文件名/类型与收发字节", Bounds: "同 RangeKey；PageSize 1-100；不返回正文、文件内容、QueryString、Cookie、Token 或凭据" },
                { Action: "HistoricalDashboard", Purpose: "按统一时间范围读取热点接口、来源 IP、帐号、租户、内容类型与流量趋势", Bounds: "Top 5-100；长时间范围使用小时/天聚合" }
            ],
            ManageActions: [
                { Action: "BlockIp", Purpose: "封禁指定 IP", Confirmation: "BlockIp:<ip>" },
                { Action: "UnblockIp", Purpose: "解除指定 IP 封禁", Confirmation: "UnblockIp:<ip>" }
            ],
            Mcp: {
                QueryTool: "microi_query_system_observability",
                ManageTool: "microi_manage_system_observability",
                Discovery: "先调用查询工具 Action=Capabilities；治理工具不带 confirmExecution 时只返回 dry-run 预览"
            }
        }
    };
}

if (action == "PlatformStats") {
    var authority = getObservability({
        Action: "Snapshot",
        IncludeHost: false,
        WindowMinutes: 1,
        Top: 5
    });
    if (!authority || authority.Code != 1) return authority || { Code: 0, Msg: "平台管理员权限校验失败。" };

    var apiRankResult = getObservability({ Action: "ApiRank", Top: 10 });
    var tableRankResult = V8.FormEngine.GetTableData("diy_table", {
        _Where: [["IsDeleted", "<>", 1], ["DataCount", ">", 0]],
        _SelectFields: ["Name", "Description", "DataCount"],
        _OrderBy: "DataCount",
        _OrderByType: "DESC",
        _PageIndex: 1,
        _PageSize: 10
    });
    var recentLoginResult = V8.FormEngine.GetTableData("Sys_User", {
        _Where: [["LastLoginTime", "<>", null], ["IsDeleted", "<>", 1]],
        _SelectFields: ["Id", "Name", "Account", "LastLoginIP", "LastLoginTime"],
        _OrderBy: "LastLoginTime",
        _OrderByType: "DESC",
        _PageIndex: 1,
        _PageSize: 5
    });
    return {
        Code: 1,
        Data: {
            DiyTableCount: count("diy_table", [["IsDeleted", "<>", 1]]),
            SysMenuCount: count("sys_menu", [["IsDeleted", "<>", 1]]),
            ApiEngineCount: count("sys_apiengine", [["IsDeleted", "<>", 1]]),
            OsClientCount: count("sys_osclients", [["IsDeleted", "<>", 1]]),
            UserCount: count("Sys_User", [["IsDeleted", "<>", 1]]),
            ApiEngineRank: firstData(apiRankResult, []),
            TableDataRank: firstData(tableRankResult, []),
            RecentLogins: firstData(recentLoginResult, [])
        }
    };
}

if (action == "LegacyMenus") {
    return getLegacyMenus();
}

if (action == "SecurityData") {
    var kinds = {
        Access: {
            table: "mci_security_access_log",
            fields: ["Id", "RequestTime", "Ip", "Method", "Path", "StatusCode", "ElapsedMs", "OsClientKey", "AccessUserName", "RiskLevel", "RiskReason", "UserAgent", "TraceId", "CreateTime"],
            order: "RequestTime"
        },
        Attack: {
            table: "mci_security_attack_event",
            fields: ["Id", "FirstTime", "LastTime", "Ip", "OsClientKey", "AttackType", "ReasonKey", "ReasonText", "RequestCount", "ErrorCount", "WindowSeconds", "SamplePath", "Status", "CreateTime"],
            order: "LastTime"
        },
        Block: {
            table: "mci_security_ip_block",
            fields: ["Id", "Ip", "OsClientKey", "ReasonText", "ReasonKey", "BlockType", "Status", "BlockStartTime", "BlockEndTime", "UnblockTime", "UnblockUserName", "RequestCount", "ErrorCount", "Remark", "CreateTime"],
            order: "BlockStartTime"
        }
    };
    var model = kinds[String(p.Kind || "Access")];
    if (!model) return { Code: 0, Msg: "不支持的安全数据类型。" };
    var pageIndex = Math.max(1, Math.min(100000, Number(p.PageIndex || 1)));
    var pageSize = Math.max(1, Math.min(200, Number(p.PageSize || 50)));
    var where = [];
    if (p.Keyword) {
        where.push(["Ip", "Like", String(p.Keyword).substring(0, 100)]);
    }
    if (p.Status && p.Kind == "Block") where.push(["Status", "=", String(p.Status).substring(0, 50)]);
    return V8.FormEngine.GetTableData(model.table, {
        _Where: where,
        _SelectFields: model.fields,
        _OrderBy: model.order,
        _OrderByType: "DESC",
        _PageIndex: pageIndex,
        _PageSize: pageSize
    });
}

if (action == "TrafficHistory") {
    var history = getHistoricalDashboard(p);
    if (!history || history.Code != 1) return history;
    return { Code: 1, Data: history.Data.TrafficHistory, DataCount: history.Data.TrafficHistory.length, DataAppend: history.Data.Range };
}

if (action == "TrafficDetails") {
    return getTrafficDetails(p);
}

if (action == "HistoricalDashboard") {
    return getHistoricalDashboard(p);
}

return getObservability(p);
