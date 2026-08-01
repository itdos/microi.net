using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using MySql.Data.MySqlClient;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// 当前后端运行环境主租户的 SaaS MySQL 在线备份服务。
    ///
    /// 设计约束：全部数据库串行导出；Redis 租约跨节点互斥且可续租；每个数据库使用
    /// REPEATABLE READ 一致性快照，不加全局读锁；压缩使用 Fastest 并按行节流；
    /// HDFS 只写私有对象。任务结果不返回 HDFS 路径或下载地址。
    /// </summary>
    public sealed class DatabaseBackupService
    {
        public const string WorkerApiEngineKey = "database-backup-worker";
        public const string SchedulerApiEngineKey = "database-backup-scheduler";
        public const string ScheduledJobId = "microiDatabaseBackupScheduler";
        public const string ScheduledJobRecordId = "01KXZSKQYCB2N9QGWEACYT20ZS";
        private const string RecordTable = "mci_database_backup";
        private const int MaxLogChars = 120000;
        private const int ThrottleRows = 200;
        private const int ThrottleDelayMilliseconds = 15;
        private readonly string _backgroundTaskId;
        private readonly long _backgroundTaskFencingToken;
        private readonly StringBuilder _log = new StringBuilder();
        private string _recordId;
        private string _attemptHdfsPath;
        private bool _attemptCommitted;
        private int _lastProgress;
        private int _totalDatabases;
        private int _completedDatabases;
        private int _successCount;
        private int _failedCount;

        public DatabaseBackupService(string backgroundTaskId)
            : this(backgroundTaskId, 0)
        {
        }

        public DatabaseBackupService(string backgroundTaskId, long backgroundTaskFencingToken)
        {
            _backgroundTaskId = backgroundTaskId ?? "";
            _backgroundTaskFencingToken = Math.Max(0, backgroundTaskFencingToken);
            _recordId = BuildStableRecordId(_backgroundTaskId);
        }

        public DosResult Run(JObject currentUser, string osClient, string triggerType, int retainCount)
        {
            return Run(currentUser, osClient, triggerType, retainCount, null);
        }

        public DosResult Run(
            JObject currentUser,
            string osClient,
            string triggerType,
            int retainCount,
            IReadOnlyCollection<string> selectedOsClients)
        {
            _lastProgress = 0;
            _totalDatabases = 0;
            _completedDatabases = 0;
            _successCount = 0;
            _failedCount = 0;
            var permission = ValidatePermission(currentUser, osClient);
            if (permission.Code != 1) return permission;
            if (string.IsNullOrWhiteSpace(_backgroundTaskId) || _backgroundTaskFencingToken <= 0)
                return new DosResult(0, null, "数据库备份必须由带 fencing token 的持久后台任务执行。");

            retainCount = Math.Max(1, Math.Min(100, retainCount <= 0 ? 7 : retainCount));
            triggerType = string.Equals(triggerType, "Scheduled", StringComparison.OrdinalIgnoreCase)
                ? "Scheduled"
                : "Manual";
            var userId = currentUser?["Id"]?.ToString() ?? "";
            var userName = currentUser?["Name"]?.ToString()
                           ?? currentUser?["Account"]?.ToString()
                           ?? "系统管理员";
            var backupNo = "DBBK-" + _recordId.ToUpperInvariant();
            string workDirectory = null;
            DistributedBackupLease lease = null;

            try
            {
                var completed = ClaimQueuedRecord(backupNo, triggerType, userId, userName, selectedOsClients);
                if (completed != null)
                {
                    return completed.ToResult(_recordId);
                }
                AppendLog("任务已进入全局串行队列，等待上一个数据库备份完成。", "Queued", 2);
                Report(2, "排队中：等待上一个数据库备份完成", 0, 0);

                lease = DistributedBackupLease.Acquire(
                    osClient,
                    () =>
                    {
                        ThrowIfCancellationRequested();
                        UpdateRecord(new Dictionary<string, object>
                        {
                            ["Status"] = "Queued",
                            ["Progress"] = 2,
                            ["LeaseExpiresAt"] = DateTime.Now.AddSeconds(90).ToString("yyyy-MM-dd HH:mm:ss")
                        });
                        Report(2, "排队中：其它节点正在执行数据库备份", 0, 0);
                    },
                    () => BackgroundTaskRuntime.IsCancellationRequested(_backgroundTaskId));

                UpdateRecord(new Dictionary<string, object>
                {
                    ["Status"] = "Running",
                    ["Progress"] = 5,
                    ["StartedAt"] = NowText(),
                    ["LeaseOwner"] = lease.Owner,
                    ["LeaseExpiresAt"] = DateTime.Now.AddSeconds(90).ToString("yyyy-MM-dd HH:mm:ss")
                });
                AppendLog("已取得跨节点备份租约；开始盘点启用的 SaaS MySQL 数据库。", "Running", 5);

                var databases = SnapshotDatabases(selectedOsClients);
                if (databases.Count == 0)
                {
                    throw new InvalidOperationException("未发现可备份的已启用 SaaS MySQL 数据库。");
                }
                _totalDatabases = databases.Count;
                UpdateRecord(new Dictionary<string, object> { ["TotalDatabases"] = databases.Count });
                Report(6, $"已发现 {databases.Count} 个去重后的 SaaS 数据库", 0, databases.Count);

                workDirectory = Path.Combine(Path.GetTempPath(), "microi-database-backup", _recordId);
                Directory.CreateDirectory(workDirectory);
                var fileName = $"microi-saas-databases-{_recordId}.zip";
                var zipPath = Path.Combine(workDirectory, fileName);
                var successCount = 0;
                var failedCount = 0;

                using (var output = new FileStream(zipPath, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None, 1024 * 1024, FileOptions.SequentialScan))
                using (var archive = new ZipArchive(output, ZipArchiveMode.Create, false, new UTF8Encoding(false)))
                {
                    for (var index = 0; index < databases.Count; index++)
                    {
                        ThrowIfCancellationRequested();
                        lease.ThrowIfLost();
                        var database = databases[index];
                        var progress = 8 + Convert.ToInt32(Math.Floor(index * 76m / databases.Count));
                        UpdateRecord(new Dictionary<string, object>
                        {
                            ["CurrentDatabase"] = database.DisplayName,
                            ["Progress"] = progress,
                            ["CompletedDatabases"] = index,
                            ["SuccessCount"] = successCount,
                            ["FailedCount"] = failedCount,
                            ["LeaseExpiresAt"] = DateTime.Now.AddSeconds(90).ToString("yyyy-MM-dd HH:mm:ss")
                        });
                        AppendLog($"开始备份 {database.DisplayName}（{index + 1}/{databases.Count}）。", null, null, false);
                        Report(progress, $"正在备份 {database.DisplayName}（{index + 1}/{databases.Count}）", index, databases.Count);
                        try
                        {
                            var entryName = $"{index + 1:D4}-{SanitizeFileName(database.Database)}.sql";
                            var entry = archive.CreateEntry(entryName, CompressionLevel.Fastest);
                            using var entryStream = entry.Open();
                            using var writer = new StreamWriter(entryStream, new UTF8Encoding(false), 1024 * 1024, true);
                            var result = ExportDatabase(database, writer, lease, index, databases.Count);
                            successCount++;
                            AppendLog($"完成 {database.DisplayName}：{result.TableCount} 张表，{result.RowCount} 行。", null, null, false);
                        }
                        catch (Exception ex)
                        {
                            failedCount++;
                            AppendLog($"{database.DisplayName} 备份失败：{SafeError(ex)}", null, null, false);
                        }
                        _completedDatabases = index + 1;
                        _successCount = successCount;
                        _failedCount = failedCount;
                        UpdateRecord(new Dictionary<string, object>
                        {
                            ["CompletedDatabases"] = _completedDatabases,
                            ["SuccessCount"] = _successCount,
                            ["FailedCount"] = _failedCount
                        });
                        var completedProgress = 8 + Convert.ToInt32(
                            Math.Floor((index + 1m) * 76m / databases.Count));
                        Report(completedProgress,
                            $"已处理 {index + 1}/{databases.Count} 个数据库（成功 {successCount}，失败 {failedCount}）",
                            _completedDatabases,
                            _totalDatabases);
                    }
                }

                if (successCount == 0)
                {
                    throw new InvalidOperationException("全部数据库备份失败，未上传不完整文件。详情请查看备份日志。");
                }

                ThrowIfCancellationRequested();
                lease.ThrowIfLost();
                UpdateRecord(new Dictionary<string, object>
                {
                    ["Progress"] = 88,
                    ["CompletedDatabases"] = databases.Count,
                    ["SuccessCount"] = successCount,
                    ["FailedCount"] = failedCount,
                    ["CurrentDatabase"] = "正在校验并上传 HDFS 私有桶"
                });
                Report(88, "数据库导出完成，正在校验并上传 HDFS 私有桶", databases.Count, databases.Count);

                var sha256 = ComputeSha256(zipPath);
                var fileSize = new FileInfo(zipPath).Length;
                _attemptHdfsPath = BuildAttemptHdfsPath(_backgroundTaskId, _backgroundTaskFencingToken);
                UpdateRecord(new Dictionary<string, object>
                {
                    ["ObjectAttemptPath"] = _attemptHdfsPath,
                    ["ObjectState"] = "Uploading"
                });
                UploadPrivate(zipPath, _attemptHdfsPath);
                lease.ThrowIfLost();

                var finalStatus = failedCount == 0 ? "Succeeded" : "PartiallySucceeded";
                var finalMessage = failedCount == 0
                    ? $"全部 {successCount} 个数据库备份成功。"
                    : $"备份完成：成功 {successCount} 个，失败 {failedCount} 个。";
                AppendLog(finalMessage, null, null, false);
                UpdateRecord(new Dictionary<string, object>
                {
                    ["Status"] = finalStatus,
                    ["Progress"] = 100,
                    ["FinishedAt"] = NowText(),
                    ["CurrentDatabase"] = "",
                    ["FileName"] = fileName,
                    ["HdfsPath"] = _attemptHdfsPath,
                    ["FileSize"] = fileSize,
                    ["Sha256"] = sha256,
                    ["RetentionStatus"] = "Active",
                    ["ObjectAttemptPath"] = _attemptHdfsPath,
                    ["ObjectState"] = "Committed",
                    ["SuccessCount"] = successCount,
                    ["FailedCount"] = failedCount,
                    ["LeaseOwner"] = "",
                    ["LeaseExpiresAt"] = "",
                    ["Log"] = GetLogText(),
                    ["ErrorSummary"] = failedCount == 0 ? "" : finalMessage
                });
                _attemptCommitted = true;
                CleanupSiblingAttemptObjects(_attemptHdfsPath);
                Report(100, finalMessage, databases.Count, databases.Count);

                TryApplyRetention(retainCount, _recordId);
                return new DosResult(failedCount == 0 ? 1 : 0, new
                {
                    RecordId = _recordId,
                    BackupNo = backupNo,
                    Status = finalStatus,
                    FileName = fileName,
                    FileSize = fileSize,
                    Sha256 = sha256,
                    TotalDatabases = databases.Count,
                    SuccessCount = successCount,
                    FailedCount = failedCount
                }, finalMessage);
            }
            catch (BackupFenceLostException ex)
            {
                TryDeleteUncommittedAttemptObject();
                MicroiEngine.QueueSystemLog(RuntimeMainOsClient(), "DatabaseBackup", "FencingRejected",
                    "数据库备份旧执行已被 fencing token 拒绝", ex.Message, 2, false, _backgroundTaskId);
                return new DosResult(0, new { RecordId = _recordId, Status = "Superseded" },
                    "数据库备份执行权已转移到新节点，旧执行已停止且不会覆盖新结果。");
            }
            catch (OperationCanceledException)
            {
                TryDeleteUncommittedAttemptObject();
                FinishFailure("Interrupted", "备份任务已停止；未完成的本地临时文件已清理。");
                return new DosResult(0, new { RecordId = _recordId, Status = "Interrupted" }, "数据库备份已停止。");
            }
            catch (Exception ex)
            {
                TryDeleteUncommittedAttemptObject();
                var safeError = SafeError(ex);
                FinishFailure("Failed", safeError);
                return new DosResult(0, new { RecordId = _recordId, Status = "Failed" }, "数据库备份失败：" + safeError);
            }
            finally
            {
                lease?.Dispose();
                if (!string.IsNullOrWhiteSpace(workDirectory)) TryDeleteDirectory(workDirectory);
            }
        }

        private ExportSummary ExportDatabase(TenantDatabase database, TextWriter writer,
            DistributedBackupLease lease, int databaseIndex, int databaseCount)
        {
            var builder = new MySqlConnectionStringBuilder(
                ConnectionStringCompatibility.Normalize(
                    DatabaseType.MySql, database.ConnectionString, 100, 120, 600))
            {
                Database = database.Database,
                AllowUserVariables = true,
                AllowZeroDateTime = true,
                ConvertZeroDateTime = false,
                DefaultCommandTimeout = 600,
                ConnectionTimeout = 15
            };
            using var connection = new MySqlConnection(builder.ConnectionString);
            connection.Open();
            ExecuteNonQuery(connection, "SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;");
            ExecuteNonQuery(connection, "START TRANSACTION WITH CONSISTENT SNAPSHOT;");
            try
            {
                var tables = ReadNames(connection,
                    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=@database AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME;",
                    database.Database);
                var views = ReadNames(connection,
                    "SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA=@database ORDER BY TABLE_NAME;",
                    database.Database);
                long rowCount = 0;

                writer.WriteLine("-- Microi 吾码 SaaS 数据库在线备份");
                writer.WriteLine("-- Database: " + database.Database);
                writer.WriteLine("-- Generated: " + NowText());
                writer.WriteLine("SET NAMES utf8mb4;");
                writer.WriteLine("SET FOREIGN_KEY_CHECKS=0;");
                writer.WriteLine("SET UNIQUE_CHECKS=0;");
                writer.WriteLine();

                for (var tableIndex = 0; tableIndex < tables.Count; tableIndex++)
                {
                    ThrowIfCancellationRequested();
                    lease.ThrowIfLost();
                    var table = tables[tableIndex];
                    writer.WriteLine($"DROP TABLE IF EXISTS {QuoteIdentifier(table)};");
                    writer.WriteLine(ReadShowCreate(connection, $"SHOW CREATE TABLE {QuoteIdentifier(database.Database)}.{QuoteIdentifier(table)};", "Create Table") + ";");
                    var columns = ReadColumns(connection, database.Database, table);
                    if (columns.Count > 0)
                    {
                        rowCount += ExportRows(connection, writer, table, columns, lease);
                    }
                    writer.WriteLine();
                    if ((tableIndex + 1) % 10 == 0 || tableIndex + 1 == tables.Count)
                    {
                        var withinDatabase = (tableIndex + 1m) / Math.Max(1, tables.Count);
                        var progress = 8 + Convert.ToInt32(Math.Floor((databaseIndex + withinDatabase) * 76m / databaseCount));
                        Report(progress,
                            $"{database.DisplayName}：已导出 {tableIndex + 1}/{tables.Count} 张表",
                            databaseIndex,
                            databaseCount);
                    }
                }

                // 先为全部视图创建仅含列结构的占位表，依赖视图可在任意顺序恢复。
                // 真实视图创建前再删除对应占位表，避免视图字母顺序导致还原失败。
                foreach (var view in views)
                {
                    var viewColumns = ReadColumns(connection, database.Database, view);
                    writer.WriteLine($"DROP TABLE IF EXISTS {QuoteIdentifier(view)};");
                    writer.WriteLine($"DROP VIEW IF EXISTS {QuoteIdentifier(view)};");
                    if (viewColumns.Count > 0)
                    {
                        writer.WriteLine($"CREATE TABLE {QuoteIdentifier(view)} ({string.Join(",", viewColumns.Select(column => QuoteIdentifier(column.Name) + " " + column.ColumnType + " NULL"))});");
                    }
                }
                foreach (var view in views)
                {
                    writer.WriteLine($"DROP TABLE IF EXISTS {QuoteIdentifier(view)};");
                    writer.WriteLine($"DROP VIEW IF EXISTS {QuoteIdentifier(view)};");
                    writer.WriteLine(ReadShowCreate(connection, $"SHOW CREATE VIEW {QuoteIdentifier(database.Database)}.{QuoteIdentifier(view)};", "Create View") + ";");
                }
                ExportProgrammableObjects(connection, writer, database.Database, "TRIGGER", "TRIGGERS", "TRIGGER_NAME", "Create Trigger");
                ExportRoutines(connection, writer, database.Database);
                ExportProgrammableObjects(connection, writer, database.Database, "EVENT", "EVENTS", "EVENT_NAME", "Create Event");
                writer.WriteLine("SET UNIQUE_CHECKS=1;");
                writer.WriteLine("SET FOREIGN_KEY_CHECKS=1;");
                writer.Flush();
                return new ExportSummary { TableCount = tables.Count, RowCount = rowCount };
            }
            finally
            {
                try { ExecuteNonQuery(connection, "ROLLBACK;"); } catch { }
            }
        }

        private long ExportRows(MySqlConnection connection, TextWriter writer, string table,
            IReadOnlyList<ColumnInfo> columns, DistributedBackupLease lease)
        {
            var fields = string.Join(",", columns.Select(column => QuoteIdentifier(column.Name)));
            using var command = connection.CreateCommand();
            command.CommandTimeout = 600;
            command.CommandText = $"SELECT {fields} FROM {QuoteIdentifier(table)};";
            using var reader = command.ExecuteReader(CommandBehavior.SequentialAccess);
            long rowCount = 0;
            while (reader.Read())
            {
                ThrowIfCancellationRequested();
                if (rowCount % ThrottleRows == 0)
                {
                    lease.ThrowIfLost();
                    if (rowCount > 0) Thread.Sleep(ThrottleDelayMilliseconds);
                }
                writer.Write($"INSERT INTO {QuoteIdentifier(table)} ({fields}) VALUES (");
                for (var index = 0; index < columns.Count; index++)
                {
                    if (index > 0) writer.Write(',');
                    try
                    {
                        WriteSqlValue(reader, index, columns[index].DataType, writer);
                    }
                    catch (Exception ex)
                    {
                        throw new InvalidOperationException(
                            $"导出字段 {table}.{columns[index].Name}({columns[index].DataType}) 失败：{ex.Message}", ex);
                    }
                }
                writer.WriteLine(");");
                rowCount++;
                if (rowCount % 1000 == 0) writer.Flush();
            }
            return rowCount;
        }

        private static void WriteSqlValue(MySqlDataReader reader, int ordinal, string dataType, TextWriter writer)
        {
            if (reader.IsDBNull(ordinal)) { writer.Write("NULL"); return; }
            var type = (dataType ?? "").ToUpperInvariant();
            // MySql.Data 将 BIT 映射为数值（通常是 UInt64），它不是可调用
            // GetStream 的二进制列。BIT 曾与 BLOB 共用流式分支，导致包含任意
            // bool/bit 字段的数据库在线备份立即失败。
            if (type == "BIT")
            {
                writer.Write(FormatBitLiteral(reader.GetValue(ordinal)));
                return;
            }
            if (IsBinaryType(type))
            {
                writer.Write("0x");
                using var stream = reader.GetStream(ordinal);
                var buffer = new byte[64 * 1024];
                int read;
                while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
                {
                    for (var i = 0; i < read; i++) writer.Write(buffer[i].ToString("X2", CultureInfo.InvariantCulture));
                }
                return;
            }
            if (IsTextType(type))
            {
                writer.Write('\'');
                using var textReader = reader.GetTextReader(ordinal);
                var chars = new char[64 * 1024];
                int read;
                while ((read = textReader.Read(chars, 0, chars.Length)) > 0) WriteEscapedText(writer, chars, read);
                writer.Write('\'');
                return;
            }
            var value = reader.GetValue(ordinal);
            if (value is bool boolean) { writer.Write(boolean ? "1" : "0"); return; }
            if (value is DateTime dateTime)
            {
                writer.Write('\'');
                var dateText = dateTime.ToString(type == "DATE" ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm:ss.ffffff", CultureInfo.InvariantCulture);
                if (type != "DATE") dateText = dateText.TrimEnd('0').TrimEnd('.');
                writer.Write(dateText);
                writer.Write('\'');
                return;
            }
            if (value is TimeSpan timeSpan) { writer.Write('\''); writer.Write(timeSpan.ToString("c", CultureInfo.InvariantCulture)); writer.Write('\''); return; }
            if (IsNumericType(type)) { writer.Write(Convert.ToString(value, CultureInfo.InvariantCulture)); return; }
            writer.Write('\'');
            var text = Convert.ToString(value, CultureInfo.InvariantCulture) ?? "";
            WriteEscapedText(writer, text.ToCharArray(), text.Length);
            writer.Write('\'');
        }

        internal static string FormatBitLiteral(object value)
        {
            if (value == null || value == DBNull.Value) return "NULL";
            if (value is bool boolean) return boolean ? "1" : "0";
            if (value is byte[] bytes)
            {
                if (bytes.Length == 0) return "0";
                var hex = new StringBuilder(bytes.Length * 2 + 2).Append("0x");
                foreach (var item in bytes)
                    hex.Append(item.ToString("X2", CultureInfo.InvariantCulture));
                return hex.ToString();
            }
            return Convert.ToUInt64(value, CultureInfo.InvariantCulture)
                .ToString(CultureInfo.InvariantCulture);
        }

        private static void WriteEscapedText(TextWriter writer, char[] chars, int length)
        {
            for (var i = 0; i < length; i++)
            {
                switch (chars[i])
                {
                    case '\0': writer.Write("\\0"); break;
                    case '\n': writer.Write("\\n"); break;
                    case '\r': writer.Write("\\r"); break;
                    case '\\': writer.Write("\\\\"); break;
                    case '\'': writer.Write("\\\'"); break;
                    case (char)26: writer.Write("\\Z"); break;
                    default: writer.Write(chars[i]); break;
                }
            }
        }

        private static void ExportProgrammableObjects(MySqlConnection connection, TextWriter writer,
            string database, string objectType, string informationSchemaTable, string nameColumn, string createColumn)
        {
            var names = ReadNames(connection,
                $"SELECT {nameColumn} FROM information_schema.{informationSchemaTable} WHERE {informationSchemaTable.Substring(0, informationSchemaTable.Length - 1)}_SCHEMA=@database ORDER BY {nameColumn};",
                database);
            foreach (var name in names)
            {
                var create = ReadShowCreate(connection,
                    $"SHOW CREATE {objectType} {QuoteIdentifier(database)}.{QuoteIdentifier(name)};", createColumn);
                WriteDelimitedObject(writer, create);
            }
        }

        private static void ExportRoutines(MySqlConnection connection, TextWriter writer, string database)
        {
            using var command = connection.CreateCommand();
            command.CommandText = "SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=@database ORDER BY ROUTINE_TYPE, ROUTINE_NAME;";
            command.Parameters.AddWithValue("@database", database);
            command.CommandTimeout = 60;
            var routines = new List<Tuple<string, string>>();
            using (var reader = command.ExecuteReader())
            {
                while (reader.Read()) routines.Add(Tuple.Create(reader.GetString(0), reader.GetString(1)));
            }
            foreach (var routine in routines)
            {
                var type = routine.Item2.ToUpperInvariant() == "FUNCTION" ? "FUNCTION" : "PROCEDURE";
                var create = ReadShowCreate(connection,
                    $"SHOW CREATE {type} {QuoteIdentifier(database)}.{QuoteIdentifier(routine.Item1)};",
                    "Create " + CultureInfo.InvariantCulture.TextInfo.ToTitleCase(type.ToLowerInvariant()));
                WriteDelimitedObject(writer, create);
            }
        }

        private static void WriteDelimitedObject(TextWriter writer, string createSql)
        {
            if (string.IsNullOrWhiteSpace(createSql)) return;
            writer.WriteLine("DELIMITER ;;");
            writer.WriteLine(createSql.TrimEnd(';') + ";;");
            writer.WriteLine("DELIMITER ;");
        }

        private static List<ColumnInfo> ReadColumns(MySqlConnection connection, string database, string table)
        {
            var result = new List<ColumnInfo>();
            using var command = connection.CreateCommand();
            command.CommandText = @"SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=@database AND TABLE_NAME=@table AND UPPER(IFNULL(EXTRA,'')) NOT LIKE '%GENERATED%'
ORDER BY ORDINAL_POSITION;";
            command.Parameters.AddWithValue("@database", database);
            command.Parameters.AddWithValue("@table", table);
            using var reader = command.ExecuteReader();
            while (reader.Read()) result.Add(new ColumnInfo
            {
                Name = reader.GetString(0),
                DataType = reader.GetString(1),
                ColumnType = reader.GetString(2)
            });
            return result;
        }

        private static List<string> ReadNames(MySqlConnection connection, string sql, string database)
        {
            var result = new List<string>();
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            command.CommandTimeout = 60;
            command.Parameters.AddWithValue("@database", database);
            using var reader = command.ExecuteReader();
            while (reader.Read()) result.Add(reader.GetString(0));
            return result;
        }

        private static string ReadShowCreate(MySqlConnection connection, string sql, string desiredColumn)
        {
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            command.CommandTimeout = 60;
            using var reader = command.ExecuteReader();
            if (!reader.Read()) throw new InvalidOperationException("SHOW CREATE 未返回结构。");
            for (var i = 0; i < reader.FieldCount; i++)
            {
                if (string.Equals(reader.GetName(i), desiredColumn, StringComparison.OrdinalIgnoreCase))
                    return reader.IsDBNull(i) ? "" : reader.GetString(i);
            }
            return reader.FieldCount > 1 && !reader.IsDBNull(1) ? reader.GetString(1) : "";
        }

        private List<TenantDatabase> SnapshotDatabases(IReadOnlyCollection<string> selectedOsClients)
        {
            var requested = selectedOsClients == null || selectedOsClients.Count == 0
                ? null
                : new HashSet<string>(
                    selectedOsClients.Where(item => !string.IsNullOrWhiteSpace(item)),
                    StringComparer.OrdinalIgnoreCase);
            var runtimeType = OsClientDefault.OsClientType ?? "";
            var runtimeNetwork = OsClientDefault.OsClientNetwork ?? "";
            var result = new Dictionary<string, TenantDatabase>(StringComparer.OrdinalIgnoreCase);
            foreach (var pair in OsClientExtend.ClientList.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase))
            {
                var client = pair.Value;
                var model = client?.OsClientModel;
                if (model == null || IsFalse(model["IsEnable"]) || IsTrue(model["IsDeleted"])) continue;
                if (requested != null && !requested.Contains(pair.Key)) continue;
                if (!string.Equals(model["OsClientType"]?.ToString() ?? "", runtimeType, StringComparison.OrdinalIgnoreCase)
                    || !string.Equals(model["OsClientNetwork"]?.ToString() ?? "", runtimeNetwork, StringComparison.OrdinalIgnoreCase))
                {
                    AppendLog($"跳过租户 {pair.Key}：不属于当前后端运行环境三元组。", null, null, false);
                    continue;
                }
                var dbType = model["DbType"]?.ToString();
                if (!string.Equals(dbType, "MySql", StringComparison.OrdinalIgnoreCase))
                {
                    AppendLog($"跳过非 MySQL 租户 {pair.Key}（DbType={dbType ?? "未配置"}）；当前备份引擎仅支持 MySQL。", null, null, false);
                    continue;
                }
                var connectionString = model["DbReadConn"]?.ToString();
                if (string.IsNullOrWhiteSpace(connectionString)) connectionString = model["DbConn"]?.ToString();
                if (string.IsNullOrWhiteSpace(connectionString)
                    && string.Equals(pair.Key, OsClientDefault.OsClient, StringComparison.OrdinalIgnoreCase))
                    connectionString = OsClientDefault.OsClientDbConn;
                if (string.IsNullOrWhiteSpace(connectionString))
                {
                    AppendLog($"跳过租户 {pair.Key}：未配置数据库连接。", null, null, false);
                    continue;
                }
                try
                {
                    var builder = new MySqlConnectionStringBuilder(
                        ConnectionStringCompatibility.Normalize(
                            DatabaseType.MySql, connectionString, 100, 120, 600));
                    if (string.IsNullOrWhiteSpace(builder.Database))
                    {
                        AppendLog($"跳过租户 {pair.Key}：连接未指定数据库名。", null, null, false);
                        continue;
                    }
                    var key = $"{builder.Server}:{builder.Port}/{builder.Database}";
                    if (result.TryGetValue(key, out var existing))
                    {
                        existing.OsClients.Add(pair.Key);
                    }
                    else
                    {
                        result[key] = new TenantDatabase
                        {
                            Database = builder.Database,
                            ConnectionString = builder.ConnectionString,
                            OsClients = new List<string> { pair.Key }
                        };
                    }
                }
                catch (Exception ex)
                {
                    AppendLog($"跳过租户 {pair.Key}：数据库连接配置无效（{SafeError(ex)}）。", null, null, false);
                }
            }
            return result.Values.OrderBy(item => item.Database, StringComparer.OrdinalIgnoreCase).ToList();
        }

        private ExistingBackupCompletion ClaimQueuedRecord(
            string backupNo,
            string triggerType,
            string userId,
            string userName,
            IReadOnlyCollection<string> selectedOsClients)
        {
            using var connection = OpenMainConnection();
            using var command = connection.CreateCommand();
            command.CommandText = $@"INSERT IGNORE INTO `{RecordTable}`
(`Id`,`CreateTime`,`UpdateTime`,`UserId`,`UserName`,`IsDeleted`,`BackupNo`,`TriggerType`,`Status`,`Progress`,
 `TotalDatabases`,`CompletedDatabases`,`SuccessCount`,`FailedCount`,`BackgroundTaskId`,`BackgroundTaskFencingToken`,
 `RequestedById`,`RequestedByName`,`RetentionStatus`,`Log`,`BackupScope`,`SelectedOsClients`,
 `RuntimeOsClientType`,`RuntimeOsClientNetwork`,`ObjectAttemptPath`,`ObjectState`)
VALUES (@id,@now,@now,@userId,@userName,0,@backupNo,@triggerType,'Queued',0,0,0,0,0,@taskId,@fence,
 @userId,@userName,'Active','',@backupScope,@selectedOsClients,@runtimeType,@runtimeNetwork,'','Preparing');";
            command.Parameters.AddWithValue("@id", _recordId);
            command.Parameters.AddWithValue("@now", NowText());
            command.Parameters.AddWithValue("@userId", userId);
            command.Parameters.AddWithValue("@userName", userName);
            command.Parameters.AddWithValue("@backupNo", backupNo);
            command.Parameters.AddWithValue("@triggerType", triggerType);
            command.Parameters.AddWithValue("@taskId", _backgroundTaskId);
            command.Parameters.AddWithValue("@fence", _backgroundTaskFencingToken);
            command.Parameters.AddWithValue("@backupScope", selectedOsClients == null || selectedOsClients.Count == 0
                ? "AllEligibleInRuntime"
                : "SelectedInRuntime");
            command.Parameters.AddWithValue("@selectedOsClients", selectedOsClients == null
                ? "[]"
                : JArray.FromObject(selectedOsClients).ToString(Newtonsoft.Json.Formatting.None));
            command.Parameters.AddWithValue("@runtimeType", OsClientDefault.OsClientType ?? "");
            command.Parameters.AddWithValue("@runtimeNetwork", OsClientDefault.OsClientNetwork ?? "");
            if (command.ExecuteNonQuery() == 1) return null;

            string existingId;
            string existingStatus;
            string existingBackupNo;
            string existingFileName;
            string existingHdfsPath;
            string existingSha256;
            string existingMessage;
            long existingFence;
            long existingFileSize;
            int existingTotal;
            int existingSuccess;
            int existingFailed;
            using (var read = connection.CreateCommand())
            {
                read.CommandText = $@"SELECT `Id`,`Status`,`BackupNo`,`BackgroundTaskFencingToken`,
`FileName`,`HdfsPath`,`FileSize`,`Sha256`,`TotalDatabases`,`SuccessCount`,`FailedCount`,`ErrorSummary`
FROM `{RecordTable}` WHERE `BackgroundTaskId`=@taskId LIMIT 1;";
                read.Parameters.AddWithValue("@taskId", _backgroundTaskId);
                using var reader = read.ExecuteReader();
                if (!reader.Read())
                    throw new InvalidOperationException("数据库备份记录唯一键冲突，但未能按 BackgroundTaskId 回读记录。");
                existingId = Convert.ToString(reader["Id"]);
                existingStatus = Convert.ToString(reader["Status"]);
                existingBackupNo = Convert.ToString(reader["BackupNo"]);
                long.TryParse(Convert.ToString(reader["BackgroundTaskFencingToken"]), out existingFence);
                existingFileName = Convert.ToString(reader["FileName"]);
                existingHdfsPath = Convert.ToString(reader["HdfsPath"]);
                long.TryParse(Convert.ToString(reader["FileSize"]), out existingFileSize);
                existingSha256 = Convert.ToString(reader["Sha256"]);
                int.TryParse(Convert.ToString(reader["TotalDatabases"]), out existingTotal);
                int.TryParse(Convert.ToString(reader["SuccessCount"]), out existingSuccess);
                int.TryParse(Convert.ToString(reader["FailedCount"]), out existingFailed);
                existingMessage = Convert.ToString(reader["ErrorSummary"]);
            }
            _recordId = existingId;
            if (string.Equals(existingStatus, "Succeeded", StringComparison.OrdinalIgnoreCase)
                || string.Equals(existingStatus, "PartiallySucceeded", StringComparison.OrdinalIgnoreCase))
            {
                return new ExistingBackupCompletion
                {
                    BackupNo = existingBackupNo,
                    Status = existingStatus,
                    FileName = existingFileName,
                    HdfsPath = existingHdfsPath,
                    FileSize = existingFileSize,
                    Sha256 = existingSha256,
                    TotalDatabases = existingTotal,
                    SuccessCount = existingSuccess,
                    FailedCount = existingFailed,
                    Message = string.IsNullOrWhiteSpace(existingMessage)
                        ? "数据库备份已由先前执行完成，本次恢复未重复上传。"
                        : existingMessage
                };
            }
            if (existingFence >= _backgroundTaskFencingToken)
                throw new BackupFenceLostException(
                    $"数据库备份执行权已转移或同一 fencing token 已被使用（当前 {existingFence}，本次 {_backgroundTaskFencingToken}）。");

            using var claim = connection.CreateCommand();
            claim.CommandText = $@"UPDATE `{RecordTable}` SET
`UpdateTime`=@now,`UserId`=@userId,`UserName`=@userName,`BackupNo`=@backupNo,`TriggerType`=@triggerType,
`Status`='Queued',`Progress`=0,`TotalDatabases`=0,`CompletedDatabases`=0,`SuccessCount`=0,`FailedCount`=0,
`BackgroundTaskFencingToken`=@fence,`RequestedById`=@userId,`RequestedByName`=@userName,
`RetentionStatus`='Active',`CurrentDatabase`='',`StartedAt`=NULL,`FinishedAt`=NULL,
`FileName`='',`HdfsPath`='',`FileSize`=0,`Sha256`='',`LeaseOwner`='',`LeaseExpiresAt`=NULL,
`ErrorSummary`='',`BackupScope`=@backupScope,`SelectedOsClients`=@selectedOsClients,
`RuntimeOsClientType`=@runtimeType,`RuntimeOsClientNetwork`=@runtimeNetwork,
`ObjectAttemptPath`='',`ObjectState`='Preparing'
WHERE `BackgroundTaskId`=@taskId
  AND COALESCE(`BackgroundTaskFencingToken`,0)<@fence
  AND `Status` NOT IN ('Succeeded','PartiallySucceeded');";
            claim.Parameters.AddWithValue("@now", NowText());
            claim.Parameters.AddWithValue("@userId", userId);
            claim.Parameters.AddWithValue("@userName", userName);
            claim.Parameters.AddWithValue("@backupNo", backupNo);
            claim.Parameters.AddWithValue("@triggerType", triggerType);
            claim.Parameters.AddWithValue("@fence", _backgroundTaskFencingToken);
            claim.Parameters.AddWithValue("@taskId", _backgroundTaskId);
            claim.Parameters.AddWithValue("@backupScope", selectedOsClients == null || selectedOsClients.Count == 0
                ? "AllEligibleInRuntime"
                : "SelectedInRuntime");
            claim.Parameters.AddWithValue("@selectedOsClients", selectedOsClients == null
                ? "[]"
                : JArray.FromObject(selectedOsClients).ToString(Newtonsoft.Json.Formatting.None));
            claim.Parameters.AddWithValue("@runtimeType", OsClientDefault.OsClientType ?? "");
            claim.Parameters.AddWithValue("@runtimeNetwork", OsClientDefault.OsClientNetwork ?? "");
            if (claim.ExecuteNonQuery() != 1)
                throw new BackupFenceLostException("数据库备份记录 fencing CAS 失败，旧节点已停止写入。");
            return null;
        }

        private void UpdateRecord(IReadOnlyDictionary<string, object> values)
        {
            if (string.IsNullOrWhiteSpace(_recordId) || values == null || values.Count == 0) return;
            var allowed = new HashSet<string>(new[]
            {
                "Status","Progress","TotalDatabases","CompletedDatabases","SuccessCount","FailedCount",
                "CurrentDatabase","StartedAt","FinishedAt","FileName","HdfsPath","FileSize","Sha256",
                "LeaseOwner","LeaseExpiresAt","RetentionStatus","Log","ErrorSummary",
                "ObjectAttemptPath","ObjectState"
            }, StringComparer.OrdinalIgnoreCase);
            var fields = values.Where(item => allowed.Contains(item.Key)).ToList();
            if (fields.Count == 0) return;
            using var connection = OpenMainConnection();
            using var command = connection.CreateCommand();
            var sets = new List<string> { "`UpdateTime`=@updateTime" };
            command.Parameters.AddWithValue("@updateTime", NowText());
            for (var i = 0; i < fields.Count; i++)
            {
                sets.Add($"`{fields[i].Key}`=@p{i}");
                command.Parameters.AddWithValue("@p" + i, fields[i].Value ?? DBNull.Value);
            }
            command.CommandText = $@"UPDATE `{RecordTable}` SET {string.Join(",", sets)}
WHERE `Id`=@id AND `BackgroundTaskId`=@taskId AND `BackgroundTaskFencingToken`=@fence;";
            command.Parameters.AddWithValue("@id", _recordId);
            command.Parameters.AddWithValue("@taskId", _backgroundTaskId);
            command.Parameters.AddWithValue("@fence", _backgroundTaskFencingToken);
            if (command.ExecuteNonQuery() != 1)
                throw new BackupFenceLostException("数据库备份记录 fencing CAS 失败，旧节点已停止写入。");
        }

        private void AppendLog(string message, string status = null, int? progress = null, bool persist = true)
        {
            if (string.IsNullOrWhiteSpace(message)) return;
            _log.Append('[').Append(NowText()).Append("] ").AppendLine(message.Trim());
            BackgroundTaskRuntime.TryAppendLog(_backgroundTaskId, message.Trim());
            if (!persist) return;
            var values = new Dictionary<string, object> { ["Log"] = GetLogText() };
            if (!string.IsNullOrWhiteSpace(status)) values["Status"] = status;
            if (progress.HasValue) values["Progress"] = progress.Value;
            UpdateRecord(values);
        }

        private string GetLogText()
        {
            var text = _log.ToString();
            return text.Length <= MaxLogChars ? text : "[较早日志已截断]\n" + text.Substring(text.Length - MaxLogChars);
        }

        private void FinishFailure(string status, string error)
        {
            try
            {
                AppendLog(error, null, null, false);
                var terminalProgress = Math.Max(0, Math.Min(99, _lastProgress));
                UpdateRecord(new Dictionary<string, object>
                {
                    ["Status"] = status,
                    ["Progress"] = terminalProgress,
                    ["TotalDatabases"] = _totalDatabases,
                    ["CompletedDatabases"] = _completedDatabases,
                    ["SuccessCount"] = _successCount,
                    ["FailedCount"] = _failedCount,
                    ["FinishedAt"] = NowText(),
                    ["CurrentDatabase"] = "",
                    ["LeaseOwner"] = "",
                    ["LeaseExpiresAt"] = "",
                    ["ObjectAttemptPath"] = "",
                    ["ObjectState"] = "Abandoned",
                    ["Log"] = GetLogText(),
                    ["ErrorSummary"] = error
                });
                Report(terminalProgress, error, _completedDatabases, _totalDatabases);
            }
            catch (Exception logError)
            {
                MicroiEngine.QueueSystemLog(RuntimeMainOsClient(), "DatabaseBackup", "FailureStateWriteFailed", "写入数据库备份失败状态时出错", logError.ToString(), 3);
            }
        }

        private void TryApplyRetention(int retainCount, string currentRecordId)
        {
            try
            {
                using var connection = OpenMainConnection();
                using var command = connection.CreateCommand();
                command.CommandText = $@"SELECT `Id`,`HdfsPath` FROM `{RecordTable}`
WHERE (`IsDeleted`=0 OR `IsDeleted` IS NULL) AND `RetentionStatus`='Active'
  AND `Status` IN ('Succeeded','PartiallySucceeded') AND `HdfsPath` IS NOT NULL AND `HdfsPath`<>''
ORDER BY `FinishedAt` DESC, `CreateTime` DESC LIMIT 1000;";
                var rows = new List<Tuple<string, string>>();
                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read()) rows.Add(Tuple.Create(reader.GetString(0), reader.GetString(1)));
                }
                foreach (var row in rows.Skip(retainCount))
                {
                    var deleteResult = GetHdfs().DeleteObject(new HDFSParam
                    {
                        ClientModel = OsClientExtend.GetClient(RuntimeMainOsClient()),
                        Limit = true,
                        FileFullPath = row.Item2
                    }).GetAwaiter().GetResult();
                    using var update = connection.CreateCommand();
                    update.CommandText = $"UPDATE `{RecordTable}` SET `RetentionStatus`=@status,`HdfsPath`=CASE WHEN @status='Deleted' THEN '' ELSE `HdfsPath` END,`UpdateTime`=@now WHERE `Id`=@id;";
                    update.Parameters.AddWithValue("@status", deleteResult?.Code == 1 ? "Deleted" : "DeleteFailed");
                    update.Parameters.AddWithValue("@now", NowText());
                    update.Parameters.AddWithValue("@id", row.Item1);
                    update.ExecuteNonQuery();
                }
            }
            catch (Exception ex)
            {
                AppendLog("历史备份保留策略执行失败，不影响本次备份文件：" + SafeError(ex), null, null, false);
                UpdateRecord(new Dictionary<string, object> { ["Log"] = GetLogText() });
            }
        }

        private static void UploadPrivate(string zipPath, string hdfsPath)
        {
            var client = OsClientExtend.GetClient(RuntimeMainOsClient())
                         ?? throw new InvalidOperationException("未读取到当前后端主租户 HDFS 配置。");
            using var stream = new FileStream(zipPath, FileMode.Open, FileAccess.Read, FileShare.Read, 1024 * 1024, FileOptions.SequentialScan);
            var result = GetHdfs().PutObject(new HDFSParam
            {
                ClientModel = client,
                Limit = true,
                Preview = false,
                FileFullPath = hdfsPath,
                FileStream = stream,
                TimeoutSeconds = 1800
            }).GetAwaiter().GetResult();
            if (result == null || result.Code != 1)
                throw new InvalidOperationException("上传 HDFS 私有桶失败：" + (result?.Msg ?? "未知错误"));
        }

        private void TryDeleteUncommittedAttemptObject()
        {
            if (_attemptCommitted || string.IsNullOrWhiteSpace(_attemptHdfsPath)) return;
            try
            {
                var client = OsClientExtend.GetClient(RuntimeMainOsClient());
                if (client == null) return;
                var result = GetHdfs().DeleteObject(new HDFSParam
                {
                    ClientModel = client,
                    Limit = true,
                    FileFullPath = _attemptHdfsPath
                }).GetAwaiter().GetResult();
                if (result?.Code != 1)
                {
                    MicroiEngine.QueueSystemLog(RuntimeMainOsClient(), "DatabaseBackup", "AttemptObjectCleanupFailed",
                        "清理未提交数据库备份对象失败", result?.Msg ?? "未知错误", 2, false, _attemptHdfsPath);
                }
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(RuntimeMainOsClient(), "DatabaseBackup", "AttemptObjectCleanupFailed",
                    "清理未提交数据库备份对象失败", ex.ToString(), 2, false, _attemptHdfsPath);
            }
        }

        /// <summary>
        /// Once the current fencing attempt is committed, remove abandoned sibling
        /// attempts left by a killed process. A still-running stale process writes
        /// only its own deterministic attempt key and deletes it when its CAS fails.
        /// </summary>
        private void CleanupSiblingAttemptObjects(string committedPath)
        {
            try
            {
                var client = OsClientExtend.GetClient(RuntimeMainOsClient());
                if (client == null) return;
                var prefix = $"database-backups/tasks/{_recordId}/";
                var hdfs = GetHdfs();
                var list = hdfs.ListObjects(new HDFSParam
                {
                    ClientModel = client,
                    Limit = true,
                    Prefix = prefix,
                    Recursive = true,
                    MaxKeys = 1000
                }).GetAwaiter().GetResult();
                if (list?.Code != 1 || list.Data == null) return;
                var files = JObject.FromObject(list.Data)["Files"] as JArray;
                if (files == null) return;
                var keep = NormalizeObjectPath(committedPath);
                foreach (var item in files.OfType<JObject>())
                {
                    var path = item["FullPath"]?.ToString() ?? "";
                    var normalized = NormalizeObjectPath(path);
                    var fileName = item["Name"]?.ToString() ?? Path.GetFileName(normalized);
                    if (string.Equals(normalized, keep, StringComparison.OrdinalIgnoreCase)
                        || !fileName.StartsWith("attempt-", StringComparison.OrdinalIgnoreCase)
                        || !fileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)) continue;
                    var delete = hdfs.DeleteObject(new HDFSParam
                    {
                        ClientModel = client,
                        Limit = true,
                        FileFullPath = "/" + normalized
                    }).GetAwaiter().GetResult();
                    if (delete?.Code != 1)
                        AppendLog("孤儿备份对象清理失败，后续任务会再次清理：/" + normalized, null, null, false);
                }
            }
            catch (Exception ex)
            {
                AppendLog("扫描孤儿备份对象失败，不影响已提交备份：" + SafeError(ex), null, null, false);
            }
        }

        private static IMicroiHDFS GetHdfs()
        {
            var client = OsClientExtend.GetClient(RuntimeMainOsClient())
                         ?? throw new InvalidOperationException("未读取到当前后端主租户 HDFS 配置。");
            return client.OsClientModel?["HDFS"]?.ToString() switch
            {
                "MinIO" => MicroiEngine.HDFSFactory(HDFSType.MinIO),
                "S3" => MicroiEngine.HDFSFactory(HDFSType.AmazonS3),
                _ => MicroiEngine.HDFSFactory(HDFSType.Aliyun)
            };
        }

        private static MySqlConnection OpenMainConnection()
        {
            if (!string.Equals(OsClientDefault.OsClientDbType, "MySql", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("数据库备份记录目前要求主租户使用 MySQL。");
            var connection = new MySqlConnection(
                ConnectionStringCompatibility.Normalize(
                    DatabaseType.MySql, OsClientDefault.OsClientDbConn, 100, 120, 600));
            connection.Open();
            return connection;
        }

        private static DosResult ValidatePermission(JObject currentUser, string osClient)
        {
            var runtimeMain = RuntimeMainOsClient();
            if (string.IsNullOrWhiteSpace(runtimeMain)
                || !string.Equals(osClient, runtimeMain, StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "数据库备份仅允许由当前后端运行环境的主租户执行。");
            int.TryParse(currentUser?["Level"]?.ToString(), out var level);
            if (string.IsNullOrWhiteSpace(currentUser?["Id"]?.ToString()) || level < 9999)
                return new DosResult(0, null, "仅当前后端主租户的超级管理员可执行数据库备份。");
            return new DosResult(1);
        }

        private static string RuntimeMainOsClient() => OsClientDefault.OsClient ?? "";

        public static string BuildStableRecordId(string backgroundTaskId)
        {
            var value = (backgroundTaskId ?? "").Trim();
            if (value.Length > 0 && value.Length <= 36
                && value.All(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_'))
                return value;
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(value));
            return BitConverter.ToString(bytes).Replace("-", "").Substring(0, 32).ToLowerInvariant();
        }

        public static string BuildAttemptHdfsPath(string backgroundTaskId, long fencingToken)
        {
            return $"/database-backups/tasks/{BuildStableRecordId(backgroundTaskId)}/attempt-{Math.Max(0, fencingToken):D10}.zip";
        }

        private void Report(int progress, string message, int current, int total)
        {
            _lastProgress = Math.Max(0, Math.Min(100, progress));
            // 单个数据库内部仍包含成千上万张表。若把“数据库数”作为后台任务
            // WorkTotal，通用进度器会优先按 0/1 计算，导致整个导出阶段一直显示 0%。
            // 数据库完成/成功/失败计数由业务记录权威保存；通知中心使用这里经过
            // 分段计算的显式百分比，并在消息中展示数据库/表的单位进度。
            BackgroundTaskRuntime.TryUpdateProgress(_backgroundTaskId, _lastProgress, message, null, null);
        }

        private void ThrowIfCancellationRequested()
        {
            if (BackgroundTaskRuntime.IsCancellationRequested(_backgroundTaskId)) throw new OperationCanceledException();
        }

        private static void ExecuteNonQuery(MySqlConnection connection, string sql)
        {
            using var command = connection.CreateCommand();
            command.CommandText = sql;
            command.CommandTimeout = 60;
            command.ExecuteNonQuery();
        }

        private static bool IsTrue(JToken token) => token != null && (token.ToString() == "1" || string.Equals(token.ToString(), "true", StringComparison.OrdinalIgnoreCase));
        private static bool IsFalse(JToken token) => token != null && (token.ToString() == "0" || string.Equals(token.ToString(), "false", StringComparison.OrdinalIgnoreCase));
        private static bool IsBinaryType(string type) => new[] { "BINARY", "VARBINARY", "TINYBLOB", "BLOB", "MEDIUMBLOB", "LONGBLOB", "GEOMETRY", "POINT", "LINESTRING", "POLYGON", "MULTIPOINT", "MULTILINESTRING", "MULTIPOLYGON", "GEOMETRYCOLLECTION" }.Contains(type);
        private static bool IsTextType(string type) => new[] { "CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT", "JSON", "ENUM", "SET" }.Contains(type);
        private static bool IsNumericType(string type) => new[] { "TINYINT", "SMALLINT", "MEDIUMINT", "INT", "INTEGER", "BIGINT", "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "REAL", "YEAR" }.Contains(type);
        private static string QuoteIdentifier(string value) => "`" + (value ?? "").Replace("`", "``") + "`";
        private static string NowText() => DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
        private static string SanitizeFileName(string value) => string.Concat((value ?? "database").Select(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '_'));
        private static string NormalizeObjectPath(string value)
            => (value ?? "").Replace('\\', '/').Trim().TrimStart('/');
        private static string SafeError(Exception ex)
        {
            var message = ex?.Message ?? "未知错误";
            if (message.Length > 1000) message = message.Substring(0, 1000);
            return message.Replace("\r", " ").Replace("\n", " ");
        }
        private static string ComputeSha256(string path)
        {
            using var stream = File.OpenRead(path);
            using var sha = SHA256.Create();
            return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
        }
        private static void TryDeleteDirectory(string path)
        {
            try { if (Directory.Exists(path)) Directory.Delete(path, true); }
            catch (Exception ex) { MicroiEngine.QueueSystemLog(RuntimeMainOsClient(), "DatabaseBackup", "TemporaryDirectoryCleanupFailed", "清理数据库备份临时目录失败", ex.ToString(), 2, false, path); }
        }

        private sealed class TenantDatabase
        {
            public string Database { get; set; }
            public string ConnectionString { get; set; }
            public List<string> OsClients { get; set; }
            public string DisplayName => Database + " [" + string.Join(",", OsClients.Take(5)) + (OsClients.Count > 5 ? ",..." : "") + "]";
        }
        private sealed class ColumnInfo
        {
            public string Name { get; set; }
            public string DataType { get; set; }
            public string ColumnType { get; set; }
        }
        private sealed class ExportSummary { public int TableCount { get; set; } public long RowCount { get; set; } }

        private sealed class BackupFenceLostException : InvalidOperationException
        {
            public BackupFenceLostException(string message) : base(message) { }
        }

        private sealed class ExistingBackupCompletion
        {
            public string BackupNo { get; set; }
            public string Status { get; set; }
            public string FileName { get; set; }
            public string HdfsPath { get; set; }
            public long FileSize { get; set; }
            public string Sha256 { get; set; }
            public int TotalDatabases { get; set; }
            public int SuccessCount { get; set; }
            public int FailedCount { get; set; }
            public string Message { get; set; }

            public DosResult ToResult(string recordId)
            {
                var code = string.Equals(Status, "Succeeded", StringComparison.OrdinalIgnoreCase) ? 1 : 0;
                return new DosResult(code, new
                {
                    RecordId = recordId,
                    BackupNo,
                    Status,
                    FileName,
                    FileSize,
                    Sha256,
                    TotalDatabases,
                    SuccessCount,
                    FailedCount,
                    ReusedCompletedRecord = true
                }, Message);
            }
        }

        private sealed class DistributedBackupLease : IDisposable
        {
            private const int LeaseMilliseconds = 90000;
            private readonly IDatabase _database;
            private readonly string _lockKey;
            private readonly CancellationTokenSource _renewCancellation = new CancellationTokenSource();
            private readonly Task _renewTask;
            private int _lost;
            public string Owner { get; }

            private DistributedBackupLease(IDatabase database, string lockKey, string owner)
            {
                _database = database;
                _lockKey = lockKey;
                Owner = owner;
                _renewTask = Task.Run(RenewLoop);
            }

            public static DistributedBackupLease Acquire(
                string osClient,
                Action waitingCallback,
                Func<bool> cancellationRequested)
            {
                var database = MicroiEngine.CacheTenant.Default().GetIDatabase()
                               ?? throw new InvalidOperationException("Redis 不可用，已拒绝在无分布式锁情况下执行备份。");
                var keySegment = NormalizeKeySegment(osClient);
                var lockKey = $"Microi:{keySegment}:DatabaseBackup:Lease";
                var fenceKey = $"Microi:{keySegment}:DatabaseBackup:FencingToken";
                var instanceToken = Guid.NewGuid().ToString("N");
                const string acquireScript = @"
if redis.call('exists', KEYS[1]) == 0 then
  local fence = redis.call('incr', KEYS[2])
  local owner = tostring(fence) .. ':' .. ARGV[1]
  redis.call('psetex', KEYS[1], ARGV[2], owner)
  return owner
end
return ''";
                while (true)
                {
                    if (cancellationRequested?.Invoke() == true) throw new OperationCanceledException();
                    var result = database.ScriptEvaluate(acquireScript,
                        new RedisKey[] { lockKey, fenceKey },
                        new RedisValue[] { instanceToken, LeaseMilliseconds });
                    var owner = result.ToString();
                    if (!string.IsNullOrWhiteSpace(owner)) return new DistributedBackupLease(database, lockKey, owner);
                    waitingCallback?.Invoke();
                    Thread.Sleep(2000);
                }
            }

            public void ThrowIfLost()
            {
                if (Volatile.Read(ref _lost) != 0)
                    throw new InvalidOperationException("数据库备份分布式租约已丢失，已在上传前安全终止。");
            }

            private async Task RenewLoop()
            {
                const string renewScript = @"
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0";
                while (!_renewCancellation.IsCancellationRequested)
                {
                    try
                    {
                        await Task.Delay(20000, _renewCancellation.Token).ConfigureAwait(false);
                        var renewed = (long)await _database.ScriptEvaluateAsync(renewScript,
                            new RedisKey[] { _lockKey },
                            new RedisValue[] { Owner, LeaseMilliseconds }).ConfigureAwait(false);
                        if (renewed != 1) { Interlocked.Exchange(ref _lost, 1); return; }
                    }
                    catch (OperationCanceledException) { return; }
                    catch { Interlocked.Exchange(ref _lost, 1); return; }
                }
            }

            public void Dispose()
            {
                _renewCancellation.Cancel();
                try { _renewTask.Wait(TimeSpan.FromSeconds(3)); } catch { }
                const string releaseScript = @"
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0";
                try
                {
                    _database.ScriptEvaluate(releaseScript,
                        new RedisKey[] { _lockKey }, new RedisValue[] { Owner });
                }
                catch { }
                _renewCancellation.Dispose();
            }

            private static string NormalizeKeySegment(string value)
            {
                if (string.IsNullOrWhiteSpace(value)) return "unknown";
                return new string(value.Trim()
                    .Select(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' || ch == '.' ? ch : '_')
                    .ToArray());
            }
        }
    }
}
