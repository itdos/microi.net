/*
 * V8 ApiEngine
 * ApiEngineKey: official_nuget_stats
 * Version: v1.0.5
 * Function:
 * - 官网只读 NuGet 最近成功数据库快照；每三小时由可信定时任务刷新，成功写入后更新兼容缓存，失败保留原快照并明确记为失败。
 */

var OWNER = "ITdos";
var PROFILE_URL = "https://www.nuget.org/profiles/ITdos";
var CACHE_KEY = "PublicStats:NuGetITdos";
var SNAPSHOT_TABLE = "mci_nuget_stats_daily";
var FRESH_SECONDS = 300;
var REFRESH_INTERVAL_SECONDS = 10800;
var REFRESH_JOB_NAME = "officialNugetStatsRefresh";
var REFRESH_LOCK_SCOPE = "NuGetOfficialRefresh";
var SEARCH_ENDPOINTS = [
  "https://azuresearch-usnc.nuget.org/query",
  "https://azuresearch-ussc.nuget.org/query"
];

// 将外部、缓存和数据库数值统一转换为安全整数。
function asNumber(value) {
  var number = Number(value);
  return isFinite(number) ? number : 0;
}

// 返回当前 UTC ISO 时间，作为各层快照的统一时间口径。
function nowIso() {
  return new Date().toISOString();
}

// 兼容接口对象 camelCase 与低代码表 PascalCase 字段。
function readValue(value, camelName, pascalName) {
  if (!value) return undefined;
  if (value[camelName] !== undefined && value[camelName] !== null) return value[camelName];
  return value[pascalName];
}

// 计算成功快照距当前时间的秒数。
function ageSeconds(stats) {
  if (!stats || !stats.queriedAt) return null;
  var queriedAt = new Date(String(stats.queriedAt)).getTime();
  if (!isFinite(queriedAt)) return null;
  return Math.max(0, Math.floor((new Date().getTime() - queriedAt) / 1000));
}

