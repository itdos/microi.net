using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Installs the durable database contract for application asset stream v3.
    /// The migration is deliberately fail-closed: legacy rows are classified as
    /// unverified, while ambiguous identity/null/duplicate data is never deleted
    /// or silently merged to make a unique index succeed.
    /// </summary>
    public sealed class Upgrade25
    {
        public static string Version = "6.9.7.1";
        public const int LegacyPublishProtocolVersion = 2;
        public const string LegacyPublishState = "LegacyUnverified";
        public const string LegacyPublishMode = "LegacyOpen";
        public const string LegacyUnversionedVersionNo = "legacy-unversioned-v3";
        public const string LegacyUnversionedStatus = "LegacyUnversioned";

        private const string StoreTable = "sys_microistore";
        private const string VersionTable = "mci_ai_app_version";
        private const string FileTable = "mci_ai_app_file";
        private const string TenantTable = "sys_osclients";
        public const string GateTransitionAuditTable = "mci_app_stream_gate_transition";
        private const int FileHashPageSize = 500;

        public enum SchemaDialect
        {
            MySql,
            SqlServer,
            Oracle,
            PostgreSql
        }

        public enum ApplicationStoreTablePresence
        {
            None,
            Complete,
            Partial
        }

        public sealed class LegacyFileVersionBackfillSummary
        {
            public int ApplicationCount { get; set; }
            public long FileCount { get; set; }
            public int CreatedVersionCount { get; set; }
            public int ReusedVersionCount { get; set; }
            public long ReassignedFileCount { get; set; }
        }

        public sealed class LegacyFileArchiveCandidate
        {
            public string Id { get; set; }
            public string FilePath { get; set; }
            public long Size { get; set; }
            public int? CurrentLane { get; set; }
        }

        public sealed class LegacyFileArchiveAssignment
        {
            public string Id { get; set; }
            public string FilePathHash { get; set; }
            public long Size { get; set; }
            public int Lane { get; set; }
            public string VersionNo { get; set; }
            public string VersionId { get; set; }
        }

        private sealed class LegacyFileArchivePlanningRow
        {
            public LegacyFileArchiveCandidate Candidate { get; set; }
            public string Id { get; set; }
            public string Hash { get; set; }
        }

        public static readonly IReadOnlyList<string> RequiredApplicationStoreTables = new[]
        {
            StoreTable,
            VersionTable,
            FileTable
        };

        public sealed class SchemaField
        {
            public SchemaField(
                string tableName,
                string name,
                string label,
                string logicalType,
                string component,
                int sort,
                bool control = false,
                string defaultValue = null,
                string sqlServerDefaultConstraint = null,
                bool visible = false,
                bool sqlServerUnicode = false)
            {
                TableName = tableName;
                Name = name;
                Label = label;
                LogicalType = logicalType;
                Component = component;
                Sort = sort;
                Control = control;
                DefaultValue = defaultValue;
                SqlServerDefaultConstraint = sqlServerDefaultConstraint;
                Visible = visible;
                SqlServerUnicode = sqlServerUnicode;
            }

            public string TableName { get; }
            public string Name { get; }
            public string Label { get; }
            public string LogicalType { get; }
            public string Component { get; }
            public int Sort { get; }
            public bool Control { get; }
            public string DefaultValue { get; }
            public string SqlServerDefaultConstraint { get; }
            public bool Visible { get; }
            public bool SqlServerUnicode { get; }
        }

        public sealed class SchemaIndex
        {
            public SchemaIndex(
                string tableName,
                string name,
                string[] columns,
                bool unique,
                string sqlServerFilterColumn = null,
                string[] requiredNonBlankColumns = null)
            {
                TableName = tableName;
                Name = name;
                Columns = columns;
                Unique = unique;
                SqlServerFilterColumn = sqlServerFilterColumn;
                RequiredNonBlankColumns = requiredNonBlankColumns ?? Array.Empty<string>();
            }

            public string TableName { get; }
            public string Name { get; }
            public string[] Columns { get; }
            public bool Unique { get; }
            public string SqlServerFilterColumn { get; }
            public string[] RequiredNonBlankColumns { get; }
        }

        public static readonly IReadOnlyList<string> CanonicalPublishStates = new[]
        {
            "Prepared",
            "Verifying",
            "ReleaseVerified",
            "PointerCommitted",
            "ProjectionPending",
            "Completed",
            "FailedBeforeCommit",
            "RepairRequired",
            LegacyPublishState,
            "ManualReview",
            "Superseded"
        };

        public static readonly IReadOnlyList<SchemaField> Fields = new[]
        {
            new SchemaField(StoreTable, "PublishProtocolVersion", "发布协议版本", "int", "NumberText", 2000,
                true, "2", "df_mstore_pub_protocol"),
            new SchemaField(StoreTable, "PublishState", "发布状态机", "varchar(50)", "Text", 2010,
                true, LegacyPublishState, "df_mstore_pub_state"),
            new SchemaField(StoreTable, "PublishFence", "发布栅栏令牌", "bigint", "NumberText", 2020,
                true, "0", "df_mstore_pub_fence"),
            new SchemaField(StoreTable, "PublishRowVersion", "发布行版本", "bigint", "NumberText", 2030,
                true, "0", "df_mstore_pub_rowver"),
            new SchemaField(StoreTable, "ActivePublishVersionId", "活动发布版本Id", "varchar(50)", "Text", 2040),
            new SchemaField(StoreTable, "CommittedPublishVersionId", "已提交发布版本Id", "varchar(50)", "Text", 2050),
            new SchemaField(StoreTable, "CommittedRuntimeManifestHash", "已提交运行清单Hash", "char(64)", "Text", 2060),

            new SchemaField(VersionTable, "PublishProtocolVersion", "发布协议版本", "int", "NumberText", 2000,
                true, "2", "df_aav_pub_protocol"),
            new SchemaField(VersionTable, "PublishState", "发布状态机", "varchar(50)", "Text", 2010,
                true, LegacyPublishState, "df_aav_pub_state"),
            new SchemaField(VersionTable, "RequestId", "发布请求Id", "varchar(128)", "Text", 2020),
            new SchemaField(VersionTable, "DeliveryBatchId", "交付批次Id", "varchar(50)", "Text", 2030),
            new SchemaField(VersionTable, "RequestFingerprint", "请求指纹", "char(64)", "Text", 2040),
            new SchemaField(VersionTable, "SourceManifestHash", "源码清单Hash", "char(64)", "Text", 2050),
            new SchemaField(VersionTable, "RuntimeManifestHash", "运行清单Hash", "char(64)", "Text", 2060),
            new SchemaField(VersionTable, "ExpectedCurrentVersion", "预期当前版本", "int", "NumberText", 2070),
            new SchemaField(VersionTable, "ExpectedAppVersion", "预期应用版本", "varchar(50)", "Text", 2080),
            new SchemaField(VersionTable, "EntryPath", "入口路径", "varchar(1200)", "Text", 2090,
                sqlServerUnicode: true),
            new SchemaField(VersionTable, "ReleasePrefix", "不可变发布前缀", "varchar(2000)", "Textarea", 2100,
                sqlServerUnicode: true),
            new SchemaField(VersionTable, "AssetManifestJson", "资产清单", "mediumtext", "CodeEditor", 2110),
            new SchemaField(VersionTable, "FencingToken", "栅栏令牌", "bigint", "NumberText", 2120,
                true, "0", "df_aav_fencing_token"),
            new SchemaField(VersionTable, "RowVersion", "行版本", "bigint", "NumberText", 2130,
                true, "0", "df_aav_rowver"),
            new SchemaField(VersionTable, "PointerCommittedAt", "指针提交时间", "datetime", "DateTime", 2140),
            new SchemaField(VersionTable, "CompletedAt", "完成时间", "datetime", "DateTime", 2150),
            new SchemaField(VersionTable, "LastError", "最近错误", "mediumtext", "Textarea", 2160),
            new SchemaField(VersionTable, "RecoveryEpoch", "恢复代次", "int", "NumberText", 2170,
                true, "0", "df_aav_recovery_epoch"),
            new SchemaField(VersionTable, "RouteSnapshotJson", "路由快照", "mediumtext", "CodeEditor", 2180),
            new SchemaField(VersionTable, "RouteSnapshotHash", "路由快照Hash", "char(64)", "Text", 2190),

            // MySQL cannot index VersionId + utf8mb4 varchar(1000) within the
            // 3072-byte InnoDB key limit. The full normalized logical path is
            // therefore protected by a server-computed SHA-256 identity.
            new SchemaField(FileTable, "FilePathHash", "规范化文件路径Hash", "char(64)", "Text", 150),

            new SchemaField(TenantTable, "ApplicationStreamPublishMode", "应用流式发布模式", "varchar(20)", "Text", 10600,
                true, LegacyPublishMode, "df_os_app_stream_mode"),
            new SchemaField(TenantTable, "ApplicationStreamMinProtocol", "应用流式发布最低协议", "int", "NumberText", 10610,
                true, "2", "df_os_app_stream_min"),
            new SchemaField(TenantTable, "ApplicationStreamGateEpoch", "应用流式发布门禁代次", "bigint", "NumberText", 10620,
                true, "0", "df_os_app_stream_epoch")
        };

        /// <summary>
        /// SQL Server varchar uses a database code page and cannot preserve every
        /// NFC Unicode asset path. These columns form the minimum v3 path contract
        /// that must be nvarchar on SQL Server. FilePath predates v3 and is repaired
        /// in place; EntryPath and ReleasePrefix are also created as nvarchar on a
        /// fresh/partial schema.
        /// </summary>
        public static readonly IReadOnlyList<SchemaField> SqlServerUnicodeColumns = new[]
        {
            new SchemaField(FileTable, "FilePath", "文件路径", "varchar(1000)", "Text", 0,
                sqlServerUnicode: true),
            Fields.Single(field => field.TableName == VersionTable && field.Name == "EntryPath"),
            Fields.Single(field => field.TableName == VersionTable && field.Name == "ReleasePrefix")
        };

        /// <summary>
        /// Physical-only audit contract for privileged application-stream gate
        /// changes. It intentionally has no diy_table/diy_field metadata: these
        /// rows are an operational security ledger and must not be writable via
        /// the generic FormEngine surface.
        /// </summary>
        public static readonly IReadOnlyList<SchemaField> GateTransitionAuditFields = new[]
        {
            new SchemaField(GateTransitionAuditTable, "Id", "审计Id", "varchar(50)", "Text", 10),
            new SchemaField(GateTransitionAuditTable, "TransitionId", "转换Id", "varchar(128)", "Text", 20),
            new SchemaField(GateTransitionAuditTable, "OsClient", "租户", "varchar(50)", "Text", 30),
            new SchemaField(GateTransitionAuditTable, "OsClientType", "租户类型", "varchar(50)", "Text", 40),
            new SchemaField(GateTransitionAuditTable, "OsClientNetwork", "租户网络", "varchar(50)", "Text", 50),
            new SchemaField(GateTransitionAuditTable, "ExpectedMode", "预期模式", "varchar(20)", "Text", 60),
            new SchemaField(GateTransitionAuditTable, "ExpectedMinProtocol", "预期最低协议", "int", "NumberText", 70),
            new SchemaField(GateTransitionAuditTable, "ExpectedGateEpoch", "预期门禁代次", "bigint", "NumberText", 80),
            new SchemaField(GateTransitionAuditTable, "TargetMode", "目标模式", "varchar(20)", "Text", 90),
            new SchemaField(GateTransitionAuditTable, "TargetMinProtocol", "目标最低协议", "int", "NumberText", 100),
            new SchemaField(GateTransitionAuditTable, "ResultGateEpoch", "结果门禁代次", "bigint", "NumberText", 110),
            new SchemaField(GateTransitionAuditTable, "DrainProofJson", "逐节点排空证明", "mediumtext", "CodeEditor", 120),
            new SchemaField(GateTransitionAuditTable, "DrainProofSha256", "排空证明Hash", "char(64)", "Text", 130),
            new SchemaField(GateTransitionAuditTable, "RequestFingerprint", "请求指纹", "char(64)", "Text", 140),
            new SchemaField(GateTransitionAuditTable, "ConfirmationSha256", "二阶段确认Hash", "char(64)", "Text", 150),
            new SchemaField(GateTransitionAuditTable, "OperatorUserId", "操作人Id", "varchar(50)", "Text", 160),
            new SchemaField(GateTransitionAuditTable, "OperatorAccount", "操作人账号", "varchar(100)", "Text", 170,
                sqlServerUnicode: true),
            new SchemaField(GateTransitionAuditTable, "OperatorName", "操作人姓名", "varchar(200)", "Text", 180,
                sqlServerUnicode: true),
            new SchemaField(GateTransitionAuditTable, "Reason", "转换原因", "varchar(1000)", "Textarea", 190,
                sqlServerUnicode: true),
            new SchemaField(GateTransitionAuditTable, "CreateTime", "创建时间", "datetime", "DateTime", 200)
        };

        public static readonly IReadOnlyCollection<string> GateTransitionAuditRequiredColumns =
            GateTransitionAuditFields
                .Where(field => field.Name != "DrainProofJson" && field.Name != "DrainProofSha256")
                .Select(field => field.Name)
                .ToArray();

        public static readonly IReadOnlyList<SchemaIndex> Indexes = new[]
        {
            new SchemaIndex(VersionTable, "ux_aav_app_version", new[] { "AppId", "VersionNo" }, true,
                requiredNonBlankColumns: new[] { "AppId", "VersionNo" }),
            new SchemaIndex(VersionTable, "ux_aav_app_request", new[] { "AppId", "RequestId" }, true,
                sqlServerFilterColumn: "RequestId", requiredNonBlankColumns: new[] { "AppId" }),
            new SchemaIndex(FileTable, "ux_aaf_version_pathhash", new[] { "VersionId", "FilePathHash" }, true,
                sqlServerFilterColumn: "VersionId",
                requiredNonBlankColumns: new[] { "VersionId", "FilePath", "FilePathHash" }),
            new SchemaIndex(VersionTable, "ix_aav_state_time_app", new[] { "PublishState", "UpdateTime", "AppId" }, false),
            new SchemaIndex(FileTable, "ix_aaf_app_version_scope", new[] { "AppId", "VersionId", "StorageScope" }, false),
            new SchemaIndex(StoreTable, "ix_store_active_fence", new[] { "ActivePublishVersionId", "PublishFence" }, false),
            new SchemaIndex(GateTransitionAuditTable, "ux_asgt_transition_id", new[] { "TransitionId" }, true,
                requiredNonBlankColumns: new[] { "TransitionId" })
        };

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                    throw new InvalidOperationException($"未找到租户[{osClient}]数据库连接。");

                var dialect = ResolveDialect(client);
                foreach (var tableName in new[] { StoreTable, VersionTable, FileTable, TenantTable })
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    if (!client.Db.TableExists(tableName))
                        throw new InvalidOperationException($"缺少物理表 {tableName}，拒绝推进应用发布 v3 数据库版本。");
                }

                EnsureGateTransitionAuditTable(client, dialect);

                foreach (var field in Fields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    EnsurePhysicalColumn(client, dialect, field);
                }
                foreach (var field in GateTransitionAuditFields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    EnsurePhysicalColumn(client, dialect, field);
                }
                if (dialect == SchemaDialect.SqlServer)
                {
                    EnsureSqlServerUnicodeColumns(client);
                }

                BackfillLegacyControlValues(client, dialect);
                foreach (var field in Fields.Where(item => item.Control))
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    EnforceControlColumn(client, dialect, field);
                }

                ValidateCanonicalStates(client, dialect, StoreTable);
                ValidateCanonicalStates(client, dialect, VersionTable);
                var legacyVersionBackfill = BackfillLegacyFileVersionIds(
                    osClient,
                    client,
                    dialect);
                if (legacyVersionBackfill.FileCount > 0)
                {
                    UpgradeProgress.WriteLine(
                        $"Microi：【自动升级状态】【{osClient}】【Upgrade25-历史应用文件归档】成功："
                        + $"应用={legacyVersionBackfill.ApplicationCount}，文件={legacyVersionBackfill.FileCount}，"
                        + $"新建历史版本={legacyVersionBackfill.CreatedVersionCount}，"
                        + $"复用历史版本={legacyVersionBackfill.ReusedVersionCount}，"
                        + $"无损重排文件={legacyVersionBackfill.ReassignedFileCount}。");
                }
                BackfillFilePathHashes(client, dialect);

                foreach (var index in Indexes)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    if (index.Unique) AuditUniqueIdentity(client, dialect, index);
                    EnsureIndex(osClient, client, dialect, index);
                }

                foreach (var tableGroup in Fields.GroupBy(item => item.TableName))
                {
                    await EnsureMetadataAsync(osClient, tableGroup.Key, tableGroup.ToArray()).ConfigureAwait(false);
                }
            }
            catch (Exception ex)
            {
                messages.Add("应用发布 v3 数据库升级失败：" + ex.Message);
            }
            return messages;
        }

        /// <summary>
        /// Re-applies the tenant gate contract independently of ServerVersion.
        /// Fresh-install packages do not own sys_osclients, and an operator may
        /// restore a partial schema while keeping a newer version marker, so the
        /// runtime gate must remain a hosted, idempotent invariant.
        /// </summary>
        public async Task<List<string>> EnsureTenantGateInvariant(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                    throw new InvalidOperationException($"未找到租户[{osClient}]数据库连接。");
                if (!client.Db.TableExists(TenantTable))
                    throw new InvalidOperationException($"缺少物理表 {TenantTable}，无法建立应用发布门禁。");

                var dialect = ResolveDialect(client);
                var gateFields = Fields.Where(item => item.TableName == TenantTable).ToArray();
                foreach (var field in gateFields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    EnsurePhysicalColumn(client, dialect, field);
                }

                BackfillLegacyControlValues(client, dialect, gateFields);
                foreach (var field in gateFields)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    EnforceControlColumn(client, dialect, field);
                }
                await EnsureMetadataAsync(osClient, TenantTable, gateFields).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                messages.Add("应用发布 v3 租户门禁检查失败：" + ex.Message);
            }
            return messages;
        }

        /// <summary>
        /// Cheap startup invariant for databases whose ServerVersion may already
        /// be current while an application-store package was freshly installed or
        /// only partially restored. It performs read-only physical checks first;
        /// the full idempotent migration runs only when a required column, Unicode
        /// path shape, or index definition is absent.
        /// </summary>
        public async Task<List<string>> EnsureApplicationStreamV3SchemaInvariant(string osClient)
        {
            var messages = new List<string>();
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                    throw new InvalidOperationException($"未找到租户[{osClient}]数据库连接。");
                var dialect = ResolveDialect(client);
                var missing = GetMissingSchemaContract(osClient, client, dialect);
                if (missing.Count == 0) return messages;

                var repairMessages = await Run(osClient).ConfigureAwait(false);
                if (repairMessages.Count > 0) return repairMessages;

                var remaining = GetMissingSchemaContract(osClient, client, dialect);
                if (remaining.Count > 0)
                {
                    messages.Add("应用发布 v3 结构修复后仍缺少：" + string.Join(",", remaining));
                }
            }
            catch (Exception ex)
            {
                messages.Add("应用发布 v3 结构不变量检查失败：" + ex.Message);
            }
            return messages;
        }

        /// <summary>
        /// Pure contract diff used by startup readiness and fresh-install tests.
        /// A null Unicode predicate means the current provider has no additional
        /// SQL Server Unicode shape requirement.
        /// </summary>
        public static IReadOnlyList<string> FindMissingSchemaContract(
            Func<string, string, bool> columnExists,
            Func<SchemaIndex, bool> indexExists,
            Func<SchemaField, bool> sqlServerUnicodeCompatible = null)
        {
            if (columnExists == null) throw new ArgumentNullException(nameof(columnExists));
            if (indexExists == null) throw new ArgumentNullException(nameof(indexExists));
            var missing = new List<string>();
            foreach (var field in Fields.Concat(GateTransitionAuditFields))
            {
                if (!columnExists(field.TableName, field.Name))
                    missing.Add($"column:{field.TableName}.{field.Name}");
            }
            foreach (var index in Indexes)
            {
                if (!indexExists(index))
                    missing.Add($"index:{index.TableName}.{index.Name}");
            }
            if (sqlServerUnicodeCompatible != null)
            {
                foreach (var field in SqlServerUnicodeColumns)
                {
                    if (!sqlServerUnicodeCompatible(field))
                        missing.Add($"unicode:{field.TableName}.{field.Name}");
                }
            }
            return missing;
        }

        public static ApplicationStoreTablePresence ClassifyApplicationStoreTablePresence(
            Func<string, bool> tableExists)
        {
            if (tableExists == null) throw new ArgumentNullException(nameof(tableExists));
            var existing = RequiredApplicationStoreTables.Count(tableExists);
            if (existing == 0) return ApplicationStoreTablePresence.None;
            return existing == RequiredApplicationStoreTables.Count
                ? ApplicationStoreTablePresence.Complete
                : ApplicationStoreTablePresence.Partial;
        }

        private static IReadOnlyList<string> GetMissingSchemaContract(
            string osClient,
            OsClientSecret client,
            SchemaDialect dialect)
        {
            var appStorePresence = ClassifyApplicationStoreTablePresence(
                tableName => client.Db.TableExists(tableName));
            // AI 应用商城是可选基础应用。三个商城表全未安装时，仅维护
            // sys_osclients gate，不得让 v3 readiness 阻断普通租户启动。
            if (appStorePresence == ApplicationStoreTablePresence.None)
                return Array.Empty<string>();

            var missingTables = RequiredApplicationStoreTables
                .Concat(new[] { TenantTable, GateTransitionAuditTable })
                .Where(tableName => !client.Db.TableExists(tableName))
                .Select(tableName => "table:" + tableName)
                .ToList();
            if (missingTables.Count > 0) return missingTables;

            var indexesByTable = new Dictionary<string, List<V8McpLogic.TableIndexInfo>>(
                StringComparer.OrdinalIgnoreCase);
            foreach (var tableName in Indexes.Select(index => index.TableName).Distinct(StringComparer.OrdinalIgnoreCase))
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var result = V8McpLogic.GetTableIndexes(osClient, tableName);
                if (result?.Code != 1)
                    throw new InvalidOperationException(result?.Msg ?? $"读取 {tableName} 索引失败。");
                indexesByTable[tableName] = result.Data ?? new List<V8McpLogic.TableIndexInfo>();
            }

            Func<SchemaField, bool> unicodeCheck = dialect == SchemaDialect.SqlServer
                ? new Func<SchemaField, bool>(field => IsSqlServerUnicodeColumnCompatible(client, field))
                : null;
            return FindMissingSchemaContract(
                (tableName, columnName) => client.Db.ColumnExists(tableName, columnName),
                definition => indexesByTable[definition.TableName].Any(actual =>
                    MatchesIndex(actual, definition)
                    && IsAcceptableIndex(client, dialect, actual, definition)),
                unicodeCheck);
        }

        public static SchemaDialect ParseDialect(string dbType)
        {
            if (string.Equals(dbType, "MySql", StringComparison.OrdinalIgnoreCase)
                || string.Equals(dbType, "MySQL", StringComparison.OrdinalIgnoreCase))
                return SchemaDialect.MySql;
            if (string.Equals(dbType, "SqlServer", StringComparison.OrdinalIgnoreCase)
                || string.Equals(dbType, "MSSQL", StringComparison.OrdinalIgnoreCase))
                return SchemaDialect.SqlServer;
            if (string.Equals(dbType, "Oracle", StringComparison.OrdinalIgnoreCase))
                return SchemaDialect.Oracle;
            if (string.Equals(dbType, "PostgreSql", StringComparison.OrdinalIgnoreCase)
                || string.Equals(dbType, "PostgreSQL", StringComparison.OrdinalIgnoreCase)
                || string.Equals(dbType, "Postgres", StringComparison.OrdinalIgnoreCase))
                return SchemaDialect.PostgreSql;
            throw new NotSupportedException($"应用发布 v3 数据库升级暂不支持数据库类型：{dbType ?? "<null>"}。");
        }

        public static SchemaDialect ParseDialect(DatabaseType databaseType)
        {
            return databaseType switch
            {
                DatabaseType.MySql => SchemaDialect.MySql,
                DatabaseType.SqlServer => SchemaDialect.SqlServer,
                DatabaseType.SqlServer9 => SchemaDialect.SqlServer,
                DatabaseType.Oracle => SchemaDialect.Oracle,
                DatabaseType.PostgreSql => SchemaDialect.PostgreSql,
                _ => throw new NotSupportedException($"应用发布 v3 数据库升级暂不支持数据库类型：{databaseType}。")
            };
        }

        private static SchemaDialect ResolveDialect(OsClientSecret client)
        {
            var provider = client?.Db?.Db?.DbProvider;
            if (provider == null)
                throw new InvalidOperationException("未找到租户主库物理方言，拒绝根据可能陈旧的 OsClientModel.DbType 猜测。");
            return ParseDialect(provider.DatabaseType);
        }

        public static string BuildAddColumnSql(SchemaDialect dialect, SchemaField field)
        {
            var type = PhysicalType(dialect, field.LogicalType, field.SqlServerUnicode);
            return dialect switch
            {
                SchemaDialect.MySql => $"ALTER TABLE `{field.TableName}` ADD COLUMN `{field.Name}` {type} NULL",
                SchemaDialect.SqlServer => $"ALTER TABLE [{field.TableName}] ADD [{field.Name}] {type} NULL",
                SchemaDialect.Oracle => $"ALTER TABLE {field.TableName} ADD ({field.Name} {type} NULL)",
                SchemaDialect.PostgreSql => $"ALTER TABLE \"{field.TableName}\" ADD COLUMN \"{field.Name}\" {type} NULL",
                _ => throw new ArgumentOutOfRangeException(nameof(dialect))
            };
        }

        public static string BuildCreateGateTransitionAuditTableSql(SchemaDialect dialect)
        {
            var columns = GateTransitionAuditFields.Select(field =>
            {
                var nullable = string.Equals(field.Name, "Id", StringComparison.OrdinalIgnoreCase)
                    ? " NOT NULL"
                    : " NULL";
                return Quote(dialect, field.Name) + " "
                       + PhysicalType(dialect, field.LogicalType, field.SqlServerUnicode)
                       + nullable;
            }).ToList();
            columns.Add("CONSTRAINT " + Quote(dialect, "pk_asgt")
                        + " PRIMARY KEY (" + Quote(dialect, "Id") + ")");
            var create = "CREATE TABLE " + Quote(dialect, GateTransitionAuditTable)
                         + " (" + string.Join(", ", columns) + ")";
            if (dialect == SchemaDialect.MySql)
                return create + " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
            if (dialect == SchemaDialect.SqlServer)
                return "IF OBJECT_ID(N'" + GateTransitionAuditTable + "',N'U') IS NULL BEGIN "
                       + create + " END";
            return create;
        }

        public static string BuildGateTransitionAuditNotNullSql(
            SchemaDialect dialect,
            SchemaField field)
        {
            if (field == null) throw new ArgumentNullException(nameof(field));
            if (!string.Equals(field.TableName, GateTransitionAuditTable, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("字段不属于门禁转换审计表。", nameof(field));
            if (!GateTransitionAuditRequiredColumns.Contains(field.Name, StringComparer.OrdinalIgnoreCase))
                throw new ArgumentException("字段允许 NULL。", nameof(field));
            var type = PhysicalType(dialect, field.LogicalType, field.SqlServerUnicode);
            // The historical method name is retained for compatibility. Only
            // the primary Id is physically required; audit content is validated
            // by the trusted writer and the migration's existing data checks.
            var nullable = string.Equals(field.Name, "Id", StringComparison.OrdinalIgnoreCase) ? "NOT NULL" : "NULL";
            return dialect switch
            {
                SchemaDialect.MySql => $"ALTER TABLE `{GateTransitionAuditTable}` MODIFY COLUMN `{field.Name}` {type} {nullable}",
                SchemaDialect.SqlServer => $"ALTER TABLE [{GateTransitionAuditTable}] ALTER COLUMN [{field.Name}] {type} {nullable}",
                SchemaDialect.Oracle => $"ALTER TABLE {GateTransitionAuditTable} MODIFY ({field.Name} {type} {nullable})",
                SchemaDialect.PostgreSql => $"ALTER TABLE \"{GateTransitionAuditTable}\" ALTER COLUMN \"{field.Name}\" " + (nullable == "NULL" ? "DROP NOT NULL" : "SET NOT NULL"),
                _ => throw new ArgumentOutOfRangeException(nameof(dialect))
            };
        }

        public static string BuildControlAlterSql(SchemaDialect dialect, SchemaField field)
        {
            if (!field.Control) throw new ArgumentException("字段不是控制列。", nameof(field));
            var type = PhysicalType(dialect, field.LogicalType, field.SqlServerUnicode);
            var literal = SqlLiteral(field.DefaultValue);
            return dialect switch
            {
                SchemaDialect.MySql =>
                    $"ALTER TABLE `{field.TableName}` MODIFY COLUMN `{field.Name}` {type} NULL DEFAULT {literal}",
                SchemaDialect.SqlServer =>
                    $"ALTER TABLE [{field.TableName}] ALTER COLUMN [{field.Name}] {type} NULL",
                SchemaDialect.Oracle =>
                    $"ALTER TABLE {field.TableName} MODIFY ({field.Name} {type} DEFAULT {literal} NULL)",
                SchemaDialect.PostgreSql =>
                    $"ALTER TABLE \"{field.TableName}\" ALTER COLUMN \"{field.Name}\" SET DEFAULT {literal}, ALTER COLUMN \"{field.Name}\" DROP NOT NULL",
                _ => throw new ArgumentOutOfRangeException(nameof(dialect))
            };
        }

        internal static string BuildSqlServerPreservingControlAlterSql(
            SchemaField field,
            string currentPhysicalType)
        {
            if (field == null) throw new ArgumentNullException(nameof(field));
            if (!field.Control) throw new ArgumentException("字段不是控制列。", nameof(field));

            var physicalType = (currentPhysicalType ?? string.Empty).Trim();
            if (!Regex.IsMatch(
                    physicalType,
                    @"^(?:(?:n?varchar|n?char|varbinary|binary)\((?:max|\d+)\)|(?:decimal|numeric)\(\d+,\d+\)|(?:datetime2|datetimeoffset|time)\(\d+\)|[a-z][a-z0-9_]*)$",
                    RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
            {
                throw new InvalidOperationException(
                    $"无法安全保留 {field.TableName}.{field.Name} 的 SQL Server 物理类型：{currentPhysicalType ?? "<null>"}。");
            }

            return $"ALTER TABLE [{field.TableName}] ALTER COLUMN [{field.Name}] {physicalType} NULL";
        }

        public static string BuildCreateIndexSql(SchemaDialect dialect, SchemaIndex index)
        {
            var unique = index.Unique ? "UNIQUE " : string.Empty;
            if (dialect == SchemaDialect.MySql)
            {
                return $"CREATE {unique}INDEX `{index.Name}` ON `{index.TableName}` "
                       + $"({string.Join(", ", index.Columns.Select(column => $"`{column}`"))})";
            }
            if (dialect == SchemaDialect.SqlServer)
            {
                var filter = index.SqlServerFilterColumn == null
                    ? string.Empty
                    : $" WHERE [{index.SqlServerFilterColumn}] IS NOT NULL";
                return $"CREATE {unique}NONCLUSTERED INDEX [{index.Name}] ON [{index.TableName}] "
                       + $"({string.Join(", ", index.Columns.Select(column => $"[{column}]"))}){filter}";
            }
            if (dialect == SchemaDialect.PostgreSql)
            {
                return $"CREATE {unique}INDEX \"{index.Name}\" ON \"{index.TableName}\" "
                       + $"({string.Join(", ", index.Columns.Select(column => $"\"{column}\""))})";
            }
            return $"CREATE {unique}INDEX {index.Name} ON {index.TableName} "
                   + $"({string.Join(", ", index.Columns)})";
        }

        public static string BuildDuplicateAuditSql(SchemaDialect dialect, SchemaIndex index)
        {
            var quotedColumns = index.Columns.Select(column => Quote(dialect, column)).ToArray();
            var where = index.SqlServerFilterColumn == null
                ? string.Empty
                : $" WHERE {Quote(dialect, index.SqlServerFilterColumn)} IS NOT NULL";
            var alias = dialect == SchemaDialect.Oracle ? " duplicate_groups" : " AS duplicate_groups";
            return $"SELECT COUNT(*) FROM (SELECT {string.Join(", ", quotedColumns)} "
                   + $"FROM {Quote(dialect, index.TableName)}{where} "
                   + $"GROUP BY {string.Join(", ", quotedColumns)} HAVING COUNT(*) > 1){alias}";
        }

        public static string BuildFilePathDuplicateAuditSql(SchemaDialect dialect)
        {
            return BuildDuplicateAuditSql(dialect, new SchemaIndex(
                FileTable,
                "audit_aaf_version_path",
                new[] { "VersionId", "FilePath" },
                true));
        }

        public static string ComputeFilePathHash(string filePath)
        {
            var normalized = V8McpLogic.NormalizeApplicationAssetRelativePath(filePath);
            using var sha256 = SHA256.Create();
            var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(normalized));
            return BitConverter.ToString(hash).Replace("-", string.Empty).ToLowerInvariant();
        }

        private static string PhysicalType(
            SchemaDialect dialect,
            string logicalType,
            bool sqlServerUnicode = false)
        {
            if (dialect == SchemaDialect.PostgreSql)
            {
                if (logicalType == "mediumtext") return "text";
                if (logicalType == "datetime") return "timestamp without time zone";
                return logicalType;
            }
            if (dialect != SchemaDialect.Oracle)
            {
                if (dialect == SchemaDialect.SqlServer && logicalType == "mediumtext") return "nvarchar(max)";
                if (dialect == SchemaDialect.SqlServer && logicalType == "datetime") return "datetime2";
                if (dialect == SchemaDialect.SqlServer
                    && sqlServerUnicode
                    && logicalType.StartsWith("varchar(", StringComparison.OrdinalIgnoreCase))
                {
                    return "n" + logicalType.ToLowerInvariant();
                }
                return logicalType;
            }

            if (logicalType == "int") return "NUMBER(10)";
            if (logicalType == "bigint") return "NUMBER(19)";
            if (logicalType == "mediumtext") return "CLOB";
            if (logicalType == "datetime") return "TIMESTAMP";
            if (logicalType.StartsWith("varchar(", StringComparison.OrdinalIgnoreCase))
            {
                var length = logicalType.Substring("varchar(".Length).TrimEnd(')');
                return $"VARCHAR2({length} CHAR)";
            }
            return logicalType.ToUpperInvariant();
        }

        public static string BuildSqlServerUnicodeAlterSql(SchemaField field)
        {
            if (field == null) throw new ArgumentNullException(nameof(field));
            if (!field.SqlServerUnicode)
                throw new ArgumentException("字段未声明 SQL Server Unicode 物理契约。", nameof(field));
            var type = PhysicalType(SchemaDialect.SqlServer, field.LogicalType, true);
            return $"ALTER TABLE [{field.TableName}] ALTER COLUMN [{field.Name}] {type} NULL";
        }

        private static string Quote(SchemaDialect dialect, string identifier)
        {
            return dialect switch
            {
                SchemaDialect.MySql => $"`{identifier}`",
                SchemaDialect.SqlServer => $"[{identifier}]",
                SchemaDialect.Oracle => identifier,
                SchemaDialect.PostgreSql => $"\"{identifier}\"",
                _ => identifier
            };
        }

        private static string SqlLiteral(string value)
        {
            return long.TryParse(value, out _) ? value : "'" + (value ?? string.Empty).Replace("'", "''") + "'";
        }

        private static DateTime DatabaseDateTime(SchemaDialect dialect, DateTime value)
        {
            return dialect == SchemaDialect.PostgreSql
                ? DateTime.SpecifyKind(value, DateTimeKind.Unspecified)
                : value;
        }

        private static void EnsurePhysicalColumn(OsClientSecret client, SchemaDialect dialect, SchemaField field)
        {
            if (client.Db.ColumnExists(field.TableName, field.Name)) return;
            try
            {
                client.Db.FromSql(BuildAddColumnSql(dialect, field)).ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                // A concurrent upgrading node may have completed the same DDL.
                // The physical readback, rather than exception text, is the
                // authoritative idempotency boundary.
                if (!client.Db.ColumnExists(field.TableName, field.Name))
                    throw new InvalidOperationException(
                        $"新增 {field.TableName}.{field.Name} 失败：{ex.Message}", ex);
            }
            if (!client.Db.ColumnExists(field.TableName, field.Name))
                throw new InvalidOperationException($"新增 {field.TableName}.{field.Name} 后物理回读仍不存在。");
        }

        private static void EnsureGateTransitionAuditTable(
            OsClientSecret client,
            SchemaDialect dialect)
        {
            if (client.Db.TableExists(GateTransitionAuditTable)) return;
            try
            {
                client.Db.FromSql(BuildCreateGateTransitionAuditTableSql(dialect)).ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                // MySQL/Oracle do not share SQL Server's conditional CREATE.
                // Concurrent startup is accepted only after physical readback.
                if (!client.Db.TableExists(GateTransitionAuditTable))
                {
                    throw new InvalidOperationException(
                        $"创建门禁转换审计表 {GateTransitionAuditTable} 失败：{ex.Message}",
                        ex);
                }
            }
            if (!client.Db.TableExists(GateTransitionAuditTable))
                throw new InvalidOperationException($"创建门禁转换审计表 {GateTransitionAuditTable} 后物理回读仍不存在。");
        }

        private static void EnforceGateTransitionAuditColumns(
            OsClientSecret client,
            SchemaDialect dialect)
        {
            foreach (var field in GateTransitionAuditFields.Where(field =>
                         GateTransitionAuditRequiredColumns.Contains(field.Name, StringComparer.OrdinalIgnoreCase)))
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var column = Quote(dialect, field.Name);
                var invalid = client.Db.FromSql(
                        $"SELECT COUNT(*) FROM {Quote(dialect, GateTransitionAuditTable)} WHERE {column} IS NULL")
                    .ToScalar<long>();
                if (invalid > 0)
                    throw new InvalidOperationException(
                        $"门禁转换审计列 {field.Name} 有 {invalid} 条 NULL，拒绝静默修复安全审计记录。");
                var required = string.Equals(field.Name, "Id", StringComparison.OrdinalIgnoreCase);
                if (IsColumnNotNull(client, dialect, field.TableName, field.Name) != required)
                    client.Db.FromSql(BuildGateTransitionAuditNotNullSql(dialect, field)).ExecuteNonQuery();
            }
        }

        private static void EnsureSqlServerUnicodeColumns(OsClientSecret client)
        {
            foreach (var field in SqlServerUnicodeColumns)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                if (!client.Db.ColumnExists(field.TableName, field.Name))
                    throw new InvalidOperationException(
                        $"缺少 SQL Server Unicode 路径列 {field.TableName}.{field.Name}。");
                if (IsSqlServerUnicodeColumnCompatible(client, field)) continue;

                try
                {
                    client.Db.FromSql(BuildSqlServerUnicodeAlterSql(field)).ExecuteNonQuery();
                }
                catch (Exception ex)
                {
                    // Concurrent nodes may finish the same ALTER first. Only the
                    // physical readback can turn that race into an idempotent pass.
                    if (!IsSqlServerUnicodeColumnCompatible(client, field))
                    {
                        throw new InvalidOperationException(
                            $"迁移 {field.TableName}.{field.Name} 为 SQL Server Unicode 列失败：{ex.Message}",
                            ex);
                    }
                }

                if (!IsSqlServerUnicodeColumnCompatible(client, field))
                    throw new InvalidOperationException(
                        $"{field.TableName}.{field.Name} SQL Server Unicode ALTER 后物理回读不一致。");
            }
        }

        private static bool IsSqlServerUnicodeColumnCompatible(
            OsClientSecret client,
            SchemaField field)
        {
            var raw = client.Db.FromSql(@"SELECT TYPE_NAME(c.user_type_id) AS DataType,
CASE WHEN c.max_length=-1 THEN -1
     WHEN TYPE_NAME(c.user_type_id) IN ('nvarchar','nchar') THEN c.max_length/2
     ELSE c.max_length END AS CharacterMaximumLength,
c.is_nullable AS IsNullable
FROM sys.columns c
WHERE c.object_id=OBJECT_ID(@p0) AND c.name=@p1")
                .AddInParameter("p0", field.TableName)
                .AddInParameter("p1", field.Name)
                .First<dynamic>();
            if (raw == null) return false;
            object rowObject = raw;
            var row = rowObject as JObject ?? JObject.FromObject(rowObject);
            var dataType = row.GetValue("DataType", StringComparison.OrdinalIgnoreCase)?.ToString();
            var lengthText = row.GetValue("CharacterMaximumLength", StringComparison.OrdinalIgnoreCase)?.ToString();
            var nullableToken = row.GetValue("IsNullable", StringComparison.OrdinalIgnoreCase);
            var isNullable = nullableToken?.Type == Newtonsoft.Json.Linq.JTokenType.Boolean
                ? nullableToken.Val<bool>()
                : nullableToken != null && nullableToken.Val<int>() == 1;
            return string.Equals(dataType, "nvarchar", StringComparison.OrdinalIgnoreCase)
                   && int.TryParse(lengthText, out var actualLength)
                   && actualLength == DeclaredCharacterLength(field.LogicalType)
                   && isNullable;
        }

        private static int DeclaredCharacterLength(string logicalType)
        {
            var start = logicalType?.IndexOf('(') ?? -1;
            var end = logicalType?.LastIndexOf(')') ?? -1;
            if (start < 0 || end <= start + 1
                || !int.TryParse(logicalType.Substring(start + 1, end - start - 1), out var length)
                || length <= 0)
            {
                throw new InvalidOperationException($"无法解析字符列长度：{logicalType ?? "<null>"}。");
            }
            return length;
        }

        private static void BackfillLegacyControlValues(
            OsClientSecret client,
            SchemaDialect dialect,
            IEnumerable<SchemaField> fields = null)
        {
            foreach (var field in (fields ?? Fields).Where(item => item.Control))
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var table = Quote(dialect, field.TableName);
                var column = Quote(dialect, field.Name);
                var blank = field.LogicalType.StartsWith("varchar", StringComparison.OrdinalIgnoreCase)
                    ? $" OR {BlankStringPredicate(dialect, column)}"
                    : string.Empty;
                var sql = $"UPDATE {table} SET {column}={SqlLiteral(field.DefaultValue)} "
                          + $"WHERE {column} IS NULL{blank}";
                client.Db.FromSql(sql).ExecuteNonQuery();
            }
        }

        private static string TrimExpression(SchemaDialect dialect, string column)
        {
            return dialect == SchemaDialect.SqlServer
                ? $"LTRIM(RTRIM({column}))"
                : $"TRIM({column})";
        }

        private static string BlankStringPredicate(SchemaDialect dialect, string column)
        {
            return dialect == SchemaDialect.Oracle
                ? $"TRIM({column}) IS NULL"
                : $"{TrimExpression(dialect, column)}=''";
        }

        private static void EnforceControlColumn(OsClientSecret client, SchemaDialect dialect, SchemaField field)
        {
            var nullCount = client.Db.FromSql(
                    $"SELECT COUNT(*) FROM {Quote(dialect, field.TableName)} WHERE {Quote(dialect, field.Name)} IS NULL")
                .ToScalar<long>();
            if (nullCount != 0)
                throw new InvalidOperationException($"{field.TableName}.{field.Name} 仍有 {nullCount} 条未初始化的协议控制值。");

            var existingDefault = NormalizeDefaultExpression(
                GetColumnDefault(client, dialect, field.TableName, field.Name));
            if (!IsColumnNotNull(client, dialect, field.TableName, field.Name)
                && string.Equals(existingDefault, field.DefaultValue, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var alterSql = dialect == SchemaDialect.SqlServer
                ? BuildSqlServerPreservingControlAlterSql(
                    field,
                    GetSqlServerPhysicalColumnType(client, field.TableName, field.Name))
                : BuildControlAlterSql(dialect, field);
            client.Db.FromSql(alterSql).ExecuteNonQuery();
            if (dialect == SchemaDialect.SqlServer) EnsureSqlServerDefault(client, field);

            if (IsColumnNotNull(client, dialect, field.TableName, field.Name))
                throw new InvalidOperationException($"{field.TableName}.{field.Name} 未能回读确认允许 NULL。");
            var actualDefault = NormalizeDefaultExpression(GetColumnDefault(client, dialect, field.TableName, field.Name));
            if (!string.Equals(actualDefault, field.DefaultValue, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"{field.TableName}.{field.Name} 默认值回读为[{actualDefault ?? "<null>"}]，预期[{field.DefaultValue}]。");
            }
        }

        private static string GetSqlServerPhysicalColumnType(
            OsClientSecret client,
            string tableName,
            string columnName)
        {
            var dbInfo = DiyCommon.GetDbInfo("SqlServer");
            var result = MicroiEngine.ORM(dbInfo.DbType).GetColumns(new DbServiceParam
            {
                OsClient = client.OsClient,
                TableName = tableName,
                DbSession = client.Db,
                DbInfo = dbInfo
            });
            if (result.Code != 1 || result.Data == null)
                throw new InvalidOperationException(
                    $"读取 {tableName}.{columnName} SQL Server 物理类型失败：{result.Msg}");

            var column = result.Data.FirstOrDefault(item => string.Equals(
                item.column_name,
                columnName,
                StringComparison.OrdinalIgnoreCase));
            if (column?.column_type.DosIsNullOrWhiteSpace() != false)
                throw new InvalidOperationException(
                    $"未找到 {tableName}.{columnName} 的 SQL Server 物理类型。");
            return column.column_type;
        }

        private static void EnsureSqlServerDefault(OsClientSecret client, SchemaField field)
        {
            var current = NormalizeDefaultExpression(GetColumnDefault(
                client, SchemaDialect.SqlServer, field.TableName, field.Name));
            if (current != null)
            {
                if (!string.Equals(current, field.DefaultValue, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException(
                        $"{field.TableName}.{field.Name} 已存在不兼容默认值[{current}]，拒绝自动删除约束。");
                return;
            }

            var sql = $"ALTER TABLE [{field.TableName}] ADD CONSTRAINT [{field.SqlServerDefaultConstraint}] "
                      + $"DEFAULT {SqlLiteral(field.DefaultValue)} FOR [{field.Name}]";
            try
            {
                client.Db.FromSql(sql).ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                var after = NormalizeDefaultExpression(GetColumnDefault(
                    client, SchemaDialect.SqlServer, field.TableName, field.Name));
                if (!string.Equals(after, field.DefaultValue, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException(
                        $"创建 {field.TableName}.{field.Name} 默认约束失败：{ex.Message}", ex);
            }
        }

        public static string NormalizeDefaultExpression(string expression)
        {
            if (string.IsNullOrWhiteSpace(expression)) return null;
            var value = expression.Trim();
            while (value.Length >= 2 && value[0] == '(' && value[value.Length - 1] == ')')
                value = value.Substring(1, value.Length - 2).Trim();
            var postgresCast = value.IndexOf("::", StringComparison.Ordinal);
            if (postgresCast > 0) value = value.Substring(0, postgresCast).Trim();
            while (value.Length >= 2 && value[0] == '(' && value[value.Length - 1] == ')')
                value = value.Substring(1, value.Length - 2).Trim();
            if (value.StartsWith("N'", StringComparison.OrdinalIgnoreCase)) value = value.Substring(1);
            if (value.Length >= 2 && value[0] == '\'' && value[value.Length - 1] == '\'')
                value = value.Substring(1, value.Length - 2).Replace("''", "'");
            return value.Trim();
        }

        private static string GetColumnDefault(
            OsClientSecret client,
            SchemaDialect dialect,
            string tableName,
            string columnName)
        {
            string sql;
            if (dialect == SchemaDialect.MySql)
            {
                sql = @"SELECT COLUMN_DEFAULT FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@p0 AND COLUMN_NAME=@p1";
            }
            else if (dialect == SchemaDialect.SqlServer)
            {
                sql = @"SELECT dc.definition FROM sys.columns c
LEFT JOIN sys.default_constraints dc
  ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id
WHERE c.object_id=OBJECT_ID(@p0) AND c.name=@p1";
            }
            else if (dialect == SchemaDialect.PostgreSql)
            {
                sql = @"SELECT column_default FROM information_schema.columns
WHERE table_schema=current_schema() AND lower(table_name)=lower(@p0) AND lower(column_name)=lower(@p1)";
            }
            else
            {
                sql = @"SELECT DATA_DEFAULT FROM USER_TAB_COLUMNS
WHERE TABLE_NAME=UPPER(@p0) AND COLUMN_NAME=UPPER(@p1)";
            }
            return client.Db.FromSql(sql)
                .AddInParameter("p0", tableName)
                .AddInParameter("p1", columnName)
                .ToScalar()?.ToString();
        }

        private static bool IsColumnNotNull(
            OsClientSecret client,
            SchemaDialect dialect,
            string tableName,
            string columnName)
        {
            string sql;
            if (dialect == SchemaDialect.MySql)
            {
                sql = @"SELECT COUNT(*) FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@p0 AND COLUMN_NAME=@p1 AND IS_NULLABLE='NO'";
            }
            else if (dialect == SchemaDialect.SqlServer)
            {
                sql = @"SELECT COUNT(*) FROM sys.columns
WHERE object_id=OBJECT_ID(@p0) AND name=@p1 AND is_nullable=0";
            }
            else if (dialect == SchemaDialect.PostgreSql)
            {
                sql = @"SELECT COUNT(*) FROM information_schema.columns
WHERE table_schema=current_schema() AND lower(table_name)=lower(@p0) AND lower(column_name)=lower(@p1) AND is_nullable='NO'";
            }
            else
            {
                sql = @"SELECT COUNT(*) FROM USER_TAB_COLUMNS
WHERE TABLE_NAME=UPPER(@p0) AND COLUMN_NAME=UPPER(@p1) AND NULLABLE='N'";
            }
            return client.Db.FromSql(sql)
                       .AddInParameter("p0", tableName)
                       .AddInParameter("p1", columnName)
                       .ToScalar<long>() == 1;
        }

        private static void ValidateCanonicalStates(OsClientSecret client, SchemaDialect dialect, string tableName)
        {
            var literals = string.Join(",", CanonicalPublishStates.Select(SqlLiteral));
            var sql = $"SELECT COUNT(*) FROM {Quote(dialect, tableName)} "
                      + $"WHERE {Quote(dialect, "PublishState")} NOT IN ({literals})";
            var invalid = client.Db.FromSql(sql).ToScalar<long>();
            if (invalid > 0)
                throw new InvalidOperationException(
                    $"{tableName}.PublishState 存在 {invalid} 条非 canonical 状态，拒绝继续。允许值："
                    + string.Join(",", CanonicalPublishStates));
        }

        public static string ComputeLegacyUnversionedVersionId(string osClient, string appId)
        {
            return ComputeLegacyUnversionedVersionId(osClient, appId, 0);
        }

        public static string ComputeLegacyUnversionedVersionId(string osClient, string appId, int lane)
        {
            return V8McpLogic.BuildApplicationStreamRecordId(
                "version",
                osClient,
                appId,
                ComputeLegacyUnversionedVersionNo(lane));
        }

        public static string ComputeLegacyUnversionedVersionNo(int lane)
        {
            if (lane < 0) throw new ArgumentOutOfRangeException(nameof(lane));
            return lane == 0
                ? LegacyUnversionedVersionNo
                : $"{LegacyUnversionedVersionNo}-part-{lane + 1:0000}";
        }

        public static bool TryParseLegacyUnversionedLane(string versionNo, out int lane)
        {
            lane = -1;
            var normalized = versionNo?.Trim() ?? string.Empty;
            if (string.Equals(normalized, LegacyUnversionedVersionNo, StringComparison.Ordinal))
            {
                lane = 0;
                return true;
            }

            var prefix = LegacyUnversionedVersionNo + "-part-";
            if (!normalized.StartsWith(prefix, StringComparison.Ordinal)
                || !int.TryParse(normalized.Substring(prefix.Length), out var part)
                || part < 2)
            {
                return false;
            }
            lane = part - 1;
            return true;
        }

        /// <summary>
        /// Preserves every already valid archive lane and only moves colliding or
        /// previously unversioned rows to the lowest free lane for the same path.
        /// This makes a partially completed migration replay-safe even when the
        /// unique VersionId+FilePathHash index already exists.
        /// </summary>
        public static IReadOnlyList<LegacyFileArchiveAssignment> PlanLegacyFileArchiveAssignments(
            string osClient,
            string appId,
            IEnumerable<LegacyFileArchiveCandidate> candidates)
        {
            if (string.IsNullOrWhiteSpace(osClient))
                throw new ArgumentException("OsClient不能为空。", nameof(osClient));
            if (string.IsNullOrWhiteSpace(appId))
                throw new ArgumentException("AppId不能为空。", nameof(appId));
            if (candidates == null) throw new ArgumentNullException(nameof(candidates));

            var source = candidates.Select(item =>
            {
                if (item == null)
                    throw new ArgumentException("历史文件候选项不能为空。", nameof(candidates));
                return new LegacyFileArchivePlanningRow
                {
                    Candidate = item,
                    Id = item.Id?.Trim(),
                    Hash = ComputeFilePathHash(item.FilePath)
                };
            }).ToArray();
            if (source.Any(item => string.IsNullOrWhiteSpace(item.Id)))
                throw new ArgumentException("历史文件候选项必须具有稳定Id。", nameof(candidates));
            if (source.Select(item => item.Id).Distinct(StringComparer.Ordinal).Count() != source.Length)
                throw new ArgumentException("历史文件候选项Id重复。", nameof(candidates));
            if (source.Any(item => item.Candidate.CurrentLane < 0))
                throw new ArgumentException("历史文件候选项的当前归档分片无效。", nameof(candidates));

            var assignedLanes = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var pathGroup in source.GroupBy(item => item.Hash, StringComparer.Ordinal))
            {
                var occupied = new HashSet<int>();
                var remaining = new List<LegacyFileArchivePlanningRow>();
                foreach (var laneGroup in pathGroup
                             .Where(item => item.Candidate.CurrentLane.HasValue)
                             .GroupBy(item => item.Candidate.CurrentLane.Value)
                             .OrderBy(item => item.Key))
                {
                    var ordered = laneGroup.OrderBy(item => item.Id, StringComparer.Ordinal).ToArray();
                    assignedLanes[ordered[0].Id] = laneGroup.Key;
                    occupied.Add(laneGroup.Key);
                    remaining.AddRange(ordered.Skip(1));
                }
                remaining.AddRange(pathGroup
                    .Where(item => !item.Candidate.CurrentLane.HasValue));

                foreach (var item in remaining.OrderBy(value => value.Id, StringComparer.Ordinal))
                {
                    var lane = 0;
                    while (occupied.Contains(lane)) lane++;
                    assignedLanes[item.Id] = lane;
                    occupied.Add(lane);
                }
            }

            return source
                .OrderBy(item => item.Id, StringComparer.Ordinal)
                .Select(item =>
                {
                    var lane = assignedLanes[item.Id];
                    return new LegacyFileArchiveAssignment
                    {
                        Id = item.Id,
                        FilePathHash = item.Hash,
                        Size = item.Candidate.Size,
                        Lane = lane,
                        VersionNo = ComputeLegacyUnversionedVersionNo(lane),
                        VersionId = ComputeLegacyUnversionedVersionId(osClient, appId, lane)
                    };
                })
                .ToArray();
        }

        public static string BuildLegacyFileVersionGroupSql(SchemaDialect dialect)
        {
            var table = Quote(dialect, FileTable);
            var versionId = Quote(dialect, "VersionId");
            var appId = Quote(dialect, "AppId");
            var appName = Quote(dialect, "AppName");
            var size = Quote(dialect, "Size");
            var missingVersion = $"({versionId} IS NULL OR {BlankStringPredicate(dialect, versionId)})";
            var validApp = $"({appId} IS NOT NULL AND NOT ({BlankStringPredicate(dialect, appId)}))";
            return $"SELECT {appId} AS AppId,MAX({appName}) AS AppName,COUNT(*) AS FileCount,"
                   + $"COALESCE(SUM({size}),0) AS TotalSize FROM {table} "
                   + $"WHERE {missingVersion} AND {validApp} GROUP BY {appId} ORDER BY {appId}";
        }

        public static string BuildLegacyFileVersionUpdateSql(SchemaDialect dialect)
        {
            var table = Quote(dialect, FileTable);
            var versionId = Quote(dialect, "VersionId");
            var appId = Quote(dialect, "AppId");
            return $"UPDATE {table} SET {versionId}=@p0 WHERE "
                   + $"({versionId} IS NULL OR {BlankStringPredicate(dialect, versionId)}) AND {appId}=@p1";
        }

        public static string BuildLegacyArchiveVersionRowsSql(SchemaDialect dialect)
        {
            var table = Quote(dialect, VersionTable);
            var versionNo = Quote(dialect, "VersionNo");
            return $"SELECT {Quote(dialect, "Id")},{Quote(dialect, "AppId")},{Quote(dialect, "AppName")},{versionNo} "
                   + $"FROM {table} WHERE {versionNo}=@p0 OR {versionNo} LIKE @p1";
        }

        public static string BuildLegacyArchiveFileRowsSql(SchemaDialect dialect)
        {
            var file = Quote(dialect, FileTable);
            var version = Quote(dialect, VersionTable);
            var fileVersionId = $"f.{Quote(dialect, "VersionId")}";
            var fileAppId = $"f.{Quote(dialect, "AppId")}";
            var versionNo = $"v.{Quote(dialect, "VersionNo")}";
            return $"SELECT f.{Quote(dialect, "Id")},f.{Quote(dialect, "AppId")},f.{Quote(dialect, "AppName")},"
                   + $"f.{Quote(dialect, "VersionId")},f.{Quote(dialect, "FilePath")},"
                   + $"f.{Quote(dialect, "FilePathHash")},f.{Quote(dialect, "Size")} FROM {file} f "
                   + $"WHERE {fileAppId}=@p0 AND (({fileVersionId} IS NULL OR {BlankStringPredicate(dialect, fileVersionId)}) "
                   + $"OR {fileVersionId} IN (SELECT v.{Quote(dialect, "Id")} FROM {version} v "
                   + $"WHERE v.{Quote(dialect, "AppId")}=@p0 AND ({versionNo}=@p1 OR {versionNo} LIKE @p2))) "
                   + $"ORDER BY f.{Quote(dialect, "Id")}";
        }

        public static string BuildLegacyFileMissingAppSampleSql(SchemaDialect dialect, int take = 5)
        {
            if (take <= 0) throw new ArgumentOutOfRangeException(nameof(take));
            var table = Quote(dialect, FileTable);
            var id = Quote(dialect, "Id");
            var versionId = Quote(dialect, "VersionId");
            var appId = Quote(dialect, "AppId");
            var where = $"({versionId} IS NULL OR {BlankStringPredicate(dialect, versionId)}) AND "
                        + $"({appId} IS NULL OR {BlankStringPredicate(dialect, appId)})";
            if (dialect == SchemaDialect.MySql || dialect == SchemaDialect.PostgreSql)
                return $"SELECT {id} FROM {table} WHERE {where} ORDER BY {id} LIMIT {take}";
            if (dialect == SchemaDialect.SqlServer)
                return $"SELECT TOP ({take}) {id} FROM {table} WHERE {where} ORDER BY {id}";
            return $"SELECT {id} FROM (SELECT {id} FROM {table} WHERE {where} ORDER BY {id}) WHERE ROWNUM<={take}";
        }

        private static LegacyFileVersionBackfillSummary BackfillLegacyFileVersionIds(
            string osClient,
            OsClientSecret client,
            SchemaDialect dialect)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            var summary = new LegacyFileVersionBackfillSummary();
            var fileTable = Quote(dialect, FileTable);
            var versionTable = Quote(dialect, VersionTable);
            var versionIdColumn = Quote(dialect, "VersionId");
            var appIdColumn = Quote(dialect, "AppId");
            var missingVersion = $"({versionIdColumn} IS NULL OR {BlankStringPredicate(dialect, versionIdColumn)})";
            var missingApp = $"({appIdColumn} IS NULL OR {BlankStringPredicate(dialect, appIdColumn)})";
            var missingAppCount = client.Db.FromSql(
                    $"SELECT COUNT(*) FROM {fileTable} WHERE {missingVersion} AND {missingApp}")
                .ToScalar<long>();
            if (missingAppCount > 0)
            {
                var samples = client.Db.FromSql(BuildLegacyFileMissingAppSampleSql(dialect))
                                  .ToArray()
                                  ?.Select(raw =>
                                  {
                                      object rowObject = raw;
                                      var row = rowObject as JObject ?? JObject.FromObject(rowObject);
                                      return row.GetValue("Id", StringComparison.OrdinalIgnoreCase)?.ToString();
                                  })
                                  .Where(id => !string.IsNullOrWhiteSpace(id))
                                  .ToArray()
                              ?? Array.Empty<string>();
                throw new InvalidOperationException(
                    $"mci_ai_app_file 有 {missingAppCount} 条历史文件同时缺少 VersionId 与 AppId，"
                    + "无法证明归属，拒绝猜测回填。样本Id："
                    + (samples.Length == 0 ? "无" : string.Join(",", samples)));
            }

            var applicationNames = new SortedDictionary<string, string>(StringComparer.Ordinal);
            foreach (var raw in client.Db.FromSql(BuildLegacyFileVersionGroupSql(dialect)).ToArray()
                                ?? Array.Empty<dynamic>())
            {
                object rowObject = raw;
                var group = rowObject as JObject ?? JObject.FromObject(rowObject);
                var appId = group.GetValue("AppId", StringComparison.OrdinalIgnoreCase)?.ToString()?.Trim();
                if (string.IsNullOrWhiteSpace(appId))
                    throw new InvalidOperationException("历史应用文件版本回填分组缺少有效 AppId。");
                applicationNames[appId] = group.GetValue("AppName", StringComparison.OrdinalIgnoreCase)?.ToString();
            }

            var archiveVersionsByApp = new Dictionary<string, List<JObject>>(StringComparer.Ordinal);
            var archiveVersionRows = client.Db.FromSql(BuildLegacyArchiveVersionRowsSql(dialect))
                .AddInParameter("p0", LegacyUnversionedVersionNo)
                .AddInParameter("p1", LegacyUnversionedVersionNo + "-part-%")
                .ToArray() ?? Array.Empty<dynamic>();
            foreach (var raw in archiveVersionRows)
            {
                object rowObject = raw;
                var version = rowObject as JObject ?? JObject.FromObject(rowObject);
                var appId = version.GetValue("AppId", StringComparison.OrdinalIgnoreCase)?.ToString()?.Trim();
                var versionNo = version.GetValue("VersionNo", StringComparison.OrdinalIgnoreCase)?.ToString();
                if (string.IsNullOrWhiteSpace(appId)
                    || !TryParseLegacyUnversionedLane(versionNo, out _))
                {
                    throw new InvalidOperationException(
                        "mci_ai_app_version 中迁移专用历史归档版本缺少有效 AppId 或 VersionNo。");
                }
                if (!archiveVersionsByApp.TryGetValue(appId, out var versions))
                {
                    versions = new List<JObject>();
                    archiveVersionsByApp[appId] = versions;
                }
                versions.Add(version);
                if (!applicationNames.ContainsKey(appId))
                    applicationNames[appId] = version.GetValue("AppName", StringComparison.OrdinalIgnoreCase)?.ToString();
            }

            foreach (var application in applicationNames)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var appId = application.Key;
                var appName = application.Value;
                var versions = archiveVersionsByApp.TryGetValue(appId, out var existingVersions)
                    ? existingVersions
                    : new List<JObject>();
                var versionByLane = new Dictionary<int, JObject>();
                var laneByVersionId = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                foreach (var version in versions)
                {
                    var versionNo = version.GetValue("VersionNo", StringComparison.OrdinalIgnoreCase)?.ToString();
                    if (!TryParseLegacyUnversionedLane(versionNo, out var lane))
                        throw new InvalidOperationException($"AppId[{appId}]历史归档版本号[{versionNo}]不合法。");
                    if (versionByLane.ContainsKey(lane))
                        throw new InvalidOperationException($"AppId[{appId}]历史归档分片[{lane}]存在多条版本记录。");
                    var versionId = version.GetValue("Id", StringComparison.OrdinalIgnoreCase)?.ToString();
                    var expectedId = ComputeLegacyUnversionedVersionId(osClient, appId, lane);
                    if (!string.Equals(versionId, expectedId, StringComparison.Ordinal))
                    {
                        throw new InvalidOperationException(
                            $"AppId[{appId}]历史归档版本[{versionNo}]的Id不是确定性迁移Id，拒绝复用可能由用户创建的版本。");
                    }
                    versionByLane[lane] = version;
                    laneByVersionId[versionId] = lane;
                }

                var fileRows = client.Db.FromSql(BuildLegacyArchiveFileRowsSql(dialect))
                    .AddInParameter("p0", appId)
                    .AddInParameter("p1", LegacyUnversionedVersionNo)
                    .AddInParameter("p2", LegacyUnversionedVersionNo + "-part-%")
                    .ToArray() ?? Array.Empty<dynamic>();
                if (fileRows.Length == 0) continue;

                var filesById = new Dictionary<string, JObject>(StringComparer.Ordinal);
                var candidates = new List<LegacyFileArchiveCandidate>();
                foreach (var raw in fileRows)
                {
                    object rowObject = raw;
                    var file = rowObject as JObject ?? JObject.FromObject(rowObject);
                    var id = file.GetValue("Id", StringComparison.OrdinalIgnoreCase)?.ToString()?.Trim();
                    var filePath = file.GetValue("FilePath", StringComparison.OrdinalIgnoreCase)?.ToString();
                    var currentVersionId = file.GetValue("VersionId", StringComparison.OrdinalIgnoreCase)?.ToString()?.Trim();
                    if (string.IsNullOrWhiteSpace(id))
                        throw new InvalidOperationException($"AppId[{appId}]历史文件缺少稳定Id。");
                    int? currentLane = null;
                    if (!string.IsNullOrWhiteSpace(currentVersionId))
                    {
                        if (!laneByVersionId.TryGetValue(currentVersionId, out var lane))
                            throw new InvalidOperationException($"历史文件[{id}]引用了无法识别的迁移归档版本[{currentVersionId}]。");
                        currentLane = lane;
                    }
                    filesById[id] = file;
                    candidates.Add(new LegacyFileArchiveCandidate
                    {
                        Id = id,
                        FilePath = filePath,
                        Size = file.GetValue("Size", StringComparison.OrdinalIgnoreCase)?.Val<long>() ?? 0,
                        CurrentLane = currentLane
                    });
                    if (string.IsNullOrWhiteSpace(appName))
                        appName = file.GetValue("AppName", StringComparison.OrdinalIgnoreCase)?.ToString();
                }

                var assignments = PlanLegacyFileArchiveAssignments(osClient, appId, candidates);
                var assignmentsByLane = assignments.GroupBy(item => item.Lane).OrderBy(item => item.Key).ToArray();
                foreach (var laneGroup in assignmentsByLane)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var lane = laneGroup.Key;
                    var versionNo = ComputeLegacyUnversionedVersionNo(lane);
                    var deterministicVersionId = ComputeLegacyUnversionedVersionId(osClient, appId, lane);
                    var fileCount = laneGroup.LongCount();
                    var totalSize = laneGroup.Sum(item => item.Size);
                    if (versionByLane.ContainsKey(lane))
                    {
                        summary.ReusedVersionCount++;
                    }
                    else
                    {
                        var idCollisionRaw = client.Db.FromSql(
                                $"SELECT {Quote(dialect, "Id")},{Quote(dialect, "AppId")},{Quote(dialect, "VersionNo")} FROM {versionTable} WHERE {Quote(dialect, "Id")}=@p0")
                            .AddInParameter("p0", deterministicVersionId)
                            .First<dynamic>();
                        if (idCollisionRaw != null)
                        {
                            var collision = JObject.FromObject((object)idCollisionRaw);
                            throw new InvalidOperationException(
                                $"历史应用文件确定性版本 Id[{deterministicVersionId}] 已被 AppId["
                                + (collision.GetValue("AppId", StringComparison.OrdinalIgnoreCase)?.ToString() ?? "<null>")
                                + "]占用，拒绝覆盖。");
                        }

                        var now = DatabaseDateTime(dialect, DateTime.Now);
                        var insertSql = $"INSERT INTO {versionTable} ("
                                        + string.Join(",", new[]
                                        {
                                            "Id", "AppId", "AppName", "VersionNo", "VersionName", "Status",
                                            "PublishProtocolVersion", "PublishState", "FencingToken", "RowVersion",
                                            "RecoveryEpoch", "FileCount", "TotalSize", "ChangeSummary", "IsDeleted",
                                            "CreateTime", "UpdateTime"
                                        }.Select(column => Quote(dialect, column)))
                                        + ") VALUES (@p0,@p1,@p2,@p3,@p4,@p5,@p6,@p7,@p8,@p9,@p10,@p11,@p12,@p13,@p14,@p15,@p16)";
                        var inserted = client.Db.FromSql(insertSql)
                            .AddInParameter("p0", deterministicVersionId)
                            .AddInParameter("p1", appId)
                            .AddInParameter("p2", appName)
                            .AddInParameter("p3", versionNo)
                            .AddInParameter("p4", lane == 0 ? "历史未分版文件" : $"历史未分版文件（归档分片{lane + 1}）")
                            .AddInParameter("p5", LegacyUnversionedStatus)
                            .AddInParameter("p6", LegacyPublishProtocolVersion)
                            .AddInParameter("p7", LegacyPublishState)
                            .AddInParameter("p8", 0L)
                            .AddInParameter("p9", 0L)
                            .AddInParameter("p10", 0)
                            .AddInParameter("p11", checked((int)fileCount))
                            .AddInParameter("p12", totalSize)
                            .AddInParameter("p13", "Upgrade25 将升级前未绑定版本或发生路径重复的文件无损分配到独立历史归档分片；不合并、不删除原文件。")
                            .AddInParameter("p14", 0)
                            .AddInParameter("p15", DbType.DateTime, now)
                            .AddInParameter("p16", DbType.DateTime, now)
                            .ExecuteNonQuery();
                        if (inserted != 1)
                            throw new InvalidOperationException($"为 AppId[{appId}]创建历史归档版本[{versionNo}]失败，影响行数={inserted}。");
                        versionByLane[lane] = new JObject
                        {
                            ["Id"] = deterministicVersionId,
                            ["VersionNo"] = versionNo
                        };
                        laneByVersionId[deterministicVersionId] = lane;
                        summary.CreatedVersionCount++;
                    }

                    client.Db.FromSql(
                            $"UPDATE {versionTable} SET {Quote(dialect, "FileCount")}=@p0,"
                            + $"{Quote(dialect, "TotalSize")}=@p1,{Quote(dialect, "UpdateTime")}=@p2 "
                            + $"WHERE {Quote(dialect, "Id")}=@p3 AND {appIdColumn}=@p4")
                        .AddInParameter("p0", checked((int)fileCount))
                        .AddInParameter("p1", totalSize)
                        .AddInParameter("p2", DbType.DateTime, DatabaseDateTime(dialect, DateTime.Now))
                        .AddInParameter("p3", deterministicVersionId)
                        .AddInParameter("p4", appId)
                        .ExecuteNonQuery();
                }

                foreach (var assignment in assignments)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var file = filesById[assignment.Id];
                    var currentVersionId = file.GetValue("VersionId", StringComparison.OrdinalIgnoreCase)?.ToString()?.Trim();
                    var currentHash = file.GetValue("FilePathHash", StringComparison.OrdinalIgnoreCase)?.ToString()?.Trim();
                    if (string.Equals(currentVersionId, assignment.VersionId, StringComparison.Ordinal)
                        && string.Equals(currentHash, assignment.FilePathHash, StringComparison.Ordinal))
                    {
                        continue;
                    }
                    var affected = client.Db.FromSql(
                            $"UPDATE {fileTable} SET {versionIdColumn}=@p0,{Quote(dialect, "FilePathHash")}=@p1 "
                            + $"WHERE {Quote(dialect, "Id")}=@p2 AND {appIdColumn}=@p3")
                        .AddInParameter("p0", assignment.VersionId)
                        .AddInParameter("p1", assignment.FilePathHash)
                        .AddInParameter("p2", assignment.Id)
                        .AddInParameter("p3", appId)
                        .ExecuteNonQuery();
                    if (affected != 1)
                        throw new InvalidOperationException($"历史文件[{assignment.Id}]在归档重排期间发生并发变化，请重试升级。");
                    if (!string.Equals(currentVersionId, assignment.VersionId, StringComparison.Ordinal))
                        summary.ReassignedFileCount++;
                }

                var remaining = client.Db.FromSql(
                        $"SELECT COUNT(*) FROM {fileTable} WHERE {missingVersion} AND {appIdColumn}=@p0")
                    .AddInParameter("p0", appId)
                    .ToScalar<long>();
                if (remaining > 0)
                {
                    throw new InvalidOperationException(
                        $"AppId[{appId}]历史文件 VersionId 回填后仍有 {remaining} 条空值，拒绝继续创建唯一索引。");
                }

                summary.ApplicationCount++;
                summary.FileCount += assignments.Count;
            }
            return summary;
        }

        private static void BackfillFilePathHashes(OsClientSecret client, SchemaDialect dialect)
        {
            var lastId = string.Empty;
            while (true)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var pageSql = BuildFileHashPageSql(dialect, !string.IsNullOrEmpty(lastId));
                var query = client.Db.FromSql(pageSql);
                if (!string.IsNullOrEmpty(lastId)) query.AddInParameter("p0", lastId);
                var rows = query.ToArray();
                if (rows == null || rows.Length == 0) break;

                foreach (var raw in rows)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    object rowObject = raw;
                    var row = rowObject as JObject ?? JObject.FromObject(rowObject);
                    var id = row.GetValue("Id", StringComparison.OrdinalIgnoreCase)?.ToString();
                    var versionId = row.GetValue("VersionId", StringComparison.OrdinalIgnoreCase)?.ToString();
                    var filePath = row.GetValue("FilePath", StringComparison.OrdinalIgnoreCase)?.ToString();
                    if (string.IsNullOrWhiteSpace(id))
                        throw new InvalidOperationException("mci_ai_app_file 存在缺少 Id 的记录。");

                    string hash;
                    try
                    {
                        hash = ComputeFilePathHash(filePath);
                    }
                    catch (Exception ex)
                    {
                        MarkVersionManualReview(client, dialect, versionId,
                            $"文件路径[{filePath ?? "<null>"}]无法规范化：{ex.Message}");
                        throw new InvalidOperationException(
                            $"文件记录[{id}]路径无法规范化，关联版本已标记 ManualReview：{ex.Message}", ex);
                    }

                    var oldHash = row.GetValue("FilePathHash", StringComparison.OrdinalIgnoreCase)?.ToString();
                    if (!string.Equals(oldHash, hash, StringComparison.Ordinal))
                    {
                        var updateSql = $"UPDATE {Quote(dialect, FileTable)} SET {Quote(dialect, "FilePathHash")}=@p0 "
                                        + $"WHERE {Quote(dialect, "Id")}=@p1 AND {Quote(dialect, "FilePath")}=@p2";
                        var affected = client.Db.FromSql(updateSql)
                            .AddInParameter("p0", hash)
                            .AddInParameter("p1", id)
                            .AddInParameter("p2", filePath)
                            .ExecuteNonQuery();
                        if (affected != 1)
                            throw new InvalidOperationException($"文件记录[{id}]在路径Hash回填期间发生并发变化，请重试升级。");
                    }
                    lastId = id;
                }
                if (rows.Length < FileHashPageSize) break;
            }
        }

        public static string BuildFileHashPageSql(SchemaDialect dialect, bool hasCursor)
        {
            var where = hasCursor ? $" WHERE {Quote(dialect, "Id")}>@p0" : string.Empty;
            var projection = string.Join(",", new[] { "Id", "VersionId", "FilePath", "FilePathHash" }
                .Select(column => Quote(dialect, column)));
            if (dialect == SchemaDialect.MySql || dialect == SchemaDialect.PostgreSql)
                return $"SELECT {projection} FROM {Quote(dialect, FileTable)}{where} ORDER BY {Quote(dialect, "Id")} LIMIT {FileHashPageSize}";
            if (dialect == SchemaDialect.SqlServer)
                return $"SELECT TOP ({FileHashPageSize}) {projection} FROM {Quote(dialect, FileTable)}{where} ORDER BY {Quote(dialect, "Id")}";
            return $"SELECT {projection} FROM (SELECT {projection} FROM {FileTable}{where} ORDER BY Id) WHERE ROWNUM<={FileHashPageSize}";
        }

        private static void MarkVersionManualReview(
            OsClientSecret client,
            SchemaDialect dialect,
            string versionId,
            string error)
        {
            if (string.IsNullOrWhiteSpace(versionId)) return;
            var sql = $"UPDATE {Quote(dialect, VersionTable)} SET "
                      + $"{Quote(dialect, "PublishState")}='ManualReview',"
                      + $"{Quote(dialect, "LastError")}=@p0,"
                      + $"{Quote(dialect, "RecoveryEpoch")}={Quote(dialect, "RecoveryEpoch")}+1 "
                      + $"WHERE {Quote(dialect, "Id")}=@p1";
            client.Db.FromSql(sql)
                .AddInParameter("p0", error)
                .AddInParameter("p1", versionId)
                .ExecuteNonQuery();
        }

        private static void AuditUniqueIdentity(
            OsClientSecret client,
            SchemaDialect dialect,
            SchemaIndex index)
        {
            foreach (var column in index.RequiredNonBlankColumns)
            {
                var quoted = Quote(dialect, column);
                var invalidSql = $"SELECT COUNT(*) FROM {Quote(dialect, index.TableName)} "
                                 + $"WHERE {quoted} IS NULL OR {BlankStringPredicate(dialect, quoted)}";
                var invalid = client.Db.FromSql(invalidSql).ToScalar<long>();
                if (invalid > 0)
                    throw new InvalidOperationException(
                        $"创建唯一索引 {index.Name} 前审计失败：{index.TableName}.{column} 有 {invalid} 条 NULL/空值。");
            }

            var duplicateGroups = client.Db.FromSql(BuildDuplicateAuditSql(dialect, index)).ToScalar<long>();
            if (duplicateGroups > 0)
                throw new InvalidOperationException(
                    $"创建唯一索引 {index.Name} 前审计失败：{index.TableName} 存在 {duplicateGroups} 组重复业务键。"
                    + "迁移不会静默删除或合并历史记录。");

            if (index.TableName == FileTable)
            {
                var exactDuplicateGroups = client.Db.FromSql(BuildFilePathDuplicateAuditSql(dialect))
                    .ToScalar<long>();
                if (exactDuplicateGroups > 0)
                    throw new InvalidOperationException(
                        $"创建唯一索引 {index.Name} 前审计失败：mci_ai_app_file 存在 {exactDuplicateGroups} 组相同 VersionId+FilePath。"
                        + "迁移不会静默删除或合并历史记录。");

                var version = Quote(dialect, "VersionId");
                var hash = Quote(dialect, "FilePathHash");
                var path = Quote(dialect, "FilePath");
                var alias = dialect == SchemaDialect.Oracle ? " hash_conflicts" : " AS hash_conflicts";
                var collisionSql = $"SELECT COUNT(*) FROM (SELECT {version},{hash} FROM {Quote(dialect, FileTable)} "
                                   + $"GROUP BY {version},{hash} HAVING COUNT(DISTINCT {path})>1){alias}";
                var collisions = client.Db.FromSql(collisionSql).ToScalar<long>();
                if (collisions > 0)
                    throw new InvalidOperationException(
                        $"创建唯一索引 {index.Name} 前发现 {collisions} 组 FilePathHash 碰撞，拒绝合并不同完整路径。");
            }
        }

        private static void EnsureIndex(
            string osClient,
            OsClientSecret client,
            SchemaDialect dialect,
            SchemaIndex definition)
        {
            var before = V8McpLogic.GetTableIndexes(osClient, definition.TableName);
            if (before?.Code != 1)
                throw new InvalidOperationException(before?.Msg ?? $"读取索引 {definition.Name} 失败。");

            var sameName = before.Data?.FirstOrDefault(index =>
                string.Equals(index.Key_name, definition.Name, StringComparison.OrdinalIgnoreCase));
            if (sameName != null && !MatchesIndex(sameName, definition))
                throw new InvalidOperationException($"索引名 {definition.Name} 已存在但字段或唯一性不一致。");
            if (sameName != null && IsAcceptableIndex(client, dialect, sameName, definition)) return;

            var equivalent = before.Data?.FirstOrDefault(index => MatchesIndex(index, definition)
                && IsAcceptableIndex(client, dialect, index, definition));
            if (equivalent != null) return;
            var replaceLegacyCurrentFileIndex = sameName != null
                && dialect == SchemaDialect.SqlServer
                && definition.TableName == FileTable
                && definition.Name == "ux_aaf_version_pathhash"
                && string.IsNullOrWhiteSpace(client.Db.FromSql(
                        "SELECT filter_definition FROM sys.indexes WHERE object_id=OBJECT_ID(@p0) AND name=@p1")
                    .AddInParameter("p0", definition.TableName)
                    .AddInParameter("p1", definition.Name).ToScalar()?.ToString());
            if (sameName != null && !replaceLegacyCurrentFileIndex)
                throw new InvalidOperationException($"SQL Server 索引 {definition.Name} 缺少 {definition.SqlServerFilterColumn} IS NOT NULL 过滤条件。");

            try
            {
                client.Db.FromSql(BuildCreateIndexSql(dialect, definition)
                    + (replaceLegacyCurrentFileIndex ? " WITH (DROP_EXISTING = ON)" : string.Empty)).ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                var concurrent = V8McpLogic.GetTableIndexes(osClient, definition.TableName);
                var recovered = concurrent?.Code == 1 && concurrent.Data?.Any(index =>
                    string.Equals(index.Key_name, definition.Name, StringComparison.OrdinalIgnoreCase)
                    && MatchesIndex(index, definition)
                    && IsAcceptableIndex(client, dialect, index, definition)) == true;
                if (!recovered)
                    throw new InvalidOperationException($"创建索引 {definition.Name} 失败：{ex.Message}", ex);
            }

            var after = V8McpLogic.GetTableIndexes(osClient, definition.TableName);
            var created = after?.Code == 1 && after.Data?.Any(index =>
                string.Equals(index.Key_name, definition.Name, StringComparison.OrdinalIgnoreCase)
                && MatchesIndex(index, definition)
                && IsAcceptableIndex(client, dialect, index, definition)) == true;
            if (!created) throw new InvalidOperationException($"索引 {definition.Name} 创建后未通过物理回读。");
        }

        private static bool MatchesIndex(V8McpLogic.TableIndexInfo actual, SchemaIndex expected)
        {
            return actual != null
                   && actual.IsUnique == expected.Unique
                   && actual.Columns.SequenceEqual(expected.Columns, StringComparer.OrdinalIgnoreCase);
        }

        // Current source rows intentionally have no immutable VersionId. SQL
        // Server's unfiltered UNIQUE index treats NULL as a value and therefore
        // prevents two applications from both owning e.g. package.json. Repair
        // only this known protocol index; custom/mismatched indexes fail closed.
        public static bool CurrentFileIdentityIndexReady(OsClientSecret client)
        {
            if (ResolveDialect(client) != SchemaDialect.SqlServer || !client.Db.TableExists(FileTable)) return true;
            var expected = Indexes.Single(index => index.Name == "ux_aaf_version_pathhash");
            var indexes = V8McpLogic.GetTableIndexes(client.OsClient, FileTable);
            if (indexes?.Code != 1) throw new InvalidOperationException(indexes?.Msg ?? "读取应用文件索引失败。");
            var existing = indexes.Data?.FirstOrDefault(index =>
                string.Equals(index.Key_name, expected.Name, StringComparison.OrdinalIgnoreCase));
            // A missing index belongs to the normal Upgrade25 installation.
            return existing == null || (MatchesIndex(existing, expected)
                && IsAcceptableIndex(client, SchemaDialect.SqlServer, existing, expected));
        }

        public static void EnsureCurrentFileIdentityIndex(OsClientSecret client)
        {
            if (CurrentFileIdentityIndexReady(client)) return;
            UpgradeExecutionLeaseContext.ThrowIfLost();
            EnsureIndex(client.OsClient, client, SchemaDialect.SqlServer,
                Indexes.Single(index => index.Name == "ux_aaf_version_pathhash"));
        }

        private static bool IsAcceptableIndex(
            OsClientSecret client,
            SchemaDialect dialect,
            V8McpLogic.TableIndexInfo actual,
            SchemaIndex expected)
        {
            if (dialect != SchemaDialect.SqlServer || expected.SqlServerFilterColumn == null) return true;
            var filter = client.Db.FromSql(
                    "SELECT filter_definition FROM sys.indexes WHERE object_id=OBJECT_ID(@p0) AND name=@p1")
                .AddInParameter("p0", expected.TableName)
                .AddInParameter("p1", actual.Key_name)
                .ToScalar()?.ToString();
            return IsCompatibleSqlServerNotNullFilter(
                filter,
                expected.SqlServerFilterColumn,
                expected.Columns);
        }

        public static bool IsCompatibleSqlServerNotNullFilter(
            string predicate,
            string requiredColumn,
            IReadOnlyCollection<string> indexColumns)
        {
            var normalized = NormalizeSqlPredicate(predicate);
            var required = (requiredColumn + "ISNOTNULL").ToUpperInvariant();
            if (normalized == required) return true;

            // The seed converter preserves MySQL UNIQUE/NULL semantics by
            // filtering every nullable key column. Upgrade25 historically
            // generated the narrower RequestId-only predicate after it had
            // backfilled AppId. Both are valid; reject any other expression.
            var allColumns = string.Join(
                "AND",
                indexColumns.Select(column =>
                    (column + "ISNOTNULL").ToUpperInvariant()));
            return normalized == allColumns
                   && indexColumns.Contains(requiredColumn, StringComparer.OrdinalIgnoreCase);
        }

        public static string NormalizeSqlPredicate(string predicate)
        {
            if (string.IsNullOrWhiteSpace(predicate)) return string.Empty;
            return new string(predicate
                    .Where(character => !char.IsWhiteSpace(character)
                                        && character != '[' && character != ']'
                                        && character != '(' && character != ')')
                    .ToArray())
                .ToUpperInvariant();
        }

        private static async Task EnsureMetadataAsync(
            string osClient,
            string tableName,
            IReadOnlyCollection<SchemaField> fields)
        {
            var table = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_table", new
            {
                OsClient = osClient,
                _Where = new List<object> { new List<object> { "Name", "=", tableName } },
                _SelectFields = new[] { "Id", "Name" }
            }).ConfigureAwait(false);
            if (table.Code != 1 || table.Data == null)
                throw new InvalidOperationException($"未找到 {tableName} 的 diy_table 元数据。");
            var tableId = Convert.ToString((object)table.Data.Id);

            foreach (var field in fields)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var existing = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_field", new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "TableId", "=", tableId },
                        new List<object> { "Name", "=", field.Name }
                    },
                    _SelectFields = new[] { "Id", "Name", "Visible", "AppVisible", "Readonly" }
                }).ConfigureAwait(false);
                if (existing.Code == 1 && existing.Data != null)
                {
                    if (IsProtectedApplicationStreamMetadata(tableName, field.Name))
                    {
                        await EnsureProtectedApplicationStreamFieldMetadataAsync(
                            osClient,
                            tableName,
                            field.Name,
                            (object)existing.Data).ConfigureAwait(false);
                    }
                    continue;
                }

                var add = await MicroiEngine.FormEngine.AddFieldAsync(new
                {
                    OsClient = osClient,
                    TableId = tableId,
                    TableName = tableName,
                    field.Name,
                    field.Label,
                    Type = field.LogicalType,
                    field.Component,
                    field.Sort,
                    DefaultValue = field.DefaultValue,
                    Visible = field.Visible ? 1 : 0,
                    AppVisible = field.Visible ? 1 : 0,
                    // Publish controls are a distributed fencing surface. They
                    // must never become three independently editable ordinary
                    // form fields; transitions go through a dedicated atomic
                    // operator path that also advances GateEpoch.
                    Readonly = 1,
                    NameConfirm = 1,
                    TableWidth = 140,
                    FormWidth = field.Component == "Textarea" || field.Component == "CodeEditor" ? 24 : (int?)null,
                    Tab = tableName == TenantTable ? "平台运行配置" : null,
                    Unique = 0,
                    _NotAddDbField = true
                }).ConfigureAwait(false);
                if (add.Code != 1)
                {
                    var reread = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_field", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>
                        {
                            new List<object> { "TableId", "=", tableId },
                            new List<object> { "Name", "=", field.Name }
                        },
                        _SelectFields = new[] { "Id", "Visible", "AppVisible", "Readonly" }
                    }).ConfigureAwait(false);
                    if (reread.Code != 1 || reread.Data == null)
                        throw new InvalidOperationException($"新增 {tableName}.{field.Name} 元数据失败：{add.Msg}");
                    if (IsProtectedApplicationStreamMetadata(tableName, field.Name))
                    {
                        // A concurrent upgrading node may have inserted the row.
                        // Re-assert the hidden/read-only control contract instead of
                        // accepting an arbitrary duplicate row as success.
                        await EnsureProtectedApplicationStreamFieldMetadataAsync(
                            osClient,
                            tableName,
                            field.Name,
                            (object)reread.Data).ConfigureAwait(false);
                    }
                }
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            await cache.RemoveAsync($"Microi:{osClient}:FormData:diy_table:{tableId}").ConfigureAwait(false);
            await cache.RemoveAsync($"Microi:{osClient}:FormData:diy_table:{tableName}").ConfigureAwait(false);
            await cache.RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:{tableId}").ConfigureAwait(false);
            await cache.RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:{tableName}").ConfigureAwait(false);
        }

        private static bool IsProtectedApplicationStreamMetadata(string tableName, string fieldName)
        {
            return string.Equals(tableName, TenantTable, StringComparison.OrdinalIgnoreCase)
                   || string.Equals(tableName, VersionTable, StringComparison.OrdinalIgnoreCase)
                   && (string.Equals(fieldName, "RouteSnapshotJson", StringComparison.OrdinalIgnoreCase)
                       || string.Equals(fieldName, "RouteSnapshotHash", StringComparison.OrdinalIgnoreCase));
        }

        private static async Task EnsureProtectedApplicationStreamFieldMetadataAsync(
            string osClient,
            string tableName,
            string fieldName,
            object data)
        {
            if (data == null)
                throw new InvalidOperationException($"{tableName}.{fieldName} 受保护元数据为空。");
            var row = data as JObject ?? JObject.FromObject(data);
            var id = row.GetValue("Id", StringComparison.OrdinalIgnoreCase)?.ToString();
            if (string.IsNullOrWhiteSpace(id))
                throw new InvalidOperationException($"{tableName}.{fieldName} 受保护元数据缺少 Id。");

            var visible = row.GetValue("Visible", StringComparison.OrdinalIgnoreCase).Val<int>();
            var appVisible = row.GetValue("AppVisible", StringComparison.OrdinalIgnoreCase).Val<int>();
            var readOnly = row.GetValue("Readonly", StringComparison.OrdinalIgnoreCase).Val<int>();
            if (visible == 0 && appVisible == 0 && readOnly == 1) return;

            var update = await UpgradeTrustedFormEngine.UpdateAsync("diy_field", osClient, new
            {
                Id = id,
                Visible = 0,
                AppVisible = 0,
                Readonly = 1
            }).ConfigureAwait(false);
            if (update.Code != 1)
                throw new InvalidOperationException(
                    $"锁定 {tableName}.{fieldName} 受保护元数据失败：{update.Msg}");
        }
    }
}
