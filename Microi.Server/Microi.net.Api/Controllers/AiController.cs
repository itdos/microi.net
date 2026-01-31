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

namespace Microi.net.Api
{
    /// <summary>
    /// 
    /// </summary> <summary>
    /// 
    /// </summary>
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
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
        /// AI对话
        /// </summary>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> Chat(AiParam param)
        {
            var result = await _microiAi.Chat(param);
            return Json(result);
        }

        /// <summary>
        /// 自然语言转SQL查询（用户可以问：今天订单数量多少）
        /// </summary>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> NL2SQL(NL2SQLParam param)
        {
            var result = await _microiAi.NL2SQL(param);
            return Json(result);
        }

        // /// <summary>
        // /// 刷新数据库Schema缓存（表结构变更后调用）
        // /// </summary>
        // /// <returns></returns>
        // [HttpPost, HttpGet]
        // public async Task<JsonResult> RefreshSchemaCache()
        // {
        //     try
        //     {
        //         if (_microiAi is MicroiAI aiInstance)
        //         {
        //             await aiInstance.RefreshSchemaCache();
        //             return Json(new DosResult(1, null, "Schema缓存刷新成功！"));
        //         }
        //         return Json(new DosResult(0, null, "AI实例类型不匹配！"));
        //     }
        //     catch (Exception ex)
        //     {
        //         return Json(new DosResult(0, null, $"刷新失败: {ex.Message}"));
        //     }
        // }
    }
}