#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8McpLogic.Blueprint.cs
* Copyright(c) Microi.net
* 创 建 人：Microi 团队
* 创建日期：2026-05-10
* 文件描述：业务架构蓝图（System Blueprint）的 MCP 业务逻辑
*           - 三层模型：领域层(ER) / 流程层(Process) / 行为层(V8)
*           - 用作 AI 防幻觉的事实源（grounding context）
*           - 与 wf_flowdesign（运行时审批流）完全独立
*           - 直接走 Dos.ORM 原始 SQL 操作 sys_business_blueprint*
*             3 张表，避免依赖 diy_table 元数据
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static partial class V8McpLogic
    {
        // 蓝图主表所有列（用于 SELECT *）
        private static readonly string[] _blueprintColumns = new[]
        {
            "Id", "OsClient", "Name", "Code", "Description", "Version", "RootDiagramId",
            "BlueprintData", "Status", "LockedBy", "LockedAt", "LastSyncedSchemaHash",
            "Sort", "Remark", "CreateTime", "UpdateTime", "CreateUserId", "CreateUserName",
            "UpdateUserId", "UpdateUserName", "IsDeleted"
        };
        private static readonly string[] _blueprintListColumns = new[]
        {
            "Id", "Name", "Code", "Description", "Version", "RootDiagramId",
            "Status", "LockedBy", "LockedAt", "LastSyncedSchemaHash",
            "Sort", "CreateTime", "UpdateTime", "CreateUserName", "UpdateUserName"
        };

        private static DbSession BpDbWrite(string osClient) => OsClientExtend.GetClient(osClient).Db;
        private static DbSession BpDbRead(string osClient) => OsClientExtend.GetClient(osClient).DbRead;

        #region Blueprint —— 列表 / 详情

        public static Task<DosResult<object>> ListBlueprints(string osClient, string keyword = null)
        {
            try
            {
                var cols = string.Join(", ", _blueprintListColumns.Select(c => $"`{c}`"));
                var sql = $"SELECT {cols} FROM `sys_business_blueprint` WHERE `OsClient` = ?os AND (`IsDeleted` IS NULL OR `IsDeleted` = 0)";
                if (!string.IsNullOrWhiteSpace(keyword))
                    sql += " AND (`Name` LIKE ?kw OR `Code` LIKE ?kw OR `Description` LIKE ?kw)";
                sql += " ORDER BY `UpdateTime` DESC LIMIT 1000";
                var section = BpDbRead(osClient).FromSql(sql).AddInParameter("?os", osClient);
                if (!string.IsNullOrWhiteSpace(keyword))
                    section = section.AddInParameter("?kw", "%" + keyword + "%");
                var rows = ReadRowsAsJArray(section);
                return Task.FromResult(new DosResult<object>(1, (object)rows));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "获取蓝图列表失败：" + ex.Message));
            }
        }

        public static Task<DosResult<object>> GetBlueprint(string osClient, string blueprintIdOrName)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(blueprintIdOrName))
                    return Task.FromResult(new DosResult<object>(0, null, "BlueprintId 不能为空"));

                var cols = string.Join(", ", _blueprintColumns.Select(c => $"`{c}`"));
                var sql = $"SELECT {cols} FROM `sys_business_blueprint` " +
                          "WHERE `OsClient` = ?os AND (`Id` = ?key OR `Name` = ?key) " +
                          "AND (`IsDeleted` IS NULL OR `IsDeleted` = 0) LIMIT 1";
                var section = BpDbRead(osClient).FromSql(sql)
                    .AddInParameter("?os", osClient)
                    .AddInParameter("?key", blueprintIdOrName);
                var rows = ReadRowsAsJArray(section);
                if (rows.Count == 0)
                    return Task.FromResult(new DosResult<object>(2, null, $"蓝图不存在：{blueprintIdOrName}"));
                return Task.FromResult(new DosResult<object>(1, (object)rows[0]));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "获取蓝图详情失败：" + ex.Message));
            }
        }

        #endregion

        #region Blueprint —— 保存

        public static async Task<DosResult<object>> SaveBlueprint(string osClient, JObject param, dynamic currentToken = null)
        {
            try
            {
                var name = param["Name"].Val<string>() ?? param["name"].Val<string>();
                if (string.IsNullOrWhiteSpace(name))
                    return new DosResult<object>(0, null, "蓝图 Name 不能为空");

                var blueprintData = param["BlueprintData"].Val<string>() ?? param["blueprintData"].Val<string>();
                if (!string.IsNullOrWhiteSpace(blueprintData))
                {
                    try { JToken.Parse(blueprintData); }
                    catch (Exception parseEx)
                    {
                        return new DosResult<object>(0, null, "BlueprintData 不是合法的 JSON：" + parseEx.Message);
                    }
                }

                var id = param["Id"].Val<string>() ?? param["id"].Val<string>();

                // 查找已存在记录：先按 Id，再按 Name
                string existingId = null;
                if (!string.IsNullOrWhiteSpace(id))
                {
                    existingId = BpDbRead(osClient).FromSql(
                        "SELECT `Id` FROM `sys_business_blueprint` WHERE `OsClient` = ?os AND `Id` = ?id LIMIT 1")
                        .AddInParameter("?os", osClient).AddInParameter("?id", id)
                        .ToScalar<string>();
                }
                if (string.IsNullOrWhiteSpace(existingId))
                {
                    existingId = BpDbRead(osClient).FromSql(
                        "SELECT `Id` FROM `sys_business_blueprint` WHERE `OsClient` = ?os AND `Name` = ?nm AND (`IsDeleted` IS NULL OR `IsDeleted` = 0) LIMIT 1")
                        .AddInParameter("?os", osClient).AddInParameter("?nm", name)
                        .ToScalar<string>();
                }

                var userId = ""; var userName = "";
                JObject u = null;
                try
                {
                    object cuObj = currentToken?.CurrentUser;
                    if (cuObj != null)
                    {
                        u = cuObj as JObject ?? JObject.FromObject(cuObj);
                    }
                }
                catch { /* ignore */ }
                if (u != null)
                {
                    userId = u["Id"].Val<string>() ?? "";
                    userName = u["Name"].Val<string>() ?? u["Account"].Val<string>() ?? "";
                }

                var version = param["Version"].Val<string>() ?? "1.0";
                var code = param["Code"].Val<string>() ?? "";
                var desc = param["Description"].Val<string>() ?? "";
                var rootDiagramId = param["RootDiagramId"].Val<string>() ?? "";
                var statusToken = param["Status"];
                var status = (statusToken == null || statusToken.Type == JTokenType.Null) ? 1 : statusToken.Val<int>();
                var sortToken = param["Sort"];
                var sort = (sortToken == null || sortToken.Type == JTokenType.Null) ? 0 : sortToken.Val<int>();
                var remark = param["Remark"].Val<string>() ?? "";

                if (!string.IsNullOrWhiteSpace(existingId))
                {
                    // UPDATE
                    var updSql = "UPDATE `sys_business_blueprint` SET " +
                        "`Name` = ?nm, `Code` = ?code, `Description` = ?desc, `Version` = ?ver, " +
                        "`RootDiagramId` = ?rdi, `BlueprintData` = ?bd, `Status` = ?st, " +
                        "`Sort` = ?sort, `Remark` = ?rmk, `UpdateTime` = NOW(), " +
                        "`UpdateUserId` = ?uid, `UpdateUserName` = ?unm " +
                        "WHERE `Id` = ?id AND `OsClient` = ?os";
                    BpDbWrite(osClient).FromSql(updSql)
                        .AddInParameter("?nm", name).AddInParameter("?code", code)
                        .AddInParameter("?desc", desc).AddInParameter("?ver", version)
                        .AddInParameter("?rdi", rootDiagramId).AddInParameter("?bd", blueprintData ?? "")
                        .AddInParameter("?st", status).AddInParameter("?sort", sort)
                        .AddInParameter("?rmk", remark).AddInParameter("?uid", userId)
                        .AddInParameter("?unm", userName).AddInParameter("?id", existingId)
                        .AddInParameter("?os", osClient)
                        .ExecuteNonQuery();
                }
                else
                {
                    // INSERT
                    existingId = string.IsNullOrWhiteSpace(id) ? Ulid.NewUlid().ToString() : id;
                    var insSql = "INSERT INTO `sys_business_blueprint` " +
                        "(`Id`, `OsClient`, `Name`, `Code`, `Description`, `Version`, `RootDiagramId`, " +
                        "`BlueprintData`, `Status`, `Sort`, `Remark`, `CreateTime`, `UpdateTime`, " +
                        "`CreateUserId`, `CreateUserName`, `UpdateUserId`, `UpdateUserName`, `IsDeleted`) " +
                        "VALUES (?id, ?os, ?nm, ?code, ?desc, ?ver, ?rdi, ?bd, ?st, ?sort, ?rmk, NOW(), NOW(), ?uid, ?unm, ?uid, ?unm, 0)";
                    BpDbWrite(osClient).FromSql(insSql)
                        .AddInParameter("?id", existingId).AddInParameter("?os", osClient)
                        .AddInParameter("?nm", name).AddInParameter("?code", code)
                        .AddInParameter("?desc", desc).AddInParameter("?ver", version)
                        .AddInParameter("?rdi", rootDiagramId).AddInParameter("?bd", blueprintData ?? "")
                        .AddInParameter("?st", status).AddInParameter("?sort", sort)
                        .AddInParameter("?rmk", remark).AddInParameter("?uid", userId)
                        .AddInParameter("?unm", userName)
                        .ExecuteNonQuery();
                }

                // 历史快照
                if (!string.IsNullOrWhiteSpace(blueprintData))
                {
                    await SaveBlueprintHistoryRaw(osClient, existingId, version, blueprintData,
                        param["ChangeSummary"].Val<string>() ?? param["changeSummary"].Val<string>(),
                        userId, userName);
                }

                // 反向关联
                if (!string.IsNullOrWhiteSpace(blueprintData))
                {
                    await RebuildBlueprintRelationsRaw(osClient, existingId, blueprintData);
                }

                return new DosResult<object>(1, new { Id = existingId, Name = name, Saved = true }, "蓝图已保存");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "保存蓝图失败：" + ex.ToString());
            }
        }

        private static Task SaveBlueprintHistoryRaw(string osClient, string blueprintId, string version,
            string blueprintData, string changeSummary, string userId, string userName)
        {
            try
            {
                var sql = "INSERT INTO `sys_blueprint_history` " +
                    "(`Id`, `OsClient`, `BlueprintId`, `Version`, `BlueprintData`, `ChangeSummary`, " +
                    "`CreateTime`, `CreateUserId`, `CreateUserName`, `IsDeleted`) " +
                    "VALUES (?id, ?os, ?bpid, ?ver, ?bd, ?cs, NOW(), ?uid, ?unm, 0)";
                BpDbWrite(osClient).FromSql(sql)
                    .AddInParameter("?id", Ulid.NewUlid().ToString())
                    .AddInParameter("?os", osClient)
                    .AddInParameter("?bpid", blueprintId)
                    .AddInParameter("?ver", version ?? "1.0")
                    .AddInParameter("?bd", blueprintData)
                    .AddInParameter("?cs", changeSummary ?? "")
                    .AddInParameter("?uid", userId ?? "")
                    .AddInParameter("?unm", userName ?? "")
                    .ExecuteNonQuery();
            }
            catch { /* 历史快照失败不阻断 */ }
            return Task.CompletedTask;
        }

        private static Task RebuildBlueprintRelationsRaw(string osClient, string blueprintId, string blueprintData)
        {
            try
            {
                BpDbWrite(osClient).FromSql(
                    "DELETE FROM `sys_blueprint_relation` WHERE `OsClient` = ?os AND `BlueprintId` = ?bpid")
                    .AddInParameter("?os", osClient).AddInParameter("?bpid", blueprintId)
                    .ExecuteNonQuery();

                JObject root;
                try { root = JObject.Parse(blueprintData); } catch { return Task.CompletedTask; }

                var diagrams = root["diagrams"] as JArray ?? root["Diagrams"] as JArray;
                if (diagrams == null) return Task.CompletedTask;

                foreach (var diagToken in diagrams)
                {
                    if (!(diagToken is JObject diagram)) continue;
                    var diagramId = diagram["id"].Val<string>() ?? diagram["Id"].Val<string>() ?? "";
                    var nodes = diagram["nodes"] as JArray ?? diagram["Nodes"] as JArray;
                    if (nodes == null) continue;
                    foreach (var nodeToken in nodes)
                    {
                        if (!(nodeToken is JObject node)) continue;
                        var nodeId = node["id"].Val<string>() ?? node["Id"].Val<string>() ?? "";
                        var refs = node["refs"] as JObject ?? node["Refs"] as JObject;
                        if (refs == null) continue;

                        InsertRelationsRaw(osClient, blueprintId, diagramId, nodeId, "table", refs["tables"] ?? refs["Tables"]);
                        InsertRelationsRaw(osClient, blueprintId, diagramId, nodeId, "field", refs["fields"] ?? refs["Fields"]);
                        InsertRelationsRaw(osClient, blueprintId, diagramId, nodeId, "menu", refs["menus"] ?? refs["Menus"]);
                        InsertRelationsRaw(osClient, blueprintId, diagramId, nodeId, "engine", refs["engines"] ?? refs["Engines"]);
                        InsertRelationsRaw(osClient, blueprintId, diagramId, nodeId, "v8event", refs["v8Events"] ?? refs["V8Events"]);
                        InsertRelationsRaw(osClient, blueprintId, diagramId, nodeId, "dataSource", refs["dataSources"] ?? refs["DataSources"]);
                        InsertRelationsRaw(osClient, blueprintId, diagramId, nodeId, "printTemplate", refs["printTemplates"] ?? refs["PrintTemplates"]);
                        InsertRelationsRaw(osClient, blueprintId, diagramId, nodeId, "workflow", refs["workflows"] ?? refs["Workflows"]);
                        InsertRelationsRaw(osClient, blueprintId, diagramId, nodeId, "page", refs["pages"] ?? refs["Pages"]);
                        InsertRelationsRaw(osClient, blueprintId, diagramId, nodeId, "job", refs["jobs"] ?? refs["Jobs"]);
                    }
                }
            }
            catch { /* swallow */ }
            return Task.CompletedTask;
        }

        private static void InsertRelationsRaw(string osClient, string blueprintId, string diagramId, string nodeId,
            string relationType, JToken arr)
        {
            if (arr == null || arr.Type != JTokenType.Array) return;
            var sort = 0;
            foreach (var item in (JArray)arr)
            {
                string key, name;
                if (item.Type == JTokenType.String)
                {
                    key = item.Val<string>();
                    name = key;
                }
                else if (item is JObject obj)
                {
                    key = obj["key"].Val<string>() ?? obj["Key"].Val<string>() ?? obj["id"].Val<string>() ?? obj["Id"].Val<string>() ?? "";
                    name = obj["name"].Val<string>() ?? obj["Name"].Val<string>() ?? key;
                }
                else continue;

                if (string.IsNullOrWhiteSpace(key)) continue;
                var sql = "INSERT INTO `sys_blueprint_relation` " +
                    "(`Id`, `OsClient`, `BlueprintId`, `DiagramId`, `NodeId`, `RelationType`, `RelationKey`, `RelationName`, `Sort`, `CreateTime`, `IsDeleted`) " +
                    "VALUES (?id, ?os, ?bpid, ?did, ?nid, ?rt, ?rk, ?rn, ?st, NOW(), 0)";
                BpDbWrite(osClient).FromSql(sql)
                    .AddInParameter("?id", Ulid.NewUlid().ToString())
                    .AddInParameter("?os", osClient)
                    .AddInParameter("?bpid", blueprintId)
                    .AddInParameter("?did", diagramId ?? "")
                    .AddInParameter("?nid", nodeId ?? "")
                    .AddInParameter("?rt", relationType)
                    .AddInParameter("?rk", key)
                    .AddInParameter("?rn", name ?? key)
                    .AddInParameter("?st", sort++)
                    .ExecuteNonQuery();
            }
        }

        #endregion

        #region Blueprint —— 删除

        public static Task<DosResult<object>> DeleteBlueprint(string osClient, string blueprintId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(blueprintId))
                    return Task.FromResult(new DosResult<object>(0, null, "BlueprintId 不能为空"));

                BpDbWrite(osClient).FromSql(
                    "UPDATE `sys_business_blueprint` SET `IsDeleted` = 1, `UpdateTime` = NOW() " +
                    "WHERE `OsClient` = ?os AND (`Id` = ?key OR `Name` = ?key)")
                    .AddInParameter("?os", osClient).AddInParameter("?key", blueprintId)
                    .ExecuteNonQuery();

                BpDbWrite(osClient).FromSql(
                    "DELETE FROM `sys_blueprint_relation` WHERE `OsClient` = ?os AND `BlueprintId` IN " +
                    "(SELECT `Id` FROM `sys_business_blueprint` WHERE `OsClient` = ?os AND (`Id` = ?key OR `Name` = ?key))")
                    .AddInParameter("?os", osClient).AddInParameter("?key", blueprintId)
                    .ExecuteNonQuery();

                return Task.FromResult(new DosResult<object>(1, new { Id = blueprintId, Deleted = true }));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "删除蓝图失败：" + ex.Message));
            }
        }

        #endregion

        #region Blueprint —— 验证（漂移检测）

        public static async Task<DosResult<object>> ValidateBlueprint(string osClient, string blueprintId)
        {
            try
            {
                var bp = await GetBlueprint(osClient, blueprintId);
                if (bp.Code != 1)
                    return new DosResult<object>(bp.Code, null, bp.Msg);

                var bpData = bp.Data as JObject;
                var blueprintDataStr = bpData?["BlueprintData"].Val<string>() ?? "";
                if (string.IsNullOrWhiteSpace(blueprintDataStr))
                {
                    return new DosResult<object>(1, new
                    {
                        Passed = true,
                        errors = new List<string>(),
                        warnings = new List<string> { "蓝图无 BlueprintData，无可验证项" }
                    });
                }

                // 加载平台资源（这些表 ARE registered in diy_table，可走 FormEngine）
                var tablesTask = MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_table", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name" },
                    _PageSize = 10000
                });
                var fieldsTask = MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("diy_field", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name", "TableId" },
                    _PageSize = 100000
                });
                var enginesTask = MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_apiengine", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "ApiEngineKey" },
                    _PageSize = 10000
                });
                var menusTask = MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_menu", new
                {
                    OsClient = osClient,
                    _SelectFields = new[] { "Id", "Name" },
                    _PageSize = 10000
                });
                await Task.WhenAll(tablesTask, fieldsTask, enginesTask, menusTask);

                var tableNames = new HashSet<string>((tablesTask.Result.Data as IEnumerable<dynamic> ?? Enumerable.Empty<dynamic>())
                    .Select(t => ((string)t.Name ?? "").ToLowerInvariant()));
                var tableIds = new HashSet<string>((tablesTask.Result.Data as IEnumerable<dynamic> ?? Enumerable.Empty<dynamic>())
                    .Select(t => ((string)t.Id ?? "")));
                var fieldKeys = new HashSet<string>();
                if (fieldsTask.Result.Code == 1 && fieldsTask.Result.Data != null)
                {
                    var tableIdToName = (tablesTask.Result.Data as IEnumerable<dynamic> ?? Enumerable.Empty<dynamic>())
                        .ToDictionary(t => (string)t.Id, t => (string)t.Name ?? "");
                    foreach (var f in (IEnumerable<dynamic>)fieldsTask.Result.Data)
                    {
                        var tName = tableIdToName.TryGetValue((string)f.TableId ?? "", out var n) ? n : "";
                        fieldKeys.Add(($"{tName}.{(string)f.Name ?? ""}").ToLowerInvariant());
                    }
                }
                var engineKeys = new HashSet<string>((enginesTask.Result.Data as IEnumerable<dynamic> ?? Enumerable.Empty<dynamic>())
                    .Select(e => ((string)e.ApiEngineKey ?? "").ToLowerInvariant()));
                var menuNames = new HashSet<string>((menusTask.Result.Data as IEnumerable<dynamic> ?? Enumerable.Empty<dynamic>())
                    .Select(m => ((string)m.Name ?? "").ToLowerInvariant()));

                var errors = new List<string>();
                var warnings = new List<string>();
                int checkedCount = 0;

                JObject root;
                try { root = JObject.Parse(blueprintDataStr); }
                catch (Exception parseEx)
                {
                    errors.Add("BlueprintData JSON 解析失败：" + parseEx.Message);
                    return new DosResult<object>(1, new { Passed = false, errors, warnings });
                }

                var diagrams = root["diagrams"] as JArray ?? root["Diagrams"] as JArray ?? new JArray();
                foreach (var diagToken in diagrams)
                {
                    if (!(diagToken is JObject diagram)) continue;
                    var diagramId = diagram["id"].Val<string>() ?? diagram["Id"].Val<string>() ?? "(unknown)";
                    var nodes = diagram["nodes"] as JArray ?? diagram["Nodes"] as JArray ?? new JArray();
                    foreach (var nodeToken in nodes)
                    {
                        if (!(nodeToken is JObject node)) continue;
                        var nodeId = node["id"].Val<string>() ?? node["Id"].Val<string>() ?? "(unknown)";
                        var refs = node["refs"] as JObject ?? node["Refs"] as JObject;
                        if (refs == null) continue;

                        foreach (var t in EnumStringArray(refs["tables"] ?? refs["Tables"]))
                        {
                            checkedCount++;
                            if (!tableNames.Contains(t.ToLowerInvariant()) && !tableIds.Contains(t))
                                errors.Add($"[{diagramId}/{nodeId}] 引用的表不存在：{t}");
                        }
                        foreach (var f in EnumStringArray(refs["fields"] ?? refs["Fields"]))
                        {
                            checkedCount++;
                            if (!fieldKeys.Contains(f.ToLowerInvariant()))
                                errors.Add($"[{diagramId}/{nodeId}] 引用的字段不存在：{f}");
                        }
                        foreach (var e in EnumStringArray(refs["engines"] ?? refs["Engines"]))
                        {
                            checkedCount++;
                            if (!engineKeys.Contains(e.ToLowerInvariant()))
                                errors.Add($"[{diagramId}/{nodeId}] 引用的接口引擎不存在：{e}");
                        }
                        foreach (var m in EnumStringArray(refs["menus"] ?? refs["Menus"]))
                        {
                            checkedCount++;
                            if (!menuNames.Contains(m.ToLowerInvariant()))
                                warnings.Add($"[{diagramId}/{nodeId}] 引用的菜单不存在：{m}");
                        }
                        foreach (var v in EnumStringArray(refs["v8Events"] ?? refs["V8Events"]))
                        {
                            checkedCount++;
                            var idx = v.IndexOf(':');
                            if (idx <= 0) { warnings.Add($"[{diagramId}/{nodeId}] V8 事件格式应为 tableName:eventType：{v}"); continue; }
                            var tName = v.Substring(0, idx);
                            var evType = v.Substring(idx + 1);
                            if (!tableNames.Contains(tName.ToLowerInvariant()))
                                errors.Add($"[{diagramId}/{nodeId}] V8 事件依赖的表不存在：{tName}");
                            if (!ValidEventTypes.Contains(evType))
                                errors.Add($"[{diagramId}/{nodeId}] 无效的 V8 事件类型：{evType}");
                        }
                    }
                }

                return new DosResult<object>(1, new
                {
                    Passed = errors.Count == 0,
                    errors,
                    warnings,
                    CheckedRefs = checkedCount,
                    BlueprintId = bpData?["Id"].Val<string>(),
                    BlueprintName = bpData?["Name"].Val<string>()
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "验证蓝图失败：" + ex.Message);
            }
        }

        private static IEnumerable<string> EnumStringArray(JToken token)
        {
            if (token == null || token.Type != JTokenType.Array) yield break;
            foreach (var item in (JArray)token)
            {
                if (item.Type == JTokenType.String)
                {
                    var s = item.Val<string>();
                    if (!string.IsNullOrWhiteSpace(s)) yield return s;
                }
                else if (item is JObject obj)
                {
                    var key = obj["key"].Val<string>() ?? obj["Key"].Val<string>() ?? obj["id"].Val<string>() ?? obj["Id"].Val<string>();
                    if (!string.IsNullOrWhiteSpace(key)) yield return key;
                }
            }
        }

        #endregion

        #region helpers

        /// <summary>
        /// 把 SqlSection 的查询结果读为 JArray（每行一个 JObject，按列名展开）。
        /// 这样就避免了 dynamic 反射 + ToList 在 JSON 序列化时丢字段的问题。
        /// </summary>
        private static JArray ReadRowsAsJArray(Dos.ORM.SqlSection section)
        {
            var arr = new JArray();
            using (var reader = section.ToDataReader())
            {
                while (reader.Read())
                {
                    var obj = new JObject();
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        var name = reader.GetName(i);
                        var val = reader.IsDBNull(i) ? null : reader.GetValue(i);
                        if (val is DateTime dt)
                            obj[name] = dt.ToString("yyyy-MM-dd HH:mm:ss");
                        else
                            obj[name] = val == null ? JValue.CreateNull() : JToken.FromObject(val);
                    }
                    arr.Add(obj);
                }
            }
            return arr;
        }

        #endregion
    }
}
