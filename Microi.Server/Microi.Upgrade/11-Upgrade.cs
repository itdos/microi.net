using System;
using System.Collections.Generic;
using System.Threading.Tasks;
namespace Microi.net
{
    /// <summary>
    /// sys_role和sys_user表Level字段升级：999->9999, 998->9998
    /// </summary>
    public class Upgrade11
    {
        /// <summary>
        /// 
        /// </summary>
        public static string Version = "4.5.3.0";
        /// <summary>
        /// 
        /// </summary>
        public async Task<List<string>> Run(string OsClient)
        {
            var msgs = new List<string>();

            // 更新 sys_role 表 Level=999 -> 9999
            var result1 = await MicroiEngine.FormEngine.UptFormDataByWhereAsync("sys_role", new
            {
                OsClient = OsClient,
                Level = 9999,
                _Where = new List<List<string>>() {
                    new List<string> { "Level", "=", "999" }
                }
            });
            if (result1.Code != 1)
            {
                msgs.Add($"sys_role Level 999->9999 失败: {result1.Msg}");
            }

            // 更新 sys_role 表 Level=998 -> 9998
            var result2 = await MicroiEngine.FormEngine.UptFormDataByWhereAsync("sys_role", new
            {
                OsClient = OsClient,
                Level = 9998,
                _Where = new List<List<string>>() {
                    new List<string> { "Level", "=", "998" }
                }
            });
            if (result2.Code != 1)
            {
                msgs.Add($"sys_role Level 998->9998 失败: {result2.Msg}");
            }

            // 更新 sys_user 表 Level=999 -> 9999
            var result3 = await MicroiEngine.FormEngine.UptFormDataByWhereAsync("sys_user", new
            {
                OsClient = OsClient,
                Level = 9999,
                _Where = new List<List<string>>() {
                    new List<string> { "Level", "=", "999" }
                }
            });
            if (result3.Code != 1)
            {
                msgs.Add($"sys_user Level 999->9999 失败: {result3.Msg}");
            }

            // 更新 sys_user 表 Level=998 -> 9998
            var result4 = await MicroiEngine.FormEngine.UptFormDataByWhereAsync("sys_user", new
            {
                OsClient = OsClient,
                Level = 9998,
                _Where = new List<List<string>>() {
                    new List<string> { "Level", "=", "998" }
                }
            });
            if (result4.Code != 1)
            {
                msgs.Add($"sys_user Level 998->9998 失败: {result4.Msg}");
            }

            // 更新 sys_user 表 Level=998 -> 9998
            var result5 = await MicroiEngine.FormEngine.UptFormDataByWhereAsync("sys_config", new
            {
                OsClient = OsClient,
                PwdEncode = "DES",
                _Where = new List<List<string>>() {
                    new List<string> { "PwdEncode", "=", "V8" }
                }
            });
            if (result5.Code != 1)
            {
                msgs.Add($"sys_config PwdEncode V8->DES 失败: {result5.Msg}");
            }

            return msgs;
        }
    }
}
