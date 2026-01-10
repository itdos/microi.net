using System;
using System.Collections.Generic;
using System.Threading.Tasks;
namespace Microi.net
{
    /// <summary>
    /// 必要升级
    /// </summary>
    public class UpgradeApiEngine6
    {
        /// <summary>
        /// 
        /// </summary>
        public static string Version = "2.1.7.0";
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
                        Value = "Sys_ApiEngine",
                        Type = "="
                    }
                },
                SubmitAfterServerV8 = @"var cacheKey = `Microi:${V8.OsClient}:FormData:sys_apiengine:${V8.Form.ApiEngineKey.toLowerCase()}`;
var cacheKeyId = `Microi:${V8.OsClient}:FormData:sys_apiengine:${V8.Form.Id.toLowerCase()}`;
var formModel = JSON.stringify(V8.Form);
V8.Cache.Set(cacheKey, formModel);
V8.Cache.Set(cacheKeyId, formModel);

if(V8.OldForm && V8.OldForm.ApiEngineKey && V8.OldForm.ApiEngineKey != V8.Form.ApiEngineKey){
  V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${V8.OldForm.ApiEngineKey.toLowerCase()}`);
}

if(V8.Form.ApiAddress){
  var apiPath = V8.Form.ApiAddress.toLowerCase();
  var cacheKey2 = `Microi:${V8.OsClient}:FormData:sys_apiengine:${apiPath}`;
  V8.Cache.Set(cacheKey2, formModel);
  if(V8.OldForm && V8.OldForm.ApiAddress && V8.OldForm.ApiAddress != V8.Form.ApiAddress){
    V8.Cache.Remove(`Microi:${V8.OsClient}:FormData:sys_apiengine:${V8.OldForm.ApiAddress.toLowerCase()}`);
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

