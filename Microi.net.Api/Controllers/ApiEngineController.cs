using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Collections.Generic;
using Dos.Common;
using Newtonsoft.Json;
using Dos.ORM;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 接口引擎
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<SysUser>))]
    public class ApiEngineController : Controller
    {
        private static ApiEngine _apiEngine = new ApiEngine();
        // private readonly IV8MethodExtend _v8MethodExtend;

        private readonly IMicroiSpider _microiSpider;
        private readonly IMicroiOffice _microiOffice;

        private readonly V8Method _v8Method;

        /// <summary>
        /// 
        /// </summary>
        // public ApiEngineController(IMicroiSpider microiSpiderInterface, IV8MethodExtend v8MethodExtend)
        public ApiEngineController(IMicroiSpider microiSpiderInterface, V8Method v8Method, IMicroiOffice microiOffice)
        {
            _microiSpider = microiSpiderInterface;
            // _v8MethodExtend = v8MethodExtend;
            _v8Method = v8Method;
            _microiOffice = microiOffice;
            _apiEngine = new ApiEngine(_microiSpider, _v8Method, _microiOffice);
        }

        /// <summary>
        /// 测试V8扩展
        /// </summary>
        /// <param name="param1"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public IActionResult TestV8Extend(string param1)
        {
            dynamic dynamicV8Method = _v8Method.Extend();
            var result = dynamicV8Method.TestV8Extend(param1);
            var result2 = _v8Method.TestV8Extend2(param1);
            return Ok(result + " - " + result2);
        }

        private static async Task<JObject> DefaultParam(JObject param)//[FromBody] 
        {
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            if (currentToken != null)
            {
                
                param["_CurrentSysUser"] = JToken.FromObject(currentToken.CurrentUser);
                param["OsClient"] = currentToken.OsClient;
            }
            if (currentTokenDynamic != null)
            {
                param["_CurrentUser"] = JToken.FromObject(currentTokenDynamic.CurrentUser);
                param["OsClient"] = currentTokenDynamic.OsClient;
            }
            if (currentTokenDynamic == null
                && param["authorization"] != null
                && !(param["authorization"].ToString().DosIsNullOrWhiteSpace()))
            {
                var tokenModel = await DiyToken.GetCurrentToken<SysUser>(param["authorization"].ToString());
                var tokenModelJobj = await DiyToken.GetCurrentToken<JObject>(param["authorization"].ToString());
                param["_CurrentSysUser"] = JToken.FromObject(tokenModel.CurrentUser);
                param["OsClient"] = tokenModel.OsClient;
                param["_CurrentUser"] = JToken.FromObject(tokenModelJobj.CurrentUser);
            }
            //2023-07-13：匿名调用接口引擎，需要通过header传入osclient，否则系统无法知道是调用哪个OsClient
            try
            {
                if (param["OsClient"] == null || param["OsClient"].ToString().DosIsNullOrWhiteSpace())
                {
                    var osClient = DiyHttpContext.Current.Request.Headers["osclient"].ToString();
                    param["OsClient"] = osClient;
                }
            }catch (Exception ex){}
            //2024-04-18 往V8.Param中添加Url参数
            try
            {
                foreach (var item in DiyHttpContext.Current.Request.Query)
                {
                    param[item.Key] = item.Value.ToString();
                }
            }
            catch (Exception ex){}
            //2024-10-25 往V8.Param中添加 form-data 参数
            try
            {
                foreach (var item in DiyHttpContext.Current.Request.Form)
                {
                    param[item.Key] = item.Value.ToString();
                }
            }
            catch (Exception ex){}
            return param;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpOptions]
        [AllowAnonymous]
        public IActionResult HandleOptions()  
        {  
            // //设置CORS响应头  
            // Response.Headers.Add("Access-Control-Allow-Origin", "*");  
            // Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");  
            // Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization");  
            // 返回空响应或204状态码  
            return NoContent();
        }  
        /// <summary>
        /// Content-Type:application/json
        /// </summary>
        /// <param name="param"></param>
        ///// <returns></returns>
        [HttpGet, HttpPost]
        [Consumes("application/json", "multipart/form-data")]
        [AllowAnonymous]
        public async Task<JsonResult> Run([FromBody] JObject param)
        {
            await DefaultParam(param);
            param["ApiAddress"] = HttpContext.Request.Path.Value;


            #region 接口引擎接收文件，将文件流转为byte[]，再转为string
            if (HttpContext.Request.HasFormContentType && HttpContext.Request.Form != null && HttpContext.Request.Form.Files != null && HttpContext.Request.Form.Files.Count > 0)
            {
                var files = new Dictionary<string, string>();
                foreach (var file in HttpContext.Request.Form.Files)
                {
                    if (file != null)
                    {
                        files.Add(file.FileName, Convert.ToBase64String(StreamHelper.StreamToBytes(file.OpenReadStream())));
                    }
                }
                param["_FilesByteBase64"] = JsonConvert.SerializeObject(files);
            }
            #endregion
            var result = await _apiEngine.RunAsync(param);
            return Json(result);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="apiEngineParam"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        // [Consumes("application/json", "multipart/form-data")]//加上这个会导致415错误
        [AllowAnonymous]
        public async Task<JsonResult> Run_FormData(ApiEngineParam apiEngineParam)
        {
            var param = JObject.FromObject(apiEngineParam);
            await DefaultParam(param);
            param["ApiAddress"] = HttpContext.Request.Path.Value;
            //param.ApiAddress = HttpContext.Request.Path.Value;


            #region 接口引擎接收文件，将文件流转为byte[]，再转为string
            if (HttpContext.Request.HasFormContentType && HttpContext.Request.Form != null && HttpContext.Request.Form.Files != null && HttpContext.Request.Form.Files.Count > 0)
            {
                var files = new Dictionary<string, string>();
                foreach (var file in HttpContext.Request.Form.Files)
                {
                    if (file != null)
                    {
                        files.Add(file.FileName, Convert.ToBase64String(StreamHelper.StreamToBytes(file.OpenReadStream())));
                    }
                }
                param["_FilesByteBase64"] = JsonConvert.SerializeObject(files);
                //param._FilesByteBase64 = files;
            }
            #endregion
            var result = await _apiEngine.RunAsync(param);
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        //[Consumes("application/json", "multipart/form-data")]//get请求无法增加这个
        [AllowAnonymous]
        public async Task<IActionResult> Run_Request_Get()
        {
            JObject param = new JObject();
            await DefaultParam(param);
            param["ApiAddress"] = HttpContext.Request.Path.Value;

            #region 接口引擎接收文件，将文件流转为byte[]，再转为string
            //get请求无法访问到 HttpContext.Request.Form
            //if (HttpContext.Request.HasFormContentType && HttpContext.Request.Form != null && HttpContext.Request.Form.Files != null && HttpContext.Request.Form.Files.Count > 0)
            //{
            //    var files = new Dictionary<string, string>();
            //    foreach (var file in HttpContext.Request.Form.Files)
            //    {
            //        if (file != null)
            //        {
            //            files.Add(file.FileName, Convert.ToBase64String(StreamHelper.StreamToBytes(file.OpenReadStream())));
            //        }
            //    }
            //    param["_FilesByteBase64"] = JsonConvert.SerializeObject(files);
            //}
            #endregion

            var result = await _apiEngine.RunAsync(param);
            try
            {
                var redirectUrl = (string)result.RedirectUrl;
                if (!redirectUrl.DosIsNullOrWhiteSpace()
                    && redirectUrl.ToLower() != "null"
                    && redirectUrl.ToLower() != "undefined"
                    )
                {
                    return Redirect(redirectUrl);
                }
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                

            }
            return Json(result);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult> Run_Response_File()
        {
            JObject param = new JObject();
            await DefaultParam(param);
            param["ApiAddress"] = HttpContext.Request.Path.Value;

            #region 接口引擎接收文件，将文件流转为byte[]，再转为string
            //get请求无法访问到 HttpContext.Request.Form
            //if (HttpContext.Request.HasFormContentType && HttpContext.Request.Form != null && HttpContext.Request.Form.Files != null && HttpContext.Request.Form.Files.Count > 0)
            //{
            //    var files = new Dictionary<string, string>();
            //    foreach (var file in HttpContext.Request.Form.Files)
            //    {
            //        if (file != null)
            //        {
            //            files.Add(file.FileName, Convert.ToBase64String(StreamHelper.StreamToBytes(file.OpenReadStream())));
            //        }
            //    }
            //    param["_FilesByteBase64"] = JsonConvert.SerializeObject(files);
            //}
            #endregion

            var result = await _apiEngine.RunAsync(param);
            try
            {
                var redirectUrl = (string)result.RedirectUrl;
                if (!redirectUrl.DosIsNullOrWhiteSpace()
                    && redirectUrl.ToLower() != "null"
                    && redirectUrl.ToLower() != "undefined"
                    )
                {
                    return Redirect(redirectUrl);
                }
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                

            }
            //dynamic 转 DosResult
            JObject resultObj = JObject.FromObject(result);
            if (resultObj["Code"]?.Value<int>() != 1)
            {
                return new ContentResult() { Content = resultObj.ToString() };
            }
            JObject resultDataObj = JObject.FromObject(result.Data);
            //返回文件：Data是一个对象：{ FileName: '(包含后缀格式)', ContentType: '(如：application/vnd.ms-excel)', FileByteBase64: '(byte[])' }
            var fileName = resultDataObj["FileName"]?.Value<string>();
            var contentType = resultDataObj["ContentType"]?.Value<string>();
            var fileByteBase64 = resultDataObj["FileByteBase64"]?.Value<string>();
            if (fileName.DosIsNullOrWhiteSpace() || contentType.DosIsNullOrWhiteSpace() || fileByteBase64.DosIsNullOrWhiteSpace())
            {
                return new ContentResult() { Content = JsonConvert.SerializeObject(new {
                    Code = 0,
                    Msg = "FileName、ContentType、FileByteBase64均不能为空！"
                }) };
            }
            return File(Convert.FromBase64String(fileByteBase64), contentType, fileName);
        }
    }
}
