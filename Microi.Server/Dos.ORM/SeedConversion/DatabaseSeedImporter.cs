using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using MySql.Data.MySqlClient;

namespace Dos.ORM.SeedConversion
{
    /// <summary>
    /// 将标准 MySQL 5.7 空库模板导入当前 DbSession。数据库选择、转换和批次方言
    /// 均封装在 Dos.ORM；Oracle/达梦在值封套运行时完整接入前保持 fail-closed。
    /// </summary>
    public static class DatabaseSeedImporter
    {
        public static SeedImportResult ImportMySql57(DbSession targetSession, string sourceSql)
        {
            if (targetSession == null) throw new ArgumentNullException(nameof(targetSession));
            if (string.IsNullOrWhiteSpace(sourceSql))
                throw new ArgumentException("MySQL 5.7 seed SQL is required.", nameof(sourceSql));

            var databaseType = targetSession.Db.DbProvider.DatabaseType;
            if (databaseType == DatabaseType.MySql)
            {
                var connectionBuilder = new MySqlConnectionStringBuilder(
                    targetSession.Db.ConnectionString)
                {
                    AllowUserVariables = true,
                    DefaultCommandTimeout = 0
                };
                using (var connection = new MySqlConnection(connectionBuilder.ConnectionString))
                {
                    connection.Open();
                    var statementCount = new MySqlScript(connection, sourceSql).Execute();
                    return new SeedImportResult(
                        statementCount,
                        0,
                        0,
                        false,
                        "SQL完整导入成功，共执行" + statementCount + "条");
                }
            }

            var target = DatabaseSeedConverter.GetTarget(databaseType);
            string convertedSql;
            SeedConversionResult conversion;
            using (var source = new StringReader(sourceSql))
            using (var destination = new StringWriter())
            {
                conversion = DatabaseSeedConverter.ConvertMySql57(
                    source,
                    destination,
                    target);
                convertedSql = destination.ToString();
            }

            var batchCount = 0;
            foreach (var batch in DatabaseSeedConverter.GetExecutionBatches(
                         convertedSql,
                         conversion))
            {
                targetSession.FromSql(batch).ExecuteNonQuery();
                batchCount++;
            }

            return new SeedImportResult(
                batchCount,
                conversion.TableCount,
                conversion.RowCount,
                true,
                "空库转换、导入成功，共 " + conversion.TableCount
                + " 张表、" + conversion.RowCount + " 行数据");
        }

        /// <summary>
        /// 以有界内存流式导入 MySQL SQL。用于数据库备份恢复等大型 SQL；
        /// 不把完整脚本读取成 byte[]/string。当前流式入口只允许 MySQL 目标，
        /// 跨数据库转换仍使用上面的字符串入口以保持既有转换语义。
        /// </summary>
        public static SeedImportResult ImportMySql57(
            DbSession targetSession,
            TextReader sourceSql,
            Action<SeedImportProgress> reportProgress = null,
            Func<bool> isCancellationRequested = null)
        {
            if (targetSession == null) throw new ArgumentNullException(nameof(targetSession));
            if (sourceSql == null) throw new ArgumentNullException(nameof(sourceSql));
            if (targetSession.Db.DbProvider.DatabaseType != DatabaseType.MySql)
            {
                throw new NotSupportedException(
                    "大型 SQL 流式导入当前仅支持 MySQL；其它数据库请使用标准空库转换流程。");
            }

            var connectionBuilder = new MySqlConnectionStringBuilder(
                targetSession.Db.ConnectionString)
            {
                AllowBatch = true,
                AllowUserVariables = true,
                DefaultCommandTimeout = 0
            };
            using var connection = new MySqlConnection(connectionBuilder.ConnectionString);
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandTimeout = 0;

            var statementCount = 0;
            var batchNumber = 0;
            var scriptTransactionActive = false;
            var autocommitDisabled = false;
            var tableLocksActive = false;
            foreach (var batch in BuildMySqlExecutionBatches(ReadMySqlStatements(sourceSql)))
            {
                if (isCancellationRequested?.Invoke() == true)
                    throw new OperationCanceledException("数据库导入已收到停止请求。");

                batchNumber++;
                reportProgress?.Invoke(new SeedImportProgress(
                    "Executing",
                    batchNumber,
                    statementCount,
                    batch.StatementCount,
                    batch.Sql.Length,
                    batch.StatementKind,
                    null));
                MySqlTransaction transaction = null;
                try
                {
                    var transactional = string.Equals(batch.StatementKind, "INSERT", StringComparison.Ordinal)
                                        || string.Equals(batch.StatementKind, "REPLACE", StringComparison.Ordinal);
                    var sessionControl = ClassifyMySqlSessionControl(batch.Sql);
                    if (transactional
                        && !scriptTransactionActive
                        && !autocommitDisabled
                        && !tableLocksActive)
                    {
                        transaction = connection.BeginTransaction();
                        command.Transaction = transaction;
                    }
                    command.CommandText = batch.Sql;
                    var affectedRows = command.ExecuteNonQuery();
                    transaction?.Commit();
                    ApplyMySqlSessionControl(
                        sessionControl,
                        ref scriptTransactionActive,
                        ref autocommitDisabled,
                        ref tableLocksActive);
                    statementCount += batch.StatementCount;
                    reportProgress?.Invoke(new SeedImportProgress(
                        "Executed",
                        batchNumber,
                        statementCount,
                        batch.StatementCount,
                        batch.Sql.Length,
                        batch.StatementKind,
                        affectedRows));
                }
                catch (Exception ex)
                {
                    try { transaction?.Rollback(); } catch { }
                    var firstStatement = statementCount + 1;
                    var lastStatement = statementCount + batch.StatementCount;
                    throw new InvalidDataException(
                        "执行 SQL 批次 " + firstStatement + "-" + lastStatement
                        + " 失败（类型 " + batch.StatementKind + "）：" + ex.Message,
                        ex);
                }
                finally
                {
                    command.Transaction = null;
                    transaction?.Dispose();
                }
            }
            if (statementCount == 0)
                throw new InvalidDataException("SQL 文件中没有可执行语句。");

            return new SeedImportResult(
                statementCount,
                0,
                0,
                false,
                "SQL流式完整导入成功，共执行" + statementCount + "条");
        }

