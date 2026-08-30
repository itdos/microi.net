using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;

namespace Microi.net
{
    /// <summary>
    /// 接口引擎自定义地址缓存初始化。缓存事实与租户数据库属于 Core，MVC 动态
    /// 路由只消费该缓存并在未命中时安全回源，不再自行拥有初始化业务。
    /// </summary>
    public static class ApiEngineRouteCacheInitializer
    {
        private const string CacheKeyPrefix = "Microi";
        private const string ApiEngineCacheKey = "FormData:sys_apiengine";

        public static async Task<DosResult> InitializeAsync(OsClientSecret client)
        {
            if (client == null || client.OsClient.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "接口引擎路由缓存初始化缺少租户。");
            if (client.Db == null)
                return new DosResult(0, null, $"接口引擎路由缓存跳过租户[{client.OsClient}]：数据库会话未初始化。");

            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync(new
                {
                    FormEngineKey = "sys_apiengine",
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "IsEnable", Value = 1, Type = "=" }
                    },
                    _PageIndex = 1,
                    _PageSize = 100000,
                    OsClient = client.OsClient
                }).ConfigureAwait(false);
                if (result.Code != 1)
                {
                    MicroiEngine.QueueSystemLog(client.OsClient, "ApiEngine",
                        "RouteCacheInitializationFailed", "接口引擎路由缓存初始化失败，可能导致自定义地址首次请求回源",
                        result.Msg, 3);
                    return new DosResult(0, null, result.Msg);
                }

                var rows = result.Data;
                var cache = MicroiEngine.CacheTenant.Cache(client.OsClient);
                var aliases = new Dictionary<string, (string EngineId, string EngineKey, string Json)>(
                    StringComparer.OrdinalIgnoreCase);
                if (rows != null)
                {
                    foreach (var row in rows)
                    {
                        var id = DynamicHelper.GetDynamicStringValue(row, "Id", string.Empty);
                        var key = DynamicHelper.GetDynamicStringValue(row, "ApiEngineKey", string.Empty);
                        var json = JsonConvert.SerializeObject((object)row);
                        foreach (var alias in ApiEngineRouteAliases.GetCacheAliases((object)row))
                        {
                            if (aliases.TryGetValue(alias, out var owner)
                                && !string.Equals(owner.EngineId, id, StringComparison.OrdinalIgnoreCase))
                            {
                                var conflict = $"路由/缓存别名[{alias}]同时属于接口引擎[{owner.EngineKey}]和[{key}]。";
                                MicroiEngine.QueueSystemLog(client.OsClient, "ApiEngine",
                                    "RouteAliasConflict", "接口引擎多路由存在冲突，已拒绝覆盖缓存",
                                    conflict, 4);
                                return new DosResult(0, null, conflict);
                            }
                            aliases[alias] = (id, key, json);
                        }
                    }
                }
                var writes = aliases.Select(alias =>
                    cache.SetAsync(BuildCacheKey(client.OsClient, alias.Key), alias.Value.Json)).ToList();
                await Task.WhenAll(writes).ConfigureAwait(false);
                MicroiEngine.QueueSystemLog(client.OsClient, "ApiEngine",
                    "RouteCacheInitialized", "接口引擎路由缓存初始化完成",
                    $"共写入{writes.Count}个 Key。", 1, true);
                return new DosResult(1, new { CacheKeyCount = writes.Count });
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(client.OsClient, "ApiEngine",
                    "RouteCacheInitializationException", "接口引擎路由缓存初始化异常，首次请求将安全回源",
                    ex.ToString(), 3);
                return new DosResult(0, null, ex.Message);
            }
        }

        private static string BuildCacheKey(string osClient, string key)
        {
            return $"{CacheKeyPrefix}:{osClient}:{ApiEngineCacheKey}:{key}";
        }
    }
}
