using System;
using System.Collections.Generic;
using System.Threading.Tasks;
namespace Microi.net
{
    /// <summary>
    /// 必要升级
    /// </summary>
    public class Upgrade7
    {
        /// <summary>
        /// 
        /// </summary>
        public static string Version = "2.2.3.0";
        /// <summary>
        /// 
        /// </summary>
        public async Task<List<string>> Run(string OsClient)
        {
            var msgs = new List<string>();
            var result = await MicroiEngine.FormEngine.UptFormDataByWhereAsync("Diy_Table", new
            {
                OsClient = OsClient,
                _Where = new List<DiyWhere>()
                {
                    new DiyWhere()
                    {
                        Name = "Name",
                        Value = "Diy_Table",
                        Type = "="
                    }
                },
                SubmitAfterServerV8 = @"if(V8.FormSubmitAction == 'Insert'){
  var addTableResult = V8.FormEngine.AddTable({
    Name : V8.Form.Name,
    Description: V8.Form.Description,
    DataBaseId: V8.Form.DataBaseId,
    DataBaseName: V8.Form.DataBaseName,
    _OnlyCreateTable : true,
  });
  if(addTableResult.Code != 1){
    V8.Result = addTableResult;
  }
}
V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table:${V8.Form.Id.toLowerCase()}`);
if(V8.Form.Name){
  V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:diy_table:${V8.Form.Name.toLowerCase()}`);
}"
            });
            if (result.Code != 1)
            {
                msgs.Add(result.Msg);
            }

            var result2 = await MicroiEngine.FormEngine.UptFormDataByWhereAsync("Diy_Table", new
            {
                OsClient = OsClient,
                _Where = new List<DiyWhere>()
                {
                    new DiyWhere()
                    {
                        Name = "Name",
                        Value = "sys_menu",
                        Type = "="
                    }
                },
                SubmitAfterServerV8 = @"//如果是新增，给admin管理员默认权限
if(V8.FormSubmitAction == 'Insert'){
  var addResult = V8.FormEngine.AddFormData({
    FormEngineKey : 'sys_rolelimit',
    _RowModel:{
      RoleId : '5db47859-35a3-411a-a1f7-99482e057d24',
      FkId : V8.Form.Id,
      Type : 'Menu',
      CreateTime : V8.Action.GetDateTimeNow(),
      Permission : '[\""Add\"",\""Edit\"",\""Del\"",\""Export\"",\""Import\""]'
    }
  });
  if(addResult.Code == 1){
    V8.Method.RefreshLoginUser('c74d669c-a3d4-11e5-b60d-b870f43edd03', V8.OsClient)
  }else{
    //V8.Result = addResult;
  }
}
//判断上下级HasChild
//20245-01-08发现加了以下代码会导致sys_menu表的SearchFieldIds字段里面的等值Equal保存不上，暂时未找到原因，可能是因为不能在sys——menu事件中再去修改sys_menu
/*
if(V8.Form.ParentId){
  V8.FormEngine.UptFormData('sys_menu', {
    HasChild : 1,
    Id : V8.Form.ParentId
  });
}
*/
V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_menu:${V8.Form.Id.toLowerCase()}`);
if(V8.Form.ModuleEngineKey){
  V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_menu:${V8.Form.ModuleEngineKey.toLowerCase()}`);
}"
            });
            if (result2.Code != 1)
            {
                msgs.Add(result.Msg);
            }
            return msgs;
        }
    }
}