        /// <summary>
        /// 将连续 INSERT/REPLACE 合并为有界多语句批次，显著降低大库逐行备份的
        /// 网络往返和自动提交开销。DDL、SET、存储过程等语句保持逐条执行，避免
        /// 改变隐式提交及 DELIMITER 语义。
        /// </summary>
        public static IEnumerable<SeedImportBatch> BuildMySqlExecutionBatches(
            IEnumerable<string> statements,
            int maximumBatchCharacters = 1024 * 1024,
            int maximumBatchStatements = 500)
        {
            if (statements == null) throw new ArgumentNullException(nameof(statements));
            if (maximumBatchCharacters <= 0)
                throw new ArgumentOutOfRangeException(nameof(maximumBatchCharacters));
            if (maximumBatchStatements <= 0)
                throw new ArgumentOutOfRangeException(nameof(maximumBatchStatements));

            var buffer = new StringBuilder(Math.Min(maximumBatchCharacters, 64 * 1024));
            var bufferedStatements = 0;
            var bufferedKind = "";

            foreach (var rawStatement in statements)
            {
                var statement = (rawStatement ?? "").Trim();
                if (statement.Length == 0) continue;
                var statementKind = GetLeadingSqlKeyword(statement);
                var canBatch = string.Equals(statementKind, "INSERT", StringComparison.Ordinal)
                               || string.Equals(statementKind, "REPLACE", StringComparison.Ordinal);

                if (!canBatch || statement.Length + 2 > maximumBatchCharacters)
                {
                    if (bufferedStatements > 0)
                    {
                        yield return new SeedImportBatch(
                            buffer.ToString(), bufferedStatements, bufferedKind, true);
                        buffer.Clear();
                        bufferedStatements = 0;
                        bufferedKind = "";
                    }
                    yield return new SeedImportBatch(
                        statement, 1, string.IsNullOrWhiteSpace(statementKind) ? "OTHER" : statementKind, false);
                    continue;
                }

                var requiredCharacters = statement.Length + 2;
                if (bufferedStatements > 0
                    && (bufferedStatements >= maximumBatchStatements
                        || buffer.Length + requiredCharacters > maximumBatchCharacters
                        || !string.Equals(bufferedKind, statementKind, StringComparison.Ordinal)))
                {
                    yield return new SeedImportBatch(
                        buffer.ToString(), bufferedStatements, bufferedKind, true);
                    buffer.Clear();
                    bufferedStatements = 0;
                    bufferedKind = "";
                }

                if (bufferedStatements == 0) bufferedKind = statementKind;
                buffer.Append(statement);
                buffer.Append(';');
                buffer.Append('\n');
                bufferedStatements++;
            }

            if (bufferedStatements > 0)
            {
                yield return new SeedImportBatch(
                    buffer.ToString(), bufferedStatements, bufferedKind, true);
            }
        }

