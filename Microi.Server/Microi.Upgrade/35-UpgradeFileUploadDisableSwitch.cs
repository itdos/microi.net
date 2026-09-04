using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 将容易误解的正向 FileUploadEnabled 切换为负向 DisableFileUpload。
    /// 新字段可空且空值等同 0（允许上传）；旧字段只保留给滚动升级中的旧节点，
    /// 不把历史 0 回填为关闭，避免旧默认值继续让子租户意外失去上传能力。
    /// </summary>
    public sealed class Upgrade35
    {
        public static string Version = "6.9.9.1";
        public const string NewFieldName = "DisableFileUpload";
        public const string LegacyFieldName = "FileUploadEnabled";

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add("租户数据库连接不存在，无法升级文件上传开关。");
                    return messages;
                }

                var tableResult = await MicroiEngine.FormEngine.GetFormDataAsync(
                    "diy_table",
                    new
                    {
                        OsClient = osClient,
                        _Where = new List<object>
                        {
                            new List<object> { "Name", "=", "sys_osclients" }
                        },
                        _SelectFields = new[] { "Id", "Name" }
                    }).ConfigureAwait(false);
                if (tableResult.Code != 1 || tableResult.Data == null)
                {
                    messages.Add("未找到 sys_osclients 元数据，无法升级文件上传开关。");
                    return messages;
                }

                var tableId = Convert.ToString(tableResult.Data.Id);
                await EnsureDisableFieldAsync(messages, osClient, tableId, client)
                    .ConfigureAwait(false);
                if (messages.Count > 0) return messages;

                await HideLegacyFieldAsync(messages, osClient, tableId)
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                messages.Add("升级文件上传负向开关失败：" + ex.Message);
            }
            return messages;
        }

        private static async Task EnsureDisableFieldAsync(
            List<string> messages,
            string osClient,
            string tableId,
            OsClientSecret client)
        {
            var existing = await GetFieldAsync(
                osClient, tableId, NewFieldName, true).ConfigureAwait(false);
            if (existing != null && existing.Value<int?>("IsDeleted") == 1)
            {
                var recover = await MicroiEngine.FormEngine.RecoverDiyField(
                    new DiyFieldParam
                    {
                        Id = existing.Value<string>("Id"),
                        Name = NewFieldName,
                        Type = "int",
                        TableId = tableId,
                        TableName = "sys_osclients",
                        OsClient = osClient
                    }).ConfigureAwait(false);
                if (recover.Code != 1)
                {
                    messages.Add($"恢复 sys_osclients.{NewFieldName} 失败：{recover.Msg}");
                    return;
                }
                existing = await GetFieldAsync(
                    osClient, tableId, NewFieldName, false).ConfigureAwait(false);
            }

            var physicalExists = client.Db.ColumnExists("sys_osclients", NewFieldName);
            if (existing == null)
            {
                var add = await UpgradeTrustedFormEngine.AddFieldAsync(
                    osClient,
                    new DiyFieldParam
                    {
                        TableId = tableId,
                        TableName = "sys_osclients",
                        Name = NewFieldName,
                        Label = "关闭文件上传",
                        Type = "int",
                        Component = "Switch",
                        Sort = 13100,
                        DefaultValue = "",
                        Description = "默认关闭此开关，即允许上传。只有打开本开关时，才禁止当前租户的交互式文件上传。",
                        Visible = 1,
                        AppVisible = 1,
                        Readonly = 0,
                        NotEmpty = 0,
                        TableWidth = 170,
                        IsLockField = 0,
                        NameConfirm = 1,
                        Unique = 0,
                        _NotAddDbField = physicalExists
                    }).ConfigureAwait(false);
                if (add.Code != 1)
                {
                    existing = await GetFieldAsync(
                        osClient, tableId, NewFieldName, false).ConfigureAwait(false);
                    if (existing == null)
                    {
                        messages.Add($"新增 sys_osclients.{NewFieldName} 失败：{add.Msg}");
                        return;
                    }
                }
                else
                {
                    existing = await GetFieldAsync(
                        osClient, tableId, NewFieldName, false).ConfigureAwait(false);
                }
            }

            if (!client.Db.ColumnExists("sys_osclients", NewFieldName))
            {
                var addPhysical = await UpgradeTrustedFormEngine.AddDbFieldAsync(
                    osClient,
                    new DiyFieldParam
                    {
                        TableId = tableId,
                        TableName = "sys_osclients",
                        Name = NewFieldName,
                        Type = "int"
                    }).ConfigureAwait(false);
                if (addPhysical.Code != 1
                    && !client.Db.ColumnExists("sys_osclients", NewFieldName))
                {
                    messages.Add($"新增 sys_osclients.{NewFieldName} 物理字段失败：{addPhysical.Msg}");
                    return;
                }
            }

            if (existing == null)
            {
                messages.Add($"sys_osclients.{NewFieldName} 新增后无法回读字段元数据。");
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
                    ["Name"] = NewFieldName,
                    ["Label"] = "关闭文件上传",
                    ["Type"] = "int",
                    ["Component"] = "Switch",
                    ["Sort"] = 13100,
                    ["DefaultValue"] = "",
                    ["Description"] = "默认关闭此开关，即允许上传。只有打开本开关时，才禁止当前租户的交互式文件上传。",
                    ["Visible"] = 1,
                    ["AppVisible"] = 1,
                    ["Readonly"] = 0,
                    ["NotEmpty"] = 0,
                    ["TableWidth"] = 170,
                    ["NameConfirm"] = 1,
                    ["IsDeleted"] = 0
                }).ConfigureAwait(false);
            if (update.Code != 1)
                messages.Add($"更新 sys_osclients.{NewFieldName} 元数据失败：{update.Msg}");
        }

        private static async Task HideLegacyFieldAsync(
            List<string> messages,
            string osClient,
            string tableId)
        {
            var legacy = await GetFieldAsync(
                osClient, tableId, LegacyFieldName, false).ConfigureAwait(false);
            if (legacy == null) return;

            var update = await UpgradeTrustedFormEngine.UpdateAsync(
                "diy_field",
                osClient,
                new JObject
                {
                    ["Id"] = legacy["Id"],
                    ["TableId"] = tableId,
                    ["TableName"] = "sys_osclients",
                    ["Name"] = LegacyFieldName,
                    ["Label"] = "启用文件上传（旧版兼容）",
                    ["Description"] = "旧版兼容字段，已由“关闭文件上传”(DisableFileUpload)替代；新版管理界面不再显示。",
                    ["Visible"] = 0,
                    ["AppVisible"] = 0,
                    ["Readonly"] = 1,
                    ["IsDeleted"] = 0
                }).ConfigureAwait(false);
            if (update.Code != 1)
                messages.Add($"隐藏旧字段 sys_osclients.{LegacyFieldName} 失败：{update.Msg}");
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
            return rows.FirstOrDefault(row => row.Value<int?>("IsDeleted") != 1)
                   ?? rows.FirstOrDefault();
        }
    }
}
