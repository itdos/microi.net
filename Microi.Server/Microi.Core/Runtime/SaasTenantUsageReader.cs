using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>有界跨库只读聚合；客户明细、任意查询和连接凭据不离开此边界。</summary>
    internal static class SaasTenantUsageReader
    {
        private static readonly IReadOnlyDictionary<string, string> CountTables = new Dictionary<string, string>
        {
            ["Forms"] = "diy_table", ["Fields"] = "diy_field", ["ApiEngines"] = "sys_apiengine",
            ["Menus"] = "sys_menu", ["Users"] = "sys_user", ["Roles"] = "sys_role", ["Departments"] = "sys_dept",
            ["Workflows"] = "wf_flowdesign", ["Pages"] = "mic_page", ["DataSources"] = "sys_datasource",
            ["Jobs"] = "diy_schedule_job", ["MicroServices"] = "sys_microiservice", ["InstalledApps"] = "sys_microistoreversion"
        };

        public static JObject Read(JObject[] tenants, bool refresh)
        {
            // 最多并行读取4个独立主库，避免按每张表或每行创建并发任务。
            var output = new List<JObject>();
            for (var offset = 0; offset < tenants.Length; offset += 4)
            {
                var batch = tenants.Skip(offset).Take(4).Select(tenant => Task.Run(() => ReadOne(tenant, refresh))).ToArray();
                Task.WaitAll(batch);
                output.AddRange(batch.Select(task => task.Result));
            }
            return new JObject { ["Items"] = JArray.FromObject(output), ["CollectedAt"] = DateTime.UtcNow.ToString("o"),
                ["FreshnessSeconds"] = 60, ["LoginTrendKind"] = "LatestLoginUsers", ["LoginHistoryAvailable"] = false };
        }

        private static JObject ReadOne(JObject tenant, bool refresh)
        {
            var id = tenant["Id"]?.ToString(); var key = tenant["OsClient"]?.ToString();
            var cacheKey = $"Microi:{OsClientDefault.OsClient}:SaasUsage:v1:{OsClientDefault.OsClientType}:{OsClientDefault.OsClientNetwork}:{id}";
            IDatabase redis = null; string lease = null;
            JObject cached = null;
            try
            {
                redis = MicroiEngine.CacheTenant.Cache(OsClientDefault.OsClient).GetIDatabase();
                var value = redis.StringGet(cacheKey);
                if (!value.IsNullOrEmpty) cached = SaasPromotionSecurity.ParseCapabilityPayload(value.ToString());
                if (cached != null && (!refresh || DateTimeOffset.TryParse(cached["CollectedAt"]?.ToString(),
                    CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var time)
                    && DateTimeOffset.UtcNow - time < TimeSpan.FromSeconds(15)))
                    return cached;
                lease = OpaqueTokenSecurity.NewOpaqueValue();
                if (!redis.StringSet(cacheKey + ":lease", lease, TimeSpan.FromSeconds(30), When.NotExists))
                    return cached ?? State(id, key, "Collecting", "其它请求正在采集，请稍后刷新。");
                var client = OsClientExtend.GetClient(key);
                if (client?.Db == null) return State(id, key, "Unavailable", "当前节点未加载此租户，请管理员检查启用状态和运行分区。");
                if (!string.Equals(client.OsClientModel?["DbType"]?.ToString(), "MySql", StringComparison.OrdinalIgnoreCase))
                    return State(id, key, "Unsupported", "当前用量聚合支持 MySQL/MariaDB，未将其它数据库的未知值记为零。");
                var rows = client.Db.FromSql("SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.columns WHERE TABLE_SCHEMA=DATABASE()")
                    .SetCommandTimeout(5).ToList<dynamic>().Select(row => JObject.FromObject((object)row)).ToArray();
                var columns = rows.GroupBy(row => row["TABLE_NAME"]?.ToString() ?? "", StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(group => group.Key, group => group.Select(row => row["COLUMN_NAME"]?.ToString()).ToHashSet(StringComparer.OrdinalIgnoreCase), StringComparer.OrdinalIgnoreCase);
                var expressions = new List<string>
                {
                    "(SELECT COUNT(*) FROM information_schema.tables WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE') AS PhysicalTables"
                }; var missing = new JArray();
                foreach (var metric in CountTables)
                {
                    if (!columns.TryGetValue(metric.Value, out var fields)) { missing.Add(metric.Key); continue; }
                    var where = fields.Contains("IsDeleted") ? " WHERE (IsDeleted IS NULL OR IsDeleted=0)" : "";
                    expressions.Add($"(SELECT COUNT(*) FROM `{metric.Value}`{where}) AS `{metric.Key}`");
                }
                // LastLoginTime 沿用平台本地时间字符串，窗口边界必须与登录写入使用相同时间基准。
                var hasLogin = columns.TryGetValue("sys_user", out var userColumns) && userColumns.Contains("LastLoginTime");
                if (hasLogin)
                {
                    var active = userColumns.Contains("IsDeleted") ? "(IsDeleted IS NULL OR IsDeleted=0)" : "1=1";
                    expressions.Add($"(SELECT MAX(LastLoginTime) FROM sys_user WHERE {active}) AS LastLoginTime");
                    expressions.Add($"(SELECT COUNT(*) FROM sys_user WHERE {active} AND LastLoginTime>=@seven) AS ActiveUsers7Days");
                    expressions.Add($"(SELECT COUNT(*) FROM sys_user WHERE {active} AND LastLoginTime>=@thirty) AS ActiveUsers30Days");
                    expressions.Add($"(SELECT COUNT(*) FROM sys_user WHERE {active} AND (LastLoginTime IS NULL OR LastLoginTime='')) AS NeverLoggedInUsers");
                    if (userColumns.Contains("State")) expressions.Add($"(SELECT COUNT(*) FROM sys_user WHERE {active} AND State=1) AS EnabledUsers");
                }
                if (expressions.Count == 0) return State(id, key, "Unavailable", "目标库缺少可读取的统计结构。");
                var command = client.Db.FromSql("SELECT " + string.Join(",", expressions));
                command.SetCommandTimeout(5);
                command.AddInParameter("seven", DateTime.Now.AddDays(-7).ToString("yyyy-MM-dd HH:mm:ss"));
                command.AddInParameter("thirty", DateTime.Now.AddDays(-30).ToString("yyyy-MM-dd HH:mm:ss"));
                var result = JObject.FromObject(command.First<dynamic>());
                result["Id"] = id; result["OsClient"] = key; result["CollectedAt"] = DateTime.UtcNow.ToString("o");
                result["Status"] = missing.Count == 0 ? "Ready" : "Partial"; result["UnavailableMetrics"] = missing;
                result["LoginHistoryAvailable"] = false;
                result["LatestLoginUserTrend"] = new JArray();
                if (hasLogin)
                {
                    var trend = client.Db.FromSql("SELECT LEFT(LastLoginTime,10) AS Day,COUNT(*) AS Users FROM sys_user WHERE "
                        + (userColumns.Contains("IsDeleted") ? "(IsDeleted IS NULL OR IsDeleted=0) AND " : "")
                        + "LastLoginTime>=@since GROUP BY LEFT(LastLoginTime,10) ORDER BY Day")
                        .AddInParameter("since", DateTime.Now.AddDays(-30).ToString("yyyy-MM-dd HH:mm:ss")).SetCommandTimeout(5).ToList<dynamic>();
                    result["LatestLoginUserTrend"] = JArray.FromObject(trend);
                }
                redis.StringSet(cacheKey, result.ToString(Formatting.None), TimeSpan.FromSeconds(60));
                return result;
            }
            catch
            {
                if (cached != null) { cached["Status"] = "Stale"; cached["Message"] = "刷新暂时失败，保留最近一次真实统计。"; return cached; }
                return State(id, key, "Unavailable", "用量暂不可读；请检查目标库连接、字段和节点健康。");
            }
            finally
            {
                if (redis != null && lease != null)
                    try { redis.ScriptEvaluate("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", new RedisKey[] { cacheKey + ":lease" }, new RedisValue[] { lease }); } catch { }
            }
        }
        private static JObject State(string id, string tenant, string status, string message) => new JObject
        { ["Id"] = id, ["OsClient"] = tenant, ["Status"] = status, ["Message"] = message, ["CollectedAt"] = DateTime.UtcNow.ToString("o") };
    }
}
