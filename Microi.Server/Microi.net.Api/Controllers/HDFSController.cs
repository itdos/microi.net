using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
using System.Net.Http;
using System.IO;
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
        private async Task DefaultParam(DiyUploadParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            if (currentTokenDynamic != null)
            {
                param._CurrentUser = currentTokenDynamic.CurrentUser;
                param.OsClient = currentTokenDynamic.OsClient;
            }
            param._InvokeType = InvokeType.Client.ToString();
        }

        private string ResolveOsClient(DiyUploadParam param)
        {
            var osClient = param.OsClient;
            if (osClient.DosIsNullOrWhiteSpace()) osClient = Request.Query["OsClient"].ToString();
            if (osClient.DosIsNullOrWhiteSpace()) osClient = Request.Headers["OsClient"].ToString();
            if (osClient.DosIsNullOrWhiteSpace()) osClient = Request.Headers["osclient"].ToString();
            try
            {
                if (osClient.DosIsNullOrWhiteSpace() && Request.HasFormContentType)
                {
                    osClient = Request.Form["OsClient"].ToString();
                }
            }
            catch (InvalidOperationException) { }
            return osClient;
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

        private static bool HasUnsafePathSegment(string value)
        {
            if (value.DosIsNullOrWhiteSpace()) return true;
            var normalized = value.Trim().Replace("\\", "/");
            var isAbsoluteWebUrl = false;
            if (Uri.TryCreate(normalized, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            {
                normalized = uri.AbsolutePath.TrimStart('/');
                isAbsoluteWebUrl = true;
            }
            if (normalized.Contains("..") || normalized.Contains(":") || normalized.Contains("//")) return true;
            if ((!isAbsoluteWebUrl && normalized.StartsWith("/")) || normalized.StartsWith("~")) return true;
            return false;
        }

        private static string NormalizeTenantFilePath(string filePathName)
        {
            var normalized = filePathName.Trim().Replace("\\", "/");
            if (Uri.TryCreate(normalized, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            {
                normalized = uri.AbsolutePath;
            }
            return normalized.Trim().Trim('/').ToLower();
        }

        private static bool IsSafeClientUploadPath(string path)
        {
            if (HasUnsafePathSegment(path)) return false;
            var normalized = path.Trim().Trim('/').Replace("\\", "/");
            if (normalized.DosIsNullOrWhiteSpace()) return false;
            return normalized.Split('/').All(item => !item.DosIsNullOrWhiteSpace());
        }

        private static bool IsTenantFilePath(string osClient, string filePathName)
        {
            if (osClient.DosIsNullOrWhiteSpace() || filePathName.DosIsNullOrWhiteSpace()) return false;
            var normalized = NormalizeTenantFilePath(filePathName);
            if (normalized.DosIsNullOrWhiteSpace() || normalized.Contains("..") || normalized.Contains(":") || normalized.Contains("//") || normalized.StartsWith("~")) return false;
            var client = osClient.Trim('/').ToLower();
            return normalized == client || normalized.StartsWith(client + "/");
        }

        private void LoadFormFiles(DiyUploadParam param)
        {
            param.Files = new Dictionary<string, Stream>();
            if (HttpContext.Request.HasFormContentType)
            {
                foreach (var file in HttpContext.Request.Form.Files)
                {
                    if (file != null)
                        param.Files.Add(file.FileName, file.OpenReadStream());
                }
            }
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
            if (param.Path.DosIsNullOrWhiteSpace()) param.Path = json["Path"]?.Val<string>();
            if (param.Limit == null && json["Limit"] != null) param.Limit = json["Limit"]?.Val<bool>();
            if (param.Preview == null && json["Preview"] != null) param.Preview = json["Preview"]?.Val<bool>();
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
        public async Task<JsonResult> Upload(DiyUploadParam param)
        {
            await DefaultParam(param);

            #region 测试手动传入文件流，也可以不用这样
            param.Files = new Dictionary<string, Stream>();
            if (HttpContext.Request.HasFormContentType)
            {
                foreach (var file in HttpContext.Request.Form.Files)
                {
                    if (file != null)
                        param.Files.Add(file.FileName, file.OpenReadStream());
                }
            }
            #endregion

            //HttpContext为可选参数，在Controller层调用DiyCommon.Upload可以不用传入HttpContext，内部可以自动获取，也可以直接传入文件流。
            //var result = await DiyCommon.Upload(param);//, HttpContext
            var result = await MicroiEngine.HDFS.Upload(param);//, HttpContext
            return Json(result);
        }
        /// <summary>
        /// Uniapp上传，移除Consumes。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> UniappUpload(DiyUploadParam param)
        {
            var currentToken = await DiyToken.GetCurrentToken();
            if (currentToken?.CurrentUser != null)
            {
                return await Upload(param);
            }

            var osClient = ResolveOsClient(param);
            var clientUser = await GetClientUserFromToken(osClient);
            if (clientUser == null)
            {
                return Json(new DosResult(1001, null, "登录身份已过期！"));
            }

            param.Path = ResolveUploadPath(param);
            if (!IsSafeClientUploadPath(param.Path))
            {
                return Json(new DosResult(0, null, "移动端文件上传路径不合法！"));
            }

            param.OsClient = osClient;
            param._CurrentUser = clientUser;
            param._InvokeType = InvokeType.Client.ToString();
            param.Limit ??= true;
            param.Preview ??= true;
            LoadFormFiles(param);

            var result = await MicroiEngine.HDFS.Upload(param);
            return Json(result);
        }

        /// <summary>
        /// 移动端获取私有文件临时访问地址。保留旧 action 名用于兼容已发布客户端。
        /// </summary>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> MallFileUrl(DiyUploadParam param)
        {
            await LoadJsonBody(param);
            param.FilePathName = ResolveFilePathName(param);

            var currentToken = await DiyToken.GetCurrentToken();
            if (currentToken?.CurrentUser != null)
            {
                param._CurrentUser = currentToken.CurrentUser;
                param.OsClient = currentToken.OsClient;
                param._InvokeType = InvokeType.Client.ToString();
                var platformResult = await MicroiEngine.HDFS.GetPrivateFileUrl(param);
                return Json(platformResult);
            }

            var osClient = ResolveOsClient(param);
            var clientUser = await GetClientUserFromToken(osClient);
            if (clientUser == null)
            {
                return Json(new DosResult(1001, null, "登录身份已过期！"));
            }
            if (!IsTenantFilePath(osClient, param.FilePathName))
            {
                return Json(new DosResult(0, null, "移动端仅允许访问当前租户文件！"));
            }

            param.OsClient = osClient;
            param._CurrentUser = clientUser;
            param._InvokeType = InvokeType.Client.ToString();
            param.Limit = true;
            var result = await MicroiEngine.HDFS.GetPrivateFileUrl(param);
            return Json(result);
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

        /// <summary>
        /// 传入 FilePathName
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> GetPrivateFileUrl(DiyUploadParam param)
        {
            await LoadJsonBody(param);
            param.FilePathName = ResolveFilePathName(param);

            var currentToken = await DiyToken.GetCurrentToken();
            if (currentToken?.CurrentUser != null)
            {
                param._CurrentUser = currentToken.CurrentUser;
                param.OsClient = currentToken.OsClient;
                param._InvokeType = InvokeType.Client.ToString();
                var platformResult = await MicroiEngine.HDFS.GetPrivateFileUrl(param);
                return Json(platformResult);
            }

            var osClient = ResolveOsClient(param);
            var clientUser = await GetClientUserFromToken(osClient);
            if (clientUser == null)
            {
                return Json(new DosResult(1001, null, "登录身份已过期！"));
            }
            if (!IsTenantFilePath(osClient, param.FilePathName))
            {
                return Json(new DosResult(0, null, "移动端仅允许访问当前租户文件！"));
            }

            param.OsClient = osClient;
            param._CurrentUser = clientUser;
            param._InvokeType = InvokeType.Client.ToString();
            param.Limit = true;
            var result = await MicroiEngine.HDFS.GetPrivateFileUrl(param);
            return Json(result);
        }

        [HttpPost]
        public async Task<JsonResult> GetOfficeFileMeta([FromBody] JObject param)
        {
            var currentToken = await DiyToken.GetCurrentToken();
            if (currentToken?.CurrentUser == null)
            {
                return Json(new DosResult(1001, null, "登录身份已过期！"));
            }

            var osClient = currentToken.OsClient?.ToString();
            var context = await ResolveOfficeFileContext(param, osClient);
            if (context.Error != null) return Json(context.Error);

            var filePathName = TokenString(param["FilePathName"]);
            var fileMeta = FindOfficeFileMeta(context.FieldValue, filePathName);
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
            var currentToken = await DiyToken.GetCurrentToken();
            if (currentToken?.CurrentUser == null)
            {
                return Json(new DosResult(1001, null, "登录身份已过期！"));
            }

            var osClient = currentToken.OsClient?.ToString();
            var downloadUrl = TokenString(param["DownloadUrl"]);
            var sourceFilePath = TokenString(param["FilePathName"]);
            var hdfs = TokenString(param["HDFS"]);
            var limit = TokenBool(param["Limit"]) ?? true;

            if (downloadUrl.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "DownloadUrl不能为空！"));
            }
            if (sourceFilePath.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }
            if (!IsTenantFilePath(osClient, sourceFilePath))
            {
                return Json(new DosResult(0, null, "仅允许保存当前租户文件！"));
            }

            var onlyOfficeApiBase = await GetOnlyOfficeApiBase(osClient);
            if (!IsAllowedOfficeDownloadUrl(downloadUrl, onlyOfficeApiBase))
            {
                return Json(new DosResult(0, null, "OnlyOffice导出地址不在平台配置的文档服务域名内！"));
            }

            var context = await ResolveOfficeFileContext(param, osClient);
            if (context.Error != null) return Json(context.Error);

            byte[] fileBytes;
            try
            {
                using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(90) };
                using var response = await httpClient.GetAsync(downloadUrl);
                if (!response.IsSuccessStatusCode)
                {
                    return Json(new DosResult(0, null, "OnlyOffice导出文件下载失败：" + (int)response.StatusCode));
                }
                fileBytes = await response.Content.ReadAsByteArrayAsync();
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, "OnlyOffice导出文件下载异常：" + ex.Message));
            }

            if (fileBytes.Length == 0)
            {
                return Json(new DosResult(0, null, "OnlyOffice导出文件内容为空！"));
            }

            var enableVersion = IsOfficeVersionEnabled(context.FieldModel);
            var currentFileMeta = FindOfficeFileMeta(context.FieldValue, sourceFilePath)
                ?? ParseOfficeFileMeta(param["CurrentFileMeta"])
                ?? BuildOfficeFileMetaFromPath(sourceFilePath, TokenString(param["FileName"]));
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

            using var stream = new MemoryStream(fileBytes);
            var putResult = await PutOfficeObject(osClient, hdfs, limit, targetPath, stream);
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
                var currentUser = ToJObject(currentToken.CurrentUser);
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

            var mergedFieldValue = MergeOfficeFileValue(context.FieldValue, updatedFileMeta, mergeSourcePath);
            var updateParam = new JObject
            {
                ["OsClient"] = osClient,
                ["Id"] = TokenString(param["FormDataId"]),
                [context.FieldName] = SerializeOfficeFieldValue(context.FieldValue, mergedFieldValue),
                ["_InvokeType"] = InvokeType.Server.ToString()
            };
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

        private async Task<(string TableName, string FieldName, JObject FieldModel, JToken FieldValue, DosResult Error)> ResolveOfficeFileContext(JObject param, string osClient)
        {
            var formEngineKey = TokenString(param["FormEngineKey"]);
            var formDataId = TokenString(param["FormDataId"]);
            var fieldId = TokenString(param["FieldId"]);

            if (formEngineKey.DosIsNullOrWhiteSpace()) return ("", "", null, null, new DosResult(0, null, "FormEngineKey不能为空！"));
            if (formDataId.DosIsNullOrWhiteSpace()) return ("", "", null, null, new DosResult(0, null, "FormDataId不能为空！"));
            if (fieldId.DosIsNullOrWhiteSpace()) return ("", "", null, null, new DosResult(0, null, "FieldId不能为空！"));

            var tableName = await ResolveDiyTableName(osClient, formEngineKey);
            if (tableName.DosIsNullOrWhiteSpace()) return ("", "", null, null, new DosResult(0, null, "未找到表单引擎：" + formEngineKey));

            var fieldModel = await ResolveDiyFieldModel(osClient, fieldId, tableName);
            var fieldName = TokenString(fieldModel?["Name"]);
            if (fieldName.DosIsNullOrWhiteSpace()) fieldName = fieldId;
            if (fieldName.DosIsNullOrWhiteSpace()) return ("", "", null, null, new DosResult(0, null, "未找到文件字段：" + fieldId));

            var rowResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(tableName, new JObject
            {
                ["OsClient"] = osClient,
                ["Id"] = formDataId
            });
            if (rowResult.Code != 1)
            {
                return ("", "", null, null, new DosResult(rowResult.Code, rowResult.Data, "未找到业务数据：" + rowResult.Msg));
            }

            var row = ToJObject((object)rowResult.Data);
            return (tableName, fieldName, fieldModel, row?[fieldName], null);
        }

        private async Task<string> ResolveDiyTableName(string osClient, string formEngineKey)
        {
            var byId = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new JObject
            {
                ["OsClient"] = osClient,
                ["Id"] = formEngineKey,
                ["IsDeleted"] = 0
            });
            if (byId.Code == 1)
            {
                return TokenString(ToJObject((object)byId.Data)?["Name"]);
            }

            var byName = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new JObject
            {
                ["OsClient"] = osClient,
                ["Name"] = formEngineKey,
                ["IsDeleted"] = 0
            });
            return byName.Code == 1 ? TokenString(ToJObject((object)byName.Data)?["Name"]) : formEngineKey;
        }

        private async Task<JObject> ResolveDiyFieldModel(string osClient, string fieldId, string tableName)
        {
            var byId = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_field", new JObject
            {
                ["OsClient"] = osClient,
                ["Id"] = fieldId,
                ["IsDeleted"] = 0
            });
            if (byId.Code == 1) return ToJObject((object)byId.Data);

            var byName = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_field", new JObject
            {
                ["OsClient"] = osClient,
                ["TableName"] = tableName,
                ["Name"] = fieldId,
                ["IsDeleted"] = 0
            });
            return byName.Code == 1 ? ToJObject((object)byName.Data) : null;
        }

        private async Task<string> GetOnlyOfficeApiBase(string osClient)
        {
            var sysConfig = await MicroiEngine.FormEngine.GetSysConfig(osClient);
            if (sysConfig.Code != 1 || sysConfig.Data == null) return "";
            return TokenString(ToJObject((object)sysConfig.Data)?["OnlyOfficeApiBase"]);
        }

        private static bool IsAllowedOfficeDownloadUrl(string downloadUrl, string onlyOfficeApiBase)
        {
            if (!Uri.TryCreate(downloadUrl, UriKind.Absolute, out var downloadUri)) return false;
            if (downloadUri.Scheme != Uri.UriSchemeHttp && downloadUri.Scheme != Uri.UriSchemeHttps) return false;
            if (onlyOfficeApiBase.DosIsNullOrWhiteSpace()) return false;
            if (!Uri.TryCreate(onlyOfficeApiBase, UriKind.Absolute, out var officeUri)) return false;
            return string.Equals(downloadUri.Host, officeUri.Host, StringComparison.OrdinalIgnoreCase)
                && downloadUri.Port == officeUri.Port;
        }

        private async Task<DosResult> PutOfficeObject(string osClient, string hdfs, bool? limit, string fileFullPath, Stream fileStream)
        {
            var clientModel = OsClient.GetClient(osClient);
            var defaultHdfs = TokenString(ToJObject((object)clientModel.OsClientModel)?["HDFS"]);
            if (hdfs.DosIsNullOrWhiteSpace() && !defaultHdfs.DosIsNullOrWhiteSpace())
            {
                hdfs = defaultHdfs;
            }

            IMicroiHDFS hdfsClient = hdfs switch
            {
                "MinIO" => MicroiEngine.HDFSFactory(HDFSType.MinIO),
                "S3" => MicroiEngine.HDFSFactory(HDFSType.AmazonS3),
                _ => MicroiEngine.HDFSFactory(HDFSType.Aliyun)
            };

            return await hdfsClient.PutObject(new HDFSParam
            {
                ClientModel = clientModel,
                Limit = limit,
                FileFullPath = fileFullPath.TrimStart('/'),
                FileStream = fileStream
            });
        }

        private static bool IsOfficeVersionEnabled(JObject fieldModel)
        {
            var configText = TokenString(fieldModel?["Config"]);
            if (configText.DosIsNullOrWhiteSpace()) return false;
            try
            {
                var config = JObject.Parse(configText);
                return TokenBool(config.SelectToken("FileUpload.EnableOfficeVersion")) == true;
            }
            catch
            {
                return false;
            }
        }

        private static JObject FindOfficeFileMeta(JToken fieldValue, string sourceFilePath)
        {
            var parsed = ParseOfficeFieldValue(fieldValue);
            if (parsed == null) return null;
            if (parsed is JObject obj) return obj;
            if (parsed is not JArray arr) return null;

            var normalizedSource = NormalizeComparePath(sourceFilePath);
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
            return NormalizeStoragePath(path).ToLowerInvariant();
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
            await DefaultParam(param);
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
            await DefaultParam(param);

            if (param.FilePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }

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
            await DefaultParam(param);

            if (param.FilePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }

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
            await DefaultParam(param);

            if (param.FilePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }
            if (param.Path.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "新路径Path不能为空！"));
            }

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
            await DefaultParam(param);

            if (param.FilePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }
            if (param.Path.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "目标路径Path不能为空！"));
            }

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
            await DefaultParam(param);

            param.Files = new Dictionary<string, Stream>();
            if (HttpContext.Request.HasFormContentType)
            {
                foreach (var file in HttpContext.Request.Form.Files)
                {
                    if (file != null)
                        param.Files.Add(file.FileName, file.OpenReadStream());
                }
            }

            // 文件管理上传不压缩
            param.Preview = false;

            var result = await MicroiEngine.HDFS.Upload(param);
            return Json(result);
        }

        #endregion
    }
}
