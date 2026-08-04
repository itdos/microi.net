using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 将普通运行参数统一迁移到 SaaS 引擎，避免安装者维护大量环境变量。
    /// 平台级字段只读取主租户记录；子租户的压力隔离字段只能降低自身额度。
    /// </summary>
    public sealed class Upgrade23
    {
        public static string Version = "6.8.4.1";

        private const string PlatformTab = "平台运行配置";

        private static readonly IReadOnlyList<RuntimeField> Fields =
            new List<RuntimeField>
            {
                Switch("CorsAllowAnyWhenUnconfigured", "跨域未配置时允许全部", "1", 10010,
                    "仅主租户有效。未填写CorsAllowOrigins时是否兼容允许全部来源。"),
                Switch("SsrfProtectionEnabled", "启用严格SSRF防护", "0", 10020,
                    "仅主租户有效。开启后V8.Http和采集引擎禁止访问回环、私网、链路本地及云元数据地址。"),
                Text("SsrfAllowedHosts", "SSRF允许主机", "", 10030,
                    "仅主租户有效。严格SSRF模式下允许访问的精确主机/IP，多个值用英文逗号或分号分隔。"),
                Number("StartupRouteMaxConcurrency", "启动路由初始化并发", "2", 10040,
                    "仅主租户有效。API启动后并行初始化租户动态路由的最大租户数。",
                    "StartupDynamicRouteMaxConcurrency"),
                Number("ExtensionDatabaseCacheSeconds", "扩展库缓存秒数", "60", 10050,
                    "仅主租户有效。扩展数据库目录的本机缓存秒数；共享Redis版本变化仍会立即失效。"),
                Number("BackgroundTaskMaxParallel", "后台任务并行数", "4", 10060,
                    "仅主租户有效。单个Worker节点并行执行后台任务的数量，代码边界为1到16。"),
                Number("DiyLangRuntimeCachePageSize", "多语言缓存分页数", "500", 10070,
                    "仅主租户有效。重载diy_lang运行缓存时每页读取的行数，代码边界为100到2000。"),
                Number("DiyLangRuntimeCacheMaxRows", "多语言缓存最大行数", "10000", 10080,
                    "仅主租户有效。单个租户多语言运行缓存允许加载的最大原始行数。"),
                Number("DiyLangCacheMaxChars", "多语言缓存最大字符", "5000000", 10090,
                    "仅主租户有效。单个租户多语言运行缓存允许加载的最大字符数。",
                    "DiyLangRuntimeCacheMaxCharacters"),
                Number("DiyLangCacheSqlTimeoutSec", "多语言缓存SQL超时秒", "30", 10099,
                    "仅主租户有效。单次多语言缓存分页SQL允许执行的最长秒数，代码边界为5到120。",
                    "DiyLangRuntimeCacheCommandTimeoutSeconds"),
                Text("OAuthReturnUrlOrigins", "OAuth可信返回域名", "", 10091,
                    "仅主租户有效。允许OAuth回跳的精确HTTPS Origin，多个值用英文逗号或分号分隔。"),
                Text("ChanjetOAuthState", "畅捷通OAuth State", "", 10092,
                    "仅主租户有效。畅捷通OAuth回调使用的高强度随机State。"),
                Text("ChanjetAesKey", "畅捷通AES密钥", "", 10093,
                    "仅主租户有效。畅捷通消息解密密钥，属于敏感配置。"),
                Text("ChanjetAppKey", "畅捷通AppKey", "", 10094,
                    "仅主租户有效。畅捷通消息签名校验AppKey，属于敏感配置。"),
                Text("WeChatTemplateAppId", "微信模板AppId", "", 10095,
                    "仅主租户有效。旧版统一模板消息发送使用的公众号AppId。"),
                Text("WeChatTemplateAppSecret", "微信模板AppSecret", "", 10096,
                    "仅主租户有效。旧版统一模板消息发送使用的公众号AppSecret，属于敏感配置。"),
                Text("WeChatTemplateId", "微信模板Id", "", 10097,
                    "仅主租户有效。旧版统一模板消息发送使用的模板Id。"),
                Text("WeChatMiniProgramAppId", "微信小程序AppId", "", 10098,
                    "仅主租户有效。模板消息跳转小程序使用的AppId。"),

                Switch("SecurityGuardEnabled", "启用恶意访问防护", "1", 10100,
                    "仅主租户有效。启用短时高频请求和高频异常状态码防护。"),
                Number("SecurityWindowSeconds", "安全统计窗口秒", "10", 10110,
                    "仅主租户有效。IP请求与异常次数的统计窗口。"),
                Number("SecurityPerIpMaxRequests", "单IP请求上限", "600", 10120,
                    "仅主租户有效。单IP在统计窗口内允许的最大请求数。"),
                Number("SecurityPerIpMaxErrors", "单IP异常上限", "120", 10130,
                    "仅主租户有效。单IP在统计窗口内允许的最大4xx/5xx响应数。"),
                Number("SecurityBlockMinutes", "自动封禁分钟", "30", 10140,
                    "仅主租户有效。触发恶意访问规则后的自动封禁时长。"),
                Number("SecurityRecentAccessMaxCount", "最近访问内存条数", "5000", 10150,
                    "仅主租户有效。每个API节点保留的最近访问诊断记录数量。"),
                Number("SecurityLogIntervalSeconds", "安全日志间隔秒", "60", 10160,
                    "仅主租户有效。同一IP同类安全事件写系统日志的最小间隔。"),
                Number("SecurityAccessPersistSec", "访问落库间隔秒", "10", 10170,
                    "仅主租户有效。同一IP、状态和路由的访问明细最小落库间隔。",
                    "SecurityAccessPersistIntervalSeconds"),
                Switch("SecurityTrustForwardedHeaders", "信任代理IP请求头", "1", 10180,
                    "仅主租户有效。部署在可信Nginx/网关后开启；公网直连节点应关闭。",
                    "SecurityRespectForwardedHeaders"),
                Switch("SecurityLogBlockedToSysLog", "封禁写入系统日志", "1", 10190,
                    "仅主租户有效。是否把自动封禁事件写入系统日志。"),
                Switch("SecurityPersistTables", "安全事件持久化", "1", 10200,
                    "仅主租户有效。是否持久化安全攻击、封禁和异常访问记录。"),
                Switch("SecurityPersistAllAccess", "持久化全部访问", "0", 10210,
                    "仅主租户有效。开启会显著增加数据量，通常保持关闭。"),
                Number("SecurityPersistQueueMaxCount", "安全落库队列上限", "10000", 10220,
                    "仅主租户有效。单个API节点安全记录待落库队列的最大数量。"),
                Text("SecurityWhitelistIps", "安全白名单IP", "127.0.0.1,::1", 10230,
                    "仅主租户有效。不会触发自动封禁的精确IP，多个值用英文逗号或分号分隔。"),

                Switch("PressureGuardEnabled", "启用请求压力保护", "1", 10300,
                    "仅主租户有效。启用HTTP请求与V8入口并发保护。"),
                Number("PressGlobalMax", "全局请求并发", "2000", 10310,
                    "主租户值为当前API节点全局上限。"),
                Number("PressTenantMax", "租户请求并发", "600", 10320,
                    "主租户值为默认上限；子租户可填写更小值隔离自身，不能放大全局值。"),
                Number("PressRouteMax", "单路由并发", "400", 10330,
                    "主租户值为默认上限；子租户可填写更小值隔离自身。"),
                Number("PressApiMax", "单接口引擎并发", "80", 10340,
                    "主租户值为默认上限；子租户可填写更小值隔离自身。"),
                Number("PressV8GlobalMax", "V8入口全局并发", "128", 10350,
                    "仅主租户有效。当前API节点V8和接口引擎HTTP入口总并发。"),
                Number("PressV8ReqMax", "租户V8入口并发", "32", 10360,
                    "主租户值为默认上限；子租户可填写更小值隔离自身。"),
                Number("PressureWaitMilliseconds", "普通请求排队毫秒", "10000", 10370,
                    "主租户值为默认等待时长；子租户可填写更小值。"),
                Number("PressLongWaitMs", "长任务排队毫秒", "1800000", 10380,
                    "主租户值为默认等待时长；子租户可填写更小值。"),
                Number("PressRetryAfter", "繁忙重试提示秒", "3", 10390,
                    "仅主租户有效。请求压力保护拒绝时返回给客户端的建议重试秒数。"),

                Number("OrmMaxConnectionOpens", "ORM开连接并发", "64", 10400,
                    "仅主租户有效。单个API节点同时打开物理数据库连接的最大数量。",
                    "OrmMaxConcurrentConnectionOpens"),
                Number("OrmConnectionOpenWaitSeconds", "ORM开连接等待秒", "600", 10410,
                    "仅主租户有效。等待物理连接打开名额的最长时间。"),
                Number("OrmConnPressureBackoffSec", "ORM连接退避秒", "120", 10420,
                    "仅主租户有效。数据库连接压力异常后的临时退避时长。",
                    "OrmConnectionPressureBackoffSeconds"),
                Number("OrmCommandTimeoutSec", "ORM命令超时秒", "600", 10430,
                    "仅主租户有效。默认SQL命令超时；单个重任务仍应使用后台任务分片。",
                    "OrmDefaultCommandTimeoutSeconds"),
                Switch("OrmMySqlHostCacheRepairOn", "MySQL主机缓存自动修复", "1", 10440,
                    "仅主租户有效。遇到MySQL Host is blocked时尝试用当前业务连接清理host_cache。",
                    "OrmMySqlHostCacheAutoRepairEnabled"),
                Number("OrmMySqlHostCacheCooldownSec", "MySQL主机修复冷却秒", "300", 10450,
                    "仅主租户有效。同一数据库触发host_cache修复后的冷却时间。",
                    "OrmMySqlHostCacheRepairCooldownSeconds"),
                Number("OrmDdlLockWaitSeconds", "DDL锁等待秒", "8", 10460,
                    "仅主租户有效。MySQL表结构变更等待元数据锁的时长。"),
                Number("OrmDdlQueueWaitSeconds", "DDL队列等待秒", "600", 10470,
                    "仅主租户有效。同一API节点同一张表结构变更排队等待时长。"),

                Number("SpiderMaxSessionsTotal", "采集会话总上限", "32", 10500,
                    "仅主租户有效。单个API节点同时保留的采集浏览器会话总数。"),
                Number("SpiderMaxSessionsPerScope", "单范围采集会话上限", "4", 10510,
                    "仅主租户有效。同一租户/调用范围允许的采集会话数。"),
                Number("SpiderSessionIdleMinutes", "采集会话空闲分钟", "30", 10520,
                    "仅主租户有效。采集会话空闲超过此时间后自动释放。"),
                Number("SpiderSessionMaxHours", "采集会话最长小时", "8", 10530,
                    "仅主租户有效。采集会话无论是否活跃都不能超过此时长。"),
                Switch("SpiderTraceEnabled", "采集调试跟踪", "0", 10540,
                    "仅主租户有效。开启会产生较多诊断日志，生产环境通常关闭。")
            };

        public static IReadOnlyList<string> RuntimeFieldNames =>
            Fields.Select(field => field.Name).ToArray();

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var tableResult = await MicroiEngine.FormEngine.GetFormDataAsync(
                    "diy_table",
                    new
                    {
                        OsClient = osClient,
                        _Where = new List<object>
                        {
                            new List<object> { "Name", "=", "sys_osclients" }
                        },
                        _SelectFields = new[] { "Id", "Name" }
                    });
                if (tableResult.Code != 1 || tableResult.Data == null)
                {
                    messages.Add("未找到 sys_osclients 表定义，无法增加 SaaS 运行配置。");
                    return messages;
                }

                var tableId = Convert.ToString((object)tableResult.Data.Id);
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add("租户数据库连接不存在，无法增加 SaaS 运行配置。");
                    return messages;
                }

                PromoteExistingMySqlTextColumns(client.Db);
                foreach (var field in Fields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var existing = await MicroiEngine.FormEngine.GetFormDataAsync(
                        "diy_field",
                        new
                        {
                            OsClient = osClient,
                            _Where = new List<object>
                            {
                                new List<object> { "TableId", "=", tableId },
                                new List<object> { "Name", "=", field.Name }
                            },
                            _SelectFields = new[] { "Id", "Name", "Type" }
                        });
                    var existingField = existing.Code == 1 && existing.Data != null
                        ? JObject.FromObject((object)existing.Data)
                        : null;

                    var physicalExists = client.Db.ColumnExists("sys_osclients", field.Name);
                    if (existingField == null)
                    {
                        var addResult = await UpgradeTrustedFormEngine.AddFieldAsync(
                            osClient,
                            new DiyFieldParam
                            {
                                TableId = tableId,
                                TableName = "sys_osclients",
                                Name = field.Name,
                                Label = field.Label,
                                Type = field.Type,
                                Component = field.Component,
                                DefaultValue = field.DefaultValue,
                                Sort = field.Sort,
                                Description = field.Description,
                                Tab = PlatformTab,
                                Visible = 1,
                                AppVisible = 1,
                                TableWidth = 180,
                                FormWidth = field.Component == "Textarea" ? 24 : 6,
                                _NotAddDbField = physicalExists
                            });
                        if (addResult.Code != 1)
                        {
                            messages.Add($"新增 sys_osclients.{field.Name} 失败：{addResult.Msg}");
                            continue;
                        }
                    }
                    else if (!string.Equals(
                                 existingField.Value<string>("Type"),
                                 field.Type,
                                 StringComparison.OrdinalIgnoreCase))
                    {
                        var updateMetadata = await UpgradeTrustedFormEngine.UpdateAsync(
                            "diy_field",
                            osClient,
                            new JObject
                            {
                                ["Id"] = existingField["Id"],
                                ["TableId"] = tableId,
                                ["TableName"] = "sys_osclients",
                                ["Type"] = field.Type
                            }).ConfigureAwait(false);
                        if (updateMetadata.Code != 1)
                        {
                            messages.Add($"更新 sys_osclients.{field.Name} 字段类型失败：{updateMetadata.Msg}");
                            continue;
                        }
                    }

                    if (!client.Db.ColumnExists("sys_osclients", field.Name))
                    {
                        var addPhysical = await UpgradeTrustedFormEngine.AddDbFieldAsync(
                            osClient,
                            new DiyFieldParam
                            {
                                TableId = tableId,
                                TableName = "sys_osclients",
                                Name = field.Name,
                                Type = field.Type
                            }).ConfigureAwait(false);
                        if (addPhysical.Code != 1
                            && !client.Db.ColumnExists("sys_osclients", field.Name))
                        {
                            messages.Add($"新增 sys_osclients.{field.Name} 物理字段失败：{addPhysical.Msg}");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                messages.Add("增加 SaaS 运行配置失败：" + ex.Message);
            }
            return messages;
        }

        private static void PromoteExistingMySqlTextColumns(DbSession db)
        {
            if (db.Db.DbProvider.DatabaseType != DatabaseType.MySql) return;

            foreach (var field in Fields.Where(item =>
                         string.Equals(item.Type, "mediumtext", StringComparison.OrdinalIgnoreCase)))
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                if (!Regex.IsMatch(field.Name, "^[A-Za-z_][A-Za-z0-9_]{0,29}$"))
                    throw new InvalidOperationException("SaaS 运行配置字段名不合法：" + field.Name);
                if (!db.ColumnExists("sys_osclients", field.Name)) continue;

                var dataType = db.FromSql(@"SELECT DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@p0 AND COLUMN_NAME=@p1")
                    .AddInParameter("p0", "sys_osclients")
                    .AddInParameter("p1", field.Name)
                    .ToScalar<string>();
                if (string.Equals(dataType, "mediumtext", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(dataType, "longtext", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                if (!string.Equals(dataType, "varchar", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(dataType, "text", StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException(
                        $"sys_osclients.{field.Name} 当前物理类型 {dataType} 不能安全提升为 mediumtext。");
                }

                db.FromSql($"ALTER TABLE `sys_osclients` MODIFY COLUMN `{field.Name}` mediumtext NULL")
                    .ExecuteNonQuery();
                var readback = db.FromSql(@"SELECT DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@p0 AND COLUMN_NAME=@p1")
                    .AddInParameter("p0", "sys_osclients")
                    .AddInParameter("p1", field.Name)
                    .ToScalar<string>();
                if (!string.Equals(readback, "mediumtext", StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException($"sys_osclients.{field.Name} 提升为 mediumtext 后回读不一致。");
            }
        }

        private static RuntimeField Number(
            string name,
            string label,
            string defaultValue,
            int sort,
            string description,
            string legacyName = null) =>
            new RuntimeField(name, label, "int", "NumberText", defaultValue, sort, description, legacyName);

        private static RuntimeField Switch(
            string name,
            string label,
            string defaultValue,
            int sort,
            string description,
            string legacyName = null) =>
            new RuntimeField(name, label, "int", "Switch", defaultValue, sort, description, legacyName);

        private static RuntimeField Text(
            string name,
            string label,
            string defaultValue,
            int sort,
            string description) =>
            new RuntimeField(name, label, "mediumtext", "Textarea", defaultValue, sort, description);

        private sealed class RuntimeField
        {
            public RuntimeField(
                string name,
                string label,
                string type,
                string component,
                string defaultValue,
                int sort,
                string description,
                string legacyName = null)
            {
                Name = name;
                Label = label;
                Type = type;
                Component = component;
                DefaultValue = defaultValue;
                Sort = sort;
                Description = description;
                LegacyName = legacyName;
            }

            public string Name { get; }
            public string Label { get; }
            public string Type { get; }
            public string Component { get; }
            public string DefaultValue { get; }
            public int Sort { get; }
            public string Description { get; }
            public string LegacyName { get; }
        }
    }
}