// 从 ISO 时间提取每日快照键，拒绝不可识别的日期。
function statDate(stats) {
  var value = stats && String(stats.queriedAt || "").substring(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

// 规范化来自 NuGet、Redis 或数据库的成功汇总。
function normalizeStats(value) {
  if (!value || typeof value !== "object") return null;
  var packageCount = Math.floor(asNumber(readValue(value, "packageCount", "PackageCount")));
  var totalDownloads = Math.floor(asNumber(readValue(value, "totalDownloads", "TotalDownloads")));
  if (packageCount <= 0 || totalDownloads <= 0) return null;
  var queriedAt = String(readValue(value, "queriedAt", "QueriedAt") || "");
  if (!isFinite(new Date(queriedAt).getTime())) return null;
  return {
    schemaVersion: Math.max(1, Math.floor(asNumber(readValue(value, "schemaVersion", "SchemaVersion"))) || 1),
    owner: OWNER,
    packageCount: packageCount,
    totalDownloads: totalDownloads,
    profileUrl: PROFILE_URL,
    queriedAt: queriedAt,
    cachedAt: String(readValue(value, "cachedAt", "CachedAt") || readValue(value, "queriedAt", "QueriedAt") || ""),
    successfulEndpoints: Math.max(0, Math.floor(asNumber(readValue(value, "successfulEndpoints", "SuccessfulEndpoints")))),
    source: String(readValue(value, "source", "Source") || "nuget-official-api")
  };
}

// 在两个有效快照中选择下载量更高、同值时更新时间更新的一份。
function higherStats(first, second) {
  if (!first) return second || null;
  if (!second) return first;
  if (second.totalDownloads !== first.totalDownloads) {
    return second.totalDownloads > first.totalDownloads ? second : first;
  }
  var firstTime = new Date(String(first.queriedAt || "")).getTime();
  var secondTime = new Date(String(second.queriedAt || "")).getTime();
  return isFinite(secondTime) && (!isFinite(firstTime) || secondTime > firstTime) ? second : first;
}

// 读取 Redis 最近一次成功汇总；损坏值只记录诊断，不覆盖数据库快照。
function readCachedStats() {
  try {
    var raw = V8.Cache.Get(CACHE_KEY);
    if (raw === null || raw === undefined || String(raw) === "") return null;
    return normalizeStats(JSON.parse(String(raw)));
  } catch (error) {
    console.log("NuGet stats cache read failed");
    return null;
  }
}

// 写入共享 Redis 快照；返回布尔值供数据库持久化降级判断。
function writeCachedStats(stats) {
  try {
    return V8.Cache.Set(CACHE_KEY, JSON.stringify(stats)) === true;
  } catch (error) {
    console.log("NuGet stats cache write failed: " + error.message);
    return false;
  }
}

// 数据库是官网快照的唯一事实源，按实际查询时间取最新成功结果。
function readDatabaseStats() {
  var result = V8.FormEngine.GetTableData(SNAPSHOT_TABLE, {
    _Where: [["Owner", "=", OWNER]],
    _SelectFields: [
      "Owner", "PackageCount", "TotalDownloads", "ProfileUrl", "QueriedAt",
      "CachedAt", "SuccessfulEndpoints", "Source", "SchemaVersion", "StatDate"
    ],
    _OrderBy: "QueriedAt",
    _OrderByType: "DESC",
    _PageIndex: 1,
    _PageSize: 1
  });
  if (!result || result.Code !== 1) {
    throw new Error("NuGet snapshot database read failed");
  }
  return result.Data && result.Data.length ? normalizeStats(result.Data[0]) : null;
}

// 将成功汇总更新到当天唯一快照；只允许同一天数值保持或增长。
function persistDatabaseStats(stats) {
  var snapshotDate = statDate(stats);
  if (!snapshotDate) throw new Error("NuGet snapshot date is invalid");

  var existing = V8.FormEngine.GetFormData(SNAPSHOT_TABLE, {
    _Where: [
      ["Owner", "=", OWNER],
      ["AND", "StatDate", "=", snapshotDate]
    ],
    _SelectFields: ["Id", "TotalDownloads", "QueriedAt"]
  });

  var form = {
    Owner: OWNER,
    StatDate: snapshotDate,
    PackageCount: stats.packageCount,
    TotalDownloads: stats.totalDownloads,
    ProfileUrl: PROFILE_URL,
    QueriedAt: stats.queriedAt,
    CachedAt: stats.cachedAt,
    SuccessfulEndpoints: stats.successfulEndpoints,
    Source: stats.source,
    SchemaVersion: stats.schemaVersion
  };

  var result;
  if (existing && existing.Code === 1 && existing.Data) {
    form.Id = existing.Data.Id;
    form.TotalDownloads = Math.max(
      stats.totalDownloads,
      Math.floor(asNumber(existing.Data.TotalDownloads))
    );
    result = V8.FormEngine.UptFormData(SNAPSHOT_TABLE, form, V8.DbTrans);
  } else if (existing && existing.Code === 2) {
    result = V8.FormEngine.AddFormData(SNAPSHOT_TABLE, form, V8.DbTrans);
  } else {
    throw new Error("NuGet daily snapshot lookup failed: " + String(existing && existing.Msg || "unknown"));
  }

  if (!result || result.Code !== 1) {
    throw new Error("NuGet daily snapshot write failed: " + String(result && result.Msg || "unknown"));
  }
  return true;
}

// 生成前端可识别的数据来源、缓存状态和故障标记。
function responseData(stats, stage, options) {
  options = options || {};
  return {
    owner: stats.owner,
    packageCount: stats.packageCount,
    totalDownloads: stats.totalDownloads,
    profileUrl: stats.profileUrl,
    queriedAt: stats.queriedAt,
    cachedAt: stats.cachedAt,
    successfulEndpoints: stats.successfulEndpoints,
    source: stats.source,
    stage: stage,
    cacheState: String(options.cacheState || "hit"),
    databaseState: String(options.databaseState || ""),
    ageSeconds: ageSeconds(stats),
    didRefresh: options.didRefresh === true,
    refreshFailed: options.refreshFailed === true,
    refreshIntervalSeconds: REFRESH_INTERVAL_SECONDS,
    observedTotalDownloads: options.observedTotalDownloads === undefined ? null : options.observedTotalDownloads
  };
}

// 判断搜索结果的 owners 字段是否包含固定 owner。
function ownerMatches(value) {
  var expected = OWNER.toLowerCase();
  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i++) {
      if (String(value[i] || "").trim().toLowerCase() === expected) return true;
    }
    return false;
  }
  var owners = String(value || "").split(",");
  for (var j = 0; j < owners.length; j++) {
    if (owners[j].trim().toLowerCase() === expected) return true;
  }
  return false;
}

