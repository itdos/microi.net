using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Adds tenant-visible V8 call-tree/depth settings and corrects the historic
    /// descriptions that treated Jint's cumulative allocation counter as live
    /// process memory. The migration is expand-only and safe to run repeatedly.
    /// </summary>
    public sealed class Upgrade22
    {
        public static string Version = "6.7.8.1";

        private const string SysConfigTable = "sys_config";
        private const string ApiEngineTable = "sys_apiengine";
        private const string DefaultV8Tab = "开发配置";

        private static readonly IReadOnlyList<FieldDefinition> NewSysConfigFields =
            new List<FieldDefinition>
            {
                Field(
                    "V8CallTreeLimitMemoryMB",
                    "V8调用树分配预算(MB)",
                    "NumberText",
                    4700,
                    "8192",
                    "根接口与全部嵌套接口的累计分配总预算，默认8192MB；不是实时堆占用，也不会预留对应物理内存。该值应不小于单层分配预算。"),
                Field(
                    "V8MaxCallTreeLimitMemoryMB",
                    "V8调用树最大预算(MB)",
                    "NumberText",
                    4800,
                    "32768",
                    "租户可配置的整棵V8调用树累计分配硬上限，默认32768MB；最终仍受平台代码固定安全边界约束。"),
                Field(
                    "V8NestedApiDepth",
                    "V8接口嵌套深度",
                    "NumberText",
                    4900,
                    "32",
                    "一棵逻辑调用树允许的接口引擎/V8嵌套深度，根层计为1，默认32。它与单个JavaScript函数递归深度是两种不同限制。"),
                Field(
                    "V8MaxNestedApiDepth",
                    "V8接口嵌套最大深度",
                    "NumberText",
                    5000,
                    "64",
                    "租户可配置的V8接口嵌套深度硬上限，默认64；最终仍受平台代码固定安全边界约束。"),
                Field(
                    "V8IsolateNestedApiMemory",
                    "隔离嵌套分配计数",
                    "Switch",
                    5100,
                    "1",
                    "建议保持开启。开启后，子接口的分配不再被每个父接口的单层预算重复计费，同时仍由根调用树总预算保护。")
            };

        private static readonly IReadOnlyList<FieldMetadata> SysConfigMetadata =
            new List<FieldMetadata>
            {
                Metadata("V8DefaultTimeoutSeconds", null,
                    "单个V8执行片段的默认超时，默认600秒。后台任务总时长可超过此值，但每个可恢复片段必须在超时前返回HasMore和Checkpoint。"),
                Metadata("V8MaxTimeoutSeconds", null,
                    "租户或接口可配置的单片段超时硬上限，默认3600秒。不要用提高该值替代后台任务分片。"),
                Metadata("V8DefaultMaxStatements", null,
                    "单个Jint引擎执行片段的默认JavaScript语句预算，默认50000000；嵌套子接口拥有独立语句预算。"),
                Metadata("V8MaxStatements", null,
                    "租户或接口可配置的单个Jint引擎语句硬上限，默认500000000；无界循环仍应修复，长批量应分片。"),
                Metadata("V8DefaultLimitMemoryMB", "V8单层分配预算(MB)",
                    "单个V8引擎默认累计分配预算，默认2048MB。它统计执行期间的分配流量，不是实时堆占用；开启嵌套隔离后不会重复计入子接口分配。"),
                Metadata("V8MaxLimitMemoryMB", "V8单层最大预算(MB)",
                    "租户或接口可配置的单层累计分配硬上限，默认4096MB；最终仍受平台代码固定安全边界约束。"),
                Metadata("V8DefaultLimitRecursion", null,
                    "单个JavaScript脚本函数递归的默认深度上限，默认2000；不等同于接口引擎嵌套层数。"),
                Metadata("V8MaxLimitRecursion", null,
                    "JavaScript函数递归可配置的硬上限，默认5000；不控制V8.ApiEngine.Run的接口嵌套深度。"),
                Metadata("V8MaxConcurrentExecutions", null,
                    "当前API进程可同时执行的根V8调用树数量，默认128；嵌套调用不会重复占用全局名额。"),
                Metadata("V8TenantMaxExecutions", null,
                    "单租户在当前API进程可同时执行的根V8调用树数量，默认32；嵌套调用不会重复占用租户名额。"),
                Metadata("V8KeyMaxConcurrentExecutions", null,
                    "单接口Key在当前API进程的并发上限，默认16；同一调用树重入相同Key时不重复抢占，避免嵌套自锁。"),
                Metadata("V8ExecutionWaitMilliseconds", null,
                    "根调用或新的子接口Key等待并发名额的最长时间，默认1800000毫秒；取消后台任务或节点停机时会立即中止等待。")
            };

        private static readonly IReadOnlyList<FieldMetadata> ApiEngineMetadata =
            new List<FieldMetadata>
            {
                Metadata("Timeout", null,
                    "单次接口引擎执行片段超时，单位秒，默认600。后台任务总时长可以超过该值，但每个片段必须在超时前保存Checkpoint并返回HasMore。"),
                Metadata("MaxStatements", null,
                    "当前这一个Jint引擎的JavaScript语句预算；嵌套子接口拥有独立预算。用于阻止无界循环，长批量任务应按Checkpoint分片。"),
                Metadata("LimitMemory", "累计分配预算(MB)",
                    "当前这一层Jint引擎执行期间的累计分配预算，单位MB，不是实时堆占用。默认2048；开启嵌套隔离后，子接口分配不会被父层重复计费，整棵调用树另有总预算。"),
                Metadata("LimitRecursion", null,
                    "当前JavaScript脚本的函数递归深度上限，默认2000、平台硬上限默认5000；它不等同于接口引擎嵌套层数。")
            };

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add("租户数据库连接不存在，无法升级V8资源限制。" );
                    return messages;
                }

                var sysConfigTableId = await GetTableIdAsync(osClient, SysConfigTable);
                if (string.IsNullOrWhiteSpace(sysConfigTableId))
                {
                    messages.Add($"未找到 {SysConfigTable} 元数据，无法升级V8资源限制。" );
                    return messages;
                }

                var v8Tab = await GetExistingV8TabAsync(osClient, sysConfigTableId);
                foreach (var field in NewSysConfigFields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var existing = await GetFieldAsync(osClient, sysConfigTableId, field.Name);
                    var physicalExists = client.Db.ColumnExists(SysConfigTable, field.Name);
                    if (existing == null || !physicalExists)
                    {
                        var addResult = await MicroiEngine.FormEngine.AddFieldAsync(new
                        {
                            OsClient = osClient,
                            TableId = sysConfigTableId,
                            TableName = SysConfigTable,
                            field.Name,
                            field.Label,
                            Type = "int",
                            field.Component,
                            field.DefaultValue,
                            field.Sort,
                            field.TableWidth,
                            FormWidth = 6,
                            field.Description,
                            Tab = v8Tab,
                            Visible = 1,
                            AppVisible = 1,
                            _NotAddDbField = physicalExists
                        });
                        if (addResult.Code != 1)
                        {
                            messages.Add($"新增 {SysConfigTable}.{field.Name} 失败：{addResult.Msg}");
                            continue;
                        }
                        existing = await GetFieldAsync(osClient, sysConfigTableId, field.Name);
                    }

                    if (existing != null)
                    {
                        await PatchFieldAsync(
                            messages,
                            osClient,
                            sysConfigTableId,
                            existing,
                            new FieldMetadata
                            {
                                Name = field.Name,
                                Label = field.Label,
                                Description = field.Description,
                                Tab = v8Tab,
                                DefaultValue = field.DefaultValue
                            });
                    }
                }

                await PatchTableFieldsAsync(
                    messages,
                    osClient,
                    sysConfigTableId,
                    SysConfigMetadata);

                var apiEngineTableId = await GetTableIdAsync(osClient, ApiEngineTable);
                if (!string.IsNullOrWhiteSpace(apiEngineTableId))
                {
                    await PatchTableFieldsAsync(
                        messages,
                        osClient,
                        apiEngineTableId,
                        ApiEngineMetadata);
                }
            }
            catch (Exception ex)
            {
                messages.Add("升级V8资源限制失败：" + ex.Message);
            }

            return messages;
        }

        private static async Task PatchTableFieldsAsync(
            List<string> messages,
            string osClient,
            string tableId,
            IEnumerable<FieldMetadata> fields)
        {
            foreach (var field in fields)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var existing = await GetFieldAsync(osClient, tableId, field.Name);
                if (existing == null) continue;
                await PatchFieldAsync(messages, osClient, tableId, existing, field);
            }
        }

        private static async Task PatchFieldAsync(
            List<string> messages,
            string osClient,
            string tableId,
            JObject existing,
            FieldMetadata field)
        {
            var patch = new JObject
            {
                ["OsClient"] = osClient,
                ["Id"] = existing["Id"],
                ["TableId"] = tableId,
                ["Description"] = field.Description
            };
            if (!string.IsNullOrWhiteSpace(field.Label)) patch["Label"] = field.Label;
            if (!string.IsNullOrWhiteSpace(field.Tab)) patch["Tab"] = field.Tab;
            if (field.DefaultValue != null) patch["DefaultValue"] = field.DefaultValue;

            var updateResult = await UpgradeTrustedFormEngine.UpdateAsync(
                "diy_field",
                osClient,
                patch);
            if (updateResult.Code != 1)
            {
                messages.Add($"修正字段 {field.Name} 说明失败：{updateResult.Msg}");
            }
        }

        private static async Task<string> GetTableIdAsync(string osClient, string tableName)
        {
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(
                "diy_table",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object> { new List<object> { "Name", "=", tableName } },
                    _SelectFields = new[] { "Id", "Name" }
                });
            return result.Code == 1 && result.Data != null
                ? Convert.ToString((object)result.Data.Id)
                : "";
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
                    _SelectFields = new[]
                    {
                        "Id", "Name", "Label", "Description", "Tab", "DefaultValue"
                    }
                });
            return result.Code == 1 && result.Data != null
                ? JObject.FromObject((object)result.Data)
                : null;
        }

        private static async Task<string> GetExistingV8TabAsync(string osClient, string tableId)
        {
            var existing = await GetFieldAsync(osClient, tableId, "V8DefaultTimeoutSeconds");
            var tab = Convert.ToString(existing?["Tab"]);
            return string.IsNullOrWhiteSpace(tab) ? DefaultV8Tab : tab;
        }

        private static FieldDefinition Field(
            string name,
            string label,
            string component,
            int sort,
            string defaultValue,
            string description)
        {
            return new FieldDefinition
            {
                Name = name,
                Label = label,
                Component = component,
                Sort = sort,
                TableWidth = 180,
                DefaultValue = defaultValue,
                Description = description
            };
        }

        private static FieldMetadata Metadata(string name, string label, string description)
        {
            return new FieldMetadata
            {
                Name = name,
                Label = label,
                Description = description
            };
        }

        private sealed class FieldDefinition
        {
            public string Name { get; set; }
            public string Label { get; set; }
            public string Component { get; set; }
            public int Sort { get; set; }
            public int TableWidth { get; set; }
            public string DefaultValue { get; set; }
            public string Description { get; set; }
        }

        private sealed class FieldMetadata
        {
            public string Name { get; set; }
            public string Label { get; set; }
            public string Description { get; set; }
            public string Tab { get; set; }
            public string DefaultValue { get; set; }
        }
    }
}
