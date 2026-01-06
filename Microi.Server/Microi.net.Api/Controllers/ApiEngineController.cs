using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Collections.Generic;
using Dos.Common;
using Newtonsoft.Json;
using Dos.ORM;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// 接口引擎
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class ApiEngineController : Controller
    {
        private static async Task<JObject> DefaultParam(JObject param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            if (currentTokenDynamic != null)
            {
                param["_CurrentUser"] = JToken.FromObject(currentTokenDynamic.CurrentUser);
                param["OsClient"] = currentTokenDynamic.OsClient;
            }
            if (currentTokenDynamic == null
                && param["authorization"] != null
                && !param["authorization"].ToString().DosIsNullOrWhiteSpace())
            {
                // var tokenModel = await DiyToken.GetCurrentToken<SysUser>(param["authorization"].ToString());
                var tokenModelJobj = await DiyToken.GetCurrentToken<JObject>(param["authorization"].ToString());
                // param["_CurrentSysUser"] = JToken.FromObject(tokenModel.CurrentUser);
                param["OsClient"] = tokenModelJobj.OsClient;
                param["_CurrentUser"] = JToken.FromObject(tokenModelJobj.CurrentUser);
            }
            //2023-07-13：匿名调用接口引擎，需要通过header传入osclient，否则系统无法知道是调用哪个OsClient
            try
            {
                if (param["OsClient"] == null || param["OsClient"].ToString().DosIsNullOrWhiteSpace())
                {
                    var osClient = DiyHttpContext.Current?.Request.Headers["osclient"].ToString();
                    param["OsClient"] = osClient;
                }
            }
            catch (Exception ex) { }
            //2024-04-18 往V8.Param中添加Url参数
            try
            {
                foreach (var item in DiyHttpContext.Current?.Request.Query)
                {
                    param[item.Key] = item.Value.ToString();
                }
            }
            catch (Exception ex) { }
            //2024-10-25 往V8.Param中添加 form-data 参数
            try
            {
                if (DiyHttpContext.Current.Request.HasFormContentType)
                {
                    foreach (var item in DiyHttpContext.Current.Request.Form)
                    {
                        param[item.Key] = item.Value.ToString();
                    }
                }
            }
            catch (Exception ex) { }
            //2024-12-26 往V8.Param中添加 xml 参数
            try
            {
                using (var reader = new StreamReader(DiyHttpContext.Current.Request.Body))
                {
                    var body = await reader.ReadToEndAsync();
                    if (!body.DosIsNullOrWhiteSpace())
                    {
                        XDocument xmlDoc = XDocument.Parse(body);
                        if (xmlDoc.Root != null)
                            XmlToJObject(xmlDoc.Root, param);
                    }
                }
            }
            catch (Exception ex) { }
            //调用方式 Server、Client
            param["_InvokeType"] = InvokeType.Client.ToString();
            return param;
        }

        private static void XmlToJObject(XElement element, JObject param)
        {
            foreach (var node in element.Nodes())
            {
                if (node is XElement e)
                {
                    if (e.HasElements)
                    {
                        XmlToJObject(e, param);
                    }
                    else
                    {
                        param[e.Name.LocalName] = e.Value;
                    }
                }
                else if (node is XText text)
                {
                    param[element.Name.LocalName] = text.Value;
                }
            }
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

        [HttpGet, HttpPost, HttpDelete, HttpPut, HttpPatch]
        [AllowAnonymous]
        public IActionResult StopHttp()
        {
            // //设置CORS响应头
            // Response.Headers.Add("Access-Control-Allow-Origin", "*");
            // Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            // Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization");
            // 返回空响应或204状态码
            return Json(new DosResult(0, "此接口已禁止http调用！"));
        }
        [HttpGet, HttpPost, HttpDelete, HttpPut, HttpPatch]
        [AllowAnonymous]
        public IActionResult NotEnable()
        {
            // //设置CORS响应头
            // Response.Headers.Add("Access-Control-Allow-Origin", "*");
            // Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            // Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization");
            // 返回空响应或204状态码
            return Json(new DosResult(0, "此接口已停用！"));
        }

        /// <summary>
        /// Content-Type:application/json
        /// </summary>
        /// <param name="param"></param>
        ///// <returns></returns>
        [HttpGet, HttpPost, HttpDelete, HttpPut, HttpPatch]
        [Consumes("application/json", "multipart/form-data")]
        [AllowAnonymous]
        public async Task<IActionResult> Run([FromBody] JObject param)
        {
            await DefaultParam(param);
            var apiPath = HttpContext.Request.Path.Value;
            // 正则表达式模
            string osClientPattern = @"--OsClient--(.*?)--$";
            Match osClientMatch = Regex.Match(apiPath ?? "", osClientPattern);
            var osClient = "";
            if (osClientMatch.Success)
            {
                osClient = osClientMatch.Groups[1].Value;
            }
            apiPath = Regex.Replace(apiPath ?? "", osClientPattern, "");
            param["ApiAddress"] = apiPath;
            dynamic? result = await MicroiEngine.ApiEngine.RunAsync(param);
            try
            {
                //#region 接口引擎接收文件，将文件流转为byte[]，再转为string
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
                //#endregion 接口引擎接收文件，将文件流转为byte[]，再转为string
            }
            catch
            {
            }

            if (result != null && result?.GetType() == typeof(string))
            {
                return Content(result, "text/plain; charset=utf-8");
            }
            return Json(result);
        }

        /// <summary>
        ///
        /// </summary>
        /// <param name="apiEngineParam"></param>
        /// <returns></returns>
        [HttpGet, HttpPost, HttpDelete, HttpPut, HttpPatch]
        // [Consumes("application/json", "multipart/form-data")]//加上这个会导致415错误
        [AllowAnonymous]
        public async Task<IActionResult> Run_FormData(ApiEngineParam apiEngineParam)
        {
            var param = JObject.FromObject(apiEngineParam);
            await DefaultParam(param);

            var apiPath = HttpContext.Request.Path.Value;
            // 正则表达式模
            string osClientPattern = @"--OsClient--(.*?)--$";
            Match osClientMatch = Regex.Match(apiPath ?? "", osClientPattern);
            var osClient = "";
            if (osClientMatch.Success)
            {
                osClient = osClientMatch.Groups[1].Value;
            }
            apiPath = Regex.Replace(apiPath ?? "", osClientPattern, "");

            param["ApiAddress"] = apiPath;
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

            #endregion 接口引擎接收文件，将文件流转为byte[]，再转为string

            var result = await MicroiEngine.ApiEngine.RunAsync(param);

            if (result != null && result.GetType().Name == "String")
            {
                return Content((string)result);
            }
            return Json(result);
        }

        /// <summary>
        ///
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost, HttpDelete, HttpPut, HttpPatch]
        //[Consumes("application/json", "multipart/form-data")]//get请求无法增加这个
        [AllowAnonymous]
        public async Task<IActionResult> Run_Request_Get()
        {
            JObject param = new JObject();
            await DefaultParam(param);

            var apiPath = HttpContext.Request.Path.Value;
            // 正则表达式模
            string osClientPattern = @"--OsClient--(.*?)--$";
            Match osClientMatch = Regex.Match(apiPath ?? "", osClientPattern);
            var osClient = "";
            if (osClientMatch.Success)
            {
                osClient = osClientMatch.Groups[1].Value;
            }
            apiPath = Regex.Replace(apiPath ?? "", osClientPattern, "");

            param["ApiAddress"] = apiPath;

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

            #endregion 接口引擎接收文件，将文件流转为byte[]，再转为string

            var result = await MicroiEngine.ApiEngine.RunAsync(param);
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
            }

            if (result != null && result.GetType().Name == "String")
            {
                return Content((string)result);
            }
            return Json(result);
        }

        /// <summary>
        ///
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet, HttpDelete, HttpPut, HttpPatch]
        [AllowAnonymous]
        public async Task<ActionResult> Run_Response_File()
        {
            JObject param = new JObject();
            await DefaultParam(param);

            var apiPath = HttpContext.Request.Path.Value;
            // 正则表达式模
            string osClientPattern = @"--OsClient--(.*?)--$";
            Match osClientMatch = Regex.Match(apiPath ?? "", osClientPattern);
            var osClient = "";
            if (osClientMatch.Success)
            {
                osClient = osClientMatch.Groups[1].Value;
            }
            apiPath = Regex.Replace(apiPath ?? "", osClientPattern, "");

            param["ApiAddress"] = apiPath;

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

            #endregion 接口引擎接收文件，将文件流转为byte[]，再转为string

            var result = await MicroiEngine.ApiEngine.RunAsync(param);
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
                return new ContentResult()
                {
                    Content = JsonConvert.SerializeObject(new
                    {
                        Code = 0,
                        Msg = "FileName、ContentType、FileByteBase64均不能为空！"
                    })
                };
            }
            return File(Convert.FromBase64String(fileByteBase64), contentType, fileName);
        }

        [HttpPost, HttpGet, HttpDelete, HttpPut, HttpPatch]
        [AllowAnonymous]
        public async Task<ActionResult> Run_Response_Html()
        {
            JObject param = new JObject();
            await DefaultParam(param);

            var apiPath = HttpContext.Request.Path.Value;
            // 正则表达式模
            string osClientPattern = @"--OsClient--(.*?)--$";
            Match osClientMatch = Regex.Match(apiPath ?? "", osClientPattern);
            var osClient = "";
            if (osClientMatch.Success)
            {
                osClient = osClientMatch.Groups[1].Value;
            }
            apiPath = Regex.Replace(apiPath ?? "", osClientPattern, "");

            param["ApiAddress"] = apiPath;

            var result = await MicroiEngine.ApiEngine.RunAsync(param);
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
            }
            if (result != null && result.GetType().Name == "String")
            {
                return Content((string)result, "text/html");
            }
            return Json(result);
        }
    }
}