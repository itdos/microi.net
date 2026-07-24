using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 在 SaaS 引擎表中补齐租户级文件上传开关与限额。
    /// 所有数值均可空：业务优先级为租户 > 环境变量 > appsettings > 代码默认值，
    /// 最终仍受平台独立 Absolute* 与 HTTP 请求解析上限保护。
    /// </summary>
    public class Upgrade16
    {
        // 6.5.7 的第 2 个正式迁移修订；必须高于此前已发布的所有
        // ServerVersion，保证老库升级到当前版本时不会跳过 SaaS 动态字段。
        public static string Version = "6.5.7.2";

        private static readonly IReadOnlyList<FileUploadTenantField> Fields =
            new List<FileUploadTenantField>
            {
                new FileUploadTenantField
                {
                    Name = "FileUploadEnabled",
                    Label = "启用文件上传",
                    Component = "Switch",
                    DefaultValue = "1",
                    Sort = 9870,
                    Description = "关闭后禁止当前租户的交互式文件上传；空值依次使用环境变量、appsettings和代码默认值。全局ForceDisabled紧急熔断不能被租户重新开启。"
                },
                new FileUploadTenantField
                {
                    Name = "FileUploadMaxFileMB",
                    Label = "单文件上限MB",
                    Sort = 9880,
                    Description = "当前租户动态单文件上限；优先于环境变量和appsettings，最终不能突破平台AbsoluteMaxFileMB及请求解析上限。"
                },
                new FileUploadTenantField
                {
                    Name = "FileUploadMaxRequestMB",
                    Label = "单次总量上限MB",
                    Sort = 9890,
                    Description = "当前租户一次上传所有文件的合计大小；优先于环境变量和appsettings，最终受AbsoluteMaxTotalMB及HTTP/Multipart上限约束。"
                },
                new FileUploadTenantField
                {
                    Name = "FileUploadMaxCount",
                    Label = "单次文件数上限",
                    Sort = 9900,
                    Description = "当前租户一次上传文件数；优先于环境变量和appsettings，必须为正整数且不能突破AbsoluteMaxFileCount。"
                },
                new FileUploadTenantField
                {
                    Name = "FileUploadDailyUserQuotaMB",
                    Label = "账号日额度MB",
                    Sort = 9910,
                    Description = "留空使用平台默认额度；按UTC日期、当前租户和账号在共享Redis中原子统计。"
                },
                new FileUploadTenantField
                {
                    Name = "FileUploadDailyTenantQuotaMB",
                    Label = "租户日额度MB",
                    Sort = 9920,
                    Description = "留空使用平台默认额度；按UTC日期和当前租户在共享Redis中原子统计。"
                }
            };

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
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
                    });
                if (tableResult.Code != 1 || tableResult.Data == null)
                {
                    messages.Add("未找到 sys_osclients 表定义，无法增加租户文件上传配置。");
                    return messages;
                }

                var tableId = Convert.ToString(tableResult.Data.Id);
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

                    var addResult = await MicroiEngine.FormEngine.AddFieldAsync(new
                    {
                        OsClient = osClient,
                        TableId = tableId,
                        TableName = "sys_osclients",
                        field.Name,
                        field.Label,
                        Type = "int",
                        field.Component,
                        field.DefaultValue,
                        field.Sort,
                        Visible = 1,
                        AppVisible = 1,
                        TableWidth = 170,
                        field.Description
                    });
                    if (addResult.Code != 1)
                    {
                        messages.Add(
                            $"新增 sys_osclients.{field.Name} 失败：{addResult.Msg}");
                    }
                }
            }
            catch (Exception ex)
            {
                messages.Add("增加租户文件上传配置失败：" + ex.Message);
            }
            return messages;
        }

        private sealed class FileUploadTenantField
        {
            public string Name { get; set; }
            public string Label { get; set; }
            public string Component { get; set; } = "NumberText";
            public string DefaultValue { get; set; }
            public int Sort { get; set; }
            public string Description { get; set; }
        }
    }
}
