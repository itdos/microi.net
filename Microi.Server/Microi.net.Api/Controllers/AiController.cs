using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.AspNetCore.Mvc;
using Minio.DataModel;
using MySqlX.XDevAPI.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Quartz.Impl.AdoJobStore.Common;
using Senparc.CO2NET.Extensions;
using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Threading.Tasks;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary> <summary>
    /// 
    /// </summary>
    // [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class AiController : Controller
    {
        private readonly IMicroiAI _microiAi;
        public AiController(IMicroiAI microiAi)
        {
            _microiAi = microiAi;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpPost,HttpGet]
        public async Task<JsonResult> Chat(AiParam param)
        {
            var result = await _microiAi.Chat(param);
            return Json(result);
        }
    }
}
