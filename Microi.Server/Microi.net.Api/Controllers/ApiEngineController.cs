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
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            param["_CurrentUser"] = JTokenEx.FromObject(currentTokenDynamic.CurrentUser);
            param["OsClient"] = currentTokenDynamic.OsClient;
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
                // 启用 Request.Body 缓冲以支持重复读取
                DiyHttpContext.Current.Request.EnableBuffering();
                DiyHttpContext.Current.Request.Body.Position = 0;
                
                using (var reader = new StreamReader(DiyHttpContext.Current.Request.Body, leaveOpen: true))
                {
                    var body = await reader.ReadToEndAsync();
                    // 重置位置以便后续可能的读取
                    DiyHttpContext.Current.Request.Body.Position = 0;
                    
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

        private static ContentResult ResponseFileError(string msg, object? data = null)
        {
            return new ContentResult()
            {
                Content = JsonHelper.Serialize(new { Code = 0, Msg = msg, Data = data }),
                ContentType = "application/json; charset=utf-8"
            };
        }

        private static bool StartsWithBytes(byte[] bytes, params byte[] prefix)
        {
            if (bytes.Length < prefix.Length)
            {
                return false;
            }
            for (var i = 0; i < prefix.Length; i++)
            {
                if (bytes[i] != prefix[i])
                {
                    return false;
                }
            }
            return true;
        }

        private static string BytesToHexPrefix(byte[] bytes, int maxLength = 16)
        {
            var length = Math.Min(bytes.Length, maxLength);
            var result = new string[length];
            for (var i = 0; i < length; i++)
            {
                result[i] = bytes[i].ToString("X2");
            }
            return string.Join(" ", result);
        }

        private static string BytesToAsciiPrefix(byte[] bytes, int maxLength = 16)
        {
            var length = Math.Min(bytes.Length, maxLength);
            var result = new char[length];
            for (var i = 0; i < length; i++)
            {
                result[i] = bytes[i] >= 32 && bytes[i] <= 126 ? (char)bytes[i] : '.';
            }
            return new string(result);
        }

        private static bool IsWebp(byte[] bytes)
        {
            return bytes.Length >= 12
                && bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46
                && bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50;
        }

        private static bool IsAvif(byte[] bytes)
        {
            return bytes.Length >= 12
                && bytes[4] == 0x66 && bytes[5] == 0x74 && bytes[6] == 0x79 && bytes[7] == 0x70
                && bytes[8] == 0x61 && bytes[9] == 0x76 && bytes[10] == 0x69
                && (bytes[11] == 0x66 || bytes[11] == 0x73);
        }

        private static bool IsSvg(byte[] bytes)
        {
            var text = BytesToAsciiPrefix(bytes, Math.Min(bytes.Length, 256)).TrimStart('.', ' ', '\t', '\r', '\n');
            return text.StartsWith("<svg", StringComparison.OrdinalIgnoreCase)
                || text.StartsWith("<?xml", StringComparison.OrdinalIgnoreCase);
        }

        private static int IndexOfBytes(byte[] bytes, params byte[] marker)
        {
            if (bytes.Length < marker.Length)
            {
                return -1;
            }
            for (var i = 0; i <= bytes.Length - marker.Length; i++)
            {
                var matched = true;
                for (var j = 0; j < marker.Length; j++)
                {
                    if (bytes[i + j] != marker[j])
                    {
                        matched = false;
                        break;
                    }
                }
                if (matched)
                {
                    return i;
                }
            }
            return -1;
        }

        private static byte[] NormalizeResponseFileBytes(string contentType, byte[] fileBytes)
        {
            var normalizedContentType = contentType.Split(';')[0].Trim().ToLowerInvariant();
            if (normalizedContentType != "application/pdf" || StartsWithBytes(fileBytes, 0x25, 0x50, 0x44, 0x46, 0x2D))
            {
                return fileBytes;
            }

            var pdfOffset = IndexOfBytes(fileBytes, 0x25, 0x50, 0x44, 0x46, 0x2D);
            if (pdfOffset <= 0)
            {
                return fileBytes;
            }

            var pdfBytes = new byte[fileBytes.Length - pdfOffset];
            Buffer.BlockCopy(fileBytes, pdfOffset, pdfBytes, 0, pdfBytes.Length);
            return pdfBytes;
        }

        private static ContentResult? ValidateResponseFileBytes(string contentType, byte[] fileBytes)
        {
            if (fileBytes.Length == 0)
            {
                return ResponseFileError("FileByteBase64不能为空文件！");
            }

            var normalizedContentType = contentType.Split(';')[0].Trim().ToLowerInvariant();
            string? expectedFirstAscii = null;
            var isValid = true;

            switch (normalizedContentType)
            {
                case "application/pdf":
                    expectedFirstAscii = "%PDF-";
                    isValid = StartsWithBytes(fileBytes, 0x25, 0x50, 0x44, 0x46, 0x2D);
                    break;
                case "image/png":
                    expectedFirstAscii = "PNG";
                    isValid = StartsWithBytes(fileBytes, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);
                    break;
                case "image/jpeg":
                case "image/jpg":
                    expectedFirstAscii = "JPEG";
                    isValid = StartsWithBytes(fileBytes, 0xFF, 0xD8, 0xFF);
                    break;
                case "image/gif":
                    expectedFirstAscii = "GIF8";
                    isValid = StartsWithBytes(fileBytes, 0x47, 0x49, 0x46, 0x38);
                    break;
                case "image/webp":
                    expectedFirstAscii = "RIFF....WEBP";
                    isValid = IsWebp(fileBytes);
                    break;
                case "image/avif":
                    expectedFirstAscii = "....ftypavif/avis";
                    isValid = IsAvif(fileBytes);
                    break;
                case "image/bmp":
                    expectedFirstAscii = "BM";
                    isValid = StartsWithBytes(fileBytes, 0x42, 0x4D);
                    break;
                case "image/tiff":
                    expectedFirstAscii = "II* or MM*";
                    isValid = StartsWithBytes(fileBytes, 0x49, 0x49, 0x2A, 0x00)
                        || StartsWithBytes(fileBytes, 0x4D, 0x4D, 0x00, 0x2A);
                    break;
                case "image/x-icon":
                case "image/vnd.microsoft.icon":
                    expectedFirstAscii = "ICO";
                    isValid = StartsWithBytes(fileBytes, 0x00, 0x00, 0x01, 0x00);
                    break;
                case "image/svg+xml":
                    expectedFirstAscii = "<svg or <?xml";
                    isValid = IsSvg(fileBytes);
                    break;
            }

            if (!isValid)
            {
                var errorMsg = "响应文件内容与ContentType不匹配，浏览器无法正常预览或下载。";
                if (normalizedContentType == "application/pdf"
                    && StartsWithBytes(fileBytes, 0x4B, 0x44, 0x5F, 0x43, 0x5F, 0x50, 0x4C, 0x4D))
                {
                    errorMsg = "金蝶PLM电子仓返回的是KD_C_PLM封装流，不是真实PDF字节；请返回以%PDF-开头的PDF文件或先完成金蝶预览文件转换。";
                }
                return ResponseFileError(errorMsg, new
                {
                    ContentType = contentType,
                    ExpectedFirstAscii = expectedFirstAscii,
                    ActualFirstAscii = BytesToAsciiPrefix(fileBytes),
                    ActualFirstHex = BytesToHexPrefix(fileBytes),
                    fileBytes.Length
                });
            }
            return null;
        }

        private static bool ShouldOpenResponseFileInline(string contentType)
        {
            var normalizedContentType = contentType.Split(';')[0].Trim();
            return normalizedContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalizedContentType, "application/pdf", StringComparison.OrdinalIgnoreCase);
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
                    param["_FilesByteBase64"] = JsonHelper.Serialize(files);
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
                param["_FilesByteBase64"] = JsonHelper.Serialize(files);
                //param._FilesByteBase64 = files;
            }

            #endregion 接口引擎接收文件，将文件流转为byte[]，再转为string

            var result = await MicroiEngine.ApiEngine.RunAsync(param);

            if (result != null && result.GetType().Name == "String")
            {
                return Content((string)result, "text/plain; charset=utf-8");
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
            //    param["_FilesByteBase64"] = JsonHelper.Serialize(files);
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
                    if (!CommonHelper.IsUrlSafe(redirectUrl))
                    {
                        return BadRequest(new { Code = 0, Msg = "URL验证失败：不允许的URL格式" });
                    }
                    return Redirect(redirectUrl);
                }
            }
            catch (Exception ex)
            {
            }

            if (result != null && result.GetType().Name == "String")
            {
                return Content((string)result, "text/plain; charset=utf-8");
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
            //    param["_FilesByteBase64"] = JsonHelper.Serialize(files);
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
                    if (!CommonHelper.IsUrlSafe(redirectUrl))
                    {
                        return BadRequest(new { Code = 0, Msg = "URL验证失败：不允许的URL格式" });
                    }
                    return Redirect(redirectUrl);
                }
            }
            catch (Exception ex)
            {
            }
            //dynamic 转 DosResult
            JObject resultObj = JObject.FromObject(result);
            if (resultObj["Code"].Val<int>() != 1)
            {
                return new ContentResult() { Content = resultObj.ToString(), ContentType = "application/json; charset=utf-8" };
            }
            var resultDataObj = resultObj["Data"] as JObject;
            if (resultDataObj == null)
            {
                return new ContentResult() { Content = resultObj.ToString(), ContentType = "application/json; charset=utf-8" };
            }
            //返回文件：Data是一个对象：{ FileName: '(包含后缀格式)', ContentType: '(如：application/vnd.ms-excel)', FileByteBase64: '(byte[])' }
            var fileName = resultDataObj["FileName"].Val<string>();
            var contentType = resultDataObj["ContentType"].Val<string>();
            var fileByteBase64 = resultDataObj["FileByteBase64"].Val<string>();
            if (fileName.DosIsNullOrWhiteSpace() && contentType.DosIsNullOrWhiteSpace() && fileByteBase64.DosIsNullOrWhiteSpace())
            {
                return new ContentResult() { Content = resultObj.ToString(), ContentType = "application/json; charset=utf-8" };
            }
            if (fileName.DosIsNullOrWhiteSpace() || contentType.DosIsNullOrWhiteSpace() || fileByteBase64.DosIsNullOrWhiteSpace())
            {
                return new ContentResult()
                {
                    Content = JsonHelper.Serialize(new
                    {
                        Code = 0,
                        Msg = "FileName、ContentType、FileByteBase64均不能为空！"
                    }),
                    ContentType = "application/json; charset=utf-8"
                };
            }
            byte[] fileBytes;
            try
            {
                fileBytes = Convert.FromBase64String(fileByteBase64);
            }
            catch
            {
                return ResponseFileError("FileByteBase64不是合法的Base64字符串！");
            }
            fileBytes = NormalizeResponseFileBytes(contentType, fileBytes);
            var validateResult = ValidateResponseFileBytes(contentType, fileBytes);
            if (validateResult != null)
            {
                return validateResult;
            }
            var isInline = ShouldOpenResponseFileInline(contentType);
            if (isInline)
            {
                Response.Headers["Content-Disposition"] = $"inline; filename*=UTF-8''{Uri.EscapeDataString(fileName)}";
                return File(fileBytes, contentType);
            }
            return File(fileBytes, contentType, fileName);
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
                    if (!CommonHelper.IsUrlSafe(redirectUrl))
                    {
                        return BadRequest(new { Code = 0, Msg = "URL验证失败：不允许的URL格式" });
                    }
                    return Redirect(redirectUrl);
                }
            }
            catch (Exception ex)
            {
            }
            if (result != null && result.GetType().Name == "String")
            {
                return Content((string)result, "text/html; charset=utf-8");
            }
            return Json(result);
        }
    }
}