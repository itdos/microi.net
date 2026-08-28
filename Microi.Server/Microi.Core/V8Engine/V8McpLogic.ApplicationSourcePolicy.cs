using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static partial class V8McpLogic
    {
        public static async Task<DosResult<object>> SetEngineRoles(
            string osClient,
            JObject param)
        {
            try
            {
                if (IsBlank(osClient)) return new DosResult<object>(0, null, "OsClient 不能为空");
                var keys = GetArrayParam(param, "ApiEngineKeys", "apiEngineKeys")
                    .Values<string>()
                    .Select(item => SafeString(item).Trim())
                    .Where(item => !IsBlank(item))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                if (keys.Count == 0 || keys.Count > 100)
                    return new DosResult<object>(0, null, "ApiEngineKeys 必须包含 1-100 个接口引擎 Key");

                var requestedRoles = GetArrayParam(param, "Roles", "roles", "RoleIds", "roleIds");
                if (param?["AllowAuthenticatedUsers"]?.Val<bool?>() == true
                    && !requestedRoles.Any(item => string.Equals(
                        item.Type == JTokenType.Object ? item["Id"]?.ToString() : item.ToString(),
                        ApiEngineRoleAuthorization.AuthenticatedRoleId,
                        StringComparison.OrdinalIgnoreCase)))
                {
                    requestedRoles.Add(new JObject
                    {
                        ["Id"] = ApiEngineRoleAuthorization.AuthenticatedRoleId,
                        ["Name"] = "已登录用户"
                    });
                }

                var normalizedRoles = new JArray();
                var seenRoleIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var roleToken in requestedRoles)
                {
                    var roleId = SafeString(
                        roleToken.Type == JTokenType.Object
                            ? roleToken["Id"]?.ToString()
                            : roleToken.ToString()).Trim();
                    if (IsBlank(roleId) || !seenRoleIds.Add(roleId)) continue;
                    if (string.Equals(
                            roleId,
                            ApiEngineRoleAuthorization.AuthenticatedRoleId,
                            StringComparison.OrdinalIgnoreCase))
                    {
                        normalizedRoles.Add(new JObject
                        {
                            ["Id"] = ApiEngineRoleAuthorization.AuthenticatedRoleId,
                            ["Name"] = "已登录用户"
                        });
                        continue;
                    }

                    var roleResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                        "sys_role",
                        new JObject
                        {
                            ["OsClient"] = osClient,
                            ["Id"] = roleId
                        });
                    if (roleResult.Code != 1 || roleResult.Data == null)
                        return new DosResult<object>(0, null, $"角色不存在：{roleId}");
                    var role = JObject.FromObject(roleResult.Data);
                    normalizedRoles.Add(new JObject
                    {
                        ["Id"] = roleId,
                        ["Name"] = SafeJString(role, "Name", SafeJString(role, "RoleName", roleId))
                    });
                }

                var apiRole = normalizedRoles.ToString(Formatting.None);
                var updated = new JArray();
                foreach (var key in keys)
                {
                    var engineResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                        "sys_apiengine",
                        new JObject
                        {
                            ["OsClient"] = osClient,
                            ["_Where"] = new JArray(new JArray("ApiEngineKey", "=", key))
                        });
                    if (engineResult.Code != 1 || engineResult.Data == null)
                        return new DosResult<object>(0, null, $"接口引擎不存在：{key}");
                    var engine = JObject.FromObject(engineResult.Data);
                    var update = await MicroiEngine.FormEngine.UptFormDataAsync(
                        "sys_apiengine",
                        new JObject
                        {
                            ["OsClient"] = osClient,
                            ["Id"] = SafeJString(engine, "Id"),
                            ["ApiRole"] = apiRole
                        });
                    if (update.Code != 1)
                        return new DosResult<object>(update.Code, update.Data, $"更新接口引擎角色失败：{key}，{update.Msg}");

                    var cache = await RefreshApiEngineRouteCache(osClient, key, SafeJString(engine, "Id"));
                    if (cache.Code != 1)
                        return new DosResult<object>(cache.Code, cache.Data, $"刷新接口引擎缓存失败：{key}，{cache.Msg}");

                    var readback = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                        "sys_apiengine",
                        new JObject
                        {
                            ["OsClient"] = osClient,
                            ["Id"] = SafeJString(engine, "Id")
                        });
                    var readbackRole = readback.Code == 1 && readback.Data != null
                        ? SafeJString(JObject.FromObject(readback.Data), "ApiRole")
                        : string.Empty;
                    if (!string.Equals(readbackRole, apiRole, StringComparison.Ordinal))
                        return new DosResult<object>(0, null, $"接口引擎角色回读不一致：{key}");

                    updated.Add(new JObject
                    {
                        ["ApiEngineKey"] = key,
                        ["ApiRole"] = normalizedRoles.DeepClone()
                    });
                }

                return new DosResult<object>(1, new
                {
                    UpdatedCount = updated.Count,
                    Roles = normalizedRoles,
                    Engines = updated
                }, "接口引擎角色白名单已更新并回读");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "SetEngineRoles 失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> ClearApplicationSource(
            string osClient,
            JObject param,
            object currentToken)
        {
            try
            {
                if (IsBlank(osClient)) return new DosResult<object>(0, null, "OsClient 不能为空");
                var appIdOrKey = SafeJString(param, "AppIdOrKey", SafeJString(param, "AppKey", SafeJString(param, "AppId")));
                if (IsBlank(appIdOrKey)) return new DosResult<object>(0, null, "AppIdOrKey 不能为空");

                var operatorError = ValidateStreamPublishOperator(
                    currentToken,
                    osClient,
                    "ClearApplicationSource",
                    appIdOrKey);
                if (operatorError != null) return operatorError;

                var app = await FindAiApplication(osClient, appIdOrKey);
                if (app == null) return new DosResult<object>(2, null, "在线应用不存在");
                var appId = SafeJString(app, "Id");
                var appKey = SafeJString(app, "AppKey");

                const int sourcePageSize = 1000;
                const int maxSourcePages = 100;
                var privateRows = new List<JObject>();
                for (var pageIndex = 1; pageIndex <= maxSourcePages; pageIndex++)
                {
                    // FormEngine's strongly-shaped query path is required here.
                    // Passing JObject to this generic overload can be interpreted
                    // as row data on older runtimes and silently drop _Where.
                    var allFilesResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>(
                        "mci_ai_app_file",
                        BuildApplicationSourceRowsQuery(osClient, appId, pageIndex, sourcePageSize));
                    if (allFilesResult.Code != 1)
                        return new DosResult<object>(0, null, "读取应用源码元数据失败，已停止清理：" + allFilesResult.Msg);

                    var pageRows = allFilesResult.Data == null
                        ? new List<JObject>()
                        : JArray.FromObject(allFilesResult.Data).OfType<JObject>().ToList();
                    privateRows.AddRange(pageRows.Where(IsPrivateAiApplicationSourceFile));
                    if (pageRows.Count < sourcePageSize) break;
                    if (pageIndex == maxSourcePages)
                        return new DosResult<object>(0, null, "应用源码元数据超过安全分页上限，已停止清理");
                }

                var unsafePrivateRows = privateRows
                    .Where(row => !IsApplicationOwnedPrivateSourcePath(
                        SafeJString(row, "HdfsPath"),
                        osClient,
                        appId,
                        appKey,
                        SafeJString(app, "PrivateSourcePath")))
                    .ToList();
                if (unsafePrivateRows.Count > 0)
                {
                    return new DosResult<object>(0, new
                    {
                        DryRun = true,
                        AppId = appId,
                        AppKey = appKey,
                        UnsafePrivateSourceCount = unsafePrivateRows.Count,
                        UnsafePrivateSourcePaths = unsafePrivateRows
                            .Take(20)
                            .Select(row => NormalizeAiApplicationStoragePath(SafeJString(row, "HdfsPath")))
                    }, "源码元数据包含不属于目标应用的对象路径，已按 fail-closed 停止清理");
                }

                var sourceZipEntries = ReadJsonArray(app, "AiAppZipFiles")
                    .OfType<JObject>()
                    .Where(IsSourcePackageAsset)
                    .ToList();
                var unsafeSourceZipEntries = sourceZipEntries
                    .Where(row => !IsApplicationOwnedPublicSourceZipPath(
                        SafeJString(row, "FilePathName", SafeJString(row, "HdfsPath")),
                        osClient,
                        appId,
                        appKey))
                    .ToList();
                if (unsafeSourceZipEntries.Count > 0)
                {
                    return new DosResult<object>(0, new
                    {
                        DryRun = true,
                        AppId = appId,
                        AppKey = appKey,
                        UnsafePublicSourceZipCount = unsafeSourceZipEntries.Count,
                        UnsafePublicSourceZipPaths = unsafeSourceZipEntries
                            .Take(20)
                            .Select(row => NormalizeAiApplicationStoragePath(
                                SafeJString(row, "FilePathName", SafeJString(row, "HdfsPath"))))
                    }, "源码包元数据包含不属于目标应用的公开对象路径，已按 fail-closed 停止清理");
                }
                var targets = new List<(string Path, bool Limit, string RowId, string Kind)>();
                targets.AddRange(privateRows
                    .Select(row => (
                        NormalizeAiApplicationStoragePath(SafeJString(row, "HdfsPath")),
                        true,
                        SafeJString(row, "Id"),
                        "PrivateSource"))
                    .Where(item => !IsBlank(item.Item1)));
                targets.AddRange(sourceZipEntries
                    .Select(row => (
                        NormalizeAiApplicationStoragePath(SafeJString(row, "FilePathName", SafeJString(row, "HdfsPath"))),
                        false,
                        string.Empty,
                        "PublicSourceZip"))
                    .Where(item => !IsBlank(item.Item1)));
                targets = targets
                    .GroupBy(item => $"{item.Limit}:{item.Path}", StringComparer.OrdinalIgnoreCase)
                    .Select(group => group.First())
                    .OrderBy(item => item.Limit ? 0 : 1)
                    .ThenBy(item => item.Path, StringComparer.Ordinal)
                    .ToList();

                var confirmationSeed = string.Join(
                    "\n",
                    new[] { osClient, appId, appKey }
                        .Concat(targets.Select(item => $"{(item.Limit ? "private" : "public")}:{item.Path}")));
                var confirmationSha256 = HashMicroServiceSource(Encoding.UTF8.GetBytes(confirmationSeed));
                var confirmExecution = SafeJString(param, "ConfirmExecution");
                if (!string.Equals(confirmExecution, confirmationSha256, StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult<object>(1, new
                    {
                        DryRun = true,
                        AppId = appId,
                        AppKey = appKey,
                        PrivateSourceFileCount = privateRows.Count,
                        PublicSourceZipCount = sourceZipEntries.Count,
                        Targets = targets.Select(item => new
                        {
                            item.Path,
                            Scope = item.Limit ? "Private" : "Public",
                            item.Kind
                        }),
                        ConfirmationSha256 = confirmationSha256
                    }, "只读预检完成；确认哈希后才会删除远端源码对象和元数据");
                }

                var hdfs = ResolveApplicationAssetHdfs(osClient, out var clientModel);
                var deletedObjects = new JArray();
                foreach (var target in targets)
                {
                    var delete = await hdfs.DeleteObject(new HDFSParam
                    {
                        ClientModel = clientModel,
                        Limit = target.Limit,
                        FileFullPath = target.Path
                    });
                    if (delete.Code != 1)
                    {
                        var exists = await hdfs.ObjectExist(new HDFSParam
                        {
                            ClientModel = clientModel,
                            Limit = target.Limit,
                            FileFullPath = target.Path
                        });
                        if (exists.Code != 1 || exists.Data)
                            return new DosResult<object>(0, new
                            {
                                AppId = appId,
                                AppKey = appKey,
                                FailedPath = target.Path,
                                Scope = target.Limit ? "Private" : "Public",
                                DeletedObjects = deletedObjects
                            }, "远端源码对象删除失败；元数据尚未清理：" + delete.Msg);
                    }
                    deletedObjects.Add(new JObject
                    {
                        ["Path"] = target.Path,
                        ["Scope"] = target.Limit ? "Private" : "Public",
                        ["Kind"] = target.Kind
                    });
                }

                var deletedRows = 0;
                foreach (var row in privateRows)
                {
                    var deleteRow = await MicroiEngine.FormEngine.DelFormDataAsync(
                        "mci_ai_app_file",
                        new JObject
                        {
                            ["OsClient"] = osClient,
                            ["Id"] = SafeJString(row, "Id")
                        });
                    if (deleteRow.Code != 1)
                        return new DosResult<object>(0, null, "源码对象已删除，但源码元数据清理失败：" + deleteRow.Msg);
                    deletedRows++;
                }

                var appUpdate = new JObject
                {
                    ["OsClient"] = osClient,
                    ["Id"] = appId,
                    ["PrivateSourcePath"] = string.Empty,
                    ["SelectAiApp"] = SanitizeSelectAiApp(app["SelectAiApp"]),
                    ["AiAppZipFiles"] = SanitizeAiAppZipFiles(app["AiAppZipFiles"]),
                    ["AiAppPackageManifest"] = SanitizeAiAppPackageManifest(app["AiAppPackageManifest"])
                };
                if (app["AppPakcet"] != null && app["AppPakcet"].Type != JTokenType.Null)
                    appUpdate["AppPakcet"] = SanitizePackageJson(app["AppPakcet"]);
                var updateApp = await MicroiEngine.FormEngine.UptFormDataAsync("sys_microistore", appUpdate);
                if (updateApp.Code != 1)
                    return new DosResult<object>(0, null, "源码对象和文件行已删除，但应用源码标记清理失败：" + updateApp.Msg);

                var readback = await GetApplicationContext(osClient, appId, false);
                MicroiEngine.QueueSystemLog(
                    osClient,
                    "MCP",
                    "ClearApplicationSource",
                    "AI 应用远端源码已清理",
                    $"AppKey={appKey};PrivateRows={deletedRows};Objects={deletedObjects.Count};Confirmation={confirmationSha256}",
                    2,
                    false,
                    confirmationSha256);
                return new DosResult<object>(1, new
                {
                    DryRun = false,
                    AppId = appId,
                    AppKey = appKey,
                    DeletedObjectCount = deletedObjects.Count,
                    DeletedPrivateRowCount = deletedRows,
                    DeletedObjects = deletedObjects,
                    Readback = readback.Data
                }, "远端私有源码及公开 SourceZip 已清理；编译运行资产保持不变");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "ClearApplicationSource 失败：" + ex.Message);
            }
        }

        private static object BuildApplicationSourceRowsQuery(
            string osClient,
            string appId,
            int pageIndex,
            int pageSize)
        {
            return new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "AppId", "=", appId }
                },
                _SelectFields = new[]
                {
                    "Id", "AppId", "FilePath", "FileName", "HdfsPath",
                    "PublishHdfsPath", "StorageScope", "VersionId", "Size"
                },
                _OrderBy = "Id",
                _OrderByType = "ASC",
                _PageIndex = pageIndex,
                _PageSize = pageSize
            };
        }

        private static bool IsApplicationOwnedPrivateSourcePath(
            string path,
            string osClient,
            string appId,
            string appKey,
            string configuredPrivateSourcePath)
        {
            var prefixes = new[]
            {
                configuredPrivateSourcePath,
                $"ai-app-source/{appId}",
                $"ai-app-source/{appKey}"
            };
            return IsApplicationOwnedStoragePath(path, osClient, prefixes);
        }

        private static bool IsApplicationOwnedPublicSourceZipPath(
            string path,
            string osClient,
            string appId,
            string appKey)
        {
            return IsApplicationOwnedStoragePath(
                path,
                osClient,
                new[]
                {
                    $"microi/app-store/ai-app-packages/{appId}",
                    $"microi/app-store/ai-app-packages/{appKey}"
                });
        }

        private static bool IsApplicationOwnedStoragePath(
            string path,
            string osClient,
            IEnumerable<string> allowedPrefixes)
        {
            var normalizedPath = NormalizeAiApplicationStoragePath(path);
            var tenant = NormalizeAiApplicationStoragePath(osClient);
            if (IsBlank(normalizedPath) || IsBlank(tenant)) return false;
            if (normalizedPath.Split('/').Any(segment => segment == "." || segment == "..")) return false;

            string TenantPath(string value)
            {
                var normalized = NormalizeAiApplicationStoragePath(value);
                if (IsBlank(normalized)) return string.Empty;
                return normalized.StartsWith(tenant + "/", StringComparison.OrdinalIgnoreCase)
                    ? normalized
                    : tenant + "/" + normalized;
            }

            foreach (var rawPrefix in allowedPrefixes ?? Array.Empty<string>())
            {
                var prefix = TenantPath(rawPrefix).TrimEnd('/');
                if (IsBlank(prefix)) continue;
                if (string.Equals(normalizedPath, prefix, StringComparison.OrdinalIgnoreCase)
                    || normalizedPath.StartsWith(prefix + "/", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }

        private static JArray ReadJsonArray(JObject row, string fieldName)
        {
            var token = row?[fieldName];
            if (token is JArray array) return (JArray)array.DeepClone();
            if (token == null || token.Type == JTokenType.Null || IsBlank(token.ToString())) return new JArray();
            try { return JArray.Parse(token.ToString()); }
            catch { return new JArray(); }
        }

        private static bool IsSourcePackageAsset(JObject asset)
        {
            var role = SafeJString(asset, "FileRole", SafeJString(asset, "Role"));
            var name = SafeJString(asset, "FileName", SafeJString(asset, "Name"));
            return string.Equals(role, "Source", StringComparison.OrdinalIgnoreCase)
                || name.IndexOf("source", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string SanitizeSelectAiApp(JToken token)
        {
            var array = token is JArray direct
                ? (JArray)direct.DeepClone()
                : TryParseArray(token);
            foreach (var item in array.OfType<JObject>()) item["IncludeSource"] = false;
            return array.ToString(Formatting.None);
        }

        private static string SanitizeAiAppZipFiles(JToken token)
        {
            var array = token is JArray direct
                ? (JArray)direct.DeepClone()
                : TryParseArray(token);
            return new JArray(array.OfType<JObject>().Where(item => !IsSourcePackageAsset(item)))
                .ToString(Formatting.None);
        }

        private static string SanitizeAiAppPackageManifest(JToken token)
        {
            var array = token is JArray direct
                ? (JArray)direct.DeepClone()
                : TryParseArray(token);
            foreach (var item in array.OfType<JObject>())
            {
                item["IncludeSource"] = false;
                item.Remove("SourceZip");
                if (item["PackageAssets"] is JObject assets)
                {
                    assets["IncludeSource"] = false;
                    assets.Remove("SourceZip");
                }
            }
            return array.ToString(Formatting.None);
        }

        private static string SanitizePackageJson(JToken token)
        {
            JToken parsed;
            try
            {
                parsed = token.Type == JTokenType.String
                    ? JToken.Parse(token.ToString())
                    : token.DeepClone();
            }
            catch
            {
                return token.ToString();
            }
            SanitizePackageToken(parsed);
            return parsed.ToString(Formatting.None);
        }

        private static void SanitizePackageToken(JToken token)
        {
            if (token is JObject obj)
            {
                foreach (var property in obj.Properties().ToList())
                {
                    if (string.Equals(property.Name, "IncludeSource", StringComparison.OrdinalIgnoreCase))
                    {
                        property.Value = false;
                    }
                    else if (string.Equals(property.Name, "SourceFiles", StringComparison.OrdinalIgnoreCase)
                             || string.Equals(property.Name, "SourceZip", StringComparison.OrdinalIgnoreCase)
                             || string.Equals(property.Name, "PrivateSourcePath", StringComparison.OrdinalIgnoreCase))
                    {
                        property.Remove();
                    }
                    else
                    {
                        SanitizePackageToken(property.Value);
                    }
                }
                if (obj["AssetStoragePolicy"] is JObject policy) policy["Source"] = "NotIncluded";
            }
            else if (token is JArray array)
            {
                foreach (var item in array) SanitizePackageToken(item);
            }
        }

        private static JArray TryParseArray(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null || IsBlank(token.ToString())) return new JArray();
            try { return JArray.Parse(token.ToString()); }
            catch { return new JArray(); }
        }
    }
}
