using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;

namespace Microi.net.Api
{
    /// <summary>
    /// Serves tenant front-end micro-app build assets stored on sys_microiservice.
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class MicroAppController : Controller
    {
        private const string ServiceTable = "sys_microiservice";
        private const string DefaultVersion = "current";
        private static readonly HttpClient PublicFileHttpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(30)
        };

        [HttpGet("~/micro-app/{osClient}/{appKey}/index.html")]
        [HttpHead("~/micro-app/{osClient}/{appKey}/index.html")]
        [AllowAnonymous]
        public async Task<IActionResult> Current(
            [FromRoute] string osClient,
            [FromRoute] string appKey)
        {
            if (osClient.DosIsNullOrWhiteSpace() || appKey.DosIsNullOrWhiteSpace())
            {
                return NotFound("MicroApp parameters are incomplete.");
            }

            var service = await GetService(osClient, appKey);
            if (!IsUsable(service))
            {
                return NotFound($"MicroApp is not enabled or not found: {appKey}");
            }

            var externalUrl = (service["MsUrl"].Val<string>() ?? "").Trim();
            if (IsExternalStorage(service) && !externalUrl.DosIsNullOrWhiteSpace())
            {
                return Redirect(externalUrl);
            }

            var version = ResolveVersion(service);
            return Redirect(BuildAssetUrl(osClient, appKey, version, ResolveEntryPath(service)));
        }