// 从单个 NuGet 官方搜索节点汇总 owner 名下去重包下载量。
function fetchEndpointStats(endpoint) {
  var response = V8.Http.GetResponse({
    Url: endpoint,
    GetParam: {
      q: "owner:" + OWNER,
      skip: 0,
      take: 1000,
      prerelease: true,
      semVerLevel: "2.0.0"
    },
    Timeout: 8,
    Headers: { Accept: "application/json" }
  });
  var statusCode = asNumber(response && response.StatusCode);
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("NuGet endpoint returned HTTP " + statusCode);
  }

  var payload = JSON.parse(String(response.Content || "{}"));
  var packages = {};
  var rows = Array.isArray(payload.data) ? payload.data : [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    if (!ownerMatches(row.owners)) continue;
    var id = String(row.id || "").trim();
    var totalDownloads = Math.floor(asNumber(row.totalDownloads));
    if (!id || totalDownloads < 0) continue;
    packages[id.toLowerCase()] = totalDownloads;
  }

  var packageCount = 0;
  var total = 0;
  for (var key in packages) {
    if (!Object.prototype.hasOwnProperty.call(packages, key)) continue;
    packageCount++;
    total += packages[key];
  }
  if (packageCount <= 0 || total <= 0) {
    throw new Error("NuGet endpoint returned no ITdos packages");
  }
  return { packageCount: packageCount, totalDownloads: total };
}

// 从多个官方节点选取下载量更高的一份，容忍索引区域间短时延迟。
function fetchOfficialStats() {
  var successful = [];
  for (var i = 0; i < SEARCH_ENDPOINTS.length; i++) {
    try {
      successful.push(fetchEndpointStats(SEARCH_ENDPOINTS[i]));
    } catch (error) {
      console.log("NuGet endpoint refresh failed: " + error.message);
    }
  }
  if (!successful.length) throw new Error("NuGet official search endpoints are unavailable");

  var freshest = successful[0];
  for (var j = 1; j < successful.length; j++) {
    if (successful[j].totalDownloads > freshest.totalDownloads) freshest = successful[j];
  }
  var timestamp = nowIso();
  return normalizeStats({
    packageCount: freshest.packageCount,
    totalDownloads: freshest.totalDownloads,
    queriedAt: timestamp,
    cachedAt: timestamp,
    successfulEndpoints: successful.length
  });
}

// HttpContext 由宿主设置，HTTP 参数不能伪造后台任务身份。
// 旧匿名 Refresh 请求兼容为快照读取，防止旧官网持续触发 NuGet 外部查询。
var param = V8.Param || {};
var isScheduled = !V8.HttpContext
  && String(param._InvokeType || "") === "Server"
  && String(param.JobName || "") === REFRESH_JOB_NAME
  && String(param.JobId || "") === REFRESH_JOB_NAME
  && String(param.JobRunId || "").trim() !== "";
