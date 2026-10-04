using System;
using System.Collections.Generic;
using System.Threading.Tasks;
namespace Microi.net
{
    /// <summary>
    /// diy_field必要升级
    /// </summary>
    public class Upgrade10
    {
        /// <summary>
        /// 
        /// </summary>
        public static string Version = "4.4.0.0";//对应Microi.net.dll v4.4.0.0
        /// <summary>
        /// 
        /// </summary>
        public async Task<List<string>> Run(string OsClient)
        {
            var msgs = new List<string>();
            var result = await MicroiEngine.FormEngine.UptFormDataByWhereAsync("diy_table", new
            {
                OsClient = OsClient,
                _Where = new List<List<string>>() {
                    new List<string> { "Name", "=", "sys_menu" }
                },
                SubmitAfterServerV8 = @"
        //如果是新增，给admin管理员默认权限
if(V8.FormSubmitAction == 'Insert'){
  var addResult = V8.FormEngine.AddFormData({
    FormEngineKey : 'sys_rolelimit',
    _RowModel:{
      RoleId : '5db47859-35a3-411a-a1f7-99482e057d24',
      FkId : V8.Form.Id,
      Type : 'Menu',
      CreateTime : V8.Action.GetDateTimeNow(),
      Permission : '[""Add"",""Edit"",""Del"",""Export"",""Import""]'
    }
  });
  if(addResult.Code == 1){
    V8.Method.RefreshLoginUser('c74d669c-a3d4-11e5-b60d-b870f43edd03', V8.OsClient)
  }else{
    return addResult;
  }
}
//判断上下级HasChild
//20245-01-08发现加了以下代码会导致sys_menu表的SearchFieldIds字段里面的等值Equal保存不上，暂时未找到原因，可能是因为不能在sys——menu事件中再去修改sys_menu
// if(V8.Form.ParentId){
//   V8.FormEngine.UptFormData('sys_menu', {
//     HasChild : 1,
//     Id : V8.Form.ParentId
//   });
// }

V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_menu:${V8.Form.Id.toLowerCase()}`);
if(V8.Form.ModuleEngineKey){
  V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_menu:${V8.Form.ModuleEngineKey.toLowerCase()}`);
}
//检查是否已存在相同模块引擎key
if(V8.Form.ModuleEngineKey){
  var menuList = V8.FormEngine.GetTableData('sys_menu', {
    _Where:[
      ['ModuleEngineKey', '=', V8.Form.ModuleEngineKey],
      ['Id', '!=', V8.Form.Id],
    ]
  });
  if(menuList.Code == 1 && menuList.Data.length > 0){
    return { Code : 0, Msg : `当前模块引擎Key[${V8.Form.ModuleEngineKey}]已存在[${menuList.Data.length}]条！请立即变更！` };
  }
}
"
            });
            if (result.Code != 1)
            {
                msgs.Add(result.Msg);
            }
            return msgs;
        }
    }
}