        [HttpGet("~/micro-app/{osClient}/{appKey}/{version}/{*assetPath}")]
        [HttpHead("~/micro-app/{osClient}/{appKey}/{version}/{*assetPath}")]
        [AllowAnonymous]
        public async Task<IActionResult> Asset(
            [FromRoute] string osClient,
            [FromRoute] string appKey,
            [FromRoute] string version,
            [FromRoute] string assetPath = "index.html")
        {
            if (osClient.DosIsNullOrWhiteSpace() || appKey.DosIsNullOrWhiteSpace())
            {
                return NotFound("MicroApp parameters are incomplete.");
            }

            var service = await GetService(osClient, appKey);
            if (!IsUsable(service))
            {
                return NotFound($"MicroApp is not enabled or not found: {appKey}");
            }
            if (IsExternalStorage(service))
            {
                var externalUrl = (service["MsUrl"].Val<string>() ?? "").Trim();
                return externalUrl.DosIsNullOrWhiteSpace() ? NotFound($"MicroApp has no external URL: {appKey}") : Redirect(externalUrl);
            }
            if (!IsFileStorage(service) && !IsDbStorage(service))
            {
                return NotFound($"MicroApp has no managed assets: {appKey}");
            }

            var currentVersion = ResolveVersion(service);
            assetPath = NormalizeAssetPath(assetPath);
            JObject asset = null;
            Func<JObject, string, JObject> findAsset = IsFileStorage(service) ? FindFileAsset : FindAsset;

            if (!version.DosIsNullOrWhiteSpace() && !string.Equals(version, currentVersion, StringComparison.OrdinalIgnoreCase))
            {
                var unversionedAssetPath = CombineAssetPath(version, assetPath);
                asset = findAsset(service, unversionedAssetPath);
                if (asset == null)
                {
                    return NotFound($"MicroApp version is not current: {appKey}@{version}");
                }
                assetPath = unversionedAssetPath;
            }
            else
            {
                asset = findAsset(service, assetPath);
            }

            if (asset == null && assetPath.Equals("index.html", StringComparison.OrdinalIgnoreCase))
            {
                asset = findAsset(service, ResolveEntryPath(service));
            }
            if (asset == null)
            {
                return NotFound($"MicroApp asset not found: {appKey}@{currentVersion}/{assetPath}");
            }

            if (IsFileStorage(service))
            {
                var inlineBase64 = GetText(asset, "contentBase64", "ContentBase64");
                if (!inlineBase64.DosIsNullOrWhiteSpace())
                {
                    byte[] inlineBytes;
                    try
                    {
                        inlineBytes = Convert.FromBase64String(inlineBase64);
                    }
                    catch
                    {
                        return StatusCode(500, $"MicroApp inline asset base64 is invalid: {assetPath}");
                    }

                    var inlineContentType = GetText(asset, "contentType", "ContentType");
                    if (inlineContentType.DosIsNullOrWhiteSpace())
                    {
                        inlineContentType = GuessContentType(assetPath);
                    }
                    SetAssetHeaders(appKey, currentVersion, assetPath, asset);
                    return File(inlineBytes, inlineContentType);
                }

                var redirectUrl = await ResolveFileAssetUrl(osClient, asset);
                if (redirectUrl.DosIsNullOrWhiteSpace())
                {
                    return NotFound($"MicroApp file asset has no URL: {assetPath}");
                }

                var proxyBytes = await ReadFileAssetBytes(osClient, asset, redirectUrl);
                if (proxyBytes != null)
                {
                    var proxyContentType = GetText(asset, "contentType", "ContentType");
                    if (proxyContentType.DosIsNullOrWhiteSpace())
                    {
                        proxyContentType = GuessContentType(assetPath);
                    }
                    SetAssetHeaders(appKey, currentVersion, assetPath, asset);
                    return File(proxyBytes, proxyContentType);
                }

                SetAssetHeaders(appKey, currentVersion, assetPath, asset);
                return Redirect(redirectUrl);
            }

            var contentBase64 = GetText(asset, "contentBase64", "ContentBase64");
            if (contentBase64.DosIsNullOrWhiteSpace())
            {
                return NotFound($"MicroApp asset is empty: {assetPath}");
            }

            byte[] bytes;
            try
            {
                bytes = Convert.FromBase64String(contentBase64);
            }
            catch
            {
                return StatusCode(500, $"MicroApp asset base64 is invalid: {assetPath}");
            }

            var contentType = GetText(asset, "contentType", "ContentType");
            if (contentType.DosIsNullOrWhiteSpace())
            {
                contentType = GuessContentType(assetPath);
            }

            SetAssetHeaders(appKey, currentVersion, assetPath, asset);

            return File(bytes, contentType);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> Resolve(string osClient, string appKey, string version = null, [FromBody] JObject param = null)
        {
            osClient = osClient ?? param?["OsClient"].Val<string>();
            appKey = appKey ?? param?["AppKey"].Val<string>();
            version = version ?? param?["Version"].Val<string>();

            if (osClient.DosIsNullOrWhiteSpace())
            {
                var token = await DiyToken.GetCurrentToken(false);
                osClient = token?.OsClient;
            }
            if (osClient.DosIsNullOrWhiteSpace() || appKey.DosIsNullOrWhiteSpace())
            {
                return Ok(new DosResult(0, null, "OsClient and AppKey are required."));
            }

            var service = await GetService(osClient, appKey);
            if (!IsUsable(service))
            {
                return Ok(new DosResult(0, null, "MicroApp is not enabled or not found."));
            }

            var resolvedVersion = ResolveVersion(service);
            if (!version.DosIsNullOrWhiteSpace() && !string.Equals(version, resolvedVersion, StringComparison.OrdinalIgnoreCase))
            {
                return Ok(new DosResult(0, null, "Requested version is not current."));
            }

            var entryUrl = IsManagedStorage(service)
                ? BuildAssetUrl(osClient, appKey, resolvedVersion, ResolveEntryPath(service))
                : service["MsUrl"].Val<string>();

            return Ok(new DosResult(1, new
            {
                OsClient = osClient,
                AppKey = appKey,
                Version = resolvedVersion,
                EntryUrl = entryUrl,
                StorageMode = service["StorageMode"].Val<string>(),
                Runtime = service["Runtime"].Val<string>()
            }));
        }

        private static string NormalizeAssetPath(string assetPath)
        {
            if (assetPath.DosIsNullOrWhiteSpace()) return "index.html";
            assetPath = Uri.UnescapeDataString(assetPath).Replace('\\', '/').TrimStart('/');
            return assetPath.DosIsNullOrWhiteSpace() ? "index.html" : assetPath;
        }

        private static string CombineAssetPath(string firstSegment, string restPath)
        {
            var first = NormalizeAssetPath(firstSegment);
            var rest = NormalizeAssetPath(restPath);

            if (rest.Equals("index.html", StringComparison.OrdinalIgnoreCase)
                && !Path.GetExtension(first).DosIsNullOrWhiteSpace())
            {
                return first;
            }

            return NormalizeAssetPath($"{first}/{rest}");
        }

        private static string ResolveEntryPath(JObject service)
        {
            var entry = service?["EntryPath"].Val<string>();
            return NormalizeAssetPath(entry.DosIsNullOrWhiteSpace() ? "index.html" : entry);
        }

        private static string ResolveVersion(JObject service)
        {
            var version = service?["BuildVersion"].Val<string>();
            return version.DosIsNullOrWhiteSpace() ? DefaultVersion : version;
        }

        private static string BuildAssetUrl(string osClient, string appKey, string version, string assetPath)
        {
            return $"/micro-app/{Uri.EscapeDataString(osClient)}/{Uri.EscapeDataString(appKey)}/{Uri.EscapeDataString(version)}/{EscapeAssetPath(assetPath)}";
        }

        private static string EscapeAssetPath(string assetPath)
        {
            var segments = NormalizeAssetPath(assetPath).Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length == 0) return "index.html";
            for (var i = 0; i < segments.Length; i++)
            {
                segments[i] = Uri.EscapeDataString(segments[i]);
            }
            return string.Join("/", segments);
        }

