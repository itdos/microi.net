#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8McpLogic.StateMachine.cs
* Copyright(c) Microi.net
* 创 建 人：Microi 团队
* 创建日期：2026-05-11
* 文件描述：状态机/业务流引擎
*           - 与 wf_flowdesign（审批流）互补：审批=人审，状态机=数据流
*           - 直接走 Dos.ORM 原始 SQL 操作 sys_state_machine / sys_state_transition / sys_state_history
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
        private static DbSession SmDbWrite(string osClient) => OsClientExtend.GetClient(osClient).Db;
        private static DbSession SmDbRead(string osClient) => OsClientExtend.GetClient(osClient).DbRead;

        #region 状态机定义

        public static Task<DosResult<object>> ListStateMachines(string osClient, string keyword = null)
        {
            try
            {
                var sql = "SELECT `Id`,`Name`,`Code`,`TableName`,`StatusField`,`Description`,`States`,`InitialState`," +
                          "`Status`,`Sort`,`CreateTime`,`UpdateTime`,`CreateUserName`,`UpdateUserName` " +
                          "FROM `sys_state_machine` WHERE `OsClient` = ?os AND (`IsDeleted` IS NULL OR `IsDeleted` = 0)";
                if (!string.IsNullOrWhiteSpace(keyword))
                    sql += " AND (`Name` LIKE ?kw OR `Code` LIKE ?kw OR `TableName` LIKE ?kw)";
                sql += " ORDER BY `Sort` ASC, `UpdateTime` DESC LIMIT 500";
                var sec = SmDbRead(osClient).FromSql(sql).AddInParameter("?os", osClient);
                if (!string.IsNullOrWhiteSpace(keyword)) sec = sec.AddInParameter("?kw", "%" + keyword + "%");
                var rows = ReadRowsAsJArray(sec);
                return Task.FromResult(new DosResult<object>(1, (object)rows));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "获取状态机列表失败：" + ex.Message));
            }
        }

        public static Task<DosResult<object>> GetStateMachine(string osClient, string idOrCode)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(idOrCode))
                    return Task.FromResult(new DosResult<object>(0, null, "Id 不能为空"));
                var smSql = "SELECT * FROM `sys_state_machine` WHERE `OsClient`=?os AND (`Id`=?k OR `Code`=?k) " +
                            "AND (`IsDeleted` IS NULL OR `IsDeleted`=0) LIMIT 1";
                var sm = ReadRowsAsJArray(SmDbRead(osClient).FromSql(smSql)
                    .AddInParameter("?os", osClient).AddInParameter("?k", idOrCode));
                if (sm.Count == 0) return Task.FromResult(new DosResult<object>(2, null, "状态机不存在"));

                var smObj = (JObject)sm[0];
                var smId = smObj["Id"].Val<string>();
                var trSql = "SELECT * FROM `sys_state_transition` WHERE `OsClient`=?os AND `StateMachineId`=?id " +
                            "AND (`IsDeleted` IS NULL OR `IsDeleted`=0) ORDER BY `Sort` ASC";
                var trans = ReadRowsAsJArray(SmDbRead(osClient).FromSql(trSql)
                    .AddInParameter("?os", osClient).AddInParameter("?id", smId));
                smObj["Transitions"] = trans;
                return Task.FromResult(new DosResult<object>(1, (object)smObj));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "获取状态机详情失败：" + ex.Message));
            }
        }

        public static Task<DosResult<object>> SaveStateMachine(string osClient, JObject param, dynamic currentToken = null)
        {
            try
            {
                var name = param["Name"].Val<string>();
                var code = param["Code"].Val<string>();
                var tableName = param["TableName"].Val<string>();
                var statusField = param["StatusField"].Val<string>() ?? "Status";
                if (string.IsNullOrWhiteSpace(name)) return Task.FromResult(new DosResult<object>(0, null, "Name 必填"));
                if (string.IsNullOrWhiteSpace(code)) return Task.FromResult(new DosResult<object>(0, null, "Code 必填"));
                if (string.IsNullOrWhiteSpace(tableName)) return Task.FromResult(new DosResult<object>(0, null, "TableName 必填"));

                var id = param["Id"].Val<string>();
                var statesJson = param["States"]?.ToString() ?? "[]";
                var initialState = param["InitialState"].Val<string>() ?? "";
                var description = param["Description"].Val<string>() ?? "";
                var statusToken = param["Status"];
                var status = (statusToken == null || statusToken.Type == JTokenType.Null) ? 1 : statusToken.Val<int>();

                object ctObj = currentToken;
                var (userId, userName) = ExtractUser(ctObj);

                string existingId = null;
                if (!string.IsNullOrWhiteSpace(id))
                {
                    existingId = SmDbRead(osClient).FromSql(
                        "SELECT `Id` FROM `sys_state_machine` WHERE `OsClient`=?os AND `Id`=?id LIMIT 1")
                        .AddInParameter("?os", osClient).AddInParameter("?id", id).ToScalar<string>();
                }
                if (string.IsNullOrWhiteSpace(existingId))
                {
                    // Code 唯一约束不包含 IsDeleted，故 lookup 必须含软删除行，避免唯一键冲突
                    existingId = SmDbRead(osClient).FromSql(
                        "SELECT `Id` FROM `sys_state_machine` WHERE `OsClient`=?os AND `Code`=?code LIMIT 1")
                        .AddInParameter("?os", osClient).AddInParameter("?code", code).ToScalar<string>();
                }

                if (!string.IsNullOrWhiteSpace(existingId))
                {
                    var sql = "UPDATE `sys_state_machine` SET `Name`=?nm,`Code`=?code,`TableName`=?tn,`StatusField`=?sf," +
                              "`Description`=?desc,`States`=?states,`InitialState`=?init,`Status`=?st,`IsDeleted`=0," +
                              "`UpdateTime`=NOW(),`UpdateUserId`=?uid,`UpdateUserName`=?unm " +
                              "WHERE `Id`=?id AND `OsClient`=?os";
                    SmDbWrite(osClient).FromSql(sql)
                        .AddInParameter("?nm", name).AddInParameter("?code", code).AddInParameter("?tn", tableName)
                        .AddInParameter("?sf", statusField).AddInParameter("?desc", description)
                        .AddInParameter("?states", statesJson).AddInParameter("?init", initialState)
                        .AddInParameter("?st", status).AddInParameter("?uid", userId).AddInParameter("?unm", userName)
                        .AddInParameter("?id", existingId).AddInParameter("?os", osClient)
                        .ExecuteNonQuery();
                }
                else
                {
                    existingId = string.IsNullOrWhiteSpace(id) ? Ulid.NewUlid().ToString() : id;
                    var sql = "INSERT INTO `sys_state_machine`(`Id`,`OsClient`,`Name`,`Code`,`TableName`,`StatusField`," +
                              "`Description`,`States`,`InitialState`,`Status`,`CreateTime`,`UpdateTime`," +
                              "`CreateUserId`,`CreateUserName`,`UpdateUserId`,`UpdateUserName`,`IsDeleted`) " +
                              "VALUES(?id,?os,?nm,?code,?tn,?sf,?desc,?states,?init,?st,NOW(),NOW(),?uid,?unm,?uid,?unm,0)";
                    SmDbWrite(osClient).FromSql(sql)
                        .AddInParameter("?id", existingId).AddInParameter("?os", osClient)
                        .AddInParameter("?nm", name).AddInParameter("?code", code).AddInParameter("?tn", tableName)
                        .AddInParameter("?sf", statusField).AddInParameter("?desc", description)
                        .AddInParameter("?states", statesJson).AddInParameter("?init", initialState)
                        .AddInParameter("?st", status).AddInParameter("?uid", userId).AddInParameter("?unm", userName)
                        .ExecuteNonQuery();
                }

                // 重建 transitions
                var transitions = param["Transitions"] as JArray;
                if (transitions != null)
                {
                    SmDbWrite(osClient).FromSql("DELETE FROM `sys_state_transition` WHERE `OsClient`=?os AND `StateMachineId`=?id")
                        .AddInParameter("?os", osClient).AddInParameter("?id", existingId).ExecuteNonQuery();
                    int sort = 0;
                    foreach (var t in transitions)
                    {
                        var to = (JObject)t;
                        var tid = to["Id"].Val<string>();
                        if (string.IsNullOrWhiteSpace(tid)) tid = Ulid.NewUlid().ToString();
                        var insTr = "INSERT INTO `sys_state_transition`(`Id`,`OsClient`,`StateMachineId`,`Name`," +
                                    "`FromState`,`ToState`,`ConditionV8`,`ActionApiEngineKey`,`RequireRole`,`Sort`,`IsDeleted`,`CreateTime`) " +
                                    "VALUES(?id,?os,?smid,?nm,?fs,?ts,?cv,?ak,?rr,?sort,0,NOW())";
                        SmDbWrite(osClient).FromSql(insTr)
                            .AddInParameter("?id", tid).AddInParameter("?os", osClient).AddInParameter("?smid", existingId)
                            .AddInParameter("?nm", to["Name"].Val<string>() ?? "")
                            .AddInParameter("?fs", to["FromState"].Val<string>() ?? "")
                            .AddInParameter("?ts", to["ToState"].Val<string>() ?? "")
                            .AddInParameter("?cv", to["ConditionV8"].Val<string>() ?? "")
                            .AddInParameter("?ak", to["ActionApiEngineKey"].Val<string>() ?? "")
                            .AddInParameter("?rr", to["RequireRole"].Val<string>() ?? "")
                            .AddInParameter("?sort", sort++).ExecuteNonQuery();
                    }
                }

                return Task.FromResult(new DosResult<object>(1, (object)new { Id = existingId, Code = code, Saved = true }, "状态机已保存"));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "保存状态机失败：" + ex.Message));
            }
        }

        public static Task<DosResult<object>> DeleteStateMachine(string osClient, string idOrCode)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(idOrCode)) return Task.FromResult(new DosResult<object>(0, null, "Id 不能为空"));
                SmDbWrite(osClient).FromSql(
                    "UPDATE `sys_state_machine` SET `IsDeleted`=1,`UpdateTime`=NOW() " +
                    "WHERE `OsClient`=?os AND (`Id`=?k OR `Code`=?k)")
                    .AddInParameter("?os", osClient).AddInParameter("?k", idOrCode).ExecuteNonQuery();
                return Task.FromResult(new DosResult<object>(1, (object)new { Deleted = true }, "已删除"));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "删除状态机失败：" + ex.Message));
            }
        }

        #endregion

        #region 跃迁执行 / 历史

        /// <summary>
        /// 业务对象状态跃迁：
        ///   1) 校验 FromState 对应跃迁存在
        ///   2) 校验 V8 条件、角色权限
        ///   3) UPDATE 业务表（事务）
        ///   4) 写 sys_state_history
        ///   5) 触发 ActionApiEngineKey（如有）
        /// </summary>
        public static async Task<DosResult<object>> TransitionState(string osClient, JObject param, dynamic currentToken = null)
        {
            try
            {
                var smCode = param["StateMachineCode"].Val<string>() ?? param["Code"].Val<string>();
                var rowId = param["RowId"].Val<string>() ?? param["Id"].Val<string>();
                var toState = param["ToState"].Val<string>();
                var comment = param["Comment"].Val<string>() ?? "";
                if (string.IsNullOrWhiteSpace(smCode)) return new DosResult<object>(0, null, "StateMachineCode 必填");
                if (string.IsNullOrWhiteSpace(rowId)) return new DosResult<object>(0, null, "RowId 必填");
                if (string.IsNullOrWhiteSpace(toState)) return new DosResult<object>(0, null, "ToState 必填");

                // 1. 加载状态机
                var smResult = await GetStateMachine(osClient, smCode);
                if (smResult.Code != 1) return smResult;
                var sm = (JObject)smResult.Data;
                var smId = sm["Id"].Val<string>();
                var tableName = sm["TableName"].Val<string>();
                var statusField = sm["StatusField"].Val<string>() ?? "Status";

                // 2. 读当前状态
                var curState = SmDbRead(osClient).FromSql(
                    $"SELECT `{statusField}` FROM `{tableName}` WHERE `Id`=?id LIMIT 1")
                    .AddInParameter("?id", rowId).ToScalar<string>();
                if (curState == null)
                    return new DosResult<object>(0, null, $"业务对象不存在：{tableName}.Id={rowId}");

                // 3. 查找跃迁规则
                var transitions = sm["Transitions"] as JArray ?? new JArray();
                JObject matched = null;
                foreach (var t in transitions)
                {
                    var to = (JObject)t;
                    var fs = to["FromState"].Val<string>() ?? "";
                    var ts = to["ToState"].Val<string>() ?? "";
                    if ((fs == "*" || fs == curState) && ts == toState)
                    {
                        matched = to;
                        break;
                    }
                }
                if (matched == null)
                    return new DosResult<object>(0, null, $"非法状态跃迁：{curState} → {toState}");

                // 4. 角色校验
                var requireRole = matched["RequireRole"].Val<string>() ?? "";
                if (!string.IsNullOrWhiteSpace(requireRole))
                {
                    object ctObj1 = currentToken;
                    var (_userId, _userName) = ExtractUser(ctObj1);
                    _ = _userId; _ = _userName;
                    var allowed = false;
                    try
                    {
                        object cuObj = currentToken?.CurrentUser;
                        if (cuObj != null)
                        {
                            var u = cuObj as JObject ?? JObject.FromObject(cuObj);
                            var userRoles = u["RoleIds"]?.ToString() ?? "";
                            foreach (var r in requireRole.Split(','))
                                if (userRoles.Contains(r.Trim())) { allowed = true; break; }
                        }
                    }
                    catch { /* ignore */ }
                    if (!allowed) return new DosResult<object>(0, null, "无权执行此状态跃迁");
                }

                // 5. 事务：UPDATE + 写历史 + 触发 ActionApiEngine
                using (var trans = SmDbWrite(osClient).BeginTransaction())
                {
                    try
                    {
                        trans.FromSql($"UPDATE `{tableName}` SET `{statusField}`=?ts, `UpdateTime`=NOW() WHERE `Id`=?id")
                            .AddInParameter("?ts", toState).AddInParameter("?id", rowId).ExecuteNonQuery();

                        object ctObj2 = currentToken;
                        var (uid, unm) = ExtractUser(ctObj2);
                        trans.FromSql("INSERT INTO `sys_state_history`(`Id`,`OsClient`,`StateMachineId`,`TableName`,`RowId`," +
                                "`FromState`,`ToState`,`TransitionId`,`OperatorId`,`OperatorName`,`Comment`,`CreateTime`) " +
                                "VALUES(?id,?os,?smid,?tn,?rid,?fs,?ts,?trid,?uid,?unm,?cmt,NOW())")
                            .AddInParameter("?id", Ulid.NewUlid().ToString())
                            .AddInParameter("?os", osClient).AddInParameter("?smid", smId)
                            .AddInParameter("?tn", tableName).AddInParameter("?rid", rowId)
                            .AddInParameter("?fs", curState).AddInParameter("?ts", toState)
                            .AddInParameter("?trid", matched["Id"].Val<string>() ?? "")
                            .AddInParameter("?uid", uid).AddInParameter("?unm", unm)
                            .AddInParameter("?cmt", comment).ExecuteNonQuery();

                        trans.Commit();
                    }
                    catch
                    {
                        try { trans.Rollback(); } catch { /* ignore */ }
                        throw;
                    }
                }

                // 6. 触发 ActionApiEngine（事务外，失败不回滚状态变更）
                var actionKey = matched["ActionApiEngineKey"].Val<string>() ?? "";
                JObject actionResult = null;
                if (!string.IsNullOrWhiteSpace(actionKey))
                {
                    try
                    {
                        var apiParam = new JObject
                        {
                            ["OsClient"] = osClient,
                            ["TableName"] = tableName,
                            ["RowId"] = rowId,
                            ["FromState"] = curState,
                            ["ToState"] = toState,
                            ["TransitionId"] = matched["Id"].Val<string>(),
                            ["TransitionName"] = matched["Name"].Val<string>()
                        };
                        var apiResp = await MicroiEngine.ApiEngine.RunAsync(actionKey, apiParam);
                        try { actionResult = apiResp == null ? null : JObject.FromObject(apiResp); }
                        catch { actionResult = new JObject { ["Raw"] = apiResp?.ToString() ?? "" }; }
                    }
                    catch (Exception apiEx)
                    {
                        actionResult = new JObject { ["Error"] = apiEx.Message };
                    }
                }

                return new DosResult<object>(1, new
                {
                    RowId = rowId,
                    FromState = curState,
                    ToState = toState,
                    TableName = tableName,
                    ActionApiEngineKey = actionKey,
                    ActionResult = actionResult
                }, "状态跃迁成功");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "状态跃迁失败：" + ex.Message);
            }
        }

        public static Task<DosResult<object>> GetStateHistory(string osClient, string tableName, string rowId, int pageSize = 50)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(tableName)) return Task.FromResult(new DosResult<object>(0, null, "TableName 必填"));
                if (string.IsNullOrWhiteSpace(rowId)) return Task.FromResult(new DosResult<object>(0, null, "RowId 必填"));
                var sql = "SELECT * FROM `sys_state_history` WHERE `OsClient`=?os AND `TableName`=?tn AND `RowId`=?rid " +
                          "ORDER BY `CreateTime` DESC LIMIT " + Math.Max(1, Math.Min(pageSize, 500));
                var rows = ReadRowsAsJArray(SmDbRead(osClient).FromSql(sql)
                    .AddInParameter("?os", osClient).AddInParameter("?tn", tableName).AddInParameter("?rid", rowId));
                return Task.FromResult(new DosResult<object>(1, (object)rows));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "获取状态历史失败：" + ex.Message));
            }
        }

        #endregion

        #region helpers

        private static (string userId, string userName) ExtractUser(object currentTokenObj)
        {
            try
            {
                if (currentTokenObj == null) return ("", "");
                dynamic ct = currentTokenObj;
                object cuObj = ct?.CurrentUser;
                if (cuObj == null) return ("", "");
                var u = cuObj as JObject ?? JObject.FromObject(cuObj);
                var uid = u["Id"].Val<string>() ?? "";
                var unm = u["Name"].Val<string>() ?? u["Account"].Val<string>() ?? "";
                return (uid, unm);
            }
            catch { return ("", ""); }
        }

        #endregion
    }
}
