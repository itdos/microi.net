using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.IO;

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