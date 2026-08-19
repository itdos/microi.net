using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Replaces the negatively named V8Unlimited switch on interface engines
    /// with V8Limit. The migration is version-gated by sys_config.ServerVersion:
    /// every existing engine is made unrestricted exactly once, while later user
    /// changes are preserved on subsequent starts.
    /// </summary>
    public sealed class Upgrade32
    {
        public static string Version = "6.9.8.7";

        public const string FieldName = "V8Limit";
        public const string LegacyFieldName = "V8Unlimited";
        public const string BeginMarker = "// MICROI_V8_RUNTIME_LIMIT_VISIBILITY_V1_BEGIN";
        public const string EndMarker = "// MICROI_V8_RUNTIME_LIMIT_VISIBILITY_V1_END";

        public const string Description =
            "默认关闭，接口引擎不设置 Jint 单次执行超时、最大语句数、函数递归和累计分配预算；打开后才按超时时间、最大语句、累计分配预算和递归深度执行限制。进程/容器常驻内存保护、取消、并发、接口嵌套深度、权限沙箱和数据库保护始终生效。";

        public const string SwitchV8Code = @"var limited = V8.Form.V8Limit === true || Number(V8.Form.V8Limit || 0) === 1;
var limitFields = ['Timeout', 'MaxStatements', 'LimitMemory', 'LimitRecursion'];
for (var i = 0; i < limitFields.length; i++) {
  V8.FieldSet(limitFields[i], 'Visible', limited);
}";

        public static readonly string VisibilityBlock = BeginMarker + @"
(function () {
  var limited = V8.Form.V8Limit === true || Number(V8.Form.V8Limit || 0) === 1;
  var limitFields = ['Timeout', 'MaxStatements', 'LimitMemory', 'LimitRecursion'];
  for (var i = 0; i < limitFields.length; i++) {
    V8.FieldSet(limitFields[i], 'Visible', limited);
  }
  if (limited) {
    var defaults = {
      Timeout: 600,
      MaxStatements: 50000000,
      LimitMemory: 2048,
      LimitRecursion: 2000
    };
    for (var key in defaults) {
      if (Number(V8.Form[key] || 0) <= 0) {
        V8.FormSet(key, defaults[key]);
      }
    }
  }
})();
" + EndMarker;

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add("租户数据库连接不存在，无法升级 V8 运行限制开关。");
                    return messages;
                }

                var apiTable = await GetTableAsync(osClient).ConfigureAwait(false);
                if (apiTable == null)
                {
                    messages.Add("未找到 sys_apiengine 元数据，无法升级 V8 运行限制开关。");
                    return messages;
                }

                var tab = await GetReferenceTabAsync(
                    osClient,
                    apiTable.Value<string>("Id"),
                    "Timeout",
                    "开发配置").ConfigureAwait(false);
                await EnsureFieldAsync(
                    messages,
                    osClient,
                    apiTable.Value<string>("Id"),
                    tab).ConfigureAwait(false);
                if (messages.Count > 0) return messages;

                var currentInFormV8 = apiTable.Value<string>("InFormV8") ?? "";
                var reconciled = ReconcileApiEngineInFormV8(currentInFormV8, out var changed);
                if (changed)
                {
                    var update = await UpgradeTrustedFormEngine.UpdateAsync(
                        "diy_table",
                        osClient,
                        new JObject
                        {
                            ["Id"] = apiTable["Id"],
                            ["OsClient"] = osClient,
                            ["InFormV8"] = reconciled
                        }).ConfigureAwait(false);
                    if (update.Code != 1)
                    {
                        messages.Add("更新接口引擎表单显隐事件失败：" + update.Msg);
                        return messages;
                    }
                }

                UpgradeExecutionLeaseContext.ThrowIfLost();
                // One set-based update is intentional. Upgrade.cs advances the
                // ServerVersion only after Run succeeds, so this reset is applied
                // once and a user's later V8Limit=1 choice is never overwritten.
                client.Db.FromSql(@"UPDATE sys_apiengine
                        SET V8Limit = @p0,
                            V8Unlimited = @p1")
                    .AddInParameter("p0", 0)
                    .AddInParameter("p1", 1)
                    .ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                messages.Add("升级 V8 运行限制开关失败：" + ex.Message);
            }
            return messages;
        }

        public static string ReconcileApiEngineInFormV8(string currentCode, out bool changed)
        {
            var code = RemoveManagedBlock(
                currentCode ?? "",
                Upgrade27.BeginMarker,
                Upgrade27.EndMarker,
                "旧 V8 无运行限制");
            code = RemoveManagedBlock(code, BeginMarker, EndMarker, "V8 运行限制");
            var reconciled = string.IsNullOrWhiteSpace(code)
                ? VisibilityBlock + Environment.NewLine
                : code.TrimEnd() + Environment.NewLine + Environment.NewLine + VisibilityBlock + Environment.NewLine;
            changed = !string.Equals(currentCode ?? "", reconciled, StringComparison.Ordinal);
            return reconciled;
        }

        private static string RemoveManagedBlock(
            string code,
            string beginMarker,
            string endMarker,
            string title)
        {
            var start = code.IndexOf(beginMarker, StringComparison.Ordinal);
            if (start < 0) return code;
            var end = code.IndexOf(endMarker, start, StringComparison.Ordinal);
            if (end < 0)
            {
                throw new FormatException($"接口引擎 InFormV8 的{title}标记不完整，已停止写入以保护现有代码。");
            }
            end += endMarker.Length;
            return code.Remove(start, end - start).TrimEnd();
        }

        private static async Task EnsureFieldAsync(
            List<string> messages,
            string osClient,
            string tableId,
            string tab)
        {
            var client = OsClientExtend.GetClient(osClient);
            var existing = await GetFieldAsync(osClient, tableId, FieldName).ConfigureAwait(false);
            var physicalExists = client.Db.ColumnExists("sys_apiengine", FieldName);
            if (existing == null)
            {
                var add = await UpgradeTrustedFormEngine.AddFieldAsync(
                    osClient,
                    new DiyFieldParam
                    {
                        TableId = tableId,
                        TableName = "sys_apiengine",
                        Name = FieldName,
                        Label = "V8运行限制",
                        Type = "int",
                        Component = "Switch",
                        DefaultValue = "0",
                        Sort = 2350,
                        TableWidth = 130,
                        Description = Description,
                        Tab = tab,
                        Visible = 1,
                        AppVisible = 1,
                        Readonly = 0,
                        NotEmpty = 0,
                        NameConfirm = 1,
                        _NotAddDbField = physicalExists
                    }).ConfigureAwait(false);
                if (add.Code != 1)
                {
                    messages.Add($"新增 sys_apiengine.{FieldName} 失败：{add.Msg}");
                    return;
                }
                existing = await GetFieldAsync(osClient, tableId, FieldName).ConfigureAwait(false);
            }

            if (existing == null)
            {
                messages.Add($"新增 sys_apiengine.{FieldName} 后未能回读字段元数据。");
                return;
            }

            var update = await UpgradeTrustedFormEngine.UpdateAsync(
                "diy_field",
                osClient,
                new JObject
                {
                    ["Id"] = existing["Id"],
                    ["OsClient"] = osClient,
                    ["TableId"] = tableId,
                    ["Label"] = "V8运行限制",
                    ["Component"] = "Switch",
                    ["DefaultValue"] = "0",
                    ["Description"] = Description,
                    ["Sort"] = 2350,
                    ["Tab"] = tab,
                    ["Visible"] = 1,
                    ["AppVisible"] = 1,
                    ["V8Code"] = SwitchV8Code
                }).ConfigureAwait(false);
            if (update.Code != 1)
            {
                messages.Add($"更新 sys_apiengine.{FieldName} 元数据失败：{update.Msg}");
                return;
            }

            var legacy = await GetFieldAsync(osClient, tableId, LegacyFieldName).ConfigureAwait(false);
            if (legacy != null)
            {
                var hideLegacy = await UpgradeTrustedFormEngine.UpdateAsync(
                    "diy_field",
                    osClient,
                    new JObject
                    {
                        ["Id"] = legacy["Id"],
                        ["OsClient"] = osClient,
                        ["TableId"] = tableId,
                        ["Visible"] = 0,
                        ["AppVisible"] = 0,
                        ["IsDeleted"] = 1
                    }).ConfigureAwait(false);
                if (hideLegacy.Code != 1)
                {
                    messages.Add("隐藏旧 V8Unlimited 字段元数据失败：" + hideLegacy.Msg);
                }
            }
        }

        private static async Task<JObject> GetTableAsync(string osClient)
        {
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(
                "diy_table",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object> { new List<object> { "Name", "=", "sys_apiengine" } },
                    _SelectFields = new[] { "Id", "Name", "InFormV8" }
                }).ConfigureAwait(false);
            return result.Code == 1 && result.Data != null
                ? JObject.FromObject((object)result.Data)
                : null;
        }

        private static async Task<JObject> GetFieldAsync(
            string osClient,
            string tableId,
            string fieldName)
        {
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(
                "diy_field",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "TableId", "=", tableId },
                        new List<object> { "Name", "=", fieldName }
                    },
                    _SelectFields = new[] { "Id", "Name", "Tab", "IsDeleted" }
                }).ConfigureAwait(false);
            return result.Code == 1 && result.Data != null
                ? JObject.FromObject((object)result.Data)
                : null;
        }

        private static async Task<string> GetReferenceTabAsync(
            string osClient,
            string tableId,
            string referenceField,
            string fallback)
        {
            var field = await GetFieldAsync(osClient, tableId, referenceField).ConfigureAwait(false);
            var tab = field?.Value<string>("Tab");
            return string.IsNullOrWhiteSpace(tab) ? fallback : tab;
        }
    }
}
