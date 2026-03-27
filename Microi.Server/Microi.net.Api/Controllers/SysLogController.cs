using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Collections.Generic;
using Dos.Common;

namespace Microi.net.Api
{
    /// <summary>
    ///
    /// </summary>
    [EnableCors("any")]
    //[ApiController]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    //[Error]
    [Route("api/[controller]/[action]")]
    public class SysLogController : Controller
    {
        /// <summary>
        ///
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetSysLog(SysLogParam paramLog)
        {
            var param = paramLog;

            #region 取当前登录会员信息

            var sysUser = await DiyToken.GetCurrentToken();

            #endregion 取当前登录会员信息

            param.OsClient = sysUser?.OsClient;
            
            var result = await MicroiEngine.MongoDB.GetSysLog(param);
            return Json(result);
        }

        /// <summary>
        /// 获取日志类型列表（Distinct Type）
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetLogTypes(SysLogParam paramLog)
        {
            var param = paramLog;
            var sysUser = await DiyToken.GetCurrentToken();
            param.OsClient = sysUser?.OsClient;
            var result = await MicroiEngine.MongoDB.GetSysLogTypes(param);
            return Json(result);
        }

        /// <summary>
        /// 传入Type、Title、Content、
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> AddSysLog(SysLogParam paramLog)
        {
            var param = paramLog;
            var currentToken = await DiyToken.GetCurrentToken();
            if (currentToken != null)
            {
                param.OsClient = currentToken.OsClient;
                param.UserName = currentToken.CurrentUser["Name"].Val<string>();
                param.UserId = currentToken.CurrentUser["Id"].Val<string>();
            }

            // 记录IP
            if (string.IsNullOrWhiteSpace(param.IP))
            {
                var ipResult = IPHelper.GetClientIP(HttpContext);
                if (ipResult.Code == 1) param.IP = ipResult.Data;
            }

            var result = await MicroiEngine.MongoDB.AddSysLog(param);
            return Json(result);
        }

        /// <summary>
        /// 获取Docker容器日志
        /// </summary>
        [HttpGet, HttpPost]
        public JsonResult GetDockerLogs(string ContainerName = "microi-api", int Lines = 200)
        {
            try
            {
                // 安全校验：容器名只允许字母/数字/短横线/下划线/点
                if (string.IsNullOrWhiteSpace(ContainerName) || !System.Text.RegularExpressions.Regex.IsMatch(ContainerName, @"^[a-zA-Z0-9_\-\.]+$"))
                {
                    return Json(new { Code = 0, Msg = "容器名称格式无效" });
                }
                if (Lines < 1) Lines = 50;
                if (Lines > 5000) Lines = 5000;

                var processInfo = new ProcessStartInfo
                {
                    FileName = "docker",
                    Arguments = $"logs --tail {Lines} --timestamps {ContainerName}",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                var logLines = new List<string>();

                using (var process = Process.Start(processInfo))
                {
                    if (process == null)
                    {
                        return Json(new { Code = 0, Msg = "无法启动Docker进程，请确认Docker环境可用" });
                    }

                    // Docker日志同时从stdout和stderr输出
                    var stdout = process.StandardOutput.ReadToEnd();
                    var stderr = process.StandardError.ReadToEnd();

                    process.WaitForExit(10000); // 最多等待10秒

                    if (!string.IsNullOrEmpty(stdout))
                    {
                        logLines.AddRange(stdout.Split('\n', System.StringSplitOptions.RemoveEmptyEntries));
                    }
                    if (!string.IsNullOrEmpty(stderr))
                    {
                        logLines.AddRange(stderr.Split('\n', System.StringSplitOptions.RemoveEmptyEntries));
                    }

                    if (process.ExitCode != 0 && logLines.Count == 0)
                    {
                        return Json(new { Code = 0, Msg = $"获取日志失败(exit={process.ExitCode})，请确认Docker容器名称正确且Docker socket已挂载" });
                    }
                }

                // 按时间戳排序（Docker --timestamps 格式: 2024-01-01T00:00:00.000000000Z 内容）
                logLines.Sort();

                return Json(new { Code = 1, Data = logLines });
            }
            catch (System.ComponentModel.Win32Exception)
            {
                return Json(new { Code = 0, Msg = "Docker命令不可用，请确认：1) 已安装Docker CLI  2) 已挂载 /var/run/docker.sock" });
            }
            catch (System.Exception ex)
            {
                return Json(new { Code = 0, Msg = $"获取Docker日志异常：{ex.Message}" });
            }
        }
    }
}