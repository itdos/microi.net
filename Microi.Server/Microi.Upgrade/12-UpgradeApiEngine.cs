using System;
using System.Collections.Generic;
using System.Threading.Tasks;
namespace Microi.net
{
    /// <summary>
    /// 必要升级
    /// </summary>
    public class Upgrade12
    {
        /// <summary>
        /// 
        /// </summary>
        public static string Version = "4.6.16.0";
        /// <summary>
        /// 
        /// </summary>
        public async Task<List<string>> Run(string osClient)
        {
            var msgs = new List<string>();
            var result = await MicroiEngine.FormEngine.UptFormDataByWhereAsync("diy_table", new
            {
                OsClient = osClient,
                _Where = new List<DiyWhere>()
                {
                    new DiyWhere()
                    {
                        Name = "Name",
                        Value = "sys_apiengine",
                        Type = "="
                    }
                },
                SubmitAfterServerV8 = ApiEngineCacheCompatibility.SubmitAfterServerV8
            });
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:cf389aef-72cc-4980-9c5b-143123561ac0");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:sys_apiengine");
            if (result.Code != 1)
            {
                msgs.Add(result.Msg);
            }
            return msgs;
        }
    }
}

