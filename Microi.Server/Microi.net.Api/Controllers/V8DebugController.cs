#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8DebugController.cs
* Copyright(c) Microi.net
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：2026-01-13
* 文件描述：V8引擎本地调试同步API
*           支持本地 ↔ 数据库双向同步接口引擎代码
*           需要当前登录用户 Level >= 9999
*******************************************************/
#endregion
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using Dos.Common;
using System.Diagnostics;
using System.Text;

namespace Microi.net.Api
{
    /// <summary>
    /// V8引擎本地调试同步API
    /// 需要JWT认证 + Level >= 9999
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class V8DebugController : Controller
    {
        /// <summary>
        /// 检查当前用户权限（Level >= 9999）
        /// </summary>
        private async Task<(bool ok, string msg, dynamic token)> CheckPermission()
        {
            try
            {
                var currentToken = await DiyToken.GetCurrentToken();
                if (currentToken == null || currentToken.CurrentUser == null)
                {
                    return (false, "未登录或登录已过期", null);
                }
                var level = currentToken.CurrentUser["Level"].Val<int>();
                if (level < 9999)
                {
                    return (false, "权限不足，需要 Level >= 9999", null);
                }
                return (true, "", currentToken);
            }
            catch
            {
                return (false, "权限验证失败", null);
            }
        }

        /// <summary>
        /// 获取调试状态
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetStatus()
        {
            var (ok, msg, currentToken) = await CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            return Ok(new DosResult(1, new
            {
                IsDebugMode = true,
                Environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                DebuggerAttached = Debugger.IsAttached,
                LocalV8DebugPath = ConfigHelper.GetAppSettings("LocalV8DebugPath") ?? "",
                OsClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient") ?? "",
                OsClientType = ConfigHelper.GetAppSettings("OsClientType") ?? "Product",
                OsClientNetwork = ConfigHelper.GetAppSettings("OsClientNetwork") ?? "Internal"
            }));
        }

        /// <summary>
        /// 获取所有接口引擎列表（用于首次全量同步）
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetApiEngineList(string osClient)
        {
            var (ok, msg, currentToken) = await CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient");
            }

            if (osClient.DosIsNullOrWhiteSpace())
            {
                return Ok(new DosResult(0, null, "OsClient 不能为空"));
            }

            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "ApiName", "ApiEngineKey", "Category", "ApiAddress", "IsEnable", "ApiRemark", "ApiV8Code", "UpdateTime" },
                    _Where = new[] {
                        new { Name = "IsDeleted", Value = "0", Type = "=" }
                    },
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var list = new List<dynamic>();
                    foreach (var item in result.Data)
                    {
                        var apiV8Code = (string)item.ApiV8Code ?? "";
                        var updateTime = item.UpdateTime?.ToString() ?? "";
                        apiV8Code = V8Base64.Base64ToString(apiV8Code);
                        
                        list.Add(new
                        {
                            Id = (string)item.Id,
                            ApiName = (string)item.ApiName ?? "",
                            ApiEngineKey = (string)item.ApiEngineKey ?? "",
                            Category = (string)item.Category ?? "未分类",
                            ApiAddress = (string)item.ApiAddress ?? "",
                            IsEnable = item.IsEnable,
                            ApiRemark = (string)item.ApiRemark ?? "",
                            ApiV8Code = apiV8Code,
                            UpdateTime = updateTime
                        });
                    }
                    return Ok(new DosResult(1, new { 
                        OsClient = osClient, 
                        OsClientType = ConfigHelper.GetAppSettings("OsClientType") ?? "Product",
                        OsClientNetwork = ConfigHelper.GetAppSettings("OsClientNetwork") ?? "Internal",
                        List = list, 
                        Total = list.Count 
                    }));
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "获取接口引擎列表失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 获取单个接口引擎详情
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetApiEngine(string osClient, string apiEngineKey)
        {
            var (ok, msg, currentToken) = await CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient");
            }

