using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace Dos.ORM
{
    /// <summary>仅可信 CLR 范围观察实际 DDL；不接受 HTTP/V8 标记，不改变数据库执行或事务。</summary>
    internal sealed class DdlExecutionObservation : IDisposable
    {
        private static readonly AsyncLocal<DdlExecutionObservation> Current = new AsyncLocal<DdlExecutionObservation>();
        private readonly DdlExecutionObservation _previous;
        private readonly List<DdlExecutionEvent> _events = new List<DdlExecutionEvent>();
        private int _statements;
        private bool _disposed;
        internal int Dropped { get; private set; }
        internal IReadOnlyList<DdlExecutionEvent> Events { get { lock (_events) return _events.ToArray(); } }
        private DdlExecutionObservation() { _previous = Current.Value; Current.Value = this; }
        internal static DdlExecutionObservation Begin() => new DdlExecutionObservation();
        public void Dispose() { lock (_events) _disposed = true; if (ReferenceEquals(Current.Value, this)) Current.Value = _previous; }

        private DdlExecutionEvent Start(DbCommand command)
        {
            if (command.CommandType != CommandType.Text) return null;
            var sql = Project(command.CommandText);
            if (sql == null) return null;
            lock (_events)
            {
                if (_disposed) return null;
                if (_statements >= 64) { Dropped++; return null; }
                var record = new DdlExecutionEvent { Id = ++_statements, Statement = sql, State = "submitted", TransactionPending = command.Transaction != null, ObservedAtUtc = DateTimeOffset.UtcNow.ToString("o") };
                _events.Add(record);
                return record;
            }
        }
        private void Finish(DdlExecutionEvent record, bool success)
        {
            if (record == null) return;
            lock (_events) if (!_disposed) _events.Add(new DdlExecutionEvent { Id = record.Id, Statement = record.Statement,
                State = success ? "executed" : "failed", TransactionPending = record.TransactionPending, ObservedAtUtc = DateTimeOffset.UtcNow.ToString("o") });
        }
        internal static int Execute(DbCommand command, Func<int> run)
        {
            var scope = Current.Value;
            var record = scope?.Start(command);
            try { var result = run(); scope?.Finish(record, true); return result; }
            catch { scope?.Finish(record, false); throw; }
        }
        internal static async Task<int> ExecuteAsync(DbCommand command, Func<Task<int>> run)
        {
            var scope = Current.Value;
            var record = scope?.Start(command);
            try { var result = await run().ConfigureAwait(false); scope?.Finish(record, true); return result; }
            catch { scope?.Finish(record, false); throw; }
        }

        internal static string Project(string sql)
        {
            if (string.IsNullOrWhiteSpace(sql) || !Regex.IsMatch(sql, @"^\s*(CREATE\s+(UNIQUE\s+)?(TABLE|INDEX)|ALTER\s+TABLE|DROP\s+(TABLE|INDEX)|RENAME\s+TABLE|TRUNCATE\s+TABLE)\b", RegexOptions.IgnoreCase)) return null;
            var safe = new StringBuilder();
            for (var index = 0; index < sql.Length; index++)
            {
                if (sql[index] == '\'' || sql[index] == '"')
                {
                    var quote = sql[index];
                    // 双引号在部分方言是标识符、MySQL 默认模式却可为字面量；无模式事实时保守隐藏。
                    safe.Append(quote).Append("[已隐藏]").Append(quote);
                    for (index++; index < sql.Length; index++)
                    {
                        if (sql[index] == '\\') { index++; continue; }
                        if (sql[index] != quote) continue;
                        if (index + 1 < sql.Length && sql[index + 1] == quote) { index++; continue; }
                        break;
                    }
                }
                else if (sql[index] == '#' || (index + 1 < sql.Length && sql[index] == '-' && sql[index + 1] == '-'))
                {
                    while (index < sql.Length && sql[index] != '\n') index++;
                    safe.Append(" /* 已隐藏注释 */ ");
                }
                else if (index + 1 < sql.Length && sql[index] == '/' && sql[index + 1] == '*')
                {
                    var end = sql.IndexOf("*/", index + 2, StringComparison.Ordinal);
                    index = end < 0 ? sql.Length : end + 1;
                    safe.Append(" /* 已隐藏注释 */ ");
                }
                else if (sql[index] == '$' && Regex.Match(sql.Substring(index), @"^\$[A-Za-z0-9_]*\$") is Match match && match.Success)
                {
                    var end = sql.IndexOf(match.Value, index + match.Length, StringComparison.Ordinal);
                    index = end < 0 ? sql.Length : end + match.Length - 1;
                    safe.Append("$$[已隐藏]$$");
                }
                else safe.Append(sql[index]);
            }
            var result = safe.ToString();
            // 混合 DML/存储过程不向 UI 投影，防止业务值或服务端脚本混入 DDL 过程。
            if (Regex.IsMatch(result, @"\b(INSERT|UPDATE|DELETE|MERGE|SELECT|EXEC|EXECUTE)\b", RegexOptions.IgnoreCase)) return null;
            result = Regex.Replace(result, @"\b(DEFAULT|COMMENT)\s*(?:=\s*)?(?:""(?:[^""]|"""")*""|[bBnN]?'\[已隐藏\]'|[^\s,)]+)", "$1 [已隐藏]", RegexOptions.IgnoreCase);
            result = Regex.Replace(result, @"\b0x[0-9a-f]+\b", "[已隐藏]", RegexOptions.IgnoreCase);
            return result.Length <= 4096 ? result : result.Substring(0, 4096) + " /* 已截断 */";
        }
    }

    internal sealed class DdlExecutionEvent
    {
        public int Id { get; set; }
        public string Statement { get; set; }
        public string State { get; set; }
        public bool TransactionPending { get; set; }
        public string ObservedAtUtc { get; set; }
    }
}
