using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 为 SaaS 引擎增加独立 OCR 配置 Tab。迁移只做扩展并可幂等重跑；已有 Tab、字段
    /// 和用户自定义配置不会被整表覆盖。多节点启动时仍由平台共享升级租约串行执行。
    /// </summary>
    public sealed class Upgrade29
    {
        public static string Version = "6.9.8.4";
        public const string TabId = "6270d21c-7528-4899-b48c-f6356d735f2c";
        public const string TabName = "OCR识别";

        private const string SelectConfig =
            "{\"DataSource\":\"KeyValue\",\"SelectLabel\":\"Value\",\"SelectSaveField\":\"Key\",\"SelectSaveFormat\":\"Text\",\"EnableSearch\":false,\"DataSourceSqlRemote\":false}";
        private const string PasswordConfig =
            "{\"TextShowPassword\":true,\"TextAutocomplete\":false}";
        private const string TextareaConfig =
            "{\"Textarea\":{\"DefaultRows\":6}}";

        private sealed class FieldDefinition
        {
            public string Name { get; set; }
            public string Label { get; set; }
            public string Type { get; set; }
            public string Component { get; set; }
            public int Sort { get; set; }
            public string DefaultValue { get; set; }
            public string Description { get; set; }
            public string Placeholder { get; set; }
            public string Data { get; set; }
            public string Config { get; set; }
            public int? FormWidth { get; set; }
            public int AppVisible { get; set; }
        }

        private static readonly FieldDefinition[] Fields =
        {
            new FieldDefinition
            {
                Name = "OcrEnabled", Label = "启用OCR识别", Type = "int", Component = "Switch",
                Sort = 13000, DefaultValue = "0", AppVisible = 0,
                Description = "默认关闭。开启后，当前租户可通过受认证的 /api/Ocr/Recognize 或 V8.OCR 调用服务端配置的 OCR 服务。"
            },
            new FieldDefinition
            {
                Name = "OcrProvider", Label = "OCR服务协议", Type = "varchar(50)", Component = "Select",
                Sort = 13010, DefaultValue = "PaddleX", AppVisible = 0,
                Data = "[{\"Key\":\"PaddleX\",\"Value\":\"PaddleX/PaddleOCR 基础服务\"},{\"Key\":\"PaddleXHighStability\",\"Value\":\"PaddleX 高稳定性服务\"}]",
                Config = SelectConfig,
                Description = "PaddleX 对应 POST /ocr；PaddleXHighStability 对应 /v2/models/ocr/infer 的 KServe 外层协议。"
            },
            new FieldDefinition
            {
                Name = "OcrEndpoint", Label = "OCR服务地址", Type = "mediumtext", Component = "Text",
                Sort = 13020, AppVisible = 0, Placeholder = "http://microi-ocr:8080/ocr",
                Description = "仅由后端读取的完整服务地址。允许管理员配置 Docker 内网/Sidecar 地址，API 与 V8 调用方不能覆盖。"
            },
            new FieldDefinition
            {
                Name = "OcrApiKey", Label = "OCR API密钥", Type = "mediumtext", Component = "Text",
                Sort = 13030, AppVisible = 0, Config = PasswordConfig,
                Description = "可选。若自定义请求头未提供 Authorization，则后端按 Bearer Token 发送；不会进入 V8.OsClientModel。"
            },
            new FieldDefinition
            {
                Name = "OcrHeadersJson", Label = "OCR自定义请求头", Type = "mediumtext", Component = "Textarea",
                Sort = 13040, AppVisible = 0, Config = TextareaConfig, FormWidth = 24,
                Placeholder = "{\"X-API-Key\":\"******\"}",
                Description = "可选 JSON 对象，最多20个请求头。Host、Content-Length 等逐跳/内容头会被拒绝；不会进入 V8.OsClientModel。"
            },
            new FieldDefinition
            {
                Name = "OcrTimeoutSeconds", Label = "OCR超时秒数", Type = "int", Component = "NumberText",
                Sort = 13050, DefaultValue = "60", AppVisible = 0,
                Description = "单次 OCR 上游调用超时，后端硬限制为 1-300 秒。"
            },
            new FieldDefinition
            {
                Name = "OcrMaxFileMB", Label = "OCR文件上限(MB)", Type = "int", Component = "NumberText",
                Sort = 13060, DefaultValue = "20", AppVisible = 0,
                Description = "Base64 解码后文件大小上限，后端绝对上限为 100 MB。"
            },
            new FieldDefinition
            {
                Name = "OcrMaxPages", Label = "OCR返回页数上限", Type = "int", Component = "NumberText",
                Sort = 13070, DefaultValue = "10", AppVisible = 0,
                Description = "后端接受的最大返回页数，范围 1-100。PaddleX 服务自身的 PDF/多页 TIFF 处理页数也应配置为相同或更小。"
            },
            new FieldDefinition
            {
                Name = "OcrMinConfidence", Label = "OCR最低置信度", Type = "decimal(18,4)", Component = "NumberText",
                Sort = 13080, DefaultValue = "0", AppVisible = 0,
                Config = "{\"NumberTextStep\":0.05,\"NumberTextPrecision\":4}",
                Description = "传给 PaddleX 的 textRecScoreThresh，范围 0-1；0 表示不额外过滤。调用方只能进一步提高阈值，不能降低租户配置的最低值。"
            }
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
                    messages.Add("租户数据库连接不存在，无法升级 OCR 配置。");
                    return messages;
                }

                var table = await GetTableAsync(osClient).ConfigureAwait(false);
                if (table == null)
                {
                    messages.Add("未找到 sys_osclients 元数据，无法升级 OCR 配置。");
                    return messages;
                }

                var tabs = ReconcileTabs(table.Value<string>("Tabs"), out var tabsChanged);
                if (tabsChanged)
                {
                    var updateTable = await UpgradeTrustedFormEngine.UpdateAsync(
                        "diy_table",
                        osClient,
                        new JObject
                        {
                            ["Id"] = table["Id"],
                            ["OsClient"] = osClient,
                            ["Tabs"] = tabs
                        }).ConfigureAwait(false);
                    if (updateTable.Code != 1)
                    {
                        messages.Add("新增 SaaS 引擎 OCR识别 Tab 失败：" + updateTable.Msg);
                        return messages;
                    }
                }

                foreach (var definition in Fields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    await EnsureFieldAsync(
                        messages,
                        osClient,
                        table.Value<string>("Id"),
                        definition).ConfigureAwait(false);
                    if (messages.Count > 0) return messages;
                }
            }
            catch (Exception ex)
            {
                messages.Add("升级 OCR 租户配置失败：" + ex.Message);
            }
            return messages;
        }

        public static string ReconcileTabs(string currentTabs, out bool changed)
        {
            JArray tabs;
            try
            {
                tabs = string.IsNullOrWhiteSpace(currentTabs) ? new JArray() : JArray.Parse(currentTabs);
            }
            catch (Exception)
            {
                throw new FormatException("sys_osclients.Tabs 不是有效 JSON，已停止写入以保护现有表单布局。");
            }

            var matches = tabs.OfType<JObject>()
                .Where(item => string.Equals(item.Value<string>("Id"), TabId, StringComparison.OrdinalIgnoreCase)
                               || string.Equals(item.Value<string>("Name"), TabName, StringComparison.Ordinal))
                .ToList();
            var tab = matches.FirstOrDefault();
            if (tab == null)
            {
                tab = new JObject();
                tabs.Add(tab);
            }
            foreach (var duplicate in matches.Skip(1)) duplicate.Remove();

            tab["Id"] = TabId;
            tab["Name"] = TabName;
            tab["Icon"] = "fas fa-file-alt";
            tab["Sort"] = 13;
            tab["Display"] = true;
            tab["_RawName"] = TabName;
            var reconciled = tabs.ToString(Newtonsoft.Json.Formatting.None);
            changed = !JsonEquivalent(currentTabs, reconciled);
            return reconciled;
        }

        /// <summary>
        /// diy_field.Tab stores the stable diy_table.Tabs item Id. Older OCR
        /// migration builds wrote the display name, which left the tab visible
        /// but its fields orphaned in the form designer/runtime.
        /// </summary>
        public static string ReconcileFieldTab(string currentTab, out bool changed)
        {
            changed = !string.Equals(currentTab, TabId, StringComparison.Ordinal);
            return TabId;
        }

        private static bool JsonEquivalent(string left, string right)
        {
            try
            {
                return JToken.DeepEquals(
                    string.IsNullOrWhiteSpace(left) ? new JArray() : JToken.Parse(left),
                    string.IsNullOrWhiteSpace(right) ? new JArray() : JToken.Parse(right));
            }
            catch
            {
                return false;
            }
        }

        private static async Task EnsureFieldAsync(
            List<string> messages,
            string osClient,
            string tableId,
            FieldDefinition definition)
        {
            var client = OsClientExtend.GetClient(osClient);
            var existing = await GetFieldAsync(osClient, tableId, definition.Name, true).ConfigureAwait(false);
            if (existing != null && existing.Value<int?>("IsDeleted") == 1)
            {
                var recover = await MicroiEngine.FormEngine.RecoverDiyField(new DiyFieldParam
                {
                    Id = existing.Value<string>("Id"),
                    Name = definition.Name,
                    Type = definition.Type,
                    TableId = tableId,
                    TableName = "sys_osclients",
                    OsClient = osClient
                }).ConfigureAwait(false);
                if (recover.Code != 1)
                {
                    messages.Add($"恢复 sys_osclients.{definition.Name} 失败：{recover.Msg}");
                    return;
                }
                existing = await GetFieldAsync(osClient, tableId, definition.Name, false).ConfigureAwait(false);
            }

            var fieldTab = ReconcileFieldTab(existing?.Value<string>("Tab"), out _);

            var physicalExists = client.Db.ColumnExists("sys_osclients", definition.Name);
            if (existing == null)
            {
                var add = await UpgradeTrustedFormEngine.AddFieldAsync(
                    osClient,
                    new DiyFieldParam
                {
                    TableId = tableId,
                    TableName = "sys_osclients",
                    Name = definition.Name,
                    Label = definition.Label,
                    Type = definition.Type,
                    Component = definition.Component,
                    Sort = definition.Sort,
                    DefaultValue = definition.DefaultValue,
                    Description = definition.Description,
                    Placeholder = definition.Placeholder,
                    Data = definition.Data,
                    Config = definition.Config,
                    FormWidth = definition.FormWidth,
                    Tab = fieldTab,
                    Visible = 1,
                    AppVisible = definition.AppVisible,
                    Readonly = 0,
                    NotEmpty = 0,
                    TableWidth = 160,
                    IsLockField = 0,
                    NameConfirm = 1,
                    Unique = 0,
                    _NotAddDbField = physicalExists
                }).ConfigureAwait(false);
                if (add.Code != 1)
                {
                    existing = await GetFieldAsync(osClient, tableId, definition.Name, false).ConfigureAwait(false);
                    if (existing == null)
                    {
                        messages.Add($"新增 sys_osclients.{definition.Name} 失败：{add.Msg}");
                        return;
                    }
                }
                else
                {
                    existing = await GetFieldAsync(osClient, tableId, definition.Name, false).ConfigureAwait(false);
                }
            }

            if (!client.Db.ColumnExists("sys_osclients", definition.Name))
            {
                var addPhysical = await UpgradeTrustedFormEngine.AddDbFieldAsync(
                    osClient,
                    new DiyFieldParam
                {
                    TableId = tableId,
                    TableName = "sys_osclients",
                    Name = definition.Name,
                    Type = definition.Type
                }).ConfigureAwait(false);
                if (addPhysical.Code != 1 && !client.Db.ColumnExists("sys_osclients", definition.Name))
                {
                    messages.Add($"新增 sys_osclients.{definition.Name} 物理字段失败：{addPhysical.Msg}");
                    return;
                }
            }

            if (existing == null)
            {
                messages.Add($"sys_osclients.{definition.Name} 新增后无法回读字段元数据。");
                return;
            }

            var patch = new JObject
            {
                ["Id"] = existing["Id"],
                ["TableId"] = tableId,
                ["TableName"] = "sys_osclients",
                ["Name"] = definition.Name,
                ["Label"] = definition.Label,
                ["Type"] = definition.Type,
                ["Component"] = definition.Component,
                ["Sort"] = definition.Sort,
                ["DefaultValue"] = definition.DefaultValue ?? "",
                ["Description"] = definition.Description ?? "",
                ["Placeholder"] = definition.Placeholder ?? "",
                ["Data"] = definition.Data ?? "[]",
                ["Config"] = definition.Config ?? "{}",
                ["FormWidth"] = definition.FormWidth.HasValue ? (JToken)definition.FormWidth.Value : JValue.CreateNull(),
                ["Tab"] = fieldTab,
                ["Visible"] = 1,
                ["AppVisible"] = definition.AppVisible,
                ["Readonly"] = 0,
                ["NotEmpty"] = 0,
                ["TableWidth"] = 160,
                ["NameConfirm"] = 1,
                ["IsDeleted"] = 0
            };
            var update = await UpgradeTrustedFormEngine.UpdateAsync(
                "diy_field", osClient, patch).ConfigureAwait(false);
            if (update.Code != 1)
                messages.Add($"更新 sys_osclients.{definition.Name} 元数据失败：{update.Msg}");
        }

        private static async Task<JObject> GetTableAsync(string osClient)
        {
            var result = await MicroiEngine.FormEngine.GetFormDataAsync(
                "diy_table",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object> { new List<object> { "Name", "=", "sys_osclients" } },
                    _SelectFields = new[] { "Id", "Name", "Tabs" }
                }).ConfigureAwait(false);
            return result.Code == 1 && result.Data != null
                ? JObject.FromObject((object)result.Data)
                : null;
        }

        private static async Task<JObject> GetFieldAsync(
            string osClient,
            string tableId,
            string fieldName,
            bool includeDeleted)
        {
            var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>(
                "diy_field",
                new
                {
                    OsClient = osClient,
                    _IsContainDeleted = includeDeleted,
                    _Where = new List<object>
                    {
                        new List<object> { "TableId", "=", tableId },
                        new List<object> { "Name", "=", fieldName }
                    },
                    _SelectFields = new[] { "Id", "Name", "Tab", "IsDeleted" },
                    _PageIndex = 1,
                    _PageSize = 10
                }).ConfigureAwait(false);
            if (result.Code != 1 || result.Data == null) return null;
            var rows = JArray.FromObject((object)result.Data).OfType<JObject>().ToList();
            return rows.FirstOrDefault(row => row.Value<int?>("IsDeleted") != 1)
                   ?? rows.FirstOrDefault();
        }
    }
}
