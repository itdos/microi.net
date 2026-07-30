using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
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
            return await ServeManagedAsset(
                osClient,
                appKey,
                version,
                ResolveEntryPath(service),
                service,
                rewriteStableEntry: true);
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

            return await ServeManagedAsset(
                osClient,
                appKey,
                version,
                assetPath,
                service,
                rewriteStableEntry: false);
        }

        private async Task<IActionResult> ServeManagedAsset(
            string osClient,
            string appKey,
            string version,
            string assetPath,
            JObject service,
            bool rewriteStableEntry)
        {
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
                    inlineBytes = RewriteStableEntryHtml(
                        inlineBytes,
                        inlineContentType,
                        osClient,
                        appKey,
                        currentVersion,
                        rewriteStableEntry);
                    SetAssetHeaders(appKey, currentVersion, assetPath, asset, rewriteStableEntry);
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
                    proxyBytes = RewriteStableEntryHtml(
                        proxyBytes,
                        proxyContentType,
                        osClient,
                        appKey,
                        currentVersion,
                        rewriteStableEntry);
                    SetAssetHeaders(appKey, currentVersion, assetPath, asset, rewriteStableEntry);
                    return File(proxyBytes, proxyContentType);
                }

                SetAssetHeaders(appKey, currentVersion, assetPath, asset, rewriteStableEntry);
                return StatusCode(502, $"MicroApp file asset could not be read from managed storage: {assetPath}");
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

            bytes = RewriteStableEntryHtml(
                bytes,
                contentType,
                osClient,
                appKey,
                currentVersion,
                rewriteStableEntry);

            SetAssetHeaders(appKey, currentVersion, assetPath, asset, rewriteStableEntry);

            return File(bytes, contentType);
        }

        [HttpGet, HttpPost]
        public async Task<IActionResult> Resolve(string osClient, string appKey, string version = null, string routePath = null, bool requirePage = false, [FromBody] JObject param = null)
        {
            osClient = osClient ?? param?["OsClient"].Val<string>();
            appKey = appKey ?? param?["AppKey"].Val<string>();
            version = version ?? param?["Version"].Val<string>();
            routePath = routePath ?? param?["RoutePath"].Val<string>() ?? param?["MicroRoute"].Val<string>();
            requirePage = requirePage || param?["RequirePage"].Val<bool?>() == true;

            var token = await DiyToken.GetCurrentToken(false);
            var tokenOsClient = Convert.ToString(token?.OsClient);
            if (tokenOsClient.DosIsNullOrWhiteSpace())
            {
                return Ok(new DosResult(1001, null, "登录状态已失效，请重新登录。"));
            }
            if (!osClient.DosIsNullOrWhiteSpace()
                && !string.Equals(osClient, tokenOsClient, StringComparison.OrdinalIgnoreCase))
            {
                return Ok(new DosResult(0, new { ReasonCode = "TENANT_MISMATCH" }, "当前登录租户与请求租户不一致。"));
            }
            osClient = tokenOsClient;
            if (osClient.DosIsNullOrWhiteSpace() || appKey.DosIsNullOrWhiteSpace())
            {
                return Ok(new DosResult(0, null, "OsClient and AppKey are required."));
            }

            // Resolve only needs lightweight runtime metadata. Loading the
            // compiled asset payload here makes every menu navigation scale
            // with the complete application size and is not viable for large
            // streamed micro-services.
            var service = await GetService(osClient, appKey, includeAssetPayloads: false);
            if (!IsUsable(service))
            {
                return Ok(new DosResult(0, new { ReasonCode = "MICRO_APP_NOT_AVAILABLE" }, "微服务不存在或已停用。"));
            }

            var resolvedVersion = ResolveVersion(service);
            if (!version.DosIsNullOrWhiteSpace() && !string.Equals(version, resolvedVersion, StringComparison.OrdinalIgnoreCase))
            {
                return Ok(new DosResult(0, new { ReasonCode = "MICRO_APP_VERSION_MISMATCH" }, "Requested version is not current."));
            }

            var resolvedEntryPath = ResolveEntryPath(service);
            var entryUrl = IsManagedStorage(service)
                ? $"/micro-app/{Uri.EscapeDataString(osClient)}/{Uri.EscapeDataString(appKey)}/index.html"
                : service["MsUrl"].Val<string>();
            var versionedEntryUrl = IsManagedStorage(service)
                ? BuildAssetUrl(osClient, appKey, resolvedVersion, resolvedEntryPath)
                : entryUrl;
            JObject page = null;
            // Only the generic friendly route requires a page record. Existing
            // sys_menu integrations must not touch this optional table at all:
            // customer sub-tenants can legitimately be on an older page schema
            // while their published micro-service runtime is otherwise healthy.
            if (requirePage)
            {
                try
                {
                    page = await ResolvePage(osClient, GetText(service, "Id"), routePath);
                }
                catch (Exception ex)
                {
                    MicroiEngine.QueueSystemLog(
                        osClient,
                        "MicroApp",
                        "ResolvePageFailed",
                        "微服务页面元数据解析失败",
                        $"TraceId={HttpContext?.TraceIdentifier}; AppKey={appKey}; RoutePath={NormalizeRoutePath(routePath)}; ErrorType={ex.GetType().FullName}; Message={ex.Message}",
                        3);
                    return Ok(new DosResult(0, new
                    {
                        ReasonCode = "MICRO_APP_PAGE_RESOLVE_FAILED",
                        AppKey = appKey,
                        RoutePath = NormalizeRoutePath(routePath)
                    }, "暂时无法读取微服务页面配置，请稍后重试。"));
                }
            }
            if (requirePage && !routePath.DosIsNullOrWhiteSpace() && page == null)
            {
                return Ok(new DosResult(2, new
                {
                    ReasonCode = "MICRO_APP_PAGE_NOT_FOUND",
                    AppKey = appKey,
                    RoutePath = NormalizeRoutePath(routePath)
                }, "微服务页面不存在或已停用。"));
            }

            return Ok(new DosResult(1, new
            {
                OsClient = osClient,
                AppKey = appKey,
                Version = resolvedVersion,
                EntryUrl = entryUrl,
                VersionedEntryUrl = versionedEntryUrl,
                EntryPath = resolvedEntryPath,
                PublishStatus = "Published",
                AssetSource = IsDbStorage(service) ? "database-inline" : IsFileStorage(service) ? "tenant-managed-file" : "external",
                StorageMode = service["StorageMode"].Val<string>(),
                Runtime = service["Runtime"].Val<string>(),
                Page = page
            }));
        }

        private static string NormalizeRoutePath(string routePath)
        {
            var value = (routePath ?? "/").Trim();
            if (value.DosIsNullOrWhiteSpace()) return "/";
            return value.StartsWith("/", StringComparison.Ordinal) ? value : "/" + value;
        }

        private static async Task<JObject> ResolvePage(string osClient, string serviceId, string routePath)
        {
            if (serviceId.DosIsNullOrWhiteSpace()) return null;
            routePath = NormalizeRoutePath(routePath);
            var page = await GetPageByField(osClient, serviceId, "RoutePath", routePath);
            if (page != null) return page;
            if (routePath != "/") return null;
            return await GetPageByField(osClient, serviceId, "IsHome", 1);
        }

        private static async Task<JObject> GetPageByField(string osClient, string serviceId, string fieldName, object fieldValue)
        {
            var param = new DiyTableRowParam
            {
                FormEngineKey = "sys_microiservice_page",
                OsClient = osClient,
                _InvokeType = InvokeType.Server.ToString(),
                _TrustedServerInvocation = true,
                _Where = new List<DiyWhere>
                {
                    new DiyWhere { Name = "MicroServiceId", Type = "=", Value = serviceId },
                    new DiyWhere { Name = fieldName, Type = "=", Value = fieldValue, AndOr = "AND" }
                },
                _SelectFields = GetPageSelectFields()
            };
            dynamic result = await MicroiEngine.FormEngine.GetFormDataAsync(param);
            if (result.Code != 1) return null;
            var page = ToJObject(result.Data);
            var isEnable = page?["IsEnable"];
            return isEnable != null && isEnable.Type != JTokenType.Null && isEnable.Val<int>() == 0 ? null : page;
        }

        private static List<string> GetPageSelectFields()
        {
            // PageName was added after the first sys_microiservice_page schema
            // shipped. Some customer tenants only have PageTitle. Keep the
            // runtime resolver on the cross-version field set so an optional
            // display-name column cannot take down the whole micro-app.
            return new List<string>
            {
                "Id", "PageKey", "PageTitle", "RoutePath", "EntryPath", "IsEnable"
            };
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

        private static byte[] RewriteStableEntryHtml(
            byte[] bytes,
            string contentType,
            string osClient,
            string appKey,
            string version,
            bool rewriteStableEntry)
        {
            if (!rewriteStableEntry
                || bytes == null
                || bytes.Length == 0
                || contentType.DosIsNullOrWhiteSpace()
                || !contentType.StartsWith("text/html", StringComparison.OrdinalIgnoreCase))
            {
                return bytes;
            }

            var html = Encoding.UTF8.GetString(bytes);
            var assetBase = $"/micro-app/{Uri.EscapeDataString(osClient)}/{Uri.EscapeDataString(appKey)}/{Uri.EscapeDataString(version)}/";
            var cacheVersion = Uri.EscapeDataString(version ?? DefaultVersion);
            var rewritten = Regex.Replace(
                html,
                "(?<prefix>\\b(?:src|href)\\s*=\\s*[\\\"'])(?<url>[^\\\"']+)(?<suffix>[\\\"'])",
                match =>
                {
                    var originalUrl = match.Groups["url"].Value.Trim();
                    if (originalUrl.DosIsNullOrWhiteSpace()
                        || originalUrl.StartsWith("/", StringComparison.Ordinal)
                        || originalUrl.StartsWith("#", StringComparison.Ordinal)
                        || originalUrl.StartsWith("//", StringComparison.Ordinal)
                        || originalUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                        || originalUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
                        || originalUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase)
                        || originalUrl.StartsWith("blob:", StringComparison.OrdinalIgnoreCase)
                        || originalUrl.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
                        || originalUrl.StartsWith("javascript:", StringComparison.OrdinalIgnoreCase))
                    {
                        return match.Value;
                    }

                    var hash = "";
                    var hashIndex = originalUrl.IndexOf('#');
                    if (hashIndex >= 0)
                    {
                        hash = originalUrl.Substring(hashIndex);
                        originalUrl = originalUrl.Substring(0, hashIndex);
                    }

                    var query = "";
                    var queryIndex = originalUrl.IndexOf('?');
                    if (queryIndex >= 0)
                    {
                        query = originalUrl.Substring(queryIndex + 1);
                        originalUrl = originalUrl.Substring(0, queryIndex);
                    }

                    var relativePath = originalUrl.Replace('\\', '/');
                    while (relativePath.StartsWith("./", StringComparison.Ordinal))
                    {
                        relativePath = relativePath.Substring(2);
                    }
                    if (relativePath.DosIsNullOrWhiteSpace()
                        || relativePath.Split('/', StringSplitOptions.RemoveEmptyEntries).Any(segment => segment == ".."))
                    {
                        return match.Value;
                    }

                    var rewrittenQuery = query.DosIsNullOrWhiteSpace()
                        ? $"v={cacheVersion}"
                        : $"{query}&amp;v={cacheVersion}";
                    var rewrittenUrl = $"{assetBase}{EscapeAssetPath(relativePath)}?{rewrittenQuery}{hash}";
                    return $"{match.Groups["prefix"].Value}{rewrittenUrl}{match.Groups["suffix"].Value}";
                },
                RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

            return Encoding.UTF8.GetBytes(rewritten);
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

        private static async Task<JObject> GetService(string osClient, string appKey, bool includeAssetPayloads = true)
        {
            var service = await GetServiceByField(osClient, "MsKey", appKey, includeAssetPayloads);
            if (service != null)
            {
                return service;
            }

            // Older clients and already-saved menus may still use the service Id in
            // /micro-app/{appKey}. Keep those URLs working while new clients prefer MsKey.
            return await GetServiceByField(osClient, "Id", appKey, includeAssetPayloads);
        }

        private static async Task<JObject> GetServiceByField(
            string osClient,
            string fieldName,
            string fieldValue,
            bool includeAssetPayloads)
        {
            // The public asset endpoint is anonymous, but resolving its published
            // runtime metadata is an internal platform read. sys_microiservice is a
            // protected control-plane table, so routing this lookup through the
            // anonymous FormEngine path correctly fails closed after the platform
            // authorization hardening. Preserve that boundary and mark only this
            // server-constructed, field-limited lookup as trusted. JsonIgnore on
            // _TrustedServerInvocation prevents an HTTP client from forging it.
            var param = new DiyTableRowParam
            {
                FormEngineKey = ServiceTable,
                OsClient = osClient,
                _InvokeType = InvokeType.Server.ToString(),
                _TrustedServerInvocation = true,
                _Where = new List<DiyWhere>
                {
                    new DiyWhere
                    {
                        Name = fieldName,
                        Type = "=",
                        Value = fieldValue
                    }
                },
                _SelectFields = GetServiceSelectFields(includeAssetPayloads)
            };

            dynamic result = await MicroiEngine.FormEngine.GetFormDataAsync(param);
            return result.Code == 1 ? ToJObject(result.Data) : null;
        }

        private static List<string> GetServiceSelectFields(bool includeAssetPayloads)
        {
            var fields = new List<string>
            {
                "Id",
                "MsKey",
                "MsUrl",
                "IsEnable",
                "StorageMode",
                "Runtime",
                "BuildVersion",
                "EntryPath"
            };
            if (includeAssetPayloads)
            {
                fields.Add("AssetManifestJson");
                fields.Add("AssetsJson");
            }
            return fields;
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
            var legacyUrl = (service?["MsUrl"].Val<string>() ?? "").Trim();
            if (legacyUrl.Equals("db", StringComparison.OrdinalIgnoreCase)
                || legacyUrl.Equals("database", StringComparison.OrdinalIgnoreCase))
            {
                return true;
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
            var legacyUrl = (service?["MsUrl"].Val<string>() ?? "").Trim();
            if (IsFileStorageMode(legacyUrl)) return true;
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
                        "hdfsPath",
                        "HdfsPath",
                        "publishHdfsPath",
                        "PublishHdfsPath",
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
            var filePathName = GetText(
                asset,
                "hdfsPath",
                "HdfsPath",
                "publishHdfsPath",
                "PublishHdfsPath",
                "filePathName",
                "FilePathName",
                "filePath",
                "FilePath");
            if (!filePathName.DosIsNullOrWhiteSpace())
            {
                return await BuildPublicFileUrl(osClient, filePathName);
            }

            var url = GetText(asset, "url", "Url", "fullPath", "FullPath", "fileUrl", "FileUrl", "publicUrl", "PublicUrl");
            if (url.DosIsNullOrWhiteSpace())
            {
                return "";
            }
            return await BuildPublicFileUrl(osClient, url);
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
            var filePaths = new[]
            {
                GetText(asset, "hdfsPath", "HdfsPath"),
                GetText(asset, "publishHdfsPath", "PublishHdfsPath"),
                GetText(asset, "filePathName", "FilePathName", "filePath", "FilePath")
            };
            foreach (var filePathName in filePaths)
            {
                if (filePathName.DosIsNullOrWhiteSpace()) continue;
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
                    // Try the next stored path before falling back to the public URL.
                }
            }
            var directFileUrl = GetText(
                asset,
                "url",
                "Url",
                "fullPath",
                "FullPath",
                "fileUrl",
                "FileUrl",
                "publicUrl",
                "PublicUrl");
            if (!directFileUrl.DosIsNullOrWhiteSpace()
                && await IsTrustedPublicFileUrl(osClient, directFileUrl))
            {
                var directFileBytes = await DownloadPublicFileAssetBytes(directFileUrl);
                if (directFileBytes != null)
                {
                    return directFileBytes;
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

        private void SetAssetHeaders(
            string appKey,
            string currentVersion,
            string assetPath,
            JObject asset,
            bool rewrittenStableEntry = false)
        {
            var sha256 = GetText(asset, "sha256", "Sha256");
            if (!rewrittenStableEntry && !sha256.DosIsNullOrWhiteSpace())
            {
                Response.Headers["ETag"] = $"\"{sha256}\"";
            }
            Response.Headers["X-Microi-MicroApp"] = $"{Uri.EscapeDataString(appKey ?? "")}@{Uri.EscapeDataString(currentVersion ?? "")}";
            Response.Headers["Cache-Control"] = rewrittenStableEntry
                || Path.GetFileName(assetPath).Equals("index.html", StringComparison.OrdinalIgnoreCase)
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
