using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// UEditor 兼容上传。multipart 文件直接以受限流进入当前租户私有 HDFS，
    /// 不再复制为整文件 byte[]；只有协议要求的 Base64 涂鸦执行有界解码。
    /// </summary>
    public class UploadHandler : Handler
    {
        public UploadConfig UploadConfig { get; }
        public UploadResult Result { get; }

        public UploadHandler(HttpContext context, UploadConfig config)
            : base(context)
        {
            UploadConfig = config ?? throw new ArgumentNullException(nameof(config));
            Result = new UploadResult { State = UploadState.Unknown };
        }

        public override async Task<UEditorResult> Process()
        {
            Stream uploadStream = null;
            CurrentToken currentToken = null;
            try
            {
                var form = await Request.ReadFormAsync().ConfigureAwait(false);
                string uploadFileName;
                if (UploadConfig.Base64)
                {
                    uploadFileName = Path.GetFileName(UploadConfig.Base64Filename ?? "scrawl.png");
                    var encoded = form[UploadConfig.UploadFieldName].ToString();
                    if (!FileUploadSecurity.TryGetBase64DecodedLength(encoded, out var decodedLength)
                        || !CheckFileSize(decodedLength))
                    {
                        Result.State = UploadState.SizeLimitExceed;
                        return WriteResult();
                    }
                    uploadStream = new MemoryStream(
                        Convert.FromBase64String(encoded),
                        writable: false);
                }
                else
                {
                    var file = form.Files.GetFile(UploadConfig.UploadFieldName)
                        ?? form.Files.FirstOrDefault();
                    if (file == null)
                    {
                        Result.State = UploadState.NetworkError;
                        Result.ErrorMessage = "未找到上传文件。";
                        return WriteResult();
                    }
                    uploadFileName = Path.GetFileName(file.FileName ?? string.Empty);
                    if (!CheckFileType(uploadFileName))
                    {
                        Result.State = UploadState.TypeNotAllow;
                        return WriteResult();
                    }
                    if (!CheckFileSize(file.Length))
                    {
                        Result.State = UploadState.SizeLimitExceed;
                        return WriteResult();
                    }
                    uploadStream = file.OpenReadStream();
                }

                if (uploadFileName.DosIsNullOrWhiteSpace())
                {
                    Result.State = UploadState.TypeNotAllow;
                    return WriteResult();
                }
                Result.OriginFileName = uploadFileName;

                currentToken = await DiyToken.GetCurrentToken().ConfigureAwait(false);
                if (currentToken?.CurrentUser == null
                    || currentToken.OsClient.DosIsNullOrWhiteSpace())
                {
                    Result.State = UploadState.FileAccessError;
                    Result.ErrorMessage = "登录身份已失效，请重新登录。";
                    return WriteResult();
                }

                var uploadResult = await MicroiEngine.HDFS.Upload(new DiyUploadParam
                {
                    Limit = true,
                    Preview = false,
                    Multiple = false,
                    Path = "editor",
                    OsClient = TenantConfigurationSecurity.NormalizeTenantId(
                        Convert.ToString(currentToken.OsClient)),
                    _CurrentUser = currentToken.CurrentUser,
                    _InvokeType = InvokeType.Client.ToString(),
                    Files = new Dictionary<string, Stream>
                    {
                        [uploadFileName] = uploadStream
                    }
                }).ConfigureAwait(false);

                if (uploadResult?.Code == 1)
                {
                    Result.Url = JObject.FromObject(uploadResult.Data)["Path"].Val<string>();
                    Result.State = UploadState.Success;
                }
                else
                {
                    Result.State = UploadState.FileAccessError;
                    Result.ErrorMessage = "私有文件上传失败，请稍后重试。";
                    QueueUploadFailure(currentToken, uploadResult?.Msg ?? "HDFS upload returned no result.");
                }
            }
            catch (FormatException)
            {
                Result.State = UploadState.TypeNotAllow;
                Result.ErrorMessage = "Base64 文件格式不正确。";
            }
            catch (Exception ex)
            {
                Result.State = UploadState.FileAccessError;
                Result.ErrorMessage = "私有文件上传失败，请稍后重试。";
                QueueUploadFailure(currentToken, ex.ToString());
            }
            finally
            {
                uploadStream?.Dispose();
            }
            return WriteResult();
        }

        private static void QueueUploadFailure(CurrentToken currentToken, string detail)
        {
            detail ??= "Unknown UEditor upload error.";
            MicroiEngine.QueueSysLog(new SysLogParam
            {
                OsClient = Convert.ToString(currentToken?.OsClient),
                _CurrentUser = currentToken?.CurrentUser,
                Category = "File",
                Action = "UEditorUploadFailed",
                Source = "UEditorGateway",
                Type = "UEditor",
                Title = "UEditor 私有文件上传失败",
                Content = detail.Length > 4000 ? detail.Substring(0, 4000) : detail,
                Success = false,
                OccurredAt = DateTime.Now,
                Level = 2
            });
        }

        private UEditorResult WriteResult()
        {
            return new UEditorResult
            {
                State = GetStateMessage(Result.State),
                Url = Result.Url,
                Title = Result.OriginFileName,
                Original = Result.OriginFileName,
                Error = Result.ErrorMessage,
                Code = 200
            };
        }

        private static string GetStateMessage(UploadState state)
        {
            switch (state)
            {
                case UploadState.Success:
                    return "SUCCESS";
                case UploadState.FileAccessError:
                    return "文件访问出错，请检查写入权限";
                case UploadState.SizeLimitExceed:
                    return "文件大小超出服务器限制";
                case UploadState.TypeNotAllow:
                    return "不允许的文件格式";
                case UploadState.NetworkError:
                    return "网络错误";
                default:
                    return "未知错误";
            }
        }

        private bool CheckFileType(string filename)
        {
            var extension = Path.GetExtension(filename ?? string.Empty);
            return UploadConfig.AllowExtensions?.Any(allowed =>
                string.Equals(allowed, extension, StringComparison.OrdinalIgnoreCase)) == true;
        }

        private bool CheckFileSize(long size)
        {
            return size >= 0 && UploadConfig.SizeLimit > 0 && size < UploadConfig.SizeLimit;
        }
    }

    public class UploadConfig
    {
        public string UploadFieldName { get; set; }
        public int SizeLimit { get; set; }
        public string[] AllowExtensions { get; set; }
        public bool Base64 { get; set; }
        public string Base64Filename { get; set; }
    }

    public class UploadResult
    {
        public UploadState State { get; set; }
        public string Url { get; set; }
        public string OriginFileName { get; set; }
        public string ErrorMessage { get; set; }
    }

    public enum UploadState
    {
        Success = 0,
        FileAccessError = -1,
        SizeLimitExceed = -2,
        TypeNotAllow = -3,
        NetworkError = -4,
        Unknown = 1
    }
}
