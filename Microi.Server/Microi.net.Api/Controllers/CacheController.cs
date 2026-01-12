using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using Dos.Common;
using Microi.net;

namespace Microi.net.Api.Controllers
{
    /// <summary>
    /// 缓存管理控制器 - 用于监控和管理二级缓存
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class CacheController : ControllerBase
    {
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
    }
}
