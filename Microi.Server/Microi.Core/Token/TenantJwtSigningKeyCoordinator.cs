using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
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
        public List<string> UpdatedOsClients { get; set; } = new List<string>();
        public string Message { get; set; }
    }

    public static class TenantJwtSigningKeyCoordinator
    {
        private const int MaxConvergenceAttempts = 3;

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
                var tableName = $"{dbInfo.L}sys_osclients{dbInfo.R}";
                var totalUpdated = 0;
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
                            // 全部为弱密钥时，现有 EnsureStrongAuthSecret 会先为当前运行时
                            // 生成并持久化强密钥；启动后的第二道门禁会再收敛其它变体。
                            continue;
                        }

                        var canonicalSecret = ReadString(canonical, "AuthSecret").Trim();
                        var canonicalRotateVersion = ReadString(canonical, "AuthSecretRotateVersion");
                        foreach (var row in group)
                        {
                            var currentSecret = ReadString(row, "AuthSecret");
                            var currentRotateVersion = ReadString(row, "AuthSecretRotateVersion");
                            if (string.Equals(currentSecret, canonicalSecret, StringComparison.Ordinal)
                                && string.Equals(currentRotateVersion, canonicalRotateVersion, StringComparison.Ordinal))
                            {
                                continue;
                            }

                            var id = ReadString(row, "Id");
                            if (id.DosIsNullOrWhiteSpace())
                            {
                                continue;
                            }

                            var affected = configurationDb.FromSql($@"
UPDATE {tableName}
SET {dbInfo.L}AuthSecret{dbInfo.R}=@CanonicalSecret,
    {dbInfo.L}AuthSecretRotateVersion{dbInfo.R}=@CanonicalRotateVersion
WHERE {dbInfo.L}Id{dbInfo.R}=@Id
  AND COALESCE({dbInfo.L}AuthSecret{dbInfo.R}, '')=@ExpectedSecret
  AND COALESCE({dbInfo.L}AuthSecretRotateVersion{dbInfo.R}, '')=@ExpectedRotateVersion")
                                .AddInParameter("CanonicalSecret", DbType.String, canonicalSecret)
                                .AddInParameter("CanonicalRotateVersion", DbType.String, canonicalRotateVersion)
                                .AddInParameter("Id", DbType.String, id)
                                .AddInParameter("ExpectedSecret", DbType.String, currentSecret)
                                .AddInParameter("ExpectedRotateVersion", DbType.String, currentRotateVersion)
                                .ExecuteNonQuery();
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
                            updatedOsClients);
                    }
                }

                return Failed(
                    $"JWT 租户级签名密钥收敛超过 {MaxConvergenceAttempts} 次仍未通过，节点拒绝接收登录流量。",
                    null,
                    totalUpdated,
                    updatedOsClients);
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

        public static List<string> FindDivergentTenants(IEnumerable<JObject> rows)
        {
            return (rows ?? Enumerable.Empty<JObject>())
                .Where(row => row != null && !ReadString(row, "OsClient").DosIsNullOrWhiteSpace())
                .GroupBy(row => ReadString(row, "OsClient"), StringComparer.OrdinalIgnoreCase)
                .Where(group =>
                {
                    var strongRows = group.Where(row => !DiyToken.IsWeakJwtSecret(
                        ReadString(row, "AuthSecret"), group.Key)).ToList();
                    if (strongRows.Count == 0)
                    {
                        return false;
                    }
                    return group.Any(row => DiyToken.IsWeakJwtSecret(
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
            IEnumerable<string> updatedOsClients = null)
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