        /// <summary>
        /// 识别会影响后续事务边界的会话语句。恢复脚本若已显式管理事务、关闭
        /// autocommit 或持有 LOCK TABLES，导入器不得再嵌套本地事务。
        /// </summary>
        public static SeedImportSessionControl ClassifyMySqlSessionControl(string sql)
        {
            if (string.IsNullOrWhiteSpace(sql)) return SeedImportSessionControl.None;

            var statementKind = GetLeadingSqlKeyword(sql);
            var sessionSql = sql;
            if (statementKind.Length == 0
                && TryGetExecutableVersionCommentBody(sql, out var versionCommentBody))
            {
                sessionSql = versionCommentBody;
                statementKind = GetLeadingSqlKeyword(sessionSql);
            }
            var compact = CompactSqlPrefix(sessionSql, 512);

            switch (statementKind)
            {
                case "START":
                    return compact.StartsWith("STARTTRANSACTION", StringComparison.Ordinal)
                        ? SeedImportSessionControl.BeginTransaction
                        : SeedImportSessionControl.None;
                case "BEGIN":
                    return SeedImportSessionControl.BeginTransaction;
                case "COMMIT":
                    return SeedImportSessionControl.CommitOrRollback;
                case "ROLLBACK":
                    return compact.StartsWith("ROLLBACKTO", StringComparison.Ordinal)
                        ? SeedImportSessionControl.None
                        : SeedImportSessionControl.CommitOrRollback;
                case "LOCK":
                    return compact.StartsWith("LOCKTABLES", StringComparison.Ordinal)
                        ? SeedImportSessionControl.LockTables
                        : SeedImportSessionControl.None;
                case "UNLOCK":
                    return compact.StartsWith("UNLOCKTABLES", StringComparison.Ordinal)
                        ? SeedImportSessionControl.UnlockTables
                        : SeedImportSessionControl.None;
                case "SET":
                    if (compact.Contains("AUTOCOMMIT=0", StringComparison.Ordinal)
                        || compact.Contains("AUTOCOMMIT:=0", StringComparison.Ordinal)
                        || compact.Contains("AUTOCOMMIT=OFF", StringComparison.Ordinal))
                    {
                        return SeedImportSessionControl.DisableAutocommit;
                    }
                    if (compact.Contains("AUTOCOMMIT=1", StringComparison.Ordinal)
                        || compact.Contains("AUTOCOMMIT:=1", StringComparison.Ordinal)
                        || compact.Contains("AUTOCOMMIT=ON", StringComparison.Ordinal))
                    {
                        return SeedImportSessionControl.EnableAutocommit;
                    }
                    break;
            }
            return SeedImportSessionControl.None;
        }

        private static void ApplyMySqlSessionControl(
            SeedImportSessionControl sessionControl,
            ref bool scriptTransactionActive,
            ref bool autocommitDisabled,
            ref bool tableLocksActive)
        {
            switch (sessionControl)
            {
                case SeedImportSessionControl.BeginTransaction:
                    scriptTransactionActive = true;
                    break;
                case SeedImportSessionControl.CommitOrRollback:
                    scriptTransactionActive = false;
                    break;
                case SeedImportSessionControl.DisableAutocommit:
                    autocommitDisabled = true;
                    scriptTransactionActive = false;
                    break;
                case SeedImportSessionControl.EnableAutocommit:
                    autocommitDisabled = false;
                    scriptTransactionActive = false;
                    break;
                case SeedImportSessionControl.LockTables:
                    tableLocksActive = true;
                    scriptTransactionActive = false;
                    break;
                case SeedImportSessionControl.UnlockTables:
                    tableLocksActive = false;
                    scriptTransactionActive = false;
                    break;
            }
        }

        private static bool TryGetExecutableVersionCommentBody(string sql, out string body)
        {
            body = "";
            var trimmed = sql.TrimStart();
            if (!trimmed.StartsWith("/*!", StringComparison.Ordinal)) return false;
            var end = trimmed.IndexOf("*/", 3, StringComparison.Ordinal);
            if (end < 0) return false;
            var index = 3;
            while (index < end && char.IsDigit(trimmed[index])) index++;
            while (index < end && char.IsWhiteSpace(trimmed[index])) index++;
            if (index >= end) return false;
            body = trimmed.Substring(index, end - index);
            return true;
        }

