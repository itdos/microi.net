using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace Microi.net.Api
{
    /// <summary>
    /// 系统监控
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class SystemMonitorController : Controller
    {
        /// <summary>
        /// 获取系统综合监控信息（CPU/内存/磁盘/网络/运行时）
        /// </summary>
        [HttpGet, HttpPost]
        public JsonResult GetSystemOverview()
        {
            SystemMonitorLogic.EnsureMonitorActive();
            var data = SystemMonitorLogic.GetSystemOverview();
            // 补充 ProductEdition（DiyLicense 仅在 Microi.net 项目可用）
            try
            {
                var productType = DiyLicense.GetProductType();
                if (string.IsNullOrEmpty(productType))
                    data["ProductEdition"] = "开源版";
                else if (productType == "Personal")
                    data["ProductEdition"] = "个人版";
                else if (productType == "Enterprise")
                    data["ProductEdition"] = "企业版";
                else
                    data["ProductEdition"] = productType;
            }
            catch
            {
                data["ProductEdition"] = "开源版";
            }
            return Json(new { Code = 1, Data = data });
        }

        /// <summary>
        /// 获取CPU和内存使用率（轻量接口，用于实时刷新）
        /// </summary>
        [HttpGet, HttpPost]
        public JsonResult GetCpuMemory()
        {
            var data = SystemMonitorLogic.GetCpuMemoryInfo();
            return Json(new { Code = 1, Data = data });
        }

        /// <summary>
        /// 获取网络流量（需要多次调用以计算速率）
        /// </summary>
        [HttpGet, HttpPost]
        public JsonResult GetNetwork()
        {
            var data = SystemMonitorLogic.GetNetworkTraffic();
            return Json(new { Code = 1, Data = data });
        }

        /// <summary>
        /// 获取平台统计数据（表单引擎数量、模块数量、用户数量等）
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetPlatformStats()
        {
            try
            {
                var sysUser = await DiyToken.GetCurrentToken();
                var osClient = OsClient.GetClient(sysUser?.OsClient);
                var db = osClient.Db;

                var stats = new JObject();

                // 表单引擎数量
                try
                {
                    var tableSql = "SELECT COUNT(*) FROM diy_table WHERE IsDeleted<>1";
                    stats["DiyTableCount"] = Convert.ToInt32(db.FromSql(tableSql).ToScalar());
                }
                catch { stats["DiyTableCount"] = 0; }

                // 模块引擎数量
                try
                {
                    var menuSql = "SELECT COUNT(*) FROM sys_menu WHERE IsDeleted<>1";
                    stats["SysMenuCount"] = Convert.ToInt32(db.FromSql(menuSql).ToScalar());
                }
                catch { stats["SysMenuCount"] = 0; }

                // 接口引擎数量
                try
                {
                    var apiSql = "SELECT COUNT(*) FROM sys_apiengine WHERE IsDeleted<>1";
                    stats["ApiEngineCount"] = Convert.ToInt32(db.FromSql(apiSql).ToScalar());
                }
                catch { stats["ApiEngineCount"] = 0; }

                // SaaS引擎数量
                try
                {
                    var osSql = "SELECT COUNT(*) FROM sys_osclients WHERE IsDeleted<>1";
                    stats["OsClientCount"] = Convert.ToInt32(db.FromSql(osSql).ToScalar());
                }
                catch { stats["OsClientCount"] = 0; }

                // 用户数量
                try
                {
                    var userSql = "SELECT COUNT(*) FROM Sys_User WHERE IsDeleted<>1";
                    stats["UserCount"] = Convert.ToInt32(db.FromSql(userSql).ToScalar());
                }
                catch { stats["UserCount"] = 0; }

                // 最近登录用户(最近5条)
                try
                {
                    var loginSql = "SELECT Id, Name, Account, LastLoginIP, LastLoginTime FROM Sys_User WHERE LastLoginTime IS NOT NULL ORDER BY LastLoginTime DESC LIMIT 5";
                    dynamic[] loginList = db.FromSql(loginSql).ToArray();
                    var recentLogins = new JArray();
                    foreach (var item in loginList)
                    {
                        var loginObj = JObject.FromObject(item);
                        recentLogins.Add(loginObj);
                    }
                    stats["RecentLogins"] = recentLogins;
                }
                catch { stats["RecentLogins"] = new JArray(); }

                // 接口引擎调用频率排行（取前10，从 MongoDB 读取）
                try
                {
                    var rankResult = await MicroiEngine.MongoDB.GetApiCallCountRank(new ApiCallCountParam()
                    {
                        OsClient = sysUser?.OsClient,
                        _Top = 10
                    });
                    var apiRankArr = new JArray();
                    if (rankResult.Code == 1 && rankResult.Data != null)
                    {
                        foreach (var item in rankResult.Data)
                        {
                            apiRankArr.Add(JObject.FromObject(item));
                        }
                    }
                    stats["ApiEngineRank"] = apiRankArr;
                }
                catch { stats["ApiEngineRank"] = new JArray(); }

                // 表单数据量排行（取前10，通过diy_table的DataCount字段）
                try
                {
                    var tableRankSql = @"SELECT 
    d.Name,
    d.Description AS Label,
    t.TABLE_ROWS AS DataCount
FROM 
    diy_table d
    INNER JOIN information_schema.TABLES t 
        ON d.Name = t.TABLE_NAME 
        AND t.TABLE_SCHEMA = DATABASE()  -- 替换为您的数据库名
WHERE 
    d.IsDeleted <> 1
    AND t.TABLE_ROWS > 0
ORDER BY 
    t.TABLE_ROWS DESC
LIMIT 10;";
                    dynamic[] tableRank = db.FromSql(tableRankSql).ToArray();
                    var tableRankArr = new JArray();
                    foreach (var item in tableRank)
                    {
                        tableRankArr.Add(JObject.FromObject(item));
                    }
                    stats["TableDataRank"] = tableRankArr;
                }
                catch { stats["TableDataRank"] = new JArray(); }

                return Json(new { Code = 1, Data = stats });
            }
            catch (Exception ex)
            {
                return Json(new { Code = 0, Msg = ex.Message });
            }
        }

        /// <summary>
        /// 获取Docker容器运行统计信息（CPU/内存/网络IO/磁盘IO/进程数）
        /// </summary>
        [HttpGet, HttpPost]
        public JsonResult GetDockerStats()
        {
            try
            {
                var data = SystemMonitorLogic.GetDockerStats();
                return Json(new { Code = 1, Data = data });
            }
            catch (Exception ex)
            {
                return Json(new { Code = 0, Msg = ex.Message });
            }
        }

        /// <summary>
        /// 获取应用运行日志（Console.WriteLine输出的内容，支持Docker和非Docker环境）
        /// </summary>
        [HttpGet, HttpPost]
        public JsonResult GetAppLogs(int Lines = 200)
        {
            try
            {
                if (Lines < 1) Lines = 50;
                if (Lines > 5000) Lines = 5000;

                // 优先从内存环形缓冲区获取
                var logs = SystemMonitorLogic.GetAppLogs(Lines);
                if (logs != null && logs.Length > 0)
                {
                    return Json(new { Code = 1, Data = logs, Source = "AppBuffer" });
                }

                // 回退尝试 docker logs
                try
                {
                    var processInfo = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "docker",
                        Arguments = $"logs --tail {Lines} --timestamps microi-api",
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };

                    var logLines = new System.Collections.Generic.List<string>();
                    using (var process = System.Diagnostics.Process.Start(processInfo))
                    {
                        if (process != null)
                        {
                            var stdout = process.StandardOutput.ReadToEnd();
                            var stderr = process.StandardError.ReadToEnd();
                            process.WaitForExit(10000);

                            if (!string.IsNullOrEmpty(stdout))
                                logLines.AddRange(stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries));
                            if (!string.IsNullOrEmpty(stderr))
                                logLines.AddRange(stderr.Split('\n', StringSplitOptions.RemoveEmptyEntries));

                            if (logLines.Count > 0)
                            {
                                logLines.Sort();
                                return Json(new { Code = 1, Data = logLines, Source = "Docker" });
                            }
                        }
                    }
                }
                catch { }

                return Json(new { Code = 1, Data = new string[0], Source = "Empty", Msg = "暂无日志数据。请在 Program.cs 中注册 Console.SetOut(new ConsoleLogInterceptor(Console.Out)); 以捕获应用日志" });
            }
            catch (Exception ex)
            {
                return Json(new { Code = 0, Msg = $"获取日志异常：{ex.Message}" });
            }
        }
    }
}
