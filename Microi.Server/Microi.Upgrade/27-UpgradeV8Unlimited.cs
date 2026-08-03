using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Adds an explicit, high-risk opt-in for interface engines and backend table
    /// V8 events that must keep a long business chain inside one database
    /// transaction. The migration is expand-only, idempotent and preserves custom
    /// InFormV8 code by reconciling a marked block.
    /// </summary>
    public sealed class Upgrade27
    {
        public static string Version = "6.9.8.2";

        public const string FieldName = "V8Unlimited";
        public const string BeginMarker = "// MICROI_V8_UNLIMITED_VISIBILITY_V1_BEGIN";
        public const string EndMarker = "// MICROI_V8_UNLIMITED_VISIBILITY_V1_END";

        public const string ApiEngineDescription =
            "高风险开关。仅用于必须在一个共享事务中完整成功或完整回滚、且无法安全分片的受控接口。开启后当前接口引擎不设置Jint执行超时、最大语句数、函数递归和累计分配预算；仍保留进程/容器常驻内存保护、请求及后台任务取消、执行并发、接口嵌套深度、权限沙箱和数据库保护。下游接口引擎及表后端V8事件需分别开启。";

        public const string DiyTableDescription =
            "高风险开关。开启后本表的提交前、提交后和服务器端数据处理V8事件不设置Jint执行超时、最大语句数、函数递归和累计分配预算；仍保留进程/容器常驻内存保护、请求及后台任务取消、执行并发、接口嵌套深度、权限沙箱和数据库保护。仅用于必须共享同一事务且无法安全分片的受控逻辑。";

        public const string SwitchV8Code = @"var unlimited = V8.Form.V8Unlimited === true || Number(V8.Form.V8Unlimited || 0) === 1;
var limitFields = ['Timeout', 'MaxStatements', 'LimitMemory', 'LimitRecursion'];
for (var i = 0; i < limitFields.length; i++) {
  V8.FieldSet(limitFields[i], 'Visible', !unlimited);
}";

        public static readonly string VisibilityBlock = BeginMarker + @"
(function () {
  var unlimited = V8.Form.V8Unlimited === true || Number(V8.Form.V8Unlimited || 0) === 1;
  var limitFields = ['Timeout', 'MaxStatements', 'LimitMemory', 'LimitRecursion'];
  for (var i = 0; i < limitFields.length; i++) {
    V8.FieldSet(limitFields[i], 'Visible', !unlimited);
  }
  if (!unlimited) {
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
                    messages.Add("租户数据库连接不存在，无法升级V8无运行限制开关。");
                    return messages;
                }

                var apiTable = await GetTableAsync(osClient, "sys_apiengine");
                var diyTable = await GetTableAsync(osClient, "diy_table");
                if (apiTable == null || diyTable == null)
                {
                    messages.Add("未找到 sys_apiengine 或 diy_table 元数据，无法升级V8无运行限制开关。");
                    return messages;
                }

                var apiTab = await GetReferenceTabAsync(
                    osClient,
                    apiTable["Id"]?.ToString(),
                    "Timeout",
                    "开发配置");
                await EnsureFieldAsync(
                    messages,
                    osClient,
                    apiTable["Id"]?.ToString(),
                    "sys_apiengine",
                    ApiEngineDescription,
                    2350,
                    apiTab,
                    SwitchV8Code);

                var tableTab = await GetReferenceTabAsync(
                    osClient,
                    diyTable["Id"]?.ToString(),
                    "SubmitBeforeServerV8",
                    "后端事件");
                await EnsureFieldAsync(
                    messages,
                    osClient,
                    diyTable["Id"]?.ToString(),
                    "diy_table",
                    DiyTableDescription,
                    4250,
                    tableTab,
                    "");

                var currentInFormV8 = apiTable["InFormV8"]?.ToString() ?? "";
                var reconciled = ReconcileApiEngineInFormV8(currentInFormV8, out var changed);
                if (changed)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var updateResult = await UpgradeTrustedFormEngine.UpdateAsync(
                        "diy_table",
                        osClient,
                        new JObject
                        {
                            ["Id"] = apiTable["Id"],
                            ["OsClient"] = osClient,
                            ["InFormV8"] = reconciled
                        });
                    if (updateResult.Code != 1)
                    {
                        messages.Add("更新接口引擎表单显隐事件失败：" + updateResult.Msg);
                    }
                }
            }
            catch (Exception ex)
            {
                messages.Add("升级V8无运行限制开关失败：" + ex.Message);
            }
            return messages;
        }

        public static string ReconcileApiEngineInFormV8(string currentCode, out bool changed)
        {
            var code = currentCode ?? "";
            var start = code.IndexOf(BeginMarker, StringComparison.Ordinal);
            if (start >= 0)
            {
                var end = code.IndexOf(EndMarker, start, StringComparison.Ordinal);
                if (end < 0)
                {
                    throw new FormatException("接口引擎 InFormV8 的V8无运行限制标记不完整，已停止写入以保护现有代码。");
                }
                end += EndMarker.Length;
                code = code.Remove(start, end - start).TrimEnd();
            }

            var reconciled = string.IsNullOrWhiteSpace(code)
                ? VisibilityBlock + Environment.NewLine
                : code.TrimEnd() + Environment.NewLine + Environment.NewLine + VisibilityBlock + Environment.NewLine;
            changed = !string.Equals(currentCode ?? "", reconciled, StringComparison.Ordinal);
            return reconciled;
        }

        private static async Task EnsureFieldAsync(
            List<string> messages,
            string osClient,
            string tableId,
            string tableName,
            string description,
            int sort,
            string tab,
            string v8Code)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            var client = OsClientExtend.GetClient(osClient);
            var existing = await GetFieldAsync(osClient, tableId, FieldName);
            var physicalExists = client.Db.ColumnExists(tableName, FieldName);
            if (existing == null || !physicalExists)
            {
                var addResult = await MicroiEngine.FormEngine.AddFieldAsync(new
                {
                    OsClient = osClient,
                    TableId = tableId,
                    TableName = tableName,
                    Name = FieldName,
                    Label = "V8无运行限制",
                    Type = "int",
                    Component = "Switch",
                    DefaultValue = "0",
                    Sort = sort,
                    TableWidth = 130,
                    Description = description,
                    Tab = tab,
                    Visible = 1,
                    AppVisible = 1,
                    V8Code = v8Code,
                    _NotAddDbField = physicalExists
                });
                if (addResult.Code != 1)
                {
                    messages.Add($"新增 {tableName}.{FieldName} 失败：{addResult.Msg}");
                    return;
                }
                existing = await GetFieldAsync(osClient, tableId, FieldName);
            }

            if (existing == null)
            {
                messages.Add($"新增 {tableName}.{FieldName} 后未能回读字段元数据。");
                return;
            }

            var patch = new JObject
            {
                ["Id"] = existing["Id"],
                ["OsClient"] = osClient,
                ["TableId"] = tableId,
                ["Label"] = "V8无运行限制",
                ["Component"] = "Switch",
                ["DefaultValue"] = "0",
                ["Description"] = description,
                ["Sort"] = sort,
                ["Tab"] = tab,
                ["Visible"] = 1,
                ["AppVisible"] = 1,
                ["V8Code"] = v8Code
            };
            var updateResult = await UpgradeTrustedFormEngine.UpdateAsync(
                "diy_field",
                osClient,
                patch);
            if (updateResult.Code != 1)
            {
                messages.Add($"更新 {tableName}.{FieldName} 元数据失败：{updateResult.Msg}");
            }
        }

        private static async Task<JObject> GetTableAsync(string osClient, string tableName)
        {
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(
                "diy_table",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object> { new List<object> { "Name", "=", tableName } },
                    _SelectFields = new[] { "Id", "Name", "InFormV8" }
                });
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
                    _SelectFields = new[] { "Id", "Name", "Tab" }
                });
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
            var field = await GetFieldAsync(osClient, tableId, referenceField);
            var tab = field?["Tab"]?.ToString();
            return string.IsNullOrWhiteSpace(tab) ? fallback : tab;
        }
    }
}
