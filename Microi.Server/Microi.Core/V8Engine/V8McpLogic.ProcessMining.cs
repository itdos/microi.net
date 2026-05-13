#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：V8McpLogic.ProcessMining.cs
* Copyright(c) Microi.net
* 创 建 人：Microi 团队
* 创建日期：2026-05-11
* 文件描述：流程挖掘 (Process Mining)
*           - 基于 WF_History（审批流执行历史）做聚合分析
*           - 也可基于 sys_flow_run（自动化流执行历史）
*           - 提供：节点活动量、热点路径、SLA 违规、瓶颈节点
*******************************************************/
#endregion
using System;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static partial class V8McpLogic
    {
        private static DbSession PmDbRead(string osClient) => OsClientExtend.GetClient(osClient).DbRead;

        /// <summary>
        /// 按节点聚合：每个节点的处理次数、平均耗时（毫秒）、最大耗时、驳回率。
        /// 耗时定义：同一 TableRowId 下，当前行 CreateTime - 上一行 CreateTime（按时间排序）
        /// </summary>
        public static Task<DosResult<object>> AnalyzeWorkflow(string osClient, string flowDesignId, string fromDate = null, string toDate = null)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(flowDesignId))
                    return Task.FromResult(new DosResult<object>(0, null, "FlowDesignId 必填"));

                // 节点聚合
                var sql = @"
SELECT
  h.`ToNodeId` AS NodeId,
  MAX(h.`ToNodeName`) AS NodeName,
  COUNT(*) AS ActivityCount,
  SUM(CASE WHEN h.`ApprovalType`='Disagree' THEN 1 ELSE 0 END) AS RejectCount,
  ROUND(AVG(TIMESTAMPDIFF(SECOND, prev.PrevTime, h.`CreateTime`))) AS AvgDurationSec,
  MAX(TIMESTAMPDIFF(SECOND, prev.PrevTime, h.`CreateTime`)) AS MaxDurationSec
FROM `WF_History` h
LEFT JOIN (
  SELECT h1.`Id`,
    (SELECT MAX(h2.`CreateTime`) FROM `WF_History` h2
     WHERE h2.`TableRowId`=h1.`TableRowId` AND h2.`CreateTime`<h1.`CreateTime`)
    AS PrevTime
  FROM `WF_History` h1
  WHERE h1.`FlowDesignId`=?fid
) prev ON prev.`Id`=h.`Id`
WHERE h.`FlowDesignId`=?fid
  AND (h.`IsDeleted` IS NULL OR h.`IsDeleted`=0)";
                if (!string.IsNullOrWhiteSpace(fromDate)) sql += " AND h.`CreateTime` >= ?fd";
                if (!string.IsNullOrWhiteSpace(toDate)) sql += " AND h.`CreateTime` <= ?td";
                sql += " GROUP BY h.`ToNodeId` ORDER BY ActivityCount DESC";

                var sec = PmDbRead(osClient).FromSql(sql)
                    .AddInParameter("?fid", flowDesignId);
                if (!string.IsNullOrWhiteSpace(fromDate)) sec = sec.AddInParameter("?fd", fromDate);
                if (!string.IsNullOrWhiteSpace(toDate)) sec = sec.AddInParameter("?td", toDate);
                var rows = ReadRowsAsJArray(sec);

                // 计算 RejectRate
                foreach (var r in rows)
                {
                    var ro = (JObject)r;
                    var cnt = ro["ActivityCount"].Val<double>();
                    var rej = ro["RejectCount"].Val<double>();
                    ro["RejectRate"] = cnt > 0 ? Math.Round(rej / cnt * 100, 2) : 0;
                }

                return Task.FromResult(new DosResult<object>(1, (object)rows));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "分析失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 热点路径：FromNode → ToNode 的边走过的次数排序。
        /// </summary>
        public static Task<DosResult<object>> GetHotPaths(string osClient, string flowDesignId, int topN = 20)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(flowDesignId))
                    return Task.FromResult(new DosResult<object>(0, null, "FlowDesignId 必填"));
                var sql = @"
SELECT
  `FromNodeId`, MAX(`FromNodeName`) AS FromNodeName,
  `ToNodeId`, MAX(`ToNodeName`) AS ToNodeName,
  COUNT(*) AS TraverseCount
FROM `WF_History`
WHERE `FlowDesignId`=?fid
  AND (`IsDeleted` IS NULL OR `IsDeleted`=0)
  AND `FromNodeId` IS NOT NULL AND `FromNodeId`<>''
GROUP BY `FromNodeId`,`ToNodeId`
ORDER BY TraverseCount DESC
LIMIT " + Math.Max(1, Math.Min(topN, 100));
                var rows = ReadRowsAsJArray(PmDbRead(osClient).FromSql(sql)
                    .AddInParameter("?fid", flowDesignId));
                return Task.FromResult(new DosResult<object>(1, (object)rows));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "热点路径分析失败：" + ex.Message));
            }
        }

        /// <summary>
        /// SLA 违规：节点处理耗时 &gt; slaMinutes 的记录
        /// </summary>
        public static Task<DosResult<object>> GetSlaViolations(string osClient, string flowDesignId, int slaMinutes = 60, int topN = 100)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(flowDesignId))
                    return Task.FromResult(new DosResult<object>(0, null, "FlowDesignId 必填"));
                var sql = @"
