#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8McpLogic.Patch.cs
* 文件描述：V8McpLogic 扩展补丁（分部类）
*           - UpdateField：通过 FormEngine.UptDiyField 修改字段，自动清缓存
*           - UpdateTable：修改 diy_table（如表单列数 Column），自动清缓存
*           - FixJoinFieldPair：FK 一键改造（Id 字段隐藏 + 同步生成 XxxName 显示字段）
*           - RefreshSchemaCache：手动刷新 diy_table / diy_field 相关 Redis 缓存
*           - SetEngineAnonymous：批量设置接口引擎是否允许匿名
* 创 建 人：MCP
* 创建日期：2026-05-04
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static partial class V8McpLogic
    {
        #region UpdateField
        /// <summary>
        /// 修改单个 diy_field（走 FormEngine.UptDiyField，自动清 diy_table_field_list 缓存）
        /// 支持按 FieldId 或 (TableId+Name) 定位
        /// </summary>
        public static async Task<DosResult<object>> UpdateField(string osClient, JObject patch)
        {
            try
            {
                if (patch == null) return new DosResult<object>(0, null, "patch 不能为空");

                var p = new DiyFieldParam
                {
                    OsClient = osClient,
                    Id = patch["Id"].Val<string>(),
                    TableId = patch["TableId"].Val<string>(),
                    TableName = patch["TableName"].Val<string>(),
                    Name = patch["Name"].Val<string>(),
                    Label = patch["Label"].Val<string>(),
                    Type = patch["Type"].Val<string>(),
                    Component = patch["Component"].Val<string>(),
                    Visible = patch["Visible"]?.Val<int>(),
                    AppVisible = patch["AppVisible"]?.Val<int>(),
                    Readonly = patch["Readonly"]?.Val<int>(),
                    NotEmpty = patch["NotEmpty"]?.Val<int>(),
                    Unique = patch["Unique"]?.Val<int>(),
                    Encrypt = patch["Encrypt"]?.Val<int>(),
                    Sort = patch["Sort"]?.Val<int>(),
                    FormWidth = patch["FormWidth"]?.Val<int>(),
                    TableWidth = patch["TableWidth"]?.Val<int>(),
                    Placeholder = patch["Placeholder"].Val<string>(),
                    DefaultValue = patch["DefaultValue"].Val<string>(),
                    Tab = patch["Tab"].Val<string>(),
                    Data = patch["Data"].Val<string>(),
                    Config = patch["Config"].Val<string>(),
                    Description = patch["Description"].Val<string>(),
                    InTableEdit = patch["InTableEdit"]?.Val<int>(),
                    _InvokeType = InvokeType.Client.ToString()
                };

                if (p.Id.DosIsNullOrWhiteSpace() && (p.Name.DosIsNullOrWhiteSpace() || (p.TableId.DosIsNullOrWhiteSpace() && p.TableName.DosIsNullOrWhiteSpace())))
                    return new DosResult<object>(0, null, "需要提供 Id 或 (TableId/TableName + Name) 来定位字段");

                var r = await MicroiEngine.FormEngine.UptDiyField(p);
                return new DosResult<object>(r.Code, r.Data, r.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "UpdateField 失败：" + ex.Message);
            }
        }
        #endregion

        #region UpdateTable
        /// <summary>
        /// 修改 diy_table 的属性（如 Column 表单列数、Description、IsTree 等）
        /// 并主动清相关字段列表缓存
        /// </summary>
        public static async Task<DosResult<object>> UpdateTable(string osClient, JObject patch)
        {
            try
            {
                if (patch == null) return new DosResult<object>(0, null, "patch 不能为空");
                var id = patch["Id"].Val<string>();
                var name = patch["Name"].Val<string>();
                if (id.DosIsNullOrWhiteSpace() && name.DosIsNullOrWhiteSpace())
                    return new DosResult<object>(0, null, "需要提供 Id 或 Name 来定位表");

                // 定位表
                dynamic tableRow = null;
                if (!id.DosIsNullOrWhiteSpace())
                {
                    var qr = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new { OsClient = osClient, Id = id });
                    if (qr.Code == 1) tableRow = qr.Data;
                }
                else
                {
                    var qr = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>() { new List<object>() { "Name", "=", name } }
                    });
                    if (qr.Code == 1) tableRow = qr.Data;
                }
                if (tableRow == null) return new DosResult<object>(0, null, "未找到表");

                // 构造更新对象（仅 patch 中存在的字段）
                var upt = new JObject();
                upt["Id"] = (string)tableRow.Id;
                upt["OsClient"] = osClient;
                foreach (var prop in patch.Properties())
                {
                    if (prop.Name == "Id" || prop.Name == "Name" || prop.Name == "OsClient") continue;
                    upt[prop.Name] = prop.Value;
                }
                var r = await MicroiEngine.FormEngine.UptFormDataAsync("diy_table", upt);

                // 主动清缓存（diy_table 自身 + 字段列表）
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var tid = ((string)tableRow.Id ?? "").ToLower();
                var tname = ((string)tableRow.Name ?? "").ToLower();
                foreach (var prefix in new[] { "diy_table", "Diy_Table" })
                {
                    if (!string.IsNullOrEmpty(tid)) await cache.RemoveAsync($"Microi:{osClient}:FormData:{prefix}:{tid}");
                    if (!string.IsNullOrEmpty(tname)) await cache.RemoveAsync($"Microi:{osClient}:FormData:{prefix}:{tname}");
                }
                if (!string.IsNullOrEmpty(tid)) await cache.RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:{tid}");
                if (!string.IsNullOrEmpty(tname)) await cache.RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:{tname}");

                return new DosResult<object>(r.Code, r.Data, r.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "UpdateTable 失败：" + ex.Message);
            }
        }
        #endregion

        #region RefreshSchemaCache
        /// <summary>
        /// 手动刷新一张/多张表的 diy_table / diy_field 相关 Redis 缓存
        /// </summary>
        public static async Task<DosResult<object>> RefreshSchemaCache(string osClient, List<string> tableNamesOrIds)
        {
            try
            {
                if (tableNamesOrIds == null || tableNamesOrIds.Count == 0)
                    return new DosResult<object>(0, null, "tableNamesOrIds 不能为空");
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var cleared = 0;
                foreach (var key in tableNamesOrIds)
                {
                    if (string.IsNullOrWhiteSpace(key)) continue;
                    var k = key.ToLower();
                    foreach (var prefix in new[] { "diy_table", "Diy_Table", "diy_table_field_list" })
                    {
                        await cache.RemoveAsync($"Microi:{osClient}:FormData:{prefix}:{k}");
                        cleared++;
                    }
                }
                return new DosResult<object>(1, new { Cleared = cleared, Tables = tableNamesOrIds.Count });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "RefreshSchemaCache 失败：" + ex.Message);
            }
        }
        #endregion

        #region SetEngineAnonymous
        /// <summary>
        /// 批量设置接口引擎是否允许匿名调用，并清缓存
        /// </summary>
        public static async Task<DosResult<object>> SetEngineAnonymous(string osClient, List<string> apiEngineKeys, int allowAnonymous)
        {
            try
            {
                if (apiEngineKeys == null || apiEngineKeys.Count == 0)
                    return new DosResult<object>(0, null, "apiEngineKeys 不能为空");
                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                var ok = 0; var fail = 0; var log = new List<string>();
                foreach (var key in apiEngineKeys)
                {
                    var qr = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_apiengine", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>() { new List<object>() { "ApiEngineKey", "=", key } }
                    });
                    if (qr.Code != 1 || qr.Data == null) { fail++; log.Add("✗ not found: " + key); continue; }
                    var row = qr.Data;
                    var upt = new
                    {
                        OsClient = osClient,
                        Id = (string)row.Id,
                        ApiEngineKey = (string)row.ApiEngineKey, // 必传，避免 SubmitAfterServerV8 中 toLowerCase 报错
                        ApiName = (string)row.ApiName,
                        ApiAddress = (string)row.ApiAddress,
                        AllowAnonymous = allowAnonymous
                    };
                    var ur = await MicroiEngine.FormEngine.UptFormDataAsync("sys_apiengine", upt);
                    var lk = (key ?? "").ToLower();
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{lk}");
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{((string)row.Id ?? "").ToLower()}");
                    if (row.ApiAddress != null)
                        await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{((string)row.ApiAddress).ToLower()}");
                    if (ur.Code == 1) { ok++; log.Add($"✓ {key} AllowAnonymous={allowAnonymous}"); }
                    else { fail++; log.Add($"⚠ {key} fail: {ur.Msg}"); }
                }
                return new DosResult<object>(1, new { Ok = ok, Fail = fail, Log = log });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "SetEngineAnonymous 失败：" + ex.Message);
            }
        }
        #endregion
    }
}
