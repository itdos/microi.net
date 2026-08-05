using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Reconciles the SaaS translation tab and both the current and legacy
    /// provider fields. The migration is expand-only and safe to rerun while
    /// the shared upgrade lease is held.
    /// </summary>
    public sealed class Upgrade31
    {
        public static string Version = "6.9.8.6";
        public const string TabId = "01KM6TN6CVNYTMKHSX9DKR4HF2";
        public const string TabName = "翻译引擎";

        private const string SelectConfig =
            "{\"DataSource\":\"KeyValue\",\"SelectLabel\":\"Value\",\"SelectSaveField\":\"Key\",\"SelectSaveFormat\":\"Text\",\"EnableSearch\":false,\"DataSourceSqlRemote\":false}";
        private const string PasswordConfig =
            "{\"TextShowPassword\":true,\"TextAutocomplete\":false}";

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
        }

        private static readonly FieldDefinition[] Fields =
        {
            new FieldDefinition
            {
                Name = "TranslateProvider", Label = "翻译服务类型", Type = "mediumtext", Component = "Select",
                Sort = 15000, DefaultValue = "None", Config = SelectConfig,
                Data = "[{\"Key\":\"None\",\"Value\":\"关闭动态翻译\"},{\"Key\":\"LibreTranslate\",\"Value\":\"LibreTranslate 自托管\"},{\"Key\":\"Aliyun\",\"Value\":\"阿里云翻译\"},{\"Key\":\"Http\",\"Value\":\"兼容 LibreTranslate 的 HTTP 服务\"}]",
                Description = "动态内容翻译供应商。固定界面文案仍应优先维护 diy_lang 词条。"
            },
            new FieldDefinition
            {
                Name = "TranslateUrl", Label = "翻译服务地址", Type = "mediumtext", Component = "Text",
                Sort = 15010, Placeholder = "http://microi-install-libretranslate:5000",
                Description = "LibreTranslate/HTTP 服务的基础地址；后端会自动追加 /translate。"
            },
            new FieldDefinition
            {
                Name = "TranslateApiKey", Label = "翻译服务 API Key", Type = "mediumtext", Component = "Text",
                Sort = 15020, Config = PasswordConfig,
                Description = "仅供后端调用翻译服务，不进入 V8.OsClientModel、前端配置或日志。"
            },
            new FieldDefinition
            {
                Name = "TranslateTimeout", Label = "翻译超时秒数", Type = "int", Component = "NumberText",
                Sort = 15030, DefaultValue = "120", Config = "{\"NumberTextStep\":1,\"NumberTextPrecision\":0}",
                Description = "单次动态翻译调用超时；一键安装 LibreTranslate 时默认 120 秒。"
            },
            new FieldDefinition
            {
                Name = "TranslateEndpoint", Label = "阿里云翻译 Endpoint", Type = "mediumtext", Component = "Text",
                Sort = 15040, Placeholder = "mt.cn-hangzhou.aliyuncs.com",
                Description = "兼容历史阿里云翻译配置；使用 LibreTranslate 时留空。"
            },
            new FieldDefinition
            {
                Name = "TranslateKey", Label = "阿里云翻译 AccessKey", Type = "mediumtext", Component = "Text",
                Sort = 15050, Config = PasswordConfig,
                Description = "兼容历史阿里云翻译配置；仅由后端读取。"
            },
            new FieldDefinition
            {
                Name = "TranslateSecret", Label = "阿里云翻译 Secret", Type = "mediumtext", Component = "Text",
                Sort = 15060, Config = PasswordConfig,
                Description = "兼容历史阿里云翻译配置；仅由后端读取。"
            }
        };

        public static IReadOnlyList<string> FieldNames =>
            Fields.Select(field => field.Name).ToArray();

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add("租户数据库连接不存在，无法升级翻译引擎配置。");
                    return messages;
                }

                var table = await GetTableAsync(osClient).ConfigureAwait(false);
                if (table == null)
                {
                    messages.Add("未找到 sys_osclients 元数据，无法升级翻译引擎配置。");
                    return messages;
                }

                var tabs = ReconcileTabs(table.Value<string>("Tabs"), out var tabsChanged);
                if (tabsChanged)
                {
                    var update = await UpgradeTrustedFormEngine.UpdateAsync(
                        "diy_table",
                        osClient,
                        new JObject
                        {
                            ["Id"] = table["Id"],
                            ["OsClient"] = osClient,
                            ["Tabs"] = tabs
                        }).ConfigureAwait(false);
                    if (update.Code != 1)
                    {
                        messages.Add("新增 SaaS 引擎翻译引擎 Tab 失败：" + update.Msg);
                        return messages;
                    }
                }

                foreach (var definition in Fields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    await EnsureFieldAsync(messages, osClient, table.Value<string>("Id"), definition)
                        .ConfigureAwait(false);
                    if (messages.Count > 0) return messages;
                }
            }
            catch (Exception ex)
            {
                messages.Add("升级翻译引擎租户配置失败：" + ex.Message);
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
            tab["Icon"] = "fas fa-language";
            tab["Sort"] = 15;
            tab["Display"] = true;
            tab["_RawName"] = TabName;
            var reconciled = tabs.ToString(Newtonsoft.Json.Formatting.None);
            changed = !JsonEquivalent(currentTabs, reconciled);
            return reconciled;
        }

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
                    Tab = fieldTab,
                    Visible = 1,
                    AppVisible = 0,
                    Readonly = 0,
                    NotEmpty = 0,
                    TableWidth = 180,
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
                ["Tab"] = fieldTab,
                ["Visible"] = 1,
                ["AppVisible"] = 0,
                ["Readonly"] = 0,
                ["NotEmpty"] = 0,
                ["TableWidth"] = 180,
                ["NameConfirm"] = 1,
                ["IsDeleted"] = 0
            };
            var update = await UpgradeTrustedFormEngine.UpdateAsync("diy_field", osClient, patch)
                .ConfigureAwait(false);
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
