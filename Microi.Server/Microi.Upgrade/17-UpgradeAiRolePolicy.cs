using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// 创建租户级 AI 角色数据访问策略表。
    /// 该表属于平台安全控制面，不创建普通业务菜单，也不授予普通角色直连权限。
    /// </summary>
    public class Upgrade17
    {
        // 6.5.7 的第 3 个正式迁移修订，保持迁移链全局单调递增。
        public static string Version = "6.5.7.3";

        private const string TableName = "mci_ai_role_policy";

        private static readonly IReadOnlyList<AiRolePolicyField> Fields =
            new List<AiRolePolicyField>
            {
                new AiRolePolicyField
                {
                    Name = "RoleId",
                    Label = "角色Id",
                    Type = "varchar(50)",
                    Component = "Text",
                    NotEmpty = 1,
                    Sort = 10,
                    TableWidth = 220,
                    Description = "sys_role.Id；一个角色只应维护一条生效策略。"
                },
                new AiRolePolicyField
                {
                    Name = "RoleName",
                    Label = "角色名称",
                    Type = "varchar(200)",
                    Component = "Text",
                    Sort = 20,
                    TableWidth = 160,
                    Description = "角色名称快照，仅用于管理界面展示，授权判断以 RoleId 为准。"
                },
                new AiRolePolicyField
                {
                    Name = "Enabled",
                    Label = "启用策略",
                    Type = "int",
                    Component = "Switch",
                    DefaultValue = "0",
                    Sort = 30,
                    TableWidth = 100,
                    Description = "默认关闭；只有明确启用的策略才允许普通角色使用 NL2SQL。"
                },
                new AiRolePolicyField
                {
                    Name = "DataScope",
                    Label = "数据范围",
                    Type = "varchar(50)",
                    Component = "Select",
                    Data = "all|全部授权业务表",
                    DefaultValue = "all",
                    Sort = 40,
                    TableWidth = 150,
                    Description = "当前仅支持 all；最终可访问表仍由服务端菜单/表级读取权限取交集。"
                },
                new AiRolePolicyField
                {
                    Name = "AllowedDomains",
                    Label = "允许的数据表",
                    Type = "mediumtext",
                    Component = "Textarea",
                    Sort = 50,
                    FormWidth = 24,
                    Description = "兼容历史字段名；保存当前租户 diy_table.Name 的 JSON 数组，不是业务域别名。"
                },
                new AiRolePolicyField
                {
                    Name = "AllowedModels",
                    Label = "允许的模型",
                    Type = "mediumtext",
                    Component = "Textarea",
                    Sort = 60,
                    FormWidth = 24,
                    Description = "允许调用的 mic_ai.Id JSON 数组；空数组表示不额外按模型收紧。"
                },
                new AiRolePolicyField
                {
                    Name = "MaxRows",
                    Label = "最大返回行数",
                    Type = "int",
                    Component = "NumberText",
                    DefaultValue = "100",
                    Sort = 70,
                    TableWidth = 140,
                    Description = "服务端执行 SQL 前强制使用的返回行数上限。"
                },
                new AiRolePolicyField
                {
                    Name = "AllowRawSql",
                    Label = "允许 NL2SQL",
                    Type = "int",
                    Component = "Switch",
                    DefaultValue = "0",
                    Sort = 80,
                    TableWidth = 120,
                    Description = "默认关闭；开启后仍必须通过服务端表权限、只读 SQL 与行数限制校验。"
                },
                new AiRolePolicyField
                {
                    Name = "Remark",
                    Label = "备注",
                    Type = "mediumtext",
                    Component = "Textarea",
                    Sort = 90,
                    FormWidth = 24,
                    Description = "记录授权原因、审批单号或复核说明。"
                }
            };

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var tableResult = await GetTableAsync(osClient);
                if (tableResult.Code != 1 || tableResult.Data == null)
                {
                    var client = OsClient.GetClient(osClient);
                    if (client?.Db == null)
                    {
                        messages.Add($"创建 {TableName} 失败：租户数据库连接不存在。");
                        return messages;
                    }

                    var physicalTableExists = client.Db.TableExists(TableName);
                    if (!physicalTableExists)
                    {
                        var addTableResult = await MicroiEngine.FormEngine.AddTableAsync(new
                        {
                            OsClient = osClient,
                            Name = TableName,
                            Description = "AI角色数据访问策略",
                            DataBaseId = "",
                            DataBaseName = ""
                        });
                        physicalTableExists = client.Db.TableExists(TableName);
                        if (addTableResult.Code != 1)
                        {
                            // AddDiyTable 的物理 DDL 与元数据事务不是同一个连接。
                            // 元数据写入失败时物理表可能已经成功创建，不能在下次
                            // 启动继续 CREATE 并永久卡在 “already exists”。
                            if (!physicalTableExists)
                            {
                                messages.Add($"创建 {TableName} 失败：{addTableResult.Msg}");
                                return messages;
                            }
                        }
                    }

                    tableResult = await GetTableAsync(osClient);
                    if ((tableResult.Code != 1 || tableResult.Data == null)
                        && physicalTableExists)
                    {
                        var adoptResult = await AdoptExistingPhysicalTableAsync(osClient, client);
                        if (adoptResult.Code != 1)
                        {
                            messages.Add($"恢复 {TableName} 元数据失败：{adoptResult.Msg}");
                            return messages;
                        }
                        Console.WriteLine(
                            $"Microi：【兼容修复】【{osClient}】已接管现有物理表 {TableName} 并补齐表单引擎元数据。");
                    }

                    tableResult = await GetTableAsync(osClient);
                }

                if (tableResult.Code != 1 || tableResult.Data == null)
                {
                    messages.Add($"创建后未能读取 {TableName} 表定义。");
                    return messages;
                }

                var tableId = Convert.ToString(tableResult.Data.Id);
                var tenantClient = OsClient.GetClient(osClient);
                foreach (var field in Fields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var existing = await MicroiEngine.FormEngine.GetFormDataAsync(
                        "diy_field",
                        new
                        {
                            OsClient = osClient,
                            _Where = new List<object>
                            {
                                new List<object> { "TableId", "=", tableId },
                                new List<object> { "Name", "=", field.Name }
                            },
                            _SelectFields = new[] { "Id", "Name" }
                        });
                    if (existing.Code == 1 && existing.Data != null) continue;

                    var addFieldResult = await MicroiEngine.FormEngine.AddFieldAsync(new
                    {
                        OsClient = osClient,
                        TableId = tableId,
                        TableName,
                        field.Name,
                        field.Label,
                        field.Type,
                        field.Component,
                        field.Data,
                        field.DefaultValue,
                        field.NotEmpty,
                        field.Sort,
                        field.FormWidth,
                        field.TableWidth,
                        field.Description,
                        Visible = 1,
                        AppVisible = 1,
                        // 迁移中断可能留下“物理列已成功、diy_field事务已回滚”的
                        // 半完成状态；此时只补元数据，避免重复 ALTER TABLE。
                        _NotAddDbField = tenantClient?.Db?.ColumnExists(TableName, field.Name) == true
                    });
                    if (addFieldResult.Code != 1)
                    {
                        messages.Add(
                            $"新增 {TableName}.{field.Name} 失败：{addFieldResult.Msg}");
                    }
                }
            }
            catch (Exception ex)
            {
                messages.Add($"创建 {TableName} 失败：" + ex.Message);
            }

            return messages;
        }

        private static async Task<DosResult> AdoptExistingPhysicalTableAsync(
            string osClient,
            OsClientSecret client)
        {
            var tableId = Guid.NewGuid().ToString();
            var trans = client.Db.BeginTransaction();
            try
            {
                var addTableResult = await UpgradeTrustedFormEngine.AddAsync(
                    "diy_table",
                    osClient,
                    new
                    {
                        Id = tableId,
                        Name = TableName,
                        Description = "AI角色数据访问策略",
                        DataBaseId = "",
                        DataBaseName = "",
                        IsDeleted = 0
                    },
                    trans);
                if (addTableResult.Code != 1)
                {
                    trans.Rollback();
                    return addTableResult;
                }

                foreach (var field in DiyCommon.FixedDiyField)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var addFieldResult = await UpgradeTrustedFormEngine.AddAsync(
                        "diy_field",
                        osClient,
                        new
                        {
                            TableId = tableId,
                            TableName,
                            field.Label,
                            field.Name,
                            field.Type,
                            field.Component,
                            field.Sort,
                            IsLockField = 1,
                            field.Visible,
                            AppVisible = field.Visible,
                            Readonly = 1,
                            NameConfirm = 1,
                            field.TableWidth,
                            Unique = 0,
                            IsDeleted = 0
                        },
                        trans);
                    if (addFieldResult.Code != 1)
                    {
                        trans.Rollback();
                        return addFieldResult;
                    }
                }

                trans.Commit();
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                trans.Rollback();
                return new DosResult(0, null, ex.Message);
            }
            finally
            {
                trans.Close();
            }
        }

        private static Task<DosResult<dynamic>> GetTableAsync(string osClient)
        {
            return MicroiEngine.FormEngine.GetFormDataAsync(
                "diy_table",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "Name", "=", TableName }
                    },
                    _SelectFields = new[] { "Id", "Name" }
                });
        }

        private sealed class AiRolePolicyField
        {
            public string Name { get; set; }
            public string Label { get; set; }
            public string Type { get; set; }
            public string Component { get; set; }
            public string Data { get; set; }
            public string DefaultValue { get; set; }
            public int NotEmpty { get; set; }
            public int Sort { get; set; }
            public int? FormWidth { get; set; }
            public int? TableWidth { get; set; }
            public string Description { get; set; }
        }
    }
}
