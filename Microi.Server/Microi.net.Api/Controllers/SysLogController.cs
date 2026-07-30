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
    [PlatformAdminOnly]
    //[Error]
    [Route("api/[controller]/[action]")]
    public class SysLogController : Controller
    {
        private static readonly HashSet<string> ReservedBehaviorTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "访问菜单", "点击V8按钮", "查看数据", "数据操作", "导入数据", "导出数据",
            "用户登录", "用户退出", "登录失效", "私有附件", "登录失败"
        };
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
        /// 一次性返回当前月 5 类日志的数量统计（Error/Warn/SlowSQL/SlowExec/Exception）。
        /// 支持 _Keyword 过滤，不需要分页参数。
        /// 前端用此接口替换原来 5 个独立统计请求。
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetSysLogStats(SysLogParam paramLog)
        {
            var param = paramLog;
            var sysUser = await DiyToken.GetCurrentToken();
            param.OsClient = sysUser?.OsClient;
            var result = await MicroiEngine.MongoDB.GetSysLogStats(param);
            return Json(result);
        }

        /// <summary>
        /// 传入Type、Title、Content、
        /// </summary>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> AddSysLog(SysLogParam paramLog)
        {
            var param = paramLog;
            if (param == null) return Json(new DosResult(0, null, "日志参数不能为空。"));
            if (!param.Category.DosIsNullOrWhiteSpace() || !param.Action.DosIsNullOrWhiteSpace()
                || ReservedBehaviorTypes.Contains(param.Type ?? ""))
            {
                return Json(new DosResult(0, null, "平台用户行为日志只能由后端可信执行点生成。"));
            }
            var currentToken = await DiyToken.GetCurrentToken();
            param.OsClient = currentToken.OsClient;
            param.UserName = UserBehaviorAudit.FormatUser(currentToken.CurrentUser);
            param.UserId = currentToken.CurrentUser["Id"].Val<string>();
            param.Category = "Legacy";
            param.Action = "ClientLog";
            param.Source = "LegacyClientEndpoint";

            // 记录IP
            if (string.IsNullOrWhiteSpace(param.IP))
            {
                var ipResult = IPHelper.GetClientIP(HttpContext);
                if (ipResult.Code == 1) param.IP = ipResult.Data;
            }

            var result = await MicroiEngine.MongoDB.AddSysLog(param);
            return Json(result);
        }

        /// <summary>管理员查看异步日志队列健康度，不暴露服务器磁盘路径。</summary>
        [HttpGet]
        public async Task<JsonResult> GetQueueHealth()
        {
            var token = await DiyToken.GetCurrentToken().ConfigureAwait(false);
            if (token?.CurrentUser == null || token.CurrentUser["Level"].Val<int>() < 9999)
                return Json(new DosResult(0, null, "仅系统管理员可查看日志队列状态。"));
            var health = MicroiEngine.SysLogQueue?.GetHealth();
            return Json(new DosResult(1, health == null ? null : new
            {
                health.NodeId,
                health.Enqueued,
                health.Persisted,
                health.Retried,
                health.Pending,
                health.Capacity,
                health.OverflowCapacity,
                health.OverflowPending,
                health.EmergencySpooled,
                health.Dropped,
                health.FailedBatches,
                health.LastError,
                health.LastPersistedAt
            }));
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
