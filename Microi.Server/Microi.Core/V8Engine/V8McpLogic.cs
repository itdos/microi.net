#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8McpLogic.cs
* Copyright(c) Microi.net
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：2026-03-21
* 文件描述：V8引擎 MCP 核心业务逻辑
*           包含：权限校验、引擎列表/详情、代码同步、远程执行、V8事件、数据库结构获取
*           此文件位于开源项目 Microi.Core 中
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// V8 MCP 核心业务逻辑（不依赖 MVC Controller）
    /// </summary>
    public static class V8McpLogic
    {
        #region 权限校验

        /// <summary>
        /// 校验当前用户权限（Level >= 9999）
        /// </summary>
        public static async Task<(bool ok, string msg, dynamic token)> CheckPermission()
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

        #endregion

        #region GetStatus

        /// <summary>
        /// 获取调试状态信息
        /// </summary>
        public static object BuildStatusData(dynamic currentToken)
        {
            return new
            {
                IsDebugMode = true,
                Environment = System.Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                DebuggerAttached = Debugger.IsAttached,
                LocalV8DebugPath = ConfigHelper.GetAppSettings("LocalV8DebugPath") ?? "",
                OsClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient") ?? "",
                OsClientType = ConfigHelper.GetAppSettings("OsClientType") ?? "Product",
                OsClientNetwork = ConfigHelper.GetAppSettings("OsClientNetwork") ?? "Internal"
            };
        }

        #endregion

        #region GetApiEngineList

        /// <summary>
        /// 获取所有接口引擎列表
        /// </summary>
        public static async Task<DosResult<object>> GetApiEngineList(string osClient)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "ApiName", "ApiEngineKey", "Category", "ApiAddress", "IsEnable", "ApiRemark", "ApiV8Code", "UpdateTime" },
                    _Where = new List<object>()
                    {
                        
                    }
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
                    return new DosResult<object>(1, new
                    {
                        OsClient = osClient,
                        OsClientType = ConfigHelper.GetAppSettings("OsClientType") ?? "Product",
                        OsClientNetwork = ConfigHelper.GetAppSettings("OsClientNetwork") ?? "Internal",
                        List = list,
                        Total = list.Count
                    });
                }

                return new DosResult<object>(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取接口引擎列表失败：" + ex.Message);
            }
        }

        #endregion

        #region GetApiEngine

        /// <summary>
        /// 获取单个接口引擎详情
        /// </summary>
        public static async Task<DosResult<object>> GetApiEngine(string osClient, string apiEngineKey)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "ApiEngineKey", "=", apiEngineKey },
                        
                    }
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var item = result.Data;
                    var apiV8Code = (string)item.ApiV8Code ?? "";
                    apiV8Code = V8Base64.Base64ToString(apiV8Code);

                    return new DosResult<object>(1, new
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
                    });
                }

                return new DosResult<object>(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取接口引擎失败：" + ex.Message);
            }
        }

        #endregion

        #region GetApiEngineCode

        /// <summary>
        /// 获取单个接口引擎的远程代码（用于 Diff 对比）
        /// </summary>
        public static async Task<DosResult<object>> GetApiEngineCode(string osClient, string apiEngineKey)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "ApiEngineKey", "ApiV8Code", "UpdateTime" },
                    _Where = new List<object>()
                    {
                        new List<object>() { "ApiEngineKey", "=", apiEngineKey },
                        
                    }
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var apiV8Code = (string)result.Data.ApiV8Code ?? "";
                    apiV8Code = V8Base64.Base64ToString(apiV8Code);

                    return new DosResult<object>(1, new
                    {
                        ApiEngineKey = apiEngineKey,
                        ApiV8Code = apiV8Code,
                        UpdateTime = result.Data.UpdateTime?.ToString("yyyy-MM-dd HH:mm:ss") ?? ""
                    });
                }

                return new DosResult<object>(0, null, $"未找到接口引擎：{apiEngineKey}");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取接口引擎代码失败：" + ex.Message);
            }
        }

        #endregion

        #region GetUpdatedApiEngines

        /// <summary>
        /// 获取增量更新的接口引擎列表
        /// </summary>
        public static async Task<DosResult<object>> GetUpdatedApiEngines(string osClient, string lastSyncTime)
        {
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
                    _Where = new List<object>()
                    {
                        new List<object>() { "UpdateTime", ">", syncTime.ToString("yyyy-MM-dd HH:mm:ss") }
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
                    return new DosResult<object>(1, new
                    {
                        OsClient = osClient,
                        List = list,
                        Total = list.Count,
                        ServerTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    });
                }

                return new DosResult<object>(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取增量更新列表失败：" + ex.Message);
            }
        }

        #endregion

        #region UpdateApiEngineCode

        /// <summary>
        /// 更新接口引擎代码（本地 → 数据库）
        /// </summary>
        public static async Task<DosResult<object>> UpdateApiEngineCode(string osClient, string apiEngineKey, string apiV8Code)
        {
            try
            {
                var getResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "ApiEngineKey", "=", apiEngineKey },
                        
                    }
                });

                if (getResult.Code != 1 || getResult.Data == null)
                {
                    return new DosResult<object>(0, null, $"未找到接口引擎：{apiEngineKey}");
                }

                var id = (string)getResult.Data.Id;
                var existingApiAddress = (string)getResult.Data.ApiAddress ?? "";
                var existingApiName = (string)getResult.Data.ApiName ?? "";

                var updateParam = new JObject
                {
                    ["OsClient"] = osClient,
                    ["Id"] = id,
                    ["ApiEngineKey"] = apiEngineKey,
                    ["ApiAddress"] = existingApiAddress,
                    ["ApiName"] = existingApiName,
                    ["ApiV8Code"] = apiV8Code ?? "",
                    ["UpdateTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    ["_InvokeType"] = "Client"
                };
                var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_apiengine", updateParam);

                if (updateResult.Code == 1)
                {
                    var cache = MicroiEngine.CacheTenant.Cache(osClient);
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{apiEngineKey.ToLower()}");
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{id.ToLower()}");

                    return new DosResult<object>(1, new
                    {
                        Message = $"接口引擎 [{apiEngineKey}] 代码已同步到数据库",
                        UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    });
                }

                return new DosResult<object>(updateResult.Code, updateResult.Data, updateResult.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "更新接口引擎代码失败：" + ex.Message);
            }
        }

        #endregion

        #region CreateApiEngine

        /// <summary>
        /// 新增接口引擎
        /// </summary>
        public static async Task<DosResult<object>> CreateApiEngine(
            string osClient, string apiName, string apiEngineKey,
            string apiAddress, string apiRemark, int lockVal, int allowAnonymous,
            int isEnable, string category, string apiV8Code = null)
        {
            try
            {
                // 检查 ApiEngineKey 是否已存在
                var existResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "ApiEngineKey", "=", apiEngineKey },
                        
                    }
                });
                if (existResult.Code == 1 && existResult.Data != null)
                {
                    return new DosResult<object>(0, null, $"ApiEngineKey [{apiEngineKey}] 已存在");
                }

                var addResult = await MicroiEngine.FormEngine.AddFormDataAsync("sys_apiengine", new JObject
                {
                    ["OsClient"] = osClient,
                    ["ApiName"] = apiName,
                    ["ApiEngineKey"] = apiEngineKey,
                    ["ApiAddress"] = apiAddress ?? "",
                    ["ApiRemark"] = apiRemark ?? "",
                    ["Lock"] = lockVal,
                    ["AllowAnonymous"] = allowAnonymous,
                    ["IsEnable"] = isEnable,
                    ["Category"] = category ?? "未分类",
                    ["ApiV8Code"] = apiV8Code ?? "",
                    ["ApiRole"] = "[]",
                    ["EnableLog"] = 0,
                    ["StopHttp"] = 0,
                    ["Timeout"] = 600,
                    ["MaxStatements"] = 100000000,
                    ["LimitMemory"] = 2048,
                    ["LimitRecursion"] = 10000,
                    ["Files"] = "[]",
                    ["IsDeleted"] = 0,
                    ["UpdateTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    ["_InvokeType"] = "Client"
                });

                if (addResult.Code == 1)
                {
                    return new DosResult<object>(1, new
                    {
                        Message = $"接口引擎 [{apiEngineKey}] 创建成功",
                        ApiEngineKey = apiEngineKey,
                        Category = category ?? "未分类"
                    });
                }

                return new DosResult<object>(addResult.Code, addResult.Data, addResult.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "创建接口引擎失败：" + ex.Message);
            }
        }

        #endregion

        #region CheckVersions

        /// <summary>
        /// 版本检查项
        /// </summary>
        public class VersionCheckItem
        {
            public string ApiEngineKey { get; set; }
            public string LocalUpdateTime { get; set; }
        }

        /// <summary>
        /// 批量检查代码版本（用于冲突检测）
        /// </summary>
        public static async Task<DosResult<object>> CheckVersions(string osClient, List<VersionCheckItem> items)
        {
            try
            {
                var conflicts = new List<dynamic>();

                foreach (var item in items)
                {
                    var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                    {
                        OsClient = osClient,
                        _SelectFields = new[] { "ApiEngineKey", "UpdateTime", "ApiV8Code" },
                        _Where = new List<object>()
                        {
                            new List<object>() { "ApiEngineKey", "=", item.ApiEngineKey },
                            
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

                return new DosResult<object>(1, new
                {
                    HasConflicts = conflicts.Count > 0,
                    Conflicts = conflicts,
                    ServerTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "检查版本失败：" + ex.Message);
            }
        }

        #endregion

        #region ExecuteApiEngine

        /// <summary>
        /// 执行接口引擎代码（远程调试）
        /// </summary>
        public static async Task<DosResult<object>> ExecuteApiEngine(
            string osClient, string apiEngineKey, string v8Code,
            JObject paramData, dynamic currentToken, HttpContext httpContext)
        {
            if (v8Code.DosIsNullOrWhiteSpace() && apiEngineKey.DosIsNullOrWhiteSpace())
            {
                return new DosResult<object>(0, null, "V8Code 和 ApiEngineKey 不能同时为空");
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
                        _Where = new List<object>()
                        {
                            new List<object>() { "ApiEngineKey", "=", apiEngineKey },
                            
                        }
                    });

                    if (getResult.Code != 1 || getResult.Data == null)
                    {
                        return new DosResult<object>(0, null, $"未找到接口引擎：{apiEngineKey}");
                    }

                    v8Code = V8Base64.Base64ToString((string)getResult.Data.ApiV8Code ?? "");
                }

                // 获取 OsClient 模型
                var osClientResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_osclients", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "OsClient", "=", osClient }
                    }
                });

                // 获取 SysConfig
                var sysConfigResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_config", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "OsClient", "=", osClient }
                    }
                });

                // 捕获 Console 输出
                var consoleOutput = new StringBuilder();
                var originalOut = Console.Out;
                var stringWriter = new System.IO.StringWriter(consoleOutput);

                var v8EngineParam = new V8EngineParam()
                {
                    HttpContext = httpContext,
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
                        return new DosResult<object>(1, new
                        {
                            Result = resultParam?.Result,
                            ConsoleOutput = consoleOutput.ToString(),
                            ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                        });
                    }
                    else
                    {
                        return new DosResult<object>(0, new
                        {
                            ConsoleOutput = consoleOutput.ToString(),
                            ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                        }, v8RunResult.Msg ?? "执行失败");
                    }
                }
                catch (Exception runEx)
                {
                    Console.SetOut(originalOut);
                    return new DosResult<object>(0, new
                    {
                        ConsoleOutput = consoleOutput.ToString(),
                        Error = runEx.Message,
                        StackTrace = runEx.StackTrace,
                        ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }, "V8引擎执行异常：" + runEx.Message);
                }
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "执行接口引擎失败：" + ex.Message);
            }
        }

        #endregion

        #region GetV8EventList

        /// <summary>
        /// V8事件字段列表
        /// </summary>
        private static readonly string[] V8EventFields = new[] {
            "SubmitBeforeServerV8",
            "SubmitAfterServerV8",
            "SubmitFormV8",
            "ServerDataV8",
            "InFormV8",
            "OutFormV8"
        };

        /// <summary>
        /// V8事件字段→中文名映射
        /// </summary>
        private static string GetEventDisplayName(string field) => field switch
        {
            "SubmitBeforeServerV8" => "后端表单提交前",
            "SubmitAfterServerV8" => "后端表单提交后",
            "SubmitFormV8" => "前端表单提交",
            "ServerDataV8" => "服务器端数据",
            "InFormV8" => "进入表单",
            "OutFormV8" => "离开表单",
            _ => field
        };

        /// <summary>
        /// 获取 V8 事件列表
        /// </summary>
        public static async Task<DosResult<object>> GetV8EventList(string osClient)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("Diy_Table", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "Description" }
                        .Concat(V8EventFields)
                        .ToArray(),
                    _Where = new List<object>()
                    {
                        
                    }
                });

                if (result.Code == 1 && result.Data != null)
                {
                    var list = new List<dynamic>();

                    foreach (var item in result.Data)
                    {
                        var tableName = (string)item.Name ?? "";
                        if (tableName.DosIsNullOrWhiteSpace()) continue;
                        var tableDescription = (string)item.Description ?? "";

                        foreach (var field in V8EventFields)
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
                                        code = rawValue;
                                    }
                                }
                            }
                            catch
                            {
                                try { code = (string)((IDictionary<string, object>)item)[field] ?? ""; } catch { }
                            }

                            if (!code.DosIsNullOrWhiteSpace())
                            {
                                list.Add(new
                                {
                                    Id = (string)item.Id,
                                    FormEngineKey = tableName,
                                    Description = tableDescription,
                                    EventType = field,
                                    EventName = GetEventDisplayName(field),
                                    V8Code = code,
                                    UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                                });
                            }
                        }
                    }

                    return new DosResult<object>(1, new
                    {
                        OsClient = osClient,
                        List = list,
                        Total = list.Count
                    });
                }

                return new DosResult<object>(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取V8事件列表失败：" + ex.Message);
            }
        }

        #endregion

        #region GetV8EventCode

        /// <summary>
        /// 获取单个 V8 事件代码
        /// </summary>
        public static async Task<DosResult<object>> GetV8EventCode(string osClient, string formEngineKey, string eventType)
        {
            if (!V8EventFields.Contains(eventType))
            {
                return new DosResult<object>(0, null, $"无效的事件类型：{eventType}");
            }

            try
            {
                var getResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("Diy_Table", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "Description", eventType },
                    _Where = new List<object>()
                    {
                        new List<object>() { "Name", "=", formEngineKey },
                        
                    }
                });

                if (getResult.Code != 1 || getResult.Data == null)
                {
                    return new DosResult<object>(0, null, $"未找到表单引擎：{formEngineKey}");
                }

                var code = "";
                try
                {
                    var rawValue = ((JObject)JObject.FromObject(getResult.Data))[eventType]?.ToString() ?? "";
                    if (!rawValue.DosIsNullOrWhiteSpace())
                    {
                        code = V8Base64.Base64ToString(rawValue);
                        if (code.DosIsNullOrWhiteSpace())
                        {
                            code = rawValue;
                        }
                    }
                }
                catch
                {
                    try { code = (string)((IDictionary<string, object>)getResult.Data)[eventType] ?? ""; } catch { }
                }

                return new DosResult<object>(1, new
                {
                    Id = (string)getResult.Data.Id,
                    FormEngineKey = formEngineKey,
                    Description = (string)getResult.Data.Description ?? "",
                    EventType = eventType,
                    EventName = GetEventDisplayName(eventType),
                    Code = code,
                    UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取V8事件代码失败：" + ex.Message);
            }
        }

        #endregion

        #region UpdateV8EventCode

        /// <summary>
        /// 有效的事件类型列表
        /// </summary>
        private static readonly string[] ValidEventTypes = new[] {
            "SubmitBeforeServerV8", "SubmitAfterServerV8", "SubmitFormV8",
            "ServerDataV8", "InFormV8", "OutFormV8"
        };

        /// <summary>
        /// 更新 V8 事件代码
        /// </summary>
        public static async Task<DosResult<object>> UpdateV8EventCode(string osClient, string formEngineKey, string eventType, string v8Code)
        {
            if (!ValidEventTypes.Contains(eventType))
            {
                return new DosResult<object>(0, null, $"无效的事件类型：{eventType}");
            }

            try
            {
                var getResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("Diy_Table", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "Name", "=", formEngineKey },
                        
                    }
                });

                if (getResult.Code != 1 || getResult.Data == null)
                {
                    return new DosResult<object>(0, null, $"未找到表单引擎：{formEngineKey}");
                }

                var id = (string)getResult.Data.Id;
                var existingName = (string)getResult.Data.Name ?? "";

                var updateParam = new JObject
                {
                    ["OsClient"] = osClient,
                    ["Id"] = id,
                    ["Name"] = existingName,
                    [eventType] = v8Code ?? "",
                    ["_InvokeType"] = "Client"
                };

                var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync("Diy_Table", updateParam);

                if (updateResult.Code == 1)
                {
                    var cache = MicroiEngine.CacheTenant.Cache(osClient);
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:Diy_Table:{formEngineKey.ToLower()}");
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:Diy_Table:{id.ToLower()}");

                    return new DosResult<object>(1, new
                    {
                        Message = $"表单引擎 [{formEngineKey}] 的 {eventType} 事件代码已同步到数据库",
                        UpdateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    });
                }

                return new DosResult<object>(updateResult.Code, updateResult.Data, updateResult.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "更新V8事件代码失败：" + ex.Message);
            }
        }

        #endregion

        #region ExecuteV8Event

        /// <summary>
        /// 执行 V8 事件代码（远程调试）
        /// </summary>
        public static async Task<DosResult<object>> ExecuteV8Event(
            string osClient, string eventType, string v8Code,
            JObject formData, dynamic currentToken, HttpContext httpContext)
        {
            try
            {
                var sysConfigResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_config", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "OsClient", "=", osClient }
                    }
                });

                var consoleOutput = new StringBuilder();
                var originalOut = Console.Out;
                var stringWriter = new System.IO.StringWriter(consoleOutput);

                var v8EngineParam = new V8EngineParam()
                {
                    HttpContext = httpContext,
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
                        return new DosResult<object>(1, new
                        {
                            Result = resultParam?.Result,
                            ConsoleOutput = consoleOutput.ToString(),
                            ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                        });
                    }
                    else
                    {
                        return new DosResult<object>(0, new
                        {
                            ConsoleOutput = consoleOutput.ToString(),
                            ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                        }, v8RunResult.Msg ?? "执行失败");
                    }
                }
                catch (Exception runEx)
                {
                    Console.SetOut(originalOut);
                    return new DosResult<object>(0, new
                    {
                        ConsoleOutput = consoleOutput.ToString(),
                        Error = runEx.Message,
                        StackTrace = runEx.StackTrace,
                        ExecuteTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }, "V8事件执行异常：" + runEx.Message);
                }
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "执行V8事件失败：" + ex.Message);
            }
        }

        #endregion

        #region GetDbSchema

        /// <summary>
        /// 获取数据库结构（表、字段、菜单树）
        /// 对应 ai-helper/microi/get-db.js 的功能
        /// </summary>
        public static async Task<DosResult<object>> GetDbSchema(string osClient)
        {
            try
            {
                // 步骤1：查询 diy_table 表数据
                var tableResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_table", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "Description" },
                    PageSize = 10000,
                    _OrderBy = "Name",
                    _OrderByType = "ASC"
                });

                if (tableResult.Code != 1)
                {
                    return new DosResult<object>(0, null, "查询 diy_table 失败：" + tableResult.Msg);
                }

                var tables = tableResult.Data ?? new List<dynamic>();

                // 步骤2：查询 diy_field 表数据
                var fieldResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_field", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "Label", "Description", "Type", "Component", "TableId", "Config" },
                    PageSize = 50000,
                    _OrderBy = "TableId",
                    _OrderByType = "ASC"
                });

                if (fieldResult.Code != 1)
                {
                    return new DosResult<object>(0, null, "查询 diy_field 失败：" + fieldResult.Msg);
                }

                var fields = fieldResult.Data ?? new List<dynamic>();

                // 步骤3：处理字段，解析 Config
                var tableFieldsMap = new Dictionary<string, List<object>>();
                foreach (var field in fields)
                {
                    string tableId = (string)field.TableId ?? "";
                    string tableChildTableId = null;
                    string tableChildSysMenuId = null;

                    // 解析 Config JSON
                    var configStr = (string)field.Config;
                    if (!string.IsNullOrWhiteSpace(configStr))
                    {
                        try
                        {
                            var configObj = JObject.Parse(configStr);
                            tableChildTableId = configObj["TableChildTableId"]?.ToString();
                            tableChildSysMenuId = configObj["TableChildSysMenuId"]?.ToString();
                        }
                        catch { }
                    }

                    if (!tableFieldsMap.ContainsKey(tableId))
                    {
                        tableFieldsMap[tableId] = new List<object>();
                    }

                    tableFieldsMap[tableId].Add(new
                    {
                        Id = (string)field.Id,
                        Name = (string)field.Name,
                        Label = (string)field.Label,
                        Description = (string)field.Description,
                        Type = (string)field.Type,
                        Component = (string)field.Component,
                        TableChildTableId = tableChildTableId,
                        TableChildSysMenuId = tableChildSysMenuId
                    });
                }

                // 步骤4：组装 Tables
                var processedTables = new List<object>();
                foreach (var table in tables)
                {
                    var tableId = (string)table.Id ?? "";
                    processedTables.Add(new
                    {
                        Id = tableId,
                        Name = (string)table.Name,
                        Description = (string)table.Description,
                        _Fields = tableFieldsMap.ContainsKey(tableId) ? tableFieldsMap[tableId] : new List<object>()
                    });
                }

                // 步骤5：查询 sys_menu 表数据
                var menuResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_menu", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "ParentId", "DiyTableId" },
                    PageSize = 10000,
                    _OrderBy = "Id",
                    _OrderByType = "ASC"
                });

                var rootMenus = new List<object>();
                if (menuResult.Code == 1 && menuResult.Data != null)
                {
                    // 步骤6：构建菜单树
                    var menuMap = new Dictionary<string, JObject>();
                    foreach (var menu in menuResult.Data)
                    {
                        var menuId = (string)menu.Id ?? "";
                        menuMap[menuId] = new JObject
                        {
                            ["Id"] = (string)menu.Id,
                            ["Name"] = (string)menu.Name,
                            ["ParentId"] = (string)menu.ParentId,
                            ["DiyTableId"] = (string)menu.DiyTableId,
                            ["_Child"] = new JArray()
                        };
                    }

                    foreach (var kvp in menuMap)
                    {
                        var parentId = kvp.Value["ParentId"]?.ToString();
                        if (!string.IsNullOrEmpty(parentId) && menuMap.ContainsKey(parentId))
                        {
                            ((JArray)menuMap[parentId]["_Child"]).Add(kvp.Value);
                        }
                        else
                        {
                            rootMenus.Add(kvp.Value);
                        }
                    }
                }

                return new DosResult<object>(1, new
                {
                    Tables = processedTables,
                    Menus = rootMenus,
                    Summary = new
                    {
                        TableCount = processedTables.Count,
                        FieldCount = fields is IEnumerable<dynamic> fieldList ? fieldList.Count() : 0,
                        MenuCount = rootMenus.Count
                    }
                }, "获取数据库结构成功");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取数据库结构失败：" + ex.Message);
            }
        }

        #endregion

        #region CreateTable

        /// <summary>
        /// 新增自定义表（diy_table）
        /// </summary>
        public static async Task<DosResult<object>> CreateTable(string osClient, string name, string description,
            string tabs = null, int isTree = 0, int column = 1, string formOpenType = null, string formOpenWidth = null)
        {
            try
            {
                // 检查表名是否已存在
                var existResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "Name", "=", name },
                        
                    }
                });
                if (existResult.Code == 1 && existResult.Data != null)
                {
                    return new DosResult<object>(0, null, $"表名 [{name}] 已存在");
                }

                var id = Ulid.NewUlid().ToString();
                var tableData = new JObject
                {
                    ["OsClient"] = osClient,
                    ["Id"] = id,
                    ["Name"] = name,
                    ["Description"] = description ?? "",
                    ["IsDeleted"] = 0,
                    ["_InvokeType"] = "Client"
                };
                if (!string.IsNullOrWhiteSpace(tabs)) tableData["Tabs"] = tabs;
                if (isTree > 0) tableData["IsTree"] = isTree;
                if (column > 1) tableData["Column"] = column;
                if (!string.IsNullOrWhiteSpace(formOpenType)) tableData["FormOpenType"] = formOpenType;
                if (!string.IsNullOrWhiteSpace(formOpenWidth)) tableData["FormOpenWidth"] = formOpenWidth;

                var addResult = await MicroiEngine.FormEngine.AddFormDataAsync("diy_table", tableData);

                if (addResult.Code == 1)
                {
                    return new DosResult<object>(1, new
                    {
                        Message = $"自定义表 [{name}] 创建成功",
                        TableId = id,
                        Name = name
                    });
                }

                return new DosResult<object>(addResult.Code, addResult.Data, addResult.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "创建自定义表失败：" + ex.Message);
            }
        }

        #endregion

        #region AddField

        /// <summary>
        /// 常用编程类型→MySQL列类型映射（兼容 AI 传入的非 MySQL 类型）
        /// </summary>
        private static readonly Dictionary<string, string> FieldTypeMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["string"] = "varchar(500)",
            ["text"] = "varchar(500)",
            ["number"] = "int",
            ["integer"] = "int",
            ["float"] = "decimal(18,2)",
            ["double"] = "decimal(18,2)",
            ["boolean"] = "int",
            ["bool"] = "int",
            ["date"] = "datetime",
            ["timestamp"] = "datetime",
            ["long"] = "bigint",
            ["json"] = "mediumtext",
        };

        /// <summary>
        /// 将编程语言类型自动映射为 MySQL 列类型
        /// </summary>
        private static string NormalizeFieldType(string type)
        {
            if (string.IsNullOrWhiteSpace(type)) return "varchar(500)";
            var trimmed = type.Trim();
            return FieldTypeMap.TryGetValue(trimmed, out var mapped) ? mapped : trimmed;
        }

        /// <summary>
        /// 为自定义表添加字段
        /// </summary>
        public static async Task<DosResult<object>> AddField(
            string osClient, string tableId, string name, string label,
            string type, string component, int visible, int appVisible,
            string tab, int tableWidth, int sort, int nameConfirm, int readonlyVal,
            int notEmpty = 0, int unique = 0, string defaultValue = null, string placeholder = null,
            int formWidth = 24, string data = null, string config = null, string description = null,
            int encrypt = 0, int inTableEdit = 0)
        {
            try
            {
                var fieldParam = new DiyFieldParam
                {
                    OsClient = osClient,
                    Id = Ulid.NewUlid().ToString(),
                    TableId = tableId,
                    Name = name,
                    Label = label,
                    Type = NormalizeFieldType(type),
                    Component = component ?? "Text",
                    Visible = visible,
                    AppVisible = appVisible,
                    Tab = tab ?? "",
                    TableWidth = tableWidth > 0 ? tableWidth : 120,
                    Sort = sort > 0 ? sort : 100,
                    NameConfirm = nameConfirm,
                    Readonly = readonlyVal,
                    NotEmpty = notEmpty,
                    Unique = unique,
                    DefaultValue = defaultValue ?? "",
                    Placeholder = placeholder ?? "",
                    FormWidth = formWidth > 0 ? formWidth : 24,
                    Data = data ?? "",
                    Config = config ?? "",
                    Description = description ?? "",
                    Encrypt = encrypt,
                    InTableEdit = inTableEdit,
                    IsDeleted = 0,
                    _InvokeType = InvokeType.Client.ToString()
                };

                var result = await MicroiEngine.FormEngine.AddDiyField(fieldParam);

                if (result.Code == 1)
                {
                    return new DosResult<object>(1, new
                    {
                        Message = $"字段 [{label}({name})] 添加成功",
                        FieldId = fieldParam.Id,
                        TableId = tableId
                    });
                }

                return new DosResult<object>(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "添加字段失败：" + ex.Message);
            }
        }

        #endregion

        #region CreateModule

        /// <summary>
        /// 新增功能模块（sys_menu）
        /// </summary>
        public static async Task<DosResult<object>> CreateModule(
            string osClient, string name, string diyTableId,
            string componentName, string componentPath,
            int display, int appDisplay, string openType, string url,
            string parentId = null, int sort = 100,
            string icon = null, string searchFieldIds = null,
            string tableDiyFieldIds = null, string defaultOrderBy = null,
            string sqlWhere = null, string diyConfig = null)
        {
            try
            {
                // 检查模块名是否已存在
                var existResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_menu", new
                {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "Name", "=", name },
                        
                    }
                });
                if (existResult.Code == 1 && existResult.Data != null)
                {
                    return new DosResult<object>(0, null, $"模块名 [{name}] 已存在");
                }

                // 根据 DiyTableId 查询 DiyTableName
                var diyTableName = "";
                if (!string.IsNullOrWhiteSpace(diyTableId))
                {
                    var tableResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
                    {
                        OsClient = osClient,
                        Id = diyTableId,
                        _SelectFields = new[] { "Name" }
                    });
                    if (tableResult.Code == 1 && tableResult.Data != null)
                    {
                        diyTableName = (string)tableResult.Data.Name ?? "";
                    }
                }

                var id = Ulid.NewUlid().ToString();

                // 当 OpenType 为 Diy 且未指定 Url 时，自动从表名生成路由路径
                // 例如：Crm_Customer → /crm-customer, diy_lang → /diy-lang, Order_Main → /order-main
                var effectiveUrl = url;
                if (string.IsNullOrWhiteSpace(effectiveUrl) && (string.IsNullOrWhiteSpace(openType) || openType == "Diy"))
                {
                    if (!string.IsNullOrWhiteSpace(diyTableName))
                    {
                        // 将表名转换为 URL 路径：PascalCase → kebab-case，下划线 → 连字符
                        var urlPath = System.Text.RegularExpressions.Regex.Replace(diyTableName, "([a-z])([A-Z])", "$1-$2");
                        urlPath = urlPath.Replace("_", "-").ToLower();
                        effectiveUrl = "/" + urlPath;
                    }
                    else
                    {
                        // 没有绑定表时，从菜单名称的拼音或 Id 生成
                        effectiveUrl = "/menu-" + id.Substring(0, 8).ToLower();
                    }
                }

                // 检查 URL 是否已被其他菜单占用，如果是则追加随机后缀
                if (!string.IsNullOrWhiteSpace(effectiveUrl))
                {
                    var urlExistResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_menu", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>()
                        {
                            new List<object>() { "Url", "=", effectiveUrl },
                            
                        }
                    });
                    if (urlExistResult.Code == 1 && urlExistResult.Data != null)
                    {
                        effectiveUrl = effectiveUrl + "-" + id.Substring(0, 6).ToLower();
                    }
                }

                var menuData = new JObject
                {
                    ["OsClient"] = osClient,
                    ["Id"] = id,
                    ["Name"] = name,
                    ["DiyTableId"] = diyTableId ?? "",
                    ["DiyTableName"] = diyTableName,
                    ["ParentId"] = parentId ?? "",
                    ["Sort"] = sort,
                    ["ComponentName"] = componentName ?? "搜索+表格",
                    ["ComponentPath"] = componentPath ?? "/diy/diy-table-rowlist",
                    ["Display"] = display,
                    ["AppDisplay"] = appDisplay,
                    ["OpenType"] = openType ?? "Diy",
                    ["Url"] = effectiveUrl ?? "",
                    ["IsDeleted"] = 0,
                    ["_InvokeType"] = "Client"
                };
                if (!string.IsNullOrWhiteSpace(icon)) menuData["Icon"] = icon;
                if (!string.IsNullOrWhiteSpace(searchFieldIds)) menuData["SearchFieldIds"] = searchFieldIds;
                if (!string.IsNullOrWhiteSpace(tableDiyFieldIds)) menuData["TableDiyFieldIds"] = tableDiyFieldIds;
                if (!string.IsNullOrWhiteSpace(defaultOrderBy)) menuData["DefaultOrderBy"] = defaultOrderBy;
                if (!string.IsNullOrWhiteSpace(sqlWhere)) menuData["SqlWhere"] = sqlWhere;
                if (!string.IsNullOrWhiteSpace(diyConfig)) menuData["DiyConfig"] = diyConfig;

                var addResult = await MicroiEngine.FormEngine.AddFormDataAsync("sys_menu", menuData);

                if (addResult.Code == 1)
                {
                    return new DosResult<object>(1, new
                    {
                        Message = $"功能模块 [{name}] 创建成功",
                        ModuleId = id,
                        DiyTableId = diyTableId,
                        Url = effectiveUrl
                    });
                }

                return new DosResult<object>(addResult.Code, addResult.Data, addResult.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "创建功能模块失败：" + ex.Message);
            }
        }

        #endregion

        #region ResolveOsClient

        /// <summary>
        /// 解析 OsClient（如果为空则从 token 或配置中获取）
        /// </summary>
        public static string ResolveOsClient(string osClient, dynamic currentToken)
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient ?? ConfigHelper.GetAppSettings("OsClient");
            }
            return osClient;
        }

        #endregion

        #region GetPageEngineList

        /// <summary>
        /// 获取界面引擎列表（mic_page）
        /// </summary>
        public static async Task<DosResult<object>> GetPageEngineList(string osClient, string keyword = null)
        {
            try
            {
                var where = new List<object>()
                {
                    
                };
                if (!string.IsNullOrWhiteSpace(keyword))
                {
                    where.Add(new List<object>() { "AND", "(", "Title", "Like", keyword });
                    where.Add(new List<object>() { "OR", "Number", "Like", keyword });
                    where.Add(new List<object>() { "OR", "Desc", "Like", keyword, ")" });
                }

                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("mic_page", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Title", "Number", "Desc", "RoutePath", "ComponentPath", "CreateTime", "UpdateTime" },
                    _Where = where,
                    _OrderBy = "UpdateTime",
                    _OrderByType = "DESC",
                    _PageSize = 100
                });

                if (result.Code != 1)
                {
                    return new DosResult<object>(result.Code, null, result.Msg);
                }

                return new DosResult<object>(1, result.Data);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取界面引擎列表失败：" + ex.Message);
            }
        }

        #endregion

        #region GetPageEngineDetail

        /// <summary>
        /// 获取界面引擎详情（含 JsonObj）
        /// </summary>
        public static async Task<DosResult<object>> GetPageEngineDetail(string osClient, string pageId)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("mic_page", new
                {
                    OsClient = osClient,
                    Id = pageId
                });

                if (result.Code != 1 || result.Data == null)
                {
                    return new DosResult<object>(result.Code == 1 ? 2 : result.Code, null, result.Code == 1 ? "页面不存在" : result.Msg);
                }

                return new DosResult<object>(1, result.Data);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取界面引擎详情失败：" + ex.Message);
            }
        }

        #endregion

        #region SavePageEngine

        /// <summary>
        /// 保存界面引擎（新增或更新 mic_page）
        /// </summary>
        public static async Task<DosResult<object>> SavePageEngine(string osClient, string pageId, string title, string number, string desc, string jsonStr)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(pageId))
                {
                    // 更新
                    var uptData = new JObject
                    {
                        ["Id"] = pageId,
                        ["Title"] = title,
                        ["JsonObj"] = jsonStr,
                        ["_InvokeType"] = "Client"
                    };
                    if (!string.IsNullOrWhiteSpace(number)) uptData["Number"] = number;
                    if (!string.IsNullOrWhiteSpace(desc)) uptData["Desc"] = desc;

                    var uptResult = await MicroiEngine.FormEngine.UptFormDataAsync("mic_page", uptData);
                    if (uptResult.Code != 1)
                    {
                        return new DosResult<object>(uptResult.Code, null, uptResult.Msg);
                    }

                    return new DosResult<object>(1, new
                    {
                        Message = $"界面引擎 [{title}] 更新成功",
                        PageId = pageId
                    });
                }
                else
                {
                    // 新增
                    var id = Ulid.NewUlid().ToString();
                    var addData = new JObject
                    {
                        ["OsClient"] = osClient,
                        ["Id"] = id,
                        ["Title"] = title,
                        ["JsonObj"] = jsonStr,
                        ["IsDeleted"] = 0,
                        ["_InvokeType"] = "Client"
                    };
                    if (!string.IsNullOrWhiteSpace(number)) addData["Number"] = number;
                    if (!string.IsNullOrWhiteSpace(desc)) addData["Desc"] = desc;

                    var addResult = await MicroiEngine.FormEngine.AddFormDataAsync("mic_page", addData);
                    if (addResult.Code != 1)
                    {
                        return new DosResult<object>(addResult.Code, null, addResult.Msg);
                    }

                    return new DosResult<object>(1, new
                    {
                        Message = $"界面引擎 [{title}] 创建成功",
                        PageId = id
                    });
                }
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "保存界面引擎失败：" + ex.Message);
            }
        }

        #endregion

        #region SetRolePermission

        /// <summary>
        /// 为角色设置菜单权限（批量添加 sys_rolelimit 记录）
        /// </summary>
        public static async Task<DosResult<object>> SetRolePermission(string osClient, string roleId, List<string> menuIds)
        {
            try
            {
                // 支持 roleId="admin" 自动查找管理员角色（Level 最高的角色）
                if (roleId.Equals("admin", StringComparison.OrdinalIgnoreCase))
                {
                    var roleResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_role", new
                    {
                        OsClient = osClient,
                        _SelectFields = new[] { "Id", "Name", "Level" },
                        _Where = new List<object>()
                        {
                            
                        },
                        _OrderBy = "Level",
                        _OrderByType = "DESC",
                        _PageSize = 1
                    });

                    if (roleResult.Code == 1 && roleResult.Data != null)
                    {
                        var roles = (IEnumerable<dynamic>)roleResult.Data;
                        var adminRole = roles.FirstOrDefault();
                        if (adminRole != null)
                        {
                            roleId = (string)adminRole.Id;
                        }
                        else
                        {
                            return new DosResult<object>(0, null, "未找到管理员角色，请先在 sys_role 中创建角色");
                        }
                    }
                    else
                    {
                        return new DosResult<object>(0, null, "查询角色列表失败：" + roleResult.Msg);
                    }
                }

                var addedCount = 0;
                var skippedCount = 0;

                foreach (var menuId in menuIds)
                {
                    // 检查是否已存在
                    var existResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_rolelimit", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>()
                        {
                            new List<object>() { "RoleId", "=", roleId },
                            new List<object>() { "FkId", "=", menuId }
                        }
                    });

                    if (existResult.Code == 1 && existResult.Data != null)
                    {
                        skippedCount++;
                        continue;
                    }

                    var addResult = await MicroiEngine.FormEngine.AddFormDataAsync("sys_rolelimit", new JObject
                    {
                        ["Customer"] = osClient,
                        ["RoleId"] = roleId,
                        ["FkId"] = menuId,
                        ["Type"] = "Menu",
                        ["Permission"] = "[\"Add\",\"Edit\",\"Del\",\"Export\",\"Import\"]",
                        ["CreateTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                        ["_InvokeType"] = "Client"
                    });

                    if (addResult.Code == 1) addedCount++;
                }



                return new DosResult<object>(1, new
                {
                    Message = $"角色权限设置完成：新增 {addedCount} 条，已跳过 {skippedCount} 条",
                    AddedCount = addedCount,
                    SkippedCount = skippedCount,
                    RoleId = roleId
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "设置角色权限失败：" + ex.Message);
            }
        }

        #endregion
    }
}
