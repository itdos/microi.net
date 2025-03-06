using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microi.net.Api.Models;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Authorization;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api.Controllers;

//走接口引擎，不再走此controller
//[EnableCors("any")]
//[ServiceFilter(typeof(DiyFilter<dynamic>))]
//[Route("api/[controller]/[action]")]
//public class SpiderController : Controller
//{
//    private static MicroiSpider _microiSpider = new MicroiSpider();
//    /// <summary>
//    /// 
//    /// </summary>
//    /// <param name="param"></param>
//    /// <returns></returns>
//    [HttpPost, HttpGet]
//    public async Task<JsonResult> GetRenderHtml([FromBody] MicroiSpiderParam param)
//    {
//        var result = await _microiSpider.GetRenderHtml(param);
//        return Json(result);
//    }
//}

