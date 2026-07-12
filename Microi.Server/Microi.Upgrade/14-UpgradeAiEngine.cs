using System.Collections.Generic;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 修复 AI 引擎菜单与 mic_ai 表的模块引擎绑定。
    /// </summary>
    public class Upgrade14
    {
        public static string Version = "6.2.5.0";

        public async Task<List<string>> Run(string osClient)
        {
            var msgs = new List<string>();
            var tableResult = await MicroiEngine.FormEngine.GetFormDataAsync("diy_table", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "Name", "=", "mic_ai" }
                },
                _SelectFields = new[] { "Id", "Name" }
            });

            // AI 插件及其数据表是可选能力；不存在时不阻断其它租户升级。
            if (tableResult.Code != 1)
            {
                return msgs;
            }

            var menuResult = await MicroiEngine.FormEngine.GetFormDataAsync("sys_menu", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "ModuleEngineKey", "=", "AiEngine" }
                },
                _SelectFields = new[] { "Id", "ModuleEngineKey", "DiyTableId" }
            });

            if (menuResult.Code != 1)
            {
                return msgs;
            }

            var tableId = (string)tableResult.Data.Id;
            var fieldResult = await MicroiEngine.FormEngine.GetFormDataAsync("diy_field", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "TableId", "=", tableId },
                    new List<object> { "Name", "=", "IsRelayModel" }
                },
                _SelectFields = new[] { "Id" }
            });
            if (fieldResult.Code != 1)
            {
                var addField = await MicroiEngine.FormEngine.AddFieldAsync(new
                {
                    OsClient = osClient,
                    TableId = tableId,
                    TableName = "mic_ai",
                    Name = "IsRelayModel",
                    Label = "加入AI中转站",
                    Type = "int",
                    Component = "Switch",
                    DefaultValue = "0",
                    Sort = 750,
                    Visible = 1,
                    AppVisible = 1,
                    Description = "开启后该模型可由Microi.AI中转站对外提供。"
                });
                if (addField.Code != 1) msgs.Add("新增 mic_ai.IsRelayModel 失败：" + addField.Msg);
            }

            var relayResult = await MicroiEngine.FormEngine.GetFormDataAsync("mic_ai", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "Name", "In", new[] { "Microi吾码AI中转站", "Microi.AI中转站" } }
                }
            });
            if (relayResult.Code == 1 && relayResult.Data != null)
            {
                var relayUpdate = await MicroiEngine.FormEngine.UptFormDataAsync("mic_ai", new
                {
                    Id = (string)relayResult.Data.Id,
                    OsClient = osClient,
                    Name = "Microi.AI中转站",
                    AiModel = "Microi.AI中转站",
                    Endpoint = "https://api.itdos.com/v1",
                    IsEnable = 1,
                    Remark = "ApiKey由吾码官网个人中心生成，创建SaaS租户时自动写入。"
                });
                if (relayUpdate.Code != 1) msgs.Add("更新 Microi.AI中转站 失败：" + relayUpdate.Msg);
            }

            var menuId = (string)menuResult.Data.Id;
            var currentTableId = (string)menuResult.Data.DiyTableId;
            if (currentTableId != tableId)
            {
                var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_menu", new
                {
                    Id = menuId,
                    OsClient = osClient,
                    DiyTableId = tableId,
                    DiyTableName = (string)tableResult.Data.Name
                });
                if (updateResult.Code != 1) msgs.Add("AI引擎菜单绑定 mic_ai 表失败：" + updateResult.Msg);
            }

            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_menu:{menuId}");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_menu:aiengine");
            return msgs;
        }
    }
}
