using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// V8 代码专用版本记录。
    ///
    /// 普通业务数据仍由 diy_table.EnableDataVersion 控制；V8 代码属于平台源码，
    /// 每次真实变更都应写入 mic_data_version，且表单设计器、MCP、接口调用共用同一规则。
    /// </summary>
    public static class V8CodeVersionService
    {
        private static readonly IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> CodeFields
            = new Dictionary<string, IReadOnlyDictionary<string, string>>(StringComparer.OrdinalIgnoreCase)
            {
                ["diy_table"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["InFormV8"] = "前端表单进入V8事件",
                    ["SubmitFormV8"] = "前端表单提交前V8事件",
                    ["OutFormV8"] = "前端表单提交后V8事件",
                    ["SubmitBeforeServerV8"] = "后端表单提交前V8事件",
                    ["SubmitAfterServerV8"] = "后端表单提交后V8事件",
                    ["ServerDataV8"] = "后端数据处理V8事件",
                    ["DataFilterV8"] = "后端数据过滤V8事件"
                },
                ["diy_field"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["V8Code"] = "值变更V8事件",
                    ["KeyupV8Code"] = "键盘V8事件",
                    ["V8TmpEngineTable"] = "模板V8引擎（表格）",
                    ["V8TmpEngineForm"] = "模板V8引擎（表单）"
                },
                ["sys_apiengine"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["ApiV8Code"] = "接口引擎V8代码"
                },
                ["wf_node"] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["StartV8"] = "前端进入V8事件",
                    ["EndV8"] = "前端离开V8事件",
                    ["StartV8Server"] = "后端进入V8事件",
                    ["EndV8Server"] = "后端离开V8事件",
                    ["LineValueV8"] = "条件判断V8事件",
                    ["AllowAddUserV8Code"] = "允许加签人员V8事件"
                }
            };

        private static readonly Regex VersionRegex = new Regex(
            @"@version\s+v?(\d+\.\d+\.\d+)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        public static bool IsSupportedTable(string tableName)
        {
            return !tableName.DosIsNullOrWhiteSpace() && CodeFields.ContainsKey(tableName);
        }

        public static async Task<DosResult> SaveChangedVersionsAsync(
            string osClient,
            string tableName,
            JObject oldRow,
            JObject newRow,
            JObject currentUser = null,
            string action = "Update")
        {
            return await SaveChangedVersionsCoreAsync(
                osClient,
                tableName,
                new[] { oldRow },
                new[] { newRow },
                currentUser,
                action);
        }

        public static async Task<DosResult> SaveChangedVersionsBatchAsync(
            string osClient,
            string tableName,
            IEnumerable<JObject> oldRows,
            IEnumerable<JObject> newRows,
            JObject currentUser = null,
            string action = "Update")
        {
            return await SaveChangedVersionsCoreAsync(
                osClient,
                tableName,
                oldRows,
                newRows,
                currentUser,
                action);
        }

        private static async Task<DosResult> SaveChangedVersionsCoreAsync(
            string osClient,
            string tableName,
            IEnumerable<JObject> oldRows,
            IEnumerable<JObject> newRows,
            JObject currentUser,
            string action)
        {
            if (!IsSupportedTable(tableName))
            {
                return new DosResult(1, new { Count = 0 });
            }

            var newRowList = (newRows ?? Enumerable.Empty<JObject>())
                .Where(row => row != null)
                .Select(row => (JObject)row.DeepClone())
                .ToList();
            if (newRowList.Count == 0)
            {
                return new DosResult(1, new { Count = 0 });
            }

            var oldRowMap = (oldRows ?? Enumerable.Empty<JObject>())
                .Where(row => row != null && !SafeString(row, "Id").DosIsNullOrWhiteSpace())
                .GroupBy(row => SafeString(row, "Id"), StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

            var tableModelResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
            {
                OsClient = osClient,
                _SelectFields = new[] { "Id", "Name" },
                _Where = new List<object>
                {
                    new List<object> { "Name", "=", tableName }
                }
            });
            if (tableModelResult.Code != 1 || tableModelResult.Data == null)
            {
                return new DosResult(0, null, $"未找到代码版本所属表：{tableName}");
            }

            var tableModel = JObject.FromObject(tableModelResult.Data);
            var tableId = SafeString(tableModel, "Id");
            var canonicalTableName = SafeString(tableModel, "Name", tableName);
            var createdCount = 0;

            foreach (var newRow in newRowList)
            {
                var rowId = SafeString(newRow, "Id");
                if (rowId.DosIsNullOrWhiteSpace())
                {
                    continue;
                }

                oldRowMap.TryGetValue(rowId, out var oldRow);
                var latestVersion = await GetLatestVersionAsync(osClient, tableId, rowId);
                foreach (var field in CodeFields[tableName])
                {
                    var newCode = DecodeCode(SafeString(newRow, field.Key));
                    var oldCode = oldRow == null ? "" : DecodeCode(SafeString(oldRow, field.Key));
                    if (NormalizeCode(oldCode) == NormalizeCode(newCode))
                    {
                        continue;
                    }
                    // 新增空代码不形成无意义的首版本；清空已有代码仍然需要形成版本。
                    if (oldRow == null && newCode.DosIsNullOrWhiteSpace())
                    {
                        continue;
                    }

                    var version = ResolveNextVersion(latestVersion, ExtractVersion(newCode));
                    var snapshot = new JObject
                    {
                        ["Id"] = rowId,
                        [field.Key] = newCode,
                        ["__CodeEditorCode"] = newCode,
                        ["__CodeEditorFieldName"] = field.Key,
                        ["__CodeEditorFieldLabel"] = field.Value,
                        ["__CodeEditorLanguage"] = "javascript"
                    };
                    var addResult = await MicroiEngine.FormEngine.AddFormDataAsync("mic_data_version", new
                    {
                        OsClient = osClient,
                        _CurrentUser = currentUser,
                        TableId = tableId,
                        TableName = canonicalTableName,
                        TableRowId = rowId,
                        Version = version,
                        Action = action,
                        Data = snapshot.ToString(Formatting.None),
                        Remark = $"{field.Value}代码变更"
                    });
                    if (addResult.Code != 1)
                    {
                        return new DosResult(addResult.Code, new
                        {
                            Count = createdCount,
                            TableName = canonicalTableName,
                            TableRowId = rowId,
                            FieldName = field.Key
                        }, addResult.Msg);
                    }
                    createdCount++;
                    latestVersion = version;
                }
            }

            return new DosResult(1, new { Count = createdCount });
        }

        private static async Task<string> GetLatestVersionAsync(
            string osClient,
            string tableId,
            string rowId)
        {
            var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("mic_data_version", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "TableRowId", "=", rowId },
                    new List<object> { "TableId", "=", tableId }
                },
                _SelectFields = new[] { "Id", "Version" },
                _OrderBy = "CreateTime",
                _OrderByType = "DESC",
                _PageIndex = 1,
                _PageSize = 1
            });

            var latestVersion = "";
            if (result.Code == 1 && result.Data != null)
            {
                try
                {
                    latestVersion = JArray.FromObject(result.Data).FirstOrDefault()?["Version"]?.ToString() ?? "";
                }
                catch
                {
                    latestVersion = "";
                }
            }

            return latestVersion;
        }

        private static string ResolveNextVersion(string latestVersion, string requestedVersion)
        {
            if (TryParseVersion(requestedVersion, out var requested)
                && (!TryParseVersion(latestVersion, out var latest) || CompareVersion(requested, latest) > 0))
            {
                return FormatVersion(requested);
            }
            return IncrementVersion(latestVersion);
        }

        private static string ExtractVersion(string code)
        {
            var match = VersionRegex.Match(code ?? "");
            return match.Success ? match.Groups[1].Value : "";
        }

        private static string IncrementVersion(string version)
        {
            if (!TryParseVersion(version, out var parsed))
            {
                return "1.0.0";
            }
            parsed[2]++;
            if (parsed[2] > 9)
            {
                parsed[2] = 0;
                parsed[1]++;
            }
            if (parsed[1] > 9)
            {
                parsed[1] = 0;
                parsed[0]++;
            }
            return FormatVersion(parsed);
        }

        private static bool TryParseVersion(string version, out int[] values)
        {
            values = null;
            var normalized = (version ?? "").Trim().TrimStart('v', 'V');
            var parts = normalized.Split('.');
            if (parts.Length != 3
                || !int.TryParse(parts[0], out var major)
                || !int.TryParse(parts[1], out var minor)
                || !int.TryParse(parts[2], out var patch))
            {
                return false;
            }
            values = new[] { major, minor, patch };
            return true;
        }

        private static int CompareVersion(int[] left, int[] right)
        {
            for (var index = 0; index < 3; index++)
            {
                var result = left[index].CompareTo(right[index]);
                if (result != 0) return result;
            }
            return 0;
        }

        private static string FormatVersion(int[] version)
        {
            return $"{version[0]}.{version[1]}.{version[2]}";
        }

        private static string DecodeCode(string value)
        {
            return value.DosIsNullOrWhiteSpace() ? "" : V8Base64.Base64ToString(value);
        }

        private static string NormalizeCode(string value)
        {
            return (value ?? "").Replace("\r\n", "\n").Replace("\r", "\n");
        }

        private static string SafeString(JObject row, string fieldName, string fallback = "")
        {
            var token = row?[fieldName];
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
            {
                return fallback;
            }
            return token.ToString();
        }
    }
}
