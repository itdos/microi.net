using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Dos.Common;
using Dos.ORM.SeedConversion;
using MySql.Data.MySqlClient;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 主库空数据库发布服务。
    ///
    /// 安全边界：调用方不能指定源库、目标库、临时目录或 HDFS 路径；脱敏 SQL 由内部接口引擎提供并在执行前校验。
    /// 任何脱敏前失败都会删除可能包含未脱敏数据的临时数据库。发布前会先在本地生成并校验全部数据库包；
    /// OSS 不支持跨对象事务，上传阶段失败时会返回已完成的文件清单，未上传文件保持线上上一版。
    /// </summary>
    public sealed class EmptyDatabaseReleaseService
    {
        public const string WorkerApiEngineKey = "admin_build_sanitized_empty_database";
        internal const string RequiredOsClient = "iTdos";
        internal const string RequiredSourceDatabase = "itdos";
        internal const string TargetDatabase = "microi_empty_temp";
        internal const string SqlFileName = DatabaseSeedConverter.MySql57SqlFileName;
        internal const string PublicObjectDirectory = "/install/";
        internal const string PublicDownloadBaseUrl = DatabaseSeedConverter.PublicReleaseBaseUrl;

        private readonly string _backgroundTaskId;

        public EmptyDatabaseReleaseService(string backgroundTaskId)
        {
            _backgroundTaskId = backgroundTaskId ?? "";
        }

        public DosResult Prepare(JObject currentUser, string osClient)
        {
            var permissionResult = ValidatePermission(currentUser, osClient);
            if (permissionResult.Code != 1)
            {
                return permissionResult;
            }

            MySqlConnectionStringBuilder sourceBuilder = null;
            try
            {
                Report(1, 8, "正在检查主库配置");
                sourceBuilder = BuildAndValidateSourceConnection();
                Report(2, 8, "正在重建临时空数据库");
                RecreateTargetDatabase(sourceBuilder);
                Report(3, 8, "正在复制主库全部表结构");
                var sourceTables = CopyTableStructures(sourceBuilder);
                if (sourceTables.Count == 0)
                {
                    throw new InvalidOperationException("主库未读取到任何数据表，已停止发布。");
                }

                Report(4, 8, "正在复制主库全部表数据");
                var copiedRows = CopyTableData(sourceBuilder, sourceTables);
                return new DosResult(1, new
                {
                    SourceTableCount = sourceTables.Count,
                    CopiedRowCount = copiedRows
                }, "主库结构和数据已复制到 microi_empty_temp。");
            }
            catch (Exception ex)
            {
                if (sourceBuilder != null)
                {
                    TryDropTargetDatabase(sourceBuilder);
                }
                Report(0, 8, "复制失败，已清理未完成的临时数据库");
                MicroiEngine.QueueSystemLog(osClient, "DatabaseRelease", "PrepareFailed", "准备主库空数据库失败", ex.ToString(), 3);
                return new DosResult(0, null, "准备主库空数据库失败，已清理临时数据库。错误：" + ex.Message);
            }
        }

        public DosResult ApplySanitization(JObject currentUser, string osClient, string sanitizationSql)
        {
            var permissionResult = ValidatePermission(currentUser, osClient);
            if (permissionResult.Code != 1)
            {
                return permissionResult;
            }

            MySqlConnectionStringBuilder sourceBuilder = null;
            try
            {
                sourceBuilder = BuildAndValidateSourceConnection();
                // Worker may be restarted after the sanitization committed but before
                // its checkpoint response was persisted. Recognize the fully sanitized
                // target and return success instead of re-running non-idempotent cleanup SQL.
                try
                {
                    var completedValidation = ValidateSanitizedDatabase(sourceBuilder);
                    return CreateSanitizationSuccess(completedValidation, true);
                }
                catch (InvalidOperationException)
                {
                    // Expected for a freshly copied or partially sanitized database.
                }
                ValidateSanitizationSql(sanitizationSql);
                Report(5, 8, "正在执行线上脱敏 SQL 接口引擎脚本");
                ExecuteSanitizationScript(sourceBuilder, sanitizationSql);
                var validation = ValidateSanitizedDatabase(sourceBuilder);
                return CreateSanitizationSuccess(validation, false);
            }
            catch (Exception ex)
            {
                if (sourceBuilder != null)
                {
                    TryDropTargetDatabase(sourceBuilder);
                }
                Report(0, 8, "脱敏失败，已删除可能含敏感数据的临时数据库");
                MicroiEngine.QueueSystemLog(osClient, "DatabaseRelease", "SanitizationFailed", "空数据库脱敏失败", ex.ToString(), 3);
                return new DosResult(0, null, "执行脱敏 SQL 失败，已删除临时数据库。错误：" + ex.Message);
            }
        }

        private static DosResult CreateSanitizationSuccess(
            SanitizationValidation validation,
            bool alreadySanitized)
        {
            return new DosResult(1, new
            {
                validation.RemainingNonTemplateUsers,
                validation.RemainingAppPhysicalTables,
                validation.RemainingApplicationPhysicalTables,
                validation.RemainingApplicationTableDefinitions,
                validation.RemainingApplicationFieldDefinitions,
                validation.RemainingAppApiEngines,
                validation.RemainingAppTableDefinitions,
                validation.RemainingAppFieldDefinitions,
                validation.RemainingAiStoreApps,
                validation.RemainingLegacyAiRows,
                validation.PlatformServiceCount,
                validation.PlatformServiceRuntimeCount,
                validation.PlatformServiceSourceFileCount,
                AlreadySanitized = alreadySanitized
            }, alreadySanitized
                ? "临时数据库已完成脱敏并通过校验，本片按持久化结果幂等续跑。"
                : "脱敏 SQL 已完整执行并通过零残留与平台应用保留校验。");
        }

        public DosResult Publish(JObject currentUser, string osClient)
        {
            var permissionResult = ValidatePermission(currentUser, osClient);
            if (permissionResult.Code != 1)
            {
                return permissionResult;
            }

            string workDirectory = null;
            var uploadedFiles = new List<string>();
            try
            {
                var sourceBuilder = BuildAndValidateSourceConnection();
                var validation = ValidateSanitizedDatabase(sourceBuilder);
                workDirectory = Path.Combine(Path.GetTempPath(), "microi-empty-release", Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(workDirectory);
                var sqlPath = Path.Combine(workDirectory, SqlFileName);

                Report(6, 8, "正在导出脱敏后的表结构和数据");
                var exportResult = ExportDatabase(sourceBuilder, sqlPath);
                Report(7, 8, "正在生成并校验全部数据库发布包");
                var packages = CreateReleasePackages(sqlPath, workDirectory, exportResult);
                for (var packageIndex = 0; packageIndex < packages.Count; packageIndex++)
                {
                    var package = packages[packageIndex];
                    var progress = 88 + Convert.ToInt32(Math.Floor(
                        packageIndex * 11m / Math.Max(1, packages.Count)));
                    BackgroundTaskRuntime.TryUpdateProgress(
                        _backgroundTaskId,
                        progress,
                        $"正在上传 {package.DatabaseName} 发布包（{packageIndex + 1}/{packages.Count}）",
                        packageIndex + 1,
                        packages.Count);
                    UploadPublicPackage(package.LocalZipPath, package.HdfsPath);
                    uploadedFiles.Add(package.FileName);
                }
                Report(8, 8, "全部数据库发布包上传完成");

                var primaryPackage = packages[0];

                return new DosResult(1, new
                {
                    DownloadUrl = primaryPackage.DownloadUrl,
                    FileName = primaryPackage.FileName,
                    HdfsPath = primaryPackage.HdfsPath,
                    Sha256 = primaryPackage.Sha256,
                    ZipSize = primaryPackage.ZipSize,
                    PublishedTableCount = exportResult.TableCount,
                    PublishedRowCount = exportResult.RowCount,
                    PublishedNonEmptyTableCount = exportResult.TableRowCounts.Count(item => item.Value > 0),
                    TableRowRanking = exportResult.TableRowCounts
                        .Where(item => item.Value > 0)
                        .OrderByDescending(item => item.Value)
                        .ThenBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                        .Select(item => new { TableName = item.Key, RowCount = item.Value })
                        .ToList(),
                    RemainingNonTemplateUsers = validation.RemainingNonTemplateUsers,
                    RemainingAppArtifacts = validation.RemainingAppArtifacts,
                    PlatformServiceCount = validation.PlatformServiceCount,
                    PackageCount = packages.Count,
                    Packages = packages.Select(package => new
                    {
                        package.DatabaseType,
                        package.DatabaseName,
                        package.FileName,
                        package.HdfsPath,
                        package.DownloadUrl,
                        package.Sha256,
                        package.ZipSize,
                        package.TableCount,
                        package.RowCount
                    }).ToList(),
                    CreateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                }, $"主库空数据库制作成功，已发布 {packages.Count} 个数据库 ZIP 包。");
            }
            catch (Exception ex)
            {
                Report(0, 8, "生成或上传数据库发布包失败");
                MicroiEngine.QueueSystemLog(osClient, "DatabaseRelease", "PublishFailed", "发布主库空数据库失败", ex.ToString(), 3);
                return new DosResult(0, new
                {
                    UploadedFiles = uploadedFiles
                }, "发布主库空数据库失败；已上传文件已列入 Data，未上传文件保持线上旧版。错误：" + ex.Message);
            }
            finally
            {
                if (!string.IsNullOrWhiteSpace(workDirectory))
                {
                    TryDeleteDirectory(workDirectory);
                }
            }
        }

        public DosResult Cleanup(JObject currentUser, string osClient)
        {
            var permissionResult = ValidatePermission(currentUser, osClient);
            if (permissionResult.Code != 1)
            {
                return permissionResult;
            }
            try
            {
                TryDropTargetDatabase(BuildAndValidateSourceConnection());
                return new DosResult(1, null, "临时空数据库已清理。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "清理临时空数据库失败：" + ex.Message);
            }
        }

        private static DosResult ValidatePermission(JObject currentUser, string osClient)
        {
            if (!string.Equals(osClient ?? "", RequiredOsClient, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(OsClientDefault.OsClient ?? "", RequiredOsClient, StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(0, null, "此能力仅允许在 iTdos 主租户执行。");
            }

            var userId = currentUser?["Id"]?.ToString();
            var levelText = currentUser?["Level"]?.ToString();
            int.TryParse(levelText, out var level);
            if (string.IsNullOrWhiteSpace(userId) || level < 9999)
            {
                return new DosResult(0, null, "仅 iTdos 超级管理员可制作主库空数据库。");
            }
            return new DosResult(1);
        }

        private static MySqlConnectionStringBuilder BuildAndValidateSourceConnection()
        {
            if (!string.Equals(OsClientDefault.OsClientDbType, "MySql", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("主库不是 MySql，已拒绝执行。");
            }

            var builder = BuildSourceConnectionStringBuilder(OsClientDefault.OsClientDbConn);
            if (!string.Equals(builder.Database, RequiredSourceDatabase, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("主库连接必须明确指向 itdos，已拒绝执行。");
            }
            return builder;
        }

        private static MySqlConnectionStringBuilder BuildSourceConnectionStringBuilder(string connectionString)
        {
            var normalized = Dos.ORM.ConnectionStringCompatibility.Normalize(
                Dos.ORM.DatabaseType.MySql,
                connectionString,
                OsClientDefault.MaxPoolSize,
                OsClientDefault.ConnectionLifetime,
                600);
            return new MySqlConnectionStringBuilder(normalized)
            {
                AllowUserVariables = true
            };
        }

        private static void ValidateSanitizationSql(string sql)
        {
            if (string.IsNullOrWhiteSpace(sql))
            {
                throw new InvalidOperationException("脱敏 SQL 接口引擎返回内容为空。");
            }
            if (Encoding.UTF8.GetByteCount(sql) > 2 * 1024 * 1024)
            {
                throw new InvalidOperationException("脱敏 SQL 超过 2MB 安全限制。");
            }
            // 只检查 SQL 语法本身，忽略注释和字符串内容，避免 URL、说明文字等误判。
            var sqlWithoutLiteralsAndComments = StripSqlLiteralsAndComments(sql);
            var forbidden = new[]
            {
                @"\bUSE\s+", @"\bCREATE\s+DATABASE\b", @"\bDROP\s+DATABASE\b",
                @"(?:`itdos`|\bitdos)\s*\."
            };
            foreach (var pattern in forbidden)
            {
                if (Regex.IsMatch(sqlWithoutLiteralsAndComments, pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
                {
                    throw new InvalidOperationException("脱敏 SQL 只能操作固定目标库，检测到禁止语句。");
                }
            }
        }

        private static string StripSqlLiteralsAndComments(string sql)
        {
            var result = new StringBuilder(sql.Length);
            var state = SqlScanState.Normal;
            for (var index = 0; index < sql.Length; index++)
            {
                var current = sql[index];
                var next = index + 1 < sql.Length ? sql[index + 1] : '\0';

                if (state == SqlScanState.Normal)
                {
                    if (current == '\'' || current == '"')
                    {
                        state = current == '\'' ? SqlScanState.SingleQuoted : SqlScanState.DoubleQuoted;
                        result.Append(' ');
                    }
                    else if (current == '#')
                    {
                        state = SqlScanState.LineComment;
                        result.Append(' ');
                    }
                    else if (current == '-' && next == '-'
                             && (index + 2 >= sql.Length || char.IsWhiteSpace(sql[index + 2])))
                    {
                        state = SqlScanState.LineComment;
                        result.Append("  ");
                        index++;
                    }
                    else if (current == '/' && next == '*')
                    {
                        state = SqlScanState.BlockComment;
                        result.Append("  ");
                        index++;
                    }
                    else
                    {
                        result.Append(current);
                    }
                    continue;
                }

                if (state == SqlScanState.LineComment)
                {
                    if (current == '\r' || current == '\n')
                    {
                        state = SqlScanState.Normal;
                        result.Append(current);
                    }
                    else
                    {
                        result.Append(' ');
                    }
                    continue;
                }

                if (state == SqlScanState.BlockComment)
                {
                    if (current == '*' && next == '/')
                    {
                        state = SqlScanState.Normal;
                        result.Append("  ");
                        index++;
                    }
                    else
                    {
                        result.Append(current == '\r' || current == '\n' ? current : ' ');
                    }
                    continue;
                }

                result.Append(current == '\r' || current == '\n' ? current : ' ');
                if (current == '\\' && index + 1 < sql.Length)
                {
                    result.Append(' ');
                    index++;
                    continue;
                }

                var quote = state == SqlScanState.SingleQuoted ? '\'' : '"';
                if (current != quote)
                {
                    continue;
                }
                if (next == quote)
                {
                    result.Append(' ');
                    index++;
                }
                else
                {
                    state = SqlScanState.Normal;
                }
            }
            return result.ToString();
        }

        private enum SqlScanState
        {
            Normal,
            SingleQuoted,
            DoubleQuoted,
            LineComment,
            BlockComment
        }

        private static void RecreateTargetDatabase(MySqlConnectionStringBuilder sourceBuilder)
        {
            var masterBuilder = new MySqlConnectionStringBuilder(sourceBuilder.ConnectionString)
            {
                Database = "",
                AllowUserVariables = true
            };
            using var connection = OpenConnection(masterBuilder);
            ExecuteNonQuery(connection, $"DROP DATABASE IF EXISTS `{TargetDatabase}`;");
            ExecuteNonQuery(connection, $"CREATE DATABASE `{TargetDatabase}` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;");
        }

        private static List<string> CopyTableStructures(MySqlConnectionStringBuilder sourceBuilder)
        {
            var tables = GetBaseTables(sourceBuilder, RequiredSourceDatabase);
            var targetBuilder = WithDatabase(sourceBuilder, TargetDatabase);
            using var source = OpenConnection(sourceBuilder);
            using var target = OpenConnection(targetBuilder);
            ExecuteNonQuery(target, "SET FOREIGN_KEY_CHECKS=0;");
            foreach (var table in tables)
            {
                var createSql = GetCreateTableSql(source, RequiredSourceDatabase, table);
                ExecuteNonQuery(target, createSql);
            }
            ExecuteNonQuery(target, "SET FOREIGN_KEY_CHECKS=1;");
            return tables;
        }

        private long CopyTableData(MySqlConnectionStringBuilder sourceBuilder, IReadOnlyCollection<string> tables)
        {
            var targetBuilder = WithDatabase(sourceBuilder, TargetDatabase);
            long copiedRows = 0;
            using var connection = OpenConnection(targetBuilder);
            ExecuteNonQuery(connection, "SET FOREIGN_KEY_CHECKS=0;");
            var index = 0;
            foreach (var table in tables)
            {
                index++;
                var columns = GetInsertableColumns(connection, RequiredSourceDatabase, table);
                if (columns.Count == 0)
                {
                    continue;
                }
                var fields = string.Join(",", columns.Select(QuoteIdentifier));
                using var command = connection.CreateCommand();
                command.CommandTimeout = 0;
                command.CommandText = $"INSERT INTO `{TargetDatabase}`.{QuoteIdentifier(table)} ({fields}) SELECT {fields} FROM `{RequiredSourceDatabase}`.{QuoteIdentifier(table)};";
                var affected = command.ExecuteNonQuery();
                if (affected > 0)
                {
                    copiedRows += affected;
                }
                if (index == tables.Count || index % 20 == 0)
                {
                    var percent = 38 + Convert.ToInt32(Math.Floor(index * 10m / Math.Max(1, tables.Count)));
                    BackgroundTaskRuntime.TryUpdateProgress(_backgroundTaskId, percent, $"正在复制表数据（{index}/{tables.Count}）", index, tables.Count);
                }
            }
            ExecuteNonQuery(connection, "SET FOREIGN_KEY_CHECKS=1;");
            return copiedRows;
        }

        private static void ExecuteSanitizationScript(MySqlConnectionStringBuilder sourceBuilder, string sql)
        {
            using var connection = OpenConnection(WithDatabase(sourceBuilder, TargetDatabase));
            var script = new MySqlScript(connection, sql);
            script.Execute();
        }

        private static SanitizationValidation ValidateSanitizedDatabase(MySqlConnectionStringBuilder sourceBuilder)
        {
            using var connection = OpenConnection(WithDatabase(sourceBuilder, TargetDatabase));
            var tables = GetBaseTables(connection, TargetDatabase);
            var removableApplicationTables = GetRemovableApplicationTableNames(sourceBuilder);
            var requiredTables = new[]
            {
                "sys_user", "sys_menu", "sys_apiengine", "diy_table", "diy_field", "sys_microistore"
            };
            var missing = requiredTables.Where(required => !tables.Contains(required, StringComparer.OrdinalIgnoreCase)).ToList();
            if (missing.Count > 0)
            {
                throw new InvalidOperationException("脱敏后缺少核心表：" + string.Join(",", missing));
            }

            var validation = new SanitizationValidation
            {
                RemainingNonTemplateUsers = ExecuteScalarCount(connection,
                    "SELECT COUNT(*) FROM `sys_user` WHERE LOWER(IFNULL(`Account`,'')) NOT IN ('admin','demo');"),
                RemainingAppPhysicalTables = ExecuteScalarCount(connection, @"
SELECT COUNT(*) FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_TYPE = 'BASE TABLE'
  AND LEFT(LOWER(TABLE_NAME), 4) = 'app_';"),
                RemainingApplicationPhysicalTables = tables.LongCount(removableApplicationTables.Contains),
                RemainingApplicationTableDefinitions = CountMatchingTableNames(
                    connection,
                    "SELECT `Name` FROM `diy_table`;",
                    removableApplicationTables),
                RemainingApplicationFieldDefinitions = CountMatchingTableNames(
                    connection,
                    "SELECT DISTINCT `TableName` FROM `diy_field` WHERE COALESCE(`TableName`, '') <> '';",
                    removableApplicationTables),
                RemainingAppApiEngines = ExecuteScalarCount(connection, @"
SELECT COUNT(*) FROM `sys_apiengine`
WHERE LEFT(LOWER(COALESCE(`ApiEngineKey`, '')), 4) = 'app_'
   OR LEFT(LOWER(COALESCE(`ApiName`, '')), 4) = 'app_';"),
                RemainingAppTableDefinitions = ExecuteScalarCount(connection, @"
SELECT COUNT(*) FROM `diy_table`
WHERE LEFT(LOWER(COALESCE(`Name`, '')), 4) = 'app_';"),
                RemainingAppFieldDefinitions = ExecuteScalarCount(connection, @"
SELECT COUNT(*) FROM `diy_field`
WHERE LEFT(LOWER(COALESCE(`TableName`, '')), 4) = 'app_';"),
                RemainingAiStoreApps = ExecuteScalarCount(connection, @"
SELECT COUNT(*) FROM `sys_microistore`
WHERE LOWER(COALESCE(`AppKey`, '')) <> 'microi-platform-service'
  AND UPPER(COALESCE(NULLIF(TRIM(`ApplicationType`), ''), NULLIF(TRIM(`AppType`), ''), '')) <> 'PLATFORM';"),
                PlatformServiceCount = ExecuteScalarCount(connection, @"
SELECT COUNT(*) FROM `sys_microistore`
WHERE `AppKey` = 'microi-platform-service';")
            };

            validation.RemainingLegacyAiRows =
                (tables.Contains("mci_ai_app", StringComparer.OrdinalIgnoreCase)
                    ? ExecuteScalarCount(connection, @"
SELECT COUNT(*) FROM `mci_ai_app`
WHERE LOWER(COALESCE(`AppKey`, '')) <> 'microi-platform-service';")
                    : 0)
                + (tables.Contains("mci_ai_app_file", StringComparer.OrdinalIgnoreCase)
                    ? ExecuteScalarCount(connection, @"
SELECT COUNT(*)
FROM `mci_ai_app_file` f
LEFT JOIN `sys_microistore` p
  ON (p.`Id` = f.`AppId` OR p.`AppKey` = f.`AppId`)
 AND LOWER(COALESCE(p.`AppKey`, '')) = 'microi-platform-service'
WHERE p.`Id` IS NULL;")
                    : 0)
                + (tables.Contains("mci_ai_app_version", StringComparer.OrdinalIgnoreCase)
                    ? ExecuteScalarCount(connection, @"
SELECT COUNT(*)
FROM `mci_ai_app_version` v
LEFT JOIN `sys_microistore` p
  ON (p.`Id` = v.`AppId` OR p.`AppKey` = v.`AppId`)
 AND LOWER(COALESCE(p.`AppKey`, '')) = 'microi-platform-service'
WHERE p.`Id` IS NULL;")
                    : 0)
                + (tables.Contains("mci_ai_project", StringComparer.OrdinalIgnoreCase)
                    ? ExecuteScalarCount(connection, "SELECT COUNT(*) FROM `mci_ai_project`;")
                    : 0)
                + (tables.Contains("mci_ai_project_file", StringComparer.OrdinalIgnoreCase)
                    ? ExecuteScalarCount(connection, "SELECT COUNT(*) FROM `mci_ai_project_file`;")
                    : 0);

            validation.PlatformServiceRuntimeCount = tables.Contains("sys_microiservice", StringComparer.OrdinalIgnoreCase)
                ? ExecuteScalarCount(connection, @"
SELECT COUNT(*) FROM `sys_microiservice`
WHERE LOWER(COALESCE(`MsKey`, '')) = 'microi-platform-service';")
                : 0;
            validation.PlatformServiceSourceFileCount = tables.Contains("mci_ai_app_file", StringComparer.OrdinalIgnoreCase)
                ? ExecuteScalarCount(connection, @"
SELECT COUNT(*)
FROM `mci_ai_app_file` f
JOIN `sys_microistore` p ON p.`Id` = f.`AppId` OR p.`AppKey` = f.`AppId`
WHERE LOWER(COALESCE(p.`AppKey`, '')) = 'microi-platform-service';")
                : 0;

            var violations = new List<string>();
            if (validation.RemainingNonTemplateUsers > 0)
            {
                violations.Add($"sys_user 非模板账号={validation.RemainingNonTemplateUsers}");
            }
            if (validation.RemainingAppPhysicalTables > 0)
            {
                violations.Add($"app_ 物理表={validation.RemainingAppPhysicalTables}");
            }
            if (validation.RemainingApplicationPhysicalTables > 0)
            {
                violations.Add($"应用包业务物理表={validation.RemainingApplicationPhysicalTables}");
            }
            if (validation.RemainingApplicationTableDefinitions > 0)
            {
                violations.Add($"应用包业务表定义={validation.RemainingApplicationTableDefinitions}");
            }
            if (validation.RemainingApplicationFieldDefinitions > 0)
            {
                violations.Add($"应用包业务字段定义={validation.RemainingApplicationFieldDefinitions}");
            }
            if (validation.RemainingAppApiEngines > 0)
            {
                violations.Add($"app_ 接口引擎={validation.RemainingAppApiEngines}");
            }
            if (validation.RemainingAppTableDefinitions > 0)
            {
                violations.Add($"app_ 表定义={validation.RemainingAppTableDefinitions}");
            }
            if (validation.RemainingAppFieldDefinitions > 0)
            {
                violations.Add($"app_ 字段定义={validation.RemainingAppFieldDefinitions}");
            }
            if (validation.RemainingAiStoreApps > 0)
            {
                violations.Add($"非平台应用商城记录={validation.RemainingAiStoreApps}");
            }
            if (validation.RemainingLegacyAiRows > 0)
            {
                violations.Add($"旧 AI 应用表记录={validation.RemainingLegacyAiRows}");
            }
            if (validation.PlatformServiceCount == 0)
            {
                violations.Add("官方 microi-platform-service 已被误删");
            }
            if (validation.PlatformServiceRuntimeCount == 0)
            {
                violations.Add("官方 microi-platform-service 运行时已被误删");
            }
            if (validation.PlatformServiceSourceFileCount == 0)
            {
                violations.Add("官方 microi-platform-service 源码已被误删");
            }
            if (violations.Count > 0)
            {
                throw new InvalidOperationException(
                    "脱敏发布门禁未通过：" + string.Join("；", violations) + "。");
            }
            return validation;
        }

        private static long ExecuteScalarCount(MySqlConnection connection, string sql)
        {
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            command.CommandTimeout = 0;
            return Convert.ToInt64(command.ExecuteScalar(), CultureInfo.InvariantCulture);
        }

        private static long CountMatchingTableNames(
            MySqlConnection connection,
            string sql,
            ISet<string> expectedNames)
        {
            long count = 0;
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            command.CommandTimeout = 0;
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                if (!reader.IsDBNull(0) && expectedNames.Contains(reader.GetString(0))) count++;
            }
            return count;
        }

        private static HashSet<string> GetRemovableApplicationTableNames(
            MySqlConnectionStringBuilder sourceBuilder)
        {
            using var connection = OpenConnection(sourceBuilder);
            var packageTablesByStoreId = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            var platformTables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var applicationTables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            using (var command = connection.CreateCommand())
            {
                command.CommandText = @"
SELECT `Id`, `AppKey`, `ApplicationType`, `AppType`, `AppPakcet`
FROM `sys_microistore`;";
                command.CommandTimeout = 0;
                using var reader = command.ExecuteReader();
                while (reader.Read())
                {
                    var storeId = reader.IsDBNull(0) ? "" : reader.GetString(0);
                    var appKey = reader.IsDBNull(1) ? "" : reader.GetString(1);
                    var applicationType = reader.IsDBNull(2) ? "" : reader.GetString(2);
                    var appType = reader.IsDBNull(3) ? "" : reader.GetString(3);
                    var packageText = reader.IsDBNull(4) ? "" : reader.GetString(4);
                    var tables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    if (!string.IsNullOrWhiteSpace(packageText))
                    {
                        try
                        {
                            CollectPackageTableNames(JToken.Parse(packageText), tables);
                        }
                        catch (Exception ex) when (ex is Newtonsoft.Json.JsonException || ex is FormatException)
                        {
                            throw new InvalidOperationException(
                                $"应用商城记录 {storeId} 的 AppPakcet 不是合法 JSON，无法安全判断空库清理范围。",
                                ex);
                        }
                    }
                    if (!string.IsNullOrWhiteSpace(storeId)) packageTablesByStoreId[storeId] = tables;
                    var isPlatform = string.Equals(appKey, "microi-platform-service", StringComparison.OrdinalIgnoreCase)
                                     || string.Equals(applicationType, "Platform", StringComparison.OrdinalIgnoreCase)
                                     || string.Equals(appType, "Platform", StringComparison.OrdinalIgnoreCase);
                    (isPlatform ? platformTables : applicationTables).UnionWith(tables);
                }
            }

            using (var command = connection.CreateCommand())
            {
                command.CommandText = @"
SELECT m.`StoreId`, COALESCE(NULLIF(m.`DiyTableName`, ''), t.`Name`) AS `TableName`
FROM `sys_menu` m
LEFT JOIN `diy_table` t ON t.`Id` = m.`DiyTableId`
WHERE COALESCE(m.`StoreId`, '') <> '';";
                command.CommandTimeout = 0;
                using var reader = command.ExecuteReader();
                while (reader.Read())
                {
                    var storeId = reader.IsDBNull(0) ? "" : reader.GetString(0);
                    var tableName = reader.IsDBNull(1) ? "" : reader.GetString(1);
                    if (packageTablesByStoreId.TryGetValue(storeId, out var tables))
                    {
                        AddSafeTableName(tables, tableName);
                    }
                }
            }

            // Menu-linked names are added after the first classification pass, so classify once more.
            using (var command = connection.CreateCommand())
            {
                command.CommandText = @"
SELECT `Id`, `AppKey`, `ApplicationType`, `AppType`
FROM `sys_microistore`;";
                command.CommandTimeout = 0;
                using var reader = command.ExecuteReader();
                while (reader.Read())
                {
                    var storeId = reader.IsDBNull(0) ? "" : reader.GetString(0);
                    if (!packageTablesByStoreId.TryGetValue(storeId, out var tables)) continue;
                    var appKey = reader.IsDBNull(1) ? "" : reader.GetString(1);
                    var applicationType = reader.IsDBNull(2) ? "" : reader.GetString(2);
                    var appType = reader.IsDBNull(3) ? "" : reader.GetString(3);
                    var isPlatform = string.Equals(appKey, "microi-platform-service", StringComparison.OrdinalIgnoreCase)
                                     || string.Equals(applicationType, "Platform", StringComparison.OrdinalIgnoreCase)
                                     || string.Equals(appType, "Platform", StringComparison.OrdinalIgnoreCase);
                    (isPlatform ? platformTables : applicationTables).UnionWith(tables);
                }
            }

            applicationTables.ExceptWith(platformTables);
            return applicationTables;
        }

        private static void CollectPackageTableNames(JToken token, ISet<string> tables)
        {
            if (token is JObject obj)
            {
                foreach (var property in obj.Properties())
                {
                    if (string.Equals(property.Name, "TableName", StringComparison.OrdinalIgnoreCase)
                        && property.Value.Type == JTokenType.String)
                    {
                        AddSafeTableName(tables, property.Value.ToString());
                    }
                    if (string.Equals(property.Name, "DiyTables", StringComparison.OrdinalIgnoreCase)
                        && property.Value is JArray diyTables)
                    {
                        foreach (var table in diyTables.OfType<JObject>())
                        {
                            AddSafeTableName(tables, table["Name"]?.ToString());
                        }
                    }
                    if (string.Equals(property.Name, "DDL", StringComparison.OrdinalIgnoreCase)
                        && property.Value.Type == JTokenType.String)
                    {
                        foreach (Match match in Regex.Matches(
                                     property.Value.ToString(),
                                     @"\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+[`""']?([A-Za-z0-9_]+)",
                                     RegexOptions.IgnoreCase | RegexOptions.CultureInvariant))
                        {
                            AddSafeTableName(tables, match.Groups[1].Value);
                        }
                    }
                    CollectPackageTableNames(property.Value, tables);
                }
                return;
            }
            if (token is JArray array)
            {
                foreach (var item in array) CollectPackageTableNames(item, tables);
            }
        }

        private static void AddSafeTableName(ISet<string> tables, string value)
        {
            var tableName = (value ?? "").Trim().Trim('`', '"');
            if (Regex.IsMatch(tableName, @"^[A-Za-z0-9_]+$", RegexOptions.CultureInvariant))
            {
                tables.Add(tableName);
            }
        }

        private ExportResult ExportDatabase(MySqlConnectionStringBuilder sourceBuilder, string sqlPath)
        {
            var targetBuilder = WithDatabase(sourceBuilder, TargetDatabase);
            using var connection = OpenConnection(targetBuilder);
            var tables = GetBaseTables(connection, TargetDatabase);
            long rowCount = 0;
            var tableRowCounts = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
            using var writer = new StreamWriter(sqlPath, false, new UTF8Encoding(false), 1024 * 1024);
            writer.WriteLine("-- Microi 吾码脱敏空数据库");
            writer.WriteLine("-- Generated: " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            writer.WriteLine("SET NAMES utf8mb4;");
            writer.WriteLine("SET FOREIGN_KEY_CHECKS=0;");
            writer.WriteLine();

            var index = 0;
            foreach (var table in tables)
            {
                index++;
                writer.WriteLine($"DROP TABLE IF EXISTS {QuoteIdentifier(table)};");
                writer.WriteLine(GetCreateTableSql(connection, TargetDatabase, table) + ";");
                writer.WriteLine();

                var columns = GetInsertableColumns(connection, TargetDatabase, table);
                if (columns.Count > 0)
                {
                    var columnDataTypes = GetColumnDataTypes(connection, TargetDatabase, table, columns);
                    var tableRowCount = ExportTableRows(connection, writer, table, columns, columnDataTypes);
                    rowCount += tableRowCount;
                    tableRowCounts[table] = tableRowCount;
                }
                else
                {
                    tableRowCounts[table] = 0;
                }
                if (index == tables.Count || index % 20 == 0)
                {
                    var percent = 63 + Convert.ToInt32(Math.Floor(index * 10m / Math.Max(1, tables.Count)));
                    BackgroundTaskRuntime.TryUpdateProgress(_backgroundTaskId, percent, $"正在导出数据库（{index}/{tables.Count}）", index, tables.Count);
                }
            }

            writer.WriteLine("SET FOREIGN_KEY_CHECKS=1;");
            writer.Flush();
            return new ExportResult
            {
                TableCount = tables.Count,
                RowCount = rowCount,
                TableRowCounts = tableRowCounts
            };
        }

        private static long ExportTableRows(MySqlConnection connection, TextWriter writer, string table,
            IReadOnlyList<string> columns, IReadOnlyList<string> columnDataTypes)
        {
            var fields = string.Join(",", columns.Select(QuoteIdentifier));
            var prefix = $"INSERT INTO {QuoteIdentifier(table)} ({fields}) VALUES\n";
            const int maxStatementChars = 1024 * 1024;
            long rows = 0;
            var batch = new StringBuilder(prefix, maxStatementChars + 1024);
            var hasRows = false;

            using var command = connection.CreateCommand();
            command.CommandTimeout = 0;
            command.CommandText = $"SELECT {fields} FROM {QuoteIdentifier(table)};";
            using var reader = command.ExecuteReader(CommandBehavior.SequentialAccess);
            while (reader.Read())
            {
                var values = new string[reader.FieldCount];
                for (var i = 0; i < reader.FieldCount; i++)
                {
                    values[i] = FormatSqlValue(reader.GetValue(i), columnDataTypes[i]);
                }
                var row = "(" + string.Join(",", values) + ")";
                if (hasRows && batch.Length + row.Length + 3 > maxStatementChars)
                {
                    batch.AppendLine(";");
                    writer.Write(batch.ToString());
                    batch.Clear();
                    batch.Append(prefix);
                    hasRows = false;
                }
                if (hasRows)
                {
                    batch.AppendLine(",");
                }
                batch.Append(row);
                hasRows = true;
                rows++;
            }
            if (hasRows)
            {
                batch.AppendLine(";");
                writer.Write(batch.ToString());
                writer.WriteLine();
            }
            return rows;
        }

        private static string FormatSqlValue(object value, string dataTypeName = null)
        {
            if (value == null || value == DBNull.Value) return "NULL";
            if (value is byte[] bytes) return "0x" + BitConverter.ToString(bytes).Replace("-", "");
            if (value is bool boolean) return boolean ? "1" : "0";
            if (value is DateTime dateTime) return "'" + dateTime.ToString("yyyy-MM-dd HH:mm:ss.ffffff", CultureInfo.InvariantCulture).TrimEnd('0').TrimEnd('.') + "'";
            // MySql.Data 在部分连接配置下会把 DATETIME/TIMESTAMP/DATE 读取为字符串，
            // 若直接导出会生成 05/12/2026 这类区域格式，严格模式下无法重新导入。
            var dateText = IsDateDataType(dataTypeName)
                ? Convert.ToString(value, CultureInfo.GetCultureInfo("en-US"))
                : null;
            if (dateText != null
                && DateTime.TryParse(dateText, CultureInfo.GetCultureInfo("en-US"), DateTimeStyles.AllowWhiteSpaces, out var parsedDate))
            {
                var format = string.Equals(dataTypeName, "DATE", StringComparison.OrdinalIgnoreCase)
                    ? "yyyy-MM-dd"
                    : "yyyy-MM-dd HH:mm:ss.ffffff";
                var formattedDate = parsedDate.ToString(format, CultureInfo.InvariantCulture);
                if (!string.Equals(dataTypeName, "DATE", StringComparison.OrdinalIgnoreCase))
                {
                    formattedDate = formattedDate.TrimEnd('0').TrimEnd('.');
                }
                return "'" + formattedDate + "'";
            }
            if (value is TimeSpan timeSpan) return "'" + timeSpan.ToString("c", CultureInfo.InvariantCulture) + "'";
            if (value is sbyte || value is byte || value is short || value is ushort
                || value is int || value is uint || value is long || value is ulong
                || value is decimal || value is double || value is float)
            {
                return Convert.ToString(value, CultureInfo.InvariantCulture);
            }
            return "'" + MySqlHelper.EscapeString(Convert.ToString(value, CultureInfo.InvariantCulture) ?? "") + "'";
        }

        private static bool IsDateDataType(string dataTypeName)
        {
            return string.Equals(dataTypeName, "DATE", StringComparison.OrdinalIgnoreCase)
                || string.Equals(dataTypeName, "DATETIME", StringComparison.OrdinalIgnoreCase)
                || string.Equals(dataTypeName, "TIMESTAMP", StringComparison.OrdinalIgnoreCase);
        }

        private IReadOnlyList<ReleasePackageArtifact> CreateReleasePackages(
            string mysqlSqlPath,
            string workDirectory,
            ExportResult exportResult)
        {
            var outputPaths = new Dictionary<SeedDatabaseTarget, string>();
            var writers = new Dictionary<SeedDatabaseTarget, TextWriter>();
            IReadOnlyList<SeedConversionResult> conversionResults;
            try
            {
                foreach (var target in DatabaseSeedConverter.SupportedTargets)
                {
                    var outputPath = Path.Combine(
                        workDirectory,
                        DatabaseSeedConverter.GetOutputFileName(target));
                    outputPaths.Add(target, outputPath);
                    writers.Add(target, new StreamWriter(
                        outputPath,
                        false,
                        new UTF8Encoding(false),
                        1024 * 1024));
                }

                using var source = new StreamReader(
                    mysqlSqlPath,
                    Encoding.UTF8,
                    true,
                    1024 * 1024);
                conversionResults = DatabaseSeedConverter.ConvertMySql57(source, writers);
            }
            finally
            {
                foreach (var writer in writers.Values)
                {
                    writer.Dispose();
                }
            }

            var conversionByTarget = conversionResults.ToDictionary(result => result.Target);
            foreach (var target in DatabaseSeedConverter.SupportedTargets)
            {
                var conversion = conversionByTarget[target];
                if (conversion.TableCount != exportResult.TableCount
                    || conversion.RowCount != exportResult.RowCount)
                {
                    throw new InvalidDataException(
                        DatabaseSeedConverter.GetDisplayName(target)
                        + " 转换结果与 MySQL 源数据计数不一致。"
                        + $"源={exportResult.TableCount}/{exportResult.RowCount}，"
                        + $"目标={conversion.TableCount}/{conversion.RowCount}。");
                }
            }

            var packages = new List<ReleasePackageArtifact>();
            foreach (var definition in DatabaseSeedConverter.SupportedReleasePackages)
            {
                var sqlPath = definition.ConversionTarget.HasValue
                    ? outputPaths[definition.ConversionTarget.Value]
                    : mysqlSqlPath;
                var zipPath = Path.Combine(workDirectory, definition.ZipFileName);
                CreateZip(
                    sqlPath,
                    zipPath,
                    definition.SqlFileName);
                var conversion = definition.ConversionTarget.HasValue
                    ? conversionByTarget[definition.ConversionTarget.Value]
                    : null;
                packages.Add(CreatePackageArtifact(
                    definition.DatabaseType,
                    definition.DisplayName,
                    zipPath,
                    definition.ZipFileName,
                    conversion?.TableCount ?? exportResult.TableCount,
                    conversion?.RowCount ?? exportResult.RowCount));
            }
            return packages.AsReadOnly();
        }

        private static ReleasePackageArtifact CreatePackageArtifact(
            string databaseType,
            string databaseName,
            string zipPath,
            string fileName,
            int tableCount,
            long rowCount)
        {
            return new ReleasePackageArtifact
            {
                DatabaseType = databaseType,
                DatabaseName = databaseName,
                LocalZipPath = zipPath,
                FileName = fileName,
                HdfsPath = PublicObjectDirectory + fileName,
                DownloadUrl = PublicDownloadBaseUrl + fileName,
                Sha256 = ComputeFileSha256(zipPath),
                ZipSize = new FileInfo(zipPath).Length,
                TableCount = tableCount,
                RowCount = rowCount
            };
        }

        private static void CreateZip(string sqlPath, string zipPath, string entryFileName)
        {
            using var output = new FileStream(zipPath, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None);
            using var archive = new ZipArchive(output, ZipArchiveMode.Create, false, new UTF8Encoding(false));
            var entry = archive.CreateEntry(entryFileName, CompressionLevel.Optimal);
            using var entryStream = entry.Open();
            using var input = new FileStream(sqlPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            input.CopyTo(entryStream);
        }

        private static void UploadPublicPackage(string zipPath, string objectPath)
        {
            var clientModel = OsClientExtend.GetClient(RequiredOsClient);
            if (clientModel == null)
            {
                throw new InvalidOperationException("未读取到 iTdos SaaS/HDFS 配置。");
            }
            var hdfs = clientModel.OsClientModel?["HDFS"]?.ToString();
            var hdfsClient = hdfs switch
            {
                "MinIO" => MicroiEngine.HDFSFactory(HDFSType.MinIO),
                "S3" => MicroiEngine.HDFSFactory(HDFSType.AmazonS3),
                _ => MicroiEngine.HDFSFactory(HDFSType.Aliyun)
            };
            using var stream = new FileStream(zipPath, FileMode.Open, FileAccess.Read, FileShare.Read);
            var result = hdfsClient.PutObject(new HDFSParam
            {
                ClientModel = clientModel,
                Limit = false,
                Preview = false,
                FileFullPath = objectPath,
                FileStream = stream
            }).GetAwaiter().GetResult();
            if (result == null || result.Code != 1)
            {
                throw new InvalidOperationException("上传空数据库发布包失败：" + (result?.Msg ?? "未知错误"));
            }
        }

        private static List<string> GetBaseTables(MySqlConnectionStringBuilder builder, string database)
        {
            using var connection = OpenConnection(builder);
            return GetBaseTables(connection, database);
        }

        private static List<string> GetBaseTables(MySqlConnection connection, string database)
        {
            var result = new List<string>();
            using var command = connection.CreateCommand();
            command.CommandText = @"SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA=@database AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;";
            command.Parameters.AddWithValue("@database", database);
            command.CommandTimeout = 0;
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                result.Add(reader.GetString(0));
            }
            return result;
        }

        private static List<string> GetInsertableColumns(MySqlConnection connection, string database, string table)
        {
            var result = new List<string>();
            using var command = connection.CreateCommand();
            command.CommandText = @"SELECT COLUMN_NAME FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@database AND TABLE_NAME=@table
  AND UPPER(IFNULL(EXTRA,'')) NOT LIKE '%GENERATED%'
ORDER BY ORDINAL_POSITION;";
            command.Parameters.AddWithValue("@database", database);
            command.Parameters.AddWithValue("@table", table);
            command.CommandTimeout = 0;
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                result.Add(reader.GetString(0));
            }
            return result;
        }

        private static List<string> GetColumnDataTypes(MySqlConnection connection, string database, string table,
            IReadOnlyList<string> columns)
        {
            var dataTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            using var command = connection.CreateCommand();
            command.CommandText = @"SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@database AND TABLE_NAME=@table;";
            command.Parameters.AddWithValue("@database", database);
            command.Parameters.AddWithValue("@table", table);
            command.CommandTimeout = 0;
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                dataTypes[reader.GetString(0)] = reader.GetString(1);
            }
            return columns.Select(column => dataTypes.TryGetValue(column, out var dataType) ? dataType : "")
                .ToList();
        }

        private static string GetCreateTableSql(MySqlConnection connection, string database, string table)
        {
            using var command = connection.CreateCommand();
            command.CommandText = $"SHOW CREATE TABLE `{database}`.{QuoteIdentifier(table)};";
            command.CommandTimeout = 0;
            using var reader = command.ExecuteReader();
            if (!reader.Read())
            {
                throw new InvalidOperationException("读取表结构失败：" + table);
            }
            return reader.GetString(1);
        }

        private static MySqlConnectionStringBuilder WithDatabase(MySqlConnectionStringBuilder source, string database)
        {
            return new MySqlConnectionStringBuilder(source.ConnectionString)
            {
                Database = database,
                AllowUserVariables = true
            };
        }

        private static MySqlConnection OpenConnection(MySqlConnectionStringBuilder builder)
        {
            var connection = new MySqlConnection(builder.ConnectionString);
            connection.Open();
            return connection;
        }

        private static int ExecuteNonQuery(MySqlConnection connection, string sql)
        {
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            command.CommandTimeout = 0;
            return command.ExecuteNonQuery();
        }

        private static string QuoteIdentifier(string value)
        {
            return "`" + (value ?? "").Replace("`", "``") + "`";
        }

        private static string ComputeFileSha256(string path)
        {
            using var stream = File.OpenRead(path);
            using var sha256 = SHA256.Create();
            return BitConverter.ToString(sha256.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
        }

        private static void TryDropTargetDatabase(MySqlConnectionStringBuilder sourceBuilder)
        {
            try
            {
                var master = new MySqlConnectionStringBuilder(sourceBuilder.ConnectionString) { Database = "" };
                using var connection = OpenConnection(master);
                ExecuteNonQuery(connection, $"DROP DATABASE IF EXISTS `{TargetDatabase}`;");
            }
            catch (Exception cleanupEx)
            {
                MicroiEngine.QueueSystemLog(OsClientDefault.OsClient, "DatabaseRelease", "TemporaryDatabaseCleanupFailed", "清理未脱敏临时数据库失败", cleanupEx.ToString(), 3);
            }
        }

        private static void TryDeleteDirectory(string path)
        {
            try
            {
                if (Directory.Exists(path)) Directory.Delete(path, true);
            }
            catch (Exception cleanupEx)
            {
                MicroiEngine.QueueSystemLog(OsClientDefault.OsClient, "DatabaseRelease", "TemporaryFileCleanupFailed", "清理空数据库临时文件失败", cleanupEx.ToString(), 2);
            }
        }

        private void Report(int current, int total, string message)
        {
            if (string.IsNullOrWhiteSpace(_backgroundTaskId)) return;
            var progress = current <= 0 ? 1 : Math.Min(99, Convert.ToInt32(Math.Floor(current * 100m / total)));
            BackgroundTaskRuntime.TryUpdateProgress(_backgroundTaskId, progress, message, Math.Max(0, current), total);
        }

        private sealed class ExportResult
        {
            public int TableCount { get; set; }
            public long RowCount { get; set; }
            public IReadOnlyDictionary<string, long> TableRowCounts { get; set; }
                = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        }

        private sealed class ReleasePackageArtifact
        {
            public string DatabaseType { get; set; }
            public string DatabaseName { get; set; }
            public string LocalZipPath { get; set; }
            public string FileName { get; set; }
            public string HdfsPath { get; set; }
            public string DownloadUrl { get; set; }
            public string Sha256 { get; set; }
            public long ZipSize { get; set; }
            public int TableCount { get; set; }
            public long RowCount { get; set; }
        }

        private sealed class SanitizationValidation
        {
            public long RemainingNonTemplateUsers { get; set; }
            public long RemainingAppPhysicalTables { get; set; }
            public long RemainingApplicationPhysicalTables { get; set; }
            public long RemainingApplicationTableDefinitions { get; set; }
            public long RemainingApplicationFieldDefinitions { get; set; }
            public long RemainingAppApiEngines { get; set; }
            public long RemainingAppTableDefinitions { get; set; }
            public long RemainingAppFieldDefinitions { get; set; }
            public long RemainingAiStoreApps { get; set; }
            public long RemainingLegacyAiRows { get; set; }
            public long PlatformServiceCount { get; set; }
            public long PlatformServiceRuntimeCount { get; set; }
            public long PlatformServiceSourceFileCount { get; set; }

            public long RemainingAppArtifacts =>
                RemainingApplicationPhysicalTables
                + RemainingAppApiEngines
                + RemainingApplicationTableDefinitions
                + RemainingApplicationFieldDefinitions
                + RemainingAiStoreApps
                + RemainingLegacyAiRows;
        }
    }
}
