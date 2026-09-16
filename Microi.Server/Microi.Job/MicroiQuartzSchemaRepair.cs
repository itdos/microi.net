using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// Quartz 3.19 的 MySQL 方言在“领取下一个到期触发器”时使用
    /// <c>USE INDEX (IDX_{tablePrefix}T_NFT_ST)</c> 与
    /// <c>USE INDEX (IDX_{tablePrefix}T_NFT_ST_MISFIRE)</c>（前缀来自
    /// quartz.jobStore.tablePrefix，平台固定为 microi_job_）。
    ///
    /// 历史租户库的任务表可能仍是旧前缀索引名（例如整体从 QRTZ_ 改名而来），
    /// 或由早期版本建表时未建这两个索引。索引缺失时 MySQL 直接报
    /// “Key 'IDX_microi_job_T_NFT_ST' doesn't exist in table 't'”，
    /// 调度器从此领不到任何触发器（NumberOfJobsExecuted 恒为 0），
    /// 业务上只表现为“定时任务不再执行”，且 Quartz 只给出持久化异常。
    ///
    /// 因此调度器初始化时按实际前缀补齐这两个必需索引：
    /// 可重复执行、多节点并发启动不报错、失败只告警不阻断启动。
    /// </summary>
    public static class MicroiQuartzSchemaRepair
    {
        /// <summary>与 quartz.jobStore.tablePrefix 保持一致的平台固定前缀。</summary>
        public const string DefaultTablePrefix = "microi_job_";

        /// <summary>MySQL 方言依赖的两个触发器领取索引名。</summary>
        public static string[] RequiredTriggerIndexNames(string tablePrefix) => new[]
        {
            $"IDX_{tablePrefix}T_NFT_ST",
            $"IDX_{tablePrefix}T_NFT_ST_MISFIRE"
        };

        /// <summary>
        /// 依据库中已存在的索引名计算需要补齐的 DDL。纯函数，便于回归测试；
        /// 已存在（不分大小写，MySQL 索引名不区分大小写）时不重复创建。
        /// </summary>
        public static List<string> BuildMySqlRepairStatements(string tablePrefix, IEnumerable<string> existingIndexNames)
        {
            if (string.IsNullOrWhiteSpace(tablePrefix))
            {
                throw new ArgumentException("Quartz 表前缀不能为空。", nameof(tablePrefix));
            }
            var existing = new HashSet<string>(
                existingIndexNames ?? Enumerable.Empty<string>(),
                StringComparer.OrdinalIgnoreCase);
            var triggers = tablePrefix + "triggers";
            var statements = new List<string>();
            if (!existing.Contains($"IDX_{tablePrefix}T_NFT_ST"))
            {
                statements.Add($"CREATE INDEX IDX_{tablePrefix}T_NFT_ST ON {triggers} (SCHED_NAME, NEXT_FIRE_TIME, TRIGGER_STATE)");
            }
            if (!existing.Contains($"IDX_{tablePrefix}T_NFT_ST_MISFIRE"))
            {
                statements.Add($"CREATE INDEX IDX_{tablePrefix}T_NFT_ST_MISFIRE ON {triggers} (SCHED_NAME, NEXT_FIRE_TIME, MISFIRE_INSTR, TRIGGER_STATE)");
            }
            return statements;
        }

        /// <summary>只有 MySQL 方言依赖索引提示；SQL Server 使用 WITH (UPDLOCK,ROWLOCK)，无需改写。</summary>
        public static bool RequiresRepair(string driverDelegateType) =>
            !string.IsNullOrWhiteSpace(driverDelegateType)
            && driverDelegateType.IndexOf("MySql", StringComparison.OrdinalIgnoreCase) >= 0;

        /// <summary>
        /// 带时间预算的自愈入口：数据库不可达时不能把调度器启动一起拖住。
        /// 超时只告警并继续启动，Quartz 自身的持久化错误仍会照常上报。
        /// 后台线程可能稍后才真正补上索引，重复执行是幂等的。
        /// </summary>
        public static async Task<int> EnsureWithinBudgetAsync(
            string connectionString,
            string tablePrefix = DefaultTablePrefix,
            TimeSpan? budget = null)
        {
            if (!RequiresMySqlRepair(connectionString, tablePrefix))
            {
                return 0;
            }
            var limit = budget ?? TimeSpan.FromSeconds(8);
            var repair = Task.Run(() => EnsureMySqlTriggerIndexesAsync(connectionString, tablePrefix));
            var completed = await Task.WhenAny(repair, Task.Delay(limit)).ConfigureAwait(false);
            if (completed != repair)
            {
                Console.WriteLine(
                    $"Microi：【Error异常】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】【分布式任务调度】补齐 Quartz 触发器领取索引超时（{limit.TotalSeconds:0}秒），先继续启动；数据库恢复后重启节点即会重试。");
                return 0;
            }
            return await repair.ConfigureAwait(false);
        }

        /// <summary>只有 MySQL 方言 + 非空连接串 + 非空前缀才需要自愈。</summary>
        public static bool RequiresMySqlRepair(string connectionString, string tablePrefix) =>
            !string.IsNullOrWhiteSpace(connectionString) && !string.IsNullOrWhiteSpace(tablePrefix);

        /// <summary>幂等补齐 MySQL 触发器领取索引；返回本次实际创建的索引数量。
        /// 表不存在、并发节点刚好创建成功、或数据库不支持该 DDL 时都不抛异常。</summary>
        public static async Task<int> EnsureMySqlTriggerIndexesAsync(
            string connectionString,
            string tablePrefix = DefaultTablePrefix,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(connectionString) || string.IsNullOrWhiteSpace(tablePrefix))
            {
                return 0;
            }
            var triggers = tablePrefix + "triggers";
            try
            {
                var db = new DbSession(DatabaseType.MySql, connectionString);
                if (db.FromSql(
                        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@tableName")
                    .AddInParameter("@tableName", triggers)
                    .ToScalar<int>() <= 0)
                {
                    // 允许 performSchemaValidation=false 的空库：没有任务表时无索引可补。
                    return 0;
                }

                var existing = new List<string>();
                foreach (var indexName in RequiredTriggerIndexNames(tablePrefix))
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var count = db.FromSql(
                            "SELECT COUNT(DISTINCT INDEX_NAME) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@tableName AND INDEX_NAME=@indexName")
                        .AddInParameter("@tableName", triggers)
                        .AddInParameter("@indexName", indexName)
                        .ToScalar<int>();
                    if (count > 0)
                    {
                        existing.Add(indexName);
                    }
                }

                var created = 0;
                foreach (var statement in BuildMySqlRepairStatements(tablePrefix, existing))
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    try
                    {
                        db.FromSql(statement).ExecuteNonQuery();
                        created++;
                        Console.WriteLine(
                            $"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】【分布式任务调度】已补齐 Quartz 触发器领取索引：{statement}");
                    }
                    catch (Exception ex) when (IsAlreadySatisfied(ex))
                    {
                        // 多节点同时启动时另一个节点可能已创建成功；视为已满足。
                    }
                }
                return created;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                // 索引修复失败不能让调度器启动失败：升级日志会给出准确原因，便于人工执行同一条 DDL。
                Console.WriteLine(
                    $"Microi：【Error异常】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】【分布式任务调度】补齐 Quartz 触发器领取索引失败：{ex.Message}");
                return 0;
            }
        }

        /// <summary>MySQL 1061/1146 与等价文本：另一节点刚创建、或表在检测后被删除，均无需报错。</summary>
        private static bool IsAlreadySatisfied(Exception ex)
        {
            var message = ex.Message ?? string.Empty;
            return message.IndexOf("Duplicate key name", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("already exists", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("doesn't exist", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("Unknown table", StringComparison.OrdinalIgnoreCase) >= 0;
        }
    }
}
