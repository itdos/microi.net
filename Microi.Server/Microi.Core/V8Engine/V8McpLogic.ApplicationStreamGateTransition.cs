using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Privileged, auditable state transition for the per-tenant application
    /// stream protocol gate. The database row and audit ledger are committed in
    /// the same primary-database transaction; no process-local state participates
    /// in correctness.
    /// </summary>
    public static partial class V8McpLogic
    {
        public const string ApplicationStreamGateTransitionAuditTable = "mci_app_stream_gate_transition";
        private const int ApplicationStreamGateTransitionAdministratorLevel = 999;
        private const int ApplicationStreamGateDrainProofMaxBytes = 1024 * 1024;
        private const string ApplicationStreamGateAuditEmptyText = "__MICROI_EMPTY_V1__";

        public static readonly IReadOnlyList<string> RequiredApplicationStreamGateStoreTables = new[]
        {
            "sys_microistore",
            "mci_ai_app_version",
            "mci_ai_app_file"
        };

        public enum ApplicationStreamGateSqlDialect
        {
            MySql,
            SqlServer,
            Oracle
        }

        public sealed class ApplicationStreamGateRequiredIndex
        {
            public ApplicationStreamGateRequiredIndex(
                string tableName,
                string name,
                bool unique,
                params string[] columns)
            {
                TableName = tableName;
                Name = name;
                Unique = unique;
                Columns = columns ?? Array.Empty<string>();
            }

            public string TableName { get; }
            public string Name { get; }
            public bool Unique { get; }
            public string[] Columns { get; }
            public string SqlServerFilterColumn { get; set; }
        }

        public sealed class ApplicationStreamGateTransitionValidation
        {
            public bool IsValid { get; set; }
            public string Error { get; set; }
            public long ResultGateEpoch { get; set; }
            public bool RequiresDrainProof { get; set; }
        }

        private sealed class NormalizedApplicationStreamGateTransition
        {
            public string OsClient { get; set; }
            public string OsClientType { get; set; }
            public string OsClientNetwork { get; set; }
            public string TransitionId { get; set; }
            public string ExpectedMode { get; set; }
            public int ExpectedMinProtocol { get; set; }
            public long ExpectedGateEpoch { get; set; }
            public string TargetMode { get; set; }
            public int TargetMinProtocol { get; set; }
            public long ResultGateEpoch { get; set; }
            public string DrainProofJson { get; set; }
            public string DrainProofHash { get; set; }
            public string Reason { get; set; }
            public string OperatorUserId { get; set; }
            public string OperatorAccount { get; set; }
            public string OperatorName { get; set; }
            public string RequestFingerprint { get; set; }
            public string ConfirmationSha256 { get; set; }
            public string ProvidedConfirmationSha256 { get; set; }
            public bool ConfirmExecution { get; set; }
        }

        private sealed class ApplicationStreamGateRow
        {
            public string OsClient { get; set; }
            public string OsClientType { get; set; }
            public string OsClientNetwork { get; set; }
            public string Mode { get; set; }
            public int MinProtocol { get; set; }
            public long GateEpoch { get; set; }
        }

        public static ApplicationStreamGateTransitionValidation ValidateApplicationStreamGateTransitionGraph(
            string expectedMode,
            int expectedMinProtocol,
            long expectedGateEpoch,
            string targetMode,
            int targetMinProtocol)
        {
            if (expectedGateEpoch < 0)
                return InvalidApplicationStreamGateTransition("ExpectedGateEpoch 不能小于0");
            if (expectedGateEpoch == long.MaxValue)
                return InvalidApplicationStreamGateTransition("ExpectedGateEpoch 已达到上限");

            var legacyToDrain = string.Equals(expectedMode, "LegacyOpen", StringComparison.Ordinal)
                                && expectedMinProtocol == 2
                                && string.Equals(targetMode, "Drain", StringComparison.Ordinal)
                                && targetMinProtocol == 2;
            var drainToLegacy = string.Equals(expectedMode, "Drain", StringComparison.Ordinal)
                                && expectedMinProtocol == 2
                                && string.Equals(targetMode, "LegacyOpen", StringComparison.Ordinal)
                                && targetMinProtocol == 2;
            var drainToV3 = string.Equals(expectedMode, "Drain", StringComparison.Ordinal)
                            && expectedMinProtocol == 2
                            && string.Equals(targetMode, "V3Only", StringComparison.Ordinal)
                            && targetMinProtocol == 3;
            if (!legacyToDrain && !drainToLegacy && !drainToV3)
            {
                return InvalidApplicationStreamGateTransition(
                    "只允许 LegacyOpen/2→Drain/2、Drain/2→LegacyOpen/2、Drain/2→V3Only/3");
            }

            return new ApplicationStreamGateTransitionValidation
            {
                IsValid = true,
                ResultGateEpoch = expectedGateEpoch + 1,
                RequiresDrainProof = drainToV3
            };
        }

        public static string ValidateApplicationStreamGateTransitionAdministratorLevel(int level)
        {
            return level == ApplicationStreamGateTransitionAdministratorLevel
                ? null
                : "仅 Level=999 管理员可以转换应用流式发布门禁";
        }

        public static IReadOnlyList<string> FindMissingApplicationStreamGateStoreTables(
            Func<string, bool> tableExists)
        {
            if (tableExists == null) throw new ArgumentNullException(nameof(tableExists));
            return RequiredApplicationStreamGateStoreTables.Where(table => !tableExists(table)).ToArray();
        }

        public static IReadOnlyList<string> FindMissingApplicationStreamGateTransitionColumns(
            Func<string, string, bool> columnExists)
        {
            if (columnExists == null) throw new ArgumentNullException(nameof(columnExists));
            return RequiredApplicationStreamGateTransitionColumns
                .SelectMany(table => table.Value.Select(column => new { table.Key, Column = column }))
                .Where(item => !columnExists(item.Key, item.Column))
                .Select(item => item.Key + "." + item.Column)
                .ToArray();
        }

        public static bool MatchesApplicationStreamGateRequiredIndex(
            TableIndexInfo actual,
            ApplicationStreamGateRequiredIndex required)
        {
            return actual != null
                   && required != null
                   && string.Equals(actual.Key_name, required.Name, StringComparison.OrdinalIgnoreCase)
                   && HasEquivalentApplicationStreamGateIndexDefinition(actual, required);
        }

        public static bool HasEquivalentApplicationStreamGateIndexDefinition(
            TableIndexInfo actual,
            ApplicationStreamGateRequiredIndex required)
        {
            return actual != null
                   && required != null
                   && actual.IsUnique == required.Unique
                   && (actual.Columns ?? new List<string>()).SequenceEqual(
                       required.Columns, StringComparer.OrdinalIgnoreCase);
        }

        public static TableIndexInfo ResolveApplicationStreamGateRequiredIndex(
            IReadOnlyCollection<TableIndexInfo> actualIndexes,
            ApplicationStreamGateRequiredIndex required,
            out string error)
        {
            error = null;
            if (required == null)
            {
                error = "索引定义不能为空";
                return null;
            }
            var actual = actualIndexes ?? Array.Empty<TableIndexInfo>();
            var sameName = actual.FirstOrDefault(index => string.Equals(
                index?.Key_name, required.Name, StringComparison.OrdinalIgnoreCase));
            if (sameName != null)
            {
                if (!HasEquivalentApplicationStreamGateIndexDefinition(sameName, required))
                {
                    error = required.TableName + "." + required.Name + " 同名索引定义冲突";
                    return null;
                }
                return sameName;
            }
            var equivalent = actual.FirstOrDefault(index =>
                HasEquivalentApplicationStreamGateIndexDefinition(index, required));
            if (equivalent == null)
                error = required.TableName + "." + required.Name + " 缺失 canonical/equivalent 索引";
            return equivalent;
        }

        public static string NormalizeApplicationStreamGateIndexPredicate(string predicate)
        {
            if (string.IsNullOrWhiteSpace(predicate)) return string.Empty;
            return new string(predicate
                    .Where(character => !char.IsWhiteSpace(character)
                                        && character != '[' && character != ']'
                                        && character != '(' && character != ')')
                    .ToArray())
                .ToUpperInvariant();
        }

        public static ApplicationStreamGateSqlDialect ParseApplicationStreamGateSqlDialect(
            DatabaseType databaseType)
        {
            return databaseType switch
            {
                DatabaseType.MySql => ApplicationStreamGateSqlDialect.MySql,
                DatabaseType.SqlServer => ApplicationStreamGateSqlDialect.SqlServer,
                DatabaseType.SqlServer9 => ApplicationStreamGateSqlDialect.SqlServer,
                DatabaseType.Oracle => ApplicationStreamGateSqlDialect.Oracle,
                _ => throw new NotSupportedException("应用流式发布门禁转换不支持数据库类型：" + databaseType)
            };
        }

        public static string BuildApplicationStreamGateLockSql(ApplicationStreamGateSqlDialect dialect)
        {
            var columns = string.Join(",", new[]
            {
                "OsClient", "OsClientType", "OsClientNetwork", "ApplicationStreamPublishMode",
                "ApplicationStreamMinProtocol", "ApplicationStreamGateEpoch"
            }.Select(column => QuoteApplicationStreamGateTransitionIdentifier(dialect, column)));
            var table = QuoteApplicationStreamGateTransitionIdentifier(dialect, "sys_osclients");
            var where = $"{Q(dialect, "OsClient")}=@os "
                        + $"AND COALESCE({Q(dialect, "OsClientType")},'{ApplicationStreamGateAuditEmptyText}')="
                        + $"COALESCE(@type,'{ApplicationStreamGateAuditEmptyText}') "
                        + $"AND COALESCE({Q(dialect, "OsClientNetwork")},'{ApplicationStreamGateAuditEmptyText}')="
                        + $"COALESCE(@network,'{ApplicationStreamGateAuditEmptyText}') "
                        + $"AND ({Q(dialect, "IsDeleted")} IS NULL OR {Q(dialect, "IsDeleted")}=0)";
            return dialect switch
            {
                ApplicationStreamGateSqlDialect.SqlServer =>
                    $"SELECT TOP (2) {columns} FROM {table} WITH (UPDLOCK,HOLDLOCK,ROWLOCK) WHERE {where}",
                ApplicationStreamGateSqlDialect.Oracle =>
                    $"SELECT {columns} FROM {table} WHERE ({where}) AND ROWNUM<=2 FOR UPDATE",
                _ => $"SELECT {columns} FROM {table} WHERE {where} LIMIT 2 FOR UPDATE"
            };
        }

        public static string BuildApplicationStreamGateReadSql(ApplicationStreamGateSqlDialect dialect)
        {
            var sql = BuildApplicationStreamGateLockSql(dialect);
            return dialect switch
            {
                ApplicationStreamGateSqlDialect.SqlServer => sql.Replace(
                    " WITH (UPDLOCK,HOLDLOCK,ROWLOCK)", string.Empty),
                ApplicationStreamGateSqlDialect.Oracle => sql.Replace(" FOR UPDATE", string.Empty),
                _ => sql.Replace(" FOR UPDATE", string.Empty)
            };
        }

        public static string BuildApplicationStreamGateCasUpdateSql(ApplicationStreamGateSqlDialect dialect)
        {
            return $"UPDATE {Q(dialect, "sys_osclients")} SET "
                   + $"{Q(dialect, "ApplicationStreamPublishMode")}=@targetMode,"
                   + $"{Q(dialect, "ApplicationStreamMinProtocol")}=@targetMin,"
                   + $"{Q(dialect, "ApplicationStreamGateEpoch")}=@resultEpoch "
                   + $"WHERE {Q(dialect, "OsClient")}=@os "
                   + $"AND COALESCE({Q(dialect, "OsClientType")},'{ApplicationStreamGateAuditEmptyText}')="
                   + $"COALESCE(@type,'{ApplicationStreamGateAuditEmptyText}') "
                   + $"AND COALESCE({Q(dialect, "OsClientNetwork")},'{ApplicationStreamGateAuditEmptyText}')="
                   + $"COALESCE(@network,'{ApplicationStreamGateAuditEmptyText}') "
                   + $"AND {Q(dialect, "ApplicationStreamPublishMode")}=@expectedMode "
                   + $"AND {Q(dialect, "ApplicationStreamMinProtocol")}=@expectedMin "
                   + $"AND {Q(dialect, "ApplicationStreamGateEpoch")}=@expectedEpoch "
                   + $"AND ({Q(dialect, "IsDeleted")} IS NULL OR {Q(dialect, "IsDeleted")}=0)";
        }

        public static string BuildApplicationStreamGateAuditLockSql(ApplicationStreamGateSqlDialect dialect)
        {
            var columns = string.Join(",", ApplicationStreamGateAuditColumns
                .Select(column => Q(dialect, column)));
            var table = Q(dialect, ApplicationStreamGateTransitionAuditTable);
            var where = Q(dialect, "TransitionId") + "=@transitionId";
            return dialect switch
            {
                ApplicationStreamGateSqlDialect.SqlServer =>
                    $"SELECT TOP (2) {columns} FROM {table} WITH (UPDLOCK,HOLDLOCK,ROWLOCK) WHERE {where}",
                ApplicationStreamGateSqlDialect.Oracle =>
                    $"SELECT {columns} FROM {table} WHERE ({where}) AND ROWNUM<=2 FOR UPDATE",
                _ => $"SELECT {columns} FROM {table} WHERE {where} LIMIT 2 FOR UPDATE"
            };
        }

        public static string BuildApplicationStreamGateAuditReadSql(ApplicationStreamGateSqlDialect dialect)
        {
            var sql = BuildApplicationStreamGateAuditLockSql(dialect);
            return dialect switch
            {
                ApplicationStreamGateSqlDialect.SqlServer => sql.Replace(
                    " WITH (UPDLOCK,HOLDLOCK,ROWLOCK)", string.Empty),
                ApplicationStreamGateSqlDialect.Oracle => sql.Replace(" FOR UPDATE", string.Empty),
                _ => sql.Replace(" FOR UPDATE", string.Empty)
            };
        }

        public static string BuildApplicationStreamGateAuditInsertSql(ApplicationStreamGateSqlDialect dialect)
        {
            var columns = string.Join(",", ApplicationStreamGateAuditColumns
                .Select(column => Q(dialect, column)));
            var values = string.Join(",", ApplicationStreamGateAuditColumns
                .Select(column => "@" + char.ToLowerInvariant(column[0]) + column.Substring(1)));
            return $"INSERT INTO {Q(dialect, ApplicationStreamGateTransitionAuditTable)} ({columns}) VALUES ({values})";
        }

        public static string CanonicalizeApplicationStreamGateDrainProof(string drainProofJson)
        {
            if (string.IsNullOrWhiteSpace(drainProofJson))
                throw new ArgumentException("DrainProofJson 不能为空", nameof(drainProofJson));
            if (Encoding.UTF8.GetByteCount(drainProofJson) > ApplicationStreamGateDrainProofMaxBytes)
                throw new ArgumentException("DrainProofJson 不能超过1MiB", nameof(drainProofJson));
            string wrappedCanonical;
            try
            {
                // Reuse the v3 cross-language canonicalizer without weakening its
                // root-array contract: the caller-supplied proof remains the only
                // element, and the wrapper is removed after validation.
                wrappedCanonical = CanonicalizeApplicationAssetV3RouteSnapshot("[" + drainProofJson + "]");
            }
            catch (Exception ex)
            {
                throw new ArgumentException("DrainProofJson 不是合法 canonical JSON：" + ex.Message,
                    nameof(drainProofJson));
            }
            if (wrappedCanonical.Length < 4
                || wrappedCanonical[0] != '['
                || wrappedCanonical[1] != '{'
                || wrappedCanonical[wrappedCanonical.Length - 2] != '}'
                || wrappedCanonical[wrappedCanonical.Length - 1] != ']')
                throw new ArgumentException("DrainProofJson 必须是 JSON 对象", nameof(drainProofJson));
            var canonical = wrappedCanonical.Substring(1, wrappedCanonical.Length - 2);
            if (Encoding.UTF8.GetByteCount(canonical) > ApplicationStreamGateDrainProofMaxBytes)
                throw new ArgumentException("canonical DrainProofJson 不能超过1MiB", nameof(drainProofJson));
            return canonical;
        }

        public static string ComputeApplicationStreamGateDrainProofSha256(string drainProofJson)
        {
            return Sha256Hex(CanonicalizeApplicationStreamGateDrainProof(drainProofJson));
        }

        public static string BuildApplicationStreamGateTransitionFingerprint(
            string transitionId,
            string osClient,
            string osClientType,
            string osClientNetwork,
            string expectedMode,
            int expectedMinProtocol,
            long expectedGateEpoch,
            string targetMode,
            int targetMinProtocol,
            string drainProofJson,
            string drainProofHash,
            string reason)
        {
            var facts = new JObject
            {
                ["DrainProofHash"] = drainProofHash ?? string.Empty,
                ["DrainProofJson"] = drainProofJson ?? string.Empty,
                ["ExpectedGateEpoch"] = expectedGateEpoch.ToString(CultureInfo.InvariantCulture),
                ["ExpectedMinProtocol"] = expectedMinProtocol,
                ["ExpectedMode"] = expectedMode ?? string.Empty,
                ["OsClient"] = osClient ?? string.Empty,
                ["OsClientNetwork"] = osClientNetwork ?? string.Empty,
                ["OsClientType"] = osClientType ?? string.Empty,
                ["Reason"] = reason ?? string.Empty,
                ["TargetMinProtocol"] = targetMinProtocol,
                ["TargetMode"] = targetMode ?? string.Empty,
                ["TransitionId"] = transitionId ?? string.Empty
            };
            return Sha256Hex(WriteCanonicalApplicationStreamGateJson(facts));
        }

        public static string ValidateApplicationStreamGateTransitionReplay(
            string storedRequestFingerprint,
            string storedConfirmationSha256,
            string requestFingerprint,
            string confirmationSha256)
        {
            if (!string.Equals(storedRequestFingerprint, requestFingerprint, StringComparison.Ordinal)
                || !string.Equals(storedConfirmationSha256, confirmationSha256, StringComparison.Ordinal))
            {
                return "TransitionId 已被不同请求占用";
            }
            return null;
        }

        public static DosResult<object> TransitionApplicationStreamGate(
            string osClient,
            JObject param,
            object currentToken)
        {
            try
            {
                if (param == null) return new DosResult<object>(0, null, "参数不能为空");
                osClient = (osClient ?? string.Empty).Trim();
                if (osClient.Length == 0 || osClient.Length > 50)
                    return new DosResult<object>(0, null, "OsClient 不能为空且不能超过50个字符");

                var currentUser = GetMcpOperator(currentToken);
                var levelError = ValidateApplicationStreamGateTransitionAdministratorLevel(
                    SafeJInt(currentUser, "Level", -1));
                if (levelError != null) return new DosResult<object>(0, null, levelError);
                if (UserAccessKeySecurity.IsSession(currentUser))
                    return new DosResult<object>(0, null, "访问密钥会话不能转换应用流式发布门禁");

                var operatorUserId = SafeJString(currentUser, "Id", SafeJString(currentUser, "UserId"));
                if (string.IsNullOrWhiteSpace(operatorUserId))
                    return new DosResult<object>(0, null, "当前管理员缺少用户Id");

                var request = NormalizeApplicationStreamGateTransition(
                    osClient,
                    param,
                    operatorUserId,
                    SafeJString(currentUser, "Account"),
                    SafeJString(currentUser, "Name"));
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db?.Db?.DbProvider == null)
                    return new DosResult<object>(0, null, "未找到租户主库连接或物理方言");

                var missingStoreTables = FindMissingApplicationStreamGateStoreTables(
                    tableName => client.Db.TableExists(tableName));
                if (missingStoreTables.Count > 0)
                {
                    return new DosResult<object>(0, new { MissingTables = missingStoreTables },
                        "三张 AI 应用商城表未完整安装，拒绝转换门禁");
                }
                foreach (var requiredTable in new[] { "sys_osclients", ApplicationStreamGateTransitionAuditTable })
                {
                    if (!client.Db.TableExists(requiredTable))
                        return new DosResult<object>(0, new { MissingTable = requiredTable },
                            "门禁转换物理契约未就绪，请先执行 Upgrade25");
                }

                var dialect = ParseApplicationStreamGateSqlDialect(client.Db.Db.DbProvider.DatabaseType);
                var readinessError = ValidateApplicationStreamGateTransitionPhysicalContract(
                    osClient, client, dialect);
                if (readinessError != null)
                    return new DosResult<object>(0, null, "Upgrade25 物理契约未就绪：" + readinessError);
                var existingAudit = ReadApplicationStreamGateAudit(client, dialect, null, request.TransitionId, false);
                var currentGate = ReadApplicationStreamGateRow(client, dialect, null, request, false);
                if (existingAudit != null)
                {
                    var replayError = ValidateApplicationStreamGateAuditReplay(existingAudit, request);
                    if (replayError != null) return new DosResult<object>(0, null, replayError);
                }
                else
                {
                    var expectedError = ValidateApplicationStreamGateExpectedRow(currentGate, request);
                    if (expectedError != null) return new DosResult<object>(0, BuildGateResponse(currentGate), expectedError);
                }

                var preview = BuildApplicationStreamGateTransitionResponse(
                    request,
                    currentGate,
                    existingAudit,
                    true,
                    existingAudit != null);
                if (!request.ConfirmExecution)
                    return new DosResult<object>(1, preview, "门禁转换预检查通过，请保持载荷不变并提交 ConfirmExecution=true 与 ConfirmationSha256");
                if (!string.Equals(request.ProvidedConfirmationSha256, request.ConfirmationSha256, StringComparison.Ordinal))
                    return new DosResult<object>(0, preview, "ConfirmationSha256 与服务器重算的规范载荷 SHA-256 不一致");

                return ExecuteApplicationStreamGateTransition(client, dialect, request);
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "应用流式发布门禁转换失败：" + ex.Message);
            }
        }

        private static readonly string[] ApplicationStreamGateAuditColumns =
        {
            "Id", "TransitionId", "OsClient", "OsClientType", "OsClientNetwork",
            "ExpectedMode", "ExpectedMinProtocol", "ExpectedGateEpoch", "TargetMode",
            "TargetMinProtocol", "ResultGateEpoch", "DrainProofJson", "DrainProofSha256",
            "RequestFingerprint", "ConfirmationSha256", "OperatorUserId", "OperatorAccount",
            "OperatorName", "Reason", "CreateTime"
        };

        public static readonly IReadOnlyDictionary<string, IReadOnlyList<string>>
            RequiredApplicationStreamGateTransitionColumns =
                new Dictionary<string, IReadOnlyList<string>>(StringComparer.OrdinalIgnoreCase)
                {
                    ["sys_microistore"] = new[]
                    {
                        "PublishProtocolVersion", "PublishState", "PublishFence", "PublishRowVersion",
                        "ActivePublishVersionId", "CommittedPublishVersionId", "CommittedRuntimeManifestHash"
                    },
                    ["mci_ai_app_version"] = new[]
                    {
                        "PublishProtocolVersion", "PublishState", "RequestId", "DeliveryBatchId",
                        "RequestFingerprint", "SourceManifestHash", "RuntimeManifestHash",
                        "ExpectedCurrentVersion", "ExpectedAppVersion", "EntryPath", "ReleasePrefix",
                        "AssetManifestJson", "FencingToken", "RowVersion", "PointerCommittedAt",
                        "CompletedAt", "LastError", "RecoveryEpoch", "RouteSnapshotJson", "RouteSnapshotHash"
                    },
                    ["mci_ai_app_file"] = new[] { "FilePathHash" },
                    ["sys_osclients"] = new[]
                    {
                        "ApplicationStreamPublishMode", "ApplicationStreamMinProtocol", "ApplicationStreamGateEpoch"
                    },
                    [ApplicationStreamGateTransitionAuditTable] = ApplicationStreamGateAuditColumns
                };

        public static readonly IReadOnlyList<ApplicationStreamGateRequiredIndex>
            RequiredApplicationStreamGateTransitionIndexes =
                new ApplicationStreamGateRequiredIndex[]
                {
                    new ApplicationStreamGateRequiredIndex(
                        "mci_ai_app_version", "ux_aav_app_version", true, "AppId", "VersionNo"),
                    new ApplicationStreamGateRequiredIndex(
                        "mci_ai_app_version", "ux_aav_app_request", true, "AppId", "RequestId")
                    {
                        SqlServerFilterColumn = "RequestId"
                    },
                    new ApplicationStreamGateRequiredIndex(
                        "mci_ai_app_file", "ux_aaf_version_pathhash", true, "VersionId", "FilePathHash"),
                    new ApplicationStreamGateRequiredIndex(
                        "mci_ai_app_version", "ix_aav_state_time_app", false,
                        "PublishState", "UpdateTime", "AppId"),
                    new ApplicationStreamGateRequiredIndex(
                        "mci_ai_app_file", "ix_aaf_app_version_scope", false,
                        "AppId", "VersionId", "StorageScope"),
                    new ApplicationStreamGateRequiredIndex(
                        "sys_microistore", "ix_store_active_fence", false,
                        "ActivePublishVersionId", "PublishFence"),
                    new ApplicationStreamGateRequiredIndex(
                        ApplicationStreamGateTransitionAuditTable, "ux_asgt_transition_id", true,
                        "TransitionId")
                };

        private static ApplicationStreamGateTransitionValidation InvalidApplicationStreamGateTransition(string error)
        {
            return new ApplicationStreamGateTransitionValidation { IsValid = false, Error = error };
        }

        private static string ValidateApplicationStreamGateTransitionPhysicalContract(
            string osClient,
            OsClientSecret client,
            ApplicationStreamGateSqlDialect dialect)
        {
            var missingColumns = FindMissingApplicationStreamGateTransitionColumns(
                (tableName, columnName) => client.Db.ColumnExists(tableName, columnName));
            if (missingColumns.Count > 0)
                return "缺少列：" + string.Join(",", missingColumns);

            foreach (var tableGroup in RequiredApplicationStreamGateTransitionIndexes.GroupBy(
                         index => index.TableName,
                         StringComparer.OrdinalIgnoreCase))
            {
                var read = GetTableIndexes(osClient, tableGroup.Key);
                if (read?.Code != 1)
                    return "读取 " + tableGroup.Key + " 索引失败：" + (read?.Msg ?? "unknown");
                var actualIndexes = (IReadOnlyCollection<TableIndexInfo>)
                    (read.Data ?? new List<TableIndexInfo>());
                foreach (var required in tableGroup)
                {
                    var selected = ResolveApplicationStreamGateRequiredIndex(
                        actualIndexes, required, out var resolutionError);
                    if (selected == null) return resolutionError;
                    if (dialect != ApplicationStreamGateSqlDialect.SqlServer
                        || required.SqlServerFilterColumn == null) continue;

                    var filter = client.Db.FromSql(
                            "SELECT filter_definition FROM sys.indexes "
                            + "WHERE object_id=OBJECT_ID(@p0) AND name=@p1")
                        .AddInParameter("p0", required.TableName)
                        .AddInParameter("p1", selected.Key_name)
                        .ToScalar()?.ToString();
                    var expectedFilter = (required.SqlServerFilterColumn + "ISNOTNULL").ToUpperInvariant();
                    if (!string.Equals(
                            NormalizeApplicationStreamGateIndexPredicate(filter),
                            expectedFilter,
                            StringComparison.Ordinal))
                    {
                        return required.TableName + "." + selected.Key_name
                               + " SQL Server filter 定义不一致";
                    }
                }
            }
            return null;
        }

        private static string Q(ApplicationStreamGateSqlDialect dialect, string identifier)
        {
            return QuoteApplicationStreamGateTransitionIdentifier(dialect, identifier);
        }

        private static string QuoteApplicationStreamGateTransitionIdentifier(
            ApplicationStreamGateSqlDialect dialect,
            string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier)
                || !Regex.IsMatch(identifier, "^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.CultureInvariant))
                throw new ArgumentException("SQL 标识符不合法", nameof(identifier));
            return dialect switch
            {
                ApplicationStreamGateSqlDialect.MySql => "`" + identifier + "`",
                ApplicationStreamGateSqlDialect.SqlServer => "[" + identifier + "]",
                ApplicationStreamGateSqlDialect.Oracle => identifier,
                _ => throw new ArgumentOutOfRangeException(nameof(dialect))
            };
        }

        private static NormalizedApplicationStreamGateTransition NormalizeApplicationStreamGateTransition(
            string osClient,
            JObject param,
            string operatorUserId,
            string operatorAccount,
            string operatorName)
        {
            var requestedOsClient = RequiredExactGateString(param, "OsClient", 100);
            if (!Regex.IsMatch(requestedOsClient,
                    "^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$",
                    RegexOptions.CultureInvariant)
                || !string.Equals(requestedOsClient, osClient, StringComparison.Ordinal))
                throw new ArgumentException("OsClient 必须为精确匹配租户坐标的1到100位安全 ASCII 字符");
            var transitionId = RequiredExactGateString(param, "TransitionId", 100);
            if (!Regex.IsMatch(transitionId, "^[A-Za-z0-9._:-]{8,100}$", RegexOptions.CultureInvariant))
                throw new ArgumentException("TransitionId 必须为8到100位安全字符");
            var osClientType = RequiredExactGateString(param, "OsClientType", 100, true);
            var osClientNetwork = RequiredExactGateString(param, "OsClientNetwork", 100, true);
            if (string.Equals(osClientType, ApplicationStreamGateAuditEmptyText, StringComparison.Ordinal)
                || string.Equals(osClientNetwork, ApplicationStreamGateAuditEmptyText, StringComparison.Ordinal))
                throw new ArgumentException("OsClientType/OsClientNetwork 使用了服务器保留值");
            var expectedMode = RequiredExactGateString(param, "ExpectedMode", 20);
            var targetMode = RequiredExactGateString(param, "TargetMode", 20);
            var expectedMinProtocol = RequiredGateInt32(param, "ExpectedMinProtocol");
            var targetMinProtocol = RequiredGateInt32(param, "TargetMinProtocol");
            var expectedGateEpoch = RequiredCanonicalGateInt64(param, "ExpectedGateEpoch");
            var reason = RequiredExactGateString(param, "Reason", 1000);
            var graph = ValidateApplicationStreamGateTransitionGraph(
                expectedMode, expectedMinProtocol, expectedGateEpoch, targetMode, targetMinProtocol);
            if (!graph.IsValid) throw new ArgumentException(graph.Error);

            string drainProofJson;
            string drainProofHash;
            var proofToken = param["DrainProofJson"];
            if (proofToken == null || proofToken.Type != JTokenType.String)
                throw new ArgumentException(graph.RequiresDrainProof
                    ? "Drain→V3Only 必须提供外部逐节点 DrainProofJson"
                    : "DrainProofJson 必须是 canonical JSON 对象字符串");
            var suppliedProofJson = RequiredExactGateString(param, "DrainProofJson", 1024 * 1024);
            drainProofJson = CanonicalizeApplicationStreamGateDrainProof(suppliedProofJson);
            if (!string.Equals(suppliedProofJson, drainProofJson, StringComparison.Ordinal))
                throw new ArgumentException("DrainProofJson 必须使用递归 ordinal 键排序、数组保序且无多余空白的 canonical JSON");
            drainProofHash = RequiredExactGateString(param, "DrainProofHash", 64);
            if (!Regex.IsMatch(drainProofHash, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant)
                || !string.Equals(drainProofHash, Sha256Hex(drainProofJson), StringComparison.Ordinal))
                throw new ArgumentException("DrainProofHash 必须精确等于 canonical DrainProofJson UTF-8 字节的 SHA-256");

            var request = new NormalizedApplicationStreamGateTransition
            {
                OsClient = osClient,
                OsClientType = osClientType,
                OsClientNetwork = osClientNetwork,
                TransitionId = transitionId,
                ExpectedMode = expectedMode,
                ExpectedMinProtocol = expectedMinProtocol,
                ExpectedGateEpoch = expectedGateEpoch,
                TargetMode = targetMode,
                TargetMinProtocol = targetMinProtocol,
                ResultGateEpoch = graph.ResultGateEpoch,
                DrainProofJson = drainProofJson,
                DrainProofHash = drainProofHash,
                Reason = reason,
                OperatorUserId = operatorUserId,
                OperatorAccount = (operatorAccount ?? string.Empty).Trim(),
                OperatorName = (operatorName ?? string.Empty).Trim(),
                ProvidedConfirmationSha256 = OptionalGateString(param, "ConfirmationSha256", 64),
                ConfirmExecution = param["ConfirmExecution"]?.Type == JTokenType.Boolean
                                   && param["ConfirmExecution"].Value<bool>()
            };
            request.RequestFingerprint = BuildApplicationStreamGateTransitionFingerprint(
                request.TransitionId, request.OsClient, request.OsClientType, request.OsClientNetwork,
                request.ExpectedMode, request.ExpectedMinProtocol, request.ExpectedGateEpoch,
                request.TargetMode, request.TargetMinProtocol,
                request.DrainProofJson, request.DrainProofHash, request.Reason);
            request.ConfirmationSha256 = request.RequestFingerprint;
            return request;
        }

        private static string RequiredExactGateString(
            JObject param,
            string name,
            int maxLength,
            bool allowEmpty = false)
        {
            var token = param?[name];
            if (token == null || token.Type != JTokenType.String)
                throw new ArgumentException(name + " 必须是字符串");
            var value = token.Value<string>() ?? string.Empty;
            try { _ = new UTF8Encoding(false, true).GetByteCount(value); }
            catch (EncoderFallbackException)
            {
                throw new ArgumentException(name + " 包含无效 Unicode surrogate");
            }
            if (!string.Equals(value, value.Trim(), StringComparison.Ordinal)
                || (!allowEmpty && value.Length == 0)
                || value.Length > maxLength
                || value.Any(character => character <= '\u001f' || character == '\u007f'))
                throw new ArgumentException(name + " 必须无首尾空白、长度合法且不含控制字符");
            return value;
        }

        private static string RequiredGateString(JObject param, string name, int maxLength)
        {
            var token = param?[name];
            if (token == null || token.Type != JTokenType.String)
                throw new ArgumentException(name + " 必须是字符串");
            var value = (token.Value<string>() ?? string.Empty).Trim();
            if (value.Length == 0 || value.Length > maxLength || value.Any(char.IsControl))
                throw new ArgumentException(name + " 不能为空、超长或包含控制字符");
            return value;
        }

        private static string OptionalGateString(JObject param, string name, int maxLength)
        {
            var token = param?[name];
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
                return null;
            if (token.Type != JTokenType.String) throw new ArgumentException(name + " 必须是字符串");
            var value = (token.Value<string>() ?? string.Empty).Trim();
            if (value.Length > maxLength || value.Any(char.IsControl))
                throw new ArgumentException(name + " 超长或包含控制字符");
            return value.Length == 0 ? null : value;
        }

        private static int RequiredGateInt32(JObject param, string name)
        {
            var token = param?[name];
            if (token == null || (token.Type != JTokenType.Integer && token.Type != JTokenType.String))
                throw new ArgumentException(name + " 必须是整数");
            if (!int.TryParse(token.ToString(), NumberStyles.None, CultureInfo.InvariantCulture, out var value))
                throw new ArgumentException(name + " 不是有效整数");
            return value;
        }

        private static long RequiredCanonicalGateInt64(JObject param, string name)
        {
            var token = param?[name];
            if (token == null || token.Type != JTokenType.String)
                throw new ArgumentException(name + " 必须使用规范十进制字符串，避免 JSON 大整数精度丢失");
            var raw = token.Value<string>() ?? string.Empty;
            if (!Regex.IsMatch(raw, "^(0|[1-9][0-9]*)$", RegexOptions.CultureInvariant)
                || !long.TryParse(raw, NumberStyles.None, CultureInfo.InvariantCulture, out var value))
                throw new ArgumentException(name + " 不是规范 Int64 非负十进制字符串");
            return value;
        }

        private static string WriteCanonicalApplicationStreamGateJson(JToken token)
        {
            var builder = new StringBuilder();
            WriteCanonicalApplicationStreamGateJson(builder, token);
            return builder.ToString();
        }

        private static void WriteCanonicalApplicationStreamGateJson(StringBuilder builder, JToken token)
        {
            switch (token?.Type)
            {
                case JTokenType.Object:
                    builder.Append('{');
                    var firstProperty = true;
                    foreach (var property in ((JObject)token).Properties().OrderBy(item => item.Name, StringComparer.Ordinal))
                    {
                        if (!firstProperty) builder.Append(',');
                        firstProperty = false;
                        builder.Append(JsonConvert.ToString(property.Name)).Append(':');
                        WriteCanonicalApplicationStreamGateJson(builder, property.Value);
                    }
                    builder.Append('}');
                    return;
                case JTokenType.Array:
                    builder.Append('[');
                    var firstItem = true;
                    foreach (var item in (JArray)token)
                    {
                        if (!firstItem) builder.Append(',');
                        firstItem = false;
                        WriteCanonicalApplicationStreamGateJson(builder, item);
                    }
                    builder.Append(']');
                    return;
                case JTokenType.String:
                    builder.Append(JsonConvert.ToString(token.Value<string>()));
                    return;
                case JTokenType.Integer:
                    var integerText = Convert.ToString(((JValue)token).Value, CultureInfo.InvariantCulture);
                    const long maxSafeInteger = 9007199254740991L;
                    if (!long.TryParse(integerText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var integer)
                        || integer < -maxSafeInteger || integer > maxSafeInteger)
                        throw new ArgumentException("规范 JSON 的 number 必须是 JavaScript safe integer");
                    builder.Append(integerText);
                    return;
                case JTokenType.Boolean:
                    builder.Append(token.Value<bool>() ? "true" : "false");
                    return;
                case JTokenType.Null:
                    builder.Append("null");
                    return;
                default:
                    throw new ArgumentException("规范 JSON 只允许对象、数组、字符串、整数、布尔值和 null");
            }
        }

        private static ApplicationStreamGateRow ReadApplicationStreamGateRow(
            OsClientSecret client,
            ApplicationStreamGateSqlDialect dialect,
            DbTrans trans,
            NormalizedApplicationStreamGateTransition request,
            bool forUpdate)
        {
            var sql = forUpdate ? BuildApplicationStreamGateLockSql(dialect) : BuildApplicationStreamGateReadSql(dialect);
            var section = trans == null ? client.Db.FromSql(sql) : trans.FromSql(sql);
            var rows = section
                .AddInParameter("@os", request.OsClient)
                .AddInParameter("@type", request.OsClientType)
                .AddInParameter("@network", request.OsClientNetwork)
                .ToList<dynamic>() ?? new List<dynamic>();
            if (rows.Count != 1)
                throw new InvalidOperationException("sys_osclients 门禁行数量必须为1，Actual=" + rows.Count);
            var row = rows[0] as JObject ?? JObject.FromObject((object)rows[0]);
            var result = new ApplicationStreamGateRow
            {
                OsClient = GateDbString(row, "OsClient"),
                OsClientType = GateDbNullableString(row, "OsClientType") ?? string.Empty,
                OsClientNetwork = GateDbNullableString(row, "OsClientNetwork") ?? string.Empty,
                Mode = GateDbString(row, "ApplicationStreamPublishMode"),
                MinProtocol = GateDbInt(row, "ApplicationStreamMinProtocol"),
                GateEpoch = GateDbLong(row, "ApplicationStreamGateEpoch")
            };
            if (!string.Equals(result.OsClient, request.OsClient, StringComparison.Ordinal)
                || !string.Equals(result.OsClientType, request.OsClientType, StringComparison.Ordinal)
                || !string.Equals(result.OsClientNetwork, request.OsClientNetwork, StringComparison.Ordinal))
                throw new InvalidOperationException("sys_osclients 门禁三坐标 ordinal 精确回读失败");
            return result;
        }

        private static JObject ReadApplicationStreamGateAudit(
            OsClientSecret client,
            ApplicationStreamGateSqlDialect dialect,
            DbTrans trans,
            string transitionId,
            bool forUpdate)
        {
            var sql = forUpdate ? BuildApplicationStreamGateAuditLockSql(dialect) : BuildApplicationStreamGateAuditReadSql(dialect);
            var section = trans == null ? client.Db.FromSql(sql) : trans.FromSql(sql);
            var rows = section.AddInParameter("@transitionId", transitionId).ToList<dynamic>() ?? new List<dynamic>();
            if (rows.Count > 1) throw new InvalidOperationException("TransitionId 审计记录不唯一");
            if (rows.Count == 0) return null;
            var row = rows[0] as JObject ?? JObject.FromObject((object)rows[0]);
            if (!string.Equals(GateDbString(row, "TransitionId"), transitionId, StringComparison.Ordinal))
                throw new InvalidOperationException("TransitionId ordinal 精确回读失败");
            return row;
        }

        private static DosResult<object> ExecuteApplicationStreamGateTransition(
            OsClientSecret client,
            ApplicationStreamGateSqlDialect dialect,
            NormalizedApplicationStreamGateTransition request)
        {
            using var trans = client.Db.BeginTransaction();
            var committed = false;
            try
            {
                var lockedGate = ReadApplicationStreamGateRow(client, dialect, trans, request, true);
                var existingAudit = ReadApplicationStreamGateAudit(
                    client, dialect, trans, request.TransitionId, true);
                if (existingAudit != null)
                {
                    var replayError = ValidateApplicationStreamGateAuditReplay(existingAudit, request);
                    if (replayError != null) throw new InvalidOperationException(replayError);
                    var replayData = BuildApplicationStreamGateTransitionResponse(
                        request, lockedGate, existingAudit, false, true);
                    trans.Commit();
                    committed = true;
                    return new DosResult<object>(1, replayData, "相同 TransitionId 已精确幂等完成，未重复写入");
                }

                var expectedError = ValidateApplicationStreamGateExpectedRow(lockedGate, request);
                if (expectedError != null) throw new InvalidOperationException(expectedError);
                var affectedRows = trans.FromSql(BuildApplicationStreamGateCasUpdateSql(dialect))
                    .AddInParameter("@targetMode", request.TargetMode)
                    .AddInParameter("@targetMin", request.TargetMinProtocol)
                    .AddInParameter("@resultEpoch", request.ResultGateEpoch)
                    .AddInParameter("@os", request.OsClient)
                    .AddInParameter("@type", request.OsClientType)
                    .AddInParameter("@network", request.OsClientNetwork)
                    .AddInParameter("@expectedMode", request.ExpectedMode)
                    .AddInParameter("@expectedMin", request.ExpectedMinProtocol)
                    .AddInParameter("@expectedEpoch", request.ExpectedGateEpoch)
                    .ExecuteNonQuery();
                if (affectedRows != 1)
                    throw new InvalidOperationException("门禁 ExpectedMode/MinProtocol/GateEpoch CAS 失败，affectedRows=" + affectedRows);

                var now = DateTime.Now;
                var auditId = BuildApplicationStreamGateTransitionAuditId(request.TransitionId);
                var inserted = trans.FromSql(BuildApplicationStreamGateAuditInsertSql(dialect))
                    .AddInParameter("@id", auditId)
                    .AddInParameter("@transitionId", request.TransitionId)
                    .AddInParameter("@osClient", request.OsClient)
                    .AddInParameter("@osClientType", EncodeApplicationStreamGateAuditText(request.OsClientType))
                    .AddInParameter("@osClientNetwork", EncodeApplicationStreamGateAuditText(request.OsClientNetwork))
                    .AddInParameter("@expectedMode", request.ExpectedMode)
                    .AddInParameter("@expectedMinProtocol", request.ExpectedMinProtocol)
                    .AddInParameter("@expectedGateEpoch", request.ExpectedGateEpoch)
                    .AddInParameter("@targetMode", request.TargetMode)
                    .AddInParameter("@targetMinProtocol", request.TargetMinProtocol)
                    .AddInParameter("@resultGateEpoch", request.ResultGateEpoch)
                    .AddInParameter("@drainProofJson", (object)request.DrainProofJson ?? DBNull.Value)
                    .AddInParameter("@drainProofSha256", (object)request.DrainProofHash ?? DBNull.Value)
                    .AddInParameter("@requestFingerprint", request.RequestFingerprint)
                    .AddInParameter("@confirmationSha256", request.ConfirmationSha256)
                    .AddInParameter("@operatorUserId", request.OperatorUserId)
                    .AddInParameter("@operatorAccount", EncodeApplicationStreamGateAuditText(request.OperatorAccount))
                    .AddInParameter("@operatorName", EncodeApplicationStreamGateAuditText(request.OperatorName))
                    .AddInParameter("@reason", request.Reason)
                    .AddInParameter("@createTime", now)
                    .ExecuteNonQuery();
                if (inserted != 1) throw new InvalidOperationException("门禁转换审计写入失败，affectedRows=" + inserted);

                var changedGate = ReadApplicationStreamGateRow(client, dialect, trans, request, false);
                if (!string.Equals(changedGate.Mode, request.TargetMode, StringComparison.Ordinal)
                    || changedGate.MinProtocol != request.TargetMinProtocol
                    || changedGate.GateEpoch != request.ResultGateEpoch)
                    throw new InvalidOperationException("门禁转换后模式/协议/代次回读不一致");
                var auditReadback = ReadApplicationStreamGateAudit(
                    client, dialect, trans, request.TransitionId, false);
                var auditError = ValidateApplicationStreamGateAuditReplay(auditReadback, request);
                if (auditError != null) throw new InvalidOperationException("审计回读失败：" + auditError);

                var data = BuildApplicationStreamGateTransitionResponse(
                    request, changedGate, auditReadback, false, false);
                trans.Commit();
                committed = true;
                return new DosResult<object>(1, data, "应用流式发布门禁已原子转换并写入审计");
            }
            catch (Exception ex)
            {
                if (!committed)
                {
                    try { trans.Rollback(); } catch { }
                }
                return new DosResult<object>(0, null, ex.Message);
            }
        }

        public static string BuildApplicationStreamGateTransitionAuditId(string transitionId)
        {
            var hash = Sha256Hex("application-stream-gate-transition:" + (transitionId ?? string.Empty));
            return hash.Substring(0, 8) + "-" + hash.Substring(8, 4) + "-" + hash.Substring(12, 4)
                   + "-" + hash.Substring(16, 4) + "-" + hash.Substring(20, 12);
        }

        private static string ValidateApplicationStreamGateExpectedRow(
            ApplicationStreamGateRow row,
            NormalizedApplicationStreamGateTransition request)
        {
            if (!string.Equals(row.Mode, request.ExpectedMode, StringComparison.Ordinal)
                || row.MinProtocol != request.ExpectedMinProtocol
                || row.GateEpoch != request.ExpectedGateEpoch)
            {
                return "门禁 CAS 前置状态不匹配：Expected="
                       + request.ExpectedMode + "/" + request.ExpectedMinProtocol + "/"
                       + request.ExpectedGateEpoch.ToString(CultureInfo.InvariantCulture)
                       + "，Actual=" + row.Mode + "/" + row.MinProtocol + "/"
                       + row.GateEpoch.ToString(CultureInfo.InvariantCulture);
            }
            return null;
        }

        private static string ValidateApplicationStreamGateAuditReplay(
            JObject row,
            NormalizedApplicationStreamGateTransition request)
        {
            if (row == null) return "TransitionId 审计记录不存在";
            var fingerprintError = ValidateApplicationStreamGateTransitionReplay(
                GateDbString(row, "RequestFingerprint"),
                GateDbString(row, "ConfirmationSha256"),
                request.RequestFingerprint,
                request.ConfirmationSha256);
            if (fingerprintError != null) return fingerprintError;
            var exact = string.Equals(GateDbString(row, "TransitionId"), request.TransitionId, StringComparison.Ordinal)
                        && string.Equals(GateDbString(row, "OsClient"), request.OsClient, StringComparison.Ordinal)
                        && string.Equals(DecodeApplicationStreamGateAuditText(
                            GateDbNullableString(row, "OsClientType")), request.OsClientType, StringComparison.Ordinal)
                        && string.Equals(DecodeApplicationStreamGateAuditText(
                            GateDbNullableString(row, "OsClientNetwork")), request.OsClientNetwork, StringComparison.Ordinal)
                        && string.Equals(GateDbString(row, "ExpectedMode"), request.ExpectedMode, StringComparison.Ordinal)
                        && GateDbInt(row, "ExpectedMinProtocol") == request.ExpectedMinProtocol
                        && GateDbLong(row, "ExpectedGateEpoch") == request.ExpectedGateEpoch
                        && string.Equals(GateDbString(row, "TargetMode"), request.TargetMode, StringComparison.Ordinal)
                        && GateDbInt(row, "TargetMinProtocol") == request.TargetMinProtocol
                        && GateDbLong(row, "ResultGateEpoch") == request.ResultGateEpoch
                        && string.Equals(GateDbNullableString(row, "DrainProofJson"), request.DrainProofJson, StringComparison.Ordinal)
                        && string.Equals(GateDbNullableString(row, "DrainProofSha256"), request.DrainProofHash, StringComparison.Ordinal)
                        && string.Equals(GateDbString(row, "OperatorUserId"), request.OperatorUserId, StringComparison.Ordinal)
                        && string.Equals(GateDbString(row, "Reason"), request.Reason, StringComparison.Ordinal);
            return exact ? null : "TransitionId 已存在，但持久化审计事实与本次请求不完全一致";
        }

        private static object BuildApplicationStreamGateTransitionResponse(
            NormalizedApplicationStreamGateTransition request,
            ApplicationStreamGateRow currentGate,
            JObject audit,
            bool dryRun,
            bool idempotent)
        {
            return new
            {
                DryRun = dryRun,
                Idempotent = idempotent,
                request.TransitionId,
                request.RequestFingerprint,
                request.ConfirmationSha256,
                Expected = new
                {
                    request.ExpectedMode,
                    request.ExpectedMinProtocol,
                    ExpectedGateEpoch = request.ExpectedGateEpoch.ToString(CultureInfo.InvariantCulture)
                },
                Target = new
                {
                    request.TargetMode,
                    request.TargetMinProtocol,
                    ResultGateEpoch = request.ResultGateEpoch.ToString(CultureInfo.InvariantCulture)
                },
                CurrentGate = BuildGateResponse(currentGate),
                DrainProofHash = request.DrainProofHash,
                DrainProofSemantics = request.TargetMode == "V3Only"
                    ? "外部逐节点排空证明；服务器仅校验规范 JSON 与 SHA-256 完整性，不生成、补全或宣称证明真实完备"
                    : null,
                Audited = audit != null
            };
        }

        private static object BuildGateResponse(ApplicationStreamGateRow row)
        {
            return row == null ? null : new
            {
                row.OsClient,
                row.OsClientType,
                row.OsClientNetwork,
                ApplicationStreamPublishMode = row.Mode,
                ApplicationStreamMinProtocol = row.MinProtocol,
                ApplicationStreamGateEpoch = row.GateEpoch.ToString(CultureInfo.InvariantCulture)
            };
        }

        private static string GateDbString(JObject row, string name)
        {
            var value = GateDbNullableString(row, name);
            if (value == null) throw new InvalidOperationException(name + " 数据库值不能为空");
            return value;
        }

        private static string EncodeApplicationStreamGateAuditText(string value)
        {
            return string.IsNullOrEmpty(value) ? ApplicationStreamGateAuditEmptyText : value;
        }

        private static string DecodeApplicationStreamGateAuditText(string value)
        {
            return value == null || string.Equals(value, ApplicationStreamGateAuditEmptyText, StringComparison.Ordinal)
                ? string.Empty
                : value;
        }

        private static string GateDbNullableString(JObject row, string name)
        {
            var token = row?.GetValue(name, StringComparison.OrdinalIgnoreCase);
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined) return null;
            return token.ToString();
        }

        private static int GateDbInt(JObject row, string name)
        {
            var raw = GateDbString(row, name);
            if (!int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value))
                throw new InvalidOperationException(name + " 数据库值不是 Int32");
            return value;
        }

        private static long GateDbLong(JObject row, string name)
        {
            var raw = GateDbString(row, name);
            if (!long.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var value))
                throw new InvalidOperationException(name + " 数据库值不是 Int64");
            return value;
        }
    }
}
