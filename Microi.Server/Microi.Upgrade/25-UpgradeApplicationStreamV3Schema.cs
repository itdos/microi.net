using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
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
            Oracle
        }

        public enum ApplicationStoreTablePresence
        {
            None,
            Complete,
            Partial
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
                _ => throw new ArgumentOutOfRangeException(nameof(dialect))
            };
        }

        public static string BuildCreateGateTransitionAuditTableSql(SchemaDialect dialect)
        {
            var columns = GateTransitionAuditFields.Select(field =>
            {
                var nullable = GateTransitionAuditRequiredColumns.Contains(
                    field.Name,
                    StringComparer.OrdinalIgnoreCase)
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
            return dialect switch
            {
                SchemaDialect.MySql => $"ALTER TABLE `{GateTransitionAuditTable}` MODIFY COLUMN `{field.Name}` {type} NOT NULL",
                SchemaDialect.SqlServer => $"ALTER TABLE [{GateTransitionAuditTable}] ALTER COLUMN [{field.Name}] {type} NOT NULL",
                SchemaDialect.Oracle => $"ALTER TABLE {GateTransitionAuditTable} MODIFY ({field.Name} {type} NOT NULL)",
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
                    $"ALTER TABLE `{field.TableName}` MODIFY COLUMN `{field.Name}` {type} NOT NULL DEFAULT {literal}",
                SchemaDialect.SqlServer =>
                    $"ALTER TABLE [{field.TableName}] ALTER COLUMN [{field.Name}] {type} NOT NULL",
                SchemaDialect.Oracle =>
                    $"ALTER TABLE {field.TableName} MODIFY ({field.Name} {type} DEFAULT {literal} NOT NULL)",
                _ => throw new ArgumentOutOfRangeException(nameof(dialect))
            };
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
                _ => identifier
            };
        }

        private static string SqlLiteral(string value)
        {
            return long.TryParse(value, out _) ? value : "'" + (value ?? string.Empty).Replace("'", "''") + "'";
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
                throw new InvalidOperationException($"{field.TableName}.{field.Name} 仍有 {nullCount} 条 NULL，拒绝设置 NOT NULL。");

            var existingDefault = NormalizeDefaultExpression(
                GetColumnDefault(client, dialect, field.TableName, field.Name));
            if (IsColumnNotNull(client, dialect, field.TableName, field.Name)
                && string.Equals(existingDefault, field.DefaultValue, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            client.Db.FromSql(BuildControlAlterSql(dialect, field)).ExecuteNonQuery();
            if (dialect == SchemaDialect.SqlServer) EnsureSqlServerDefault(client, field);

            if (!IsColumnNotNull(client, dialect, field.TableName, field.Name))
                throw new InvalidOperationException($"{field.TableName}.{field.Name} 未能回读确认 NOT NULL。");
            var actualDefault = NormalizeDefaultExpression(GetColumnDefault(client, dialect, field.TableName, field.Name));
            if (!string.Equals(actualDefault, field.DefaultValue, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"{field.TableName}.{field.Name} 默认值回读为[{actualDefault ?? "<null>"}]，预期[{field.DefaultValue}]。");
            }
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
            if (dialect == SchemaDialect.MySql)
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
            if (sameName != null)
                throw new InvalidOperationException($"SQL Server 索引 {definition.Name} 缺少 RequestId IS NOT NULL 过滤条件。");

            try
            {
                client.Db.FromSql(BuildCreateIndexSql(dialect, definition)).ExecuteNonQuery();
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
            var normalized = NormalizeSqlPredicate(filter);
            return normalized == (expected.SqlServerFilterColumn + "ISNOTNULL").ToUpperInvariant();
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
