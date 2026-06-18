#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8McpLogic.cs
* Copyright(c) Microi.net
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：2026-03-21
* 文件描述：V8引擎 MCP 核心业务逻辑
*           包含：权限校验、引擎列表/详情、代码同步、远程执行、V8事件、数据库结构获取
*           此文件位于开源项目 Microi.Core 中
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// V8 MCP 核心业务逻辑（不依赖 MVC Controller）
    /// </summary>
    public static partial class V8McpLogic
    {
        /// <summary>
        /// 安全格式化数据库读出来的 UpdateTime（可能是 string、DateTime、DateTimeOffset 或 null）。
        /// 平台约定 datetime 类字段以 varchar(25) 存储，但部分历史表仍是 DateTime，需要兼容。
        /// </summary>
        private static string FormatDbDateTime(object value)
        {
            if (value == null) return "";
            if (value is string s) return s;
            if (value is DateTime dt) return dt.ToString("yyyy-MM-dd HH:mm:ss");
            if (value is DateTimeOffset dto) return dto.ToString("yyyy-MM-dd HH:mm:ss");
            try { return Convert.ToString(value) ?? ""; } catch { return ""; }
        }

        private static string SafeJString(JObject row, string fieldName, string fallback = "")
        {
            var token = row?[fieldName];
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined) return fallback;
            var value = token.ToString();
            return string.IsNullOrWhiteSpace(value) ? fallback : value;
        }

        private static int SafeJInt(JObject row, string fieldName, int fallback = 0)
        {
            var text = SafeJString(row, fieldName);
            return int.TryParse(text, out var value) ? value : fallback;
        }

        private static string SafeString(object value, string fallback = "")
        {
            if (value == null) return fallback;
            try
            {
                var text = Convert.ToString(value);
                return string.IsNullOrWhiteSpace(text) ? fallback : text;
            }
            catch
            {
                return fallback;
            }
        }

        private static string NormalizeV8SemanticVersion(string value)
        {
            var text = SafeString(value).Trim();
            var match = Regex.Match(text, @"^v(\d+)\.(\d+)\.(\d+)$", RegexOptions.IgnoreCase);
            if (!match.Success) return "";
            return $"v{int.Parse(match.Groups[1].Value)}.{int.Parse(match.Groups[2].Value)}.{int.Parse(match.Groups[3].Value)}";
        }

        private static string ExtractV8SemanticVersion(string code)
        {
            var text = SafeString(code);
            if (text.DosIsNullOrWhiteSpace()) return "";
            var match = Regex.Match(text, @"^\s*\*?\s*Version\s*:\s*(v\d+\.\d+\.\d+)\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase);
            return match.Success ? NormalizeV8SemanticVersion(match.Groups[1].Value) : "";
        }

        private static string ResolveV8SemanticVersion(string version, string code, string fallback = "")
        {
            var normalized = NormalizeV8SemanticVersion(version);
            if (!normalized.DosIsNullOrWhiteSpace()) return normalized;
            normalized = ExtractV8SemanticVersion(code);
            if (!normalized.DosIsNullOrWhiteSpace()) return normalized;
            return fallback;
        }

        private static string BuildV8ChangeHistoryEntry(string version, string changeHistory)
        {
            var summary = SafeString(changeHistory).Trim();
            if (summary.DosIsNullOrWhiteSpace()) return "";
            var prefix = "";
            if (!version.DosIsNullOrWhiteSpace() && !Regex.IsMatch(summary, @"^v\d+\.\d+\.\d+\b", RegexOptions.IgnoreCase))
            {
                prefix = version + " ";
            }
            return $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {prefix}{summary}{Environment.NewLine}";
        }

        private static bool SysApiEngineHasColumn(string osClient, string columnName)
        {
            try
            {
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null) return false;
                var section = client.Db.FromSql("SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?table AND COLUMN_NAME = ?column")
                    .AddInParameter("?table", "sys_apiengine")
                    .AddInParameter("?column", columnName);
                section.SetCommandTimeout(10);
                return section.ToScalar<int>() > 0;
            }
            catch
            {
                return false;
            }
        }

        private static bool IsBlank(object value)
        {
            return string.IsNullOrWhiteSpace(SafeString(value));
        }

        private static string NormalizeBase64Payload(string value)
        {
            var text = SafeString(value).Trim();
            var commaIndex = text.IndexOf(',');
            if (commaIndex >= 0 && text.Substring(0, commaIndex).Contains("base64", StringComparison.OrdinalIgnoreCase))
            {
                return text.Substring(commaIndex + 1).Trim();
            }
            return text;
        }

        private static readonly UTF8Encoding StrictUtf8Encoding = new UTF8Encoding(false, true);

        private static bool LooksLikeV8Source(string value)
        {
            var text = SafeString(value);
            if (text.DosIsNullOrWhiteSpace()) return false;
            var trimmed = text.TrimStart('\uFEFF', ' ', '\r', '\n', '\t');
            return trimmed.StartsWith("var ")
                || trimmed.StartsWith("let ")
                || trimmed.StartsWith("const ")
                || trimmed.StartsWith("function")
                || trimmed.StartsWith("return")
                || trimmed.StartsWith("//")
                || trimmed.StartsWith("/*")
                || text.Contains("V8.")
                || text.Contains("return ")
                || text.Contains("=>")
                || text.Contains("console.")
                || text.Contains(";")
                || text.Contains("{")
                || text.Contains("\n");
        }

        private static string DecodeLegacyApiV8Code(string value)
        {
            var raw = SafeString(value);
            if (raw.DosIsNullOrWhiteSpace()) return "";
            var text = raw.Trim();
            if (!DiyCommon.IsBase64String(text)) return raw;
            try
            {
                var decoded = StrictUtf8Encoding.GetString(Convert.FromBase64String(text));
                return LooksLikeV8Source(decoded) ? decoded : raw;
            }
            catch
            {
                return raw;
            }
        }

        private static string[] SplitConsoleOutput(string value)
        {
            var text = SafeString(value);
            if (text.DosIsNullOrWhiteSpace()) return Array.Empty<string>();
            return text.Replace("\r\n", "\n").Split('\n').Where(line => !line.DosIsNullOrWhiteSpace()).ToArray();
        }

        private static int ExtractResultCode(object result, int fallback = 1)
        {
            if (result == null) return fallback;
            try
            {
                if (result is DosResult dosResult) return dosResult.Code ?? fallback;
                var token = result as JToken ?? JToken.FromObject(result);
                var codeText = token["Code"]?.ToString();
                if (int.TryParse(codeText, out var code)) return code;
            }
            catch { }
            return fallback;
        }

        private static string ExtractResultMsg(object result)
        {
            if (result == null) return "";
            try
            {
                if (result is DosResult dosResult) return SafeString(dosResult.Msg);
                var token = result as JToken ?? JToken.FromObject(result);
                return SafeString(token["Msg"]?.ToString());
            }
            catch { }
            return "";
        }

        private static string ExtractUploadPath(object data)
        {
            if (data == null) return "";
            try
            {
                var token = data as JToken ?? JToken.FromObject(data);
                if (token is JArray arr && arr.Count > 0) token = arr[0];
                if (token is JObject obj)
                {
                    foreach (var key in new[] { "Path", "FilePathName", "FilePath", "FullPath", "Url", "FileUrl" })
                    {
                        var value = obj[key]?.ToString();
                        if (!string.IsNullOrWhiteSpace(value)) return value;
                    }
                }
                if (token.Type == JTokenType.String) return token.ToString();
            }
            catch { }
            return "";
        }

        private static string NormalizeApiEngineCacheKeyPart(string value)
        {
            return SafeString(value).Trim().ToLowerInvariant();
        }

        private static string BuildApiEngineCacheKey(string osClient, string key)
        {
            return $"Microi:{osClient}:FormData:sys_apiengine:{NormalizeApiEngineCacheKeyPart(key)}";
        }

        private static async Task<DosResult<object>> RefreshApiEngineRouteCache(string osClient, string apiEngineKey = null, string id = null)
        {
            try
            {
                if (IsBlank(osClient))
                {
                    return new DosResult<object>(0, null, "OsClient 不能为空");
                }

                DosResult<dynamic> getResult;
                if (!IsBlank(id))
                {
                    getResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                    {
                        OsClient = osClient,
                        Id = id
                    });
                }
                else if (!IsBlank(apiEngineKey))
                {
                    getResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>()
                        {
                            new List<object>() { "ApiEngineKey", "=", apiEngineKey },
                        }
                    });
                }
                else
                {
                    return new DosResult<object>(0, null, "ApiEngineKey 和 Id 不能同时为空");
                }

                if (getResult.Code != 1 || getResult.Data == null)
                {
                    return new DosResult<object>(getResult.Code, getResult.Data, IsBlank(getResult.Msg) ? "刷新接口引擎缓存失败：未找到最新数据" : SafeString(getResult.Msg));
                }

                var row = JObject.FromObject(getResult.Data);
                var latestId = NormalizeApiEngineCacheKeyPart(SafeJString(row, "Id"));
                var latestKey = NormalizeApiEngineCacheKeyPart(SafeJString(row, "ApiEngineKey", apiEngineKey ?? ""));
                var latestAddress = NormalizeApiEngineCacheKeyPart(SafeJString(row, "ApiAddress"));
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var tasks = new List<Task>();

                if (!IsBlank(latestKey))
                {
                    tasks.Add(cache.SetAsync(BuildApiEngineCacheKey(osClient, latestKey), getResult.Data));
                }
                if (!IsBlank(latestId))
                {
                    tasks.Add(cache.SetAsync(BuildApiEngineCacheKey(osClient, latestId), getResult.Data));
                }
                if (!IsBlank(latestAddress))
                {
                    tasks.Add(cache.SetAsync(BuildApiEngineCacheKey(osClient, latestAddress), getResult.Data));
                }

                if (tasks.Any())
                {
                    await Task.WhenAll(tasks);
                }

                return new DosResult<object>(1, getResult.Data);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "刷新接口引擎缓存失败：" + ex.Message);
            }
        }

        private static async Task<DosResult<object>> RefreshDiyTableModelCache(string osClient, string tableName = null, string id = null)
        {
            try
            {
                DosResult<dynamic> getResult;
                if (!IsBlank(id))
                {
                    getResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("Diy_Table", new { OsClient = osClient, Id = id });
                }
                else if (!IsBlank(tableName))
                {
                    getResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("Diy_Table", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>() { new List<object>() { "Name", "=", tableName } }
                    });
                }
                else
                {
                    return new DosResult<object>(0, null, "TableName 和 Id 不能同时为空");
                }

                if (getResult.Code != 1 || getResult.Data == null)
                {
                    return new DosResult<object>(getResult.Code, getResult.Data, IsBlank(getResult.Msg) ? "刷新表单引擎缓存失败：未找到最新数据" : SafeString(getResult.Msg));
                }

                var row = JObject.FromObject(getResult.Data);
                var latestId = SafeJString(row, "Id");
                var latestName = SafeJString(row, "Name", tableName ?? "");
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var tasks = new List<Task>();
                foreach (var prefix in new[] { "Diy_Table", "diy_table" })
                {
                    if (!IsBlank(latestId))
                    {
                        tasks.Add(cache.SetAsync($"Microi:{osClient}:FormData:{prefix}:{latestId.ToLowerInvariant()}", getResult.Data));
                    }
                    if (!IsBlank(latestName))
                    {
                        tasks.Add(cache.SetAsync($"Microi:{osClient}:FormData:{prefix}:{latestName.ToLowerInvariant()}", getResult.Data));
                    }
                }
                if (tasks.Any())
                {
                    await Task.WhenAll(tasks);
                }
                return new DosResult<object>(1, getResult.Data);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "刷新表单引擎缓存失败：" + ex.Message);
            }
        }

        #region 权限校验

        /// <summary>
        /// 校验当前用户权限（Level >= 9999）
        /// </summary>
        public static async Task<(bool ok, string msg, dynamic token)> CheckPermission()
        {
            try
            {
                var currentToken = await DiyToken.GetCurrentToken();
                if (currentToken == null || currentToken.CurrentUser == null)
                {
                    return (false, "未登录或登录已过期", null);
                }
                var level = currentToken.CurrentUser["Level"].Val<int>();
                if (level < 9999)
                {
                    return (false, "权限不足，需要 Level >= 9999", null);
                }
                return (true, "", currentToken);
            }
            catch
            {
                return (false, "权限验证失败", null);
            }
        }

        #endregion

        #region GetStatus

        /// <summary>
        /// 获取调试状态信息
        /// </summary>
        public static object BuildStatusData(dynamic currentToken)
        {
            return new
            {
                IsDebugMode = true,
                Environment = System.Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                DebuggerAttached = Debugger.IsAttached,
                LocalV8DebugPath = ConfigHelper.GetAppSettings("LocalV8DebugPath") ?? "",
                OsClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient") ?? "",
                OsClientType = ConfigHelper.GetAppSettings("OsClientType") ?? "Product",
                OsClientNetwork = ConfigHelper.GetAppSettings("OsClientNetwork") ?? "Internal"
            };
        }

        #endregion

        #region GetApiEngineList

        /// <summary>
        /// 获取所有接口引擎列表
        /// </summary>
        public static async Task<DosResult<object>> GetApiEngineList(string osClient)
        {
            try
            {
                var hasVersionColumn = SysApiEngineHasColumn(osClient, "Version");
                var hasChangeHistoryColumn = SysApiEngineHasColumn(osClient, "ChangeHistory");
                var selectFields = new List<string> { "Id", "ApiName", "ApiEngineKey", "Category", "ApiAddress", "IsEnable", "ApiRemark", "ApiV8Code", "UpdateTime" };
                if (hasVersionColumn) selectFields.Add("Version");
                if (hasChangeHistoryColumn) selectFields.Add("ChangeHistory");
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _SelectFields = selectFields.ToArray(),
                    _Where = new List<object>()
                    {
                        
                    }
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var list = new List<dynamic>();
                    foreach (var item in result.Data)
                    {
                        var apiV8Code = (string)item.ApiV8Code ?? "";
                        var updateTime = item.UpdateTime?.ToString() ?? "";
                        apiV8Code = DecodeLegacyApiV8Code(apiV8Code);

                        list.Add(new
                        {
                            Id = (string)item.Id,
                            ApiName = (string)item.ApiName ?? "",
                            ApiEngineKey = (string)item.ApiEngineKey ?? "",
                            Category = (string)item.Category ?? "未分类",
                            ApiAddress = (string)item.ApiAddress ?? "",
                            IsEnable = item.IsEnable,
                            ApiRemark = (string)item.ApiRemark ?? "",
                            ApiV8Code = apiV8Code,
                            Version = hasVersionColumn ? SafeString(item.Version) : "",
                            ChangeHistory = hasChangeHistoryColumn ? SafeString(item.ChangeHistory) : "",
                            UpdateTime = updateTime
                        });
                    }
                    return new DosResult<object>(1, new
                    {
                        OsClient = osClient,
                        OsClientType = ConfigHelper.GetAppSettings("OsClientType") ?? "Product",
                        OsClientNetwork = ConfigHelper.GetAppSettings("OsClientNetwork") ?? "Internal",
                        List = list,
                        Total = list.Count
                    });
                }

                return new DosResult<object>(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取接口引擎列表失败：" + ex.Message);
            }
        }

        #endregion

        #region GetApiEngine

        /// <summary>
        /// 获取单个接口引擎详情
        /// </summary>
        public static async Task<DosResult<object>> GetApiEngine(string osClient, string apiEngineKey)
        {
            try
            {
                var hasVersionColumn = SysApiEngineHasColumn(osClient, "Version");
                var hasChangeHistoryColumn = SysApiEngineHasColumn(osClient, "ChangeHistory");
                var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "ApiEngineKey", "=", apiEngineKey },
                        
                    }
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var item = result.Data;
                    var apiV8Code = (string)item.ApiV8Code ?? "";
                    apiV8Code = DecodeLegacyApiV8Code(apiV8Code);

                    return new DosResult<object>(1, new
                    {
                        Id = (string)item.Id,
                        ApiName = (string)item.ApiName ?? "",
                        ApiEngineKey = (string)item.ApiEngineKey ?? "",
                        Category = (string)item.Category ?? "未分类",
                        ApiAddress = (string)item.ApiAddress ?? "",
                        IsEnable = item.IsEnable,
                        ApiRemark = (string)item.ApiRemark ?? "",
                        ApiV8Code = apiV8Code,
                        Version = hasVersionColumn ? SafeString(item.Version) : "",
                        ChangeHistory = hasChangeHistoryColumn ? SafeString(item.ChangeHistory) : "",
                        UpdateTime = FormatDbDateTime(item.UpdateTime)
                    });
                }

                return new DosResult<object>(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取接口引擎失败：" + ex.Message);
            }
        }

        #endregion

        #region GetApiEngineCode

        /// <summary>
        /// 获取单个接口引擎的远程代码（用于 Diff 对比）
        /// </summary>
        public static async Task<DosResult<object>> GetApiEngineCode(string osClient, string apiEngineKey)
        {
            try
            {
                var hasVersionColumn = SysApiEngineHasColumn(osClient, "Version");
                var hasChangeHistoryColumn = SysApiEngineHasColumn(osClient, "ChangeHistory");
                var selectFields = new List<string> { "ApiEngineKey", "ApiV8Code", "UpdateTime" };
                if (hasVersionColumn) selectFields.Add("Version");
                if (hasChangeHistoryColumn) selectFields.Add("ChangeHistory");
                var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _SelectFields = selectFields.ToArray(),
                    _Where = new List<object>()
                    {
                        new List<object>() { "ApiEngineKey", "=", apiEngineKey },
                        
                    }
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var apiV8Code = (string)result.Data.ApiV8Code ?? "";
                    apiV8Code = DecodeLegacyApiV8Code(apiV8Code);

                    return new DosResult<object>(1, new
                    {
                        ApiEngineKey = apiEngineKey,
                        ApiV8Code = apiV8Code,
                        Version = hasVersionColumn ? SafeString(result.Data.Version) : "",
                        ChangeHistory = hasChangeHistoryColumn ? SafeString(result.Data.ChangeHistory) : "",
                        UpdateTime = FormatDbDateTime(result.Data.UpdateTime)
                    });
                }

                return new DosResult<object>(0, null, $"未找到接口引擎：{apiEngineKey}");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取接口引擎代码失败：" + ex.Message);
            }
        }

        #endregion

        #region GetUpdatedApiEngines

        /// <summary>
        /// 获取增量更新的接口引擎列表
        /// </summary>
        public static async Task<DosResult<object>> GetUpdatedApiEngines(string osClient, string lastSyncTime)
        {
            DateTime syncTime;
            if (!DateTime.TryParse(lastSyncTime, out syncTime))
            {
                syncTime = DateTime.MinValue;
            }

            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "ApiName", "ApiEngineKey", "Category", "ApiAddress", "IsEnable", "ApiRemark", "ApiV8Code", "UpdateTime", "IsDeleted" },
                    _Where = new List<object>()
                    {
                        new List<object>() { "UpdateTime", ">", syncTime.ToString("yyyy-MM-dd HH:mm:ss") }
                    },
                    _OrderBy = "UpdateTime",
                    _OrderByType = "ASC"
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var list = new List<dynamic>();
                    foreach (var item in result.Data)
                    {
                        var apiV8Code = (string)item.ApiV8Code ?? "";
                        apiV8Code = DecodeLegacyApiV8Code(apiV8Code);

                        list.Add(new
                        {
                            Id = (string)item.Id,
                            ApiName = (string)item.ApiName ?? "",
                            ApiEngineKey = (string)item.ApiEngineKey ?? "",
                            Category = (string)item.Category ?? "未分类",
                            ApiAddress = (string)item.ApiAddress ?? "",
                            IsEnable = item.IsEnable,
                            ApiRemark = (string)item.ApiRemark ?? "",
                            ApiV8Code = apiV8Code,
                            UpdateTime = FormatDbDateTime(item.UpdateTime),
                            IsDeleted = item.IsDeleted
                        });
                    }
                    return new DosResult<object>(1, new
                    {
                        OsClient = osClient,
                        List = list,
                        Total = list.Count,
                        ServerTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    });
                }

                return new DosResult<object>(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取增量更新列表失败：" + ex.Message);
            }
        }

        #endregion

        #region UpdateApiEngineCode

        /// <summary>
        /// 更新接口引擎代码（本地 → 数据库）
        /// </summary>
        public static async Task<DosResult<object>> UpdateApiEngineCode(string osClient, string apiEngineKey, string apiV8Code, string version = null, string changeHistory = null)
        {
            try
            {
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                {
                    return new DosResult<object>(0, null, $"未找到租户数据库连接：{osClient}");
                }

                var getSection = client.Db.FromSql("SELECT Id FROM sys_apiengine WHERE ApiEngineKey=?key AND (IsDeleted=0 OR IsDeleted IS NULL) LIMIT 1")
                    .AddInParameter("?key", apiEngineKey);
                getSection.SetCommandTimeout(10);
                var id = getSection.ToScalar<string>();

                if (id.DosIsNullOrWhiteSpace())
                {
                    return new DosResult<object>(0, null, $"未找到接口引擎：{apiEngineKey}");
                }

                var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                var plainCode = apiV8Code ?? "";
                var resolvedVersion = ResolveV8SemanticVersion(version, plainCode);
                var changeHistoryEntry = BuildV8ChangeHistoryEntry(resolvedVersion, changeHistory);
                var hasVersionColumn = SysApiEngineHasColumn(osClient, "Version");
                var hasChangeHistoryColumn = SysApiEngineHasColumn(osClient, "ChangeHistory");
                var setParts = new List<string> { "ApiV8Code=?code", "UpdateTime=?now" };
                if (hasVersionColumn && !resolvedVersion.DosIsNullOrWhiteSpace()) setParts.Add("`Version`=?version");
                if (hasChangeHistoryColumn && !changeHistoryEntry.DosIsNullOrWhiteSpace()) setParts.Add("`ChangeHistory`=CONCAT(?history, IFNULL(`ChangeHistory`,''))");

                var updateSection = client.Db.FromSql($"UPDATE sys_apiengine SET {string.Join(", ", setParts)} WHERE Id=?id")
                    .AddInParameter("?code", plainCode)
                    .AddInParameter("?now", now);
                if (hasVersionColumn && !resolvedVersion.DosIsNullOrWhiteSpace()) updateSection.AddInParameter("?version", resolvedVersion);
                if (hasChangeHistoryColumn && !changeHistoryEntry.DosIsNullOrWhiteSpace()) updateSection.AddInParameter("?history", changeHistoryEntry);
                updateSection.AddInParameter("?id", id);
                updateSection.SetCommandTimeout(10);
                var affected = updateSection.ExecuteNonQuery();

                if (affected <= 0)
                {
                    return new DosResult<object>(0, null, $"接口引擎 [{apiEngineKey}] 代码未更新");
                }

                var cacheRefreshStatus = "OK";
                var cacheTask = Task.Run(() => RefreshApiEngineRouteCache(osClient, apiEngineKey, id));
                var completedTask = await Task.WhenAny(cacheTask, Task.Delay(3000));
                if (completedTask == cacheTask)
                {
                    var cacheResult = await cacheTask;
                    if (cacheResult.Code != 1)
                    {
                        cacheRefreshStatus = cacheResult.Msg;
                    }
                }
                else
                {
                    cacheRefreshStatus = "刷新接口缓存超时，代码已保存到数据库；接口路由缓存将在重启或后续刷新后生效";
                }

                return new DosResult<object>(1, new
                {
                    Message = $"接口引擎 [{apiEngineKey}] 代码已同步到数据库",
                    UpdateTime = now,
                    Version = resolvedVersion,
                    CacheRefresh = cacheRefreshStatus
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "更新接口引擎代码失败：" + ex.Message);
            }
        }

        #endregion

        #region CreateApiEngine

        /// <summary>
        /// 新增接口引擎
        /// </summary>
        public static async Task<DosResult<object>> CreateApiEngine(
            string osClient, string apiName, string apiEngineKey,
            string apiAddress, string apiRemark, int lockVal, int allowAnonymous,
            int isEnable, string category, string apiV8Code = null,
            string version = null, string changeHistory = null)
        {
            try
            {
                // 检查 ApiEngineKey 是否已存在
                var existResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "ApiEngineKey", "=", apiEngineKey },
                        
                    }
                });
                if (existResult.Code == 1 && existResult.Data != null)
                {
                    return new DosResult<object>(0, null, $"ApiEngineKey [{apiEngineKey}] 已存在");
                }

                var resolvedVersion = ResolveV8SemanticVersion(version, apiV8Code, "v1.0.0");
                var changeHistoryEntry = BuildV8ChangeHistoryEntry(resolvedVersion, changeHistory);
                var hasVersionColumn = SysApiEngineHasColumn(osClient, "Version");
                var hasChangeHistoryColumn = SysApiEngineHasColumn(osClient, "ChangeHistory");
                var addParam = new JObject
                {
                    ["OsClient"] = osClient,
                    ["ApiName"] = apiName,
                    ["ApiEngineKey"] = apiEngineKey,
                    ["ApiAddress"] = apiAddress ?? "",
                    ["ApiRemark"] = apiRemark ?? "",
                    ["Lock"] = lockVal,
                    ["AllowAnonymous"] = allowAnonymous,
                    ["IsEnable"] = isEnable,
                    ["Category"] = category ?? "未分类",
                    ["ApiV8Code"] = apiV8Code ?? "",
                    ["ApiRole"] = "[]",
                    ["EnableLog"] = 0,
                    ["StopHttp"] = 0,
                    ["Timeout"] = 600,
                    ["MaxStatements"] = 100000000,
                    ["LimitMemory"] = 2048,
                    ["LimitRecursion"] = 10000,
                    ["Files"] = "[]",
                    ["IsDeleted"] = 0,
                    ["UpdateTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    ["_InvokeType"] = "Client"
                };
                if (hasVersionColumn) addParam["Version"] = resolvedVersion;
                if (hasChangeHistoryColumn && !changeHistoryEntry.DosIsNullOrWhiteSpace()) addParam["ChangeHistory"] = changeHistoryEntry;

                var addResult = await MicroiEngine.FormEngine.AddFormDataAsync("sys_apiengine", addParam);

                if (addResult.Code == 1)
                {
                    var cacheResult = await RefreshApiEngineRouteCache(osClient, apiEngineKey);
                    if (cacheResult.Code != 1)
                    {
                        return new DosResult<object>(0, null, cacheResult.Msg);
                    }

                    return new DosResult<object>(1, new
                    {
                        Message = $"接口引擎 [{apiEngineKey}] 创建成功",
                        ApiEngineKey = apiEngineKey,
                        Version = resolvedVersion,
                        Category = category ?? "未分类"
                    });
                }

                return new DosResult<object>(addResult.Code, addResult.Data, addResult.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "创建接口引擎失败：" + ex.Message);
            }
        }

        #endregion

        #region CheckVersions

        /// <summary>
        /// 版本检查项
        /// </summary>
        public class VersionCheckItem
        {
            public string ApiEngineKey { get; set; }
            public string LocalUpdateTime { get; set; }
        }

        /// <summary>
        /// 批量检查代码版本（用于冲突检测）
        /// </summary>
        public static async Task<DosResult<object>> CheckVersions(string osClient, List<VersionCheckItem> items)
        {
            try
            {
                var conflicts = new List<dynamic>();

                foreach (var item in items)
                {
                    var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                    {
                        OsClient = osClient,
                        _SelectFields = new[] { "ApiEngineKey", "UpdateTime", "ApiV8Code" },
                        _Where = new List<object>()
                        {
                            new List<object>() { "ApiEngineKey", "=", item.ApiEngineKey },
                            
                        }
                    });

                    if (result.Code == 1 && result.Data != null)
                    {
                        var dbUpdateTime = result.Data.UpdateTime;
                        if (dbUpdateTime != null)
                        {
                            var dbTime = (DateTime)dbUpdateTime;
                            if (!string.IsNullOrEmpty(item.LocalUpdateTime))
                            {
                                var localTime = DateTime.Parse(item.LocalUpdateTime);
                                if (dbTime > localTime)
                                {
                                    var dbCode = DecodeLegacyApiV8Code((string)result.Data.ApiV8Code ?? "");
                                    conflicts.Add(new
                                    {
                                        ApiEngineKey = item.ApiEngineKey,
                                        LocalUpdateTime = item.LocalUpdateTime,
                                        DbUpdateTime = dbTime.ToString("yyyy-MM-dd HH:mm:ss"),
                                        DbCode = dbCode
                                    });
                                }
                            }
                        }
                    }
                }

                return new DosResult<object>(1, new
                {
                    HasConflicts = conflicts.Count > 0,
                    Conflicts = conflicts,
                    ServerTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "检查版本失败：" + ex.Message);
            }
        }

        #endregion

        #region ExecuteApiEngine

        /// <summary>
        /// 执行接口引擎代码（远程调试）
        /// </summary>
        public static async Task<DosResult<object>> ExecuteApiEngine(
            string osClient, string apiEngineKey, string v8Code,
            JObject paramData, dynamic currentToken, HttpContext httpContext)
        {
            if (apiEngineKey.DosIsNullOrWhiteSpace())
            {
                return new DosResult<object>(0, null, "ApiEngineKey 不能为空。MCP 执行接口引擎必须走真实接口引擎上下文。");
            }

            try
            {
                var executeParam = paramData != null ? (JObject)paramData.DeepClone() : new JObject();
                executeParam["OsClient"] = osClient;
                executeParam["ApiEngineKey"] = apiEngineKey;
                executeParam["_InvokeType"] = "Server";
                if (!v8Code.DosIsNullOrWhiteSpace())
                {
                    executeParam["_McpDebugExecute"] = true;
                    executeParam["_McpDebugV8Code"] = v8Code;
                }
                try
                {
                    if (currentToken?.CurrentUser != null)
                    {
                        executeParam["_CurrentUser"] = JToken.FromObject(currentToken.CurrentUser);
                    }
                }
                catch { }

                var consoleOutput = new StringBuilder();
                var originalOut = Console.Out;
                var stringWriter = new System.IO.StringWriter(consoleOutput);
                var stopwatch = Stopwatch.StartNew();

                Console.SetOut(stringWriter);
                try
                {
                    var apiResult = await MicroiEngine.ApiEngine.RunAsync(executeParam);
                    stopwatch.Stop();
                    Console.SetOut(originalOut);

                    var resultCode = ExtractResultCode(apiResult, 1);
                    var resultMsg = ExtractResultMsg(apiResult);
                    return new DosResult<object>(resultCode, new
                    {
                        Result = apiResult,
                        Data = apiResult,
                        ConsoleOutput = SplitConsoleOutput(consoleOutput.ToString()),
                        ExecutionTime = stopwatch.ElapsedMilliseconds,
                        ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }, resultMsg);
                }
                catch (Exception runEx)
                {
                    stopwatch.Stop();
                    Console.SetOut(originalOut);
                    return new DosResult<object>(0, new
                    {
                        ConsoleOutput = SplitConsoleOutput(consoleOutput.ToString()),
                        Error = runEx.Message,
                        StackTrace = runEx.StackTrace,
                        ExecutionTime = stopwatch.ElapsedMilliseconds,
                        ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }, "V8引擎执行异常：" + runEx.Message);
                }
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "执行接口引擎失败：" + ex.Message);
            }
        }

        #endregion

        #region GetV8EventList

        /// <summary>
        /// V8事件字段列表
        /// </summary>
        private static readonly string[] V8EventFields = new[] {
            "SubmitBeforeServerV8",
            "SubmitAfterServerV8",
            "SubmitFormV8",
            "ServerDataV8",
            "InFormV8",
            "OutFormV8",
            "DataFilterV8"
        };

        /// <summary>
        /// V8事件字段→中文名映射
        /// </summary>
        private static string GetEventDisplayName(string field) => field switch
        {
            "SubmitBeforeServerV8" => "后端表单提交前",
            "SubmitAfterServerV8" => "后端表单提交后",
            "SubmitFormV8" => "前端表单提交",
            "ServerDataV8" => "后端数据",
            "InFormV8" => "进入表单",
            "OutFormV8" => "离开表单",
            "DataFilterV8" => "数据过滤/脱敏",
            _ => field
        };

        /// <summary>
        /// 获取 V8 事件列表
        /// </summary>
        public static async Task<DosResult<object>> GetV8EventList(string osClient)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("Diy_Table", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "Description" }
                        .Concat(V8EventFields)
                        .ToArray(),
                    _Where = new List<object>()
                    {
                        
                    }
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var list = new List<dynamic>();

                    foreach (var item in result.Data)
                    {
                        var tableName = (string)item.Name ?? "";
                        if (tableName.DosIsNullOrWhiteSpace()) continue;
                        var tableDescription = (string)item.Description ?? "";

                        foreach (var field in V8EventFields)
                        {
                            var code = "";
                            try
                            {
                                var rawValue = ((JObject)JObject.FromObject(item))[field]?.ToString() ?? "";
                                if (!rawValue.DosIsNullOrWhiteSpace())
                                {
                                    code = V8Base64.Base64ToString(rawValue);
                                    if (code.DosIsNullOrWhiteSpace())
                                    {
                                        code = rawValue;
                                    }
                                }
                            }
                            catch
                            {
                                try { code = (string)((IDictionary<string, object>)item)[field] ?? ""; } catch { }
                            }

                            list.Add(new
                            {
                                Id = (string)item.Id,
                                FormEngineKey = tableName,
                                Description = tableDescription,
                                EventType = field,
                                EventName = GetEventDisplayName(field),
                                V8Code = code,
                                UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                            });
                        }
                    }

                    return new DosResult<object>(1, new
                    {
                        OsClient = osClient,
                        List = list,
                        Total = list.Count
                    });
                }

                return new DosResult<object>(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取V8事件列表失败：" + ex.Message);
            }
        }

        #endregion

        #region GetV8EventCode

        /// <summary>
        /// 获取单个 V8 事件代码
        /// </summary>
        public static async Task<DosResult<object>> GetV8EventCode(string osClient, string formEngineKey, string eventType)
        {
            if (!V8EventFields.Contains(eventType))
            {
                return new DosResult<object>(0, null, $"无效的事件类型：{eventType}");
            }

            try
            {
                var getResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("Diy_Table", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "Description", eventType },
                    _Where = new List<object>()
                    {
                        new List<object>() { "Name", "=", formEngineKey },
                        
                    }
                });

                if (getResult.Code != 1 || getResult.Data == null)
                {
                    return new DosResult<object>(0, null, $"未找到表单引擎：{formEngineKey}");
                }

                var code = "";
                try
                {
                    var rawValue = ((JObject)JObject.FromObject(getResult.Data))[eventType]?.ToString() ?? "";
                    if (!rawValue.DosIsNullOrWhiteSpace())
                    {
                        code = V8Base64.Base64ToString(rawValue);
                        if (code.DosIsNullOrWhiteSpace())
                        {
                            code = rawValue;
                        }
                    }
                }
                catch
                {
                    try { code = (string)((IDictionary<string, object>)getResult.Data)[eventType] ?? ""; } catch { }
                }

                return new DosResult<object>(1, new
                {
                    Id = (string)getResult.Data.Id,
                    FormEngineKey = formEngineKey,
                    Description = (string)getResult.Data.Description ?? "",
                    EventType = eventType,
                    EventName = GetEventDisplayName(eventType),
                    Code = code,
                    UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取V8事件代码失败：" + ex.Message);
            }
        }

        #endregion

        #region UpdateV8EventCode

        /// <summary>
        /// 有效的事件类型列表
        /// </summary>
        private static readonly string[] ValidEventTypes = new[] {
            "SubmitBeforeServerV8", "SubmitAfterServerV8", "SubmitFormV8",
            "ServerDataV8", "InFormV8", "OutFormV8", "DataFilterV8"
        };

        /// <summary>
        /// 更新 V8 事件代码
        /// </summary>
        public static async Task<DosResult<object>> UpdateV8EventCode(string osClient, string formEngineKey, string eventType, string v8Code)
        {
            if (!ValidEventTypes.Contains(eventType))
            {
                return new DosResult<object>(0, null, $"无效的事件类型：{eventType}");
            }

            try
            {
                var getResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("Diy_Table", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "Name", "=", formEngineKey },
                        
                    }
                });

                if (getResult.Code != 1 || getResult.Data == null)
                {
                    return new DosResult<object>(0, null, $"未找到表单引擎：{formEngineKey}");
                }

                var id = (string)getResult.Data.Id;
                var existingName = (string)getResult.Data.Name ?? "";

                var updateParam = new JObject
                {
                    ["OsClient"] = osClient,
                    ["Id"] = id,
                    ["Name"] = existingName,
                    [eventType] = v8Code ?? "",
                    ["_InvokeType"] = "Client"
                };

                var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync("Diy_Table", updateParam);

                if (updateResult.Code == 1)
                {
                    var cacheResult = await RefreshDiyTableModelCache(osClient, formEngineKey, id);
                    if (cacheResult.Code != 1)
                    {
                        return new DosResult<object>(0, null, cacheResult.Msg);
                    }

                    return new DosResult<object>(1, new
                    {
                        Message = $"表单引擎 [{formEngineKey}] 的 {eventType} 事件代码已同步到数据库",
                        UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    });
                }

                return new DosResult<object>(updateResult.Code, updateResult.Data, updateResult.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "更新V8事件代码失败：" + ex.Message);
            }
        }

        #endregion

        #region WorkflowNodeV8

        private static readonly string[] WorkflowNodeV8Fields = new[] {
            "StartV8",
            "EndV8",
            "StartV8Server",
            "EndV8Server",
            "LineValueV8",
            "AllowAddUserV8Code"
        };

        private static string GetWorkflowNodeV8DisplayName(string field) => field switch
        {
            "StartV8" => "节点开始前端V8事件",
            "EndV8" => "节点结束前端V8事件",
            "StartV8Server" => "节点开始后端V8事件",
            "EndV8Server" => "节点结束后端V8事件",
            "LineValueV8" => "条件判断V8事件",
            "AllowAddUserV8Code" => "允许添加审批人V8事件",
            _ => field
        };

        private static string DecodeWorkflowNodeV8Code(object value)
        {
            return DecodeLegacyApiV8Code(SafeString(value));
        }

        private static JObject DecodeWorkflowNodeV8Fields(JObject row)
        {
            var clone = row == null ? new JObject() : (JObject)row.DeepClone();
            foreach (var field in WorkflowNodeV8Fields)
            {
                if (clone[field] != null)
                {
                    clone[field] = DecodeWorkflowNodeV8Code(clone[field]);
                }
            }
            return clone;
        }

        /// <summary>
        /// 获取流程节点 V8 事件列表，同时返回流程设计、节点和连线快照。
        /// WF_Line 仅作为路由/设计数据返回；运行时执行的条件 V8 位于 WF_Node.LineValueV8。
        /// </summary>
        public static async Task<DosResult<object>> GetWorkflowV8EventList(string osClient, string flowDesignId = null)
        {
            try
            {
                var flowWhere = new List<object>();
                if (!IsBlank(flowDesignId))
                {
                    flowWhere.Add(new List<object>() { "Id", "=", flowDesignId });
                }

                var flowResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("wf_flowdesign", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "FlowName", "Category", "IsEnable", "Description", "JsonData", "StartV8", "EndV8", "LineValueV8", "Remark", "Sort", "Roles", "Preview", "TableId", "UpdateTime" },
                    _Where = flowWhere
                });

                if (flowResult.Code != 1)
                {
                    return new DosResult<object>(flowResult.Code, flowResult.Data, flowResult.Msg);
                }

                var flowRows = new List<JObject>();
                if (flowResult.Data != null)
                {
                    foreach (var item in flowResult.Data)
                    {
                        flowRows.Add(JObject.FromObject(item));
                    }
                }

                var flowIds = flowRows
                    .Select(row => SafeJString(row, "Id"))
                    .Where(id => !IsBlank(id))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (!flowIds.Any())
                {
                    return new DosResult<object>(1, new
                    {
                        OsClient = osClient,
                        Flows = flowRows,
                        Nodes = new List<object>(),
                        Lines = new List<object>(),
                        List = new List<object>(),
                        Total = 0
                    });
                }

                var nodeSelectFields = new List<string> { "Id", "FlowDesignId", "NodeName", "NodeType", "Sort", "PositionLeft", "PositionTop", "Remark", "UpdateTime" };
                nodeSelectFields.AddRange(WorkflowNodeV8Fields);
                var nodeResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("wf_node", new
                {
                    OsClient = osClient,
                    _SelectFields = nodeSelectFields.ToArray(),
                    _Where = new List<object>() { new List<object>() { "FlowDesignId", "In", flowIds } }
                });

                if (nodeResult.Code != 1)
                {
                    return new DosResult<object>(nodeResult.Code, nodeResult.Data, nodeResult.Msg);
                }

                var lineResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("wf_line", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "FlowDesignId", "LineName", "FromNodeId", "ToNodeId", "LineValue", "V8Code", "UpdateTime" },
                    _Where = new List<object>() { new List<object>() { "FlowDesignId", "In", flowIds } }
                });

                if (lineResult.Code != 1)
                {
                    return new DosResult<object>(lineResult.Code, lineResult.Data, lineResult.Msg);
                }

                var flowById = flowRows.ToDictionary(row => SafeJString(row, "Id"), row => row, StringComparer.OrdinalIgnoreCase);
                var nodeRows = new List<JObject>();
                if (nodeResult.Data != null)
                {
                    foreach (var item in nodeResult.Data)
                    {
                        nodeRows.Add(DecodeWorkflowNodeV8Fields(JObject.FromObject(item)));
                    }
                }

                var lineRows = new List<JObject>();
                if (lineResult.Data != null)
                {
                    foreach (var item in lineResult.Data)
                    {
                        lineRows.Add(JObject.FromObject(item));
                    }
                }

                var list = new List<object>();
                foreach (var node in nodeRows)
                {
                    var nodeId = SafeJString(node, "Id");
                    var currentFlowDesignId = SafeJString(node, "FlowDesignId");
                    var flow = flowById.TryGetValue(currentFlowDesignId, out var flowRow) ? flowRow : null;
                    var flowName = SafeJString(flow, "FlowName");
                    var nodeName = SafeJString(node, "NodeName");
                    var nodeUpdateTime = SafeJString(node, "UpdateTime");

                    foreach (var field in WorkflowNodeV8Fields)
                    {
                        var code = SafeJString(node, field);
                        list.Add(new
                        {
                            Id = nodeId,
                            FlowDesignId = currentFlowDesignId,
                            FlowName = flowName,
                            NodeId = nodeId,
                            NodeName = nodeName,
                            NodeType = SafeJString(node, "NodeType"),
                            EventType = field,
                            EventName = GetWorkflowNodeV8DisplayName(field),
                            V8Code = code,
                            Code = code,
                            Version = ExtractV8SemanticVersion(code),
                            UpdateTime = nodeUpdateTime
                        });
                    }
                }

                return new DosResult<object>(1, new
                {
                    OsClient = osClient,
                    Flows = flowRows,
                    Nodes = nodeRows,
                    Lines = lineRows,
                    List = list,
                    Total = list.Count
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取流程节点V8事件列表失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 获取单个流程节点 V8 事件代码。
        /// </summary>
        public static async Task<DosResult<object>> GetWorkflowV8EventCode(string osClient, string nodeId, string eventType, string flowDesignId = null)
        {
            if (!WorkflowNodeV8Fields.Contains(eventType))
            {
                return new DosResult<object>(0, null, $"无效的流程节点V8事件类型：{eventType}");
            }

            if (IsBlank(nodeId))
            {
                return new DosResult<object>(0, null, "NodeId 不能为空");
            }

            try
            {
                var nodeSelectFields = new List<string> { "Id", "FlowDesignId", "NodeName", "NodeType", "UpdateTime" };
                nodeSelectFields.AddRange(WorkflowNodeV8Fields);
                var nodeResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("wf_node", new
                {
                    OsClient = osClient,
                    Id = nodeId,
                    _SelectFields = nodeSelectFields.ToArray()
                });

                if (nodeResult.Code != 1 || nodeResult.Data == null)
                {
                    return new DosResult<object>(0, null, $"未找到流程节点：{nodeId}");
                }

                var node = DecodeWorkflowNodeV8Fields(JObject.FromObject(nodeResult.Data));
                var currentFlowDesignId = SafeJString(node, "FlowDesignId");
                if (!IsBlank(flowDesignId) && !string.Equals(currentFlowDesignId, flowDesignId, StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult<object>(0, null, $"流程节点 {nodeId} 不属于流程 {flowDesignId}");
                }

                var flowName = "";
                if (!IsBlank(currentFlowDesignId))
                {
                    var flowResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("wf_flowdesign", new
                    {
                        OsClient = osClient,
                        Id = currentFlowDesignId,
                        _SelectFields = new[] { "Id", "FlowName" }
                    });
                    if (flowResult.Code == 1 && flowResult.Data != null)
                    {
                        flowName = SafeJString(JObject.FromObject(flowResult.Data), "FlowName");
                    }
                }

                var code = SafeJString(node, eventType);
                return new DosResult<object>(1, new
                {
                    Id = nodeId,
                    FlowDesignId = currentFlowDesignId,
                    FlowName = flowName,
                    NodeId = nodeId,
                    NodeName = SafeJString(node, "NodeName"),
                    NodeType = SafeJString(node, "NodeType"),
                    EventType = eventType,
                    EventName = GetWorkflowNodeV8DisplayName(eventType),
                    V8Code = code,
                    Code = code,
                    Version = ExtractV8SemanticVersion(code),
                    UpdateTime = SafeJString(node, "UpdateTime")
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取流程节点V8事件代码失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 更新单个流程节点 V8 事件代码。
        /// </summary>
        public static async Task<DosResult<object>> UpdateWorkflowV8EventCode(string osClient, string nodeId, string eventType, string v8Code, string flowDesignId = null)
        {
            if (!WorkflowNodeV8Fields.Contains(eventType))
            {
                return new DosResult<object>(0, null, $"无效的流程节点V8事件类型：{eventType}");
            }

            if (IsBlank(nodeId))
            {
                return new DosResult<object>(0, null, "NodeId 不能为空");
            }

            try
            {
                var nodeResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("wf_node", new
                {
                    OsClient = osClient,
                    Id = nodeId,
                    _SelectFields = new[] { "Id", "FlowDesignId", "NodeName" }
                });

                if (nodeResult.Code != 1 || nodeResult.Data == null)
                {
                    return new DosResult<object>(0, null, $"未找到流程节点：{nodeId}");
                }

                var node = JObject.FromObject(nodeResult.Data);
                var currentFlowDesignId = SafeJString(node, "FlowDesignId");
                if (!IsBlank(flowDesignId) && !string.Equals(currentFlowDesignId, flowDesignId, StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult<object>(0, null, $"流程节点 {nodeId} 不属于流程 {flowDesignId}");
                }

                var updateParam = new JObject
                {
                    ["OsClient"] = osClient,
                    ["Id"] = nodeId,
                    ["NodeName"] = SafeJString(node, "NodeName"),
                    [eventType] = v8Code ?? ""
                };

                var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync("wf_node", updateParam);
                if (updateResult.Code == 1)
                {
                    return new DosResult<object>(1, new
                    {
                        Message = $"流程节点 [{nodeId}] 的 {eventType} 事件代码已同步到数据库",
                        FlowDesignId = currentFlowDesignId,
                        NodeId = nodeId,
                        EventType = eventType,
                        UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    });
                }

                return new DosResult<object>(updateResult.Code, updateResult.Data, updateResult.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "更新流程节点V8事件代码失败：" + ex.Message);
            }
        }

        #endregion

        #region ExecuteV8Event

        /// <summary>
        /// 执行 V8 事件代码（远程调试）
        /// </summary>
        public static async Task<DosResult<object>> ExecuteV8Event(
            string osClient, string eventType, string v8Code,
            JObject formData, dynamic currentToken, HttpContext httpContext)
        {
            try
            {
                var sysConfigResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_config", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "OsClient", "=", osClient }
                    }
                });

                var consoleOutput = new StringBuilder();
                var originalOut = Console.Out;
                var stringWriter = new System.IO.StringWriter(consoleOutput);

                var v8EngineParam = new V8EngineParam()
                {
                    HttpContext = httpContext,
                    OsClient = osClient,
                    SysConfig = sysConfigResult?.Data,
                    EventName = eventType ?? "DebugEvent",
                    InvokeType = "Server",
                    Form = formData,
                    Param = new JObject(),
                    CurrentUser = currentToken.CurrentUser,
                    CurrentSysUser = currentToken.CurrentUser,
                    V8Code = v8Code,
                    Action = new Dictionary<string, object>()
                };

                Console.SetOut(stringWriter);
                try
                {
                    var v8RunResult = await MicroiEngine.V8Engine.Run(v8EngineParam);
                    Console.SetOut(originalOut);

                    if (v8RunResult.Code == 1)
                    {
                        var resultParam = v8RunResult.Data;
                        return new DosResult<object>(1, new
                        {
                            Result = resultParam?.Result,
                            ConsoleOutput = consoleOutput.ToString(),
                            ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                        });
                    }
                    else
                    {
                        return new DosResult<object>(0, new
                        {
                            ConsoleOutput = consoleOutput.ToString(),
                            ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                        }, v8RunResult.Msg ?? "执行失败");
                    }
                }
                catch (Exception runEx)
                {
                    Console.SetOut(originalOut);
                    return new DosResult<object>(0, new
                    {
                        ConsoleOutput = consoleOutput.ToString(),
                        Error = runEx.Message,
                        StackTrace = runEx.StackTrace,
                        ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }, "V8事件执行异常：" + runEx.Message);
                }
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "执行V8事件失败：" + ex.Message);
            }
        }

        #endregion

        #region GetDbSchema

        /// <summary>
        /// 获取数据库结构（表、字段、菜单树）
        /// </summary>
        public static async Task<DosResult<object>> GetDbSchema(string osClient)
        {
            try
            {
                // 步骤1：查询 diy_table 表数据
                var tableResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_table", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "Description" },
                    PageSize = 10000,
                    _OrderBy = "Name",
                    _OrderByType = "ASC"
                });

                if (tableResult.Code != 1)
                {
                    return new DosResult<object>(0, null, "查询 diy_table 失败：" + tableResult.Msg);
                }

                var tables = tableResult.Data ?? new List<dynamic>();

                // 步骤2：查询 diy_field 表数据
                var fieldResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_field", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "Label", "Description", "Type", "Component", "TableId", "Config" },
                    PageSize = 50000,
                    _OrderBy = "TableId",
                    _OrderByType = "ASC"
                });

                if (fieldResult.Code != 1)
                {
                    return new DosResult<object>(0, null, "查询 diy_field 失败：" + fieldResult.Msg);
                }

                var fields = fieldResult.Data ?? new List<dynamic>();

                // 步骤3：处理字段，解析 Config
                var tableFieldsMap = new Dictionary<string, List<object>>();
                foreach (var field in fields)
                {
                    string tableId = (string)field.TableId ?? "";
                    string tableChildTableId = null;
                    string tableChildSysMenuId = null;

                    // 解析 Config JSON
                    var configStr = (string)field.Config;
                    if (!string.IsNullOrWhiteSpace(configStr))
                    {
                        try
                        {
                            var configObj = JObject.Parse(configStr);
                            tableChildTableId = configObj["TableChildTableId"]?.ToString();
                            tableChildSysMenuId = configObj["TableChildSysMenuId"]?.ToString();
                        }
                        catch { }
                    }

                    if (!tableFieldsMap.ContainsKey(tableId))
                    {
                        tableFieldsMap[tableId] = new List<object>();
                    }

                    tableFieldsMap[tableId].Add(new
                    {
                        Id = (string)field.Id,
                        Name = (string)field.Name,
                        Label = (string)field.Label,
                        Description = (string)field.Description,
                        Type = (string)field.Type,
                        Component = (string)field.Component,
                        TableChildTableId = tableChildTableId,
                        TableChildSysMenuId = tableChildSysMenuId
                    });
                }

                // 步骤4：组装 Tables
                var processedTables = new List<object>();
                foreach (var table in tables)
                {
                    var tableId = (string)table.Id ?? "";
                    processedTables.Add(new
                    {
                        Id = tableId,
                        Name = (string)table.Name,
                        Description = (string)table.Description,
                        _Fields = tableFieldsMap.ContainsKey(tableId) ? tableFieldsMap[tableId] : new List<object>()
                    });
                }

                // 步骤5：查询 sys_menu 表数据
                var menuResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_menu", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "ParentId", "DiyTableId" },
                    PageSize = 10000,
                    _OrderBy = "Id",
                    _OrderByType = "ASC"
                });

                var rootMenus = new List<object>();
                if (menuResult.Code == 1 && menuResult.Data != null)
                {
                    // 步骤6：构建菜单树
                    var menuMap = new Dictionary<string, JObject>();
                    foreach (var menu in menuResult.Data)
                    {
                        var menuId = (string)menu.Id ?? "";
                        menuMap[menuId] = new JObject
                        {
                            ["Id"] = (string)menu.Id,
                            ["Name"] = (string)menu.Name,
                            ["ParentId"] = (string)menu.ParentId,
                            ["DiyTableId"] = (string)menu.DiyTableId,
                            ["_Child"] = new JArray()
                        };
                    }

                    foreach (var kvp in menuMap)
                    {
                        var parentId = kvp.Value["ParentId"]?.ToString();
                        if (!string.IsNullOrEmpty(parentId) && menuMap.ContainsKey(parentId))
                        {
                            ((JArray)menuMap[parentId]["_Child"]).Add(kvp.Value);
                        }
                        else
                        {
                            rootMenus.Add(kvp.Value);
                        }
                    }
                }

                return new DosResult<object>(1, new
                {
                    Tables = processedTables,
                    Menus = rootMenus,
                    Summary = new
                    {
                        TableCount = processedTables.Count,
                        FieldCount = fields is IEnumerable<dynamic> fieldList ? fieldList.Count() : 0,
                        MenuCount = rootMenus.Count
                    }
                }, "获取数据库结构成功");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取数据库结构失败：" + ex.Message);
            }
        }

        #endregion

        #region GetPlaywrightContext

        /// <summary>
        /// 获取 Playwright 自动化测试上下文（接口引擎、菜单路由、推荐环境变量）
        /// </summary>
        public static async Task<DosResult<object>> GetPlaywrightContext(string osClient, string keyword = null, string apiBaseUrl = null, int pageSize = 5000)
        {
            try
            {
                var normalizedPageSize = Math.Min(Math.Max(pageSize <= 0 ? 5000 : pageSize, 100), 20000);
                var engineResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] {
                        "Id", "ApiName", "ApiEngineKey", "Category", "ApiAddress", "ApiRemark",
                        "AllowAnonymous", "StopHttp", "IsEnable", "UpdateTime"
                    },
                    _Where = BuildKeywordWhere(keyword, "ApiName", "ApiEngineKey", "Category", "ApiRemark", "ApiAddress"),
                    _OrderBy = "Category",
                    _OrderByType = "ASC",
                    _PageSize = normalizedPageSize
                });

                if (engineResult.Code != 1)
                {
                    return new DosResult<object>(engineResult.Code, null, "获取接口引擎测试上下文失败：" + engineResult.Msg);
                }

                var engines = new List<object>();
                var warnings = new List<string>();
                var publicEngineCount = 0;
                var protectedEngineCount = 0;
                foreach (var item in engineResult.Data ?? new List<dynamic>())
                {
                    var row = JObject.FromObject(item);
                    var allowAnonymous = SafeJInt(row, "AllowAnonymous", 0);
                    var stopHttp = SafeJInt(row, "StopHttp", 0);
                    var isEnable = SafeJInt(row, "IsEnable", 1);
                    if (allowAnonymous == 1 && stopHttp != 1 && isEnable != 0) publicEngineCount++;
                    if (allowAnonymous != 1 && stopHttp != 1 && isEnable != 0) protectedEngineCount++;

                    engines.Add(new
                    {
                        Id = SafeJString(row, "Id"),
                        ApiName = SafeJString(row, "ApiName"),
                        ApiEngineKey = SafeJString(row, "ApiEngineKey"),
                        Category = SafeJString(row, "Category", "未分类"),
                        ApiAddress = SafeJString(row, "ApiAddress"),
                        ApiRemark = SafeJString(row, "ApiRemark"),
                        AllowAnonymous = allowAnonymous,
                        StopHttp = stopHttp,
                        IsEnable = isEnable,
                        UpdateTime = SafeJString(row, "UpdateTime")
                    });
                }
                if (engines.Count >= normalizedPageSize) warnings.Add($"接口引擎数量达到 PageSize={normalizedPageSize} 上限，建议提高 PageSize 或按 Keyword 分批获取。");

                var moduleResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_menu", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] {
                        "Id", "Name", "ParentId", "DiyTableId", "DiyTableName", "Url", "ComponentName",
                        "ComponentPath", "OpenType", "Display", "AppDisplay", "Sort", "Icon", "UpdateTime"
                    },
                    _Where = BuildKeywordWhere(keyword, "Name", "Url", "DiyTableName", "ComponentName"),
                    _OrderBy = "Sort",
                    _OrderByType = "ASC",
                    _PageSize = normalizedPageSize
                });

                var modules = new List<object>();
                if (moduleResult.Code == 1 && moduleResult.Data != null)
                {
                    foreach (var item in moduleResult.Data)
                    {
                        var row = JObject.FromObject(item);
                        modules.Add(new
                        {
                            Id = SafeJString(row, "Id"),
                            Name = SafeJString(row, "Name"),
                            ParentId = SafeJString(row, "ParentId"),
                            DiyTableId = SafeJString(row, "DiyTableId"),
                            DiyTableName = SafeJString(row, "DiyTableName"),
                            Url = SafeJString(row, "Url"),
                            ComponentName = SafeJString(row, "ComponentName"),
                            ComponentPath = SafeJString(row, "ComponentPath"),
                            OpenType = SafeJString(row, "OpenType"),
                            Display = SafeJInt(row, "Display", 0),
                            AppDisplay = SafeJInt(row, "AppDisplay", 0),
                            Sort = SafeJInt(row, "Sort", 0),
                            Icon = SafeJString(row, "Icon"),
                            UpdateTime = SafeJString(row, "UpdateTime")
                        });
                    }
                    if (modules.Count >= normalizedPageSize) warnings.Add($"菜单数量达到 PageSize={normalizedPageSize} 上限，建议提高 PageSize 或按 Keyword 分批获取。");
                }
                else if (moduleResult.Code != 1)
                {
                    warnings.Add("菜单路由读取失败：" + moduleResult.Msg);
                }

                return new DosResult<object>(1, new
                {
                    OsClient = osClient,
                    ApiBaseUrl = apiBaseUrl ?? "",
                    Keyword = keyword ?? "",
                    Engines = engines,
                    Modules = modules,
                    RecommendedEnv = new
                    {
                        PW_API_BASE = apiBaseUrl ?? "",
                        PW_OS_CLIENT = osClient,
                        PW_BASE_URL = "http://127.0.0.1:5180",
                        PW_HOME_PATH = "/",
                        PW_CONTEXT_PAGE_SIZE = normalizedPageSize.ToString()
                    },
                    Summary = new
                    {
                        EngineCount = engines.Count,
                        PublicEngineCount = publicEngineCount,
                        ProtectedEngineCount = protectedEngineCount,
                        ModuleCount = modules.Count,
                        PageSize = normalizedPageSize
                    },
                    Warnings = warnings
                }, "获取 Playwright 测试上下文成功");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取 Playwright 测试上下文失败：" + ex.Message);
            }
        }

        #endregion

        #region CreateTable

        /// <summary>
        /// 新增自定义表（diy_table）
        /// </summary>
        public static async Task<DosResult<object>> CreateTable(string osClient, string name, string description,
            string tabs = null, int isTree = 0, int column = 1, string formOpenType = null, string formOpenWidth = null)
        {
            try
            {
                // 检查表名是否已存在（幂等：已存在则直接返回该表）
                var existResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "Name", "=", name },
                        
                    }
                });
                if (existResult.Code == 1 && existResult.Data != null)
                {
                    return new DosResult<object>(1, new
                    {
                        Message = $"表 [{name}] 已存在，跳过创建（幂等）",
                        TableId = (string)existResult.Data.Id,
                        Name = name,
                        Skipped = true
                    });
                }

                var id = Ulid.NewUlid().ToString();
                var tableData = new JObject
                {
                    ["OsClient"] = osClient,
                    ["Id"] = id,
                    ["Name"] = name,
                    ["Description"] = description ?? "",
                    ["IsDeleted"] = 0,
                    ["_InvokeType"] = "Client"
                };
                if (!string.IsNullOrWhiteSpace(tabs)) tableData["Tabs"] = tabs;
                if (isTree > 0) tableData["IsTree"] = isTree;
                if (column > 1) tableData["Column"] = column;
                if (!string.IsNullOrWhiteSpace(formOpenType)) tableData["FormOpenType"] = formOpenType;
                if (!string.IsNullOrWhiteSpace(formOpenWidth)) tableData["FormOpenWidth"] = formOpenWidth;

                var addResult = await MicroiEngine.FormEngine.AddFormDataAsync("diy_table", tableData);

                if (addResult.Code == 1)
                {
                    return new DosResult<object>(1, new
                    {
                        Message = $"自定义表 [{name}] 创建成功",
                        TableId = id,
                        Name = name
                    });
                }

                return new DosResult<object>(addResult.Code, addResult.Data, addResult.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "创建自定义表失败：" + ex.Message);
            }
        }

        #endregion

        #region AddField

        /// <summary>
        /// 常用编程类型→平台允许的列类型映射（兼容 AI 传入的非平台类型）
        /// 平台仅允许：varchar(N)、mediumtext/longtext、int/bigint、decimal(18,N)
        /// 禁止使用 datetime / date / timestamp / float / double / boolean —— 一律映射为 varchar(25) 或 int / decimal
        /// </summary>
        private static readonly Dictionary<string, string> FieldTypeMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["string"] = "varchar(500)",
            ["text"] = "varchar(500)",
            ["number"] = "int",
            ["integer"] = "int",
            ["float"] = "decimal(18,2)",
            ["double"] = "decimal(18,2)",
            ["boolean"] = "int",
            ["bool"] = "int",
            // 平台禁止使用 datetime/date/timestamp 物理列，统一存为 varchar(25)（'yyyy-MM-dd HH:mm:ss'）
            ["date"] = "varchar(25)",
            ["datetime"] = "varchar(25)",
            ["timestamp"] = "varchar(25)",
            ["time"] = "varchar(25)",
            ["long"] = "bigint",
            ["json"] = "mediumtext",
        };

        /// <summary>
        /// 将编程语言类型自动映射为平台允许的列类型；并强制拦截禁止使用的 datetime/date/timestamp
        /// </summary>
        private static string NormalizeFieldType(string type)
        {
            if (string.IsNullOrWhiteSpace(type)) return "varchar(500)";
            var trimmed = type.Trim();
            // 优先字典映射
            if (FieldTypeMap.TryGetValue(trimmed, out var mapped)) return mapped;
            // 兜底：以 datetime / date / timestamp / time 开头（含 datetime(6) 等变体）一律改为 varchar(25)
            var lower = trimmed.ToLowerInvariant();
            if (lower.StartsWith("datetime") || lower.StartsWith("timestamp")
                || lower == "date" || lower == "time")
            {
                return "varchar(25)";
            }
            // 兜底：float/double/real/money 一律映射为 decimal(18,2)
            if (lower.StartsWith("float") || lower.StartsWith("double") || lower.StartsWith("real") || lower == "money")
            {
                return "decimal(18,2)";
            }
            return trimmed;
        }

        /// <summary>
        /// 是否为下拉/单选/多选/复选框类组件（需要数据源 Data + Config 配置的组件）
        /// </summary>
        private static bool IsOptionComponent(string component)
        {
            if (string.IsNullOrWhiteSpace(component)) return false;
            var c = component.Trim();
            return c.Equals("Select", StringComparison.OrdinalIgnoreCase)
                || c.Equals("MultipleSelect", StringComparison.OrdinalIgnoreCase)
                || c.Equals("Radio", StringComparison.OrdinalIgnoreCase)
                || c.Equals("Checkbox", StringComparison.OrdinalIgnoreCase);
        }

        private static int? GetDefaultFormWidth(string component)
        {
            if (string.IsNullOrWhiteSpace(component)) return null;
            var fullWidthComponents = new[] {
                "Textarea", "CodeEditor", "RichText", "ImgUpload", "FileUpload",
                "Divider", "CollapseGroup", "Tabs", "Alert", "StaticText", "Html",
                "Map", "MapArea", "DataTable", "TableChild", "Address", "Transfer", "DevComponent"
            };
            return fullWidthComponents.Any(item => item.Equals(component.Trim(), StringComparison.OrdinalIgnoreCase)) ? (int?)24 : null;
        }

        /// <summary>
        /// 将 AI 传入的简洁 data 字符串解析为前端约定的 Data + Config JSON
        /// 支持格式：
        ///   "1|启用,0|禁用"          → KeyValue 数据源
        ///   "启用,禁用"               → Data 普通数据源
        ///   "[\"启用\",\"禁用\"]"     → 已是 JSON 数组（Data 数据源），原样返回
        ///   "[{\"Key\":\"1\",...}]" → 已是 KeyValue JSON 数组（KeyValue 数据源），原样返回
        /// 仅在 component ∈ {Select,MultipleSelect,Radio,Checkbox} 且 config 为空时调用
        /// </summary>
        private static (string DataJson, string ConfigJson) BuildOptionDataAndConfig(string component, string data, string existingConfig)
        {
            // 已显式传入 Config 则不动；Config 必须是合法 JSON 对象
            var hasExistingConfig = !string.IsNullOrWhiteSpace(existingConfig)
                                    && existingConfig.TrimStart().StartsWith("{");
            if (string.IsNullOrWhiteSpace(data))
            {
                // 没传 data，但仍需要给一个最小可用 Config，否则前端 field.Config.* 全部 undefined
                if (hasExistingConfig) return (data ?? "", existingConfig);
                var emptyCfg = new JObject
                {
                    ["DataSource"] = "Data",
                    ["SelectSaveFormat"] = "Text",
                    ["EnableSearch"] = false,
                    ["DataSourceSqlRemote"] = false,
                };
                return ("[]", emptyCfg.ToString(Newtonsoft.Json.Formatting.None));
            }

            var trimmedData = data.Trim();

            // 已是 JSON 数组：原样使用，仅补默认 Config
            if (trimmedData.StartsWith("["))
            {
                if (hasExistingConfig) return (trimmedData, existingConfig);
                // 探测是 KeyValue 还是 Data
                var isKv = trimmedData.IndexOf("\"Key\"", StringComparison.OrdinalIgnoreCase) >= 0
                           && trimmedData.IndexOf("\"Value\"", StringComparison.OrdinalIgnoreCase) >= 0;
                var cfg = new JObject
                {
                    ["DataSource"] = isKv ? "KeyValue" : "Data",
                    ["SelectSaveFormat"] = "Text",
                    ["EnableSearch"] = false,
                    ["DataSourceSqlRemote"] = false,
                };
                if (isKv)
                {
                    cfg["SelectLabel"] = "Value";
                    cfg["SelectSaveField"] = "Key";
                }
                return (trimmedData, cfg.ToString(Newtonsoft.Json.Formatting.None));
            }

            // 解析 "k1|v1,k2|v2" 或 "v1,v2"
            var items = trimmedData.Split(new[] { ',', '，', '\n', ';', '；' }, StringSplitOptions.RemoveEmptyEntries)
                                   .Select(s => s.Trim())
                                   .Where(s => s.Length > 0)
                                   .ToList();
            var hasPipe = items.Any(s => s.Contains('|'));

            if (hasPipe)
            {
                // KeyValue 数据源：[{Key,Value},...]
                var arr = new JArray();
                foreach (var s in items)
                {
                    var parts = s.Split(new[] { '|' }, 2);
                    var key = parts[0].Trim();
                    var val = parts.Length > 1 ? parts[1].Trim() : key;
                    arr.Add(new JObject { ["Key"] = key, ["Value"] = val });
                }
                if (hasExistingConfig) return (arr.ToString(Newtonsoft.Json.Formatting.None), existingConfig);
                var cfg = new JObject
                {
                    ["DataSource"] = "KeyValue",
                    ["SelectLabel"] = "Value",
                    ["SelectSaveField"] = "Key",
                    ["SelectSaveFormat"] = "Text",
                    ["EnableSearch"] = false,
                    ["DataSourceSqlRemote"] = false,
                };
                return (arr.ToString(Newtonsoft.Json.Formatting.None), cfg.ToString(Newtonsoft.Json.Formatting.None));
            }
            else
            {
                // Data 数据源：["v1","v2"]
                var arr = new JArray();
                foreach (var s in items) arr.Add(s);
                if (hasExistingConfig) return (arr.ToString(Newtonsoft.Json.Formatting.None), existingConfig);
                var cfg = new JObject
                {
                    ["DataSource"] = "Data",
                    ["SelectSaveFormat"] = "Text",
                    ["EnableSearch"] = false,
                    ["DataSourceSqlRemote"] = false,
                };
                return (arr.ToString(Newtonsoft.Json.Formatting.None), cfg.ToString(Newtonsoft.Json.Formatting.None));
            }
        }

        /// <summary>
        /// 为自定义表添加字段
        /// </summary>
        public static async Task<DosResult<object>> AddField(
            string osClient, string tableId, string name, string label,
            string type, string component, int visible, int appVisible,
            string tab, int tableWidth, int sort, int nameConfirm, int readonlyVal,
            int notEmpty = 0, int unique = 0, string defaultValue = null, string placeholder = null,
            int? formWidth = null, string data = null, string config = null, string description = null,
            int encrypt = 0, int inTableEdit = 0)
        {
            try
            {
                var componentName = component ?? "Text";

                // 幂等：先检查同 TableId + Name 的字段是否已存在，存在则视为成功（避免 AI 并发/重试报错）
                if (!string.IsNullOrWhiteSpace(name) && !string.IsNullOrWhiteSpace(tableId))
                {
                    var existResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_field", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>()
                        {
                            new List<object>() { "TableId", "=", tableId },
                            new List<object>() { "AND", "Name", "=", name },
                            new List<object>() { "AND", "IsDeleted", "<>", 1 },
                        }
                    });
                    if (existResult.Code == 1 && existResult.Data != null)
                    {
                        return new DosResult<object>(1, new
                        {
                            Message = $"字段 [{label}({name})] 已存在，跳过创建（幂等）",
                            FieldId = (string)existResult.Data.Id,
                            TableId = tableId,
                            Skipped = true
                        });
                    }
                }

                // 选项类组件（Select/MultipleSelect/Radio/Checkbox）：自动构建 Data + Config JSON
                var effectiveData = data ?? "";
                var effectiveConfig = config ?? "";
                if (IsOptionComponent(componentName))
                {
                    var (dataJson, configJson) = BuildOptionDataAndConfig(componentName, data, config);
                    effectiveData = dataJson;
                    effectiveConfig = configJson;
                }

                if (!string.IsNullOrWhiteSpace(effectiveConfig))
                {
                    var configCheck = ValidateJsonIfPresent("Config", effectiveConfig);
                    if (!configCheck.Ok) return new DosResult<object>(0, null, configCheck.Msg);
                }

                var fieldParam = new DiyFieldParam
                {
                    OsClient = osClient,
                    Id = Ulid.NewUlid().ToString(),
                    TableId = tableId,
                    Name = name,
                    Label = label,
                    Type = NormalizeFieldType(type),
                    Component = componentName,
                    Visible = visible,
                    AppVisible = appVisible,
                    Tab = tab ?? "",
                    TableWidth = tableWidth > 0 ? tableWidth : 120,
                    Sort = sort > 0 ? sort : 100,
                    NameConfirm = nameConfirm,
                    Readonly = readonlyVal,
                    NotEmpty = notEmpty,
                    Unique = unique,
                    DefaultValue = defaultValue ?? "",
                    Placeholder = placeholder ?? "",
                    FormWidth = formWidth.HasValue && formWidth.Value > 0 ? formWidth.Value : GetDefaultFormWidth(componentName),
                    Data = effectiveData,
                    Config = effectiveConfig,
                    Description = description ?? "",
                    Encrypt = encrypt,
                    InTableEdit = inTableEdit,
                    IsDeleted = 0,
                    _InvokeType = InvokeType.Client.ToString()
                };

                var result = await MicroiEngine.FormEngine.AddDiyField(fieldParam);

                if (result.Code == 1)
                {
                    return new DosResult<object>(1, new
                    {
                        Message = $"字段 [{label}({name})] 添加成功",
                        FieldId = fieldParam.Id,
                        TableId = tableId
                    });
                }

                // 兜底：底层若仍报"已存在的字段"（极小概率并发竞态），转为幂等成功
                if (result.Code != 1 && !string.IsNullOrEmpty(result.Msg) && result.Msg.Contains("已存在的字段"))
                {
                    return new DosResult<object>(1, new
                    {
                        Message = $"字段 [{label}({name})] 已存在，跳过创建（并发竞态保护）",
                        TableId = tableId,
                        Skipped = true
                    });
                }

                return new DosResult<object>(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "添加字段失败：" + ex.Message);
            }
        }

        #endregion

        #region CreateModule

        /// <summary>
        /// MCP menu auto-configuration helpers for sys_menu list/search/mobile defaults.
        /// </summary>
        private sealed class McpMenuFieldMeta
        {
            public string Id { get; set; } = "";
            public string Name { get; set; } = "";
            public string Label { get; set; } = "";
            public string TableId { get; set; } = "";
            public string TableName { get; set; } = "";
            public string TableDescription { get; set; } = "";
            public string Component { get; set; } = "";
            public string Type { get; set; } = "";
            public int Sort { get; set; }
            public bool IsSystem { get; set; }
        }

        private sealed class McpMenuDefaults
        {
            public string SearchFieldIds { get; set; } = "";
            public string TableDiyFieldIds { get; set; } = "";
            public string SelectFields { get; set; } = "";
            public string SortFieldIds { get; set; } = "";
            public string NotShowFields { get; set; } = "";
            public string StatisticsFields { get; set; } = "";
            public string MobileListFields { get; set; } = "";
            public string CardTitleTagFields { get; set; } = "";
            public string CardBottomTagFields { get; set; } = "";
            public string DefaultOrderBy { get; set; } = "";
            public List<string> Warnings { get; } = new List<string>();
        }

        private static readonly HashSet<string> McpTechnicalFieldNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Id", "CreateTime", "UpdateTime", "CreateUser", "UserId", "UserName", "OsClient", "IsDeleted", "ParentId", "ParentIds"
        };

        private static readonly HashSet<string> McpLayoutComponents = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Divider", "CollapseGroup", "Tabs", "Alert", "StaticText", "Html", "Button"
        };

        private static readonly HashSet<string> McpHeavyListComponents = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Textarea", "RichText", "CodeEditor", "JsonTable", "ImgUpload", "FileUpload", "TableChild", "Map", "MapArea", "Html", "DevComponent"
        };

        private static readonly HashSet<string> McpExactSearchComponents = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Select", "MultipleSelect", "Radio", "Checkbox", "Switch", "Department", "SelectTree", "TreeCheckbox", "Cascader", "Address"
        };

        private static string McpFieldText(McpMenuFieldMeta field)
        {
            return $"{field.Name} {field.Label} {field.Component} {field.Type}".ToLowerInvariant();
        }

        private static bool McpHasKeyword(McpMenuFieldMeta field, params string[] keywords)
        {
            var text = McpFieldText(field);
            return keywords.Any(keyword => text.IndexOf(keyword.ToLowerInvariant(), StringComparison.OrdinalIgnoreCase) >= 0);
        }

        private static bool McpIsLayoutField(McpMenuFieldMeta field)
        {
            return McpLayoutComponents.Contains(field.Component ?? "");
        }

        private static bool McpIsHeavyListField(McpMenuFieldMeta field)
        {
            return McpHeavyListComponents.Contains(field.Component ?? "");
        }

        private static bool McpIsIdLikeField(McpMenuFieldMeta field)
        {
            if (field == null) return false;
            var name = field.Name ?? "";
            if (McpTechnicalFieldNames.Contains(name)) return true;
            if (name.Equals("Id", StringComparison.OrdinalIgnoreCase)) return true;
            if (name.EndsWith("Id", StringComparison.OrdinalIgnoreCase)) return true;
            if (name.EndsWith("Ids", StringComparison.OrdinalIgnoreCase)) return true;
            return McpHasKeyword(field, "外键", "编号id", "关联id", "租户", "tenant", "osclient");
        }

        private static bool McpShouldHideInMenu(McpMenuFieldMeta field)
        {
            if (field == null || field.IsSystem) return false;
            return McpIsIdLikeField(field) || McpIsLayoutField(field) || McpIsHeavyListField(field);
        }

        private static bool McpIsDateField(McpMenuFieldMeta field)
        {
            return string.Equals(field.Component, "DateTime", StringComparison.OrdinalIgnoreCase)
                || McpHasKeyword(field, "date", "time", "日期", "时间");
        }

        private static bool McpIsNumericField(McpMenuFieldMeta field)
        {
            var type = (field.Type ?? "").ToLowerInvariant();
            return type.Contains("int") || type.Contains("decimal") || type.Contains("bigint");
        }

        private static int McpSearchScore(McpMenuFieldMeta field)
        {
            var score = 0;
            if (McpHasKeyword(field, "name", "title", "subject", "名称", "姓名", "标题", "主题")) score += 100;
            if (McpHasKeyword(field, "no", "code", "sn", "number", "编号", "单号", "编码", "账号")) score += 90;
            if (McpHasKeyword(field, "status", "state", "type", "category", "level", "状态", "类型", "分类", "等级")) score += 80;
            if (McpHasKeyword(field, "user", "owner", "person", "manager", "dept", "客户", "负责人", "人员", "部门", "商家", "供应商")) score += 70;
            if (McpIsDateField(field)) score += 55;
            if (McpExactSearchComponents.Contains(field.Component ?? "")) score += 30;
            return score;
        }

        private static int McpListScore(McpMenuFieldMeta field)
        {
            var score = 0;
            if (McpHasKeyword(field, "name", "title", "subject", "名称", "标题", "主题")) score += 100;
            if (McpHasKeyword(field, "no", "code", "sn", "number", "编号", "单号", "编码")) score += 90;
            if (McpHasKeyword(field, "status", "state", "type", "category", "level", "状态", "类型", "分类", "等级")) score += 80;
            if (McpHasKeyword(field, "amount", "money", "price", "total", "count", "qty", "积分", "余额", "金额", "价格", "数量")) score += 65;
            if (McpHasKeyword(field, "user", "owner", "person", "manager", "dept", "客户", "负责人", "人员", "部门", "商家")) score += 60;
            if (McpIsDateField(field)) score += 45;
            if (!McpIsHeavyListField(field) && !McpIsLayoutField(field)) score += 10;
            return score;
        }

        private static JObject McpToMenuFieldObject(McpMenuFieldMeta field, bool forSearch = false)
        {
            var obj = new JObject
            {
                ["Id"] = field.Id.DosIsNullOrWhiteSpace() ? field.Name : field.Id,
                ["AsName"] = "",
                ["Name"] = field.Name,
                ["Label"] = field.Label.DosIsNullOrWhiteSpace() ? field.Name : field.Label,
                ["TableId"] = field.TableId,
                ["TableName"] = field.TableName,
                ["TableDescription"] = field.TableDescription,
                ["IsVisible"] = true
            };

            if (forSearch)
            {
                var exact = McpExactSearchComponents.Contains(field.Component ?? "");
                obj["DisplayType"] = exact ? "In" : "Out";
                obj["DisplaySelect"] = exact;
                if (exact) obj["Equal"] = true;
            }

            return obj;
        }

        private static string McpJson(JArray array)
        {
            return array != null && array.Count > 0 ? array.ToString(Newtonsoft.Json.Formatting.None) : "";
        }

        private static async Task<McpMenuDefaults> BuildDefaultModuleMenuConfig(string osClient, string diyTableId, string diyTableName)
        {
            var defaults = new McpMenuDefaults();
            if (diyTableId.DosIsNullOrWhiteSpace()) return defaults;

            var fields = new List<McpMenuFieldMeta>();
            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_field", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "TableId", "Name", "Label", "Component", "Type", "Sort" },
                    _Where = new List<object>()
                    {
                        new List<object>() { "TableId", "=", diyTableId },
                        new List<object>() { "AND", "IsDeleted", "<>", 1 },
                    },
                    _OrderBy = "Sort",
                    _OrderByType = "ASC",
                    _PageIndex = 1,
                    _PageSize = 5000
                });

                if (result.Code == 1 && result.Data != null)
                {
                    foreach (var item in result.Data)
                    {
                        var row = JObject.FromObject(item);
                        var name = SafeJString(row, "Name");
                        if (name.DosIsNullOrWhiteSpace()) continue;
                        fields.Add(new McpMenuFieldMeta
                        {
                            Id = SafeJString(row, "Id"),
                            Name = name,
                            Label = SafeJString(row, "Label", name),
                            TableId = SafeJString(row, "TableId", diyTableId),
                            TableName = diyTableName ?? "",
                            TableDescription = diyTableName ?? "",
                            Component = SafeJString(row, "Component"),
                            Type = SafeJString(row, "Type"),
                            Sort = SafeJInt(row, "Sort", 100)
                        });
                    }
                }
                else if (result.Code != 1)
                {
                    defaults.Warnings.Add("Auto sys_menu fields skipped: failed to read diy_field. " + SafeString(result.Msg));
                    return defaults;
                }
            }
            catch (Exception ex)
            {
                defaults.Warnings.Add("Auto sys_menu fields skipped: " + ex.Message);
                return defaults;
            }

            if (!fields.Any()) return defaults;

            var systemFields = new[]
            {
                new McpMenuFieldMeta { Id = "CreateTime", Name = "CreateTime", Label = "创建时间", TableId = diyTableId, TableName = diyTableName ?? "", TableDescription = diyTableName ?? "", Component = "DateTime", Type = "varchar(25)", IsSystem = true },
                new McpMenuFieldMeta { Id = "UpdateTime", Name = "UpdateTime", Label = "更新时间", TableId = diyTableId, TableName = diyTableName ?? "", TableDescription = diyTableName ?? "", Component = "DateTime", Type = "varchar(25)", IsSystem = true },
                new McpMenuFieldMeta { Id = "UserName", Name = "UserName", Label = "创建人", TableId = diyTableId, TableName = diyTableName ?? "", TableDescription = diyTableName ?? "", Component = "Text", Type = "varchar(200)", IsSystem = true }
            };

            var visibleFields = fields.Where(f => !McpShouldHideInMenu(f)).ToList();
            var rankedVisible = visibleFields
                .OrderByDescending(McpListScore)
                .ThenBy(f => f.Sort)
                .ThenBy(f => f.Name)
                .ToList();

            var listFields = rankedVisible.Take(12).ToList();
            if (!listFields.Any()) listFields = fields.Where(f => !McpIsLayoutField(f)).Take(8).ToList();

            var searchCandidates = visibleFields.Concat(systemFields)
                .Where(f => !McpIsHeavyListField(f) && !McpIsLayoutField(f))
                .Select(f => new { Field = f, Score = McpSearchScore(f) })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.Field.Sort)
                .Take(8)
                .Select(x => x.Field)
                .ToList();
            if (!searchCandidates.Any()) searchCandidates = listFields.Take(4).ToList();

            var sortFields = fields.Where(f => !McpShouldHideInMenu(f) && (McpIsDateField(f) || McpIsNumericField(f) || f.Name.Equals("Sort", StringComparison.OrdinalIgnoreCase)))
                .OrderByDescending(f => McpIsDateField(f) ? 2 : 1)
                .ThenBy(f => f.Sort)
                .Take(8)
                .ToList();

            var statisticsFields = fields.Where(f => !McpShouldHideInMenu(f) && McpIsNumericField(f)
                    && McpHasKeyword(f, "amount", "money", "price", "total", "count", "qty", "score", "point", "积分", "余额", "金额", "价格", "数量", "人数", "总计"))
                .OrderByDescending(McpListScore)
                .ThenBy(f => f.Sort)
                .Take(6)
                .ToList();

            var mobileFields = rankedVisible.Take(4).ToList();
            var cardTitleFields = rankedVisible.Where(f => McpHasKeyword(f, "status", "state", "type", "category", "level", "状态", "类型", "分类", "等级")).Take(2).ToList();
            var cardBottomFields = rankedVisible.Where(f => McpIsDateField(f) || McpIsNumericField(f)
                    || McpHasKeyword(f, "amount", "money", "price", "count", "qty", "积分", "余额", "金额", "价格", "数量"))
                .Take(3)
                .ToList();

            var defaultOrder = fields.FirstOrDefault(f => f.Name.Equals("CreateTime", StringComparison.OrdinalIgnoreCase))
                ?? systemFields.FirstOrDefault(f => f.Name == "CreateTime");

            defaults.TableDiyFieldIds = McpJson(new JArray(listFields.Select(f => f.Id)));
            defaults.SelectFields = McpJson(new JArray(listFields.Select(f => McpToMenuFieldObject(f))));
            defaults.SearchFieldIds = McpJson(new JArray(searchCandidates.Select(f => McpToMenuFieldObject(f, true))));
            defaults.SortFieldIds = McpJson(new JArray(sortFields.Select(f => f.Id)));
            defaults.NotShowFields = McpJson(new JArray(fields.Where(McpShouldHideInMenu).Select(f => f.Id)));
            defaults.StatisticsFields = McpJson(new JArray(statisticsFields.Select(f => new JObject { ["Id"] = f.Id, ["Type"] = "Sum" })));
            defaults.MobileListFields = McpJson(new JArray(mobileFields.Select(f => McpToMenuFieldObject(f))));
            defaults.CardTitleTagFields = McpJson(new JArray(cardTitleFields.Select(f => McpToMenuFieldObject(f))));
            defaults.CardBottomTagFields = McpJson(new JArray(cardBottomFields.Select(f => McpToMenuFieldObject(f))));
            if (defaultOrder != null)
            {
                defaults.DefaultOrderBy = new JArray
                {
                    new JObject
                    {
                        ["Id"] = defaultOrder.Id.DosIsNullOrWhiteSpace() ? defaultOrder.Name : defaultOrder.Id,
                        ["Name"] = defaultOrder.Name,
                        ["Type"] = "DESC",
                        ["Sort"] = 0
                    }
                }.ToString(Newtonsoft.Json.Formatting.None);
            }

            return defaults;
        }

        /// <summary>
        /// 新增功能模块（sys_menu）
        /// </summary>
        public static async Task<DosResult<object>> CreateModule(
            string osClient, string name, string diyTableId,
            string componentName, string componentPath,
            int display, int appDisplay, string openType, string url,
            string parentId = null, int sort = 100,
            string icon = null, string searchFieldIds = null,
            string tableDiyFieldIds = null, string defaultOrderBy = null,
            string sqlWhere = null, string diyConfig = null,
            string moreBtns = null, string formBtns = null,
            string batchSelectMoreBtns = null, string pageTabs = null,
            string exportMoreBtns = null, string pageBtns = null,
            string sortFieldIds = null, string notShowFields = null,
            string sqlJoin = null, string joinTables = null,
            string selectFields = null, string statisticsFields = null,
            int inTableEdit = 0, string inTableEditFields = null,
            string mobileListFields = null,
            string cardTitleTagFields = null, string cardBottomTagFields = null)
        {
            try
            {
                // 检查模块名是否已存在（同 ParentId 下 Name 唯一即视为重复，幂等返回该模块）
                var existWhere = new List<object>()
                {
                    new List<object>() { "Name", "=", name },
                };
                if (!string.IsNullOrWhiteSpace(parentId))
                {
                    existWhere.Add(new List<object>() { "AND", "ParentId", "=", parentId });
                }
                var existResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_menu", new
                {
                    OsClient = osClient,
                    _Where = existWhere
                });
                if (existResult.Code == 1 && existResult.Data != null)
                {
                    return new DosResult<object>(1, new
                    {
                        Message = $"模块 [{name}] 已存在，跳过创建（幂等）",
                        ModuleId = (string)existResult.Data.Id,
                        DiyTableId = (string)existResult.Data.DiyTableId,
                        Url = (string)existResult.Data.Url,
                        Skipped = true
                    });
                }

                // 根据 DiyTableId 查询 DiyTableName
                var diyTableName = "";
                if (!string.IsNullOrWhiteSpace(diyTableId))
                {
                    var tableResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
                    {
                        OsClient = osClient,
                        Id = diyTableId,
                        _SelectFields = new[] { "Name" }
                    });
                    if (tableResult.Code == 1 && tableResult.Data != null)
                    {
                        diyTableName = (string)tableResult.Data.Name ?? "";
                    }
                }

                var id = Ulid.NewUlid().ToString();

                // 当 OpenType 为 Diy 且未指定 Url 时，自动从表名生成路由路径
                // 例如：Crm_Customer → /crm-customer, diy_lang → /diy-lang, Order_Main → /order-main
                var effectiveUrl = url;
                if (string.IsNullOrWhiteSpace(effectiveUrl) && (string.IsNullOrWhiteSpace(openType) || openType == "Diy"))
                {
                    if (!string.IsNullOrWhiteSpace(diyTableName))
                    {
                        // 将表名转换为 URL 路径：PascalCase → kebab-case，下划线 → 连字符
                        var urlPath = System.Text.RegularExpressions.Regex.Replace(diyTableName, "([a-z])([A-Z])", "$1-$2");
                        urlPath = urlPath.Replace("_", "-").ToLower();
                        effectiveUrl = "/" + urlPath;
                    }
                    else
                    {
                        // 没有绑定表时，使用 Ulid 的随机部分（chars 10..25 是随机段，前 10 字符是毫秒时间戳，
                        // 并发调用时时间戳段会冲突，所以必须用随机段）
                        effectiveUrl = "/menu-" + GetUlidRandomSuffix(id, 8);
                    }
                }

                // 检查 URL 是否已被其他菜单占用，如果是则追加随机后缀（最多重试 5 次以避免极端并发竞态）
                if (!string.IsNullOrWhiteSpace(effectiveUrl))
                {
                    var baseUrl = effectiveUrl;
                    var attempt = 0;
                    while (attempt < 5)
                    {
                        var urlExistResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_menu", new
                        {
                            OsClient = osClient,
                            _Where = new List<object>()
                            {
                                new List<object>() { "Url", "=", effectiveUrl },
                            }
                        });
                        if (!(urlExistResult.Code == 1 && urlExistResult.Data != null))
                        {
                            break; // URL 可用
                        }
                        // 冲突：使用 Ulid 随机段 + 额外 Random 字节增加唯一性
                        attempt++;
                        var extra = GetUlidRandomSuffix(Ulid.NewUlid().ToString(), 6)
                                  + ThreadRandom.Next(100, 999).ToString();
                        effectiveUrl = baseUrl + "-" + extra;
                    }
                }

                var buttonWarnings = new List<string>();
                var moreBtnsNormalized = NormalizeMenuJsonArray("MoreBtns", moreBtns, buttonWarnings);
                if (!moreBtnsNormalized.Ok) return new DosResult<object>(0, null, moreBtnsNormalized.Msg);
                var formBtnsNormalized = NormalizeMenuJsonArray("FormBtns", formBtns, buttonWarnings);
                if (!formBtnsNormalized.Ok) return new DosResult<object>(0, null, formBtnsNormalized.Msg);
                var batchBtnsNormalized = NormalizeMenuJsonArray("BatchSelectMoreBtns", batchSelectMoreBtns, buttonWarnings);
                if (!batchBtnsNormalized.Ok) return new DosResult<object>(0, null, batchBtnsNormalized.Msg);
                var pageTabsNormalized = NormalizeMenuJsonArray("PageTabs", pageTabs, buttonWarnings);
                if (!pageTabsNormalized.Ok) return new DosResult<object>(0, null, pageTabsNormalized.Msg);
                var exportBtnsNormalized = NormalizeMenuJsonArray("ExportMoreBtns", exportMoreBtns, buttonWarnings);
                if (!exportBtnsNormalized.Ok) return new DosResult<object>(0, null, exportBtnsNormalized.Msg);
                var pageBtnsNormalized = NormalizeMenuJsonArray("PageBtns", pageBtns, buttonWarnings);
                if (!pageBtnsNormalized.Ok) return new DosResult<object>(0, null, pageBtnsNormalized.Msg);

                if (!diyTableId.DosIsNullOrWhiteSpace())
                {
                    var menuDefaults = await BuildDefaultModuleMenuConfig(osClient, diyTableId, diyTableName);
                    if (searchFieldIds.DosIsNullOrWhiteSpace()) searchFieldIds = menuDefaults.SearchFieldIds;
                    if (tableDiyFieldIds.DosIsNullOrWhiteSpace()) tableDiyFieldIds = menuDefaults.TableDiyFieldIds;
                    if (selectFields.DosIsNullOrWhiteSpace()) selectFields = menuDefaults.SelectFields;
                    if (sortFieldIds.DosIsNullOrWhiteSpace()) sortFieldIds = menuDefaults.SortFieldIds;
                    if (notShowFields.DosIsNullOrWhiteSpace()) notShowFields = menuDefaults.NotShowFields;
                    if (statisticsFields.DosIsNullOrWhiteSpace()) statisticsFields = menuDefaults.StatisticsFields;
                    if (mobileListFields.DosIsNullOrWhiteSpace()) mobileListFields = menuDefaults.MobileListFields;
                    if (cardTitleTagFields.DosIsNullOrWhiteSpace()) cardTitleTagFields = menuDefaults.CardTitleTagFields;
                    if (cardBottomTagFields.DosIsNullOrWhiteSpace()) cardBottomTagFields = menuDefaults.CardBottomTagFields;
                    if (defaultOrderBy.DosIsNullOrWhiteSpace()) defaultOrderBy = menuDefaults.DefaultOrderBy;
                    if (menuDefaults.Warnings.Any()) buttonWarnings.AddRange(menuDefaults.Warnings);
                }

                var menuData = new JObject
                {
                    ["OsClient"] = osClient,
                    ["Id"] = id,
                    ["Name"] = name,
                    ["DiyTableId"] = diyTableId ?? "",
                    ["DiyTableName"] = diyTableName,
                    ["ParentId"] = parentId ?? "",
                    ["Sort"] = sort,
                    ["ComponentName"] = componentName ?? "搜索+表格",
                    ["ComponentPath"] = componentPath ?? "/diy/diy-table-rowlist",
                    ["Display"] = display,
                    ["AppDisplay"] = appDisplay,
                    ["OpenType"] = openType ?? "Diy",
                    ["Url"] = effectiveUrl ?? "",
                    ["IsDeleted"] = 0,
                    ["_InvokeType"] = "Client"
                };
                if (!string.IsNullOrWhiteSpace(icon)) menuData["Icon"] = icon;
                if (!string.IsNullOrWhiteSpace(searchFieldIds)) menuData["SearchFieldIds"] = searchFieldIds;
                if (!string.IsNullOrWhiteSpace(tableDiyFieldIds)) menuData["TableDiyFieldIds"] = tableDiyFieldIds;
                if (!string.IsNullOrWhiteSpace(defaultOrderBy)) menuData["DefaultOrderBy"] = defaultOrderBy;
                if (!string.IsNullOrWhiteSpace(sqlWhere)) menuData["SqlWhere"] = sqlWhere;
                if (!string.IsNullOrWhiteSpace(diyConfig)) menuData["DiyConfig"] = diyConfig;
                // 业务按钮 / 高级配置（统一存为 sys_menu 的 JSON 字符串列）
                if (!string.IsNullOrWhiteSpace(moreBtnsNormalized.Value)) menuData["MoreBtns"] = moreBtnsNormalized.Value;
                if (!string.IsNullOrWhiteSpace(formBtnsNormalized.Value)) menuData["FormBtns"] = formBtnsNormalized.Value;
                if (!string.IsNullOrWhiteSpace(batchBtnsNormalized.Value)) menuData["BatchSelectMoreBtns"] = batchBtnsNormalized.Value;
                if (!string.IsNullOrWhiteSpace(pageTabsNormalized.Value)) menuData["PageTabs"] = pageTabsNormalized.Value;
                if (!string.IsNullOrWhiteSpace(exportBtnsNormalized.Value)) menuData["ExportMoreBtns"] = exportBtnsNormalized.Value;
                if (!string.IsNullOrWhiteSpace(pageBtnsNormalized.Value)) menuData["PageBtns"] = pageBtnsNormalized.Value;
                if (!string.IsNullOrWhiteSpace(sortFieldIds)) menuData["SortFieldIds"] = sortFieldIds;
                if (!string.IsNullOrWhiteSpace(notShowFields)) menuData["NotShowFields"] = notShowFields;
                if (!string.IsNullOrWhiteSpace(sqlJoin)) menuData["SqlJoin"] = sqlJoin;
                if (!string.IsNullOrWhiteSpace(joinTables)) menuData["JoinTables"] = joinTables;
                if (!string.IsNullOrWhiteSpace(selectFields)) menuData["SelectFields"] = selectFields;
                if (!string.IsNullOrWhiteSpace(statisticsFields)) menuData["StatisticsFields"] = statisticsFields;
                if (inTableEdit == 1) menuData["InTableEdit"] = 1;
                if (!string.IsNullOrWhiteSpace(inTableEditFields)) menuData["InTableEditFields"] = inTableEditFields;
                if (!string.IsNullOrWhiteSpace(mobileListFields)) menuData["MobileListFields"] = mobileListFields;
                if (!string.IsNullOrWhiteSpace(cardTitleTagFields)) menuData["CardTitleTagFields"] = cardTitleTagFields;
                if (!string.IsNullOrWhiteSpace(cardBottomTagFields)) menuData["CardBottomTagFields"] = cardBottomTagFields;

                // 并发安全：插入时若仍命中"已存在唯一值"（最常见为 Url 列），自动追加随机后缀重试最多 5 次
                DosResult addResult = null;
                var insertAttempt = 0;
                while (insertAttempt < 5)
                {
                    addResult = await MicroiEngine.FormEngine.AddFormDataAsync("sys_menu", menuData);
                    if (addResult.Code == 1) break;
                    var msg = addResult.Msg ?? "";
                    if (msg.Contains("已存在唯一值") && msg.IndexOf("Url", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        insertAttempt++;
                        var extra = GetUlidRandomSuffix(Ulid.NewUlid().ToString(), 6)
                                  + ThreadRandom.Next(100, 999).ToString();
                        effectiveUrl = (effectiveUrl ?? "/menu") + "-" + extra;
                        menuData["Url"] = effectiveUrl;
                        // 主键 Id 也换一下，避免再撞主键
                        menuData["Id"] = Ulid.NewUlid().ToString();
                        id = (string)menuData["Id"];
                        continue;
                    }
                    break;
                }

                if (addResult.Code == 1)
                {
                    return new DosResult<object>(1, new
                    {
                        Message = $"功能模块 [{name}] 创建成功",
                        ModuleId = id,
                        DiyTableId = diyTableId,
                        Url = effectiveUrl,
                        Warnings = buttonWarnings
                    });
                }

                return new DosResult<object>(addResult.Code, addResult.Data, addResult.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "创建功能模块失败：" + ex.Message);
            }
        }

        #endregion

        #region ResolveOsClient

        /// <summary>
        /// 线程安全的 Random（用于生成 URL 唯一后缀）
        /// </summary>
        private static readonly Random _threadRandom = new Random(Guid.NewGuid().GetHashCode());
        private static int ThreadRandomNext(int min, int max)
        {
            lock (_threadRandom) { return _threadRandom.Next(min, max); }
        }
        private static class ThreadRandom
        {
            public static int Next(int min, int max) => ThreadRandomNext(min, max);
        }

        /// <summary>
        /// 取 Ulid 的随机段（chars 10..25 是随机段，前 10 字符是毫秒时间戳）。
        /// 并发调用时时间戳段会冲突，所以生成 URL 等唯一标识时必须用随机段。
        /// </summary>
        private static string GetUlidRandomSuffix(string ulid, int length)
        {
            if (string.IsNullOrWhiteSpace(ulid)) return Guid.NewGuid().ToString("N").Substring(0, length).ToLower();
            // Ulid 总长度 26：前 10 字符为时间戳，后 16 字符为随机段
            if (ulid.Length >= 10 + length)
            {
                return ulid.Substring(10, length).ToLower();
            }
            return ulid.Substring(Math.Max(0, ulid.Length - length)).ToLower();
        }

        /// <summary>
        /// 解析 OsClient（如果为空则从 token 或配置中获取）
        /// </summary>
        public static string ResolveOsClient(string osClient, object currentToken)
        {
            string tokenOsClient;
            try
            {
                dynamic token = currentToken;
                tokenOsClient = token?.OsClient;
            }
            catch
            {
                tokenOsClient = null;
            }

            if (!string.IsNullOrWhiteSpace(tokenOsClient))
            {
                if (!string.IsNullOrWhiteSpace(osClient)
                    && !string.Equals(osClient, tokenOsClient, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException($"OsClient mismatch: request OsClient '{osClient}' does not match token OsClient '{tokenOsClient}'.");
                }
                return tokenOsClient;
            }

            if (string.IsNullOrWhiteSpace(osClient))
            {
                osClient = ConfigHelper.GetAppSettings("OsClient");
            }
            return osClient ?? "";
        }

        #endregion

        #region GetPageEngineList

        /// <summary>
        /// 获取界面引擎列表（mic_page）
        /// </summary>
        public static async Task<DosResult<object>> GetPageEngineList(string osClient, string keyword = null)
        {
            try
            {
                var where = new List<object>()
                {
                    
                };
                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    where.Add(new List<object>() { "AND", "(", "Title", "Like", keyword });
                    where.Add(new List<object>() { "OR", "Number", "Like", keyword });
                    where.Add(new List<object>() { "OR", "Desc", "Like", keyword, ")" });
                }

                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("mic_page", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Title", "Number", "Desc", "RoutePath", "ComponentPath", "CreateTime", "UpdateTime" },
                    _Where = where,
                    _OrderBy = "UpdateTime",
                    _OrderByType = "DESC",
                    _PageSize = 100
                });

                if (result.Code != 1)
                {
                    return new DosResult<object>(result.Code, null, result.Msg);
                }

                return new DosResult<object>(1, result.Data);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取界面引擎列表失败：" + ex.Message);
            }
        }

        #endregion

        #region GetPageEngineDetail

        /// <summary>
        /// 获取界面引擎详情（含 JsonObj）
        /// </summary>
        public static async Task<DosResult<object>> GetPageEngineDetail(string osClient, string pageId)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("mic_page", new
                {
                    OsClient = osClient,
                    Id = pageId
                });

                if (result.Code != 1 || result.Data == null)
                {
                    return new DosResult<object>(result.Code == 1 ? 2 : result.Code, null, result.Code == 1 ? "页面不存在" : result.Msg);
                }

                return new DosResult<object>(1, result.Data);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取界面引擎详情失败：" + ex.Message);
            }
        }

        #endregion

        #region SavePageEngine

        /// <summary>
        /// 保存界面引擎（新增或更新 mic_page）
        /// </summary>
        public static async Task<DosResult<object>> SavePageEngine(string osClient, string pageId, string title, string number, string desc, string jsonStr, string routePath = null, string componentPath = null)
        {
            try
            {
                var normalizedJson = NormalizePageEngineJsonObj(jsonStr);
                if (!normalizedJson.Ok) return new DosResult<object>(0, null, normalizedJson.Msg);
                jsonStr = normalizedJson.Value;

                if (!string.IsNullOrWhiteSpace(pageId))
                {
                    // 更新
                    var uptData = new JObject
                    {
                        ["Id"] = pageId,
                        ["Title"] = title,
                        ["JsonObj"] = jsonStr,
                        ["_InvokeType"] = "Client"
                    };
                    if (!string.IsNullOrWhiteSpace(number)) uptData["Number"] = number;
                    if (!string.IsNullOrWhiteSpace(desc)) uptData["Desc"] = desc;
                    if (!string.IsNullOrWhiteSpace(routePath)) uptData["RoutePath"] = routePath;
                    if (!string.IsNullOrWhiteSpace(componentPath)) uptData["ComponentPath"] = componentPath;

                    var uptResult = await MicroiEngine.FormEngine.UptFormDataAsync("mic_page", uptData);
                    if (uptResult.Code != 1)
                    {
                        return new DosResult<object>(uptResult.Code, null, uptResult.Msg);
                    }

                    return new DosResult<object>(1, new
                    {
                        Message = $"界面引擎 [{title}] 更新成功",
                        PageId = pageId
                    });
                }
                else
                {
                    // 新增
                    var id = Ulid.NewUlid().ToString();
                    var addData = new JObject
                    {
                        ["OsClient"] = osClient,
                        ["Id"] = id,
                        ["Title"] = title,
                        ["JsonObj"] = jsonStr,
                        ["IsDeleted"] = 0,
                        ["_InvokeType"] = "Client"
                    };
                    if (!string.IsNullOrWhiteSpace(number)) addData["Number"] = number;
                    if (!string.IsNullOrWhiteSpace(desc)) addData["Desc"] = desc;
                    if (!string.IsNullOrWhiteSpace(routePath)) addData["RoutePath"] = routePath;
                    if (!string.IsNullOrWhiteSpace(componentPath)) addData["ComponentPath"] = componentPath;

                    var addResult = await MicroiEngine.FormEngine.AddFormDataAsync("mic_page", addData);
                    if (addResult.Code != 1)
                    {
                        return new DosResult<object>(addResult.Code, null, addResult.Msg);
                    }

                    return new DosResult<object>(1, new
                    {
                        Message = $"界面引擎 [{title}] 创建成功",
                        PageId = id
                    });
                }
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "保存界面引擎失败：" + ex.Message);
            }
        }

        #endregion

        #region MCP 高级建模与验收

        private static readonly string[] MenuJsonArrayFields = new[]
        {
            "MoreBtns", "FormBtns", "BatchSelectMoreBtns", "PageTabs", "ExportMoreBtns", "PageBtns"
        };

        private static string TruncateForLog(string value, int maxLength = 4000)
        {
            if (string.IsNullOrEmpty(value)) return "";
            return value.Length <= maxLength ? value : value.Substring(0, maxLength) + "...";
        }

        private static JToken CloneToken(JToken token)
        {
            return token == null ? null : token.DeepClone();
        }

        private static string ToJsonString(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null) return "";
            if (token.Type == JTokenType.String) return token.Val<string>() ?? "";
            return token.ToString(Newtonsoft.Json.Formatting.None);
        }

        private static (bool Ok, string Value, string Msg) NormalizePageEngineJsonObj(string rawValue)
        {
            if (rawValue.DosIsNullOrWhiteSpace()) return (false, "", "JsonObj 不能为空");
            try
            {
                JToken token = JToken.Parse(rawValue);
                if (token.Type == JTokenType.String)
                {
                    token = JToken.Parse(token.Val<string>() ?? "");
                }

                var candidate = UnwrapPageEngineJsonObj(token);
                if (!(candidate is JObject obj))
                {
                    return (false, "", "JsonObj 必须是 JSON 对象");
                }

                if (obj["formConfig"] == null || obj["formConfig"].Type == JTokenType.Null)
                {
                    obj["formConfig"] = new JObject();
                }
                else if (obj["formConfig"].Type != JTokenType.Object)
                {
                    return (false, "", "JsonObj.formConfig 必须是 JSON 对象");
                }

                if (obj["wrapperList"] == null || obj["wrapperList"].Type == JTokenType.Null)
                {
                    obj["wrapperList"] = new JArray();
                }
                else if (obj["wrapperList"].Type != JTokenType.Array)
                {
                    return (false, "", "JsonObj.wrapperList 必须是 JSON 数组");
                }

                return (true, obj.ToString(Newtonsoft.Json.Formatting.None), "");
            }
            catch (Exception ex)
            {
                return (false, "", "JsonObj 不是合法 JSON：" + ex.Message);
            }
        }

        private static JToken UnwrapPageEngineJsonObj(JToken token)
        {
            if (token == null) return null;
            if (token.Type == JTokenType.String)
            {
                var raw = token.Val<string>();
                if (raw.DosIsNullOrWhiteSpace()) return token;
                return UnwrapPageEngineJsonObj(JToken.Parse(raw));
            }

            if (!(token is JObject obj)) return token;
            var jsonObj = obj["JsonObj"] ?? obj["jsonObj"];
            if (jsonObj != null) return UnwrapPageEngineJsonObj(jsonObj);
            var jsonStr = obj["JsonStr"] ?? obj["jsonStr"];
            if (jsonStr != null) return UnwrapPageEngineJsonObj(jsonStr);

            var formData = obj["formData"] as JObject ?? obj["FormData"] as JObject;
            if (formData != null)
            {
                var formJsonObj = formData["JsonObj"] ?? formData["jsonObj"];
                if (formJsonObj != null) return UnwrapPageEngineJsonObj(formJsonObj);
                if (formData["formConfig"] != null || formData["wrapperList"] != null) return formData;
            }

            return obj;
        }

        private static (bool Ok, string Value, string Msg) NormalizePrintPageObj(string rawValue)
        {
            if (rawValue.DosIsNullOrWhiteSpace()) return (false, "", "PageObj 不能为空");
            try
            {
                JToken token = JToken.Parse(rawValue);
                if (token.Type == JTokenType.String)
                {
                    token = JToken.Parse(token.Val<string>() ?? "");
                }
                if (token is JObject wrapper && (wrapper["PageObj"] != null || wrapper["pageObj"] != null))
                {
                    token = wrapper["PageObj"] ?? wrapper["pageObj"];
                    if (token.Type == JTokenType.String) token = JToken.Parse(token.Val<string>() ?? "");
                }

                if (!(token is JObject obj)) return (false, "", "PageObj 必须是 JSON 对象");
                if (!(obj["panels"] is JArray panels) || panels.Count == 0)
                {
                    return (false, "", "PageObj.panels 必须是非空 JSON 数组");
                }

                for (var i = 0; i < panels.Count; i++)
                {
                    if (!(panels[i] is JObject panel))
                    {
                        return (false, "", $"PageObj.panels[{i}] 必须是 JSON 对象");
                    }
                    if (panel["printElements"] == null || panel["printElements"].Type == JTokenType.Null)
                    {
                        panel["printElements"] = new JArray();
                    }
                    else if (panel["printElements"].Type != JTokenType.Array)
                    {
                        return (false, "", $"PageObj.panels[{i}].printElements 必须是 JSON 数组");
                    }
                }

                return (true, obj.ToString(Newtonsoft.Json.Formatting.None), "");
            }
            catch (Exception ex)
            {
                return (false, "", "PageObj 不是合法 JSON：" + ex.Message);
            }
        }

        private static (bool Ok, string Value, string Msg) NormalizeMenuJsonArray(string fieldName, string rawValue, List<string> warnings = null)
        {
            if (string.IsNullOrWhiteSpace(rawValue)) return (true, rawValue ?? "", "");
            JArray array;
            try
            {
                array = JArray.Parse(rawValue);
            }
            catch (Exception ex)
            {
                return (false, rawValue, $"{fieldName} 必须是 JSON 数组：{ex.Message}");
            }

            var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < array.Count; i++)
            {
                if (!(array[i] is JObject item))
                {
                    return (false, rawValue, $"{fieldName}[{i}] 必须是 JSON 对象");
                }

                var name = item["Name"].Val<string>();
                if (name.DosIsNullOrWhiteSpace()) return (false, rawValue, $"{fieldName}[{i}].Name 不能为空");

                var v8Code = item["V8Code"].Val<string>();
                var url = item["Url"].Val<string>();
                if (v8Code.DosIsNullOrWhiteSpace() && url.DosIsNullOrWhiteSpace())
                {
                    return (false, rawValue, $"{fieldName}[{i}] 必须配置 V8Code 或 Url");
                }

                var id = item["Id"].Val<string>();
                if (id.DosIsNullOrWhiteSpace())
                {
                    id = Ulid.NewUlid().ToString();
                    item["Id"] = id;
                    warnings?.Add($"{fieldName}[{i}] 未传 Id，已自动生成 {id}");
                }
                if (!ids.Add(id)) return (false, rawValue, $"{fieldName} 中存在重复 Id：{id}");

                if (item["Sort"] == null) item["Sort"] = i * 10;
                if (item["IsVisible"] == null) item["IsVisible"] = true;
                if (fieldName == "MoreBtns" && item["ShowRow"] == null) item["ShowRow"] = true;

                var codeShow = item["V8CodeShow"].Val<string>();
                if (!codeShow.DosIsNullOrWhiteSpace() && !codeShow.Contains("V8.Result"))
                {
                    warnings?.Add($"{fieldName}[{i}].V8CodeShow 建议显式赋值 V8.Result=true/false");
                }
            }

            return (true, array.ToString(Newtonsoft.Json.Formatting.None), "");
        }

        private static (bool Ok, string Msg) ValidateJsonIfPresent(string fieldName, string rawValue, bool arrayOnly = false)
        {
            if (string.IsNullOrWhiteSpace(rawValue)) return (true, "");
            try
            {
                var token = JToken.Parse(rawValue);
                if (arrayOnly && token.Type != JTokenType.Array)
                {
                    return (false, $"{fieldName} 必须是 JSON 数组");
                }
                return (true, "");
            }
            catch (Exception ex)
            {
                return (false, $"{fieldName} 不是合法 JSON：{ex.Message}");
            }
        }

        private static JObject BuildDataFromParam(string osClient, JObject param, IEnumerable<string> fields, string id = null)
        {
            var data = new JObject
            {
                ["OsClient"] = osClient,
                ["_InvokeType"] = "Client"
            };
            if (!id.DosIsNullOrWhiteSpace()) data["Id"] = id;
            else if (param["Id"] != null) data["Id"] = CloneToken(param["Id"]);

            foreach (var field in fields)
            {
                if (param[field] != null) data[field] = CloneToken(param[field]);
            }
            return data;
        }

        private static async Task<DosResult<object>> UpsertRecordByIdOrKey(
            string osClient, string tableName, JObject data, string uniqueField, string displayName)
        {
            var id = data["Id"].Val<string>();
            if (!id.DosIsNullOrWhiteSpace())
            {
                var existingById = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(tableName, new
                {
                    OsClient = osClient,
                    Id = id
                });
                if (existingById.Code == 1 && existingById.Data != null)
                {
                    var uptResult = await MicroiEngine.FormEngine.UptFormDataAsync(tableName, data);
                    if (uptResult.Code != 1) return new DosResult<object>(uptResult.Code, uptResult.Data, uptResult.Msg);
                    return new DosResult<object>(1, new { Id = id, Message = $"{displayName} 已更新", Updated = true });
                }
            }

            if (!uniqueField.DosIsNullOrWhiteSpace())
            {
                var keyValue = data[uniqueField].Val<string>();
                if (!keyValue.DosIsNullOrWhiteSpace())
                {
                    var existingByKey = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(tableName, new
                    {
                        OsClient = osClient,
                        _Where = new List<object>() { new List<object>() { uniqueField, "=", keyValue } }
                    });
                    if (existingByKey.Code == 1 && existingByKey.Data != null)
                    {
                        data["Id"] = (string)existingByKey.Data.Id;
                        var uptResult = await MicroiEngine.FormEngine.UptFormDataAsync(tableName, data);
                        if (uptResult.Code != 1) return new DosResult<object>(uptResult.Code, uptResult.Data, uptResult.Msg);
                        return new DosResult<object>(1, new { Id = (string)existingByKey.Data.Id, Message = $"{displayName} 已按 {uniqueField} 更新", Updated = true });
                    }
                }
            }

            if (data["Id"].Val<string>().DosIsNullOrWhiteSpace()) data["Id"] = Ulid.NewUlid().ToString();
            var addResult = await MicroiEngine.FormEngine.AddFormDataAsync(tableName, data);
            if (addResult.Code != 1) return new DosResult<object>(addResult.Code, addResult.Data, addResult.Msg);
            return new DosResult<object>(1, new { Id = data["Id"].Val<string>(), Message = $"{displayName} 已创建", Created = true });
        }

        private static List<object> BuildKeywordWhere(string keyword, params string[] fields)
        {
            var where = new List<object>();
            if (keyword.DosIsNullOrWhiteSpace() || fields == null || fields.Length == 0) return where;
            where.Add(new List<object>() { fields[0], "Like", keyword });
            for (var i = 1; i < fields.Length; i++)
            {
                where.Add(new List<object>() { "OR", fields[i], "Like", keyword });
            }
            return where;
        }

        public static async Task<DosResult<object>> ListRoles(string osClient, string keyword = null)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_role", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "Level", "Sort", "Remark", "DeptIds", "BaseLimit" },
                    _Where = BuildKeywordWhere(keyword, "Name", "Remark"),
                    _OrderBy = "Level",
                    _OrderByType = "DESC",
                    _PageSize = 200
                });
                if (result.Code != 1) return new DosResult<object>(result.Code, null, result.Msg);
                return new DosResult<object>(1, new { List = result.Data, Total = result.DataCount });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取角色列表失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> SaveRole(string osClient, JObject param)
        {
            try
            {
                var name = param["Name"].Val<string>();
                if (name.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "Name 不能为空");
                var data = BuildDataFromParam(osClient, param,
                    new[] { "Name", "Level", "Sort", "Remark", "DeptIds", "BaseLimit", "TenantId", "TenantName", "Class" },
                    param["RoleId"].Val<string>() ?? param["Id"].Val<string>());
                if (data["Class"] == null) data["Class"] = osClient;
                return await UpsertRecordByIdOrKey(osClient, "sys_role", data, "Name", "角色");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "保存角色失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> ListModules(string osClient, string keyword = null)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_menu", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] {
                        "Id", "Name", "ParentId", "DiyTableId", "DiyTableName", "Url", "ComponentName", "ComponentPath",
                        "OpenType", "Display", "AppDisplay", "Sort", "Icon", "IconClass", "SearchFieldIds", "TableDiyFieldIds",
                        "MoreBtns", "FormBtns", "BatchSelectMoreBtns", "PageTabs", "ExportMoreBtns", "PageBtns", "UpdateTime"
                    },
                    _Where = BuildKeywordWhere(keyword, "Name", "Url", "DiyTableName"),
                    _OrderBy = "Sort",
                    _OrderByType = "ASC",
                    _PageSize = 1000
                });
                if (result.Code != 1) return new DosResult<object>(result.Code, null, result.Msg);
                return new DosResult<object>(1, new { List = result.Data, Total = result.DataCount });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取菜单模块列表失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> GetModule(string osClient, string moduleId)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_menu", new
                {
                    OsClient = osClient,
                    Id = moduleId
                });
                if (result.Code != 1 || result.Data == null) return new DosResult<object>(0, null, "菜单模块不存在");
                return new DosResult<object>(1, result.Data);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取菜单模块失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> UpdateModule(string osClient, string moduleId, JObject param)
        {
            try
            {
                var allowed = new[] {
                    "Name", "DiyTableId", "DiyTableName", "ParentId", "Sort", "ComponentName", "ComponentPath", "Display", "AppDisplay",
                    "OpenType", "Url", "Icon", "IconClass", "SearchFieldIds", "TableDiyFieldIds", "DefaultOrderBy", "SqlWhere", "DiyConfig",
                    "MoreBtns", "FormBtns", "BatchSelectMoreBtns", "PageTabs", "ExportMoreBtns", "PageBtns", "SortFieldIds", "NotShowFields",
                    "SqlJoin", "JoinTables", "SelectFields", "StatisticsFields", "InTableEdit", "InTableEditFields", "MobileListFields",
                    "CardTitleTagFields", "CardBottomTagFields", "SelectApi", "ImportApi", "ExportApi", "AddBtnText", "SaveBtnText"
                };
                var data = BuildDataFromParam(osClient, param, allowed, moduleId);
                var warnings = new List<string>();
                foreach (var field in MenuJsonArrayFields)
                {
                    if (data[field] == null) continue;
                    var normalized = NormalizeMenuJsonArray(field, ToJsonString(data[field]), warnings);
                    if (!normalized.Ok) return new DosResult<object>(0, null, normalized.Msg);
                    data[field] = normalized.Value;
                }
                var result = await MicroiEngine.FormEngine.UptFormDataAsync("sys_menu", data);
                if (result.Code != 1) return new DosResult<object>(result.Code, result.Data, result.Msg);
                return new DosResult<object>(1, new { ModuleId = moduleId, Message = "菜单模块已更新", Warnings = warnings });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "更新菜单模块失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> ListDataSources(string osClient, string keyword = null)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_datasource", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "DataSourceName", "DataSourceKey", "DataSourceType", "IsEnable", "AllowAnonymous", "UpdateTime" },
                    _Where = BuildKeywordWhere(keyword, "DataSourceName", "DataSourceKey", "DataSourceType"),
                    _OrderBy = "UpdateTime",
                    _OrderByType = "DESC",
                    _PageSize = 500
                });
                if (result.Code != 1) return new DosResult<object>(result.Code, null, result.Msg);
                return new DosResult<object>(1, new { List = result.Data, Total = result.DataCount });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取数据源列表失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> SaveDataSource(string osClient, JObject param)
        {
            try
            {
                var key = param["DataSourceKey"].Val<string>();
                var name = param["DataSourceName"].Val<string>() ?? param["Name"].Val<string>();
                if (key.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "DataSourceKey 不能为空");
                if (name.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "DataSourceName 不能为空");

                var data = BuildDataFromParam(osClient, param,
                    new[] { "DataSourceName", "DataSourceKey", "DataSourceType", "SqlDataSource", "V8DataSource", "JsonDataSource", "TestParam", "TestResult", "DataSourceRole", "AllowAnonymous", "IsEnable" },
                    param["DataSourceId"].Val<string>() ?? param["Id"].Val<string>());
                data["DataSourceName"] = name;
                if (data["DataSourceType"] == null) data["DataSourceType"] = "V8";
                if (data["IsEnable"] == null) data["IsEnable"] = 1;
                if (data["AllowAnonymous"] == null) data["AllowAnonymous"] = 0;

                var type = data["DataSourceType"].Val<string>() ?? "";
                if (type.IndexOf("Json", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    var check = ValidateJsonIfPresent("JsonDataSource", data["JsonDataSource"].Val<string>());
                    if (!check.Ok) return new DosResult<object>(0, null, check.Msg);
                }

                return await UpsertRecordByIdOrKey(osClient, "sys_datasource", data, "DataSourceKey", "数据源");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "保存数据源失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> ListPrintTemplates(string osClient, string keyword = null)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("mic_print", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Title", "Number", "Desc", "DataApi", "UpdateTime" },
                    _Where = BuildKeywordWhere(keyword, "Title", "Number", "Desc"),
                    _OrderBy = "UpdateTime",
                    _OrderByType = "DESC",
                    _PageSize = 500
                });
                if (result.Code != 1) return new DosResult<object>(result.Code, null, result.Msg);
                return new DosResult<object>(1, new { List = result.Data, Total = result.DataCount });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取打印模板列表失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> SavePrintTemplate(string osClient, JObject param)
        {
            try
            {
                var title = param["Title"].Val<string>();
                if (title.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "Title 不能为空");
                var pageObj = ToJsonString(param["PageObj"]);
                if (pageObj.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "PageObj 不能为空");
                var pageCheck = NormalizePrintPageObj(pageObj);
                if (!pageCheck.Ok) return new DosResult<object>(0, null, pageCheck.Msg);
                pageObj = pageCheck.Value;
                var printObj = ToJsonString(param["PrintObj"]);
                var printCheck = ValidateJsonIfPresent("PrintObj", printObj);
                if (!printCheck.Ok) return new DosResult<object>(0, null, printCheck.Msg);

                var data = BuildDataFromParam(osClient, param,
                    new[] { "Title", "Number", "Desc", "DataApi" },
                    param["PrintId"].Val<string>() ?? param["Id"].Val<string>());
                data["PageObj"] = pageObj;
                data["PrintObj"] = printObj.DosIsNullOrWhiteSpace() ? "{}" : printObj;
                return await UpsertRecordByIdOrKey(osClient, "mic_print", data, "Number", "打印模板");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "保存打印模板失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> SaveWorkflowPackage(string osClient, JObject param)
        {
            try
            {
                var flow = param["FlowDesign"] as JObject ?? param["flowDesign"] as JObject;
                if (flow == null) return new DosResult<object>(0, null, "FlowDesign 不能为空");
                var flowName = flow["FlowName"].Val<string>() ?? flow["Name"].Val<string>();
                if (flowName.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "FlowDesign.FlowName 不能为空");

                var flowData = BuildDataFromParam(osClient, flow,
                    new[] { "FlowName", "Category", "IsEnable", "Description", "JsonData", "StartV8", "EndV8", "LineValueV8", "Remark", "Sort", "Roles", "Preview", "TableId" },
                    flow["FlowDesignId"].Val<string>() ?? flow["Id"].Val<string>());
                flowData["FlowName"] = flowName;
                if (flowData["IsEnable"] == null) flowData["IsEnable"] = 1;
                var flowResult = await UpsertRecordByIdOrKey(osClient, "wf_flowdesign", flowData, "FlowName", "工作流设计");
                if (flowResult.Code != 1) return flowResult;
                var flowId = JObject.FromObject(flowResult.Data)["Id"].Val<string>();

                var nodeResults = new List<object>();
                var nodes = param["Nodes"] as JArray ?? param["nodes"] as JArray ?? new JArray();
                foreach (var token in nodes)
                {
                    if (!(token is JObject node)) continue;
                    var nodeName = node["NodeName"].Val<string>() ?? node["Name"].Val<string>();
                    if (nodeName.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "节点 NodeName 不能为空");
                    var nodeData = BuildDataFromParam(osClient, node,
                        new[] { "NodeName", "NodeType", "Roles", "BindJobs", "Users", "Depts", "Description", "Remark", "StartV8", "StartV8Server", "EndV8", "EndV8Server", "LineValueV8", "AllowAddUserV8Code", "Timeout", "AllowSelectUsers", "AllowRecall", "AllowAddUsers", "SameDeptApprove", "BackNodes", "PositionLeft", "PositionTop", "Icon", "DisplayFields", "HideFields", "EditFields", "FieldsConfig", "CopyUsers" },
                        node["NodeId"].Val<string>() ?? node["Id"].Val<string>());
                    nodeData["NodeName"] = nodeName;
                    nodeData["FlowDesignId"] = flowId;
                    var nodeResult = await UpsertRecordByIdOrKey(osClient, "wf_node", nodeData, "Id", "工作流节点");
                    if (nodeResult.Code != 1) return nodeResult;
                    nodeResults.Add(nodeResult.Data);
                }

                var lineResults = new List<object>();
                var lines = param["Lines"] as JArray ?? param["lines"] as JArray ?? new JArray();
                foreach (var token in lines)
                {
                    if (!(token is JObject line)) continue;
                    var lineData = BuildDataFromParam(osClient, line,
                        new[] { "LineName", "FromNodeId", "ToNodeId", "V8Code", "LineValue" },
                        line["LineId"].Val<string>() ?? line["Id"].Val<string>());
                    lineData["FlowDesignId"] = flowId;
                    var lineResult = await UpsertRecordByIdOrKey(osClient, "wf_line", lineData, "Id", "工作流连线");
                    if (lineResult.Code != 1) return lineResult;
                    lineResults.Add(lineResult.Data);
                }

                return new DosResult<object>(1, new
                {
                    FlowDesignId = flowId,
                    Nodes = nodeResults,
                    Lines = lineResults,
                    Message = $"工作流 [{flowName}] 保存成功"
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "保存工作流失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> SaveJob(string osClient, JObject param)
        {
            try
            {
                var jobName = param["JobName"].Val<string>();
                var cronExpression = param["CronExpression"].Val<string>();
                var jobType = param["JobType"].Val<string>() ?? "1";
                if (jobName.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "JobName 不能为空");
                if (cronExpression.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "CronExpression 不能为空");

                var existing = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_schedule_job", new
                {
                    OsClient = osClient,
                    _Where = new List<object>() { new List<object>() { "JobName", "=", jobName } }
                });
                var id = param["JobId"].Val<string>() ?? param["Id"].Val<string>();
                if (id.DosIsNullOrWhiteSpace() && existing.Code == 1 && existing.Data != null) id = (string)existing.Data.Id;
                if (id.DosIsNullOrWhiteSpace()) id = Ulid.NewUlid().ToString();

                var model = new MicroiAddJobModel
                {
                    Id = id,
                    JobName = jobName,
                    DllName = param["DllName"].Val<string>() ?? "",
                    JobPath = param["JobPath"].Val<string>() ?? "",
                    JobDesc = param["JobDesc"].Val<string>() ?? param["Description"].Val<string>() ?? "",
                    JobParam = param["JobParam"].Val<string>() ?? "",
                    CronDesc = param["CronDesc"].Val<string>() ?? "",
                    CronExpression = cronExpression,
                    JobType = jobType,
                    ApiEngineKey = param["ApiEngineKey"].Val<string>() ?? "",
                    OsClient = osClient
                };

                var result = existing.Code == 1 && existing.Data != null
                    ? await MicroiEngine.Job.UpdateJob(model)
                    : await MicroiEngine.Job.AddJob(model);
                if (result.Code != 1) return new DosResult<object>(result.Code, result.Data, result.Msg);
                return new DosResult<object>(1, new { JobId = id, JobName = jobName, Message = "定时任务已保存" });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "保存定时任务失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> ValidateLowCodeSystem(string osClient, JObject manifest)
        {
            try
            {
                var errors = new List<string>();
                var warnings = new List<string>();

                var tableResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_table", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "Description" },
                    _PageSize = 10000
                });
                var fieldResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_field", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "TableId", "Name", "Label", "Component", "Config" },
                    _PageSize = 50000
                });
                var tables = tableResult.Code == 1 && tableResult.Data != null ? tableResult.Data.ToList() : new List<dynamic>();
                var fields = fieldResult.Code == 1 && fieldResult.Data != null ? fieldResult.Data.ToList() : new List<dynamic>();
                var tableByName = tables.ToDictionary(t => ((string)t.Name ?? "").ToLower(), t => t);
                var fieldsByTable = fields.GroupBy(f => (string)f.TableId ?? "").ToDictionary(g => g.Key, g => g.ToList());

                var manifestTables = manifest["tables"] as JArray ?? manifest["Tables"] as JArray ?? new JArray();
                foreach (var token in manifestTables)
                {
                    if (!(token is JObject table)) continue;
                    var name = table["name"].Val<string>() ?? table["Name"].Val<string>();
                    if (name.DosIsNullOrWhiteSpace()) { errors.Add("表定义缺少 name"); continue; }
                    if (!tableByName.TryGetValue(name.ToLower(), out var tableModel))
                    {
                        errors.Add($"缺少表：{name}");
                        continue;
                    }
                    var tableFields = fieldsByTable.ContainsKey((string)tableModel.Id) ? fieldsByTable[(string)tableModel.Id] : new List<dynamic>();
                    var fieldNames = new HashSet<string>(tableFields.Select(f => ((string)f.Name ?? "").ToLower()));
                    var manifestFields = table["fields"] as JArray ?? table["Fields"] as JArray ?? new JArray();
                    foreach (var fieldToken in manifestFields)
                    {
                        if (!(fieldToken is JObject field)) continue;
                        var fieldName = field["name"].Val<string>() ?? field["Name"].Val<string>();
                        if (fieldName.DosIsNullOrWhiteSpace()) { errors.Add($"表 {name} 中存在无 name 字段定义"); continue; }
                        if (!fieldNames.Contains(fieldName.ToLower())) errors.Add($"表 {name} 缺少字段：{fieldName}");
                    }
                }

                async Task CheckByKey(string tableName, string keyField, JArray items, string itemName)
                {
                    foreach (var token in items)
                    {
                        if (!(token is JObject item)) continue;
                        var key = item[keyField].Val<string>() ?? item[keyField.Substring(0, 1).ToLower() + keyField.Substring(1)].Val<string>();
                        if (key.DosIsNullOrWhiteSpace()) continue;
                        var exist = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(tableName, new
                        {
                            OsClient = osClient,
                            _Where = new List<object>() { new List<object>() { keyField, "=", key } }
                        });
                        if (exist.Code != 1 || exist.Data == null) errors.Add($"缺少{itemName}：{key}");
                    }
                }

                await CheckByKey("sys_apiengine", "ApiEngineKey", manifest["engines"] as JArray ?? manifest["Engines"] as JArray ?? new JArray(), "接口引擎");
                await CheckByKey("sys_menu", "Name", manifest["modules"] as JArray ?? manifest["Modules"] as JArray ?? new JArray(), "菜单模块");
                await CheckByKey("sys_datasource", "DataSourceKey", manifest["dataSources"] as JArray ?? manifest["DataSources"] as JArray ?? new JArray(), "数据源");
                await CheckByKey("mic_print", "Title", manifest["printTemplates"] as JArray ?? manifest["PrintTemplates"] as JArray ?? new JArray(), "打印模板");
                await CheckByKey("wf_flowdesign", "FlowName", manifest["workflows"] as JArray ?? manifest["Workflows"] as JArray ?? new JArray(), "工作流");

                var events = manifest["events"] as JArray ?? manifest["Events"] as JArray ?? new JArray();
                foreach (var token in events)
                {
                    if (!(token is JObject ev)) continue;
                    var eventType = ev["eventType"].Val<string>() ?? ev["EventType"].Val<string>();
                    if (!eventType.DosIsNullOrWhiteSpace() && !ValidEventTypes.Contains(eventType))
                    {
                        errors.Add($"无效 V8 事件类型：{eventType}");
                    }
                }

                if (manifestTables.Count == 0) warnings.Add("Manifest 未声明 tables，无法验收字段级结果");
                return new DosResult<object>(1, new
                {
                    Passed = errors.Count == 0,
                    Errors = errors,
                    Warnings = warnings,
                    Summary = new
                    {
                        TableCount = tables.Count,
                        FieldCount = fields.Count,
                        CheckedTables = manifestTables.Count
                    }
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "验收低代码系统失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> WriteMcpAuditLog(string osClient, string action, string target, string content, dynamic currentToken)
        {
            try
            {
                var currentUser = currentToken?.CurrentUser;
                var userId = "";
                var userName = "";
                if (currentUser != null)
                {
                    var userObj = currentUser is JObject jObject ? jObject : JObject.FromObject(currentUser);
                    userId = userObj["Id"].Val<string>() ?? "";
                    userName = userObj["Name"].Val<string>() ?? userObj["Account"].Val<string>() ?? "";
                }
                var result = await MicroiEngine.MongoDB.AddSysLog(new SysLogParam
                {
                    OsClient = osClient,
                    Type = "MCP",
                    Title = action ?? "MCP Operation",
                    Content = TruncateForLog(content ?? ""),
                    Remark = target ?? "",
                    UserId = userId,
                    UserName = userName,
                    AppId = "microi.mcp"
                });
                return new DosResult<object>(result.Code, new { Action = action, Target = target }, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(1, new { Warning = "审计日志写入失败：" + ex.Message }, "审计日志写入失败但业务操作不回滚");
            }
        }

        public static async Task<DosResult<object>> QueryMongodbLogs(string osClient, JObject param)
        {
            try
            {
                var pageIndex = param?["PageIndex"].Val<int?>() ?? param?["_PageIndex"].Val<int?>() ?? 1;
                var pageSize = param?["PageSize"].Val<int?>() ?? param?["_PageSize"].Val<int?>() ?? 20;
                if (pageSize <= 0) pageSize = 20;
                if (pageSize > 200) pageSize = 200;
                var logParam = new SysLogParam
                {
                    OsClient = osClient,
                    _SearchMonth = param?["SearchMonth"].Val<string>() ?? param?["_SearchMonth"].Val<string>(),
                    _Keyword = param?["Keyword"].Val<string>() ?? param?["_Keyword"].Val<string>(),
                    Type = param?["Type"].Val<string>(),
                    Level = param?["Level"].Val<int?>(),
                    _PageIndex = pageIndex,
                    _PageSize = pageSize
                };
                var result = await MicroiEngine.MongoDB.GetSysLog(logParam);
                return new DosResult<object>(result.Code, new
                {
                    List = result.Data,
                    DataCount = result.DataCount,
                    PageIndex = pageIndex,
                    PageSize = pageSize,
                    SearchMonth = logParam._SearchMonth.DosIsNullOrWhiteSpace() ? DateTime.Now.ToString("yyyyMM") : logParam._SearchMonth
                }, result.Msg, result.DataCount);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "查询MongoDB日志失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> WriteMongodbLog(string osClient, JObject param, dynamic currentToken)
        {
            try
            {
                var currentUser = currentToken?.CurrentUser;
                var userId = "";
                var userName = "";
                if (currentUser != null)
                {
                    var userObj = currentUser is JObject jObject ? jObject : JObject.FromObject(currentUser);
                    userId = userObj["Id"].Val<string>() ?? "";
                    userName = userObj["Name"].Val<string>() ?? userObj["Account"].Val<string>() ?? "";
                }
                var logParam = new SysLogParam
                {
                    OsClient = osClient,
                    Type = param?["Type"].Val<string>() ?? "MCP",
                    Title = param?["Title"].Val<string>() ?? "MCP MongoDB Log",
                    Content = TruncateForLog(param?["Content"].Val<string>() ?? ""),
                    Api = param?["Api"].Val<string>() ?? "microi.mcp",
                    Param = TruncateForLog(param?["Param"].Val<string>() ?? ""),
                    Remark = param?["Remark"].Val<string>() ?? "",
                    OtherInfo = TruncateForLog(param?["OtherInfo"].Val<string>() ?? ""),
                    Level = param?["Level"].Val<int?>() ?? 1,
                    Timer = param?["Timer"].Val<int?>(),
                    Result = param?["Result"].Val<string>() ?? "",
                    UserId = param?["UserId"].Val<string>() ?? userId,
                    UserName = param?["UserName"].Val<string>() ?? userName,
                    AppId = param?["AppId"].Val<string>() ?? "microi.mcp"
                };
                var result = await MicroiEngine.MongoDB.AddSysLog(logParam);
                return new DosResult<object>(result.Code, new
                {
                    logParam.Type,
                    logParam.Title,
                    logParam.Api,
                    logParam.Level
                }, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "写入MongoDB日志失败：" + ex.Message);
            }
        }

        /// <summary>
        /// MCP 上传 base64 文件到平台文件存储，并可同步写入指定表字段。
        /// </summary>
        public static async Task<DosResult<object>> UploadFileBase64(string osClient, string fileName, string fileByteBase64, string path, bool? limit, bool? preview, string targetTable, string targetId, string targetField, dynamic currentToken)
        {
            try
            {
                if (IsBlank(osClient)) return new DosResult<object>(0, null, "OsClient 不能为空");
                if (IsBlank(fileByteBase64)) return new DosResult<object>(0, null, "FileByteBase64 不能为空");

                var normalizedBase64 = NormalizeBase64Payload(fileByteBase64);
                byte[] bytes;
                try
                {
                    bytes = Convert.FromBase64String(normalizedBase64);
                }
                catch
                {
                    return new DosResult<object>(0, null, "FileByteBase64 不是有效的 base64 文件内容");
                }

                if (bytes.Length == 0) return new DosResult<object>(0, null, "文件内容为空");
                if (IsBlank(fileName)) fileName = $"mcp-{DateTime.Now:yyyyMMddHHmmssfff}.png";
                if (IsBlank(path)) path = "mcp/assets";

                using var fileStream = new MemoryStream(bytes);
                var currentUser = currentToken?.CurrentUser;
                var uploadParam = new DiyUploadParam
                {
                    OsClient = osClient,
                    Path = path.Trim().Trim('/'),
                    Limit = limit ?? false,
                    Preview = preview ?? true,
                    Multiple = false,
                    _InvokeType = InvokeType.Client.ToString(),
                    _CurrentUser = currentUser,
                    Files = new Dictionary<string, Stream> { [fileName] = fileStream }
                };

                var uploadResult = await MicroiEngine.HDFS.Upload(uploadParam);
                if (uploadResult.Code != 1)
                {
                    return new DosResult<object>(uploadResult.Code, uploadResult.Data, "MCP 上传文件失败：" + uploadResult.Msg);
                }

                var filePathName = ExtractUploadPath(uploadResult.Data);
                object updateInfo = null;
                if (!IsBlank(targetTable) && !IsBlank(targetId) && !IsBlank(targetField))
                {
                    if (IsBlank(filePathName)) return new DosResult<object>(0, uploadResult.Data, "文件已上传，但未能从上传结果解析文件路径，无法写入表字段");

                    var updateParam = new JObject
                    {
                        ["OsClient"] = osClient,
                        ["Id"] = targetId,
                        [targetField] = filePathName,
                        ["_InvokeType"] = InvokeType.Client.ToString()
                    };
                    var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync(targetTable, updateParam);
                    if (updateResult.Code != 1)
                    {
                        return new DosResult<object>(updateResult.Code, new { Upload = uploadResult.Data, FilePathName = filePathName }, "文件已上传，但写入数据库字段失败：" + updateResult.Msg);
                    }
                    updateInfo = updateResult.Data;
                }

                return new DosResult<object>(1, new
                {
                    FileName = fileName,
                    FilePathName = filePathName,
                    Upload = uploadResult.Data,
                    Updated = updateInfo
                }, "MCP 文件上传完成");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "MCP 上传文件失败：" + ex.Message);
            }
        }

        #endregion

        #region SetRolePermission

        /// <summary>
        /// 为角色设置菜单权限（批量添加 sys_rolelimit 记录）
        /// </summary>
        public static async Task<DosResult<object>> SetRolePermission(string osClient, string roleId, List<string> menuIds)
        {
            try
            {
                // 支持 roleId="admin" 自动查找管理员角色（Level 最高的角色）
                if (roleId.Equals("admin", StringComparison.OrdinalIgnoreCase))
                {
                    var roleResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_role", new
                    {
                        OsClient = osClient,
                        _SelectFields = new[] { "Id", "Name", "Level" },
                        _Where = new List<object>()
                        {
                            
                        },
                        _OrderBy = "Level",
                        _OrderByType = "DESC",
                        _PageSize = 1
                    });

                    if (roleResult.Code == 1 && roleResult.Data != null)
                    {
                        var roles = (IEnumerable<dynamic>)roleResult.Data;
                        var adminRole = roles.FirstOrDefault();
                        if (adminRole != null)
                        {
                            roleId = (string)adminRole.Id;
                        }
                        else
                        {
                            return new DosResult<object>(0, null, "未找到管理员角色，请先在 sys_role 中创建角色");
                        }
                    }
                    else
                    {
                        return new DosResult<object>(0, null, "查询角色列表失败：" + roleResult.Msg);
                    }
                }

                var addedCount = 0;
                var skippedCount = 0;

                foreach (var menuId in menuIds)
                {
                    // 检查是否已存在
                    var existResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_rolelimit", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>()
                        {
                            new List<object>() { "RoleId", "=", roleId },
                            new List<object>() { "AND", "FkId", "=", menuId }
                        }
                    });

                    if (existResult.Code == 1 && existResult.Data != null)
                    {
                        skippedCount++;
                        continue;
                    }

                    var addResult = await MicroiEngine.FormEngine.AddFormDataAsync("sys_rolelimit", new JObject
                    {
                        ["Customer"] = osClient,
                        ["RoleId"] = roleId,
                        ["FkId"] = menuId,
                        ["Type"] = "Menu",
                        ["Permission"] = "[\"Add\",\"Edit\",\"Del\",\"Export\",\"Import\"]",
                        ["CreateTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                        ["_InvokeType"] = "Client"
                    });

                    if (addResult.Code == 1) addedCount++;
                }



                return new DosResult<object>(1, new
                {
                    Message = $"角色权限设置完成：新增 {addedCount} 条，已跳过 {skippedCount} 条",
                    AddedCount = addedCount,
                    SkippedCount = skippedCount,
                    RoleId = roleId
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "设置角色权限失败：" + ex.Message);
            }
        }

        #endregion

        #region UpdateField
        /// <summary>
        /// 修改单个 diy_field（走 FormEngine.UptDiyField，自动清 diy_table_field_list 缓存）
        /// 支持按 FieldId 或 (TableId+Name) 定位
        /// </summary>
        public static async Task<DosResult<object>> UpdateField(string osClient, JObject patch)
        {
            try
            {
                if (patch == null) return new DosResult<object>(0, null, "patch 不能为空");

                var p = new DiyFieldParam
                {
                    OsClient = osClient,
                    Id = patch["Id"].Val<string>(),
                    TableId = patch["TableId"].Val<string>(),
                    TableName = patch["TableName"].Val<string>(),
                    Name = patch["Name"].Val<string>(),
                    Label = patch["Label"].Val<string>(),
                    Type = patch["Type"].Val<string>(),
                    Component = patch["Component"].Val<string>(),
                    Visible = patch["Visible"]?.Val<int>(),
                    AppVisible = patch["AppVisible"]?.Val<int>(),
                    Readonly = patch["Readonly"]?.Val<int>(),
                    NotEmpty = patch["NotEmpty"]?.Val<int>(),
                    Unique = patch["Unique"]?.Val<int>(),
                    Encrypt = patch["Encrypt"]?.Val<int>(),
                    Sort = patch["Sort"]?.Val<int>(),
                    FormWidth = patch["FormWidth"]?.Val<int?>(),
                    TableWidth = patch["TableWidth"]?.Val<int>(),
                    Placeholder = patch["Placeholder"].Val<string>(),
                    DefaultValue = patch["DefaultValue"].Val<string>(),
                    Tab = patch["Tab"].Val<string>(),
                    Data = patch["Data"].Val<string>(),
                    Config = patch["Config"].Val<string>(),
                    Description = patch["Description"].Val<string>(),
                    InTableEdit = patch["InTableEdit"]?.Val<int>(),
                    _InvokeType = InvokeType.Client.ToString()
                };

                if (p.Id.DosIsNullOrWhiteSpace() && (p.Name.DosIsNullOrWhiteSpace() || (p.TableId.DosIsNullOrWhiteSpace() && p.TableName.DosIsNullOrWhiteSpace())))
                    return new DosResult<object>(0, null, "需要提供 Id 或 (TableId/TableName + Name) 来定位字段");

                var v8FieldNames = new[] { "V8Code", "KeyupV8Code", "V8TmpEngineTable", "V8TmpEngineForm" };
                var hasV8 = v8FieldNames.Any(k => patch[k] != null);

                async Task<string> ResolveFieldIdAsync()
                {
                    if (!p.Id.DosIsNullOrWhiteSpace()) return p.Id;

                    var tableId = p.TableId;
                    if (tableId.DosIsNullOrWhiteSpace() && !p.TableName.DosIsNullOrWhiteSpace())
                    {
                        var tableLookup = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
                        {
                            OsClient = osClient,
                            _SelectFields = new[] { "Id", "Name" },
                            _Where = new List<object>
                            {
                                new List<object> { "Name", "=", p.TableName }
                            }
                        });
                        if (tableLookup.Code == 1 && tableLookup.Data != null) tableId = (string)tableLookup.Data.Id;
                    }

                    var lookup = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_field", new
                    {
                        OsClient = osClient,
                        _SelectFields = new[] { "Id", "TableId", "Name" },
                        _Where = new List<object>
                        {
                            new List<object> { "TableId", "=", tableId },
                            new List<object> { "Name", "=", p.Name }
                        }
                    });
                    return lookup.Code == 1 && lookup.Data != null ? (string)lookup.Data.Id : "";
                }

                var onlyV8Patch = hasV8 && patch.Properties().All(prop =>
                    prop.Name == "OsClient" || prop.Name == "Id" || prop.Name == "TableId" ||
                    prop.Name == "TableName" || prop.Name == "Name" || prop.Name == "_InvokeType" ||
                    v8FieldNames.Contains(prop.Name));

                if (onlyV8Patch)
                {
                    var fieldId = await ResolveFieldIdAsync();
                    if (fieldId.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "未找到字段，无法更新字段 V8 代码");
                    var directPatch = new JObject { ["OsClient"] = osClient, ["Id"] = fieldId };
                    foreach (var k in v8FieldNames)
                    {
                        if (patch[k] != null) directPatch[k] = patch[k];
                    }
                    var directResult = await MicroiEngine.FormEngine.UptFormDataAsync("diy_field", directPatch);
                    if (directResult.Code != 1) return new DosResult<object>(0, null, "更新字段 V8 代码失败：" + directResult.Msg);
                    return new DosResult<object>(1, new { UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") }, "");
                }

                var directFieldNames = new HashSet<string>
                {
                    "Label", "Component", "Visible", "AppVisible", "Readonly", "NotEmpty",
                    "Unique", "Encrypt", "Sort", "FormWidth", "TableWidth", "Placeholder",
                    "DefaultValue", "Tab", "Data", "Config", "Description", "InTableEdit",
                    "V8Code", "KeyupV8Code", "V8TmpEngineTable", "V8TmpEngineForm"
                };
                var locatorNames = new HashSet<string> { "OsClient", "Id", "TableId", "TableName", "Name", "_InvokeType" };
                var nonLocatorProps = patch.Properties()
                    .Where(prop => !locatorNames.Contains(prop.Name))
                    .Select(prop => prop.Name)
                    .ToList();
                var canDirectPatch = nonLocatorProps.Count > 0 && nonLocatorProps.All(name => directFieldNames.Contains(name));
                if (canDirectPatch)
                {
                    var fieldId = await ResolveFieldIdAsync();
                    if (fieldId.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "未找到字段，无法更新字段属性");
                    var directPatch = new JObject { ["OsClient"] = osClient, ["Id"] = fieldId };
                    foreach (var prop in patch.Properties())
                    {
                        if (directFieldNames.Contains(prop.Name))
                        {
                            directPatch[prop.Name] = prop.Value;
                        }
                    }
                    var directResult = await MicroiEngine.FormEngine.UptFormDataAsync("diy_field", directPatch);
                    if (directResult.Code != 1) return new DosResult<object>(0, null, "更新字段属性失败：" + directResult.Msg);
                    return new DosResult<object>(1, new { UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") }, "");
                }

                async Task<JObject> ResolveFieldModelAsync()
                {
                    var fieldId = await ResolveFieldIdAsync();
                    if (fieldId.DosIsNullOrWhiteSpace()) return null;
                    var fieldLookup = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_field", new
                    {
                        OsClient = osClient,
                        Id = fieldId
                    });
                    return fieldLookup.Code == 1 && fieldLookup.Data != null ? JObject.FromObject(fieldLookup.Data) : null;
                }

                var existingField = await ResolveFieldModelAsync();
                if (existingField == null) return new DosResult<object>(0, null, "未找到字段，无法更新字段属性");
                p.Id = existingField["Id"].Val<string>();
                p.TableId = existingField["TableId"].Val<string>();
                p.Name = patch["Name"] != null ? p.Name : existingField["Name"].Val<string>();
                p.Label = patch["Label"] != null ? p.Label : existingField["Label"].Val<string>();
                p.Type = patch["Type"] != null ? p.Type : existingField["Type"].Val<string>();
                p.Component = patch["Component"] != null ? p.Component : existingField["Component"].Val<string>();
                p.Visible = patch["Visible"] != null ? p.Visible : existingField["Visible"]?.Val<int>();
                p.AppVisible = patch["AppVisible"] != null ? p.AppVisible : existingField["AppVisible"]?.Val<int>();
                p.Readonly = patch["Readonly"] != null ? p.Readonly : existingField["Readonly"]?.Val<int>();
                p.NotEmpty = patch["NotEmpty"] != null ? p.NotEmpty : existingField["NotEmpty"]?.Val<int>();
                p.Unique = patch["Unique"] != null ? p.Unique : existingField["Unique"]?.Val<int>();
                p.Encrypt = patch["Encrypt"] != null ? p.Encrypt : existingField["Encrypt"]?.Val<int>();
                p.Sort = patch["Sort"] != null ? p.Sort : existingField["Sort"]?.Val<int>();
                p.FormWidth = patch["FormWidth"] != null ? p.FormWidth : existingField["FormWidth"]?.Val<int?>();
                p.TableWidth = patch["TableWidth"] != null ? p.TableWidth : existingField["TableWidth"]?.Val<int>();
                p.Placeholder = patch["Placeholder"] != null ? p.Placeholder : existingField["Placeholder"].Val<string>();
                p.DefaultValue = patch["DefaultValue"] != null ? p.DefaultValue : existingField["DefaultValue"].Val<string>();
                p.Tab = patch["Tab"] != null ? p.Tab : existingField["Tab"].Val<string>();
                p.Data = patch["Data"] != null ? p.Data : existingField["Data"].Val<string>();
                p.Config = patch["Config"] != null ? p.Config : existingField["Config"].Val<string>();
                p.Description = patch["Description"] != null ? p.Description : existingField["Description"].Val<string>();
                p.InTableEdit = patch["InTableEdit"] != null ? p.InTableEdit : existingField["InTableEdit"]?.Val<int>();

                var r = await MicroiEngine.FormEngine.UptDiyField(p);
                if (r.Code != 1) return new DosResult<object>(r.Code, r.Data, r.Msg);

                // 单独写入 4 个 V8 字段（不影响物理列，直接写 diy_field 表）
                // 任一字段在 patch 中存在（哪怕空串，表示要清空）就回写
                var v8Patch = new JObject { ["OsClient"] = osClient };
                foreach (var k in v8FieldNames)
                {
                    if (patch[k] != null) v8Patch[k] = patch[k];
                }
                if (hasV8)
                {
                    var fieldId = await ResolveFieldIdAsync();
                    if (!fieldId.DosIsNullOrWhiteSpace())
                    {
                        v8Patch["Id"] = fieldId;
                        var v8r = await MicroiEngine.FormEngine.UptFormDataAsync("diy_field", v8Patch);
                        if (v8r.Code != 1) return new DosResult<object>(0, null, "更新字段 V8 代码失败：" + v8r.Msg);
                    }
                }

                return new DosResult<object>(r.Code, r.Data, r.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "UpdateField 失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 获取指定表的所有字段（含 V8 代码字段，供 VSCode 插件字段 V8 事件目录使用）
        /// 至少返回：Id / TableId / Name / Label / V8Code / KeyupV8Code / V8TmpEngineTable / V8TmpEngineForm / UpdateTime
        /// </summary>
        public static async Task<DosResult<object>> GetFieldList(string osClient, string tableId, string tableName = null)
        {
            try
            {
                if (tableId.DosIsNullOrWhiteSpace() && tableName.DosIsNullOrWhiteSpace())
                    return new DosResult<object>(0, null, "需要提供 TableId 或 TableName");

                var where = new List<object>();
                if (!tableId.DosIsNullOrWhiteSpace())
                {
                    where.Add(new List<object> { "TableId", "=", tableId });
                }
                else
                {
                    // 按 TableName 反查 TableId
                    var tr = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
                    {
                        OsClient = osClient,
                        _Where = new List<object> { new List<object> { "Name", "=", tableName } }
                    });
                    if (tr.Code != 1 || tr.Data == null) return new DosResult<object>(0, null, "未找到表：" + tableName);
                    where.Add(new List<object> { "TableId", "=", (string)tr.Data.Id });
                }

                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_field", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "TableId", "Name", "Label", "Component", "Type", "Sort",
                        "Visible", "AppVisible", "FormWidth", "TableWidth",
                        "Data", "Config", "V8Code", "KeyupV8Code", "V8TmpEngineTable", "V8TmpEngineForm", "UpdateTime" },
                    _Where = where,
                    _OrderBy = "Sort",
                    _OrderByType = "ASC",
                    _PageSize = 5000
                });
                if (result.Code != 1) return new DosResult<object>(result.Code, null, result.Msg);
                return new DosResult<object>(1, new { List = result.Data, Total = result.DataCount });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取字段列表失败：" + ex.Message);
            }
        }
        #endregion

        #region UpdateTable
        /// <summary>
        /// 修改 diy_table 的属性（如 Column 表单列数、Description、IsTree 等）
        /// 并主动清相关字段列表缓存
        /// </summary>
        public static async Task<DosResult<object>> UpdateTable(string osClient, JObject patch)
        {
            try
            {
                if (patch == null) return new DosResult<object>(0, null, "patch 不能为空");
                var id = patch["Id"].Val<string>();
                var name = patch["Name"].Val<string>();
                if (id.DosIsNullOrWhiteSpace() && name.DosIsNullOrWhiteSpace())
                    return new DosResult<object>(0, null, "需要提供 Id 或 Name 来定位表");

                dynamic tableRow = null;
                if (!id.DosIsNullOrWhiteSpace())
                {
                    var qr = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new { OsClient = osClient, Id = id });
                    if (qr.Code == 1) tableRow = qr.Data;
                }
                else
                {
                    var qr = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>() { new List<object>() { "Name", "=", name } }
                    });
                    if (qr.Code == 1) tableRow = qr.Data;
                }
                if (tableRow == null) return new DosResult<object>(0, null, "未找到表");

                var upt = new JObject();
                upt["Id"] = (string)tableRow.Id;
                upt["OsClient"] = osClient;
                foreach (var prop in patch.Properties())
                {
                    if (prop.Name == "Id" || prop.Name == "Name" || prop.Name == "OsClient") continue;
                    upt[prop.Name] = prop.Value;
                }
                var r = await MicroiEngine.FormEngine.UptFormDataAsync("diy_table", upt);

                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var tid = ((string)tableRow.Id ?? "").ToLower();
                var tname = ((string)tableRow.Name ?? "").ToLower();
                foreach (var prefix in new[] { "diy_table", "Diy_Table" })
                {
                    if (!string.IsNullOrEmpty(tid)) await cache.RemoveAsync($"Microi:{osClient}:FormData:{prefix}:{tid}");
                    if (!string.IsNullOrEmpty(tname)) await cache.RemoveAsync($"Microi:{osClient}:FormData:{prefix}:{tname}");
                }
                if (!string.IsNullOrEmpty(tid)) await cache.RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:{tid}");
                if (!string.IsNullOrEmpty(tname)) await cache.RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:{tname}");

                return new DosResult<object>(r.Code, r.Data, r.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "UpdateTable 失败：" + ex.Message);
            }
        }
        #endregion

        #region RefreshSchemaCache
        /// <summary>
        /// 手动刷新一张/多张表的 diy_table / diy_field 相关 Redis 缓存
        /// </summary>
        public static async Task<DosResult<object>> RefreshSchemaCache(string osClient, List<string> tableNamesOrIds)
        {
            try
            {
                if (tableNamesOrIds == null || tableNamesOrIds.Count == 0)
                    return new DosResult<object>(0, null, "tableNamesOrIds 不能为空");
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var cleared = 0;
                foreach (var key in tableNamesOrIds)
                {
                    if (string.IsNullOrWhiteSpace(key)) continue;
                    var k = key.ToLower();
                    foreach (var prefix in new[] { "diy_table", "Diy_Table", "diy_table_field_list" })
                    {
                        await cache.RemoveAsync($"Microi:{osClient}:FormData:{prefix}:{k}");
                        cleared++;
                    }
                }
                return new DosResult<object>(1, new { Cleared = cleared, Tables = tableNamesOrIds.Count });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "RefreshSchemaCache 失败：" + ex.Message);
            }
        }
        #endregion

        #region SetEngineAnonymous
        /// <summary>
        /// 批量设置接口引擎是否允许匿名调用，并清缓存
        /// </summary>
        public static async Task<DosResult<object>> SetEngineAnonymous(string osClient, List<string> apiEngineKeys, int allowAnonymous)
        {
            try
            {
                if (apiEngineKeys == null || apiEngineKeys.Count == 0)
                    return new DosResult<object>(0, null, "apiEngineKeys 不能为空");
                var ok = 0; var fail = 0; var log = new List<string>();
                foreach (var key in apiEngineKeys)
                {
                    var qr = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>() { new List<object>() { "ApiEngineKey", "=", key } }
                    });
                    if (qr.Code != 1 || qr.Data == null) { fail++; log.Add("✗ not found: " + key); continue; }
                    var row = qr.Data;
                    var currentApiAddress = row.ApiAddress == null ? "" : (string)row.ApiAddress;
                    var apiAddress = string.IsNullOrWhiteSpace(currentApiAddress) ? $"/apiengine/{key}" : currentApiAddress;
                    var upt = new
                    {
                        OsClient = osClient,
                        Id = (string)row.Id,
                        ApiEngineKey = (string)row.ApiEngineKey,
                        ApiName = (string)row.ApiName,
                        ApiAddress = apiAddress,
                        AllowAnonymous = allowAnonymous,
                        IsEnable = 1,
                        StopHttp = 0
                    };
                    var ur = await MicroiEngine.FormEngine.UptFormDataAsync("sys_apiengine", upt);
                    if (ur.Code == 1)
                    {
                        var cacheResult = await RefreshApiEngineRouteCache(osClient, key, (string)row.Id);
                        if (cacheResult.Code == 1)
                        {
                            ok++; log.Add($"✓ {key} AllowAnonymous={allowAnonymous}, IsEnable=1, StopHttp=0, ApiAddress={apiAddress}");
                        }
                        else
                        {
                            fail++; log.Add($"⚠ {key} cache refresh fail: {cacheResult.Msg}");
                        }
                    }
                    else { fail++; log.Add($"⚠ {key} fail: {ur.Msg}"); }
                }
                return new DosResult<object>(1, new { Ok = ok, Fail = fail, Log = log });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "SetEngineAnonymous 失败：" + ex.Message);
            }
        }
        #endregion
    }
}