        private static string CompactSqlPrefix(string sql, int maximumCharacters)
        {
            var compact = new StringBuilder(Math.Min(sql.Length, maximumCharacters));
            for (var index = 0; index < sql.Length && compact.Length < maximumCharacters; index++)
            {
                var value = sql[index];
                if (char.IsWhiteSpace(value) || value == '`') continue;
                compact.Append(char.ToUpperInvariant(value));
            }
            return compact.ToString();
        }

        /// <summary>
        /// 流式拆分 MySQL 脚本。识别引号、反引号、行/块注释及 DELIMITER，
        /// 只保留当前一条语句，避免大型备份按整文件驻留内存。
        /// </summary>
        public static IEnumerable<string> ReadMySqlStatements(
            TextReader reader,
            int maximumStatementCharacters = 1024 * 1024 * 1024)
        {
            if (reader == null) throw new ArgumentNullException(nameof(reader));
            if (maximumStatementCharacters <= 0)
                throw new ArgumentOutOfRangeException(nameof(maximumStatementCharacters));

            var statement = new StringBuilder(64 * 1024);
            var delimiter = ";";
            var quote = '\0';
            var inBlockComment = false;
            var escapeNext = false;
            var hasExecutableContent = false;
            string line;
            var firstLine = true;

            while ((line = reader.ReadLine()) != null)
            {
                if (firstLine)
                {
                    line = line.TrimStart('\uFEFF');
                    firstLine = false;
                }

                if (quote == '\0' && !inBlockComment && !hasExecutableContent)
                {
                    var trimmed = line.Trim();
                    if (trimmed.StartsWith("DELIMITER ", StringComparison.OrdinalIgnoreCase))
                    {
                        var nextDelimiter = trimmed.Substring("DELIMITER ".Length).Trim();
                        if (nextDelimiter.Length == 0 || nextDelimiter.Length > 16
                            || nextDelimiter.IndexOfAny(new[] { '\r', '\n', '\0' }) >= 0)
                        {
                            throw new InvalidDataException("DELIMITER 指令不合法。");
                        }
                        statement.Clear();
                        hasExecutableContent = false;
                        delimiter = nextDelimiter;
                        continue;
                    }
                }

                var inLineComment = false;
                for (var index = 0; index < line.Length; index++)
                {
                    var current = line[index];
                    var next = index + 1 < line.Length ? line[index + 1] : '\0';

                    if (inLineComment)
                    {
                        AppendChecked(statement, current, maximumStatementCharacters);
                        continue;
                    }
                    if (inBlockComment)
                    {
                        AppendChecked(statement, current, maximumStatementCharacters);
                        if (current == '*' && next == '/')
                        {
                            AppendChecked(statement, next, maximumStatementCharacters);
                            index++;
                            inBlockComment = false;
                        }
                        continue;
                    }
                    if (quote != '\0')
                    {
                        AppendChecked(statement, current, maximumStatementCharacters);
                        if (escapeNext)
                        {
                            escapeNext = false;
                            continue;
                        }
                        if (current == '\\')
                        {
                            escapeNext = true;
                            continue;
                        }
                        if (current == quote)
                        {
                            if (next == quote)
                            {
                                AppendChecked(statement, next, maximumStatementCharacters);
                                index++;
                            }
                            else
                            {
                                quote = '\0';
                            }
                        }
                        continue;
                    }

                    if (current == '-' && next == '-'
                        && (index + 2 >= line.Length || char.IsWhiteSpace(line[index + 2])))
                    {
                        AppendChecked(statement, current, maximumStatementCharacters);
                        AppendChecked(statement, next, maximumStatementCharacters);
                        index++;
                        inLineComment = true;
                        continue;
                    }
                    if (current == '#')
                    {
                        AppendChecked(statement, current, maximumStatementCharacters);
                        inLineComment = true;
                        continue;
                    }
                    if (current == '/' && next == '*')
                    {
                        if (index + 2 < line.Length && line[index + 2] == '!')
                            hasExecutableContent = true;
                        AppendChecked(statement, current, maximumStatementCharacters);
                        AppendChecked(statement, next, maximumStatementCharacters);
                        index++;
                        inBlockComment = true;
                        continue;
                    }
                    if (current == '\'' || current == '"' || current == '`')
                    {
                        hasExecutableContent = true;
                        quote = current;
                        AppendChecked(statement, current, maximumStatementCharacters);
                        continue;
                    }
                    if (MatchesDelimiter(line, index, delimiter))
                    {
                        var sql = statement.ToString().Trim();
                        statement.Clear();
                        index += delimiter.Length - 1;
                        if (sql.Length > 0 && hasExecutableContent) yield return sql;
                        hasExecutableContent = false;
                        continue;
                    }

                    if (!char.IsWhiteSpace(current)) hasExecutableContent = true;
                    AppendChecked(statement, current, maximumStatementCharacters);
                }
                AppendChecked(statement, '\n', maximumStatementCharacters);
            }

            if (quote != '\0') throw new InvalidDataException("SQL 文件存在未闭合的字符串或标识符。");
            if (inBlockComment) throw new InvalidDataException("SQL 文件存在未闭合的块注释。");
            var remaining = statement.ToString().Trim();
            if (remaining.Length > 0 && hasExecutableContent) yield return remaining;
        }

