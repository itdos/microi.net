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
using MySql.Data.MySqlClient;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// iTdos 主租户的 SaaS MySQL 在线备份服务。
    ///
    /// 设计约束：全部数据库串行导出；Redis 租约跨节点互斥且可续租；每个数据库使用
    /// REPEATABLE READ 一致性快照，不加全局读锁；压缩使用 Fastest 并按行节流；
    /// HDFS 只写私有对象。任务结果不返回 HDFS 路径或下载地址。
    /// </summary>
    public sealed class DatabaseBackupService
    {
        public const string RequiredOsClient = "iTdos";
        public const string WorkerApiEngineKey = "database-backup-worker";
        public const string SchedulerApiEngineKey = "database-backup-scheduler";
        public const string ScheduledJobId = "microiDatabaseBackupScheduler";
        private const string RecordTable = "mci_database_backup";
        private const int MaxLogChars = 120000;
        private const int ThrottleRows = 200;
        private const int ThrottleDelayMilliseconds = 15;
        private readonly string _backgroundTaskId;
        private readonly StringBuilder _log = new StringBuilder();
        private string _recordId;

        public DatabaseBackupService(string backgroundTaskId)
        {
            _backgroundTaskId = backgroundTaskId ?? "";
        }

        public DosResult Run(JObject currentUser, string osClient, string triggerType, int retainCount)
        {
            var permission = ValidatePermission(currentUser, osClient);
            if (permission.Code != 1) return permission;

            retainCount = Math.Max(1, Math.Min(100, retainCount <= 0 ? 7 : retainCount));
            triggerType = string.Equals(triggerType, "Scheduled", StringComparison.OrdinalIgnoreCase)
                ? "Scheduled"
                : "Manual";
            var userId = currentUser?["Id"]?.ToString() ?? "";
            var userName = currentUser?["Name"]?.ToString()
                           ?? currentUser?["Account"]?.ToString()
                           ?? "系统管理员";
            var backupNo = "DBBK-" + DateTime.Now.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture)
                           + "-" + Guid.NewGuid().ToString("N").Substring(0, 8).ToUpperInvariant();
            _recordId = Guid.NewGuid().ToString();
            string workDirectory = null;
            DistributedBackupLease lease = null;

            try
            {
                InsertQueuedRecord(backupNo, triggerType, userId, userName);
                AppendLog("任务已进入全局串行队列，等待上一个数据库备份完成。", "Queued", 2);
                Report(2, "排队中：等待上一个数据库备份完成", 0, 0);

                lease = DistributedBackupLease.Acquire(
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

                var databases = SnapshotDatabases();
                if (databases.Count == 0)
                {
                    throw new InvalidOperationException("未发现可备份的已启用 SaaS MySQL 数据库。");
                }
                UpdateRecord(new Dictionary<string, object> { ["TotalDatabases"] = databases.Count });
                Report(6, $"已发现 {databases.Count} 个去重后的 SaaS 数据库", 0, databases.Count);

                workDirectory = Path.Combine(Path.GetTempPath(), "microi-database-backup", _recordId);
                Directory.CreateDirectory(workDirectory);
                var fileName = $"microi-saas-databases-{DateTime.Now:yyyyMMdd-HHmmss}-{_recordId.Substring(0, 8)}.zip";
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
                var hdfsPath = $"/database-backups/{DateTime.Now:yyyy/MM}/{fileName}";
                UploadPrivate(zipPath, hdfsPath);
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
                    ["HdfsPath"] = hdfsPath,
                    ["FileSize"] = fileSize,
                    ["Sha256"] = sha256,
                    ["RetentionStatus"] = "Active",
                    ["SuccessCount"] = successCount,
                    ["FailedCount"] = failedCount,
                    ["LeaseOwner"] = "",
                    ["LeaseExpiresAt"] = "",
                    ["Log"] = GetLogText(),
                    ["ErrorSummary"] = failedCount == 0 ? "" : finalMessage
                });
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
            catch (OperationCanceledException)
            {
                FinishFailure("Interrupted", "备份任务已停止；未完成的本地临时文件已清理。", true);
                return new DosResult(0, new { RecordId = _recordId, Status = "Interrupted" }, "数据库备份已停止。");
            }
            catch (Exception ex)
            {
                var safeError = SafeError(ex);
                FinishFailure("Failed", safeError, false);
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
            var builder = new MySqlConnectionStringBuilder(database.ConnectionString)
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
                    WriteSqlValue(reader, index, columns[index].DataType, writer);
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

        private List<TenantDatabase> SnapshotDatabases()
        {
            var result = new Dictionary<string, TenantDatabase>(StringComparer.OrdinalIgnoreCase);
            foreach (var pair in OsClientExtend.ClientList.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase))
            {
                var client = pair.Value;
                var model = client?.OsClientModel;
                if (model == null || IsFalse(model["IsEnable"]) || IsTrue(model["IsDeleted"])) continue;
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
                    var builder = new MySqlConnectionStringBuilder(connectionString);
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

        private void InsertQueuedRecord(string backupNo, string triggerType, string userId, string userName)
        {
            using var connection = OpenMainConnection();
            using var command = connection.CreateCommand();
            command.CommandText = $@"INSERT INTO `{RecordTable}`
(`Id`,`CreateTime`,`UpdateTime`,`UserId`,`UserName`,`IsDeleted`,`BackupNo`,`TriggerType`,`Status`,`Progress`,
 `TotalDatabases`,`CompletedDatabases`,`SuccessCount`,`FailedCount`,`BackgroundTaskId`,`RequestedById`,`RequestedByName`,`RetentionStatus`,`Log`)
VALUES (@id,@now,@now,@userId,@userName,0,@backupNo,@triggerType,'Queued',0,0,0,0,0,@taskId,@userId,@userName,'Active','');";
            command.Parameters.AddWithValue("@id", _recordId);
            command.Parameters.AddWithValue("@now", NowText());
            command.Parameters.AddWithValue("@userId", userId);
            command.Parameters.AddWithValue("@userName", userName);
            command.Parameters.AddWithValue("@backupNo", backupNo);
            command.Parameters.AddWithValue("@triggerType", triggerType);
            command.Parameters.AddWithValue("@taskId", _backgroundTaskId);
            command.ExecuteNonQuery();
        }

        private void UpdateRecord(IReadOnlyDictionary<string, object> values)
        {
            if (string.IsNullOrWhiteSpace(_recordId) || values == null || values.Count == 0) return;
            var allowed = new HashSet<string>(new[]
            {
                "Status","Progress","TotalDatabases","CompletedDatabases","SuccessCount","FailedCount",
                "CurrentDatabase","StartedAt","FinishedAt","FileName","HdfsPath","FileSize","Sha256",
                "LeaseOwner","LeaseExpiresAt","RetentionStatus","Log","ErrorSummary"
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
            command.CommandText = $"UPDATE `{RecordTable}` SET {string.Join(",", sets)} WHERE `Id`=@id;";
            command.Parameters.AddWithValue("@id", _recordId);
            command.ExecuteNonQuery();
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

        private void FinishFailure(string status, string error, bool interrupted)
        {
            try
            {
                AppendLog(error, null, null, false);
                UpdateRecord(new Dictionary<string, object>
                {
                    ["Status"] = status,
                    ["Progress"] = interrupted ? 100 : 100,
                    ["FinishedAt"] = NowText(),
                    ["CurrentDatabase"] = "",
                    ["LeaseOwner"] = "",
                    ["LeaseExpiresAt"] = "",
                    ["Log"] = GetLogText(),
                    ["ErrorSummary"] = error
                });
                Report(100, error, 0, 0);
            }
            catch (Exception logError)
            {
                Console.WriteLine("Microi：写入数据库备份失败状态时出错：" + SafeError(logError));
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
                        ClientModel = OsClientExtend.GetClient(RequiredOsClient),
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
            var client = OsClientExtend.GetClient(RequiredOsClient)
                         ?? throw new InvalidOperationException("未读取到 iTdos HDFS 配置。");
            using var stream = new FileStream(zipPath, FileMode.Open, FileAccess.Read, FileShare.Read, 1024 * 1024, FileOptions.SequentialScan);
            var result = GetHdfs().PutObject(new HDFSParam
            {
                ClientModel = client,
                Limit = true,
                Preview = false,
                FileFullPath = hdfsPath,
                FileStream = stream
            }).GetAwaiter().GetResult();
            if (result == null || result.Code != 1)
                throw new InvalidOperationException("上传 HDFS 私有桶失败：" + (result?.Msg ?? "未知错误"));
        }

        private static IMicroiHDFS GetHdfs()
        {
            var client = OsClientExtend.GetClient(RequiredOsClient)
                         ?? throw new InvalidOperationException("未读取到 iTdos HDFS 配置。");
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
            var connection = new MySqlConnection(OsClientDefault.OsClientDbConn);
            connection.Open();
            return connection;
        }

        private static DosResult ValidatePermission(JObject currentUser, string osClient)
        {
            if (!string.Equals(osClient, RequiredOsClient, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(OsClientDefault.OsClient, RequiredOsClient, StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "数据库备份仅允许在 iTdos 主租户执行。");
            int.TryParse(currentUser?["Level"]?.ToString(), out var level);
            if (string.IsNullOrWhiteSpace(currentUser?["Id"]?.ToString()) || level < 9999)
                return new DosResult(0, null, "仅 iTdos 超级管理员可执行数据库备份。");
            return new DosResult(1);
        }

        private void Report(int progress, string message, int current, int total)
        {
            BackgroundTaskRuntime.TryUpdateProgress(_backgroundTaskId, Math.Max(0, Math.Min(100, progress)), message, current, total);
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
        private static bool IsBinaryType(string type) => new[] { "BINARY", "VARBINARY", "TINYBLOB", "BLOB", "MEDIUMBLOB", "LONGBLOB", "BIT", "GEOMETRY", "POINT", "LINESTRING", "POLYGON", "MULTIPOINT", "MULTILINESTRING", "MULTIPOLYGON", "GEOMETRYCOLLECTION" }.Contains(type);
        private static bool IsTextType(string type) => new[] { "CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT", "JSON", "ENUM", "SET" }.Contains(type);
        private static bool IsNumericType(string type) => new[] { "TINYINT", "SMALLINT", "MEDIUMINT", "INT", "INTEGER", "BIGINT", "DECIMAL", "NUMERIC", "FLOAT", "DOUBLE", "REAL", "YEAR" }.Contains(type);
        private static string QuoteIdentifier(string value) => "`" + (value ?? "").Replace("`", "``") + "`";
        private static string NowText() => DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
        private static string SanitizeFileName(string value) => string.Concat((value ?? "database").Select(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_' ? ch : '_'));
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
            catch (Exception ex) { Console.WriteLine("Microi：清理数据库备份临时目录失败：" + SafeError(ex)); }
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

        private sealed class DistributedBackupLease : IDisposable
        {
            private const string LockKey = "Microi:iTdos:DatabaseBackup:Lease";
            private const string FenceKey = "Microi:iTdos:DatabaseBackup:FencingToken";
            private const int LeaseMilliseconds = 90000;
            private readonly IDatabase _database;
            private readonly CancellationTokenSource _renewCancellation = new CancellationTokenSource();
            private readonly Task _renewTask;
            private int _lost;
            public string Owner { get; }

            private DistributedBackupLease(IDatabase database, string owner)
            {
                _database = database;
                Owner = owner;
                _renewTask = Task.Run(RenewLoop);
            }

            public static DistributedBackupLease Acquire(Action waitingCallback, Func<bool> cancellationRequested)
            {
                var database = MicroiEngine.CacheTenant.Default().GetIDatabase()
                               ?? throw new InvalidOperationException("Redis 不可用，已拒绝在无分布式锁情况下执行备份。");
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
                        new RedisKey[] { LockKey, FenceKey },
                        new RedisValue[] { instanceToken, LeaseMilliseconds });
                    var owner = result.ToString();
                    if (!string.IsNullOrWhiteSpace(owner)) return new DistributedBackupLease(database, owner);
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
                            new RedisKey[] { LockKey },
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
                        new RedisKey[] { LockKey }, new RedisValue[] { Owner });
                }
                catch { }
                _renewCancellation.Dispose();
            }
        }
    }
}
