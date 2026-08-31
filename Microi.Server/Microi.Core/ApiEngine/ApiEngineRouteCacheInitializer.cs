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
                // 启动缓存是路由控制面事实，必须从主库生成。若使用 DbRead，
                // 主库已发布的新 ApiAddress 会在节点重启后再次丢失，直到副本追平。
                var rows = ApiEngineAuthoritativeStore.GetAllEnabled(client);
                var cache = MicroiEngine.CacheTenant.Cache(client.OsClient);
                var resolution = ApiEngineRouteAliases.ResolveCacheAliases(
                    rows == null ? Enumerable.Empty<object>() : rows.Cast<object>());
                foreach (var conflict in resolution.Conflicts)
                {
                    var owners = string.Join("、", conflict.Owners.Select(owner =>
                        $"{owner.EngineKey}({owner.EngineId})"));
                    MicroiEngine.QueueSystemLog(client.OsClient, "ApiEngine",
                        "RouteAliasConflictQuarantined", "接口引擎歧义别名已隔离，其它唯一路由继续可用",
                        $"别名[{conflict.Alias}]同时属于[{owners}]，未写入该别名缓存。", 4);
                }
                await cache.RemoveParentAsync(
                    $"{CacheKeyPrefix}:{client.OsClient}:{ApiEngineCacheKey}:*").ConfigureAwait(false);
                var writes = resolution.Aliases.Select(alias =>
                    cache.SetAsync(
                        BuildCacheKey(client.OsClient, alias.Key),
                        JsonConvert.SerializeObject(alias.Value.ApiEngine))).ToList();
                await Task.WhenAll(writes).ConfigureAwait(false);
                MicroiEngine.QueueSystemLog(client.OsClient, "ApiEngine",
                    "RouteCacheInitialized", "接口引擎路由缓存初始化完成",
                    $"共写入{writes.Count}个 Key，隔离{resolution.Conflicts.Count}个歧义别名。", 1, true);
                return new DosResult(1, new
                {
                    CacheKeyCount = writes.Count,
                    QuarantinedAliasCount = resolution.Conflicts.Count
                });
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
