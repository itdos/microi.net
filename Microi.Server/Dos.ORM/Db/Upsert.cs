/****************************************************
 * 文 件 名：Upsert.cs
 * 创建日期：2026-05-01
 * 文件描述：Upsert（InsertOrUpdate）扩展。
 *
 *   - SqlServer/SqlServer9 → MERGE INTO ... WHEN MATCHED THEN UPDATE WHEN NOT MATCHED THEN INSERT
 *   - MySQL                → INSERT ... ON DUPLICATE KEY UPDATE
 *   - PostgreSQL/KingBase  → INSERT ... ON CONFLICT (key) DO UPDATE SET
 *   - Oracle/达梦          → MERGE INTO
 *   - SQLite               → INSERT ... ON CONFLICT (key) DO UPDATE SET（3.24+）
 *   - 其他                 → 模拟：先 UPDATE 影响行数为 0 再 INSERT
 *
 *   全部走 DbParameter 参数化绑定，杜绝 SQL 注入。
 ******************************************************/

using Dos.ORM.Common;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Dos.ORM
{
    /// <summary>
    /// Upsert（InsertOrUpdate）扩展
    /// </summary>
    public static class UpsertExtensions
    {
        /// <summary>
        /// 同步 Upsert（按主键/唯一键存在则更新、否则插入）。
        /// </summary>
        /// <param name="dbSession">DbSession</param>
        /// <param name="entity">实体</param>
        /// <param name="conflictFields">冲突判定字段；为空时取 Identity / 主键。</param>
        /// <returns>受影响行数（部分库 MERGE 返回 1 或 2）</returns>
        public static int Upsert<TEntity>(this DbSession dbSession, TEntity entity, params Field[] conflictFields)
            where TEntity : Entity
        {
            return UpsertCore(dbSession, entity, conflictFields, async: false, CancellationToken.None)
                .GetAwaiter().GetResult();
        }

        /// <summary>
        /// 异步 Upsert
        /// </summary>
        public static Task<int> UpsertAsync<TEntity>(this DbSession dbSession, TEntity entity,
            CancellationToken ct = default, params Field[] conflictFields)
            where TEntity : Entity
        {
            return UpsertCore(dbSession, entity, conflictFields, async: true, ct);
        }

        private static async Task<int> UpsertCore<TEntity>(DbSession dbSession, TEntity entity,
            Field[] conflictFields, bool async, CancellationToken ct)
            where TEntity : Entity
        {
            if (dbSession == null) throw new ArgumentNullException(nameof(dbSession));
            if (entity == null) throw new ArgumentNullException(nameof(entity));

            var fields = entity.GetFields();
            var values = entity.GetValues();
            var identity = entity.GetIdentityField();
            var primary = entity.GetPrimaryKeyFields();

            var keys = (conflictFields != null && conflictFields.Length > 0)
                ? conflictFields
                : (primary != null && primary.Length > 0
                    ? primary
                    : (!object.ReferenceEquals(identity, null) ? new[] { identity } : null));
            if (keys == null || keys.Length == 0)
                throw new InvalidOperationException("Upsert 需要明确的冲突键字段（主键或显式 conflictFields）。");

            var provider = dbSession.Db.DbProvider;
            char L = provider.LeftToken, R = provider.RightToken;
            var dbType = provider.DatabaseType;
            string tableName = entity.GetTableName();

            var keyNames = new HashSet<string>(keys.Select(k => k.PropertyName), StringComparer.OrdinalIgnoreCase);
            // 排除 Identity 进入 INSERT 列（除非 Identity 也是冲突键）
            var insertList = new List<int>();
            for (int i = 0; i < fields.Length; i++)
            {
                if (!object.ReferenceEquals(identity, null)
                    && string.Equals(fields[i].PropertyName, identity.PropertyName, StringComparison.OrdinalIgnoreCase)
                    && !keyNames.Contains(fields[i].PropertyName))
                    continue;
                insertList.Add(i);
            }

            using (var cmd = provider.DbProviderFactory.CreateCommand())
            {
                string sql;
                switch (dbType)
                {
                    case DatabaseType.MySql:
                        sql = BuildMySqlUpsert(cmd, tableName, fields, values, insertList, keyNames, L, R);
                        break;
                    case DatabaseType.PostgreSql:
                    case DatabaseType.KingBase:
                    case DatabaseType.Sqlite3:
                        sql = BuildPgSqliteUpsert(cmd, tableName, fields, values, insertList, keys, keyNames, L, R);
                        break;
                    case DatabaseType.SqlServer:
                    case DatabaseType.SqlServer9:
                    case DatabaseType.Oracle:
                    case DatabaseType.DaMeng:
                        sql = BuildMergeUpsert(cmd, tableName, fields, values, insertList, keys, keyNames, L, R, dbType);
                        break;
                    default:
                        // Fallback: UPDATE 受影响为 0 → INSERT
                        return await FallbackUpsert(dbSession, tableName, fields, values, insertList, keys, keyNames,
                                                   L, R, async, ct).ConfigureAwait(false);
                }
                cmd.CommandText = sql;
                cmd.CommandType = CommandType.Text;
                if (async)
                    return await dbSession.Db.ExecuteNonQueryAsync(cmd).ConfigureAwait(false);
                else
                    return dbSession.Db.ExecuteNonQuery(cmd);
            }
        }

        private static string BuildMySqlUpsert(DbCommand cmd, string table, Field[] fields, object[] values,
            List<int> insertList, HashSet<string> keyNames, char L, char R)
        {
            var sb = new StringBuilder();
            sb.Append("INSERT INTO ").Append(L).Append(table).Append(R).Append(" (");
            for (int j = 0; j < insertList.Count; j++)
            {
                if (j > 0) sb.Append(',');
                sb.Append(L).Append(fields[insertList[j]].PropertyName).Append(R);
            }
            sb.Append(") VALUES (");
            int p = 0;
            for (int j = 0; j < insertList.Count; j++)
            {
                if (j > 0) sb.Append(',');
                string pn = "@p" + p;
                sb.Append(pn);
                AddParam(cmd, pn, values[insertList[j]]);
                p++;
            }
            sb.Append(") ON DUPLICATE KEY UPDATE ");
            bool first = true;
            for (int j = 0; j < insertList.Count; j++)
            {
                var f = fields[insertList[j]];
                if (keyNames.Contains(f.PropertyName)) continue;
                if (!first) sb.Append(',');
                sb.Append(L).Append(f.PropertyName).Append(R)
                  .Append("=VALUES(").Append(L).Append(f.PropertyName).Append(R).Append(')');
                first = false;
            }
            if (first)
            {
                // 没有非键字段，使用占位 update
                var k = keys(fields, keyNames).First();
                sb.Append(L).Append(k).Append(R).Append('=').Append(L).Append(k).Append(R);
            }
            return sb.ToString();
        }

        private static string BuildPgSqliteUpsert(DbCommand cmd, string table, Field[] fields, object[] values,
            List<int> insertList, Field[] keyFields, HashSet<string> keyNames, char L, char R)
        {
            var sb = new StringBuilder();
            sb.Append("INSERT INTO ").Append(L).Append(table).Append(R).Append(" (");
            for (int j = 0; j < insertList.Count; j++)
            {
                if (j > 0) sb.Append(',');
                sb.Append(L).Append(fields[insertList[j]].PropertyName).Append(R);
            }
            sb.Append(") VALUES (");
            int p = 0;
            for (int j = 0; j < insertList.Count; j++)
            {
                if (j > 0) sb.Append(',');
                string pn = "@p" + p;
                sb.Append(pn);
                AddParam(cmd, pn, values[insertList[j]]);
                p++;
            }
            sb.Append(") ON CONFLICT (");
            for (int k = 0; k < keyFields.Length; k++)
            {
                if (k > 0) sb.Append(',');
                sb.Append(L).Append(keyFields[k].PropertyName).Append(R);
            }
            sb.Append(") DO UPDATE SET ");
            bool first = true;
            for (int j = 0; j < insertList.Count; j++)
            {
                var f = fields[insertList[j]];
                if (keyNames.Contains(f.PropertyName)) continue;
                if (!first) sb.Append(',');
                sb.Append(L).Append(f.PropertyName).Append(R)
                  .Append("=EXCLUDED.").Append(L).Append(f.PropertyName).Append(R);
                first = false;
            }
            if (first)
            {
                sb.Append(L).Append(keyFields[0].PropertyName).Append(R)
                  .Append("=EXCLUDED.").Append(L).Append(keyFields[0].PropertyName).Append(R);
            }
            return sb.ToString();
        }

        private static string BuildMergeUpsert(DbCommand cmd, string table, Field[] fields, object[] values,
            List<int> insertList, Field[] keyFields, HashSet<string> keyNames, char L, char R, DatabaseType dbType)
        {
            var sb = new StringBuilder();
            string tName = L + table + R;
            sb.Append("MERGE INTO ").Append(tName).Append(" T USING (SELECT ");
            int p = 0;
            for (int j = 0; j < insertList.Count; j++)
            {
                if (j > 0) sb.Append(',');
                string pn = "@p" + p;
                sb.Append(pn).Append(" AS ").Append(L).Append(fields[insertList[j]].PropertyName).Append(R);
                AddParam(cmd, pn, values[insertList[j]]);
                p++;
            }
            // Oracle MERGE 需要 FROM dual
            if (dbType == DatabaseType.Oracle || dbType == DatabaseType.DaMeng)
                sb.Append(" FROM dual");
            sb.Append(") S ON (");
            for (int k = 0; k < keyFields.Length; k++)
            {
                if (k > 0) sb.Append(" AND ");
                sb.Append("T.").Append(L).Append(keyFields[k].PropertyName).Append(R)
                  .Append("=S.").Append(L).Append(keyFields[k].PropertyName).Append(R);
            }
            sb.Append(") WHEN MATCHED THEN UPDATE SET ");
            bool first = true;
            for (int j = 0; j < insertList.Count; j++)
            {
                var f = fields[insertList[j]];
                if (keyNames.Contains(f.PropertyName)) continue;
                if (!first) sb.Append(',');
                sb.Append("T.").Append(L).Append(f.PropertyName).Append(R)
                  .Append("=S.").Append(L).Append(f.PropertyName).Append(R);
                first = false;
            }
            if (first)
            {
                sb.Append("T.").Append(L).Append(keyFields[0].PropertyName).Append(R)
                  .Append("=S.").Append(L).Append(keyFields[0].PropertyName).Append(R);
            }
            sb.Append(" WHEN NOT MATCHED THEN INSERT (");
            for (int j = 0; j < insertList.Count; j++)
            {
                if (j > 0) sb.Append(',');
                sb.Append(L).Append(fields[insertList[j]].PropertyName).Append(R);
            }
            sb.Append(") VALUES (");
            for (int j = 0; j < insertList.Count; j++)
            {
                if (j > 0) sb.Append(',');
                sb.Append("S.").Append(L).Append(fields[insertList[j]].PropertyName).Append(R);
            }
            sb.Append(')');
            // SqlServer MERGE 末尾要求分号
            if (dbType == DatabaseType.SqlServer || dbType == DatabaseType.SqlServer9)
                sb.Append(';');
            return sb.ToString();
        }

        private static async Task<int> FallbackUpsert(DbSession dbSession, string table, Field[] fields, object[] values,
            List<int> insertList, Field[] keyFields, HashSet<string> keyNames, char L, char R, bool async, CancellationToken ct)
        {
            // 1) UPDATE
            var provider = dbSession.Db.DbProvider;
            using (var cmdU = provider.DbProviderFactory.CreateCommand())
            {
                var sb = new StringBuilder();
                sb.Append("UPDATE ").Append(L).Append(table).Append(R).Append(" SET ");
                int p = 0;
                bool first = true;
                for (int j = 0; j < insertList.Count; j++)
                {
                    var f = fields[insertList[j]];
                    if (keyNames.Contains(f.PropertyName)) continue;
                    if (!first) sb.Append(',');
                    string pn = "@p" + p;
                    sb.Append(L).Append(f.PropertyName).Append(R).Append('=').Append(pn);
                    AddParam(cmdU, pn, values[insertList[j]]);
                    p++;
                    first = false;
                }
                sb.Append(" WHERE ");
                for (int k = 0; k < keyFields.Length; k++)
                {
                    if (k > 0) sb.Append(" AND ");
                    int idx = Array.FindIndex(fields, x => string.Equals(x.PropertyName, keyFields[k].PropertyName, StringComparison.OrdinalIgnoreCase));
                    string pn = "@k" + k;
                    sb.Append(L).Append(keyFields[k].PropertyName).Append(R).Append('=').Append(pn);
                    AddParam(cmdU, pn, idx >= 0 ? values[idx] : DBNull.Value);
                }
                cmdU.CommandText = sb.ToString();
                int affected = async
                    ? await dbSession.Db.ExecuteNonQueryAsync(cmdU).ConfigureAwait(false)
                    : dbSession.Db.ExecuteNonQuery(cmdU);
                if (affected > 0) return affected;
            }
            // 2) INSERT
            using (var cmdI = provider.DbProviderFactory.CreateCommand())
            {
                var sb = new StringBuilder();
                sb.Append("INSERT INTO ").Append(L).Append(table).Append(R).Append(" (");
                for (int j = 0; j < insertList.Count; j++)
                {
                    if (j > 0) sb.Append(',');
                    sb.Append(L).Append(fields[insertList[j]].PropertyName).Append(R);
                }
                sb.Append(") VALUES (");
                int p = 0;
                for (int j = 0; j < insertList.Count; j++)
                {
                    if (j > 0) sb.Append(',');
                    string pn = "@p" + p;
                    sb.Append(pn);
                    AddParam(cmdI, pn, values[insertList[j]]);
                    p++;
                }
                sb.Append(')');
                cmdI.CommandText = sb.ToString();
                return async
                    ? await dbSession.Db.ExecuteNonQueryAsync(cmdI).ConfigureAwait(false)
                    : dbSession.Db.ExecuteNonQuery(cmdI);
            }
        }

        private static IEnumerable<string> keys(Field[] fields, HashSet<string> keyNames)
        {
            foreach (var f in fields)
                if (keyNames.Contains(f.PropertyName)) yield return f.PropertyName;
        }

        private static void AddParam(DbCommand cmd, string name, object value)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = value ?? DBNull.Value;
            cmd.Parameters.Add(p);
        }
    }
}
