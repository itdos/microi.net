#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8DebugController.cs
* Copyright(c) Microi.net
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：2026-01-13
* 文件描述：V8引擎本地调试同步API
*           支持本地 ↔ 数据库双向同步接口引擎代码
*******************************************************/
#endregion
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using Dos.Common;
using System.Diagnostics;

namespace Microi.net.Api
{
    /// <summary>
    /// V8引擎本地调试同步API
    /// 仅在调试模式下可用
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    public class V8DebugController : Controller
    {
        /// <summary>
        /// 检查是否为调试模式
        /// </summary>
        private bool IsDebugMode()
        {
            return Debugger.IsAttached || 
                   Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development";
        }

        /// <summary>
        /// 获取调试状态
        /// </summary>
        [HttpGet]
        public IActionResult GetStatus()
        {
            return Ok(new DosResult(1, new
            {
                IsDebugMode = IsDebugMode(),
                Environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                DebuggerAttached = Debugger.IsAttached,
                LocalV8DebugPath = ConfigHelper.GetAppSettings("LocalV8DebugPath") ?? "",
                OsClient = ConfigHelper.GetAppSettings("OsClient") ?? "",
                OsClientType = ConfigHelper.GetAppSettings("OsClientType") ?? "Product",
                OsClientNetwork = ConfigHelper.GetAppSettings("OsClientNetwork") ?? "Internal"
            }));
        }

        /// <summary>
        /// 获取所有接口引擎列表（用于首次全量同步）
        /// </summary>
        /// <param name="osClient">客户端标识</param>
        [HttpGet]
        public async Task<IActionResult> GetApiEngineList(string osClient)
        {
            if (!IsDebugMode())
            {
                return Ok(new DosResult(0, null, "此接口仅在调试模式下可用"));
            }

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = ConfigHelper.GetAppSettings("OsClient");
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
                    // _OrderBy = "Category,ApiName",
                    // _OrderByType = "ASC"
                });

                if (result.Code == 1 && result.Data != null)
                {
                    // 解密 ApiV8Code
                    var list = new List<dynamic>();
                    foreach (var item in result.Data)
                    {
                        var apiV8Code = (string)item.ApiV8Code ?? "";
                        var updateTime = item.UpdateTime?.ToString() ?? "";
                        // 解密 Base64 编码的代码
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
        /// <param name="osClient">客户端标识</param>
        /// <param name="apiEngineKey">接口引擎Key</param>
        [HttpGet]
        public async Task<IActionResult> GetApiEngine(string osClient, string apiEngineKey)
        {
            if (!IsDebugMode())
            {
                return Ok(new DosResult(0, null, "此接口仅在调试模式下可用"));
            }

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = ConfigHelper.GetAppSettings("OsClient");
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
        /// 获取增量更新的接口引擎列表
        /// </summary>
        /// <param name="osClient">客户端标识</param>
        /// <param name="lastSyncTime">上次同步时间（格式：yyyy-MM-dd HH:mm:ss）</param>
        [HttpGet]
        public async Task<IActionResult> GetUpdatedApiEngines(string osClient, string lastSyncTime)
        {
            if (!IsDebugMode())
            {
                return Ok(new DosResult(0, null, "此接口仅在调试模式下可用"));
            }

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = ConfigHelper.GetAppSettings("OsClient");
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
            if (!IsDebugMode())
            {
                return Ok(new DosResult(0, null, "此接口仅在调试模式下可用"));
            }

            var osClient = param["OsClient"].Val<string>();
            var apiEngineKey = param["ApiEngineKey"].Val<string>();
            var apiV8Code = param["ApiV8Code"].Val<string>();

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = ConfigHelper.GetAppSettings("OsClient");
            }

            if (apiEngineKey.DosIsNullOrWhiteSpace())
            {
                return Ok(new DosResult(0, null, "ApiEngineKey 不能为空"));
            }

            try
            {
                // 先获取原有数据
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

                // 将代码加密为 Base64
                var encodedCode = V8Base64.StringToBase64(apiV8Code ?? "");

                // 更新代码
                var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_apiengine", new
                {
                    OsClient = osClient,
                    Id = id,
                    ApiV8Code = encodedCode,
                    UpdateTime = DateTime.Now
                });

                if (updateResult.Code == 1)
                {
                    // 清除缓存
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
            if (!IsDebugMode())
            {
                return Ok(new DosResult(0, null, "此接口仅在调试模式下可用"));
            }

            var osClient = param["OsClient"].Val<string>();
            var items = param["Items"]?.ToObject<List<VersionCheckItem>>();

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = ConfigHelper.GetAppSettings("OsClient");
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
                                // 如果数据库更新时间比本地记录的时间新，说明有冲突
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
        /// 版本检查项
        /// </summary>
        public class VersionCheckItem
        {
            public string ApiEngineKey { get; set; }
            public string LocalUpdateTime { get; set; }
        }
    }
}
