using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Newtonsoft.Json.Linq;
using System.Net;
using System.Net.Security;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Microi.net.Api;

public partial class HDFSController
{
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
}