            if (apiEngineKey.DosIsNullOrWhiteSpace())
            {
                return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            }

            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _Where = new[] {
                        new { Name = "ApiEngineKey", Value = apiEngineKey, Type = "=" },
                        new { Name = "IsDeleted", Value = "0", Type = "=" }
                    }
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var item = result.Data;
                    var apiV8Code = (string)item.ApiV8Code ?? "";
                    apiV8Code = V8Base64.Base64ToString(apiV8Code);

                    return Ok(new DosResult(1, new
                    {
                        Id = (string)item.Id,
                        ApiName = (string)item.ApiName ?? "",
                        ApiEngineKey = (string)item.ApiEngineKey ?? "",
                        Category = (string)item.Category ?? "未分类",
                        ApiAddress = (string)item.ApiAddress ?? "",
                        IsEnable = item.IsEnable,
                        ApiRemark = (string)item.ApiRemark ?? "",
                        ApiV8Code = apiV8Code,
                        UpdateTime = item.UpdateTime?.ToString("yyyy-MM-dd HH:mm:ss") ?? ""
                    }));
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "获取接口引擎失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 获取单个接口引擎的远程代码（用于 Diff 对比）
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetApiEngineCode(string osClient, string apiEngineKey)
        {
            var (ok, msg, currentToken) = await CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient");
            }

