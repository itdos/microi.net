using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Newtonsoft.Json.Linq;
using Dos.Common;
using Microi.net;
using Microi.Cache;
using System.Collections.Concurrent;

namespace Microi.net.Api.Controllers
{
    /// <summary>
    /// 缓存管理控制器 - 用于监控和管理二级缓存
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class CacheController : ControllerBase
    {
        private readonly IMicroiRedisManager _redisManager;
        private static readonly ConcurrentDictionary<string, int> AnonymousRedisRate = new ConcurrentDictionary<string, int>();

        public CacheController(IMicroiRedisManager redisManager)
        {
            _redisManager = redisManager;
        }
        /// <summary>
        /// 获取缓存统计信息
        /// GET /api/cache/statistics
        /// </summary>
        [HttpGet("statistics")]
        public IActionResult GetStatistics()
        {
            try
            {
                var stats = MicroiTwoLevelCache.GetStatistics();
                return Ok(new DosResult(1, new
                {
                    stats.LocalHits,
                    stats.RedisHits,
                    stats.Misses,
                    stats.LocalCacheSize,
                    LocalHitRate = $"{stats.LocalHitRate:F2}%",
                    TotalHitRate = $"{stats.TotalHitRate:F2}%",
                    Message = stats.ToString()
                }));
            }
            catch (System.Exception ex)
            {
                return Ok(new DosResult(0, null, $"获取缓存统计失败：{ex.Message}"));
            }
        }

        /// <summary>
        /// 清除指定Key的缓存（仅管理员使用）
        /// POST /api/cache/invalidate
        /// Body: { "Key": "Microi:OsClient1:FormData:sys_apiengine:/api/test" }
        /// </summary>
        [HttpPost("invalidate")]
        public async Task<IActionResult> InvalidateCache([FromBody] JObject param)
        {
            try
            {
                var key = param["Key"]?.ToString();
                if (string.IsNullOrEmpty(key))
                {
                    return Ok(new DosResult(0, null, "Key参数不能为空"));
                }

                var osClient = DiyToken.GetCurrentOsClient();
                var cache = MicroiEngine.CacheTenant.Cache(osClient);

                await cache.RemoveAsync(key);

                return Ok(new DosResult(1, null, $"缓存 {key} 已清除"));
            }
            catch (System.Exception ex)
            {
                return Ok(new DosResult(0, null, $"清除缓存失败：{ex.Message}"));
            }
        }

        /// <summary>
        /// 批量清除缓存（模式匹配，仅管理员使用）
        /// POST /api/cache/invalidate-pattern
        /// Body: { "Pattern": "Microi:OsClient1:FormData:sys_apiengine:*" }
        /// </summary>
        [HttpPost("invalidate-pattern")]
        public async Task<IActionResult> InvalidatePattern([FromBody] JObject param)
        {
            try
            {
                var pattern = param["Pattern"]?.ToString();
                if (string.IsNullOrEmpty(pattern))
                {
                    return Ok(new DosResult(0, null, "Pattern参数不能为空"));
                }

                var osClient = DiyToken.GetCurrentOsClient();
                var cache = MicroiEngine.CacheTenant.Cache(osClient);

                // 注意：这里需要实现 RemoveParentAsync 或新增 InvalidatePatternAsync 方法
                await cache.RemoveParentAsync(pattern);

                return Ok(new DosResult(1, null, $"缓存模式 {pattern} 已清除"));
            }
            catch (System.Exception ex)
            {
                return Ok(new DosResult(0, null, $"批量清除缓存失败：{ex.Message}"));
            }
        }

        /// <summary>获取当前租户默认 Redis 与已保存连接。密码永不返回。</summary>
        [HttpGet("redis/connections"), HttpPost("redis/connections")]
        public async Task<IActionResult> GetRedisConnections()
        {
            try
            {
                var access = await GetRedisAccessAsync("tenant").ConfigureAwait(false);
                if (!access.Allowed) return Ok(new DosResult(access.Code, null, access.Message));
                var data = await _redisManager.GetConnectionsAsync(access.OsClient).ConfigureAwait(false);
                return Ok(new DosResult(1, data, "获取 Redis 连接成功。"));
            }
            catch (System.Exception ex)
            {
                return RedisError("获取 Redis 连接失败", ex);
            }
        }

        /// <summary>保存租户 Redis 连接。密码由后端加密，空密码在修改时表示保持原值。</summary>
        [HttpPost("redis/connections/save")]
        public async Task<IActionResult> SaveRedisConnection([FromBody] RedisManagerSavedConnectionInput input)
        {
            try
            {
                var access = await GetRedisAccessAsync("tenant").ConfigureAwait(false);
                if (!access.Allowed) return Ok(new DosResult(access.Code, null, access.Message));
                var data = await _redisManager.SaveConnectionAsync(access.OsClient, input).ConfigureAwait(false);
                WriteRedisAudit(access.OsClient, "保存Redis连接", new { data.Id, data.Name, data.Host, data.Port, data.Database });
                return Ok(new DosResult(1, data, "Redis 连接已保存。"));
            }
            catch (System.Exception ex)
            {
                return RedisError("保存 Redis 连接失败", ex);
            }
        }

        /// <summary>删除当前租户保存的 Redis 连接。</summary>
        [HttpPost("redis/connections/delete")]
        public async Task<IActionResult> DeleteRedisConnection([FromBody] JObject input)
        {
            try
            {
                var access = await GetRedisAccessAsync("tenant").ConfigureAwait(false);
                if (!access.Allowed) return Ok(new DosResult(access.Code, null, access.Message));
                var id = input?["Id"]?.ToString();
                await _redisManager.DeleteConnectionAsync(access.OsClient, id).ConfigureAwait(false);
                WriteRedisAudit(access.OsClient, "删除Redis连接", new { Id = id });
                return Ok(new DosResult(1, null, "Redis 连接已删除。"));
            }
            catch (System.Exception ex)
            {
                return RedisError("删除 Redis 连接失败", ex);
            }
        }

        /// <summary>测试 Redis 连接。temporary 模式支持匿名调用且不会持久化凭据。</summary>
        [HttpPost("redis/test")]
        [AllowAnonymous]
        public async Task<IActionResult> TestRedisConnection([FromBody] RedisManagerContextRequest input)
        {
            try
            {
                var access = await GetRedisAccessAsync(input?.Mode).ConfigureAwait(false);
                if (!access.Allowed) return Ok(new DosResult(access.Code, null, access.Message));
                var data = await _redisManager.TestConnectionAsync(access.OsClient, input).ConfigureAwait(false);
                return Ok(new DosResult(1, data, "Redis 连接成功。"));
            }
            catch (System.Exception ex)
            {
                return RedisError("Redis 连接失败", ex);
            }
        }

        /// <summary>获取 Redis 服务器、内存、客户端、命中率及数据类型抽样统计。</summary>
        [HttpPost("redis/statistics")]
        [AllowAnonymous]
        public async Task<IActionResult> GetRedisStatistics([FromBody] RedisManagerContextRequest input)
        {
            try
            {
                var access = await GetRedisAccessAsync(input?.Mode).ConfigureAwait(false);
                if (!access.Allowed) return Ok(new DosResult(access.Code, null, access.Message));
                var data = await _redisManager.GetStatisticsAsync(access.OsClient, input).ConfigureAwait(false);
                return Ok(new DosResult(1, data, "获取 Redis 统计成功。"));
            }
            catch (System.Exception ex)
            {
                return RedisError("获取 Redis 统计失败", ex);
            }
        }

        /// <summary>使用 SCAN 游标分页获取 Key，禁止使用阻塞式 KEYS 命令。</summary>
        [HttpPost("redis/keys")]
        [AllowAnonymous]
        public async Task<IActionResult> GetRedisKeys([FromBody] RedisManagerKeyListRequest input)
        {
            try
            {
                var access = await GetRedisAccessAsync(input?.Mode).ConfigureAwait(false);
                if (!access.Allowed) return Ok(new DosResult(access.Code, null, access.Message));
                var data = await _redisManager.GetKeysAsync(access.OsClient, input).ConfigureAwait(false);
                return Ok(new DosResult(1, data, "获取 Redis Key 成功。"));
            }
            catch (System.Exception ex)
            {
                return RedisError("获取 Redis Key 失败", ex);
            }
        }

        /// <summary>查看 String、Hash、List、Set、Sorted Set、Stream 内容与 TTL/内存信息。</summary>
        [HttpPost("redis/key")]
        [AllowAnonymous]
        public async Task<IActionResult> GetRedisKey([FromBody] RedisManagerKeyRequest input)
        {
            try
            {
                var access = await GetRedisAccessAsync(input?.Mode).ConfigureAwait(false);
                if (!access.Allowed) return Ok(new DosResult(access.Code, null, access.Message));
                var data = await _redisManager.GetKeyAsync(access.OsClient, input).ConfigureAwait(false);
                return Ok(new DosResult(1, data, "获取 Redis 内容成功。"));
            }
            catch (System.Exception ex)
            {
                return RedisError("获取 Redis 内容失败", ex);
            }
        }

        /// <summary>单个或批量删除 Redis Key，单次最多 500 个。</summary>
        [HttpPost("redis/keys/delete")]
        [AllowAnonymous]
        public async Task<IActionResult> DeleteRedisKeys([FromBody] RedisManagerDeleteRequest input)
        {
            try
            {
                var access = await GetRedisAccessAsync(input?.Mode).ConfigureAwait(false);
                if (!access.Allowed) return Ok(new DosResult(access.Code, null, access.Message));
                var deleted = await _redisManager.DeleteKeysAsync(access.OsClient, input).ConfigureAwait(false);
                WriteRedisAudit(access.OsClient, "删除RedisKey", new
                {
                    Mode = input.Mode,
                    input.ConnectionId,
                    input.Database,
                    Requested = input.Keys?.Count ?? 0,
                    Deleted = deleted,
                    Keys = input.Keys == null ? new string[0] : input.Keys.Take(50).ToArray()
                });
                return Ok(new DosResult(1, new { Deleted = deleted }, $"已删除 {deleted} 个 Redis Key。"));
            }
            catch (System.Exception ex)
            {
                return RedisError("删除 Redis Key 失败", ex);
            }
        }

        /// <summary>创建或覆盖 String/Hash/List/Set/Sorted Set 内容。</summary>
        [HttpPost("redis/key/replace")]
        [AllowAnonymous]
        public async Task<IActionResult> ReplaceRedisValue([FromBody] RedisManagerReplaceRequest input)
        {
            try
            {
                var access = await GetRedisAccessAsync(input?.Mode).ConfigureAwait(false);
                if (!access.Allowed) return Ok(new DosResult(access.Code, null, access.Message));
                await _redisManager.ReplaceValueAsync(access.OsClient, input).ConfigureAwait(false);
                WriteRedisAudit(access.OsClient, "写入RedisKey", new { input.Mode, input.ConnectionId, input.Database, input.Key, input.DataType, input.TtlSeconds });
                return Ok(new DosResult(1, null, "Redis 内容已保存。"));
            }
            catch (System.Exception ex)
            {
                return RedisError("保存 Redis 内容失败", ex);
            }
        }

        /// <summary>重命名 Key，不覆盖已有目标 Key。</summary>
        [HttpPost("redis/key/rename")]
        [AllowAnonymous]
        public async Task<IActionResult> RenameRedisKey([FromBody] RedisManagerRenameRequest input)
        {
            try
            {
                var access = await GetRedisAccessAsync(input?.Mode).ConfigureAwait(false);
                if (!access.Allowed) return Ok(new DosResult(access.Code, null, access.Message));
                await _redisManager.RenameKeyAsync(access.OsClient, input).ConfigureAwait(false);
                WriteRedisAudit(access.OsClient, "重命名RedisKey", new { input.Mode, input.ConnectionId, input.Database, input.Key, input.NewKey });
                return Ok(new DosResult(1, null, "Redis Key 已重命名。"));
            }
            catch (System.Exception ex)
            {
                return RedisError("重命名 Redis Key 失败", ex);
            }
        }

        /// <summary>设置 TTL；-1 永久，0 立即删除，大于 0 为秒。</summary>
        [HttpPost("redis/key/ttl")]
        [AllowAnonymous]
        public async Task<IActionResult> SetRedisTtl([FromBody] RedisManagerTtlRequest input)
        {
            try
            {
                var access = await GetRedisAccessAsync(input?.Mode).ConfigureAwait(false);
                if (!access.Allowed) return Ok(new DosResult(access.Code, null, access.Message));
                await _redisManager.SetTtlAsync(access.OsClient, input).ConfigureAwait(false);
                WriteRedisAudit(access.OsClient, "设置RedisTTL", new { input.Mode, input.ConnectionId, input.Database, input.Key, input.TtlSeconds });
                return Ok(new DosResult(1, null, "Redis TTL 已更新。"));
            }
            catch (System.Exception ex)
            {
                return RedisError("更新 Redis TTL 失败", ex);
            }
        }

        private sealed class RedisAccessResult
        {
            public bool Allowed { get; set; }
            public int Code { get; set; }
            public string Message { get; set; }
            public string OsClient { get; set; }
        }

        private async Task<RedisAccessResult> GetRedisAccessAsync(string mode)
        {
            var normalizedMode = (mode ?? "tenant").Trim().ToLowerInvariant();
            if (normalizedMode == "temporary")
            {
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                var minuteKey = ip + ":" + System.DateTime.UtcNow.ToString("yyyyMMddHHmm");
                var count = AnonymousRedisRate.AddOrUpdate(minuteKey, 1, (_, oldValue) => oldValue + 1);
                if (AnonymousRedisRate.Count > 2000)
                {
                    var currentMinute = System.DateTime.UtcNow.ToString("yyyyMMddHHmm");
                    foreach (var key in AnonymousRedisRate.Keys.Where(key => !key.EndsWith(currentMinute)).Take(1000))
                        AnonymousRedisRate.TryRemove(key, out _);
                }
                if (count > 120)
                    return new RedisAccessResult { Allowed = false, Code = 0, Message = "匿名 Redis 操作过于频繁，请一分钟后重试。" };
                return new RedisAccessResult { Allowed = true, Code = 1, OsClient = "" };
            }

            if (normalizedMode != "tenant" && normalizedMode != "saved")
                return new RedisAccessResult { Allowed = false, Code = 0, Message = "不支持的 Redis 连接模式。" };

            try
            {
                var currentToken = await DiyToken.GetCurrentToken().ConfigureAwait(false);
                JObject currentUser = currentToken?.CurrentUser as JObject;
                var osClient = currentToken?.OsClient as string;
                if (currentUser == null || string.IsNullOrWhiteSpace(osClient))
                    return new RedisAccessResult { Allowed = false, Code = 1001, Message = "登录身份已过期；未登录状态只能使用临时 Redis 连接。" };
                if (currentUser["Level"].Val<int>() < DiyCommon.MaxRoleLevel)
                    return new RedisAccessResult { Allowed = false, Code = 0, Message = "只有超级管理员可以访问当前租户或已保存的 Redis 连接。" };
                return new RedisAccessResult { Allowed = true, Code = 1, OsClient = osClient };
            }
            catch
            {
                return new RedisAccessResult { Allowed = false, Code = 1001, Message = "登录身份无效；未登录状态只能使用临时 Redis 连接。" };
            }
        }

        private IActionResult RedisError(string title, System.Exception ex)
        {
            var message = RedactRedisSecret(ex?.Message);
            return Ok(new DosResult(0, null, title + "：" + message));
        }

        private static string RedactRedisSecret(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return "未知错误";
            var result = message;
            foreach (var marker in new[] { "password=", "pwd=" })
            {
                var index = result.IndexOf(marker, System.StringComparison.OrdinalIgnoreCase);
                if (index < 0) continue;
                var end = result.IndexOf(',', index);
                if (end < 0) end = result.Length;
                result = result.Substring(0, index + marker.Length) + "***" + result.Substring(end);
            }
            return result.Length > 500 ? result.Substring(0, 500) : result;
        }

        private void WriteRedisAudit(string osClient, string title, object content)
        {
            try
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam
                {
                    Type = "Redis管理器",
                    Title = title,
                    Content = Newtonsoft.Json.JsonConvert.SerializeObject(new
                    {
                        OsClient = osClient,
                        RemoteIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                        Data = content
                    }),
                    Level = 1,
                    OsClient = osClient
                });
            }
            catch
            {
                // 审计存储异常不阻断 Redis 紧急恢复操作。
            }
        }
    }
}