        private static JObject ToJObject(object data)
        {
            if (data == null) return null;
            if (data is JObject jobj) return jobj;
            return JObject.FromObject(data);
        }

        private static JArray Where(params JArray[] items)
        {
            var where = new JArray();
            foreach (var item in items) where.Add(item);
            return where;
        }

        private static async Task<JObject> GetService(string osClient, string appKey)
        {
            var param = new JObject
            {
                ["FormEngineKey"] = ServiceTable,
                ["OsClient"] = osClient,
                ["_IsAnonymous"] = true,
                ["_Where"] = Where(new JArray("MsKey", "=", appKey)),
                ["_SelectFields"] = new JArray(
                    "Id",
                    "MsKey",
                    "MsName",
                    "MsUrl",
                    "MsDevUrl",
                    "MsType",
                    "IsEnable",
                    "StorageMode",
                    "Runtime",
                    "BuildVersion",
                    "EntryPath",
                    "AssetManifestJson",
                    "AssetsJson",
                    "DistHash",
                    "AssetCount",
                    "TotalSize",
                    "PublishTime",
                    "SourceDirName"
                )
            };

            dynamic result = await MicroiEngine.FormEngine.GetFormDataAsync(param);
            return result.Code == 1 ? ToJObject(result.Data) : null;
        }

        private static bool IsUsable(JObject service)
        {
            if (service == null) return false;
            var value = service["IsEnable"];
            if (value == null || value.Type == JTokenType.Null) return true;
            if (value.Type == JTokenType.Boolean) return value.Val<bool>();
            var text = value.Val<string>()?.Trim().ToLowerInvariant();
            return !(text == "0" || text == "false" || text == "disabled" || text == "停用");
        }

        private static bool IsDbStorage(JObject service)
        {
            var storageMode = service?["StorageMode"].Val<string>();
            if (!storageMode.DosIsNullOrWhiteSpace())
            {
                return storageMode.Equals("db", StringComparison.OrdinalIgnoreCase)
                    || storageMode.Equals("database", StringComparison.OrdinalIgnoreCase);
            }
            return HasDbAssetBundle(service);
        }

        private static bool IsFileStorage(JObject service)
        {
            var storageMode = service?["StorageMode"].Val<string>();
            if (!storageMode.DosIsNullOrWhiteSpace())
            {
                return IsFileStorageMode(storageMode);
            }
            return HasFileAssetManifest(service);
        }

        private static bool IsManagedStorage(JObject service)
        {
            return IsFileStorage(service) || IsDbStorage(service);
        }

        private static bool IsExternalStorage(JObject service)
        {
            var externalUrl = (service?["MsUrl"].Val<string>() ?? "").Trim();
            if (externalUrl.DosIsNullOrWhiteSpace() || IsStorageSentinel(externalUrl))
            {
                return false;
            }
            return !IsManagedStorage(service);
        }

