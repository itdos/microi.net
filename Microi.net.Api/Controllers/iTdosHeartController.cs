using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// iTdos心跳包健康检查
    /// </summary>
    [Route("itdos-heart")]
    public class iTdosHeartController : ControllerBase
    {
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public string Get()
        {
            return "iTdos";
        }
    }
}
