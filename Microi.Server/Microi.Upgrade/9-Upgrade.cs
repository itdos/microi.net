using System;
using System.Collections.Generic;
using System.Threading.Tasks;
namespace Microi.net
{
  /// <summary>
  /// diy_field必要升级
  /// </summary>
  public class Upgrade9
  {
    /// <summary>
    /// 
    /// </summary>
    public static string Version = "4.2.1.0";//对应Microi.net.dll v4.2.1
    /// <summary>
    /// 
    /// </summary>
    public async Task<List<string>> Run(string OsClient)
    {
      var msgs = new List<string>();
      var result = await MicroiEngine.FormEngine.UptFormDataByWhereAsync("Diy_Table", new
      {
        OsClient = OsClient,
        _Where = new List<List<string>>() {
                    new List<string> { "Name", "=", "diy_field" }
                },
        SubmitAfterServerV8 = "",
        SubmitBeforeServerV8 = @"if(V8.FormSubmitAction == 'Insert' && !V8.Form.IsVirtual){
  var tableId = V8.ParentV8 && V8.ParentV8.FkTableId;
  if(!tableId){
    tableId = V8.Form.TableId;
  }
  var tableResult = V8.FormEngine.GetFormData('diy_table', {
    Id : tableId
  });
  if(tableResult.Code != 1){
    return tableResult;
  }
  var tableName = tableResult.Data.Name;
  var addFieldResult = V8.FormEngine.AddField({
    TableId : tableId,
    TableName : tableName,
    Name : V8.Form.Name || V8.Param.Name,
    Label: V8.Form.Label || V8.Param.Label,
    Type: V8.Form.Type || V8.Param.Type,
    //2026-01-08新增，必须
    Component : V8.Form.Component || V8.Param.Component,
    _OnlyCreateField : true,
  });
  if(addFieldResult.Code != 1){
    return addFieldResult;
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