        private static bool MatchesDelimiter(string line, int index, string delimiter)
        {
            if (delimiter.Length == 0 || index > line.Length - delimiter.Length) return false;
            return string.CompareOrdinal(line, index, delimiter, 0, delimiter.Length) == 0;
        }

        private static string GetLeadingSqlKeyword(string sql)
        {
            var index = 0;
            while (index < sql.Length)
            {
                while (index < sql.Length && char.IsWhiteSpace(sql[index])) index++;
                if (index >= sql.Length) return "";

                if (sql[index] == '#')
                {
                    index = SkipToNextLine(sql, index + 1);
                    continue;
                }
                if (index + 1 < sql.Length && sql[index] == '-' && sql[index + 1] == '-')
                {
                    index = SkipToNextLine(sql, index + 2);
                    continue;
                }
                if (index + 1 < sql.Length && sql[index] == '/' && sql[index + 1] == '*')
                {
                    var commentEnd = sql.IndexOf("*/", index + 2, StringComparison.Ordinal);
                    if (commentEnd < 0) return "";
                    index = commentEnd + 2;
                    continue;
                }
                break;
            }

            var start = index;
            while (index < sql.Length && char.IsLetter(sql[index])) index++;
            return index == start
                ? ""
                : sql.Substring(start, index - start).ToUpperInvariant();
        }

        private static int SkipToNextLine(string sql, int index)
        {
            while (index < sql.Length && sql[index] != '\r' && sql[index] != '\n') index++;
            return index;
        }

        private static void AppendChecked(StringBuilder target, char value, int maximumCharacters)
        {
            if (target.Length >= maximumCharacters)
            {
                throw new InvalidDataException(
                    "单条 SQL 语句超过流式导入安全上限，请调整数据库导出工具的批量 INSERT 行数后重试。");
            }
            target.Append(value);
        }
    }

    public enum SeedImportSessionControl
    {
        None = 0,
        BeginTransaction = 1,
        CommitOrRollback = 2,
        DisableAutocommit = 3,
        EnableAutocommit = 4,
        LockTables = 5,
        UnlockTables = 6
    }

    public sealed class SeedImportBatch
    {
        internal SeedImportBatch(
            string sql,
            int statementCount,
            string statementKind,
            bool batched)
        {
            Sql = sql;
            StatementCount = statementCount;
            StatementKind = statementKind;
            Batched = batched;
        }

        public string Sql { get; }
        public int StatementCount { get; }
        public string StatementKind { get; }
        public bool Batched { get; }
    }

    public sealed class SeedImportProgress
    {
        internal SeedImportProgress(
            string phase,
            int batchNumber,
            int executedStatementCount,
            int batchStatementCount,
            int batchCharacters,
            string statementKind,
            int? affectedRows)
        {
            Phase = phase;
            BatchNumber = batchNumber;
            ExecutedStatementCount = executedStatementCount;
            BatchStatementCount = batchStatementCount;
            BatchCharacters = batchCharacters;
            StatementKind = statementKind;
            AffectedRows = affectedRows;
        }

        public string Phase { get; }
        public int BatchNumber { get; }
        public int ExecutedStatementCount { get; }
        public int BatchStatementCount { get; }
        public int BatchCharacters { get; }
        public string StatementKind { get; }
        public int? AffectedRows { get; }
    }

    public sealed class SeedImportResult
    {
        internal SeedImportResult(
            int batchCount,
            int tableCount,
            long rowCount,
            bool converted,
            string summary)
        {
            BatchCount = batchCount;
            TableCount = tableCount;
            RowCount = rowCount;
            Converted = converted;
            Summary = summary;
        }

        public int BatchCount { get; }
        public int TableCount { get; }
        public long RowCount { get; }
        public bool Converted { get; }
        public string Summary { get; }
    }
}
