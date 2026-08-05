using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 将 API 的非启动参数集中迁移到 SaaS 引擎独立 Tab。迁移只做扩展并可幂等重跑；
    /// 多节点同时启动时仍由共享升级租约串行执行。
    /// </summary>
    public sealed class Upgrade30
    {
        public static string Version = "6.9.8.5";
        public const string TabId = "aab748f2-870a-4d2c-9fe8-4c34c86c70c1";
        public const string TabName = "后端运行配置";

        private const string PasswordConfig =
            "{\"TextShowPassword\":true,\"TextAutocomplete\":false}";
        private const string TextareaConfig =
            "{\"Textarea\":{\"DefaultRows\":6}}";

        private static readonly string[] ObsoleteLicenseFields =
        {
            "BackendLicenseRetryMax",
            "BackendLicenseRetrySec",
            "BackendLicensePrivateKeyPath",
            "BackendLicenseRestoreMaxAttempts",
            "BackendLicenseRestoreRetrySeconds"
        };

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
            public string Config { get; set; }
            public int? FormWidth { get; set; }
        }

        private static readonly FieldDefinition[] Fields =
        {
            Switch("BackendAutoUpgradeDisabled", "禁用后端自动升级", "0", 14000,
                "仅主租户有效。通常保持关闭；开启后下次 API 启动不再执行平台结构升级。"),
            Text("BackendAuthSecretRotateVer", "JWT密钥目标轮换版本", "", 14030,
                "填写新的唯一版本值会请求当前租户轮换 AuthSecret；成功后写入 AuthSecretRotateVersion。普通发布必须留空，避免全部 Token 意外失效。"),
            Switch("BackendAuthSecretRotateOff", "禁用JWT密钥版本轮换", "0", 14040,
                "当前租户设置。开启后忽略目标轮换版本；弱密钥的安全修复仍会执行。"),
            Text("BackendFreeCadExecutablePath", "FreeCAD可执行文件路径", "", 14050,
                "仅主租户有效。可选绝对路径；留空时自动查找 freecadcmd / FreeCADCmd 及常见安装目录。"),
            Textarea("BackendForwardedKnownProxies", "可信反向代理IP", "", 14060,
                "仅主租户有效。只填写直接连接 Kestrel 的精确代理 IP，逗号或换行分隔；变更后滚动重启 API 节点生效。"),
            Textarea("BackendForwardedKnownNetworks", "可信反向代理网段", "", 14070,
                "仅主租户有效。填写受控代理 CIDR，逗号或换行分隔；禁止 0.0.0.0/0、::/0，变更后滚动重启 API 节点生效。"),
            Secret("BackendLoginRsaPrivateKey", "登录RSA私钥", "", 14080,
                "仅主租户后端读取，不进入 V8.OsClientModel。必须与登录 RSA 公钥成对配置；留空使用历史兼容密钥。"),
            Textarea("BackendLoginRsaPublicKey", "登录RSA公钥", "", 14090,
                "仅主租户有效。可由匿名 GetSysConfig 返回给登录前端；必须与私钥成对配置，登录仍必须使用 HTTPS。")
        };

        public static IReadOnlyList<string> RuntimeFieldNames =>
            Fields.Select(field => field.Name).ToArray();

        public static IReadOnlyList<string> ObsoleteLicenseFieldNames =>
            ObsoleteLicenseFields;

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add("租户数据库连接不存在，无法升级后端运行配置。");
                    return messages;
                }

                var table = await GetTableAsync(osClient).ConfigureAwait(false);
                if (table == null)
                {
                    messages.Add("未找到 sys_osclients 元数据，无法升级后端运行配置。");
                    return messages;
                }

                await RemoveObsoleteLicenseFieldsAsync(
                        messages,
                        osClient,
                        table.Value<string>("Id"))
                    .ConfigureAwait(false);
                if (messages.Count > 0) return messages;

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
                        messages.Add("新增 SaaS 引擎后端运行配置 Tab 失败：" + updateTable.Msg);
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
                messages.Add("升级 SaaS 后端运行配置失败：" + ex.Message);
            }
            return messages;
        }

        private static async Task RemoveObsoleteLicenseFieldsAsync(
            List<string> messages,
            string osClient,
            string tableId)
        {
            var client = OsClientExtend.GetClient(osClient);
            foreach (var fieldName in ObsoleteLicenseFields)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                if (client.Db.ColumnExists("sys_osclients", fieldName))
                {
                    DropSqlServerDefaultConstraintIfPresent(client.Db, "sys_osclients", fieldName);
                    client.Db.FromSql(BuildDropColumnSql(
                            client.Db.Db.DbProvider.DatabaseType,
                            "sys_osclients",
                            fieldName))
                        .ExecuteNonQuery();
                    if (client.Db.ColumnExists("sys_osclients", fieldName))
                    {
                        messages.Add($"物理删除 sys_osclients.{fieldName} 后回读仍存在。");
                        return;
                    }
                }

                client.Db.Delete<DiyField>(field =>
                    field.TableId == tableId && field.Name == fieldName);

                var metadataCount = client.Db.From<DiyField>()
                    .Where(field => field.TableId == tableId && field.Name == fieldName)
                    .Count();
                if (metadataCount != 0)
                {
                    messages.Add($"硬删除 diy_field 元数据 {fieldName} 后回读仍存在 {metadataCount} 条。");
                    return;
                }
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            foreach (var key in new[]
            {
                $"Microi:{osClient}:FormData:diy_table:{tableId.ToLowerInvariant()}",
                $"Microi:{osClient}:FormData:diy_table:sys_osclients",
                $"Microi:{osClient}:FormData:diy_table_field_list:{tableId.ToLowerInvariant()}",
                $"Microi:{osClient}:FormData:diy_table_field_list:sys_osclients"
            })
            {
                await cache.RemoveAsync(key).ConfigureAwait(false);
            }
        }

        public static string BuildDropColumnSql(
            DatabaseType databaseType,
            string tableName,
            string fieldName)
        {
            ValidateIdentifier(tableName, nameof(tableName));
            ValidateIdentifier(fieldName, nameof(fieldName));
            switch (databaseType)
            {
                case DatabaseType.MySql:
                    return $"ALTER TABLE `{tableName}` DROP COLUMN `{fieldName}`";
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                    return $"ALTER TABLE [{tableName}] DROP COLUMN [{fieldName}]";
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase:
                    return $"ALTER TABLE \"{tableName}\" DROP COLUMN \"{fieldName}\"";
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng:
                    return $"ALTER TABLE {tableName} DROP COLUMN {fieldName}";
                case DatabaseType.Sqlite3:
                    return $"ALTER TABLE [{tableName}] DROP COLUMN [{fieldName}]";
                default:
                    throw new NotSupportedException(
                        "物理删除字段不支持数据库类型：" + databaseType);
            }
        }

        private static void DropSqlServerDefaultConstraintIfPresent(
            DbSession db,
            string tableName,
            string fieldName)
        {
            var databaseType = db.Db.DbProvider.DatabaseType;
            if (databaseType != DatabaseType.SqlServer
                && databaseType != DatabaseType.SqlServer9)
            {
                return;
            }

            var constraintName = db.FromSql(@"SELECT dc.name
FROM sys.default_constraints dc
INNER JOIN sys.columns c
    ON c.object_id = dc.parent_object_id
   AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID(@p0, 'U') AND c.name = @p1")
                .AddInParameter("p0", tableName)
                .AddInParameter("p1", fieldName)
                .ToScalar<string>();
            if (string.IsNullOrWhiteSpace(constraintName)) return;

            ValidateIdentifier(constraintName, nameof(constraintName));
            db.FromSql($"ALTER TABLE [{tableName}] DROP CONSTRAINT [{constraintName}]")
                .ExecuteNonQuery();
        }

        private static void ValidateIdentifier(string value, string parameterName)
        {
            if (string.IsNullOrWhiteSpace(value)
                || !(char.IsLetter(value[0]) || value[0] == '_')
                || value.Any(character => !(char.IsLetterOrDigit(character) || character == '_')))
            {
                throw new ArgumentException("数据库标识符不合法。", parameterName);
            }
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
            tab["Icon"] = "fas fa-server";
            tab["Sort"] = 14;
            tab["Display"] = true;
            tab["_RawName"] = TabName;
            var reconciled = tabs.ToString(Newtonsoft.Json.Formatting.None);
            changed = !JsonEquivalent(currentTabs, reconciled);
            return reconciled;
        }

        /// <summary>
        /// diy_field.Tab must reference the stable Tabs item Id. Keeping this
        /// normalization in the idempotent upgrade also repairs fields created
        /// by early builds that used the Chinese display name.
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
                    Config = definition.Config,
                    FormWidth = definition.FormWidth,
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
                ["Data"] = "[]",
                ["Config"] = definition.Config ?? "{}",
                ["FormWidth"] = definition.FormWidth.HasValue ? (JToken)definition.FormWidth.Value : JValue.CreateNull(),
                ["Tab"] = fieldTab,
                ["Visible"] = 1,
                ["AppVisible"] = 0,
                ["Readonly"] = 0,
                ["NotEmpty"] = 0,
                ["TableWidth"] = 180,
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

        private static FieldDefinition Switch(
            string name, string label, string defaultValue, int sort, string description) =>
            new FieldDefinition
            {
                Name = name, Label = label, Type = "int", Component = "Switch",
                DefaultValue = defaultValue, Sort = sort, Description = description
            };

        private static FieldDefinition Text(
            string name, string label, string defaultValue, int sort, string description) =>
            new FieldDefinition
            {
                Name = name, Label = label, Type = "mediumtext", Component = "Text",
                DefaultValue = defaultValue, Sort = sort, Description = description
            };

        private static FieldDefinition Textarea(
            string name, string label, string defaultValue, int sort, string description) =>
            new FieldDefinition
            {
                Name = name, Label = label, Type = "mediumtext", Component = "Textarea",
                DefaultValue = defaultValue, Sort = sort, Description = description,
                Config = TextareaConfig, FormWidth = 24
            };

        private static FieldDefinition Secret(
            string name, string label, string defaultValue, int sort, string description) =>
            new FieldDefinition
            {
                Name = name, Label = label, Type = "mediumtext", Component = "Text",
                DefaultValue = defaultValue, Sort = sort, Description = description,
                Config = PasswordConfig, FormWidth = 24
            };
    }
}
