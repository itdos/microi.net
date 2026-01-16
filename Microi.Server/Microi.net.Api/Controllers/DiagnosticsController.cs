using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microi.net;
using Dos.Common;
using System;
using System.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// 异常诊断 API 控制器
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class DiagnosticsController : ControllerBase
    {
        /// <summary>
        /// 获取异常诊断报告
        /// </summary>
        /// <returns></returns>
        [HttpGet("exception-report")]
        [AllowAnonymous]
        public ActionResult<DosResult> GetExceptionReport()
        {
            var report = ExceptionDiagnostics.GetReport();
            return Ok(new DosResult(1, new
            {
                Report = report,
                HasHighFrequencyExceptions = ExceptionDiagnostics.HasHighFrequencyExceptions(50)
            }));
        }

        /// <summary>
        /// 获取异常统计数据（JSON格式）
        /// </summary>
        /// <returns></returns>
        [HttpGet("exception-stats")]
        [AllowAnonymous]
        public ActionResult<DosResult> GetExceptionStats()
        {
            var stats = new System.Collections.Generic.List<object>();
            
            // 获取所有异常类型的统计
            var allStats = typeof(ExceptionDiagnostics)
                .GetField("_exceptionStats", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)
                ?.GetValue(null) as System.Collections.Concurrent.ConcurrentDictionary<string, ExceptionDiagnostics.ExceptionStats>;

            if (allStats != null)
            {
                foreach (var kvp in allStats.OrderByDescending(x => x.Value.Count).Take(50))
                {
                    stats.Add(new
                    {
                        Context = kvp.Key,
                        Type = kvp.Value.ExceptionType,
                        Count = kvp.Value.Count,
                        FirstOccurrence = kvp.Value.FirstOccurrence,
                        LastOccurrence = kvp.Value.LastOccurrence,
                        LastMessage = kvp.Value.LastMessage,
                        DistinctMessageCount = kvp.Value.DistinctMessages.Count
                    });
                }
            }

            return Ok(new DosResult(1, stats));
        }

        /// <summary>
        /// 清除异常统计数据
        /// </summary>
        /// <returns></returns>
        [HttpPost("clear-stats")]
        [Authorize] // 需要认证
        public ActionResult<DosResult> ClearStats()
        {
            ExceptionDiagnostics.Clear();
            return Ok(new DosResult(1, null, "异常统计数据已清除"));
        }

        /// <summary>
        /// 打印异常报告到控制台
        /// </summary>
        /// <returns></returns>
        [HttpPost("print-report")]
        [AllowAnonymous]
        public ActionResult<DosResult> PrintReport()
        {
            ExceptionDiagnostics.PrintReport();
            return Ok(new DosResult(1, null, "报告已打印到控制台"));
        }

        /// <summary>
        /// 检查是否有高频异常（需要关注）
        /// </summary>
        /// <param name="threshold">阈值（默认100次）</param>
        /// <returns></returns>
        [HttpGet("has-high-frequency")]
        [AllowAnonymous]
        public ActionResult<DosResult> HasHighFrequency([FromQuery] int threshold = 100)
        {
            var hasHighFreq = ExceptionDiagnostics.HasHighFrequencyExceptions(threshold);
            
            return Ok(new DosResult(1, new
            {
                HasHighFrequencyExceptions = hasHighFreq,
                Threshold = threshold,
                Suggestion = hasHighFreq 
                    ? "检测到高频异常，请查看详细报告进行诊断" 
                    : "未检测到高频异常"
            }));
        }

        /// <summary>
        /// 健康检查端点
        /// </summary>
        /// <returns></returns>
        [HttpGet("health")]
        [AllowAnonymous]
        public ActionResult<DosResult> HealthCheck()
        {
            var hasHighFreq = ExceptionDiagnostics.HasHighFrequencyExceptions(50);
            
            return Ok(new DosResult(1, new
            {
                Status = hasHighFreq ? "Warning" : "Healthy",
                Timestamp = DateTime.Now,
                Message = hasHighFreq 
                    ? "系统存在高频异常，建议检查" 
                    : "系统运行正常"
            }));
        }
    }
}