        private static bool IsFileStorageMode(string storageMode)
        {
            return storageMode.Equals("file", StringComparison.OrdinalIgnoreCase)
                || storageMode.Equals("hdfs", StringComparison.OrdinalIgnoreCase)
                || storageMode.Equals("oss", StringComparison.OrdinalIgnoreCase)
                || storageMode.Equals("cdn", StringComparison.OrdinalIgnoreCase)
                || storageMode.Equals("object", StringComparison.OrdinalIgnoreCase)
                || storageMode.Equals("objectstorage", StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsStorageSentinel(string value)
        {
            return value.Equals("file", StringComparison.OrdinalIgnoreCase)
                || value.Equals("db", StringComparison.OrdinalIgnoreCase)
                || value.Equals("database", StringComparison.OrdinalIgnoreCase)
                || IsFileStorageMode(value);
        }

        private static bool HasDbAssetBundle(JObject service)
        {
            var assets = ReadAssets(service);
            foreach (var item in assets)
            {
                if (item is JObject asset && !GetText(asset, "contentBase64", "ContentBase64").DosIsNullOrWhiteSpace())
                {
                    return true;
                }
            }
            return false;
        }

        private static bool HasFileAssetManifest(JObject service)
        {
            var assets = ReadManifestAssets(service);
            foreach (var item in assets)
            {
                if (item is not JObject asset) continue;
                if (!GetText(
                        asset,
                        "filePathName",
                        "FilePathName",
                        "filePath",
                        "FilePath",
                        "url",
                        "Url",
                        "fullPath",
                        "FullPath",
                        "fileUrl",
                        "FileUrl",
                        "publicUrl",
                        "PublicUrl",
                        "contentBase64",
                        "ContentBase64"
                    ).DosIsNullOrWhiteSpace())
                {
                    return true;
                }
            }
            return false;
        }

        private static JObject FindAsset(JObject service, string assetPath)
        {
            var assets = ReadAssets(service);
            foreach (var item in assets)
            {
                if (item is not JObject asset) continue;
                var path = NormalizeAssetPath(GetText(asset, "path", "Path"));
                if (path.Equals(assetPath, StringComparison.OrdinalIgnoreCase))
                {
                    return asset;
                }
            }
            return null;
        }

        private static JObject FindFileAsset(JObject service, string assetPath)
        {
            var assets = ReadManifestAssets(service);
            foreach (var item in assets)
            {
                if (item is not JObject asset) continue;
                var path = NormalizeAssetPath(GetText(asset, "path", "Path"));
                if (path.Equals(assetPath, StringComparison.OrdinalIgnoreCase))
                {
                    return asset;
                }
            }
            return null;
        }

        private static JArray ReadAssets(JObject service)
        {
            var raw = service?["AssetsJson"].Val<string>();
            if (raw.DosIsNullOrWhiteSpace()) return new JArray();
            try
            {
                var token = JToken.Parse(raw);
                if (token is JArray arr) return arr;
                if (token is JObject obj && obj["assets"] is JArray assets) return assets;
                if (token is JObject obj2 && obj2["Assets"] is JArray assets2) return assets2;
            }
            catch
            {
                return new JArray();
            }
            return new JArray();
        }

        private static JArray ReadManifestAssets(JObject service)
        {
            var raw = service?["AssetManifestJson"].Val<string>();
            if (raw.DosIsNullOrWhiteSpace()) return new JArray();
            try
            {
                var token = JToken.Parse(raw);
                if (token is JArray arr) return arr;
                if (token is JObject obj && obj["assets"] is JArray assets) return assets;
                if (token is JObject obj2 && obj2["Assets"] is JArray assets2) return assets2;
            }
            catch
            {
                return new JArray();
            }
            return new JArray();
        }

        private async Task<string> ResolveFileAssetUrl(string osClient, JObject asset)
        {
            var url = GetText(asset, "url", "Url", "fullPath", "FullPath", "fileUrl", "FileUrl", "publicUrl", "PublicUrl");
            if (!url.DosIsNullOrWhiteSpace())
            {
                return await BuildPublicFileUrl(osClient, url);
            }

            var filePathName = GetText(asset, "filePathName", "FilePathName", "filePath", "FilePath");
            if (filePathName.DosIsNullOrWhiteSpace())
            {
                return "";
            }
            return await BuildPublicFileUrl(osClient, filePathName);
        }

        private async Task<string> BuildPublicFileUrl(string osClient, string filePathOrUrl)
        {
            var value = filePathOrUrl?.Trim();
            if (value.DosIsNullOrWhiteSpace()) return "";
            if (value.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                || value.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return value;
            }

            var fileServer = await GetFileServer(osClient);
            return $"{fileServer.TrimEnd('/')}/{value.TrimStart('/')}";
        }

        private static async Task<byte[]> ReadFileAssetBytes(string osClient, JObject asset, string fileUrl)
        {
            var filePathName = GetText(asset, "filePathName", "FilePathName", "filePath", "FilePath");
            if (!filePathName.DosIsNullOrWhiteSpace())
            {
                try
                {
                    var fileResult = await MicroiEngine.HDFS.GetPrivateFileByte(new DiyUploadParam
                    {
                        OsClient = osClient,
                        FilePathName = filePathName,
                        Limit = false
                    });
                    if (fileResult.Code == 1 && fileResult.Data is byte[] fileBytes)
                    {
                        return fileBytes;
                    }
                }
                catch
                {
                    // Fall back to public URL download below.
                }
            }
            if (await IsTrustedPublicFileUrl(osClient, fileUrl))
            {
                return await DownloadPublicFileAssetBytes(fileUrl);
            }
            return null;
        }

        private static async Task<bool> IsTrustedPublicFileUrl(string osClient, string fileUrl)
        {
            if (!Uri.TryCreate(fileUrl, UriKind.Absolute, out var assetUri))
            {
                return false;
            }
            if (!assetUri.Scheme.Equals(Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
                && !assetUri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            var fileServer = await GetFileServer(osClient);
            if (!Uri.TryCreate(fileServer, UriKind.Absolute, out var fileServerUri))
            {
                return false;
            }
            return assetUri.Host.Equals(fileServerUri.Host, StringComparison.OrdinalIgnoreCase)
                && assetUri.Port == fileServerUri.Port;
        }

        private static async Task<byte[]> DownloadPublicFileAssetBytes(string fileUrl)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, fileUrl);
                request.Headers.UserAgent.ParseAdd("Microi-MicroApp/1.0");
                using var response = await PublicFileHttpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }
                return await response.Content.ReadAsByteArrayAsync();
            }
            catch
            {
                return null;
            }
        }

