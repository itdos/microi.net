using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microi.net;
using Dos.Common;
using System;
using System.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// 系统诊断 API 控制器
    /// 异常诊断已迁移至标准日志系统（Console + MongoDB SysLog）
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class DiagnosticsController : ControllerBase
    {
        private readonly ProcessMemoryPressureState _memoryPressure;

        public DiagnosticsController(ProcessMemoryPressureState memoryPressure)
        {
            _memoryPressure = memoryPressure;
        }

        /// <summary>
        /// 健康检查端点
        /// </summary>
        [HttpGet("health")]
        [AllowAnonymous]
        public ActionResult<DosResult> HealthCheck()
        {
            var memory = _memoryPressure.GetSnapshot();
            var data = new
            {
                Status = memory.RejectingRequests ? "Degraded" : "Healthy",
                Timestamp = DateTime.Now,
                Message = memory.RejectingRequests ? "当前节点处于内存压力保护状态" : "系统运行正常",
                Memory = new
                {
                    memory.RejectingRequests,
                    memory.ShutdownRequested,
                    PressureMetric = "ResidentSet",
                    ProcessMB = memory.ProcessBytes / (1024L * 1024L),
                    WorkingSetMB = memory.WorkingSetBytes / (1024L * 1024L),
                    PrivateAddressSpaceMB = memory.PrivateBytes / (1024L * 1024L),
                    ManagedHeapMB = memory.ManagedHeapBytes / (1024L * 1024L),
                    SoftLimitMB = memory.SoftLimitBytes / (1024L * 1024L),
                    HardLimitMB = memory.HardLimitBytes / (1024L * 1024L),
                    memory.SampledAt
                }
            };
            return memory.RejectingRequests
                ? StatusCode(StatusCodes.Status503ServiceUnavailable, new DosResult(0, data, "当前节点处于内存压力保护状态。"))
                : Ok(new DosResult(1, data));
        }

        /// <summary>仅表示进程仍存活，不代表节点适合继续接收业务流量。</summary>
        [HttpGet("liveness")]
        [AllowAnonymous]
        public ActionResult<DosResult> Liveness()
        {
            return Ok(new DosResult(1, new { Status = "Alive", Timestamp = DateTime.Now }));
        }
    }
}
