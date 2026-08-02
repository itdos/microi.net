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
        // Process-local identity is diagnostic-only. It must never be used as
        // business ownership or distributed state, but lets deployment probes
        // prove that two direct URLs actually terminate on different API
        // processes instead of two aliases for the same node.
        private static readonly string RuntimeInstanceId = Guid.NewGuid().ToString("N");
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
            var jwtSigningKey = GetJwtSigningKeyStatus();
            var isHealthy = !memory.RejectingRequests && jwtSigningKey.Ready;
            var status = jwtSigningKey.Ready
                ? (memory.RejectingRequests ? "Degraded" : "Healthy")
                : "Unhealthy";
            var message = !jwtSigningKey.Ready
                ? "JWT 签名密钥尚未从稳定来源加载，节点已退出业务流量"
                : (memory.RejectingRequests ? "当前节点处于内存压力保护状态" : "系统运行正常");
            var data = new
            {
                Status = status,
                InstanceId = RuntimeInstanceId,
                Timestamp = DateTime.Now,
                Message = message,
                JwtSigningKey = new
                {
                    jwtSigningKey.Ready,
                    jwtSigningKey.Durable,
                    jwtSigningKey.Source,
                    jwtSigningKey.Fingerprint
                },
                Memory = new
                {
                    memory.RejectingRequests,
                    memory.ShutdownRequested,
                    PressureMetric = "ResidentSet",
                    ProcessMB = memory.ProcessBytes / (1024L * 1024L),
                    WorkingSetMB = memory.WorkingSetBytes / (1024L * 1024L),
                    PrivateAddressSpaceMB = memory.PrivateBytes / (1024L * 1024L),
                    ManagedHeapMB = memory.ManagedHeapBytes / (1024L * 1024L),
                    EffectiveMemoryMB = memory.EffectiveMemoryBytes / (1024L * 1024L),
                    memory.EffectiveMemorySource,
                    SoftLimitMB = memory.SoftLimitBytes / (1024L * 1024L),
                    HardLimitMB = memory.HardLimitBytes / (1024L * 1024L),
                    memory.SoftLimitPercent,
                    memory.HardLimitPercent,
                    memory.SampledAt
                }
            };
            return !isHealthy
                ? StatusCode(StatusCodes.Status503ServiceUnavailable, new DosResult(0, data, message + "。"))
                : Ok(new DosResult(1, data));
        }

        private static JwtSigningKeyStatus GetJwtSigningKeyStatus()
        {
            try
            {
                var osClient = OsClient.GetConfigOsClient();
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = OsClientDefault.OsClient;
                }
                OsClientExtend.ClientList.TryGetValue(osClient, out var clientModel);
                return DiyToken.GetJwtSigningKeyStatus(clientModel);
            }
            catch (Exception ex)
            {
                return new JwtSigningKeyStatus
                {
                    Ready = false,
                    Durable = false,
                    Source = "Unavailable",
                    Fingerprint = string.Empty,
                    Message = "JWT 签名密钥状态读取失败：" + ex.Message
                };
            }
        }

        /// <summary>仅表示进程仍存活，不代表节点适合继续接收业务流量。</summary>
        [HttpGet("liveness")]
        [AllowAnonymous]
        public ActionResult<DosResult> Liveness()
        {
            return Ok(new DosResult(1, new
            {
                Status = "Alive",
                InstanceId = RuntimeInstanceId,
                Timestamp = DateTime.Now
            }));
        }
    }
}
