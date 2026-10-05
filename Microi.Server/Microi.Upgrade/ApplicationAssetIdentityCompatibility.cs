using System;
using System.Collections.Generic;
using System.Linq;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// 商城运行文件在 SQL Server 上的唯一身份兼容。只修复历史未过滤的已知索引，
    /// 不迁移发布历史、不创建发布审计表，也不改动租户自定义索引。
    /// </summary>
    internal static class ApplicationAssetIdentityCompatibility
    {
        private const string Table = "mci_ai_app_file";
        private const string Index = "ux_aaf_version_pathhash";
        private static readonly string[] Columns = { "VersionId", "FilePathHash" };

        internal static bool CurrentFileIdentityIndexReady(OsClientSecret client)
        {
            var type = client.Db.Db.DbProvider.DatabaseType;
            if ((type != DatabaseType.SqlServer && type != DatabaseType.SqlServer9) || !client.Db.TableExists(Table)) return true;
            var indexes = V8McpLogic.GetTableIndexes(client.OsClient, Table);
            if (indexes?.Code != 1) throw new InvalidOperationException(indexes?.Msg ?? "读取商城文件索引失败。");
            var actual = indexes.Data?.FirstOrDefault(row => string.Equals(row.Key_name, Index, StringComparison.OrdinalIgnoreCase));
            // 缺失索引由恢复包的物理声明安装；这里只修复已经存在的错误协议索引。
            if (actual == null) return true;
            if (!actual.IsUnique || !actual.Columns.SequenceEqual(Columns, StringComparer.OrdinalIgnoreCase))
                throw new InvalidOperationException("商城文件身份索引定义不匹配，拒绝覆盖自定义索引。");
            return IsCompatibleSqlServerNotNullFilter(ReadFilter(client), "VersionId", Columns);
        }

        internal static void EnsureCurrentFileIdentityIndex(OsClientSecret client)
        {
            if (CurrentFileIdentityIndexReady(client)) return;
            UpgradeExecutionLeaseContext.ConfirmOwnership();
            if (!string.IsNullOrWhiteSpace(ReadFilter(client)))
                throw new InvalidOperationException("商城文件身份索引包含未知过滤条件，拒绝覆盖。");
            // DROP_EXISTING 由数据库原子替换，失败不会先删除旧索引；租约与写后回读共同保护。
            client.Db.FromSql("CREATE UNIQUE INDEX [ux_aaf_version_pathhash] ON [mci_ai_app_file] ([VersionId],[FilePathHash]) WHERE [VersionId] IS NOT NULL WITH (DROP_EXISTING = ON)").ExecuteNonQuery();
            if (!CurrentFileIdentityIndexReady(client)) throw new InvalidOperationException("商城文件身份索引修复后回读失败。");
        }

        private static string ReadFilter(OsClientSecret client) => client.Db.FromSql(
            "SELECT filter_definition FROM sys.indexes WHERE object_id=OBJECT_ID(@p0) AND name=@p1")
            .AddInParameter("p0", Table).AddInParameter("p1", Index).ToScalar()?.ToString();

        internal static bool IsCompatibleSqlServerNotNullFilter(string predicate, string requiredColumn, IReadOnlyCollection<string> columns)
        {
            var normalized = NormalizeSqlPredicate(predicate);
            return normalized == (requiredColumn + "ISNOTNULL").ToUpperInvariant()
                || (columns.Contains(requiredColumn, StringComparer.OrdinalIgnoreCase)
                    && normalized == string.Join("AND", columns.Select(column => (column + "ISNOTNULL").ToUpperInvariant())));
        }

        internal static string NormalizeSqlPredicate(string predicate) => new string((predicate ?? string.Empty)
            .Where(c => !char.IsWhiteSpace(c) && c != '[' && c != ']' && c != '(' && c != ')').ToArray()).ToUpperInvariant();
    }
}
