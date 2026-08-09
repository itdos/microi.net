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
using System.Security.Cryptography;
using System.Text;
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
        private const int BlueprintDiffMaxJsonChars = 8 * 1024 * 1024;
        private const int BlueprintDiffMaxChanges = 1000;

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

        public static async Task<DosResult<object>> ListBlueprintHistory(
            string osClient,
            string blueprintIdOrName,
            int pageIndex = 1,
            int pageSize = 50)
        {
            try
            {
                var blueprintResult = await GetBlueprint(osClient, blueprintIdOrName).ConfigureAwait(false);
                if (blueprintResult.Code != 1 || !(blueprintResult.Data is JObject blueprint))
                    return new DosResult<object>(blueprintResult.Code, null, blueprintResult.Msg);

                var blueprintId = blueprint["Id"].Val<string>();
                pageIndex = Math.Max(1, pageIndex);
                pageSize = Math.Max(1, Math.Min(100, pageSize));
                var offset = (pageIndex - 1) * pageSize;
                var total = BpDbRead(osClient).FromSql(
                        "SELECT COUNT(1) FROM `sys_blueprint_history` " +
                        "WHERE `OsClient`=?os AND `BlueprintId`=?bpid AND (`IsDeleted` IS NULL OR `IsDeleted`=0)")
                    .AddInParameter("?os", osClient)
                    .AddInParameter("?bpid", blueprintId)
                    .ToScalar<int>();

                var rows = ReadRowsAsJArray(BpDbRead(osClient).FromSql(
                        "SELECT `Id`,`BlueprintId`,`Version`,`BlueprintData`,`ChangeSummary`,`CreateTime`," +
                        "`CreateUserId`,`CreateUserName` FROM `sys_blueprint_history` " +
                        "WHERE `OsClient`=?os AND `BlueprintId`=?bpid AND (`IsDeleted` IS NULL OR `IsDeleted`=0) " +
                        "ORDER BY `CreateTime` DESC,`Id` DESC " + BuildSafePaginationClause(offset, pageSize))
                    .AddInParameter("?os", osClient)
                    .AddInParameter("?bpid", blueprintId));

                foreach (var token in rows.OfType<JObject>())
                {
                    var json = token["BlueprintData"].Val<string>() ?? "";
                    token["ContentHash"] = ComputeBlueprintContentHash(json);
                    token["ContentLength"] = Encoding.UTF8.GetByteCount(json);
                    token.Remove("BlueprintData");
                }

                var currentJson = blueprint["BlueprintData"].Val<string>() ?? "";
                return new DosResult<object>(1, new
                {
                    Items = rows,
                    DataCount = total,
                    PageIndex = pageIndex,
                    PageSize = pageSize,
                    BlueprintId = blueprintId,
                    BlueprintName = blueprint["Name"].Val<string>(),
                    CurrentVersion = blueprint["Version"].Val<string>(),
                    CurrentHash = ComputeBlueprintContentHash(currentJson)
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取蓝图历史失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> GetBlueprintHistory(
            string osClient,
            string blueprintIdOrName,
            string historyId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(historyId))
                    return new DosResult<object>(0, null, "HistoryId 不能为空");

                var blueprintResult = await GetBlueprint(osClient, blueprintIdOrName).ConfigureAwait(false);
                if (blueprintResult.Code != 1 || !(blueprintResult.Data is JObject blueprint))
                    return new DosResult<object>(blueprintResult.Code, null, blueprintResult.Msg);
                var blueprintId = blueprint["Id"].Val<string>();

                var rows = ReadRowsAsJArray(BpDbRead(osClient).FromSql(
                        "SELECT `Id`,`BlueprintId`,`Version`,`BlueprintData`,`ChangeSummary`,`CreateTime`," +
                        "`CreateUserId`,`CreateUserName` FROM `sys_blueprint_history` " +
                        "WHERE `OsClient`=?os AND `BlueprintId`=?bpid AND `Id`=?hid " +
                        "AND (`IsDeleted` IS NULL OR `IsDeleted`=0) LIMIT 1")
                    .AddInParameter("?os", osClient)
                    .AddInParameter("?bpid", blueprintId)
                    .AddInParameter("?hid", historyId));
                if (rows.Count == 0)
                    return new DosResult<object>(2, null, "蓝图历史不存在或不属于当前蓝图");

                var history = (JObject)rows[0];
                history["ContentHash"] = ComputeBlueprintContentHash(history["BlueprintData"].Val<string>() ?? "");
                return new DosResult<object>(1, history);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "获取蓝图历史详情失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> CompareBlueprintVersions(
            string osClient,
            string blueprintIdOrName,
            string leftHistoryId,
            string rightHistoryId = null)
        {
            try
            {
                var blueprintResult = await GetBlueprint(osClient, blueprintIdOrName).ConfigureAwait(false);
                if (blueprintResult.Code != 1 || !(blueprintResult.Data is JObject blueprint))
                    return new DosResult<object>(blueprintResult.Code, null, blueprintResult.Msg);
                var blueprintId = blueprint["Id"].Val<string>();

                JObject left;
                if (string.IsNullOrWhiteSpace(leftHistoryId))
                {
                    var latestRows = ReadRowsAsJArray(BpDbRead(osClient).FromSql(
                            "SELECT `Id`,`Version`,`BlueprintData`,`ChangeSummary`,`CreateTime`,`CreateUserName` " +
                            "FROM `sys_blueprint_history` WHERE `OsClient`=?os AND `BlueprintId`=?bpid " +
                            "AND (`IsDeleted` IS NULL OR `IsDeleted`=0) ORDER BY `CreateTime` DESC,`Id` DESC LIMIT 1")
                        .AddInParameter("?os", osClient)
                        .AddInParameter("?bpid", blueprintId));
                    if (latestRows.Count == 0)
                        return new DosResult<object>(2, null, "蓝图尚无历史快照");
                    left = (JObject)latestRows[0];
                }
                else
                {
                    left = LoadBlueprintHistoryRaw(osClient, blueprintId, leftHistoryId);
                    if (left == null)
                        return new DosResult<object>(2, null, "左侧蓝图历史不存在或不属于当前蓝图");
                }

                JObject right;
                var rightIsCurrent = string.IsNullOrWhiteSpace(rightHistoryId);
                if (rightIsCurrent)
                {
                    right = new JObject
                    {
                        ["Id"] = "current",
                        ["Version"] = blueprint["Version"],
                        ["BlueprintData"] = blueprint["BlueprintData"],
                        ["ChangeSummary"] = "当前草稿",
                        ["CreateTime"] = blueprint["UpdateTime"],
                        ["CreateUserName"] = blueprint["UpdateUserName"]
                    };
                }
                else
                {
                    right = LoadBlueprintHistoryRaw(osClient, blueprintId, rightHistoryId);
                    if (right == null)
                        return new DosResult<object>(2, null, "右侧蓝图历史不存在或不属于当前蓝图");
                }

                var leftJson = left["BlueprintData"].Val<string>() ?? "";
                var rightJson = right["BlueprintData"].Val<string>() ?? "";
                if (leftJson.Length > BlueprintDiffMaxJsonChars || rightJson.Length > BlueprintDiffMaxJsonChars)
                    return new DosResult<object>(0, null, "蓝图内容超过在线差异比较上限，请先导出后离线比较");

                var diff = BuildBlueprintJsonDiff(leftJson, rightJson, BlueprintDiffMaxChanges);
                diff["BlueprintId"] = blueprintId;
                diff["BlueprintName"] = blueprint["Name"];
                diff["Left"] = BuildBlueprintVersionDescriptor(left, false);
                diff["Right"] = BuildBlueprintVersionDescriptor(right, rightIsCurrent);
                return new DosResult<object>(1, diff);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "比较蓝图版本失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> ExportBlueprint(
            string osClient,
            string blueprintIdOrName)
        {
            try
            {
                var blueprintResult = await GetBlueprint(osClient, blueprintIdOrName).ConfigureAwait(false);
                if (blueprintResult.Code != 1 || !(blueprintResult.Data is JObject blueprint))
                    return new DosResult<object>(blueprintResult.Code, null, blueprintResult.Msg);

                var blueprintJson = blueprint["BlueprintData"].Val<string>() ?? "";
                JToken blueprintData;
                try { blueprintData = JToken.Parse(blueprintJson); }
                catch (Exception parseEx)
                {
                    return new DosResult<object>(0, null, "蓝图内容不是有效 JSON：" + parseEx.Message);
                }

                var contentHash = ComputeBlueprintContentHash(blueprintJson);
                var export = new JObject
                {
                    ["Schema"] = "microi.blueprint.v1",
                    ["ExportedAt"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    ["ContentHash"] = contentHash,
                    ["Blueprint"] = new JObject
                    {
                        ["Id"] = blueprint["Id"],
                        ["Name"] = blueprint["Name"],
                        ["Code"] = blueprint["Code"],
                        ["Description"] = blueprint["Description"],
                        ["Version"] = blueprint["Version"],
                        ["RootDiagramId"] = blueprint["RootDiagramId"],
                        ["Status"] = blueprint["Status"],
                        ["BlueprintData"] = blueprintData
                    }
                };
                var fileStem = SafeBlueprintFileName(
                    blueprint["Code"].Val<string>() ?? blueprint["Name"].Val<string>() ?? blueprint["Id"].Val<string>());
                return new DosResult<object>(1, new
                {
                    FileName = fileStem + ".microi-blueprint.json",
                    ContentType = "application/json;charset=utf-8",
                    ContentHash = contentHash,
                    Snapshot = export
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "导出蓝图失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> RollbackBlueprint(
            string osClient,
            JObject param,
            dynamic currentToken = null)
        {
            try
            {
                var blueprintKey = param?["BlueprintId"].Val<string>() ?? param?["Id"].Val<string>();
                var historyId = param?["HistoryId"].Val<string>();
                var expectedHash = param?["ExpectedCurrentHash"].Val<string>();
                if (string.IsNullOrWhiteSpace(blueprintKey))
                    return new DosResult<object>(0, null, "BlueprintId 不能为空");
                if (string.IsNullOrWhiteSpace(historyId))
                    return new DosResult<object>(0, null, "HistoryId 不能为空");
                if (string.IsNullOrWhiteSpace(expectedHash))
                    return new DosResult<object>(0, null, "ExpectedCurrentHash 不能为空，请先重新读取蓝图历史");

                var blueprintResult = await GetBlueprint(osClient, blueprintKey).ConfigureAwait(false);
                if (blueprintResult.Code != 1 || !(blueprintResult.Data is JObject blueprint))
                    return new DosResult<object>(blueprintResult.Code, null, blueprintResult.Msg);
                var blueprintId = blueprint["Id"].Val<string>();
                var currentJson = blueprint["BlueprintData"].Val<string>() ?? "";
                var currentHash = ComputeBlueprintContentHash(currentJson);
                if (!string.Equals(currentHash, expectedHash, StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult<object>(0, new
                    {
                        Conflict = true,
                        ExpectedCurrentHash = expectedHash,
                        ActualCurrentHash = currentHash,
                        BlueprintId = blueprintId
                    }, "蓝图已被其他用户或节点修改，请重新比较后再回滚");
                }

                var target = LoadBlueprintHistoryRaw(osClient, blueprintId, historyId);
                if (target == null)
                    return new DosResult<object>(2, null, "目标蓝图历史不存在或不属于当前蓝图");
                var targetJson = target["BlueprintData"].Val<string>() ?? "";
                try { JToken.Parse(targetJson); }
                catch (Exception parseEx)
                {
                    return new DosResult<object>(0, null, "目标历史快照不是合法 JSON：" + parseEx.Message);
                }

                var newVersion = param?["NewVersion"].Val<string>() ?? target["Version"].Val<string>() ?? "1.0";
                if (newVersion.Length > 20)
                    return new DosResult<object>(0, null, "NewVersion 最多 20 个字符");
                if (IsBlueprintRollbackNoOp(
                        currentJson,
                        targetJson,
                        blueprint["Version"].Val<string>(),
                        newVersion))
                {
                    return new DosResult<object>(1, new
                    {
                        BlueprintId = blueprintId,
                        HistoryId = historyId,
                        CurrentHash = currentHash,
                        Version = blueprint["Version"].Val<string>() ?? "1.0",
                        Reused = true
                    }, "目标版本已是当前版本");
                }
                var changeSummary = param?["ChangeSummary"].Val<string>() ??
                                    $"回滚到历史 {historyId}（版本 {target["Version"].Val<string>() ?? ""}）";
                if (changeSummary.Length > 2000)
                    return new DosResult<object>(0, null, "ChangeSummary 最多 2000 个字符");

                var (userId, userName) = ExtractBlueprintUser((object)currentToken);
                var preRollbackHistoryId = Ulid.NewUlid().ToString();
                using (var trans = BpDbWrite(osClient).BeginTransaction())
                {
                    try
                    {
                        trans.FromSql("INSERT INTO `sys_blueprint_history` " +
                                "(`Id`,`OsClient`,`BlueprintId`,`Version`,`BlueprintData`,`ChangeSummary`," +
                                "`CreateTime`,`CreateUserId`,`CreateUserName`,`IsDeleted`) " +
                                "VALUES(?id,?os,?bpid,?ver,?bd,?cs,NOW(),?uid,?unm,0)")
                            .AddInParameter("?id", preRollbackHistoryId)
                            .AddInParameter("?os", osClient)
                            .AddInParameter("?bpid", blueprintId)
                            .AddInParameter("?ver", blueprint["Version"].Val<string>() ?? "1.0")
                            .AddInParameter("?bd", currentJson)
                            .AddInParameter("?cs", "回滚前自动快照：" + changeSummary)
                            .AddInParameter("?uid", userId)
                            .AddInParameter("?unm", userName)
                            .ExecuteNonQuery();

                        var affected = trans.FromSql("UPDATE `sys_business_blueprint` SET " +
                                "`BlueprintData`=?target,`Version`=?ver,`UpdateTime`=NOW()," +
                                "`UpdateUserId`=?uid,`UpdateUserName`=?unm,`Remark`=?remark " +
                                "WHERE `Id`=?id AND `OsClient`=?os AND " +
                                "((`BlueprintData`=?expected) OR (`BlueprintData` IS NULL AND ?expected=''))")
                            .AddInParameter("?target", targetJson)
                            .AddInParameter("?ver", newVersion)
                            .AddInParameter("?uid", userId)
                            .AddInParameter("?unm", userName)
                            .AddInParameter("?remark", changeSummary)
                            .AddInParameter("?id", blueprintId)
                            .AddInParameter("?os", osClient)
                            .AddInParameter("?expected", currentJson)
                            .ExecuteNonQuery();
                        if (affected != 1)
                            throw new BlueprintConcurrencyException();

                        RebuildBlueprintRelationsInTransaction(trans, osClient, blueprintId, targetJson);
                        trans.Commit();
                    }
                    catch
                    {
                        try { trans.Rollback(); } catch { /* ignore */ }
                        throw;
                    }
                }

                var restoredHash = ComputeBlueprintContentHash(targetJson);
                return new DosResult<object>(1, new
                {
                    BlueprintId = blueprintId,
                    HistoryId = historyId,
                    PreRollbackHistoryId = preRollbackHistoryId,
                    PreviousHash = currentHash,
                    CurrentHash = restoredHash,
                    Version = newVersion,
                    RolledBack = true
                }, "蓝图已按历史快照回滚，并保留回滚前快照");
            }
            catch (BlueprintConcurrencyException)
            {
                return new DosResult<object>(0, new { Conflict = true }, "蓝图在回滚过程中已发生变化，请重新读取后再操作");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "回滚蓝图失败：" + ex.Message);
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

        private static void RebuildBlueprintRelationsInTransaction(
            DbTrans trans,
            string osClient,
            string blueprintId,
            string blueprintData)
        {
            trans.FromSql("DELETE FROM `sys_blueprint_relation` WHERE `OsClient`=?os AND `BlueprintId`=?bpid")
                .AddInParameter("?os", osClient)
                .AddInParameter("?bpid", blueprintId)
                .ExecuteNonQuery();

            var root = JObject.Parse(blueprintData);
            var diagrams = root["diagrams"] as JArray ?? root["Diagrams"] as JArray;
            if (diagrams == null) return;

            foreach (var diagram in diagrams.OfType<JObject>())
            {
                var diagramId = diagram["id"].Val<string>() ?? diagram["Id"].Val<string>() ?? "";
                var nodes = diagram["nodes"] as JArray ?? diagram["Nodes"] as JArray;
                if (nodes == null) continue;
                foreach (var node in nodes.OfType<JObject>())
                {
                    var nodeId = node["id"].Val<string>() ?? node["Id"].Val<string>() ?? "";
                    var refs = node["refs"] as JObject ?? node["Refs"] as JObject;
                    if (refs == null) continue;
                    InsertRelationsRaw(trans, osClient, blueprintId, diagramId, nodeId, "table", refs["tables"] ?? refs["Tables"]);
                    InsertRelationsRaw(trans, osClient, blueprintId, diagramId, nodeId, "field", refs["fields"] ?? refs["Fields"]);
                    InsertRelationsRaw(trans, osClient, blueprintId, diagramId, nodeId, "menu", refs["menus"] ?? refs["Menus"]);
                    InsertRelationsRaw(trans, osClient, blueprintId, diagramId, nodeId, "engine", refs["engines"] ?? refs["Engines"]);
                    InsertRelationsRaw(trans, osClient, blueprintId, diagramId, nodeId, "v8event", refs["v8Events"] ?? refs["V8Events"]);
                    InsertRelationsRaw(trans, osClient, blueprintId, diagramId, nodeId, "dataSource", refs["dataSources"] ?? refs["DataSources"]);
                    InsertRelationsRaw(trans, osClient, blueprintId, diagramId, nodeId, "printTemplate", refs["printTemplates"] ?? refs["PrintTemplates"]);
                    InsertRelationsRaw(trans, osClient, blueprintId, diagramId, nodeId, "workflow", refs["workflows"] ?? refs["Workflows"]);
                    InsertRelationsRaw(trans, osClient, blueprintId, diagramId, nodeId, "page", refs["pages"] ?? refs["Pages"]);
                    InsertRelationsRaw(trans, osClient, blueprintId, diagramId, nodeId, "job", refs["jobs"] ?? refs["Jobs"]);
                }
            }
        }

        private static void InsertRelationsRaw(
            DbTrans trans,
            string osClient,
            string blueprintId,
            string diagramId,
            string nodeId,
            string relationType,
            JToken arr)
        {
            if (!(arr is JArray values)) return;
            var sort = 0;
            foreach (var item in values)
            {
                string key;
                string name;
                if (item.Type == JTokenType.String)
                {
                    key = item.Val<string>();
                    name = key;
                }
                else if (item is JObject obj)
                {
                    key = obj["key"].Val<string>() ?? obj["Key"].Val<string>() ??
                          obj["id"].Val<string>() ?? obj["Id"].Val<string>() ?? "";
                    name = obj["name"].Val<string>() ?? obj["Name"].Val<string>() ?? key;
                }
                else
                {
                    continue;
                }

                if (string.IsNullOrWhiteSpace(key)) continue;
                trans.FromSql("INSERT INTO `sys_blueprint_relation` " +
                        "(`Id`,`OsClient`,`BlueprintId`,`DiagramId`,`NodeId`,`RelationType`,`RelationKey`,`RelationName`,`Sort`,`CreateTime`,`IsDeleted`) " +
                        "VALUES(?id,?os,?bpid,?did,?nid,?rt,?rk,?rn,?st,NOW(),0)")
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

        internal static string ComputeBlueprintContentHash(string json)
        {
            var normalized = NormalizeBlueprintJson(json);
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(normalized));
            var builder = new StringBuilder(bytes.Length * 2);
            foreach (var value in bytes) builder.Append(value.ToString("x2"));
            return builder.ToString();
        }

        // Dos.ORM's MySQL provider serializes LIMIT/OFFSET parameters as quoted
        // strings (for example LIMIT '20' OFFSET '0'), which MySQL rejects.
        // Only validated integers reach this helper, so emitting numeric literals
        // is both injection-safe and portable across the supported MySQL versions.
        internal static string BuildSafePaginationClause(int offset, int pageSize)
        {
            offset = Math.Max(0, offset);
            pageSize = Math.Max(1, Math.Min(100, pageSize));
            return $"LIMIT {pageSize} OFFSET {offset}";
        }

        internal static bool IsBlueprintRollbackNoOp(
            string currentJson,
            string targetJson,
            string currentVersion,
            string targetVersion)
        {
            return string.Equals(
                       ComputeBlueprintContentHash(currentJson ?? ""),
                       ComputeBlueprintContentHash(targetJson ?? ""),
                       StringComparison.OrdinalIgnoreCase)
                   && string.Equals(
                       (currentVersion ?? "1.0").Trim(),
                       (targetVersion ?? "1.0").Trim(),
                       StringComparison.OrdinalIgnoreCase);
        }

        private static string SafeBlueprintFileName(string value)
        {
            var source = string.IsNullOrWhiteSpace(value) ? "microi-blueprint" : value.Trim();
            var invalid = new HashSet<char>(System.IO.Path.GetInvalidFileNameChars());
            var safe = new string(source.Select(ch => invalid.Contains(ch) || char.IsControl(ch) ? '_' : ch).ToArray());
            safe = safe.Trim().Trim('.');
            if (string.IsNullOrWhiteSpace(safe)) safe = "microi-blueprint";
            return safe.Length > 100 ? safe.Substring(0, 100) : safe;
        }

        internal static JObject BuildBlueprintJsonDiff(string leftJson, string rightJson, int maxChanges = BlueprintDiffMaxChanges)
        {
            var left = string.IsNullOrWhiteSpace(leftJson) ? JValue.CreateNull() : JToken.Parse(leftJson);
            var right = string.IsNullOrWhiteSpace(rightJson) ? JValue.CreateNull() : JToken.Parse(rightJson);
            var changes = new JArray();
            var added = 0;
            var removed = 0;
            var changed = 0;
            var total = 0;
            maxChanges = Math.Max(1, Math.Min(BlueprintDiffMaxChanges, maxChanges));
            CompareBlueprintTokens(left, right, "", changes, ref added, ref removed, ref changed, ref total, maxChanges);
            return new JObject
            {
                ["Equal"] = total == 0,
                ["LeftHash"] = ComputeBlueprintContentHash(leftJson),
                ["RightHash"] = ComputeBlueprintContentHash(rightJson),
                ["Added"] = added,
                ["Removed"] = removed,
                ["Changed"] = changed,
                ["TotalChanges"] = total,
                ["ReturnedChanges"] = changes.Count,
                ["Truncated"] = total > changes.Count,
                ["Changes"] = changes
            };
        }

        private static void CompareBlueprintTokens(
            JToken left,
            JToken right,
            string path,
            JArray changes,
            ref int added,
            ref int removed,
            ref int changed,
            ref int total,
            int maxChanges)
        {
            if (JToken.DeepEquals(left, right)) return;
            if (left == null || left.Type == JTokenType.Null)
            {
                added++;
                total++;
                AppendBlueprintChange(changes, maxChanges, "Added", path, null, right);
                return;
            }
            if (right == null || right.Type == JTokenType.Null)
            {
                removed++;
                total++;
                AppendBlueprintChange(changes, maxChanges, "Removed", path, left, null);
                return;
            }

            if (left is JObject leftObject && right is JObject rightObject)
            {
                var names = leftObject.Properties().Select(p => p.Name)
                    .Union(rightObject.Properties().Select(p => p.Name), StringComparer.Ordinal)
                    .OrderBy(name => name, StringComparer.Ordinal);
                foreach (var name in names)
                {
                    CompareBlueprintTokens(
                        leftObject[name],
                        rightObject[name],
                        path + "/" + EscapeBlueprintPath(name),
                        changes,
                        ref added,
                        ref removed,
                        ref changed,
                        ref total,
                        maxChanges);
                }
                return;
            }

            if (left is JArray leftArray && right is JArray rightArray)
            {
                if (TryBuildBlueprintIdentityMap(leftArray, out var leftMap, out var leftOrder) &&
                    TryBuildBlueprintIdentityMap(rightArray, out var rightMap, out var rightOrder))
                {
                    var ids = leftOrder.Concat(rightOrder.Where(id => !leftMap.ContainsKey(id)));
                    foreach (var id in ids)
                    {
                        leftMap.TryGetValue(id, out var leftItem);
                        rightMap.TryGetValue(id, out var rightItem);
                        CompareBlueprintTokens(
                            leftItem,
                            rightItem,
                            path + "[id=" + EscapeBlueprintPath(id) + "]",
                            changes,
                            ref added,
                            ref removed,
                            ref changed,
                            ref total,
                            maxChanges);
                    }
                    return;
                }

                var length = Math.Max(leftArray.Count, rightArray.Count);
                for (var index = 0; index < length; index++)
                {
                    CompareBlueprintTokens(
                        index < leftArray.Count ? leftArray[index] : null,
                        index < rightArray.Count ? rightArray[index] : null,
                        path + "/" + index,
                        changes,
                        ref added,
                        ref removed,
                        ref changed,
                        ref total,
                        maxChanges);
                }
                return;
            }

            changed++;
            total++;
            AppendBlueprintChange(changes, maxChanges, "Changed", path, left, right);
        }

        private static bool TryBuildBlueprintIdentityMap(
            JArray values,
            out Dictionary<string, JToken> map,
            out List<string> order)
        {
            map = new Dictionary<string, JToken>(StringComparer.Ordinal);
            order = new List<string>();
            if (values.Count == 0) return false;
            foreach (var item in values)
            {
                if (!(item is JObject obj)) return false;
                var identity = obj["id"].Val<string>() ?? obj["Id"].Val<string>() ??
                               obj["key"].Val<string>() ?? obj["Key"].Val<string>();
                if (string.IsNullOrWhiteSpace(identity) || map.ContainsKey(identity)) return false;
                map[identity] = item;
                order.Add(identity);
            }
            return true;
        }

        private static void AppendBlueprintChange(
            JArray changes,
            int maxChanges,
            string type,
            string path,
            JToken before,
            JToken after)
        {
            if (changes.Count >= maxChanges) return;
            changes.Add(new JObject
            {
                ["Type"] = type,
                ["Path"] = string.IsNullOrWhiteSpace(path) ? "/" : path,
                ["Before"] = SummarizeBlueprintDiffValue(before),
                ["After"] = SummarizeBlueprintDiffValue(after)
            });
        }

        private static JToken SummarizeBlueprintDiffValue(JToken value)
        {
            if (value == null) return JValue.CreateNull();
            var text = value.ToString(Newtonsoft.Json.Formatting.None);
            if (text.Length <= 2048) return value.DeepClone();
            return new JObject
            {
                ["Truncated"] = true,
                ["Length"] = text.Length,
                ["Hash"] = ComputeBlueprintContentHash(text),
                ["Preview"] = text.Substring(0, 512)
            };
        }

        private static string NormalizeBlueprintJson(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return "null";
            return SortBlueprintToken(JToken.Parse(json)).ToString(Newtonsoft.Json.Formatting.None);
        }

        private static JToken SortBlueprintToken(JToken token)
        {
            if (token is JObject obj)
            {
                var sorted = new JObject();
                foreach (var property in obj.Properties().OrderBy(p => p.Name, StringComparer.Ordinal))
                    sorted.Add(property.Name, SortBlueprintToken(property.Value));
                return sorted;
            }
            if (token is JArray array)
                return new JArray(array.Select(SortBlueprintToken));
            return token.DeepClone();
        }

        private static string EscapeBlueprintPath(string value)
        {
            return (value ?? "").Replace("~", "~0").Replace("/", "~1").Replace("]", "\\]");
        }

        private static JObject LoadBlueprintHistoryRaw(string osClient, string blueprintId, string historyId)
        {
            var rows = ReadRowsAsJArray(BpDbRead(osClient).FromSql(
                    "SELECT `Id`,`BlueprintId`,`Version`,`BlueprintData`,`ChangeSummary`,`CreateTime`," +
                    "`CreateUserId`,`CreateUserName` FROM `sys_blueprint_history` " +
                    "WHERE `OsClient`=?os AND `BlueprintId`=?bpid AND `Id`=?hid " +
                    "AND (`IsDeleted` IS NULL OR `IsDeleted`=0) LIMIT 1")
                .AddInParameter("?os", osClient)
                .AddInParameter("?bpid", blueprintId)
                .AddInParameter("?hid", historyId));
            return rows.Count == 0 ? null : rows[0] as JObject;
        }

        private static JObject BuildBlueprintVersionDescriptor(JObject source, bool isCurrent)
        {
            var json = source?["BlueprintData"].Val<string>() ?? "";
            return new JObject
            {
                ["Id"] = source?["Id"],
                ["Version"] = source?["Version"],
                ["ChangeSummary"] = source?["ChangeSummary"],
                ["CreateTime"] = source?["CreateTime"],
                ["CreateUserName"] = source?["CreateUserName"],
                ["ContentHash"] = ComputeBlueprintContentHash(json),
                ["IsCurrent"] = isCurrent
            };
        }

        private static (string userId, string userName) ExtractBlueprintUser(object currentToken)
        {
            try
            {
                object currentUser = null;
                if (currentToken is CurrentToken typedToken)
                    currentUser = typedToken.CurrentUser;
                else if (currentToken is JObject tokenJson)
                    currentUser = tokenJson["CurrentUser"];
                else if (currentToken != null)
                {
                    var property = currentToken.GetType().GetProperty("CurrentUser");
                    currentUser = property?.GetValue(currentToken);
                }
                if (currentUser == null) return ("", "");
                var user = currentUser as JObject ?? JObject.FromObject(currentUser);
                return (
                    user["Id"].Val<string>() ?? "",
                    user["Name"].Val<string>() ?? user["Account"].Val<string>() ?? "");
            }
            catch
            {
                return ("", "");
            }
        }

        private sealed class BlueprintConcurrencyException : Exception
        {
        }

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
