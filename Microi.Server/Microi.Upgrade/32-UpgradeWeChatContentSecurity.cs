using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net;

// zhy：幂等创建微信小程序内容安全租户配置，兼容多节点在共享升级租约内重复执行。
/// <summary>
/// Adds tenant-owned WeChat Mini Program credentials used by the backend content
/// security API and callback verifier. The migration is expand-only and idempotent.
/// </summary>
public sealed class Upgrade32
{
    public static string Version = "6.9.8.7";
    public const string TabId = "01KZZWXCS00000000000000001";
    public const string TabName = "微信小程序";

    private const string PasswordConfig =
        "{\"TextShowPassword\":true,\"TextAutocomplete\":false}";

    private sealed class FieldDefinition
    {
        public string Name { get; set; }
        public string Label { get; set; }
        public int Sort { get; set; }
        public string Description { get; set; }
        public string Config { get; set; }
    }

    private static readonly FieldDefinition[] Fields =
    {
        new()
        {
            Name = "WeChatMiniProgramAppId",
            Label = "微信小程序 AppId",
            Sort = 16000,
            Description = "当前租户小程序 AppId，用于服务端登录态换取与内容安全 API；不得配置为公众号 AppId。",
            Config = "{}"
        },
        new()
        {
            Name = "WeChatMiniProgramAppSecret",
            Label = "微信小程序 AppSecret",
            Sort = 16010,
            Description = "当前租户小程序 AppSecret，仅供后端调用微信内容安全 API，禁止下发前端或写入日志。",
            Config = PasswordConfig
        },
        new()
        {
            Name = "WeChatMiniProgramMessageToken",
            Label = "小程序消息推送 Token",
            Sort = 16020,
            Description = "微信公众平台小程序消息推送配置中的 Token，用于校验 mediaCheckAsync 回调签名。",
            Config = PasswordConfig
        },
        new()
        {
            Name = "WeChatMiniProgramEncodingAESKey",
            Label = "小程序消息 EncodingAESKey",
            Sort = 16030,
            Description = "可选。小程序消息推送选择兼容或安全模式时填写，用于解密回调消息。",
            Config = PasswordConfig
        }
    };

    public static IReadOnlyList<string> FieldNames => Fields.Select(field => field.Name).ToArray();

    public async Task<List<string>> Run(string osClient)
    {
        var messages = new List<string>();
        try
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            var client = OsClientExtend.GetClient(osClient);
            if (client?.Db == null)
            {
                messages.Add("租户数据库连接不存在，无法升级微信小程序内容安全配置。");
                return messages;
            }

            var table = await GetTableAsync(osClient).ConfigureAwait(false);
            if (table == null)
            {
                messages.Add("未找到 sys_osclients 元数据，无法升级微信小程序内容安全配置。");
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
                    messages.Add("新增微信小程序配置 Tab 失败：" + update.Msg);
                    return messages;
                }
            }

            foreach (var field in Fields)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                await EnsureFieldAsync(messages, osClient, table.Value<string>("Id"), field)
                    .ConfigureAwait(false);
                if (messages.Count > 0) return messages;
            }
        }
        catch (Exception ex)
        {
            messages.Add("升级微信小程序内容安全配置失败：" + ex.Message);
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
        catch
        {
            throw new FormatException("sys_osclients.Tabs 不是有效 JSON，已停止写入以保护现有表单布局。");
        }

        var matches = tabs.OfType<JObject>()
            .Where(item => string.Equals(item.Value<string>("Id"), TabId, StringComparison.OrdinalIgnoreCase)
                           || string.Equals(item.Value<string>("Name"), TabName, StringComparison.Ordinal))
            .ToList();
        var tab = matches.FirstOrDefault() ?? new JObject();
        if (matches.Count == 0) tabs.Add(tab);
        foreach (var duplicate in matches.Skip(1)) duplicate.Remove();
        tab["Id"] = TabId;
        tab["Name"] = TabName;
        tab["Icon"] = "fab fa-weixin";
        tab["Sort"] = 16;
        tab["Display"] = true;
        tab["_RawName"] = TabName;
        var reconciled = tabs.ToString(Newtonsoft.Json.Formatting.None);
        changed = !JsonEquivalent(currentTabs, reconciled);
        return reconciled;
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
                Type = "mediumtext",
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

        var physicalExists = client.Db.ColumnExists("sys_osclients", definition.Name);
        if (existing == null)
        {
            var add = await UpgradeTrustedFormEngine.AddFieldAsync(osClient, new DiyFieldParam
            {
                TableId = tableId,
                TableName = "sys_osclients",
                Name = definition.Name,
                Label = definition.Label,
                Type = "mediumtext",
                Component = "Text",
                Sort = definition.Sort,
                DefaultValue = "",
                Description = definition.Description,
                Config = definition.Config,
                Tab = TabId,
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
            var addPhysical = await UpgradeTrustedFormEngine.AddDbFieldAsync(osClient, new DiyFieldParam
            {
                TableId = tableId,
                TableName = "sys_osclients",
                Name = definition.Name,
                Type = "mediumtext"
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

        var update = await UpgradeTrustedFormEngine.UpdateAsync(
            "diy_field",
            osClient,
            new JObject
            {
                ["Id"] = existing["Id"],
                ["TableId"] = tableId,
                ["TableName"] = "sys_osclients",
                ["Name"] = definition.Name,
                ["Label"] = definition.Label,
                ["Type"] = "mediumtext",
                ["Component"] = "Text",
                ["Sort"] = definition.Sort,
                ["DefaultValue"] = "",
                ["Description"] = definition.Description,
                ["Config"] = definition.Config,
                ["Tab"] = TabId,
                ["Visible"] = 1,
                ["AppVisible"] = 0,
                ["Readonly"] = 0,
                ["NotEmpty"] = 0,
                ["TableWidth"] = 180,
                ["NameConfirm"] = 1,
                ["IsDeleted"] = 0
            }).ConfigureAwait(false);
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
        return result.Code == 1 && result.Data != null ? JObject.FromObject((object)result.Data) : null;
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
                _SelectFields = new[] { "Id", "Name", "IsDeleted" },
                _PageIndex = 1,
                _PageSize = 10
            }).ConfigureAwait(false);
        if (result.Code != 1 || result.Data == null) return null;
        var rows = JArray.FromObject((object)result.Data).OfType<JObject>().ToList();
        return rows.FirstOrDefault(row => row.Value<int?>("IsDeleted") != 1) ?? rows.FirstOrDefault();
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
}
