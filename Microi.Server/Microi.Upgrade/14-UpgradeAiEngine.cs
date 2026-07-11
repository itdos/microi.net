using System.Collections.Generic;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 修复 AI 引擎菜单与 mic_ai 表的模块引擎绑定。
    /// </summary>
    public class Upgrade14
    {
        public static string Version = "6.2.3.0";

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
            var menuId = (string)menuResult.Data.Id;
            var currentTableId = (string)menuResult.Data.DiyTableId;
            if (currentTableId == tableId)
            {
                return msgs;
            }

            var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_menu", new
            {
                Id = menuId,
                OsClient = osClient,
                DiyTableId = tableId,
                DiyTableName = (string)tableResult.Data.Name
            });
            if (updateResult.Code != 1)
            {
                msgs.Add("AI引擎菜单绑定 mic_ai 表失败：" + updateResult.Msg);
                return msgs;
            }

            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_menu:{menuId}");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_menu:aiengine");
            return msgs;
        }
    }
}