SELECT
  h.`Id`, h.`FlowTitle`, h.`TableRowId`, h.`ToNodeId`, h.`ToNodeName`,
  h.`UserId`, h.`UserName`, h.`CreateTime`,
  TIMESTAMPDIFF(MINUTE, prev.PrevTime, h.`CreateTime`) AS DurationMinutes
FROM `WF_History` h
LEFT JOIN (
  SELECT h1.`Id`,
    (SELECT MAX(h2.`CreateTime`) FROM `WF_History` h2
     WHERE h2.`TableRowId`=h1.`TableRowId` AND h2.`CreateTime`<h1.`CreateTime`)
    AS PrevTime
  FROM `WF_History` h1
  WHERE h1.`FlowDesignId`=?fid
) prev ON prev.`Id`=h.`Id`
WHERE h.`FlowDesignId`=?fid
  AND (h.`IsDeleted` IS NULL OR h.`IsDeleted`=0)
  AND prev.PrevTime IS NOT NULL
  AND TIMESTAMPDIFF(MINUTE, prev.PrevTime, h.`CreateTime`) > ?sla
ORDER BY DurationMinutes DESC
LIMIT " + Math.Max(1, Math.Min(topN, 500));
                var rows = ReadRowsAsJArray(PmDbRead(osClient).FromSql(sql)
                    .AddInParameter("?fid", flowDesignId)
                    .AddInParameter("?sla", slaMinutes));
                return Task.FromResult(new DosResult<object>(1, (object)rows));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "SLA 分析失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 瓶颈节点：按平均耗时降序的 TopN 节点
        /// </summary>
        public static Task<DosResult<object>> GetBottlenecks(string osClient, string flowDesignId, int topN = 5)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(flowDesignId))
                    return Task.FromResult(new DosResult<object>(0, null, "FlowDesignId 必填"));
                var sql = @"
SELECT
  h.`ToNodeId` AS NodeId,
  MAX(h.`ToNodeName`) AS NodeName,
  COUNT(*) AS ActivityCount,
  ROUND(AVG(TIMESTAMPDIFF(SECOND, prev.PrevTime, h.`CreateTime`))) AS AvgDurationSec,
  MAX(TIMESTAMPDIFF(SECOND, prev.PrevTime, h.`CreateTime`)) AS MaxDurationSec
FROM `WF_History` h
LEFT JOIN (
  SELECT h1.`Id`,
    (SELECT MAX(h2.`CreateTime`) FROM `WF_History` h2
     WHERE h2.`TableRowId`=h1.`TableRowId` AND h2.`CreateTime`<h1.`CreateTime`)
    AS PrevTime
  FROM `WF_History` h1
  WHERE h1.`FlowDesignId`=?fid
) prev ON prev.`Id`=h.`Id`
WHERE h.`FlowDesignId`=?fid
  AND (h.`IsDeleted` IS NULL OR h.`IsDeleted`=0)
  AND prev.PrevTime IS NOT NULL
GROUP BY h.`ToNodeId`
HAVING AvgDurationSec IS NOT NULL
ORDER BY AvgDurationSec DESC
LIMIT " + Math.Max(1, Math.Min(topN, 50));
                var rows = ReadRowsAsJArray(PmDbRead(osClient).FromSql(sql)
                    .AddInParameter("?fid", flowDesignId));
                return Task.FromResult(new DosResult<object>(1, (object)rows));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "瓶颈分析失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 总览统计：流的总执行次数、平均耗时、完成率、驳回率
        /// </summary>
        public static Task<DosResult<object>> GetWorkflowOverview(string osClient, string flowDesignId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(flowDesignId))
                    return Task.FromResult(new DosResult<object>(0, null, "FlowDesignId 必填"));
                // 实例数 = distinct TableRowId
                var totalInstances = PmDbRead(osClient).FromSql(
                    "SELECT COUNT(DISTINCT `TableRowId`) FROM `WF_History` WHERE `FlowDesignId`=?fid AND (`IsDeleted` IS NULL OR `IsDeleted`=0)")
                    .AddInParameter("?fid", flowDesignId)
                    .ToScalar<long>();
                var totalActivities = PmDbRead(osClient).FromSql(
                    "SELECT COUNT(*) FROM `WF_History` WHERE `FlowDesignId`=?fid AND (`IsDeleted` IS NULL OR `IsDeleted`=0)")
                    .AddInParameter("?fid", flowDesignId)
                    .ToScalar<long>();
                var rejectCount = PmDbRead(osClient).FromSql(
                    "SELECT COUNT(*) FROM `WF_History` WHERE `FlowDesignId`=?fid AND `ApprovalType`='Disagree' AND (`IsDeleted` IS NULL OR `IsDeleted`=0)")
                    .AddInParameter("?fid", flowDesignId)
                    .ToScalar<long>();

                var result = new JObject
                {
                    ["TotalInstances"] = totalInstances,
                    ["TotalActivities"] = totalActivities,
                    ["RejectCount"] = rejectCount,
                    ["RejectRate"] = totalActivities > 0 ? Math.Round((double)rejectCount / totalActivities * 100, 2) : 0
                };
                return Task.FromResult(new DosResult<object>(1, (object)result));
            }
            catch (Exception ex)
            {
                return Task.FromResult(new DosResult<object>(0, null, "总览统计失败：" + ex.Message));
            }
        }
    }
}