        private static async Task<string> GetFileServer(string osClient)
        {
            try
            {
                dynamic result = await MicroiEngine.FormEngine.GetSysConfig(osClient);
                if (result.Code == 1 && result.Data != null)
                {
                    var config = ToJObject(result.Data);
                    var fileServer = config?["FileServer"].Val<string>();
                    if (!fileServer.DosIsNullOrWhiteSpace()) return fileServer;
                }
            }
            catch
            {
                // Use platform default below.
            }
            return "https://static.itdos.com";
        }

        private void SetAssetHeaders(string appKey, string currentVersion, string assetPath, JObject asset)
        {
            var sha256 = GetText(asset, "sha256", "Sha256");
            if (!sha256.DosIsNullOrWhiteSpace())
            {
                Response.Headers["ETag"] = $"\"{sha256}\"";
            }
            Response.Headers["X-Microi-MicroApp"] = $"{appKey}@{currentVersion}";
            Response.Headers["Cache-Control"] = assetPath.Equals("index.html", StringComparison.OrdinalIgnoreCase)
                ? "no-cache, no-store, must-revalidate"
                : "public, max-age=31536000, immutable";
        }

        private static string GetText(JObject obj, params string[] names)
        {
            foreach (var name in names)
            {
                var value = obj?[name].Val<string>();
                if (!value.DosIsNullOrWhiteSpace()) return value;
            }
            return "";
        }

        private static string GuessContentType(string assetPath)
        {
            return Path.GetExtension(assetPath).ToLowerInvariant() switch
            {
                ".html" => "text/html; charset=utf-8",
                ".js" => "text/javascript; charset=utf-8",
                ".mjs" => "text/javascript; charset=utf-8",
                ".css" => "text/css; charset=utf-8",
                ".json" => "application/json; charset=utf-8",
                ".svg" => "image/svg+xml",
                ".png" => "image/png",
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                ".gif" => "image/gif",
                ".webp" => "image/webp",
                ".ico" => "image/x-icon",
                ".woff" => "font/woff",
                ".woff2" => "font/woff2",
                ".ttf" => "font/ttf",
                ".map" => "application/json; charset=utf-8",
                _ => "application/octet-stream"
            };
        }
    }
}
