using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
using StackExchange.Redis;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Security;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Microi.net.Api
{
    /// <summary>
    /// 文件上传。支持公有/私有，单文件/多文件，阿里云OSS/MinIO
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public partial class HDFSController : Controller
    {
        /// <summary>
        /// 兼容旧版百度 UEditor 的 /UEditor/Upload 地址。文件处理仍归 HDFS 插件，
        /// 此处只负责把历史 multipart 协议收口到保留的 HDFS Controller。
        /// </summary>
        [HttpGet("~/UEditor/Upload")]
        [HttpPost("~/UEditor/Upload")]
        [HttpGet("~/UEditor/UploadAsync")]
        [HttpPost("~/UEditor/UploadAsync")]
        [ApiExplorerSettings(IgnoreApi = true)]
        public async Task<ContentResult> LegacyUEditorUpload(string Path)
        {
            var currentToken = await DiyToken.GetCurrentToken();
            Path = TenantConfigurationSecurity.NormalizeTenantId(
                Convert.ToString(currentToken.OsClient));

            // 观测只读取 ASP.NET Core 已缓存的 multipart 元数据；异常不会改变旧上传语义。
            if (HttpContext.Request.HasFormContentType)
            {
                try
                {
                    var form = await HttpContext.Request.ReadFormAsync();
                    var files = form.Files.Where(file => file != null).ToList();
                    if (files.Count > 0)
                    {
                        NetworkTrafficObservabilityService.AnnotateTransfer(
                            HttpContext,
                            "Upload",
                            files.Count,
                            files.Sum(file => Math.Max(0L, file.Length)),
                            files.Select(file => file.FileName),
                            files.Select(file => System.IO.Path.GetExtension(file.FileName)));
                    }
                }
                catch
                {
                    // 观测是旁路；格式错误继续交由 UEditor/HDFS 原实现返回。
                }
            }

            var service = HttpContext.RequestServices.GetRequiredService<UEditorService>();
            var response = await service.UploadAndGetResponseAsync(HttpContext, Path);
            return Content(response.Result, response.ContentType);
        }

        private async Task<DosResult> DefaultParam(DiyUploadParam param)
        {
            CurrentToken currentTokenDynamic;
            try
            {
                currentTokenDynamic = await DiyToken.GetCurrentToken();
            }
            catch
            {
                return new DosResult(1001, null, "登录身份无效，请重新登录！");
            }
            string tokenOsClient = currentTokenDynamic == null
                ? ""
                : Convert.ToString(currentTokenDynamic.OsClient);
            if (currentTokenDynamic == null
                || currentTokenDynamic.CurrentUser == null
                || tokenOsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(1001, null, "登录身份已过期，请重新登录！");
            }

            if (!TryResolveRequestedOsClient(param, out var requestedOsClient, out var resolveError))
            {
                return resolveError;
            }

            var authenticatedOsClient = tokenOsClient.Trim();
            if (!requestedOsClient.DosIsNullOrWhiteSpace()
                && !string.Equals(requestedOsClient, authenticatedOsClient, StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(0, null, "请求租户与当前登录租户不一致！");
            }

            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = authenticatedOsClient;
            param._InvokeType = InvokeType.Client.ToString();
            param._ClientType = DiyToken
                .GetActiveCachedTokenEntry(currentTokenDynamic, currentTokenDynamic.Token)
                ?.ClientType;
            return null;
        }

        private static bool IsPlatformAdmin(DiyUploadParam param)
        {
            return param?._CurrentUser?["Level"].Val<int>() >= DiyCommon.MaxRoleLevel;
        }

        private static DosResult RequirePlatformAdmin(DiyUploadParam param)
        {
            if (UserAccessKeySecurity.IsSession(param?._CurrentUser))
            {
                return new DosResult(0, null, "访问密钥会话不能使用文件管理接口！");
            }
            return IsPlatformAdmin(param)
                ? null
                : new DosResult(0, null, "仅平台超级管理员可以使用文件管理接口！");
        }

        private bool TryResolveRequestedOsClient(DiyUploadParam param, out string osClient, out DosResult error)
        {
            osClient = "";
            error = null;
            var values = new List<string>();
            AddRequestedOsClient(values, param?.OsClient);
            AddRequestedOsClient(values, Request.Query["OsClient"].ToString());
            AddRequestedOsClient(values, Request.Headers["OsClient"].ToString());
            AddRequestedOsClient(values, Request.Headers["osclient"].ToString());
            try
            {
                if (Request.HasFormContentType)
                {
                    AddRequestedOsClient(values, Request.Form["OsClient"].ToString());
                }
            }
            catch (InvalidOperationException) { }

            var distinctValues = values.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (distinctValues.Count > 1)
            {
                error = new DosResult(0, null, "请求中存在互相冲突的OsClient参数！");
                return false;
            }
            if (distinctValues.Count == 0) return true;

            try
            {
                osClient = TenantConfigurationSecurity.NormalizeTenantId(distinctValues[0]);
                return true;
            }
            catch (Exception ex)
            {
                error = new DosResult(0, null, "OsClient不合法：" + ex.Message);
                return false;
            }
        }

        private static void AddRequestedOsClient(ICollection<string> values, string value)
        {
            if (!value.DosIsNullOrWhiteSpace()) values.Add(value.Trim());
        }

        private bool TryValidateAuthenticatedOsClient(JObject body, string authenticatedOsClient, out DosResult error)
        {
            error = null;
            if (authenticatedOsClient.DosIsNullOrWhiteSpace())
            {
                error = new DosResult(1001, null, "登录身份已过期，请重新登录！");
                return false;
            }
            try
            {
                authenticatedOsClient = TenantConfigurationSecurity.NormalizeTenantId(authenticatedOsClient);
            }
            catch
            {
                error = new DosResult(1001, null, "登录身份中的租户信息无效，请重新登录！");
                return false;
            }
            var requestParam = new DiyUploadParam { OsClient = TokenString(body?["OsClient"]) };
            if (!TryResolveRequestedOsClient(requestParam, out var requestedOsClient, out error)) return false;
            if (!requestedOsClient.DosIsNullOrWhiteSpace()
                && !string.Equals(requestedOsClient, authenticatedOsClient, StringComparison.OrdinalIgnoreCase))
            {
                error = new DosResult(0, null, "请求租户与当前登录租户不一致！");
                return false;
            }
            return true;
        }

        private static DosResult NormalizeFilePaths(DiyUploadParam param, bool allowEmpty = false)
        {
            try
            {
                var hasSinglePath = !param.FilePathName.DosIsNullOrWhiteSpace();
                var hasMultiplePaths = param.FilePathNames != null && param.FilePathNames.Count > 0;
                if (hasSinglePath)
                {
                    param.FilePathName = TenantConfigurationSecurity.NormalizeStoragePath(
                        param.OsClient, param.FilePathName);
                }
                if (hasMultiplePaths)
                {
                    param.FilePathNames = param.FilePathNames
                        .Select(path => TenantConfigurationSecurity.NormalizeStoragePath(param.OsClient, path))
                        .ToList();
                }
                if (!hasSinglePath && !hasMultiplePaths && !allowEmpty)
                {
                    return new DosResult(0, null, "文件路径不能为空！");
                }
                return null;
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "文件路径不合法：" + ex.Message);
            }
        }

        private static DosResult NormalizeObjectPath(DiyUploadParam param, bool allowEmpty = false)
        {
            try
            {
                param.Path = TenantConfigurationSecurity.NormalizeStoragePath(
                    param.OsClient, param.Path, allowEmpty);
                return null;
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "文件路径不合法：" + ex.Message);
            }
        }

        private static DosResult NormalizeUploadPath(DiyUploadParam param)
        {
            try
            {
                param.Path = TenantConfigurationSecurity.NormalizeUploadSubPath(param.OsClient, param.Path);
                return null;
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "上传目录不合法：" + ex.Message);
            }
        }

        private string ResolveRequestToken()
        {
            var token = Request.Headers["Token"].ToString();
            if (token.DosIsNullOrWhiteSpace()) token = Request.Headers["Authorization"].ToString();
            try
            {
                if (token.DosIsNullOrWhiteSpace() && Request.HasFormContentType)
                {
                    token = Request.Form["Token"].ToString();
                }
                if (token.DosIsNullOrWhiteSpace() && Request.HasFormContentType)
                {
                    token = Request.Form["authorization"].ToString();
                }
            }
            catch (InvalidOperationException) { }
            return token.DosTrim().DosReplace("Bearer ", "");
        }

        private string ResolveFilePathName(DiyUploadParam param)
        {
            var filePathName = param.FilePathName;
            if (filePathName.DosIsNullOrWhiteSpace()) filePathName = Request.Query["FilePathName"].ToString();
            try
            {
                if (filePathName.DosIsNullOrWhiteSpace() && Request.HasFormContentType)
                {
                    filePathName = Request.Form["FilePathName"].ToString();
                }
            }
            catch (InvalidOperationException) { }
            return filePathName;
        }

        private string ResolveUploadPath(DiyUploadParam param)
        {
            var path = param.Path;
            if (path.DosIsNullOrWhiteSpace()) path = Request.Query["Path"].ToString();
            try
            {
                if (path.DosIsNullOrWhiteSpace() && Request.HasFormContentType)
                {
                    path = Request.Form["Path"].ToString();
                }
            }
            catch (InvalidOperationException) { }
            return path;
        }

        private async Task<JObject?> GetClientUserFromToken(string osClient)
        {
            var token = ResolveRequestToken();
            if (osClient.DosIsNullOrWhiteSpace() || token.DosIsNullOrWhiteSpace()) return null;

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var cacheKeys = new[]
            {
                $"Microi:{osClient}:ClientUserToken:{token}",
                $"Microi:{osClient}:MobileMemberToken:{token}",
                $"Microi:{osClient}:MallMemberToken:{token}"
            };

            foreach (var cacheKey in cacheKeys)
            {
                var cached = await cache.GetAsync(cacheKey);
                if (cached == null) continue;

                try
                {
                    return JObject.Parse(cached.ToString());
                }
                catch
                {
                    try
                    {
                        return await cache.GetAsync<JObject>(cacheKey);
                    }
                    catch
                    {
                        continue;
                    }
                }
            }

            return null;
        }

        private DosResult LoadFormFiles(DiyUploadParam param)
        {
            param.Files = new Dictionary<string, Stream>(StringComparer.OrdinalIgnoreCase);
            param.OriginalFiles = new Dictionary<string, Stream>(StringComparer.OrdinalIgnoreCase);
            if (HttpContext.Request.HasFormContentType)
            {
                long declaredBytes = 0;
                var observedFileNames = new List<string>();
                var observedExtensions = new List<string>();
                foreach (var file in HttpContext.Request.Form.Files)
                {
                    if (file == null) continue;
                    declaredBytes += Math.Max(0, file.Length);
                    observedFileNames.Add(file.FileName);
                    observedExtensions.Add(Path.GetExtension(file.FileName));
                    var isOriginal = string.Equals(
                        file.Name,
                        "MicroiOriginalFile",
                        StringComparison.OrdinalIgnoreCase);
                    if (isOriginal && param.CropEnabled != true)
                    {
                        return new DosResult(0, null, "未开启裁剪协议时不允许提交裁剪原图！");
                    }

                    var target = isOriginal ? param.OriginalFiles : param.Files;
                    if (target.ContainsKey(file.FileName))
                    {
                        return new DosResult(0, null, "同一次上传中存在重复文件名：" + file.FileName);
                    }
                    target.Add(file.FileName, file.OpenReadStream());
                }
                NetworkTrafficObservabilityService.AnnotateTransfer(
                    HttpContext,
                    "Upload",
                    HttpContext.Request.Form.Files.Count,
                    declaredBytes,
                    observedFileNames,
                    observedExtensions);
            }
            return null;
        }

        private async Task LoadJsonBody(DiyUploadParam param)
        {
            if (Request.HasFormContentType || Request.ContentType?.Contains("application/json") != true)
            {
                return;
            }

            Request.EnableBuffering();
            Request.Body.Position = 0;
            using var reader = new StreamReader(Request.Body, leaveOpen: true);
            var body = await reader.ReadToEndAsync();
            Request.Body.Position = 0;
            if (body.DosIsNullOrWhiteSpace()) return;

            JObject json;
            try
            {
                json = JObject.Parse(body);
            }
            catch
            {
                return;
            }
            if (param.OsClient.DosIsNullOrWhiteSpace()) param.OsClient = json["OsClient"]?.Val<string>();
            if (param.FilePathName.DosIsNullOrWhiteSpace()) param.FilePathName = json["FilePathName"]?.Val<string>();
            if ((param.FilePathNames == null || param.FilePathNames.Count == 0) && json["FilePathNames"] is JArray filePaths)
            {
                param.FilePathNames = filePaths.Select(item => item.Val<string>()).ToList();
            }
            if (param.Path.DosIsNullOrWhiteSpace()) param.Path = json["Path"]?.Val<string>();
            if (param.Limit == null && json["Limit"] != null) param.Limit = json["Limit"]?.Val<bool>();
            if (param.Preview == null && json["Preview"] != null) param.Preview = json["Preview"]?.Val<bool>();
            if (param.ForOfficePreview == null && json["ForOfficePreview"] != null) param.ForOfficePreview = json["ForOfficePreview"]?.Val<bool>();
            if (param.ReturnFileType.DosIsNullOrWhiteSpace()) param.ReturnFileType = json["ReturnFileType"]?.Val<string>();
            if (param.FormEngineKey.DosIsNullOrWhiteSpace()) param.FormEngineKey = json["FormEngineKey"]?.Val<string>();
            if (param.FormDataId.DosIsNullOrWhiteSpace()) param.FormDataId = json["FormDataId"]?.Val<string>();
            if (param.FieldId.DosIsNullOrWhiteSpace()) param.FieldId = json["FieldId"]?.Val<string>();
            if (param.SysMenuId.DosIsNullOrWhiteSpace()) param.SysMenuId = json["SysMenuId"]?.Val<string>();
            if (param.MenuId.DosIsNullOrWhiteSpace()) param.MenuId = json["MenuId"]?.Val<string>();
            if (param.ResourceKind.DosIsNullOrWhiteSpace()) param.ResourceKind = json["ResourceKind"]?.Val<string>();
            if (param.ResourceId.DosIsNullOrWhiteSpace()) param.ResourceId = json["ResourceId"]?.Val<string>();
            if (param._TableChildAuth == null)
            {
                param._TableChildAuth = ParseTableChildAuthorizationContext(
                    json["_TableChildAuth"] ?? json["TableChildAuth"]);
            }
        }

        private string ResolveRequestValue(string currentValue, string name)
        {
            if (!currentValue.DosIsNullOrWhiteSpace()) return currentValue;
            var value = Request.Query[name].ToString();
            try
            {
                if (value.DosIsNullOrWhiteSpace() && Request.HasFormContentType)
                {
                    value = Request.Form[name].ToString();
                }
            }
            catch (InvalidOperationException) { }
            return value;
        }

        private static TableChildAuthorizationContext ParseTableChildAuthorizationContext(JToken value)
        {
            if (value == null || value.Type == JTokenType.Null) return null;
            try
            {
                if (value.Type == JTokenType.String)
                {
                    var json = value.Val<string>();
                    if (json.DosIsNullOrWhiteSpace()) return null;
                    value = JToken.Parse(json);
                }
                return value.Type == JTokenType.Object
                    ? value.ToObject<TableChildAuthorizationContext>()
                    : null;
            }
            catch
            {
                return null;
            }
        }

        private TableChildAuthorizationContext ResolveRequestTableChildAuthorizationContext(
            TableChildAuthorizationContext currentValue)
        {
            if (currentValue != null) return currentValue;
            var value = Request.Query["_TableChildAuth"].ToString();
            if (value.DosIsNullOrWhiteSpace())
            {
                value = Request.Query["TableChildAuth"].ToString();
            }
            try
            {
                if (value.DosIsNullOrWhiteSpace() && Request.HasFormContentType)
                {
                    value = Request.Form["_TableChildAuth"].ToString();
                    if (value.DosIsNullOrWhiteSpace())
                    {
                        value = Request.Form["TableChildAuth"].ToString();
                    }
                }
            }
            catch (InvalidOperationException) { }
            return value.DosIsNullOrWhiteSpace()
                ? null
                : ParseTableChildAuthorizationContext(new JValue(value));
        }

        /// <summary>
        /// 普通用户读取私有文件必须同时证明：
        /// 1. 当前角色拥有传入菜单；2. 菜单绑定目标表；
        /// 3. 当前菜单上下文能够读取目标记录；4. 文件字段确实引用目标对象路径。
        /// 裸路径、Byte/Stream 和缺少上下文的旧调用一律失败关闭。
        /// </summary>
        private async Task<DosResult> AuthorizePrivateFileRead(DiyUploadParam param)
        {
            param.ReturnFileType = ResolveRequestValue(param.ReturnFileType, "ReturnFileType");
            param.FormEngineKey = ResolveRequestValue(param.FormEngineKey, "FormEngineKey");
            param.FormDataId = ResolveRequestValue(param.FormDataId, "FormDataId");
            param.FieldId = ResolveRequestValue(param.FieldId, "FieldId");
            param.SysMenuId = ResolveRequestValue(param.SysMenuId, "SysMenuId");
            param.MenuId = ResolveRequestValue(param.MenuId, "MenuId");
            param.ResourceKind = ResolveRequestValue(param.ResourceKind, "ResourceKind");
            param.ResourceId = ResolveRequestValue(param.ResourceId, "ResourceId");
            param._TableChildAuth = ResolveRequestTableChildAuthorizationContext(param._TableChildAuth);
            return await PrivateFileAccessAuthorization.AuthorizeAsync(param);
        }

        private async Task<JObject> ResolveDiyTableModelForFileAccess(string osClient, string formEngineKey)
        {
            var result = await MicroiEngine.FormEngine.GetDiyTable(formEngineKey, osClient);
            return result.Code == 1 ? ToJObject((object)result.Data) : null;
        }

        private static bool FieldValueReferencesPath(JToken fieldValue, string requestedPath)
        {
            return PrivateFileAccessAuthorization.AuthoritativeValueReferencesPath(
                fieldValue,
                requestedPath);
        }

        // 上传成功后为当前上传请求补充短期预览地址，业务字段仍只持久化 Path。
        /// <summary>
        /// 上传成功后为本次响应补充可立即预览的地址。该地址只作为短期能力返回给
        /// 当前上传请求，业务字段仍只保存 Path；后续读取继续走记录级权限校验。
        /// </summary>
        private async Task<DosResult> AttachUploadedFileUrls(DosResult result, DiyUploadParam param)
        {
            if (result?.Code != 1 || result.Data == null) return result;

            try
            {
                var dataToken = JToken.FromObject(result.Data);
                var rows = dataToken is JArray array
                    ? array.OfType<JObject>().ToList()
                    : dataToken is JObject row
                        ? new List<JObject> { row }
                        : new List<JObject>();

                foreach (var item in rows)
                {
                    var path = TokenString(item["Path"] ?? item["FilePathName"]);
                    if (path.DosIsNullOrWhiteSpace()) continue;

                    var urlResult = await MicroiEngine.HDFS.GetPrivateFileUrl(new DiyUploadParam
                    {
                        OsClient = param.OsClient,
                        FilePathName = path,
                        Limit = param.Limit,
                        _CurrentUser = param._CurrentUser,
                        _InvokeType = param._InvokeType
                    });
                    if (urlResult?.Code == 1 && urlResult.Data != null)
                    {
                        item["Url"] = Convert.ToString(urlResult.Data);
                    }
                    item["Limit"] = param.Limit != false;
                }

                result.Data = dataToken;
            }
            catch
            {
                // 文件已经上传成功时不因预览地址生成异常改变上传结果。
            }
            return result;
        }

        // 为私有上传结果生成微信可访问的短期地址，并统一提交小程序图片内容安全检测。
        private async Task<DosResult> ApplyWeChatContentSecurityAsync(DosResult result, DiyUploadParam param)
        {
            var response = await AttachUploadedFileUrls(result, param);
            var service = HttpContext.RequestServices.GetRequiredService<WeChatContentSecurityService>();
            return await service.SubmitUploadedImagesAsync(
                response,
                param,
                HttpContext.RequestAborted);
        }

        /// <summary>
        /// 上传文件、图片。返回/路径。支持单文件、多文件。
        /// Multiple：是否多文件
        /// Limit：是否上传至需要有权限才能访问的文件夹
        /// Preview：是否压缩
        /// </summary>
        /// <returns></returns>
        [Consumes("application/json", "multipart/form-data")]
        [HttpPost]
        // 仅兼容最早期移动端的 POST /api/Upload；实现仍只有这一份 HDFS 安全链路。
        [HttpPost("~/api/Upload")]
        [HttpPost("~/apiengine/platform-hdfs-upload")]
        public async Task<IActionResult> Upload(DiyUploadParam param)
        {
            var accessError = await DefaultParam(param);
            if (accessError != null) return Json(accessError);
            var pathError = NormalizeUploadPath(param);
            if (pathError != null) return Json(pathError);

            var fileError = LoadFormFiles(param);
            if (fileError != null) return Json(fileError);

            // multipart 对象不会可靠绑定嵌套 TableChild 上下文；统一按与私有文件读取
            // 相同的 JSON 字符串协议恢复，随后仍由 FormEngine 逐层回查授权关系。
            param._TableChildAuth = ResolveRequestTableChildAuthorizationContext(param._TableChildAuth);

            // 待审图片必须留在私有桶。ContentSecurityRequired 只能收紧存储范围，
            // 不能由客户端通过 Limit=false 把尚未审核的图片暴露到公有桶。
            if (RequiresWeChatContentSecurity(param)) param.Limit = true;
            return await DispatchUploadAsync(param);
        }
        /// <summary>
        /// Uniapp上传，移除Consumes。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        [AllowAnonymous]
        public async Task<IActionResult> UniappUpload(DiyUploadParam param)
        {
            var currentToken = await DiyToken.GetCurrentToken();
            if (currentToken?.CurrentUser != null)
            {
                return await Upload(param);
            }

            if (!TryResolveRequestedOsClient(param, out var osClient, out var osClientError))
            {
                return Json(osClientError);
            }
            var clientUser = await GetClientUserFromToken(osClient);
            if (clientUser == null)
            {
                return Json(new DosResult(1001, null, "登录身份已过期！"));
            }

            param.Path = ResolveUploadPath(param);
            param.OsClient = osClient;
            var pathError = NormalizeUploadPath(param);
            if (pathError != null)
            {
                return Json(pathError);
            }

            param._CurrentUser = clientUser;
            param._InvokeType = InvokeType.Client.ToString();
            param.Limit ??= true;
            param.Preview ??= true;
            var fileError = LoadFormFiles(param);
            if (fileError != null) return Json(fileError);

            param._TableChildAuth = ResolveRequestTableChildAuthorizationContext(param._TableChildAuth);

            if (RequiresWeChatContentSecurity(param)) param.Limit = true;
            var result = await MicroiEngine.HDFS.Upload(param);
            // UniApp 小程序图片同样统一提交检测，避免其它上传场景绕过安全校验。
            return Json(await ApplyWeChatContentSecurityAsync(result, param));
        }

        private static bool RequiresWeChatContentSecurity(DiyUploadParam param)
        {
            return param?.ContentSecurityRequired == true
                   || string.Equals(param?._ClientType, "WxMiniProgram", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// 匿名上传。比如用于未登录时用户注册上传头像。此接口作废，建议在接口引擎中实现，考虑更多的安全性。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        // [Consumes("application/json", "multipart/form-data")]
        // [HttpPost]
        // [AllowAnonymous]
        // public async Task<JsonResult> UploadAnonymous(DiyUploadParam param)
        // {
        //     await DefaultParam(param);

        //     #region 测试手动传入文件流，也可以不用这样
        //     param.Files = new Dictionary<string, Stream>();
        //     if(HttpContext.Request.HasFormContentType){
        //         foreach (var file in HttpContext.Request.Form.Files)
        //         {
        //             if (file != null)
        //                 param.Files.Add(file.FileName, file.OpenReadStream());
        //         }
        //     }
        //     #endregion

        //     //HttpContext为可选参数，在Controller层调用DiyCommon.Upload可以不用传入HttpContext，内部可以自动获取，也可以直接传入文件流。
        //     //var result = await DiyCommon.Upload(param);//, HttpContext
        //     var result = await new MicroiHDFS().Upload(param);//, HttpContext
        //     return Json(result);
        // }

        [HttpPost]
        public async Task<JsonResult> GetOfficeFileMeta([FromBody] JObject param)
        {
            if (param == null)
            {
                return Json(new DosResult(0, null, "请求参数不能为空！"));
            }
            var currentToken = await DiyToken.GetCurrentToken();
            if (currentToken?.CurrentUser == null)
            {
                return Json(new DosResult(1001, null, "登录身份已过期！"));
            }

            var osClient = currentToken.OsClient?.ToString();
            if (!TryValidateAuthenticatedOsClient(param, osClient, out var osClientError))
            {
                return Json(osClientError);
            }
            var filePathName = TokenString(param["FilePathName"]);
            if (filePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }
            try
            {
                filePathName = TenantConfigurationSecurity.NormalizeStoragePath(osClient, filePathName);
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, "文件路径不合法：" + ex.Message));
            }
            param["FilePathName"] = filePathName;
            var currentUser = ToJObject(currentToken.CurrentUser);
            var authorizationError = await AuthorizeOfficeFileAccess(
                param,
                osClient,
                currentUser,
                "Read");
            if (authorizationError != null) return Json(authorizationError);

            var context = await ResolveOfficeFileContext(param, osClient, currentUser);
            if (context.Error != null) return Json(context.Error);
            if (!IsOfficePreviewEnabled(context.FieldModel))
            {
                return Json(new DosResult(0, null, "该文件字段未开启Office在线预览！"));
            }

            var fileMeta = FindOfficeFileMeta(context.FieldValue, filePathName);
            if (fileMeta == null)
            {
                return Json(new DosResult(0, null, "业务记录的文件字段未引用所请求的Office文件！"));
            }
            return Json(new DosResult(1, new
            {
                context.TableName,
                context.FieldName,
                FileMeta = fileMeta,
                EnableVersion = IsOfficeVersionEnabled(context.FieldModel)
            }));
        }

        [HttpPost]
        public async Task<JsonResult> SaveOfficeDocument([FromBody] JObject param)
        {
            if (param == null)
            {
                return Json(new DosResult(0, null, "请求参数不能为空！"));
            }
            var currentToken = await DiyToken.GetCurrentToken();
            if (currentToken?.CurrentUser == null)
            {
                return Json(new DosResult(1001, null, "登录身份已过期！"));
            }

            var osClient = currentToken.OsClient?.ToString();
            if (!TryValidateAuthenticatedOsClient(param, osClient, out var osClientError))
            {
                return Json(osClientError);
            }
            var downloadUrl = TokenString(param["DownloadUrl"]);
            var sourceFilePath = TokenString(param["FilePathName"]);
            var currentUser = ToJObject(currentToken.CurrentUser);

            if (downloadUrl.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "DownloadUrl不能为空！"));
            }
            if (sourceFilePath.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }
            try
            {
                sourceFilePath = TenantConfigurationSecurity.NormalizeStoragePath(osClient, sourceFilePath);
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, "文件路径不合法：" + ex.Message));
            }

            var onlyOfficeApiBase = await GetOnlyOfficeApiBase(osClient);
            if (!IsAllowedOfficeDownloadUrl(downloadUrl, onlyOfficeApiBase))
            {
                return Json(new DosResult(0, null, "OnlyOffice导出地址不在平台配置的文档服务域名内！"));
            }

            param["FilePathName"] = sourceFilePath;
            var authorizationError = await AuthorizeOfficeFileAccess(
                param,
                osClient,
                currentUser,
                "Edit");
            if (authorizationError != null) return Json(authorizationError);

            var context = await ResolveOfficeFileContext(param, osClient, currentUser);
            if (context.Error != null) return Json(context.Error);
            if (!FieldValueReferencesPath(context.FieldValue, sourceFilePath))
            {
                return Json(new DosResult(0, null, "业务记录的文件字段未引用所请求的Office文件！"));
            }
            if (!IsOfficePreviewEnabled(context.FieldModel)
                || !IsOfficeEditEnabled(context.FieldModel))
            {
                return Json(new DosResult(0, null, "该文件字段未开启Office在线编辑！"));
            }
            if (!IsPrivateOfficeField(context.FieldModel))
            {
                return Json(new DosResult(0, null, "Office在线编辑仅允许私有文件字段，请先开启文件字段的私有存储！"));
            }

            var sourceExtension = Path.GetExtension(sourceFilePath);
            if (!OfficePreviewSourceExtensions.Contains(sourceExtension))
            {
                return Json(new DosResult(0, null, "仅支持Excel、Word、PowerPoint、PDF和CSV文件在线保存！"));
            }

            var leaseResult = await TryAcquireOfficeSaveLeaseAsync(
                osClient,
                context.TableName,
                TokenString(param["FormDataId"]),
                context.FieldName,
                HttpContext.RequestAborted);
            if (leaseResult.Error != null) return Json(leaseResult.Error);
            await using var saveLease = leaseResult.Lease;

            // 获取分布式租约后再次执行授权和行级读取，避免等待锁期间记录、
            // 字段引用或用户权限已经发生变化。
            authorizationError = await AuthorizeOfficeFileAccess(
                param,
                osClient,
                currentUser,
                "Edit");
            if (authorizationError != null) return Json(authorizationError);
            context = await ResolveOfficeFileContext(param, osClient, currentUser);
            if (context.Error != null) return Json(context.Error);
            if (!FieldValueReferencesPath(context.FieldValue, sourceFilePath))
            {
                return Json(new DosResult(0, null, "业务记录的文件字段未引用所请求的Office文件！"));
            }
            if (!IsOfficePreviewEnabled(context.FieldModel)
                || !IsOfficeEditEnabled(context.FieldModel)
                || !IsPrivateOfficeField(context.FieldModel))
            {
                return Json(new DosResult(0, null, "该文件字段当前不允许私有Office在线编辑！"));
            }

            byte[] fileBytes;
            FileUploadSecurityOptions fileLimits;
            try
            {
                fileLimits = MicroiHDFS.GetFileUploadSecurityOptions(osClient);
                if (!fileLimits.UploadEnabled)
                {
                    return Json(FileUploadSecurity.CreateTenantUploadDisabledResult(osClient));
                }
                using var handler = new HttpClientHandler
                {
                    AllowAutoRedirect = false,
                    AutomaticDecompression = System.Net.DecompressionMethods.GZip
                        | System.Net.DecompressionMethods.Deflate
                };
                using var httpClient = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(90) };
                using var response = await httpClient.GetAsync(
                    downloadUrl,
                    HttpCompletionOption.ResponseHeadersRead,
                    HttpContext.RequestAborted);
                if (!response.IsSuccessStatusCode)
                {
                    return Json(new DosResult(0, null, "OnlyOffice导出文件下载失败：" + (int)response.StatusCode));
                }
                if (response.Content.Headers.ContentLength > fileLimits.MaxFileBytes)
                {
                    return Json(new DosResult(0, null, "OnlyOffice导出文件超过平台单文件上限！"));
                }

                await using var input = await response.Content.ReadAsStreamAsync(HttpContext.RequestAborted);
                using var output = new MemoryStream();
                var buffer = new byte[81920];
                while (true)
                {
                    var read = await input.ReadAsync(
                        buffer.AsMemory(0, buffer.Length),
                        HttpContext.RequestAborted);
                    if (read <= 0) break;
                    if (output.Length > fileLimits.MaxFileBytes - read)
                    {
                        return Json(new DosResult(0, null, "OnlyOffice导出文件超过平台单文件上限！"));
                    }
                    await output.WriteAsync(
                        buffer.AsMemory(0, read),
                        HttpContext.RequestAborted);
                }
                fileBytes = output.ToArray();
            }
            catch (OperationCanceledException) when (!HttpContext.RequestAborted.IsCancellationRequested)
            {
                return Json(new DosResult(0, null, "OnlyOffice导出文件下载超时！"));
            }
            catch (Exception ex)
            {
                var traceId = HttpContext.TraceIdentifier;
                MicroiEngine.QueueSystemLog(osClient, "HDFS", "OnlyOfficeDownloadFailed", "OnlyOffice 导出文件下载失败", ex.ToString(), 2, false, traceId);
                return Json(new DosResult(0, null, "OnlyOffice导出文件下载异常，请稍后重试！TraceId：" + traceId));
            }

            if (fileBytes.Length == 0)
            {
                return Json(new DosResult(0, null, "OnlyOffice导出文件内容为空！"));
            }
            if (!OfficePreviewSourceExtensions.Contains(sourceExtension)
                || !HasExpectedOfficeFileSignature(sourceExtension, fileBytes))
            {
                return Json(new DosResult(0, null, "OnlyOffice导出内容与原文件类型不匹配！"));
            }

            var quotaError = await FileUploadSecurity.ReserveDailyQuotaAsync(
                osClient,
                TokenString(currentUser?["Id"]),
                fileBytes.LongLength,
                fileLimits);
            if (quotaError != null) return Json(quotaError);

            var enableVersion = IsOfficeVersionEnabled(context.FieldModel);
            var currentFileMeta = FindOfficeFileMeta(context.FieldValue, sourceFilePath)
                ?? BuildOfficeFileMetaFromPath(sourceFilePath, GetFileNameFromPath(sourceFilePath));
            var mergeSourcePath = TokenString(currentFileMeta?["Path"]) ?? sourceFilePath;

            var versions = GetOfficeVersions(currentFileMeta);
            if (enableVersion)
            {
                EnsureInitialOfficeVersion(currentFileMeta, versions, sourceFilePath, TokenString(param["FileName"]));
            }
            var version = enableVersion ? NextMicroiVersion(versions) : TokenString(currentFileMeta?["Version"]);
            var targetPath = NormalizeStoragePath(sourceFilePath);
            if (enableVersion)
            {
                targetPath = BuildVersionFilePath(sourceFilePath, version);
            }

            if (!await saveLease.IsOwnerAsync())
            {
                return Json(new DosResult(0, null, "Office保存租约已失效，请重新打开文档后再试！"));
            }

            using var stream = new MemoryStream(fileBytes, writable: false);
            var putResult = await PutOfficeObject(osClient, true, targetPath, stream);
            if (putResult.Code != 1)
            {
                return Json(new DosResult(putResult.Code, putResult.Data, "保存文件到分布式存储失败：" + putResult.Msg));
            }

            var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var targetPathWithSlash = "/" + targetPath.TrimStart('/');
            var targetFileName = GetFileNameFromPath(targetPathWithSlash);
            var updatedFileMeta = currentFileMeta ?? new JObject();
            updatedFileMeta["Path"] = targetPathWithSlash;
            updatedFileMeta["Name"] = targetFileName;
            updatedFileMeta["Size"] = fileBytes.Length;
            updatedFileMeta["UpdateTime"] = now;
            updatedFileMeta["State"] = 1;

            if (enableVersion)
            {
                foreach (var item in versions.OfType<JObject>())
                {
                    item["IsLatest"] = false;
                }
                var versionMeta = new JObject
                {
                    ["Version"] = version,
                    ["Path"] = targetPathWithSlash,
                    ["Name"] = targetFileName,
                    ["Size"] = fileBytes.Length,
                    ["CreateTime"] = now,
                    ["IsLatest"] = true,
                    ["UserId"] = TokenString(currentUser?["Id"]),
                    ["UserName"] = TokenString(currentUser?["Name"]) ?? TokenString(currentUser?["Account"])
                };
                versions.Add(versionMeta);
                updatedFileMeta["Version"] = version;
                updatedFileMeta["Versions"] = versions;
            }

            if (!await saveLease.IsOwnerAsync())
            {
                return Json(new DosResult(0, null, "Office保存租约已失效，表单字段未更新，请重新保存！"));
            }

            var mergedFieldValue = MergeOfficeFileValue(context.FieldValue, updatedFileMeta, mergeSourcePath);
            var updateParam = new JObject
            {
                ["OsClient"] = osClient,
                ["Id"] = TokenString(param["FormDataId"]),
                [context.FieldName] = SerializeOfficeFieldValue(context.FieldValue, mergedFieldValue),
                ["_InvokeType"] = InvokeType.Client.ToString(),
                ["_CurrentUser"] = currentUser?.DeepClone(),
                ["_SysMenuId"] = TokenString(param["SysMenuId"]) ?? TokenString(param["MenuId"])
            };
            var tableChildAuth = ParseTableChildAuthorizationContext(
                param["_TableChildAuth"] ?? param["TableChildAuth"]);
            if (tableChildAuth != null)
            {
                updateParam["_TableChildAuth"] = JToken.FromObject(tableChildAuth);
            }
            var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync(context.TableName, updateParam);
            if (updateResult.Code != 1)
            {
                return Json(new DosResult(updateResult.Code, updateResult.Data, "文件已保存，但更新表单字段失败：" + updateResult.Msg));
            }

            return Json(new DosResult(1, new
            {
                FilePathName = targetPathWithSlash,
                FileName = targetFileName,
                FileSize = fileBytes.Length,
                Version = version,
                FileMeta = updatedFileMeta,
                Updated = updateResult.Data
            }, "保存成功"));
        }

        private async Task<DosResult> AuthorizeOfficeFileAccess(
            JObject param,
            string osClient,
            JObject currentUser,
            string operation)
        {
            var sysMenuId = TokenString(param?["SysMenuId"]);
            if (sysMenuId.DosIsNullOrWhiteSpace())
            {
                sysMenuId = TokenString(param?["MenuId"]);
            }
            var tableChildAuth = ParseTableChildAuthorizationContext(
                param?["_TableChildAuth"] ?? param?["TableChildAuth"]);

            var fileParam = new DiyUploadParam
            {
                OsClient = osClient,
                FormEngineKey = TokenString(param?["FormEngineKey"]),
                FormDataId = TokenString(param?["FormDataId"]),
                FieldId = TokenString(param?["FieldId"]),
                SysMenuId = sysMenuId,
                FilePathName = TokenString(param?["FilePathName"]),
                Limit = true,
                _CurrentUser = currentUser,
                _InvokeType = InvokeType.Client.ToString(),
                _TableChildAuth = tableChildAuth
            };

            // First prove that this exact path is referenced by a record readable in
            // the submitted menu context. This closes the old Office metadata/save
            // bypass around the private-file authorization boundary.
            var readError = await AuthorizePrivateFileRead(fileParam);
            if (readError != null) return readError;

            var operationParam = new DiyTableRowParam
            {
                FormEngineKey = fileParam.FormEngineKey,
                Id = fileParam.FormDataId,
                _SysMenuId = sysMenuId,
                OsClient = osClient,
                _CurrentUser = currentUser,
                _InvokeType = InvokeType.Client.ToString(),
                _TableChildAuth = tableChildAuth
            };
            var authorization = await MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(
                operationParam,
                operation);
            return authorization?.Code == 1
                ? null
                : authorization ?? new DosResult(0, null, "当前用户无权访问该Office文件！");
        }

        private async Task<(string TableName, string FieldName, JObject FieldModel, JToken FieldValue, DosResult Error)> ResolveOfficeFileContext(
            JObject param,
            string osClient,
            JObject currentUser = null)
        {
            var formEngineKey = TokenString(param["FormEngineKey"]);
            var formDataId = TokenString(param["FormDataId"]);
            var fieldId = TokenString(param["FieldId"]);

            if (formEngineKey.DosIsNullOrWhiteSpace()) return ("", "", null, null, new DosResult(0, null, "FormEngineKey不能为空！"));
            if (formDataId.DosIsNullOrWhiteSpace()) return ("", "", null, null, new DosResult(0, null, "FormDataId不能为空！"));
            if (fieldId.DosIsNullOrWhiteSpace()) return ("", "", null, null, new DosResult(0, null, "FieldId不能为空！"));

            var tableModel = await ResolveDiyTableModelForFileAccess(osClient, formEngineKey);
            var tableId = TokenString(tableModel?["Id"]);
            var tableName = TokenString(tableModel?["Name"]);
            if (tableId.DosIsNullOrWhiteSpace() || tableName.DosIsNullOrWhiteSpace())
            {
                return ("", "", null, null, new DosResult(0, null, "未找到表单引擎：" + formEngineKey));
            }

            var fieldModel = await ResolveDiyFieldModel(osClient, fieldId, tableName, tableId);
            var fieldName = TokenString(fieldModel?["Name"]);
            var fieldTableId = TokenString(fieldModel?["TableId"]);
            var fieldComponent = TokenString(fieldModel?["Component"]);
            if (fieldName.DosIsNullOrWhiteSpace()
                || !string.Equals(fieldTableId, tableId, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(fieldComponent, "FileUpload", StringComparison.OrdinalIgnoreCase))
            {
                return ("", "", null, null, new DosResult(0, null, "Office文件字段与当前表单不匹配：" + fieldId));
            }

            var rowQuery = new JObject
            {
                ["FormEngineKey"] = tableName,
                ["OsClient"] = osClient,
                ["Id"] = formDataId,
                ["_SysMenuId"] = TokenString(param["SysMenuId"]) ?? TokenString(param["MenuId"]),
                ["SysMenuId"] = TokenString(param["SysMenuId"]) ?? TokenString(param["MenuId"]),
                ["_CurrentUser"] = currentUser?.DeepClone(),
                ["_InvokeType"] = currentUser == null
                    ? InvokeType.Server.ToString()
                    : InvokeType.Client.ToString(),
                ["_SelectFields"] = new JArray("Id", fieldName)
            };
            var tableChildAuth = ParseTableChildAuthorizationContext(
                param["_TableChildAuth"] ?? param["TableChildAuth"]);
            if (tableChildAuth != null)
            {
                rowQuery["_TableChildAuth"] = JToken.FromObject(tableChildAuth);
            }
            var rowResult = await MicroiEngine.FormEngine
                .GetFormDataAsync<dynamic>(tableName, rowQuery);
            if (rowResult.Code != 1)
            {
                return ("", "", null, null, new DosResult(rowResult.Code, rowResult.Data, "未找到业务数据：" + rowResult.Msg));
            }

            var row = ToJObject((object)rowResult.Data);
            return (tableName, fieldName, fieldModel, row?[fieldName], null);
        }

        private async Task<string> ResolveDiyTableName(string osClient, string formEngineKey)
        {
            var tableModel = await ResolveDiyTableModelForFileAccess(osClient, formEngineKey);
            return TokenString(tableModel?["Name"]) ?? formEngineKey;
        }

        private async Task<JObject> ResolveDiyFieldModel(string osClient, string fieldId, string tableName, string tableId = null)
        {
            // 使用 FormEngine 的字段元数据内部入口，不通过通用 CRUD 读取受保护的
            // diy_field。通用 CRUD 的 Server 标记不等于可信内部调用，安全加固后会
            // 正确拒绝该路径，进而让拥有业务菜单的老 Token 被误判为字段不匹配。
            var byId = await MicroiEngine.FormEngine.GetDiyFieldModel(new DiyFieldParam
            {
                OsClient = osClient,
                Id = fieldId,
                IsDeleted = 0
            });
            if (byId?.Code == 1 && byId.Data != null) return byId.Data;

            var byName = await MicroiEngine.FormEngine.GetDiyFieldModel(new DiyFieldParam
            {
                OsClient = osClient,
                TableId = tableId,
                TableName = tableName,
                Name = fieldId,
                IsDeleted = 0
            });
            return byName?.Code == 1 ? byName.Data : null;
        }

        private async Task<string> GetOnlyOfficeApiBase(string osClient)
        {
            var sysConfig = await MicroiEngine.FormEngine.GetSysConfig(osClient);
            if (sysConfig.Code != 1 || sysConfig.Data == null) return "";
            return TokenString(ToJObject((object)sysConfig.Data)?["OnlyOfficeApiBase"]);
        }

        private static bool IsAllowedOfficeDownloadUrl(string downloadUrl, string onlyOfficeApiBase)
        {
            return OfficeDocumentSecurity.IsAllowedDownloadUrl(downloadUrl, onlyOfficeApiBase);
        }

        private async Task<DosResult> PutOfficeObject(
            string osClient,
            bool limit,
            string fileFullPath,
            Stream fileStream)
        {
            var clientModel = OsClient.GetClient(osClient);
            if (clientModel?.OsClientModel == null)
            {
                return new DosResult(0, null, "当前租户的分布式存储配置不可用！");
            }
            var defaultHdfs = TokenString(ToJObject((object)clientModel.OsClientModel)?["HDFS"]);

            IMicroiHDFS hdfsClient;
            if (string.Equals(defaultHdfs, "MinIO", StringComparison.OrdinalIgnoreCase))
                hdfsClient = MicroiEngine.HDFSFactory(HDFSType.MinIO);
            else if (string.Equals(defaultHdfs, "S3", StringComparison.OrdinalIgnoreCase)
                     || string.Equals(defaultHdfs, "AmazonS3", StringComparison.OrdinalIgnoreCase))
                hdfsClient = MicroiEngine.HDFSFactory(HDFSType.AmazonS3);
            else if (defaultHdfs.DosIsNullOrWhiteSpace()
                     || string.Equals(defaultHdfs, "Aliyun", StringComparison.OrdinalIgnoreCase)
                     || string.Equals(defaultHdfs, "AliOss", StringComparison.OrdinalIgnoreCase))
                hdfsClient = MicroiEngine.HDFSFactory(HDFSType.Aliyun);
            else
                return new DosResult(0, null, "当前租户配置了不受支持的分布式存储类型！");

            return await hdfsClient.PutObject(new HDFSParam
            {
                ClientModel = clientModel,
                Limit = limit,
                FileFullPath = fileFullPath.TrimStart('/'),
                FileStream = fileStream
            });
        }

        private static JObject ParseOfficeFieldConfig(JObject fieldModel)
        {
            var config = fieldModel?["Config"];
            if (config is JObject objectConfig) return objectConfig;
            var configText = TokenString(config);
            if (configText.DosIsNullOrWhiteSpace()) return null;
            try { return JObject.Parse(configText); }
            catch { return null; }
        }

        private static bool IsOfficePreviewEnabled(JObject fieldModel)
        {
            return TokenBool(ParseOfficeFieldConfig(fieldModel)?
                .SelectToken("FileUpload.EnableOfficePreview")) != false;
        }

        private static bool IsOfficeEditEnabled(JObject fieldModel)
        {
            return TokenBool(ParseOfficeFieldConfig(fieldModel)?
                .SelectToken("FileUpload.AllowOfficeEdit")) == true;
        }

        private static bool IsPrivateOfficeField(JObject fieldModel)
        {
            return TokenBool(ParseOfficeFieldConfig(fieldModel)?
                .SelectToken("FileUpload.Limit")) == true;
        }

        private static bool IsOfficeVersionEnabled(JObject fieldModel)
        {
            return TokenBool(ParseOfficeFieldConfig(fieldModel)?
                .SelectToken("FileUpload.EnableOfficeVersion")) == true;
        }

        private static JObject FindOfficeFileMeta(JToken fieldValue, string sourceFilePath)
        {
            var parsed = ParseOfficeFieldValue(fieldValue);
            if (parsed == null) return null;
            var normalizedSource = NormalizeComparePath(sourceFilePath);
            if (normalizedSource.DosIsNullOrWhiteSpace()) return null;
            if (parsed is JObject obj)
            {
                return OfficeFileMetaMatches(obj, normalizedSource) ? obj : null;
            }
            if (parsed is not JArray arr) return null;

            foreach (var item in arr.OfType<JObject>())
            {
                if (OfficeFileMetaMatches(item, normalizedSource))
                {
                    return item;
                }
            }
            return normalizedSource.DosIsNullOrWhiteSpace() ? arr.OfType<JObject>().FirstOrDefault() : null;
        }

        private static bool OfficeFileMetaMatches(JObject fileMeta, string normalizedSource)
        {
            if (fileMeta == null) return false;
            if (normalizedSource.DosIsNullOrWhiteSpace()) return true;

            var itemPath = TokenString(fileMeta["Path"]) ?? TokenString(fileMeta["FilePathName"]);
            if (NormalizeComparePath(itemPath) == normalizedSource) return true;

            var versions = GetOfficeVersions(fileMeta);
            return versions
                .OfType<JObject>()
                .Any(item =>
                {
                    var versionPath = TokenString(item["Path"]) ?? TokenString(item["FilePathName"]);
                    return NormalizeComparePath(versionPath) == normalizedSource;
                });
        }

        private static JObject ParseOfficeFileMeta(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null) return null;
            if (token is JObject obj) return obj;
            if (token.Type == JTokenType.String)
            {
                var text = TokenString(token);
                if (text.DosIsNullOrWhiteSpace()) return null;
                try { return JObject.Parse(text); } catch { return null; }
            }
            return null;
        }

        private static JToken ParseOfficeFieldValue(JToken value)
        {
            if (value == null || value.Type == JTokenType.Null) return null;
            if (value.Type == JTokenType.Object || value.Type == JTokenType.Array) return value.DeepClone();
            if (value.Type != JTokenType.String) return value.DeepClone();

            var text = TokenString(value);
            if (text.DosIsNullOrWhiteSpace() || text == "[]" || text == "null" || text == "undefined") return null;
            if (text.TrimStart().StartsWith("{") || text.TrimStart().StartsWith("["))
            {
                try { return JToken.Parse(text); } catch { }
            }
            return BuildOfficeFileMetaFromPath(text, GetFileNameFromPath(text));
        }

        private static JObject BuildOfficeFileMetaFromPath(string path, string fileName)
        {
            if (path.DosIsNullOrWhiteSpace()) return null;
            return new JObject
            {
                ["Path"] = path.StartsWith("/") ? path : "/" + path,
                ["Name"] = fileName.DosIsNullOrWhiteSpace() ? GetFileNameFromPath(path) : fileName,
                ["State"] = 1
            };
        }

        private static JArray GetOfficeVersions(JObject fileMeta)
        {
            var versions = fileMeta?["Versions"] ?? fileMeta?["versions"];
            if (versions is JArray arr) return new JArray(arr.Select(item => item.DeepClone()));
            if (versions?.Type == JTokenType.String)
            {
                try
                {
                    var parsed = JArray.Parse(TokenString(versions));
                    return new JArray(parsed.Select(item => item.DeepClone()));
                }
                catch { }
            }
            return new JArray();
        }

        private static void EnsureInitialOfficeVersion(JObject fileMeta, JArray versions, string fallbackPath, string fallbackName)
        {
            if (fileMeta == null || versions == null) return;

            var hasInitialVersion = versions
                .OfType<JObject>()
                .Any(item => string.Equals(TokenString(item["Version"]), "v1.0.0", StringComparison.OrdinalIgnoreCase));
            if (hasInitialVersion) return;

            var path = TokenString(fileMeta["Path"]) ?? TokenString(fileMeta["FilePathName"]) ?? fallbackPath;
            if (path.DosIsNullOrWhiteSpace()) return;

            var versionMeta = new JObject
            {
                ["Version"] = "v1.0.0",
                ["Path"] = path.StartsWith("/") ? path : "/" + path,
                ["Name"] = TokenString(fileMeta["Name"]) ?? fallbackName ?? GetFileNameFromPath(path),
                ["Size"] = fileMeta["Size"]?.DeepClone() ?? JValue.CreateString(""),
                ["CreateTime"] = fileMeta["CreateTime"]?.DeepClone() ?? fileMeta["UpdateTime"]?.DeepClone() ?? JValue.CreateString(""),
                ["IsLatest"] = versions.Count == 0
            };

            versions.Insert(0, versionMeta);
            if (TokenString(fileMeta["Version"]).DosIsNullOrWhiteSpace())
            {
                fileMeta["Version"] = "v1.0.0";
            }
        }

        private static string NextMicroiVersion(JArray versions)
        {
            var parsedVersions = new List<(int Major, int Minor, int Patch)>();
            foreach (var item in versions)
            {
                var parsed = ParseMicroiVersion(TokenString(item?["Version"]));
                if (parsed.HasValue)
                {
                    parsedVersions.Add(parsed.Value);
                }
            }

            var sortedVersions = parsedVersions
                .OrderByDescending(item => item.Major)
                .ThenByDescending(item => item.Minor)
                .ThenByDescending(item => item.Patch)
                .ToList();

            if (!sortedVersions.Any()) return "v1.0.0";
            var max = sortedVersions.First();
            var major = max.Major;
            var minor = max.Minor;
            var patch = max.Patch + 1;
            if (patch > 9)
            {
                patch = 0;
                minor++;
            }
            if (minor > 9)
            {
                minor = 0;
                major++;
            }
            return $"v{major}.{minor}.{patch}";
        }

        private static (int Major, int Minor, int Patch)? ParseMicroiVersion(string version)
        {
            if (version.DosIsNullOrWhiteSpace()) return null;
            var match = Regex.Match(version, @"^v?(\d+)\.(\d+)\.(\d+)$", RegexOptions.IgnoreCase);
            if (!match.Success) return null;
            return (int.Parse(match.Groups[1].Value), int.Parse(match.Groups[2].Value), int.Parse(match.Groups[3].Value));
        }

        private static string BuildVersionFilePath(string sourcePath, string version)
        {
            var normalized = NormalizeStoragePath(sourcePath);
            var dir = Path.GetDirectoryName(normalized)?.Replace("\\", "/") ?? "";
            var fileName = Path.GetFileName(normalized);
            var ext = Path.GetExtension(fileName);
            var name = Path.GetFileNameWithoutExtension(fileName);
            name = Regex.Replace(name, @"_v\d+\.\d+\.\d+$", "", RegexOptions.IgnoreCase);
            var versionName = $"{name}_{version}{ext}";
            return dir.DosIsNullOrWhiteSpace() ? versionName : $"{dir}/{versionName}";
        }

        private static string NormalizeStoragePath(string path)
        {
            if (path.DosIsNullOrWhiteSpace()) return "";
            var normalized = path.Trim().Replace("\\", "/");
            if (Uri.TryCreate(normalized, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            {
                normalized = uri.AbsolutePath;
            }
            return normalized.Trim('/');
        }

        private static string NormalizeComparePath(string path)
        {
            return PrivateFileAccessAuthorization.NormalizeAuthoritativeObjectPath(path);
        }

        private static string GetFileNameFromPath(string path)
        {
            if (path.DosIsNullOrWhiteSpace()) return "";
            return Path.GetFileName(NormalizeStoragePath(path));
        }

        private static JToken MergeOfficeFileValue(JToken originalFieldValue, JObject updatedFileMeta, string sourceFilePath)
        {
            var parsed = ParseOfficeFieldValue(originalFieldValue);
            if (parsed is JArray arr)
            {
                var normalizedSource = NormalizeComparePath(sourceFilePath);
                var replaced = false;
                for (var i = 0; i < arr.Count; i++)
                {
                    if (arr[i] is not JObject item) continue;
                    var itemPath = TokenString(item["Path"]) ?? TokenString(item["FilePathName"]);
                    if (NormalizeComparePath(itemPath) == normalizedSource)
                    {
                        arr[i] = updatedFileMeta;
                        replaced = true;
                        break;
                    }
                }
                if (!replaced) arr.Add(updatedFileMeta);
                return arr;
            }
            return updatedFileMeta;
        }

        private static JToken SerializeOfficeFieldValue(JToken originalFieldValue, JToken value)
        {
            if (value == null) return new JValue("");
            if (originalFieldValue?.Type == JTokenType.Array) return value;
            return new JValue(value.ToString(Formatting.None));
        }

        private static string TokenString(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined) return null;
            if (token.Type == JTokenType.String) return token.Value<string>();
            if (token is JValue value) return Convert.ToString(value.Value);
            return token.ToString(Formatting.None);
        }

        private static bool? TokenBool(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined) return null;
            if (token.Type == JTokenType.Boolean) return token.Value<bool>();
            var text = TokenString(token);
            if (text.DosIsNullOrWhiteSpace()) return null;
            if (bool.TryParse(text, out var boolValue)) return boolValue;
            if (int.TryParse(text, out var intValue)) return intValue != 0;
            return null;
        }

        private static JObject ToJObject(object data)
        {
            if (data == null) return null;
            if (data is JObject obj) return obj;
            if (data is JToken token)
            {
                if (token.Type == JTokenType.Object) return (JObject)token;
                if (token.Type == JTokenType.String)
                {
                    var text = TokenString(token);
                    if (!text.DosIsNullOrWhiteSpace() && text.TrimStart().StartsWith("{"))
                    {
                        try { return JObject.Parse(text); } catch { }
                    }
                }
                return null;
            }
            try
            {
                return JObject.Parse(JsonConvert.SerializeObject(data));
            }
            catch
            {
                return null;
            }
        }

        #region 文件管理接口

        /// <summary>
        /// 列出指定路径下的文件和文件夹。
        /// 传入 Path（前缀路径，如 "osclient/upload/"）、Limit（是否私有桶）
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<JsonResult> ListObjects(DiyUploadParam param)
        {
            var accessError = await DefaultParam(param);
            if (accessError != null) return Json(accessError);
            var adminError = RequirePlatformAdmin(param);
            if (adminError != null) return Json(adminError);
            var pathError = NormalizeObjectPath(param, allowEmpty: true);
            if (pathError != null) return Json(pathError);
            var result = await new MicroiHDFS().ListObjects(param);
            return Json(result);
        }

        /// <summary>
        /// 删除文件或文件夹。
        /// 传入 FilePathName（文件完整路径），如果是文件夹路径需以"/"结尾
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> DeleteObject(DiyUploadParam param)
        {
            var accessError = await DefaultParam(param);
            if (accessError != null) return Json(accessError);
            var adminError = RequirePlatformAdmin(param);
            if (adminError != null) return Json(adminError);

            if (param.FilePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }
            var pathError = NormalizeFilePaths(param);
            if (pathError != null) return Json(pathError);

            var result = await new MicroiHDFS().DeleteObject(param);
            return Json(result);
        }

        /// <summary>
        /// 创建文件夹。
        /// 传入 FilePathName（文件夹完整路径，如 "osclient/upload/newfolder"）
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> CreateFolder(DiyUploadParam param)
        {
            var accessError = await DefaultParam(param);
            if (accessError != null) return Json(accessError);
            var adminError = RequirePlatformAdmin(param);
            if (adminError != null) return Json(adminError);

            if (param.FilePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }
            var pathError = NormalizeFilePaths(param);
            if (pathError != null) return Json(pathError);

            var result = await new MicroiHDFS().CreateFolder(param);
            return Json(result);
        }

        /// <summary>
        /// 重命名文件或文件夹。
        /// 传入 FilePathName（原路径）、Path（新路径）
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> RenameObject(DiyUploadParam param)
        {
            var accessError = await DefaultParam(param);
            if (accessError != null) return Json(accessError);
            var adminError = RequirePlatformAdmin(param);
            if (adminError != null) return Json(adminError);

            if (param.FilePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }
            if (param.Path.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "新路径Path不能为空！"));
            }
            var sourcePathError = NormalizeFilePaths(param);
            if (sourcePathError != null) return Json(sourcePathError);
            var destinationPathError = NormalizeObjectPath(param);
            if (destinationPathError != null) return Json(destinationPathError);

            var result = await new MicroiHDFS().RenameObject(param);
            return Json(result);
        }

        /// <summary>
        /// 移动文件。
        /// 传入 FilePathName（原路径）、Path（目标路径）
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> MoveObject(DiyUploadParam param)
        {
            var accessError = await DefaultParam(param);
            if (accessError != null) return Json(accessError);
            var adminError = RequirePlatformAdmin(param);
            if (adminError != null) return Json(adminError);

            if (param.FilePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }
            if (param.Path.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "目标路径Path不能为空！"));
            }
            var sourcePathError = NormalizeFilePaths(param);
            if (sourcePathError != null) return Json(sourcePathError);
            var destinationPathError = NormalizeObjectPath(param);
            if (destinationPathError != null) return Json(destinationPathError);

            var result = await new MicroiHDFS().MoveObject(param);
            return Json(result);
        }

        /// <summary>
        /// 文件管理专用上传 - 上传到指定的存储路径。
        /// 传入 Path（存储路径前缀）、Limit（是否私有桶）
        /// </summary>
        [Consumes("application/json", "multipart/form-data")]
        [HttpPost]
        public async Task<JsonResult> FileManageUpload(DiyUploadParam param)
        {
            var accessError = await DefaultParam(param);
            if (accessError != null) return Json(accessError);
            var adminError = RequirePlatformAdmin(param);
            if (adminError != null) return Json(adminError);
            var pathError = NormalizeUploadPath(param);
            if (pathError != null) return Json(pathError);

            var fileError = LoadFormFiles(param);
            if (fileError != null) return Json(fileError);

            // 文件管理上传不压缩
            param.Preview = false;

            var result = await MicroiEngine.HDFS.Upload(param);
            return Json(result);
        }

        #endregion

        #region MinioSync

        [HttpPost]
        public async Task<JsonResult> ProbeMinio(MinioProbeParam param)
        {
            var access = await GetMinioSyncAccess();
            if (access.Result != null) return Json(access.Result);
            return Json(await new ExternalMinioSyncService().Probe(param));
        }

        [HttpPost]
        public async Task<JsonResult> ListMinioObjects(MinioListObjectsParam param)
        {
            var access = await GetMinioSyncAccess();
            if (access.Result != null) return Json(access.Result);
            return Json(await new ExternalMinioSyncService().ListObjects(param));
        }

        [HttpPost]
        public async Task<JsonResult> CreateMinioFolder(MinioCreateFolderParam param)
        {
            var access = await GetMinioSyncAccess();
            if (access.Result != null) return Json(access.Result);
            return Json(await new ExternalMinioSyncService().CreateFolder(param));
        }

        [HttpPost]
        public async Task<JsonResult> SyncMinioObject(MinioObjectSyncParam param)
        {
            var access = await GetMinioSyncAccess();
            if (access.Result != null) return Json(access.Result);
            param ??= new MinioObjectSyncParam();
            param.CurrentOsClient = access.OsClient;
            return Json(await new ExternalMinioSyncService().SyncObject(param));
        }

        private static async Task<(DosResult Result, string OsClient)> GetMinioSyncAccess()
        {
            try
            {
                var currentToken = await DiyToken.GetCurrentToken().ConfigureAwait(false);
                if (currentToken?.CurrentUser == null || currentToken.OsClient.DosIsNullOrWhiteSpace())
                {
                    return (new DosResult(1001, null, "登录身份已过期，请重新登录。"), "");
                }
                if (currentToken.CurrentUser["Level"].Val<int>() < DiyCommon.MaxRoleLevel)
                {
                    return (new DosResult(0, null, "只有超级管理员可以配置直连MinIO并执行文件同步。"), "");
                }
                return (null, currentToken.OsClient);
            }
            catch
            {
                return (new DosResult(1001, null, "登录身份无效，请重新登录。"), "");
            }
        }
        #endregion


        #region OfficePreviewSource

        private const int OfficePreviewSourceMaxBytes = 50 * 1024 * 1024;
        private static readonly TimeSpan OfficePreviewSourceCacheLifetime = TimeSpan.FromMinutes(10);
        private static readonly HashSet<string> OfficePreviewSourceExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".xlsx", ".xls", ".docx", ".doc", ".pptx", ".ppt", ".pdf", ".csv"
        };

        /// <summary>
        /// 将当前平台匿名接口引擎响应的 Office 文件缓存到公有对象存储，供远端 OnlyOffice 回源。
        /// 该接口不是通用 URL 代理：仅接受当前租户、当前平台的 /apiengine/{key} 地址。
        /// </summary>
        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> PrepareOfficePreviewFromUrl([FromBody] JObject param)
        {
            var osClient = TokenString(param?["OsClient"]);
            var sourceUrl = TokenString(param?["FileUrl"]);
            var requestedFileName = TokenString(param?["FileName"]);

            if (osClient.DosIsNullOrWhiteSpace())
                return Json(new DosResult(0, null, "OsClient不能为空！"));
            if (!IsSafeOsClient(osClient))
                return Json(new DosResult(0, null, "OsClient格式不合法！"));
            if (!Uri.TryCreate(sourceUrl, UriKind.Absolute, out var sourceUri)
                || (sourceUri.Scheme != Uri.UriSchemeHttp && sourceUri.Scheme != Uri.UriSchemeHttps)
                || !sourceUri.UserInfo.DosIsNullOrWhiteSpace()
                || !sourceUri.Fragment.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FileUrl必须是合法的HTTP或HTTPS接口引擎地址！"));
            }

            var sourceValidation = await ValidateOfficePreviewSourceUri(sourceUri, osClient);
            if (!sourceValidation.Allowed)
                return Json(new DosResult(0, null, sourceValidation.Message));

            var cacheHash = Sha256Hex(sourceUri.AbsoluteUri + "|" + requestedFileName);
            var cacheKey = $"Microi:{osClient}:OfficePreviewSource:{cacheHash}";
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            try
            {
                var cached = await cache.GetAsync<JObject>(cacheKey).ConfigureAwait(false);
                if (cached != null && IsSafeCachedOfficePreview(cached, osClient))
                    return Json(new DosResult(1, cached, "已使用缓存文件"));
            }
            catch
            {
                // 缓存故障不应阻止 Office 预览，继续从源接口获取。
            }

            byte[] fileBytes;
            string responseFileName;
            try
            {
                using var handler = new HttpClientHandler
                {
                    AllowAutoRedirect = false,
                    AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
                };
                if (sourceValidation.IsLoopback)
                {
                    handler.ServerCertificateCustomValidationCallback = (message, _, _, errors) =>
                        errors == SslPolicyErrors.None || IsLoopbackHost(message?.RequestUri?.Host);
                }

                using var httpClient = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(90) };
                using var request = new HttpRequestMessage(HttpMethod.Get, sourceUri);
                request.Headers.UserAgent.ParseAdd("Microi-OnlyOffice-Preview/1.0");
                using var response = await httpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    HttpContext.RequestAborted).ConfigureAwait(false);

                if (!response.IsSuccessStatusCode)
                    return Json(new DosResult(0, null, "接口引擎文件下载失败：HTTP " + (int)response.StatusCode));
                if (response.Content.Headers.ContentLength > OfficePreviewSourceMaxBytes)
                    return Json(new DosResult(0, null, "接口引擎文件超过50MB预览上限！"));

                responseFileName = DecodeContentDispositionFileName(
                    response.Content.Headers.ContentDisposition?.FileNameStar
                    ?? response.Content.Headers.ContentDisposition?.FileName);
                await using var input = await response.Content.ReadAsStreamAsync(HttpContext.RequestAborted).ConfigureAwait(false);
                using var output = new MemoryStream();
                var buffer = new byte[81920];
                while (true)
                {
                    var read = await input.ReadAsync(buffer.AsMemory(0, buffer.Length), HttpContext.RequestAborted).ConfigureAwait(false);
                    if (read <= 0) break;
                    if (output.Length + read > OfficePreviewSourceMaxBytes)
                        return Json(new DosResult(0, null, "接口引擎文件超过50MB预览上限！"));
                    await output.WriteAsync(buffer.AsMemory(0, read), HttpContext.RequestAborted).ConfigureAwait(false);
                }
                fileBytes = output.ToArray();
            }
            catch (OperationCanceledException) when (!HttpContext.RequestAborted.IsCancellationRequested)
            {
                return Json(new DosResult(0, null, "接口引擎文件下载超时！"));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, "接口引擎文件下载异常：" + ex.Message));
            }

            if (fileBytes.Length == 0)
                return Json(new DosResult(0, null, "接口引擎返回的文件内容为空！"));

            var fileName = NormalizeOfficePreviewFileName(requestedFileName, responseFileName);
            var extension = Path.GetExtension(fileName);
            if (!OfficePreviewSourceExtensions.Contains(extension))
                return Json(new DosResult(0, null, "仅支持Excel、Word、PowerPoint、PDF和CSV文件预览！"));
            if (!HasExpectedOfficeFileSignature(extension, fileBytes))
                return Json(new DosResult(0, null, "接口引擎返回内容与文件类型不匹配！"));

            var objectPath = $"{osClient}/office-preview/{cacheHash}/{fileName}";
            using (var stream = new MemoryStream(fileBytes, writable: false))
            {
                var putResult = await PutOfficeObject(osClient, false, objectPath, stream).ConfigureAwait(false);
                if (putResult.Code != 1)
                    return Json(new DosResult(putResult.Code, putResult.Data, "缓存预览文件失败：" + putResult.Msg));
            }

            var sysConfigResult = await MicroiEngine.FormEngine.GetSysConfig(osClient).ConfigureAwait(false);
            var sysConfig = sysConfigResult.Code == 1 && sysConfigResult.Data != null
                ? ToJObject((object)sysConfigResult.Data)
                : null;
            var fileServer = TokenString(sysConfig?["FileServer"]);
            if (!Uri.TryCreate(fileServer, UriKind.Absolute, out var fileServerUri)
                || (fileServerUri.Scheme != Uri.UriSchemeHttp && fileServerUri.Scheme != Uri.UriSchemeHttps))
            {
                return Json(new DosResult(0, null, "当前租户未配置可供OnlyOffice访问的FileServer！"));
            }

            var filePathName = "/" + objectPath.TrimStart('/');
            var resultData = new JObject
            {
                ["FileUrl"] = fileServer.TrimEnd('/') + filePathName,
                ["FilePathName"] = filePathName,
                ["FileName"] = fileName,
                ["FileSize"] = fileBytes.Length,
                ["FileType"] = extension.TrimStart('.').ToLowerInvariant(),
                ["SourceUrl"] = sourceUri.AbsoluteUri
            };
            try
            {
                await cache.SetAsync(cacheKey, resultData, OfficePreviewSourceCacheLifetime).ConfigureAwait(false);
            }
            catch
            {
                // 对象已写入分布式存储；Redis故障时仍可正常预览。
            }

            return Json(new DosResult(1, resultData, "预览文件已就绪"));
        }

        private async Task<(bool Allowed, bool IsLoopback, string Message)> ValidateOfficePreviewSourceUri(Uri sourceUri, string osClient)
        {
            var decodedPath = Uri.UnescapeDataString(sourceUri.AbsolutePath);
            if (!Regex.IsMatch(decodedPath, @"^/apiengine/[^/]+/?$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
                return (false, false, "仅允许预览当前平台的接口引擎文件地址！");

            var tenantInPath = Regex.Match(decodedPath, @"--OsClient--(?<tenant>.+?)--", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            var tenant = tenantInPath.Success ? tenantInPath.Groups["tenant"].Value : null;
            if (tenant.DosIsNullOrWhiteSpace())
            {
                foreach (var item in QueryHelpers.ParseQuery(sourceUri.Query))
                {
                    if (string.Equals(item.Key, "OsClient", StringComparison.OrdinalIgnoreCase))
                    {
                        tenant = item.Value.FirstOrDefault();
                        break;
                    }
                }
            }
            if (!string.Equals(tenant, osClient, StringComparison.OrdinalIgnoreCase))
                return (false, false, "接口引擎地址必须显式指定当前OsClient！");

            var sourceIsLoopback = IsLoopbackHost(sourceUri.Host);
            if (sourceIsLoopback)
            {
                var requestIsLoopback = IsLoopbackHost(Request.Host.Host);
                var requestPort = Request.Host.Port ?? (Request.IsHttps ? 443 : 80);
                if (!requestIsLoopback || sourceUri.Port != requestPort)
                    return (false, false, "本地接口引擎地址只允许由同端口本地服务预览！");
                return (true, true, null);
            }

            var sysConfigResult = await MicroiEngine.FormEngine.GetSysConfig(osClient).ConfigureAwait(false);
            var apiBase = sysConfigResult.Code == 1 && sysConfigResult.Data != null
                ? TokenString(ToJObject((object)sysConfigResult.Data)?["ApiBase"])
                : null;
            if (!Uri.TryCreate(apiBase, UriKind.Absolute, out var apiBaseUri)
                || !string.Equals(sourceUri.Host, apiBaseUri.Host, StringComparison.OrdinalIgnoreCase)
                || sourceUri.Port != apiBaseUri.Port)
            {
                return (false, false, "接口引擎地址不属于当前租户配置的ApiBase！");
            }
            return (true, false, null);
        }

        private static bool IsSafeOsClient(string osClient) =>
            Regex.IsMatch(osClient, @"^[A-Za-z0-9_.-]{1,64}$", RegexOptions.CultureInvariant);

        private static bool IsLoopbackHost(string host)
        {
            if (host.DosIsNullOrWhiteSpace()) return false;
            if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)) return true;
            return IPAddress.TryParse(host, out var address) && IPAddress.IsLoopback(address);
        }

        private static bool IsSafeCachedOfficePreview(JObject cached, string osClient)
        {
            var fileUrl = TokenString(cached?["FileUrl"]);
            var filePathName = TokenString(cached?["FilePathName"]);
            return Uri.TryCreate(fileUrl, UriKind.Absolute, out var uri)
                && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
                && !filePathName.DosIsNullOrWhiteSpace()
                && filePathName.StartsWith("/" + osClient + "/office-preview/", StringComparison.OrdinalIgnoreCase);
        }

        private static string NormalizeOfficePreviewFileName(string requestedFileName, string responseFileName)
        {
            var fileName = requestedFileName.DosIsNullOrWhiteSpace() ? responseFileName : requestedFileName;
            fileName = Path.GetFileName((fileName ?? "office-preview.xlsx").Trim().Replace('\\', '/'));
            fileName = Regex.Replace(fileName, "[\\x00-\\x1F<>:\\\"/\\\\|?*]", "_");
            if (fileName.Length > 160)
            {
                var extension = Path.GetExtension(fileName);
                fileName = fileName[..Math.Max(1, 160 - extension.Length)] + extension;
            }
            return fileName.DosIsNullOrWhiteSpace() ? "office-preview.xlsx" : fileName;
        }

        private static string DecodeContentDispositionFileName(string value)
        {
            if (value.DosIsNullOrWhiteSpace()) return null;
            value = value.Trim().Trim('"');
            try { return Uri.UnescapeDataString(value); } catch { return value; }
        }

        private static bool HasExpectedOfficeFileSignature(string extension, byte[] bytes)
        {
            return OfficeDocumentSecurity.HasExpectedFileSignature(extension, bytes);
        }

        private static string Sha256Hex(string value) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
        #endregion


        #region OfficeSaveLease

        private static readonly TimeSpan OfficeSaveLeaseLifetime = TimeSpan.FromMinutes(10);
        private static readonly TimeSpan OfficeSaveLeaseRenewInterval = TimeSpan.FromMinutes(1);
        private const string OfficeSaveLeaseAcquireScript = @"
    local acquired = redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2])
    if not acquired then return {0, 0} end
    local fencingToken = redis.call('INCR', KEYS[2])
    redis.call('PEXPIRE', KEYS[2], ARGV[3])
    return {1, fencingToken}";
        private const string OfficeSaveLeaseRenewScript = @"
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
    return redis.call('PEXPIRE', KEYS[1], ARGV[2])";
        private const string OfficeSaveLeaseReleaseScript = @"
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
    return redis.call('DEL', KEYS[1])";
        private const string OfficeSaveLeaseOwnerScript = @"
    if redis.call('GET', KEYS[1]) == ARGV[1] then return 1 end
    return 0";

        /// <summary>
        /// 同一租户、业务记录和文件字段的在线保存必须串行执行。租约与 fencing
        /// 计数器都位于共享 Redis，Key 使用同一个 hash tag，可用于 Redis Cluster。
        /// 获取、续租、持有校验和释放均按唯一 owner token 原子执行；Redis 不可用时
        /// 失败关闭，禁止回退到进程内锁。
        /// </summary>
        private static async Task<(OfficeSaveLease Lease, DosResult Error)> TryAcquireOfficeSaveLeaseAsync(
            string osClient,
            string tableName,
            string formDataId,
            string fieldName,
            CancellationToken cancellationToken)
        {
            if (osClient.DosIsNullOrWhiteSpace()
                || tableName.DosIsNullOrWhiteSpace()
                || formDataId.DosIsNullOrWhiteSpace()
                || fieldName.DosIsNullOrWhiteSpace())
            {
                return (null, new DosResult(0, null, "无法确定Office保存租约范围！"));
            }

            var scopeHash = Sha256Hex(
                osClient.Trim().ToLowerInvariant()
                + "|" + tableName.Trim().ToLowerInvariant()
                + "|" + formDataId.Trim()
                + "|" + fieldName.Trim().ToLowerInvariant());
            var hashTag = "{OfficeSave:" + scopeHash + "}";
            var lockKey = $"Microi:{osClient}:OfficeSave:{hashTag}:Lock";
            var fenceKey = $"Microi:{osClient}:OfficeSave:{hashTag}:Fence";
            var owner = Ulid.NewUlid().ToString();

            try
            {
                var database = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
                for (var attempt = 0; attempt < 30; attempt++)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var result = await database.ScriptEvaluateAsync(
                        OfficeSaveLeaseAcquireScript,
                        new RedisKey[] { lockKey, fenceKey },
                        new RedisValue[]
                        {
                            owner,
                            (long)OfficeSaveLeaseLifetime.TotalMilliseconds,
                            (long)TimeSpan.FromDays(7).TotalMilliseconds
                        }).ConfigureAwait(false);
                    var values = (RedisResult[])result;
                    if (values != null && values.Length >= 2 && (long)values[0] == 1)
                    {
                        return (
                            new OfficeSaveLease(
                                database,
                                lockKey,
                                owner,
                                (long)values[1]),
                            null);
                    }
                    await Task.Delay(100, cancellationToken).ConfigureAwait(false);
                }

                return (null, new DosResult(0, null, "同一文件正在保存，请稍后重试！"));
            }
            catch (OperationCanceledException)
            {
                return (null, new DosResult(0, null, "Office保存请求已取消！"));
            }
            catch
            {
                return (null, new DosResult(0, null, "Office保存租约服务暂时不可用，请稍后重试！"));
            }
        }

        private sealed class OfficeSaveLease : IAsyncDisposable
        {
            private readonly IDatabase _database;
            private readonly RedisKey _lockKey;
            private readonly RedisValue _owner;
            private readonly CancellationTokenSource _renewalCancellation = new();
            private readonly Task _renewalTask;
            private volatile bool _lost;
            private int _disposed;

            internal OfficeSaveLease(
                IDatabase database,
                RedisKey lockKey,
                RedisValue owner,
                long fencingToken)
            {
                _database = database;
                _lockKey = lockKey;
                _owner = owner;
                FencingToken = fencingToken;
                _renewalTask = RenewUntilDisposedAsync();
            }

            internal long FencingToken { get; }

            internal async Task<bool> IsOwnerAsync()
            {
                if (_lost || Volatile.Read(ref _disposed) != 0) return false;
                try
                {
                    var result = await _database.ScriptEvaluateAsync(
                        OfficeSaveLeaseOwnerScript,
                        new RedisKey[] { _lockKey },
                        new RedisValue[] { _owner }).ConfigureAwait(false);
                    var isOwner = (long)result == 1;
                    if (!isOwner) _lost = true;
                    return isOwner;
                }
                catch
                {
                    _lost = true;
                    return false;
                }
            }

            private async Task RenewUntilDisposedAsync()
            {
                try
                {
                    while (true)
                    {
                        await Task.Delay(
                            OfficeSaveLeaseRenewInterval,
                            _renewalCancellation.Token).ConfigureAwait(false);
                        var result = await _database.ScriptEvaluateAsync(
                            OfficeSaveLeaseRenewScript,
                            new RedisKey[] { _lockKey },
                            new RedisValue[]
                            {
                                _owner,
                                (long)OfficeSaveLeaseLifetime.TotalMilliseconds
                            }).ConfigureAwait(false);
                        if ((long)result != 1)
                        {
                            _lost = true;
                            return;
                        }
                    }
                }
                catch (OperationCanceledException)
                {
                    // 正常释放。
                }
                catch
                {
                    _lost = true;
                }
            }

            public async ValueTask DisposeAsync()
            {
                if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
                _renewalCancellation.Cancel();
                try
                {
                    await _renewalTask.ConfigureAwait(false);
                }
                catch
                {
                    // 续租任务的异常已转换为 lost 状态，释放仍应继续尝试。
                }

                try
                {
                    await _database.ScriptEvaluateAsync(
                        OfficeSaveLeaseReleaseScript,
                        new RedisKey[] { _lockKey },
                        new RedisValue[] { _owner }).ConfigureAwait(false);
                }
                catch
                {
                    // 租约有有限 TTL，Redis 暂不可用时不执行不安全的本地释放。
                }
                finally
                {
                    _renewalCancellation.Dispose();
                }
            }
        }
        #endregion


        #region PrivateFileAudit

        /// <summary>
        /// 私有附件审计代理。Ticket只保存于Redis且30分钟过期；对象存储真实签名地址不会暴露给浏览器。
        /// 支持匿名打开转发链接，并以流式转发避免大文件占用服务器内存。
        /// </summary>
        [HttpGet, HttpHead]
        [AllowAnonymous]
        public async Task<IActionResult> OpenPrivateFile(
            [FromQuery(Name = "OsClient")] string osClient,
            [FromQuery(Name = "o")] string legacyOsClient,
            string t)
        {
            if (!TryResolvePrivateFileAuditTenant(osClient, legacyOsClient, out var tenant)
                || t.DosIsNullOrWhiteSpace()
                || t.Length > 128)
                return NotFound();
            PrivateFileAuditTicket ticket;
            try
            {
                ticket = await MicroiEngine.CacheTenant.Cache(tenant)
                    .GetAsync<PrivateFileAuditTicket>(PrivateFileAuditTicket.CacheKey(tenant, t)).ConfigureAwait(false);
            }
            catch { return StatusCode(StatusCodes.Status503ServiceUnavailable); }
            if (ticket == null || ticket.ExpiresAt <= DateTime.Now || !string.Equals(ticket.OsClient, tenant, StringComparison.OrdinalIgnoreCase))
            {
                QueuePrivateFileOpen(ticket, tenant, t, false, "临时链接不存在或已过期", null, null);
                return NotFound();
            }

            JObject currentUser = null;
            try
            {
                var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
                if (currentToken?.CurrentUser != null && string.Equals(currentToken.OsClient, tenant, StringComparison.OrdinalIgnoreCase))
                    currentUser = currentToken.CurrentUser;
            }
            catch { }

            var factory = HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>();
            using var upstreamRequest = new HttpRequestMessage(HttpMethod.Get, ticket.UpstreamUrl);
            if (Request.Headers.TryGetValue("Range", out var rangeValue)
                && RangeHeaderValue.TryParse(rangeValue.ToString(), out var range)) upstreamRequest.Headers.Range = range;
            try
            {
                using var upstream = await factory.CreateClient().SendAsync(upstreamRequest,
                    HttpCompletionOption.ResponseHeadersRead, HttpContext.RequestAborted).ConfigureAwait(false);
                if (!upstream.IsSuccessStatusCode && upstream.StatusCode != HttpStatusCode.PartialContent)
                {
                    QueuePrivateFileOpen(ticket, tenant, t, false, $"上游返回{(int)upstream.StatusCode}", currentUser, null);
                    if (upstream.StatusCode == HttpStatusCode.NotFound)
                    {
                        return NotFound(new DosResult(0, null,
                            $"对象存储中不存在文件[{ticket.FileName}]，请从原存储或备份恢复后重试。"));
                    }
                    return StatusCode((int)upstream.StatusCode);
                }

                Response.StatusCode = (int)upstream.StatusCode;
                if (upstream.Content.Headers.ContentType != null) Response.ContentType = upstream.Content.Headers.ContentType.ToString();
                if (upstream.Content.Headers.ContentLength.HasValue) Response.ContentLength = upstream.Content.Headers.ContentLength.Value;
                NetworkTrafficObservabilityService.AnnotateIdentity(
                    HttpContext,
                    currentUser?["Id"]?.ToString(),
                    currentUser?["Account"]?.ToString(),
                    currentUser?["Name"]?.ToString(),
                    tenant);
                NetworkTrafficObservabilityService.AnnotateTransfer(
                    HttpContext,
                    "Download",
                    1,
                    upstream.Content.Headers.ContentLength ?? 0,
                    new[] { ticket.FileName },
                    new[] { Path.GetExtension(ticket.FileName ?? "") });
                CopyHeader(upstream, "Accept-Ranges");
                CopyHeader(upstream, "Content-Range");
                CopyHeader(upstream, "Content-Disposition");
                Response.Headers["X-Content-Type-Options"] = "nosniff";
                if (!HttpMethods.IsHead(Request.Method))
                {
                    QueuePrivateFileOpen(ticket, tenant, t, true, null, currentUser, upstream.Content.Headers.ContentLength);
                    await using var stream = await upstream.Content.ReadAsStreamAsync(HttpContext.RequestAborted).ConfigureAwait(false);
                    await stream.CopyToAsync(Response.Body, HttpContext.RequestAborted).ConfigureAwait(false);
                }
                return new EmptyResult();
            }
            catch (OperationCanceledException) when (HttpContext.RequestAborted.IsCancellationRequested)
            {
                QueuePrivateFileOpen(ticket, tenant, t, false, "访问者取消了下载", currentUser, null);
                return new EmptyResult();
            }
            catch (Exception ex)
            {
                QueuePrivateFileOpen(ticket, tenant, t, false, ex.Message, currentUser, null);
                return StatusCode(StatusCodes.Status502BadGateway);
            }
        }

        private static bool TryResolvePrivateFileAuditTenant(
            string osClient,
            string legacyOsClient,
            out string tenant)
        {
            tenant = null;
            try
            {
                var canonical = osClient.DosIsNullOrWhiteSpace()
                    ? null
                    : TenantConfigurationSecurity.NormalizeTenantId(osClient);
                var legacy = legacyOsClient.DosIsNullOrWhiteSpace()
                    ? null
                    : TenantConfigurationSecurity.NormalizeTenantId(legacyOsClient);
                if (!canonical.DosIsNullOrWhiteSpace()
                    && !legacy.DosIsNullOrWhiteSpace()
                    && !string.Equals(canonical, legacy, StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
                tenant = canonical ?? legacy;
                return !tenant.DosIsNullOrWhiteSpace();
            }
            catch
            {
                return false;
            }
        }

        private void CopyHeader(HttpResponseMessage upstream, string name)
        {
            if (upstream.Headers.TryGetValues(name, out var values) || upstream.Content.Headers.TryGetValues(name, out values))
                Response.Headers[name] = values.ToArray();
        }

        private void QueuePrivateFileOpen(PrivateFileAuditTicket ticket, string osClient, string ticketId, bool success, string error,
            JObject currentUser, long? contentLength)
        {
            var ip = IPHelper.GetClientIP(HttpContext).Data;
            var tracker = MicroiEngine.TryGetService<UserBehaviorSessionTracker>();
            var dedupKey = success
                ? $"private-file|{osClient}|{ticketId}|{currentUser?["Id"]}|{ip}"
                : $"private-file-failure|{osClient}|{ip}";
            if (tracker?.ShouldLogOnce(dedupKey, success ? TimeSpan.FromSeconds(30) : TimeSpan.FromSeconds(10)) == false)
                return;
            var actor = UserBehaviorAudit.FormatUser(currentUser);
            MicroiEngine.QueueSysLog(new SysLogParam
            {
                EventId = UserBehaviorAudit.DeterministicEventId(dedupKey,
                    success ? TimeSpan.FromSeconds(30) : TimeSpan.FromSeconds(10)),
                OsClient = osClient,
                _CurrentUser = currentUser,
                UserId = currentUser?["Id"]?.ToString(),
                UserName = actor,
                Category = "File",
                Action = "PrivateFileOpen",
                Source = "ServerFileGateway",
                TargetType = "PrivateFile",
                TargetId = ticket?.FilePath,
                Type = "私有附件",
                Title = $"用户[{actor}]{(success ? "访问了" : "访问失败") }私有附件[{ticket?.FileName ?? "未知"}]",
                Content = Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    FilePath = ticket?.FilePath,
                    FileName = ticket?.FileName,
                    Issuer = ticket?.IssuerUserName,
                    Anonymous = currentUser == null,
                    ContentLength = contentLength,
                    Range = Request.Headers["Range"].ToString(),
                    Error = error
                }),
                IP = ip,
                Success = success,
                OccurredAt = DateTime.Now,
                Level = success ? 1 : 2
            });
        }
        #endregion
    }
}
