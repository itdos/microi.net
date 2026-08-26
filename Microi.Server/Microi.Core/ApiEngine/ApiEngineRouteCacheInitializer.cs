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
                        new DiyWhere { Name = "ApiAddress", Value = null, Type = "<>" }
                    },
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
                var writes = new List<Task>();
                if (rows != null)
                {
                    foreach (var row in rows)
                    {
                        var address = DynamicHelper.GetDynamicStringValue(row, "ApiAddress", string.Empty)
                            .ToLowerInvariant();
                        if (address.DosIsNullOrWhiteSpace()) continue;
                        var key = DynamicHelper.GetDynamicStringValue(row, "ApiEngineKey", string.Empty)
                            .ToLowerInvariant();
                        var json = JsonConvert.SerializeObject((object)row);
                        if (!key.DosIsNullOrWhiteSpace())
                            writes.Add(cache.SetAsync(BuildCacheKey(client.OsClient, key), json));
                        writes.Add(cache.SetAsync(BuildCacheKey(client.OsClient, address), json));
                    }
                }
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
