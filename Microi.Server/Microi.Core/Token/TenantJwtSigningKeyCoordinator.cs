using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Security.Cryptography;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 同一 OsClient 可能同时存在 Product/Internal、Product/Internet 等运行时变体，
    /// 但 JWT 只携带 OsClient，不携带运行时变体。因此 AuthSecret 必须以租户为边界
    /// 保持唯一；否则部署切换运行时变体后，仍在有效期内的 Token 会立即签名失效。
    /// </summary>
    public sealed class TenantJwtSigningKeyConvergenceResult
    {
        public bool Success { get; set; }
        public int TenantCount { get; set; }
        public int VariantCount { get; set; }
        public int UpdatedRowCount { get; set; }
        public int GeneratedSecretCount { get; set; }
        public bool SchemaUpdated { get; set; }
        public List<string> UpdatedOsClients { get; set; } = new List<string>();
        public string Message { get; set; }
    }

    public static class TenantJwtSigningKeyCoordinator
    {
        private const int MaxConvergenceAttempts = 3;
        private const int AuthSecretStorageLength = 100;
        private const string OsClientTableName = "sys_osclients";
        private const string AuthSecretFieldName = "AuthSecret";
        private const string AuthSecretRotateVersionFieldName = "AuthSecretRotateVersion";

        /// <summary>
        /// 在配置库中收敛所有有效租户运行时变体的 JWT 密钥。
        /// 更新使用旧值条件作为 CAS；若并发轮换发生，会复读并按新快照重试。
        /// </summary>
        public static TenantJwtSigningKeyConvergenceResult Converge(
            DbSession configurationDb,
            string databaseType)
        {
            if (configurationDb == null)
            {
                return Failed("JWT 租户级签名密钥收敛失败：配置数据库会话为空。");
            }

            try
            {
                var dbInfo = DiyCommon.GetDbInfo(databaseType);
                var tableName = $"{dbInfo.L}{OsClientTableName}{dbInfo.R}";
                var schemaUpdated = EnsureAuthSecretStorage(configurationDb, dbInfo);
                var totalUpdated = 0;
                var generatedSecretCount = 0;
                var updatedOsClients = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                for (var attempt = 1; attempt <= MaxConvergenceAttempts; attempt++)
                {
                    var rows = ReadActiveRows(configurationDb, tableName);
                    var groups = rows
                        .Where(row => !ReadString(row, "OsClient").DosIsNullOrWhiteSpace())
                        .GroupBy(row => ReadString(row, "OsClient"), StringComparer.OrdinalIgnoreCase)
                        .ToList();
                    var changedThisAttempt = 0;

                    foreach (var group in groups)
                    {
                        var canonical = SelectCanonicalRow(group);
                        if (canonical == null)
                        {
                            // 旧库可能没有 AuthSecret，或同一租户的所有运行时变体都为空/过短。
                            // 先只对稳定锚点行做一次 CAS 写入；下一轮再以该行作为 canonical
                            // 收敛其它变体。多节点同时启动时只有一个随机值能够写入锚点，
                            // 失败节点复读后会跟随胜出的数据库值，不会产生进程临时密钥漂移。
                            var bootstrapRow = SelectBootstrapRow(group);
                            if (bootstrapRow == null)
                            {
                                continue;
                            }

                            var bootstrapSecret = GenerateStrongAuthSecret();
                            var bootstrapRotateVersion = ReadString(
                                bootstrapRow,
                                AuthSecretRotateVersionFieldName);
                            var bootstrapAffected = UpdateRow(
                                configurationDb,
                                tableName,
                                dbInfo,
                                bootstrapRow,
                                bootstrapSecret,
                                bootstrapRotateVersion);
                            if (bootstrapAffected > 0)
                            {
                                changedThisAttempt += bootstrapAffected;
                                totalUpdated += bootstrapAffected;
                                generatedSecretCount++;
                                updatedOsClients.Add(group.Key);
                            }
                            continue;
                        }

                        var canonicalSecret = ReadString(canonical, AuthSecretFieldName).Trim();
                        var canonicalRotateVersion = ReadString(
                            canonical,
                            AuthSecretRotateVersionFieldName);
                        foreach (var row in group)
                        {
                            var currentSecret = ReadString(row, AuthSecretFieldName);
                            var currentRotateVersion = ReadString(
                                row,
                                AuthSecretRotateVersionFieldName);
                            if (string.Equals(currentSecret, canonicalSecret, StringComparison.Ordinal)
                                && string.Equals(currentRotateVersion, canonicalRotateVersion, StringComparison.Ordinal))
                            {
                                continue;
                            }

                            var affected = UpdateRow(
                                configurationDb,
                                tableName,
                                dbInfo,
                                row,
                                canonicalSecret,
                                canonicalRotateVersion);
                            if (affected > 0)
                            {
                                changedThisAttempt += affected;
                                totalUpdated += affected;
                                updatedOsClients.Add(group.Key);
                            }
                        }
                    }

                    var verificationRows = ReadActiveRows(configurationDb, tableName);
                    var divergentTenants = FindDivergentTenants(verificationRows);
                    if (divergentTenants.Count == 0)
                    {
                        return new TenantJwtSigningKeyConvergenceResult
                        {
                            Success = true,
                            TenantCount = verificationRows
                                .Select(row => ReadString(row, "OsClient"))
                                .Where(value => !value.DosIsNullOrWhiteSpace())
                                .Distinct(StringComparer.OrdinalIgnoreCase)
                                .Count(),
                            VariantCount = verificationRows.Count,
                            UpdatedRowCount = totalUpdated,
                            GeneratedSecretCount = generatedSecretCount,
                            SchemaUpdated = schemaUpdated,
                            UpdatedOsClients = updatedOsClients.OrderBy(value => value).ToList(),
                            Message = totalUpdated == 0
                                ? "JWT 租户级签名密钥一致性门禁通过。"
                                : $"JWT 租户级签名密钥已收敛，更新 {totalUpdated} 条运行时变体。"
                        };
                    }

                    if (changedThisAttempt == 0 && attempt == MaxConvergenceAttempts)
                    {
                        return Failed(
                            $"JWT 租户级签名密钥仍有 {divergentTenants.Count} 个租户不一致；已重试 {MaxConvergenceAttempts} 次，节点拒绝接收登录流量。",
                            verificationRows,
                            totalUpdated,
                            updatedOsClients,
                            generatedSecretCount,
                            schemaUpdated);
                    }
                }

                return Failed(
                    $"JWT 租户级签名密钥收敛超过 {MaxConvergenceAttempts} 次仍未通过，节点拒绝接收登录流量。",
                    null,
                    totalUpdated,
                    updatedOsClients,
                    generatedSecretCount,
                    schemaUpdated);
            }
            catch (Exception ex)
            {
                return Failed("JWT 租户级签名密钥收敛异常：" + ex.Message);
            }
        }

        /// <summary>
        /// 纯函数，供启动门禁与单元测试共用。显式轮换版本不同则选择最近更新的
        /// 已轮换强密钥；否则选择最早创建的强密钥，保证普通部署不会隐式换钥。
        /// </summary>
        public static JObject SelectCanonicalRow(IEnumerable<JObject> rows)
        {
            var strongRows = (rows ?? Enumerable.Empty<JObject>())
                .Where(row => row != null)
                .Where(row => !DiyToken.IsWeakJwtSecret(
                    ReadString(row, "AuthSecret"),
                    ReadString(row, "OsClient")))
                .ToList();
            if (strongRows.Count == 0)
            {
                return null;
            }

            var nonEmptyRotateVersions = strongRows
                .Select(row => ReadString(row, "AuthSecretRotateVersion"))
                .Where(value => !value.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.Ordinal)
                .ToList();

            if (nonEmptyRotateVersions.Count > 1)
            {
                return strongRows
                    .Where(row => !ReadString(row, "AuthSecretRotateVersion").DosIsNullOrWhiteSpace())
                    .OrderByDescending(row => ReadDateTime(row, "UpdateTime", DateTime.MinValue))
                    .ThenBy(row => ReadString(row, "Id"), StringComparer.Ordinal)
                    .First();
            }

            if (nonEmptyRotateVersions.Count == 1)
            {
                strongRows = strongRows
                    .Where(row => string.Equals(
                        ReadString(row, "AuthSecretRotateVersion"),
                        nonEmptyRotateVersions[0],
                        StringComparison.Ordinal))
                    .ToList();
            }

            return strongRows
                .OrderBy(row => ReadDateTime(row, "CreateTime", DateTime.MaxValue))
                .ThenBy(row => ReadString(row, "Id"), StringComparer.Ordinal)
                .First();
        }

        /// <summary>
        /// 全部为弱密钥时选择唯一、稳定的启动锚点。锚点只决定哪个数据库行先完成
        /// CAS，不参与密钥计算；真正的密钥仍由密码学安全随机数生成并持久化。
        /// </summary>
        internal static JObject SelectBootstrapRow(IEnumerable<JObject> rows)
        {
            return (rows ?? Enumerable.Empty<JObject>())
                .Where(row => row != null && !ReadString(row, "Id").DosIsNullOrWhiteSpace())
                .OrderBy(row => ReadDateTime(row, "CreateTime", DateTime.MaxValue))
                .ThenBy(row => ReadString(row, "Id"), StringComparer.Ordinal)
                .FirstOrDefault();
        }

        /// <summary>
        /// 与一键安装器保持同一固定安全规则：24 字节 CSPRNG，编码为 48 位十六进制，
        /// 既满足 JWT 最少 32 字符要求，也兼容历史 varchar(50) AuthSecret 列。
        /// </summary>
        public static string GenerateStrongAuthSecret()
        {
            var bytes = new byte[24];
            using (var random = RandomNumberGenerator.Create())
            {
                random.GetBytes(bytes);
            }
            return BitConverter.ToString(bytes).Replace("-", string.Empty).ToLowerInvariant();
        }

        public static List<string> FindDivergentTenants(IEnumerable<JObject> rows)
        {
            return (rows ?? Enumerable.Empty<JObject>())
                .Where(row => row != null && !ReadString(row, "OsClient").DosIsNullOrWhiteSpace())
                .GroupBy(row => ReadString(row, "OsClient"), StringComparer.OrdinalIgnoreCase)
                .Where(group =>
                {
                    var groupRows = group.ToList();
                    var strongRows = groupRows.Where(row => !DiyToken.IsWeakJwtSecret(
                        ReadString(row, "AuthSecret"), group.Key)).ToList();
                    if (strongRows.Count == 0)
                    {
                        // 所有变体都为弱密钥也是待修复状态，不能被误判为“一致”。
                        return groupRows.Count > 0;
                    }
                    return groupRows.Any(row => DiyToken.IsWeakJwtSecret(
                               ReadString(row, "AuthSecret"), group.Key))
                           || strongRows.Select(row => ReadString(row, "AuthSecret"))
                               .Distinct(StringComparer.Ordinal).Count() > 1
                           || strongRows.Select(row => ReadString(row, "AuthSecretRotateVersion"))
                               .Distinct(StringComparer.Ordinal).Count() > 1;
                })
                .Select(group => group.Key)
                .OrderBy(value => value)
                .ToList();
        }

        private static int UpdateRow(
            DbSession configurationDb,
            string tableName,
            DbInfo dbInfo,
            JObject row,
            string canonicalSecret,
            string canonicalRotateVersion)
        {
            var id = ReadString(row, "Id");
            if (id.DosIsNullOrWhiteSpace())
            {
                return 0;
            }

            var currentSecret = ReadString(row, AuthSecretFieldName);
            var currentRotateVersion = ReadString(row, AuthSecretRotateVersionFieldName);
            return configurationDb.FromSql($@"
UPDATE {tableName}
SET {dbInfo.L}{AuthSecretFieldName}{dbInfo.R}=@CanonicalSecret,
    {dbInfo.L}{AuthSecretRotateVersionFieldName}{dbInfo.R}=@CanonicalRotateVersion
WHERE {dbInfo.L}Id{dbInfo.R}=@Id
  AND COALESCE({dbInfo.L}{AuthSecretFieldName}{dbInfo.R}, '')=@ExpectedSecret
  AND COALESCE({dbInfo.L}{AuthSecretRotateVersionFieldName}{dbInfo.R}, '')=@ExpectedRotateVersion")
                .AddInParameter("CanonicalSecret", DbType.String, canonicalSecret)
                .AddInParameter("CanonicalRotateVersion", DbType.String, canonicalRotateVersion)
                .AddInParameter("Id", DbType.String, id)
                .AddInParameter("ExpectedSecret", DbType.String, currentSecret)
                .AddInParameter("ExpectedRotateVersion", DbType.String, currentRotateVersion)
                .ExecuteNonQuery();
        }

        /// <summary>
        /// AuthSecret 属于认证管线启动前必须具备的物理兼容字段，不能等待异步升级器。
        /// 使用 Dos.ORM 的数据库方言服务幂等建列/扩容，并在每一步后重新读取元数据。
        /// </summary>
        private static bool EnsureAuthSecretStorage(DbSession configurationDb, DbInfo dbInfo)
        {
            // SqlServer9 与 SqlServer 共用相同 DDL 方言；IDbFactory 不单独注册
            // SqlServer9 服务，但配置库会话本身仍保留它的旧版 Provider。
            var ddlDatabaseType = dbInfo.DbType == DatabaseType.SqlServer9
                ? DatabaseType.SqlServer
                : dbInfo.DbType;
            var orm = MicroiEngine.ORM(ddlDatabaseType);
            var columns = ReadColumns(orm, configurationDb);
            var changed = false;

            changed |= EnsureStringColumn(
                orm,
                configurationDb,
                columns,
                AuthSecretFieldName,
                AuthSecretStorageLength);
            columns = ReadColumns(orm, configurationDb);
            changed |= EnsureStringColumn(
                orm,
                configurationDb,
                columns,
                AuthSecretRotateVersionFieldName,
                AuthSecretStorageLength);

            // 最终回读是启动安全边界：建列调用返回成功不等于物理结构已经可用。
            columns = ReadColumns(orm, configurationDb);
            foreach (var fieldName in new[] { AuthSecretFieldName, AuthSecretRotateVersionFieldName })
            {
                var column = FindColumn(columns, fieldName);
                if (column == null)
                {
                    throw new InvalidOperationException(
                        $"旧库兼容修复后仍未读取到 {OsClientTableName}.{fieldName}。请检查主库 DDL 权限和数据库方言配置。");
                }
                if (!IsStringColumnType(column.data_type)
                    || (column.character_maximum_length.HasValue
                        && column.character_maximum_length.Value > 0
                        && column.character_maximum_length.Value < AuthSecretStorageLength))
                {
                    throw new InvalidOperationException(
                        $"旧库兼容修复后 {OsClientTableName}.{fieldName} 类型/长度仍不符合 varchar({AuthSecretStorageLength}) 兼容要求。");
                }
            }

            return changed;
        }

        private static bool EnsureStringColumn(
            IMicroiORM orm,
            DbSession configurationDb,
            IReadOnlyCollection<information_schema_columns> columns,
            string fieldName,
            int length)
        {
            var existing = FindColumn(columns, fieldName);
            if (existing == null)
            {
                DosResult addResult = null;
                string addError = null;
                try
                {
                    addResult = orm.AddColumn(new DbServiceParam
                    {
                        OsClient = OsClientDefault.OsClient,
                        DbSession = configurationDb,
                        TableName = OsClientTableName,
                        FieldName = fieldName,
                        FieldType = $"varchar({length})",
                        FieldNotNull = false,
                        FieldLabel = fieldName == AuthSecretFieldName ? "JWT签名密钥" : "JWT密钥轮换版本"
                    });
                }
                catch (Exception ex)
                {
                    // 另一节点可能已经并发完成 DDL。最终结果只以数据库回读为准。
                    addError = ex.Message;
                }
                var readback = FindColumn(ReadColumns(orm, configurationDb), fieldName);
                if (readback == null)
                {
                    throw new InvalidOperationException(
                        $"补齐旧库字段 {OsClientTableName}.{fieldName} 失败：{addResult?.Msg ?? addError}");
                }
                return true;
            }

            var typeNeedsRepair = !IsStringColumnType(existing.data_type);
            var capacityNeedsRepair = existing.character_maximum_length.HasValue
                                      && existing.character_maximum_length.Value > 0
                                      && existing.character_maximum_length.Value < length;
            if (!typeNeedsRepair && !capacityNeedsRepair)
            {
                return false;
            }

            DosResult changeResult = null;
            string changeError = null;
            try
            {
                changeResult = orm.ChangeColumn(new DbServiceParam
                {
                    OsClient = OsClientDefault.OsClient,
                    DbSession = configurationDb,
                    TableName = OsClientTableName,
                    FieldName = fieldName,
                    NewFieldName = fieldName,
                    FieldType = $"varchar({length})",
                    FieldNotNull = false,
                    FieldLabel = existing.column_comment
                });
            }
            catch (Exception ex)
            {
                changeError = ex.Message;
            }
            var changedColumn = FindColumn(ReadColumns(orm, configurationDb), fieldName);
            if (changedColumn == null
                || !IsStringColumnType(changedColumn.data_type)
                || (changedColumn.character_maximum_length.HasValue
                    && changedColumn.character_maximum_length.Value > 0
                    && changedColumn.character_maximum_length.Value < length))
            {
                throw new InvalidOperationException(
                    $"扩容旧库字段 {OsClientTableName}.{fieldName} 失败：{changeResult?.Msg ?? changeError}");
            }
            return true;
        }

        internal static bool IsStringColumnType(string dataType)
        {
            var normalized = (dataType ?? string.Empty).Trim().ToLowerInvariant();
            return normalized.Contains("char")
                   || normalized.Contains("text")
                   || normalized.Contains("clob")
                   || normalized == "string";
        }

        private static List<information_schema_columns> ReadColumns(
            IMicroiORM orm,
            DbSession configurationDb)
        {
            var result = orm.GetColumns(new DbServiceParam
            {
                OsClient = OsClientDefault.OsClient,
                DbSession = configurationDb,
                TableName = OsClientTableName
            });
            if (result == null || result.Code != 1 || result.Data == null)
            {
                throw new InvalidOperationException(
                    $"读取 {OsClientTableName} 物理字段失败：{result?.Msg}");
            }
            return result.Data;
        }

        private static information_schema_columns FindColumn(
            IEnumerable<information_schema_columns> columns,
            string fieldName)
        {
            return (columns ?? Enumerable.Empty<information_schema_columns>())
                .FirstOrDefault(column => string.Equals(
                    column?.column_name,
                    fieldName,
                    StringComparison.OrdinalIgnoreCase));
        }

        private static List<JObject> ReadActiveRows(DbSession configurationDb, string tableName)
        {
            var rows = configurationDb.FromSql($@"
SELECT Id, OsClient, AuthSecret, AuthSecretRotateVersion,
       OsClientType, OsClientNetwork, CreateTime, UpdateTime
FROM {tableName}
WHERE IsDeleted=0 AND IsEnable=1")
                .ToList<dynamic>();
            return rows.Select(JObject.FromObject).ToList();
        }

        private static TenantJwtSigningKeyConvergenceResult Failed(
            string message,
            IReadOnlyCollection<JObject> rows = null,
            int updatedRowCount = 0,
            IEnumerable<string> updatedOsClients = null,
            int generatedSecretCount = 0,
            bool schemaUpdated = false)
        {
            var rowList = rows?.ToList() ?? new List<JObject>();
            return new TenantJwtSigningKeyConvergenceResult
            {
                Success = false,
                TenantCount = rowList.Select(row => ReadString(row, "OsClient"))
                    .Where(value => !value.DosIsNullOrWhiteSpace())
                    .Distinct(StringComparer.OrdinalIgnoreCase).Count(),
                VariantCount = rowList.Count,
                UpdatedRowCount = updatedRowCount,
                GeneratedSecretCount = generatedSecretCount,
                SchemaUpdated = schemaUpdated,
                UpdatedOsClients = (updatedOsClients ?? Enumerable.Empty<string>())
                    .Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(value => value).ToList(),
                Message = message
            };
        }

        private static string ReadString(JObject row, string fieldName)
        {
            return row?.GetValue(fieldName, StringComparison.OrdinalIgnoreCase)?.Val<string>() ?? string.Empty;
        }

        private static DateTime ReadDateTime(JObject row, string fieldName, DateTime fallback)
        {
            var token = row?.GetValue(fieldName, StringComparison.OrdinalIgnoreCase);
            if (token == null || token.Type == JTokenType.Null)
            {
                return fallback;
            }
            if (token.Type == JTokenType.Date)
            {
                return token.Val<DateTime>();
            }
            return DateTime.TryParse(token.Val<string>(), out var value) ? value : fallback;
        }
    }
}