            if (apiEngineKey.DosIsNullOrWhiteSpace())
            {
                return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            }

            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "ApiEngineKey", "ApiV8Code", "UpdateTime" },
                    _Where = new[] {
                        new { Name = "ApiEngineKey", Value = apiEngineKey, Type = "=" },
                        new { Name = "IsDeleted", Value = "0", Type = "=" }
                    }
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var apiV8Code = (string)result.Data.ApiV8Code ?? "";
                    apiV8Code = V8Base64.Base64ToString(apiV8Code);

                    return Ok(new DosResult(1, new
                    {
                        ApiEngineKey = apiEngineKey,
                        ApiV8Code = apiV8Code,
                        UpdateTime = result.Data.UpdateTime?.ToString("yyyy-MM-dd HH:mm:ss") ?? ""
                    }));
                }

                return Ok(new DosResult(0, null, $"未找到接口引擎：{apiEngineKey}"));
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "获取接口引擎代码失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 获取增量更新的接口引擎列表
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetUpdatedApiEngines(string osClient, string lastSyncTime)
        {
            var (ok, msg, currentToken) = await CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient");
            }

            DateTime syncTime;
            if (!DateTime.TryParse(lastSyncTime, out syncTime))
            {
                syncTime = DateTime.MinValue;
            }

            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "ApiName", "ApiEngineKey", "Category", "ApiAddress", "IsEnable", "ApiRemark", "ApiV8Code", "UpdateTime", "IsDeleted" },
                    _Where = new[] {
                        new { Name = "UpdateTime", Value = syncTime.ToString("yyyy-MM-dd HH:mm:ss"), Type = ">" }
                    },
                    _OrderBy = "UpdateTime",
                    _OrderByType = "ASC"
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var list = new List<dynamic>();
                    foreach (var item in result.Data)
                    {
                        var apiV8Code = (string)item.ApiV8Code ?? "";
                        apiV8Code = V8Base64.Base64ToString(apiV8Code);

                        list.Add(new
                        {
                            Id = (string)item.Id,
                            ApiName = (string)item.ApiName ?? "",
                            ApiEngineKey = (string)item.ApiEngineKey ?? "",
                            Category = (string)item.Category ?? "未分类",
                            ApiAddress = (string)item.ApiAddress ?? "",
                            IsEnable = item.IsEnable,
                            ApiRemark = (string)item.ApiRemark ?? "",
                            ApiV8Code = apiV8Code,
                            UpdateTime = item.UpdateTime?.ToString("yyyy-MM-dd HH:mm:ss") ?? "",
                            IsDeleted = item.IsDeleted
                        });
                    }
                    return Ok(new DosResult(1, new { 
                        OsClient = osClient, 
                        List = list, 
                        Total = list.Count,
                        ServerTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }));
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "获取增量更新列表失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 更新接口引擎代码（本地 → 数据库）
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> UpdateApiEngineCode([FromBody] JObject param)
        {
            var (ok, msg, currentToken) = await CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            var osClient = param["OsClient"].Val<string>();
            var apiEngineKey = param["ApiEngineKey"].Val<string>();
            var apiV8Code = param["ApiV8Code"].Val<string>();

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient");
            }

            if (apiEngineKey.DosIsNullOrWhiteSpace())
            {
                return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            }

            try
            {
                var getResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _Where = new[] {
                        new { Name = "ApiEngineKey", Value = apiEngineKey, Type = "=" },
                        new { Name = "IsDeleted", Value = "0", Type = "=" }
                    }
                });

                if (getResult.Code != 1 || getResult.Data == null)
                {
                    return Ok(new DosResult(0, null, $"未找到接口引擎：{apiEngineKey}"));
                }

                var id = (string)getResult.Data.Id;
                var encodedCode = V8Base64.StringToBase64(apiV8Code ?? "");

                var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_apiengine", new
                {
                    OsClient = osClient,
                    Id = id,
                    ApiV8Code = encodedCode,
                    UpdateTime = DateTime.Now
                });

                if (updateResult.Code == 1)
                {
                    var cache = MicroiEngine.CacheTenant.Cache(osClient);
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{apiEngineKey.ToLower()}");
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{id.ToLower()}");

                    return Ok(new DosResult(1, new { 
                        Message = $"接口引擎 [{apiEngineKey}] 代码已同步到数据库",
                        UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }));
                }

                return Ok(updateResult);
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "更新接口引擎代码失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 批量检查代码版本（用于冲突检测）
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CheckVersions([FromBody] JObject param)
        {
            var (ok, msg, currentToken) = await CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            var osClient = param["OsClient"].Val<string>();
            var items = param["Items"]?.ToObject<List<VersionCheckItem>>();

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient");
            }

            if (items == null || items.Count == 0)
            {
                return Ok(new DosResult(0, null, "Items 不能为空"));
            }

            try
            {
                var conflicts = new List<dynamic>();

                foreach (var item in items)
                {
                    var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                    {
                        OsClient = osClient,
                        _SelectFields = new[] { "ApiEngineKey", "UpdateTime", "ApiV8Code" },
                        _Where = new[] {
                            new { Name = "ApiEngineKey", Value = item.ApiEngineKey, Type = "=" },
                            new { Name = "IsDeleted", Value = "0", Type = "=" }
                        }
                    });

                    if (result.Code == 1 && result.Data != null)
                    {
                        var dbUpdateTime = result.Data.UpdateTime;
                        if (dbUpdateTime != null)
                        {
                            var dbTime = (DateTime)dbUpdateTime;
                            if (!string.IsNullOrEmpty(item.LocalUpdateTime))
                            {
                                var localTime = DateTime.Parse(item.LocalUpdateTime);
                                if (dbTime > localTime)
                                {
                                    var dbCode = V8Base64.Base64ToString((string)result.Data.ApiV8Code ?? "");
                                    conflicts.Add(new
                                    {
                                        ApiEngineKey = item.ApiEngineKey,
                                        LocalUpdateTime = item.LocalUpdateTime,
                                        DbUpdateTime = dbTime.ToString("yyyy-MM-dd HH:mm:ss"),
                                        DbCode = dbCode
                                    });
                                }
                            }
                        }
                    }
                }

                return Ok(new DosResult(1, new
                {
                    HasConflicts = conflicts.Count > 0,
                    Conflicts = conflicts,
                    ServerTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                }));
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "检查版本失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 执行接口引擎代码（远程调试）
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> ExecuteApiEngine([FromBody] JObject param)
        {
            var (ok, msg, currentToken) = await CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            var osClient = param["OsClient"].Val<string>();
            var apiEngineKey = param["ApiEngineKey"].Val<string>();
            var v8Code = param["V8Code"].Val<string>();
            var paramData = param["Param"] as JObject ?? new JObject();

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient");
            }

            if (v8Code.DosIsNullOrWhiteSpace() && apiEngineKey.DosIsNullOrWhiteSpace())
            {
                return Ok(new DosResult(0, null, "V8Code 和 ApiEngineKey 不能同时为空"));
            }

            try
            {
                // 如果没传代码，从数据库获取
                if (v8Code.DosIsNullOrWhiteSpace() && !apiEngineKey.DosIsNullOrWhiteSpace())
                {
                    var getResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                    {
                        OsClient = osClient,
                        _SelectFields = new[] { "ApiV8Code" },
                        _Where = new[] {
                            new { Name = "ApiEngineKey", Value = apiEngineKey, Type = "=" },
                            new { Name = "IsDeleted", Value = "0", Type = "=" }
                        }
                    });

                    if (getResult.Code != 1 || getResult.Data == null)
                    {
                        return Ok(new DosResult(0, null, $"未找到接口引擎：{apiEngineKey}"));
                    }

                    v8Code = V8Base64.Base64ToString((string)getResult.Data.ApiV8Code ?? "");
                }

                // 获取 OsClient 模型
                var osClientResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_osclients", new
                {
                    OsClient = osClient,
                    _Where = new[] {
                        new { Name = "OsClient", Value = osClient, Type = "=" }
                    }
                });

                // 获取 SysConfig
                var sysConfigResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_config", new
                {
                    OsClient = osClient,
                    _Where = new[] {
                        new { Name = "OsClient", Value = osClient, Type = "=" }
                    }
                });

                // 捕获 Console 输出
                var consoleOutput = new StringBuilder();
                var originalOut = Console.Out;
                var stringWriter = new System.IO.StringWriter(consoleOutput);

                var v8EngineParam = new V8EngineParam()
                {
                    HttpContext = HttpContext,
                    OsClient = osClient,
                    OsClientModel = osClientResult?.Data,
                    SysConfig = sysConfigResult?.Data,
                    EventName = apiEngineKey ?? "DebugExecute",
                    ApiEngineKey = apiEngineKey ?? "",
                    InvokeType = "Server",
                    Param = paramData,
                    CurrentUser = currentToken.CurrentUser,
                    CurrentSysUser = currentToken.CurrentUser,
                    V8Code = v8Code,
                    Action = new Dictionary<string, object>()
                };

                Console.SetOut(stringWriter);
                try
                {
                    var v8RunResult = await MicroiEngine.V8Engine.Run(v8EngineParam);
                    Console.SetOut(originalOut);

                    if (v8RunResult.Code == 1)
                    {
                        var resultParam = v8RunResult.Data;
                        return Ok(new DosResult(1, new
                        {
                            Result = resultParam?.Result,
                            ConsoleOutput = consoleOutput.ToString(),
                            ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                        }));
                    }
                    else
                    {
                        return Ok(new DosResult(0, new
                        {
                            ConsoleOutput = consoleOutput.ToString(),
                            ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                        }, v8RunResult.Msg ?? "执行失败"));
                    }
                }
                catch (Exception runEx)
                {
                    Console.SetOut(originalOut);
                    return Ok(new DosResult(0, new
                    {
                        ConsoleOutput = consoleOutput.ToString(),
                        Error = runEx.Message,
                        StackTrace = runEx.StackTrace,
                        ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }, "V8引擎执行异常：" + runEx.Message));
                }
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "执行接口引擎失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 获取 V8 事件列表（表单引擎的 V8 事件代码）
        /// 读取 Diy_Table 中的 V8 相关字段
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetV8EventList(string osClient)
        {
            var (ok, msg, currentToken) = await CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient");
            }

            if (osClient.DosIsNullOrWhiteSpace())
            {
                return Ok(new DosResult(0, null, "OsClient 不能为空"));
            }

            try
            {
                // V8事件字段列表
                var v8EventFields = new[] {
                    "SubmitBeforeServerV8",  // 后端表单提交前V8事件
                    "SubmitAfterServerV8",   // 后端表单提交后V8事件
                    "SubmitFormV8",           // 前端表单提交V8事件
                    "ServerDataV8",           // 服务器端数据V8事件
                    "InFormV8",               // 进入表单V8事件
                    "OutFormV8"               // 离开表单V8事件
                };

                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("Diy_Table", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name" }
                        .Concat(v8EventFields)
                        .ToArray(),
                    _Where = new[] {
                       new { Name = "IsDeleted", Value = "0", Type = "=" }
                    }
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var list = new List<dynamic>();

                    foreach (var item in result.Data)
                    {
                        var tableName = (string)item.Name ?? "";
                        if (tableName.DosIsNullOrWhiteSpace()) continue;

                        foreach (var field in v8EventFields)
                        {
                            var code = "";
                            try
                            {
                                var rawValue = ((JObject)JObject.FromObject(item))[field]?.ToString() ?? "";
                                if (!rawValue.DosIsNullOrWhiteSpace())
                                {
                                    code = V8Base64.Base64ToString(rawValue);
                                    if (code.DosIsNullOrWhiteSpace())
                                    {
                                        code = rawValue; // 可能不是 Base64 编码
                                    }
                                }
                            }
                            catch
                            {
                                try { code = (string)((IDictionary<string, object>)item)[field] ?? ""; } catch { }
                            }

                            if (!code.DosIsNullOrWhiteSpace())
                            {
                                var eventName = field switch
                                {
                                    "SubmitBeforeServerV8" => "后端表单提交前",
                                    "SubmitAfterServerV8" => "后端表单提交后",
                                    "SubmitFormV8" => "前端表单提交",
                                    "ServerDataV8" => "服务器端数据",
                                    "InFormV8" => "进入表单",
                                    "OutFormV8" => "离开表单",
                                    _ => field
                                };

                                list.Add(new
                                {
                                    Id = (string)item.Id,
                                    FormEngineKey = tableName,
                                    EventType = field,
                                    EventName = eventName,
                                    V8Code = code,
                                    UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                                });
                            }
                        }
                    }

                    return Ok(new DosResult(1, new
                    {
                        OsClient = osClient,
                        List = list,
                        Total = list.Count
                    }));
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "获取V8事件列表失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 更新 V8 事件代码（本地 → 数据库）
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> UpdateV8EventCode([FromBody] JObject param)
        {
            var (ok, msg, currentToken) = await CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            var osClient = param["OsClient"].Val<string>();
            var formEngineKey = param["FormEngineKey"].Val<string>();
            var eventType = param["EventType"].Val<string>();
            var v8Code = param["V8Code"].Val<string>();

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient");
            }

            if (formEngineKey.DosIsNullOrWhiteSpace())
            {
                return Ok(new DosResult(0, null, "FormEngineKey 不能为空"));
            }

            // 验证事件类型
            var validEventTypes = new[] {
                "SubmitBeforeServerV8", "SubmitAfterServerV8", "SubmitFormV8",
                "ServerDataV8", "InFormV8", "OutFormV8"
            };
            if (!validEventTypes.Contains(eventType))
            {
                return Ok(new DosResult(0, null, $"无效的事件类型：{eventType}"));
            }

            try
            {
                // 查找 Diy_Table 记录
                var getResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("Diy_Table", new
                {
                    OsClient = osClient,
                    _Where = new[] {
                        new { Name = "Name", Value = formEngineKey, Type = "=" },
                        new { Name = "IsDeleted", Value = "0", Type = "=" }
                    }
                });

                if (getResult.Code != 1 || getResult.Data == null)
                {
                    return Ok(new DosResult(0, null, $"未找到表单引擎：{formEngineKey}"));
                }

                var id = (string)getResult.Data.Id;
                var encodedCode = V8Base64.StringToBase64(v8Code ?? "");

                // 动态构建更新参数
                var updateParam = new JObject
                {
                    ["OsClient"] = osClient,
                    ["Id"] = id,
                    [eventType] = encodedCode
                };

                var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync("Diy_Table", updateParam);

                if (updateResult.Code == 1)
                {
                    // 清除缓存
                    var cache = MicroiEngine.CacheTenant.Cache(osClient);
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:Diy_Table:{formEngineKey.ToLower()}");
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:Diy_Table:{id.ToLower()}");

                    return Ok(new DosResult(1, new
                    {
                        Message = $"表单引擎 [{formEngineKey}] 的 {eventType} 事件代码已同步到数据库",
                        UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }));
                }

                return Ok(updateResult);
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "更新V8事件代码失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 执行 V8 事件代码（远程调试）
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> ExecuteV8Event([FromBody] JObject param)
        {
            var (ok, msg, currentToken) = await CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            var osClient = param["OsClient"].Val<string>();
            var formEngineKey = param["FormEngineKey"].Val<string>();
            var eventType = param["EventType"].Val<string>();
            var v8Code = param["V8Code"].Val<string>();
            var formData = param["Form"] as JObject ?? new JObject();

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient");
            }

            if (v8Code.DosIsNullOrWhiteSpace())
            {
                return Ok(new DosResult(0, null, "V8Code 不能为空"));
            }

            try
            {
                var sysConfigResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_config", new
                {
                    OsClient = osClient,
                    _Where = new[] {
                        new { Name = "OsClient", Value = osClient, Type = "=" }
                    }
                });

                var consoleOutput = new StringBuilder();
                var originalOut = Console.Out;
                var stringWriter = new System.IO.StringWriter(consoleOutput);

                var v8EngineParam = new V8EngineParam()
                {
                    HttpContext = HttpContext,
                    OsClient = osClient,
                    SysConfig = sysConfigResult?.Data,
                    EventName = eventType ?? "DebugEvent",
                    InvokeType = "Server",
                    Form = formData,
                    Param = new JObject(),
                    CurrentUser = currentToken.CurrentUser,
                    CurrentSysUser = currentToken.CurrentUser,
                    V8Code = v8Code,
                    Action = new Dictionary<string, object>()
                };

                Console.SetOut(stringWriter);
                try
                {
                    var v8RunResult = await MicroiEngine.V8Engine.Run(v8EngineParam);
                    Console.SetOut(originalOut);

                    if (v8RunResult.Code == 1)
                    {
                        var resultParam = v8RunResult.Data;
                        return Ok(new DosResult(1, new
                        {
                            Result = resultParam?.Result,
                            ConsoleOutput = consoleOutput.ToString(),
                            ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                        }));
                    }
                    else
                    {
                        return Ok(new DosResult(0, new
                        {
                            ConsoleOutput = consoleOutput.ToString(),
                            ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                        }, v8RunResult.Msg ?? "执行失败"));
                    }
                }
                catch (Exception runEx)
                {
                    Console.SetOut(originalOut);
                    return Ok(new DosResult(0, new
                    {
                        ConsoleOutput = consoleOutput.ToString(),
                        Error = runEx.Message,
                        StackTrace = runEx.StackTrace,
                        ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }, "V8事件执行异常：" + runEx.Message));
                }
            }
            catch (Exception ex)
            {
                return Ok(new DosResult(0, null, "执行V8事件失败：" + ex.Message));
            }
        }

        /// <summary>
        /// WebSocket 调试会话 (基于 SignalR 的 DiyWebSocket)
        /// 通过 HTTP 接口查询调试会话状态
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> DebugSession(string action, string sessionId)
        {
            var (ok, msg, currentToken) = await CheckPermission();
            if (!ok) return Ok(new DosResult(0, null, msg));

            switch (action?.ToLower())
            {
                case "create":
                    var newSessionId = Guid.NewGuid().ToString("N");
                    return Ok(new DosResult(1, new
                    {
                        SessionId = newSessionId,
                        WebSocketUrl = "/diy-websocket",
                        Message = "调试会话已创建，请通过 SignalR 连接 /diy-websocket 进行调试"
                    }));

                case "status":
                    if (sessionId.DosIsNullOrWhiteSpace())
                    {
                        return Ok(new DosResult(0, null, "SessionId 不能为空"));
                    }
                    return Ok(new DosResult(1, new
                    {
                        SessionId = sessionId,
                        Status = "active",
                        ServerTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }));

                default:
                    return Ok(new DosResult(0, null, "无效的 action 参数，支持: create, status"));
            }
        }

        /// <summary>
        /// 版本检查项
        /// </summary>
        public class VersionCheckItem
        {
            public string ApiEngineKey { get; set; }
            public string LocalUpdateTime { get; set; }
        }
    }
}
