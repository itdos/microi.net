using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System;
using System.IO;
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

            var externalUrl = service["MsUrl"].Val<string>();
            if (!IsDbStorage(service) && !externalUrl.DosIsNullOrWhiteSpace())
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
            if (!IsDbStorage(service))
            {
                var externalUrl = service["MsUrl"].Val<string>();
                return externalUrl.DosIsNullOrWhiteSpace() ? NotFound($"MicroApp has no database assets: {appKey}") : Redirect(externalUrl);
            }

            var currentVersion = ResolveVersion(service);
            assetPath = NormalizeAssetPath(assetPath);
            JObject asset = null;

            if (!version.DosIsNullOrWhiteSpace() && !string.Equals(version, currentVersion, StringComparison.OrdinalIgnoreCase))
            {
                var unversionedAssetPath = CombineAssetPath(version, assetPath);
                asset = FindAsset(service, unversionedAssetPath);
                if (asset == null)
                {
                    return NotFound($"MicroApp version is not current: {appKey}@{version}");
                }
                assetPath = unversionedAssetPath;
            }
            else
            {
                asset = FindAsset(service, assetPath);
            }

            if (asset == null && assetPath.Equals("index.html", StringComparison.OrdinalIgnoreCase))
            {
                asset = FindAsset(service, ResolveEntryPath(service));
            }
            if (asset == null)
            {
                return NotFound($"MicroApp asset not found: {appKey}@{currentVersion}/{assetPath}");
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

            var sha256 = GetText(asset, "sha256", "Sha256");
            if (!sha256.DosIsNullOrWhiteSpace())
            {
                Response.Headers["ETag"] = $"\"{sha256}\"";
            }
            Response.Headers["X-Microi-MicroApp"] = $"{appKey}@{currentVersion}";
            Response.Headers["Cache-Control"] = assetPath.Equals("index.html", StringComparison.OrdinalIgnoreCase)
                ? "no-cache, no-store, must-revalidate"
                : "public, max-age=31536000, immutable";

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

            var entryUrl = IsDbStorage(service)
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
            var assetsJson = service == null ? "" : service["AssetsJson"].Val<string>();
            return !assetsJson.DosIsNullOrWhiteSpace();
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