var request = param;
if (isScheduled) {
  try {
    request = typeof param.JobParam === "string" ? JSON.parse(param.JobParam || "{}") : param.JobParam;
    if (!request || typeof request !== "object") throw new Error("Invalid JobParam");
  } catch (error) {
    return { Code: 0, Data: null, Msg: "NuGet 定时任务参数不是有效 JSON" };
  }
}
var action = String((request && (request.Action || request.action)) || "Snapshot").trim().toLowerCase();
var isAdmin = V8.CurrentUser && asNumber(V8.CurrentUser.Level) >= 9999;
var mayRefresh = isScheduled || isAdmin;
var wantsRefresh = action === "refresh" && mayRefresh;
if (action !== "snapshot" && action !== "cache" && action !== "get" && action !== "refresh") {
  return { Code: 0, Data: null, Msg: "Action 仅支持 Snapshot、Cache、Get 或 Refresh" };
}
if (wantsRefresh && String(request.LockScope || "") !== REFRESH_LOCK_SCOPE) {
  return { Code: 0, Data: null, Msg: "请求缺少有效的刷新范围" };
}

var database;
try {
  database = readDatabaseStats();
} catch (error) {
  console.log("NuGet snapshot database read failed");
  return { Code: 0, Data: null, Msg: "NuGet 快照数据库暂时不可用" };
}

// 官网读取不访问 NuGet，也不读写 Redis；无快照时返回明确状态，禁止现场刷新。
if (!wantsRefresh) {
  if (!database) return { Code: 2, Data: null, Msg: "暂无 NuGet 成功汇总快照，等待定时任务更新" };
  return {
    Code: 1,
    Data: responseData(database, "snapshot", { cacheState: "snapshot", databaseState: "persisted" }),
    Msg: "已返回 NuGet 最近成功快照，每三小时由定时任务更新"
  };
}

// 短窗口仅用于重复执行保护；实际周期由 Quartz 每三小时的任务配置决定。
var storedAge = ageSeconds(database);
if (database && storedAge !== null && storedAge < FRESH_SECONDS) {
  return {
    Code: 1,
    Data: responseData(database, "snapshot", { cacheState: "fresh", databaseState: "persisted" }),
    Msg: "最近成功快照仍在五分钟去重窗口内，本次无需重复查询"
  };
}

try {
  var refreshed = fetchOfficialStats();
  var observedTotalDownloads = refreshed.totalDownloads;
  var cached = readCachedStats();
  var highWater = higherStats(database, cached);
  if (highWater && highWater.totalDownloads > refreshed.totalDownloads) {
    // 官方区域索引回退时保留累计最高值，但查询时间、包数和成功节点仍记录本次真实查询。
    refreshed.totalDownloads = highWater.totalDownloads;
    refreshed.source = "nuget-official-api-high-water";
  }

  // 先检查事务内写入结果，再更新兼容缓存；最终提交由宿主在 Code=1 后完成。
  // 官网始终读主库，不发布尚未提交的 Redis 候选值；缓存仅用于保留历史累计高水位。
  persistDatabaseStats(refreshed);
  var redisWritten = writeCachedStats(refreshed);
  return {
    Code: 1,
    Data: responseData(refreshed, "snapshot", {
      cacheState: redisWritten ? "updated" : "database-only",
      databaseState: "persisted",
      didRefresh: true,
      observedTotalDownloads: observedTotalDownloads
    }),
    Msg: "NuGet 官方汇总已持久化为最新快照"
  };
} catch (error) {
  console.log("NuGet official stats refresh failed: " + error.message);
  // 返回上次成功快照供诊断，但 Code=0 保证 Quartz 记录失败，不能用缓存冒充实时成功。
  return {
    Code: 0,
    Data: database ? responseData(database, "snapshot", {
      cacheState: "stale", databaseState: "persisted", refreshFailed: true
    }) : null,
    Msg: "NuGet 官方刷新失败，最近成功快照保持不变"
  };
}

