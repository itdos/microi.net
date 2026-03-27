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
        /// <summary>
        /// 健康检查端点
        /// </summary>
        [HttpGet("health")]
        [AllowAnonymous]
        public ActionResult<DosResult> HealthCheck()
        {
            return Ok(new DosResult(1, new
            {
                Status = "Healthy",
                Timestamp = DateTime.Now,
                Message = "系统运行正常"
            }));
        }
    }
}
