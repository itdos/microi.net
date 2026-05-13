#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8McpLogic.FlowEngine.cs
* Copyright(c) Microi.net
* 创 建 人：Microi 团队
* 创建日期：2026-05-11
* 文件描述：自动化流引擎 (Flow Engine)
*           - 可视化编排：trigger → step → step → ...
*           - 节点类型：http / sql / apiengine / email / mq / if / delay / set / end
*           - JSON DAG 由前端 X6 设计器生成，后端通用执行器解释执行
*******************************************************/
#endregion
using System;
using System.Diagnostics;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static partial class V8McpLogic
    {
        private static DbSession FeDbWrite(string osClient) => OsClientExtend.GetClient(osClient).Db;
        private static DbSession FeDbRead(string osClient) => OsClientExtend.GetClient(osClient).DbRead;

        #region 流定义 CRUD

        public static Task<DosResult<object>> ListFlows(string osClient, string keyword = null, string triggerType = null)
        {
            try
            {
                var sql = "SELECT `Id`,`Name`,`Code`,`Description`,`TriggerType`,`TriggerConfig`,`Status`," +
                          "`MaxRetry`,`Timeout`,`Sort`,`CreateTime`,`UpdateTime`,`CreateUserName`,`UpdateUserName` " +
                          "FROM `sys_flow_design` WHERE `OsClient`=?os AND (`IsDeleted` IS NULL OR `IsDeleted`=0)";
                if (!string.IsNullOrWhiteSpace(keyword)) sql += " AND (`Name` LIKE ?kw OR `Code` LIKE ?kw)";
                if (!string.IsNullOrWhiteSpace(triggerType)) sql += " AND `TriggerType`=?tt";
                sql += " ORDER BY `Sort` ASC, `UpdateTime` DESC LIMIT 500";
                var sec = FeDbRead(osClient).FromSql(sql).AddInParameter("?os", osClient);
                if (!string.IsNullOrWhiteSpace(keyword)) sec = sec.AddInParameter("?kw", "%" + keyword + "%");
                if (!string.IsNullOrWhiteSpace(triggerType)) sec = sec.AddInParameter("?tt", triggerType);
                var rows = ReadRowsAsJArray(sec);
                return Task.FromResult(new DosResult<object>(1, (object)rows));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "获取流列表失败：" + ex.Message));
            }
        }

        public static Task<DosResult<object>> GetFlow(string osClient, string idOrCode)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(idOrCode)) return Task.FromResult(new DosResult<object>(0, null, "Id 不能为空"));
                var sql = "SELECT * FROM `sys_flow_design` WHERE `OsClient`=?os AND (`Id`=?k OR `Code`=?k) " +
                          "AND (`IsDeleted` IS NULL OR `IsDeleted`=0) LIMIT 1";
                var rows = ReadRowsAsJArray(FeDbRead(osClient).FromSql(sql)
                    .AddInParameter("?os", osClient).AddInParameter("?k", idOrCode));
                if (rows.Count == 0) return Task.FromResult(new DosResult<object>(2, null, "流不存在"));
                return Task.FromResult(new DosResult<object>(1, (object)rows[0]));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "获取流详情失败：" + ex.Message));
            }
        }

        public static Task<DosResult<object>> SaveFlow(string osClient, JObject param, dynamic currentToken = null)
        {
            try
            {
                var name = param["Name"].Val<string>();
                var code = param["Code"].Val<string>();
                if (string.IsNullOrWhiteSpace(name)) return Task.FromResult(new DosResult<object>(0, null, "Name 必填"));
                if (string.IsNullOrWhiteSpace(code)) return Task.FromResult(new DosResult<object>(0, null, "Code 必填"));

                var id = param["Id"].Val<string>();
                var description = param["Description"].Val<string>() ?? "";
                var triggerType = param["TriggerType"].Val<string>() ?? "manual";
                var triggerConfig = param["TriggerConfig"]?.ToString() ?? "{}";
                var flowData = param["FlowData"]?.ToString() ?? "{}";
                var statusToken = param["Status"];
                var status = (statusToken == null || statusToken.Type == JTokenType.Null) ? 1 : statusToken.Val<int>();
                var maxRetryToken = param["MaxRetry"];
                var maxRetry = (maxRetryToken == null || maxRetryToken.Type == JTokenType.Null) ? 0 : maxRetryToken.Val<int>();
                var timeoutToken = param["Timeout"];
                var timeout = (timeoutToken == null || timeoutToken.Type == JTokenType.Null) ? 60 : timeoutToken.Val<int>();

                object ctObj = currentToken;
                var (userId, userName) = ExtractUser(ctObj);

                string existingId = null;
                if (!string.IsNullOrWhiteSpace(id))
                {
                    existingId = FeDbRead(osClient).FromSql(
                        "SELECT `Id` FROM `sys_flow_design` WHERE `OsClient`=?os AND `Id`=?id LIMIT 1")
                        .AddInParameter("?os", osClient).AddInParameter("?id", id).ToScalar<string>();
                }
                if (string.IsNullOrWhiteSpace(existingId))
                {
                    // Code 唯一约束不含 IsDeleted，故 lookup 必须含软删除行，避免唯一键冲突
                    existingId = FeDbRead(osClient).FromSql(
                        "SELECT `Id` FROM `sys_flow_design` WHERE `OsClient`=?os AND `Code`=?code LIMIT 1")
                        .AddInParameter("?os", osClient).AddInParameter("?code", code).ToScalar<string>();
                }

                if (!string.IsNullOrWhiteSpace(existingId))
                {
                    var sql = "UPDATE `sys_flow_design` SET `Name`=?nm,`Code`=?code,`Description`=?desc," +
                              "`TriggerType`=?tt,`TriggerConfig`=?tc,`FlowData`=?fd,`Status`=?st,`IsDeleted`=0," +
                              "`MaxRetry`=?mr,`Timeout`=?to,`UpdateTime`=NOW(),`UpdateUserId`=?uid,`UpdateUserName`=?unm " +
                              "WHERE `Id`=?id AND `OsClient`=?os";
                    FeDbWrite(osClient).FromSql(sql)
                        .AddInParameter("?nm", name).AddInParameter("?code", code).AddInParameter("?desc", description)
                        .AddInParameter("?tt", triggerType).AddInParameter("?tc", triggerConfig).AddInParameter("?fd", flowData)
                        .AddInParameter("?st", status).AddInParameter("?mr", maxRetry).AddInParameter("?to", timeout)
                        .AddInParameter("?uid", userId).AddInParameter("?unm", userName)
                        .AddInParameter("?id", existingId).AddInParameter("?os", osClient)
                        .ExecuteNonQuery();
                }
                else
                {
                    existingId = string.IsNullOrWhiteSpace(id) ? Ulid.NewUlid().ToString() : id;
                    var sql = "INSERT INTO `sys_flow_design`(`Id`,`OsClient`,`Name`,`Code`,`Description`,`TriggerType`," +
                              "`TriggerConfig`,`FlowData`,`Status`,`MaxRetry`,`Timeout`,`CreateTime`,`UpdateTime`," +
                              "`CreateUserId`,`CreateUserName`,`UpdateUserId`,`UpdateUserName`,`IsDeleted`) " +
                              "VALUES(?id,?os,?nm,?code,?desc,?tt,?tc,?fd,?st,?mr,?to,NOW(),NOW(),?uid,?unm,?uid,?unm,0)";
                    FeDbWrite(osClient).FromSql(sql)
                        .AddInParameter("?id", existingId).AddInParameter("?os", osClient)
                        .AddInParameter("?nm", name).AddInParameter("?code", code).AddInParameter("?desc", description)
                        .AddInParameter("?tt", triggerType).AddInParameter("?tc", triggerConfig).AddInParameter("?fd", flowData)
                        .AddInParameter("?st", status).AddInParameter("?mr", maxRetry).AddInParameter("?to", timeout)
                        .AddInParameter("?uid", userId).AddInParameter("?unm", userName).ExecuteNonQuery();
                }

                return Task.FromResult(new DosResult<object>(1, (object)new { Id = existingId, Code = code, Saved = true }, "流已保存"));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "保存流失败：" + ex.Message));
            }
        }

        public static Task<DosResult<object>> DeleteFlow(string osClient, string idOrCode)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(idOrCode)) return Task.FromResult(new DosResult<object>(0, null, "Id 不能为空"));
                FeDbWrite(osClient).FromSql(
                    "UPDATE `sys_flow_design` SET `IsDeleted`=1,`UpdateTime`=NOW() WHERE `OsClient`=?os AND (`Id`=?k OR `Code`=?k)")
                    .AddInParameter("?os", osClient).AddInParameter("?k", idOrCode).ExecuteNonQuery();
                return Task.FromResult(new DosResult<object>(1, (object)new { Deleted = true }, "已删除"));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "删除流失败：" + ex.Message));
            }
        }

        #endregion

        #region 运行 / 执行器

        /// <summary>
        /// 同步执行流（适合 manual / api 触发）。
        /// 异步触发（cron/webhook/mq）通过 Microi.Job 调度后调用本方法。
        /// </summary>
        public static async Task<DosResult<object>> RunFlow(string osClient, string idOrCode, JObject input, dynamic currentToken = null)
        {
            var flowResult = await GetFlow(osClient, idOrCode);
            if (flowResult.Code != 1) return flowResult;
            var flow = (JObject)flowResult.Data;
            var flowId = flow["Id"].Val<string>();
            var flowCode = flow["Code"].Val<string>();
            var statusToken = flow["Status"];
            if (statusToken == null || statusToken.Val<int>() != 1)
                return new DosResult<object>(0, null, "流已禁用，无法执行");

            var flowDataStr = flow["FlowData"].Val<string>() ?? "{}";
            JObject flowData;
            try { flowData = JObject.Parse(flowDataStr); }
            catch (Exception ex) { return new DosResult<object>(0, null, "流配置 JSON 解析失败：" + ex.Message); }

            var runId = Ulid.NewUlid().ToString();
            var sw = Stopwatch.StartNew();
            object ctObj = currentToken;
            var (userId, _) = ExtractUser(ctObj);
            var stepLog = new JArray();
            var context = new JObject();
            context["input"] = input ?? new JObject();
            context["output"] = new JObject();

            // 落地 running 记录
            try
            {
                FeDbWrite(osClient).FromSql(
                    "INSERT INTO `sys_flow_run`(`Id`,`OsClient`,`FlowId`,`FlowCode`,`TriggerSource`,`InputData`,`Status`,`StartTime`,`CreateUserId`,`IsDeleted`) " +
                    "VALUES(?id,?os,?fid,?fcode,?ts,?in,'running',NOW(),?uid,0)")
                    .AddInParameter("?id", runId).AddInParameter("?os", osClient)
                    .AddInParameter("?fid", flowId).AddInParameter("?fcode", flowCode)
                    .AddInParameter("?ts", "manual").AddInParameter("?in", (input ?? new JObject()).ToString())
                    .AddInParameter("?uid", userId).ExecuteNonQuery();
            }
            catch { /* 落地失败仍尝试执行，但日志缺失 */ }

            string status = "success";
            string errorMsg = "";
            try
            {
                ExecuteFlowDag(osClient, flowData, context, stepLog, currentToken);
            }
            catch (Exception ex)
            {
                status = "failed";
                errorMsg = ex.Message;
            }
            sw.Stop();

            try
            {
                FeDbWrite(osClient).FromSql(
                    "UPDATE `sys_flow_run` SET `Status`=?st,`OutputData`=?out,`StepLog`=?log,`EndTime`=NOW()," +
                    "`DurationMs`=?dur,`ErrorMsg`=?err WHERE `Id`=?id")
                    .AddInParameter("?st", status).AddInParameter("?out", context["output"].ToString())
                    .AddInParameter("?log", stepLog.ToString()).AddInParameter("?dur", (int)sw.ElapsedMilliseconds)
                    .AddInParameter("?err", errorMsg).AddInParameter("?id", runId).ExecuteNonQuery();
            }
            catch { /* 日志失败不影响结果 */ }

            return new DosResult<object>(status == "success" ? 1 : 0, new
            {
                RunId = runId,
                Status = status,
                Output = context["output"],
                StepLog = stepLog,
                DurationMs = sw.ElapsedMilliseconds,
                ErrorMsg = errorMsg
            }, status == "success" ? "执行成功" : "执行失败：" + errorMsg);
        }

        /// <summary>
        /// DAG 执行器：BFS 从 start 节点开始，按 edges 推进。
        /// 支持的 node.type：start / end / set / http / sql / apiengine / email / mq / if / delay / log
        /// </summary>
        private static void ExecuteFlowDag(string osClient, JObject flowData, JObject context, JArray stepLog, dynamic currentToken)
        {
            var nodes = flowData["nodes"] as JArray ?? new JArray();
            var edges = flowData["edges"] as JArray ?? new JArray();
            if (nodes.Count == 0) throw new Exception("流定义为空");

            // 索引
            var nodeMap = new System.Collections.Generic.Dictionary<string, JObject>();
            foreach (var n in nodes) { var no = (JObject)n; nodeMap[no["id"].Val<string>()] = no; }

            // 找 start
            JObject startNode = null;
            foreach (var n in nodes)
            {
                var no = (JObject)n;
                if (no["type"].Val<string>() == "start") { startNode = no; break; }
            }
            if (startNode == null) startNode = (JObject)nodes[0];

            var current = startNode;
            int maxSteps = 200; // 防死循环
            while (current != null && maxSteps-- > 0)
            {
                var stepStart = DateTime.UtcNow;
                var stepEntry = new JObject
                {
                    ["nodeId"] = current["id"],
                    ["nodeType"] = current["type"],
                    ["nodeName"] = current["name"] ?? current["label"],
                    ["startAt"] = stepStart.ToString("yyyy-MM-dd HH:mm:ss")
                };
                string nextEdgeBranch = null;
                try
                {
                    nextEdgeBranch = ExecuteNode(osClient, current, context, stepEntry, currentToken);
                    stepEntry["success"] = true;
                }
                catch (Exception ex)
                {
                    stepEntry["success"] = false;
                    stepEntry["error"] = ex.Message;
                    stepEntry["endAt"] = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                    stepLog.Add(stepEntry);
                    throw;
                }
                stepEntry["endAt"] = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
                stepLog.Add(stepEntry);

                if (current["type"].Val<string>() == "end") break;

                // 寻找下一个节点
                string curId = current["id"].Val<string>();
                JObject nextNode = null;
                foreach (var e in edges)
                {
                    var eo = (JObject)e;
                    if (eo["source"].Val<string>() == curId)
                    {
                        var branch = eo["label"].Val<string>() ?? eo["branch"].Val<string>();
                        if (nextEdgeBranch != null)
                        {
                            if (branch == nextEdgeBranch) { nodeMap.TryGetValue(eo["target"].Val<string>() ?? "", out nextNode); break; }
                        }
                        else
                        {
                            nodeMap.TryGetValue(eo["target"].Val<string>() ?? "", out nextNode);
                            break;
                        }
                    }
                }
                current = nextNode;
            }
            if (maxSteps <= 0) throw new Exception("流执行步骤数超过 200，可能存在死循环");
        }

        /// <summary>
        /// 执行单个节点，返回分支名（仅 if 节点有效，其它返回 null）。
        /// </summary>
        private static string ExecuteNode(string osClient, JObject node, JObject context, JObject stepEntry, dynamic currentToken)
        {
            var type = (node["type"].Val<string>() ?? "").ToLowerInvariant();
            var config = node["config"] as JObject ?? node["data"] as JObject ?? new JObject();
            switch (type)
            {
                case "start":
                case "end":
                case "log":
                    stepEntry["msg"] = config["msg"]?.ToString() ?? "";
                    return null;

                case "set":
                    {
                        var key = config["key"].Val<string>() ?? "result";
                        var val = config["value"];
                        context["output"][key] = val == null ? JValue.CreateNull() : val.DeepClone();
                        stepEntry["set"] = new JObject { [key] = val };
                        return null;
                    }

                case "delay":
                    {
                        var ms = config["ms"].Val<int>();
                        if (ms > 0 && ms <= 30000) System.Threading.Thread.Sleep(ms);
                        return null;
                    }

                case "if":
                    {
                        var expr = config["expression"].Val<string>() ?? config["expr"].Val<string>() ?? "true";
                        var truthy = EvalSimpleExpression(expr, context);
                        stepEntry["branch"] = truthy ? "true" : "false";
                        return truthy ? "true" : "false";
                    }

                case "sql":
                    {
                        var sql = config["sql"].Val<string>();
                        if (string.IsNullOrWhiteSpace(sql)) throw new Exception("sql 节点缺少 sql 配置");
                        var rows = ReadRowsAsJArray(FeDbRead(osClient).FromSql(sql));
                        var outKey = config["outputKey"].Val<string>() ?? "sql_result";
                        context["output"][outKey] = rows;
                        stepEntry["rowCount"] = rows.Count;
                        return null;
                    }

                case "http":
                    {
                        var url = config["url"].Val<string>();
                        var method = (config["method"].Val<string>() ?? "GET").ToUpperInvariant();
                        if (string.IsNullOrWhiteSpace(url)) throw new Exception("http 节点缺少 url");
                        // 简易实现：用 .NET HttpClient 同步执行
                        using (var http = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(30) })
                        {
                            System.Net.Http.HttpResponseMessage resp;
                            if (method == "POST")
                            {
                                var body = config["body"]?.ToString() ?? "";
                                var content = new System.Net.Http.StringContent(body, System.Text.Encoding.UTF8, "application/json");
                                resp = http.PostAsync(url, content).Result;
                            }
                            else
                            {
                                resp = http.GetAsync(url).Result;
                            }
                            var text = resp.Content.ReadAsStringAsync().Result;
                            var outKey = config["outputKey"].Val<string>() ?? "http_result";
                            try { context["output"][outKey] = JToken.Parse(text); }
                            catch { context["output"][outKey] = text; }
                            stepEntry["status"] = (int)resp.StatusCode;
                        }
                        return null;
                    }

                case "apiengine":
                    {
                        var key = config["apiEngineKey"].Val<string>() ?? config["key"].Val<string>();
                        if (string.IsNullOrWhiteSpace(key)) throw new Exception("apiengine 节点缺少 apiEngineKey");
                        stepEntry["apiEngineKey"] = key;
                        // 构造调用参数：用户在节点 config.params 中设置，可用 ${context.xxx} 占位
                        var paramObj = (config["params"] as JObject)?.DeepClone() as JObject ?? new JObject();
                        paramObj["OsClient"] = osClient;
                        paramObj["_FlowContext"] = context;
                        try
                        {
                            var task = MicroiEngine.ApiEngine.RunAsync(key, paramObj);
                            task.Wait();
                            var apiResult = task.Result;
                            var outKey = config["outputKey"].Val<string>() ?? "apiengine_result";
                            try { context["output"][outKey] = JToken.FromObject(apiResult); }
                            catch { context["output"][outKey] = apiResult?.ToString() ?? ""; }
                        }
                        catch (Exception apiEx)
                        {
                            stepEntry["error"] = apiEx.Message;
                            throw new Exception($"apiengine 节点 [{key}] 执行失败：{apiEx.Message}", apiEx);
                        }
                        return null;
                    }

                default:
                    throw new Exception("不支持的节点类型：" + type);
            }
        }

        /// <summary>
        /// 极简表达式求值：支持 context.input.x &gt; 10 / == 'abc' 这类基础比较。
        /// 不开放完整 JS（避免引擎冷启动开销）；用户需要复杂逻辑用 apiengine 节点。
        /// </summary>
        private static bool EvalSimpleExpression(string expr, JObject context)
        {
            expr = (expr ?? "").Trim();
            if (string.IsNullOrEmpty(expr) || expr == "true") return true;
            if (expr == "false") return false;

            // 替换 context.input.x → 实际值
            var resolved = System.Text.RegularExpressions.Regex.Replace(expr,
                @"(input|output)\.([A-Za-z_][A-Za-z_0-9]*)",
                m =>
                {
                    var scope = m.Groups[1].Value;
                    var key = m.Groups[2].Value;
                    var val = context[scope]?[key];
                    if (val == null) return "null";
                    if (val.Type == JTokenType.String) return "'" + val.Val<string>().Replace("'", "''") + "'";
                    return val.ToString();
                });

            // 仅支持 ==, !=, >, >=, <, <=
            var ops = new[] { "==", "!=", ">=", "<=", ">", "<" };
            foreach (var op in ops)
            {
                var idx = resolved.IndexOf(op, StringComparison.Ordinal);
                if (idx > 0)
                {
                    var left = resolved.Substring(0, idx).Trim().Trim('\'');
                    var right = resolved.Substring(idx + op.Length).Trim().Trim('\'');
                    if (double.TryParse(left, out var l) && double.TryParse(right, out var r))
                    {
                        switch (op)
                        {
                            case "==": return l == r;
                            case "!=": return l != r;
                            case ">": return l > r;
                            case ">=": return l >= r;
                            case "<": return l < r;
                            case "<=": return l <= r;
                        }
                    }
                    if (op == "==") return left == right;
                    if (op == "!=") return left != right;
                }
            }
            return !string.IsNullOrWhiteSpace(resolved) && resolved != "null" && resolved != "0";
        }

        #endregion

        #region 运行历史

        public static Task<DosResult<object>> GetFlowRuns(string osClient, string flowIdOrCode, int pageSize = 50)
        {
            try
            {
                var sql = "SELECT r.`Id`,r.`FlowId`,r.`FlowCode`,r.`TriggerSource`,r.`Status`,r.`StartTime`,r.`EndTime`," +
                          "r.`DurationMs`,r.`ErrorMsg`,r.`CreateUserId` " +
                          "FROM `sys_flow_run` r WHERE r.`OsClient`=?os AND (`IsDeleted` IS NULL OR `IsDeleted`=0) ";
                if (!string.IsNullOrWhiteSpace(flowIdOrCode))
                    sql += " AND (r.`FlowId`=?k OR r.`FlowCode`=?k)";
                sql += " ORDER BY r.`StartTime` DESC LIMIT " + Math.Max(1, Math.Min(pageSize, 500));
                var sec = FeDbRead(osClient).FromSql(sql).AddInParameter("?os", osClient);
                if (!string.IsNullOrWhiteSpace(flowIdOrCode)) sec = sec.AddInParameter("?k", flowIdOrCode);
                var rows = ReadRowsAsJArray(sec);
                return Task.FromResult(new DosResult<object>(1, (object)rows));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "获取执行历史失败：" + ex.Message));
            }
        }

        public static Task<DosResult<object>> GetFlowRunDetail(string osClient, string runId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(runId)) return Task.FromResult(new DosResult<object>(0, null, "RunId 不能为空"));
                var rows = ReadRowsAsJArray(FeDbRead(osClient).FromSql(
                    "SELECT * FROM `sys_flow_run` WHERE `OsClient`=?os AND `Id`=?id LIMIT 1")
                    .AddInParameter("?os", osClient).AddInParameter("?id", runId));
                if (rows.Count == 0) return Task.FromResult(new DosResult<object>(2, null, "记录不存在"));
                return Task.FromResult(new DosResult<object>(1, (object)rows[0]));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "获取执行详情失败：" + ex.Message));
            }
        }

        #endregion
    }
}
