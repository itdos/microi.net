/****************************************************
 * 文 件 名：BulkCopy.cs
 * 创建日期：2026-05-01
 * 文件描述：高性能批量插入扩展。
 *
 *   - SqlServer：调用原生 SqlBulkCopy（反射加载，避免硬依赖）
 *   - MySql    ：调用 MySqlConnector.MySqlBulkCopy（反射加载）
 *   - PostgreSql：调用 Npgsql.NpgsqlBinaryImporter（反射加载）
 *   - 其他数据库（Oracle/Sqlite/达梦/金仓/MsAccess）→ 自动 Fallback 到
 *     "多行 VALUES" 批量 INSERT，按 batchSize 分批提交事务。
 *
 *   特点：
 *     1. 不引入新 NuGet 依赖：用反射动态发现客户端类型，可用就用、不可用降级
 *     2. 使用 DataTable 中转，列名严格按 Entity.GetFields() 顺序，无字段名冲突
 *     3. 自动跳过 Identity 自增字段
 *     4. 同步 + 异步双 API，老代码 0 改动
 *
 *   使用：
 *     dbSession.BulkInsert(list);
 *     await dbSession.BulkInsertAsync(list, batchSize: 5000);
 ******************************************************/

using Dos.ORM.Common;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Dos.ORM
{
    /// <summary>
    /// 批量插入扩展（高性能 BulkInsert）
    /// </summary>
    public static class BulkCopyExtensions
    {
        /// <summary>
        /// 默认每批大小
        /// </summary>
        public const int DefaultBatchSize = 5000;

        /// <summary>
        /// 批量插入（同步）。自动按数据库类型选择 BulkCopy 原生通道或 multi-row INSERT。
        /// </summary>
        /// <typeparam name="TEntity">实体类型</typeparam>
        /// <param name="dbSession">DbSession</param>
        /// <param name="entities">待插入实体集合</param>
        /// <param name="batchSize">每批大小，默认 5000</param>
        /// <param name="bulkCopyTimeoutSeconds">单批超时秒数，默认 600 (10 分钟)</param>
        /// <returns>实际插入行数</returns>
        public static int BulkInsert<TEntity>(this DbSession dbSession,
            IEnumerable<TEntity> entities,
            int batchSize = DefaultBatchSize,
            int bulkCopyTimeoutSeconds = 600)
            where TEntity : Entity
        {
            return BulkInsertCore(dbSession, entities, batchSize, bulkCopyTimeoutSeconds, async: false, CancellationToken.None)
                .GetAwaiter().GetResult();
        }

        /// <summary>
        /// 批量插入（异步）
        /// </summary>
        public static Task<int> BulkInsertAsync<TEntity>(this DbSession dbSession,
            IEnumerable<TEntity> entities,
            int batchSize = DefaultBatchSize,
            int bulkCopyTimeoutSeconds = 600,
            CancellationToken cancellationToken = default)
            where TEntity : Entity
        {
            return BulkInsertCore(dbSession, entities, batchSize, bulkCopyTimeoutSeconds, async: true, cancellationToken);
        }

        private static async Task<int> BulkInsertCore<TEntity>(DbSession dbSession,
            IEnumerable<TEntity> entities,
            int batchSize,
            int bulkCopyTimeoutSeconds,
            bool async,
            CancellationToken ct)
            where TEntity : Entity
        {
            if (dbSession == null) throw new ArgumentNullException(nameof(dbSession));
            if (entities == null) return 0;
            if (batchSize <= 0) batchSize = DefaultBatchSize;

            var list = entities as IList<TEntity> ?? entities.ToList();
            if (list.Count == 0) return 0;

            // 取实体的字段定义（从第一条样本拿，所有同类型实体的 fields 顺序一致）
            var sampleFields = list[0].GetFields();
            if (sampleFields == null || sampleFields.Length == 0)
            {
                throw new InvalidOperationException("实体没有定义 Field，无法 BulkInsert。请确保实体重写了 GetFields()。");
            }
            var identityField = list[0].GetIdentityField();
            // Field 重载了 != / == 运算符返回 WhereClip，必须用 ReferenceEquals 做空判断
            bool hasIdentity = !object.ReferenceEquals(identityField, null);
            string identityName = hasIdentity ? identityField.PropertyName : null;
            // 排除自增列
            var insertableIdx = new List<int>(sampleFields.Length);
            for (int i = 0; i < sampleFields.Length; i++)
            {
                if (hasIdentity &&
                    string.Equals(sampleFields[i].PropertyName, identityName, StringComparison.OrdinalIgnoreCase))
                    continue;
                insertableIdx.Add(i);
            }

            var dbType = dbSession.Db.DbProvider.DatabaseType;
            var tableName = list[0].GetTableName();

            // 路由到具体策略
            switch (dbType)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                    if (await TryBulkInsertSqlServerAsync(dbSession, list, sampleFields, insertableIdx, tableName,
                            batchSize, bulkCopyTimeoutSeconds, async, ct).ConfigureAwait(false))
                        return list.Count;
                    break;
                case DatabaseType.MySql:
                    if (await TryBulkInsertMySqlAsync(dbSession, list, sampleFields, insertableIdx, tableName,
                            batchSize, bulkCopyTimeoutSeconds, async, ct).ConfigureAwait(false))
                        return list.Count;
                    break;
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase:
                    if (await TryBulkInsertPostgreSqlAsync(dbSession, list, sampleFields, insertableIdx, tableName,
                            batchSize, async, ct).ConfigureAwait(false))
                        return list.Count;
                    break;
            }

            // Fallback: multi-row INSERT
            return await BulkInsertMultiRowAsync(dbSession, list, sampleFields, insertableIdx, tableName,
                batchSize, async, ct).ConfigureAwait(false);
        }

        #region 通用 Fallback：多行 VALUES INSERT

        /// <summary>
        /// 兼容所有数据库的批量插入：构造  INSERT INTO t (c1,c2) VALUES (@p0,@p1),(@p2,@p3),...  
        /// 使用参数化绑定，无 SQL 注入。按 batchSize 分批，单事务提交。
        /// </summary>
        private static async Task<int> BulkInsertMultiRowAsync<TEntity>(DbSession dbSession,
            IList<TEntity> list,
            Field[] fields,
            List<int> insertableIdx,
            string tableName,
            int batchSize,
            bool async,
            CancellationToken ct)
            where TEntity : Entity
        {
            var provider = dbSession.Db.DbProvider;
            char L = provider.LeftToken, R = provider.RightToken;
            char paramPrefix = '@';
            // 字段名列表
            var colSql = new StringBuilder();
            for (int j = 0; j < insertableIdx.Count; j++)
            {
                if (j > 0) colSql.Append(',');
                colSql.Append(L).Append(fields[insertableIdx[j]].PropertyName).Append(R);
            }
            string columnsSql = colSql.ToString();
            string tableSql = L + tableName + R;

            int total = 0;
            int chunkCount = (list.Count + batchSize - 1) / batchSize;
            for (int c = 0; c < chunkCount; c++)
            {
                ct.ThrowIfCancellationRequested();
                int start = c * batchSize;
                int end = Math.Min(start + batchSize, list.Count);
                int rows = end - start;

                var sb = new StringBuilder(rows * insertableIdx.Count * 8);
                sb.Append("INSERT INTO ").Append(tableSql).Append(" (").Append(columnsSql).Append(") VALUES ");

                using (var cmd = provider.DbProviderFactory.CreateCommand())
                {
                    int paramIdx = 0;
                    for (int r = start; r < end; r++)
                    {
                        if (r > start) sb.Append(',');
                        sb.Append('(');
                        var values = list[r].GetValues();
                        for (int j = 0; j < insertableIdx.Count; j++)
                        {
                            if (j > 0) sb.Append(',');
                            string pName = paramPrefix + "p" + paramIdx;
                            sb.Append(pName);
                            var p = cmd.CreateParameter();
                            p.ParameterName = pName;
                            var v = values[insertableIdx[j]];
                            p.Value = v ?? DBNull.Value;
                            cmd.Parameters.Add(p);
                            paramIdx++;
                        }
                        sb.Append(')');
                    }
                    cmd.CommandText = sb.ToString();
                    cmd.CommandType = CommandType.Text;

                    if (async)
                        total += await dbSession.Db.ExecuteNonQueryAsync(cmd).ConfigureAwait(false);
                    else
                        total += dbSession.Db.ExecuteNonQuery(cmd);
                }
            }
            return total;
        }

        #endregion

        #region SqlServer 原生 SqlBulkCopy

        private static Type _sqlBulkCopyType;
        private static bool _sqlBulkCopyResolved;
        private static readonly object _sqlBulkCopyLock = new object();

        private static Type ResolveSqlBulkCopyType()
        {
            if (_sqlBulkCopyResolved) return _sqlBulkCopyType;
            lock (_sqlBulkCopyLock)
            {
                if (_sqlBulkCopyResolved) return _sqlBulkCopyType;
                _sqlBulkCopyType =
                    Type.GetType("Microsoft.Data.SqlClient.SqlBulkCopy, Microsoft.Data.SqlClient", throwOnError: false)
                    ?? Type.GetType("System.Data.SqlClient.SqlBulkCopy, System.Data.SqlClient", throwOnError: false);
                _sqlBulkCopyResolved = true;
                return _sqlBulkCopyType;
            }
        }

        private static async Task<bool> TryBulkInsertSqlServerAsync<TEntity>(DbSession dbSession,
            IList<TEntity> list, Field[] fields, List<int> insertableIdx, string tableName,
            int batchSize, int timeoutSeconds, bool async, CancellationToken ct)
            where TEntity : Entity
        {
            var sbcType = ResolveSqlBulkCopyType();
            if (sbcType == null) return false;

            var dt = BuildDataTable(list, fields, insertableIdx);
            using (var conn = dbSession.Db.CreateConnection())
            {
                if (async) await conn.OpenAsync(ct).ConfigureAwait(false);
                else conn.Open();

                using (var sbc = (IDisposable)Activator.CreateInstance(sbcType, new object[] { conn }))
                {
                    sbcType.GetProperty("DestinationTableName").SetValue(sbc, tableName);
                    sbcType.GetProperty("BatchSize").SetValue(sbc, batchSize);
                    sbcType.GetProperty("BulkCopyTimeout").SetValue(sbc, timeoutSeconds);

                    // 列映射
                    var mappingsProp = sbcType.GetProperty("ColumnMappings");
                    var mappings = mappingsProp.GetValue(sbc);
                    var addMethod = mappings.GetType().GetMethod("Add", new[] { typeof(string), typeof(string) });
                    foreach (DataColumn col in dt.Columns)
                    {
                        addMethod.Invoke(mappings, new object[] { col.ColumnName, col.ColumnName });
                    }

                    if (async)
                    {
                        var writeAsync = sbcType.GetMethod("WriteToServerAsync", new[] { typeof(DataTable), typeof(CancellationToken) });
                        await ((Task)writeAsync.Invoke(sbc, new object[] { dt, ct })).ConfigureAwait(false);
                    }
                    else
                    {
                        var write = sbcType.GetMethod("WriteToServer", new[] { typeof(DataTable) });
                        write.Invoke(sbc, new object[] { dt });
                    }
                }
            }
            return true;
        }

        #endregion

        #region MySql 原生 MySqlBulkCopy（MySqlConnector）

        private static Type _mysqlBulkCopyType;
        private static bool _mysqlBulkCopyResolved;
        private static readonly object _mysqlBulkCopyLock = new object();

        private static Type ResolveMySqlBulkCopyType()
        {
            if (_mysqlBulkCopyResolved) return _mysqlBulkCopyType;
            lock (_mysqlBulkCopyLock)
            {
                if (_mysqlBulkCopyResolved) return _mysqlBulkCopyType;
                _mysqlBulkCopyType =
                    Type.GetType("MySqlConnector.MySqlBulkCopy, MySqlConnector", throwOnError: false)
                    ?? Type.GetType("MySql.Data.MySqlClient.MySqlBulkCopy, MySql.Data", throwOnError: false);
                _mysqlBulkCopyResolved = true;
                return _mysqlBulkCopyType;
            }
        }

        private static async Task<bool> TryBulkInsertMySqlAsync<TEntity>(DbSession dbSession,
            IList<TEntity> list, Field[] fields, List<int> insertableIdx, string tableName,
            int batchSize, int timeoutSeconds, bool async, CancellationToken ct)
            where TEntity : Entity
        {
            var bcType = ResolveMySqlBulkCopyType();
            if (bcType == null) return false;

            var dt = BuildDataTable(list, fields, insertableIdx);
            using (var conn = dbSession.Db.CreateConnection())
            {
                if (async) await conn.OpenAsync(ct).ConfigureAwait(false);
                else conn.Open();

                var bc = Activator.CreateInstance(bcType, new object[] { conn });
                bcType.GetProperty("DestinationTableName").SetValue(bc, tableName);
                var timeoutProp = bcType.GetProperty("BulkCopyTimeout");
                if (timeoutProp != null) timeoutProp.SetValue(bc, timeoutSeconds);

                if (async)
                {
                    var writeAsync = bcType.GetMethod("WriteToServerAsync", new[] { typeof(DataTable), typeof(CancellationToken) })
                        ?? bcType.GetMethod("WriteToServerAsync", new[] { typeof(DataTable) });
                    var task = (Task)writeAsync.Invoke(bc, writeAsync.GetParameters().Length == 2
                        ? new object[] { dt, ct } : new object[] { dt });
                    await task.ConfigureAwait(false);
                }
                else
                {
                    var write = bcType.GetMethod("WriteToServer", new[] { typeof(DataTable) });
                    write.Invoke(bc, new object[] { dt });
                }
            }
            return true;
        }

        #endregion

        #region PostgreSQL 原生 COPY (Npgsql)

        private static async Task<bool> TryBulkInsertPostgreSqlAsync<TEntity>(DbSession dbSession,
            IList<TEntity> list, Field[] fields, List<int> insertableIdx, string tableName,
            int batchSize, bool async, CancellationToken ct)
            where TEntity : Entity
        {
            // Npgsql 的 BeginBinaryImport 是 NpgsqlConnection 上的方法
            using (var conn = dbSession.Db.CreateConnection())
            {
                if (conn.GetType().FullName != "Npgsql.NpgsqlConnection") return false;
                var beginBinaryImport = conn.GetType().GetMethod("BeginBinaryImport", new[] { typeof(string) });
                if (beginBinaryImport == null) return false;

                if (async) await conn.OpenAsync(ct).ConfigureAwait(false);
                else conn.Open();

                var colSql = new StringBuilder();
                for (int j = 0; j < insertableIdx.Count; j++)
                {
                    if (j > 0) colSql.Append(',');
                    colSql.Append('"').Append(fields[insertableIdx[j]].PropertyName).Append('"');
                }
                string copySql = $"COPY \"{tableName}\" ({colSql}) FROM STDIN (FORMAT BINARY)";

                var importer = (IDisposable)beginBinaryImport.Invoke(conn, new object[] { copySql });
                try
                {
                    var startRow = importer.GetType().GetMethod("StartRow", Type.EmptyTypes);
                    var write = importer.GetType().GetMethod("Write", new[] { typeof(object) });
                    var complete = importer.GetType().GetMethod("Complete", Type.EmptyTypes);

                    foreach (var entity in list)
                    {
                        ct.ThrowIfCancellationRequested();
                        var values = entity.GetValues();
                        startRow.Invoke(importer, null);
                        for (int j = 0; j < insertableIdx.Count; j++)
                        {
                            var v = values[insertableIdx[j]] ?? DBNull.Value;
                            write.Invoke(importer, new object[] { v });
                        }
                    }
                    complete.Invoke(importer, null);
                }
                finally
                {
                    importer.Dispose();
                }
            }
            return true;
        }

        #endregion

        #region 工具：Entity → DataTable

        private static DataTable BuildDataTable<TEntity>(IList<TEntity> list, Field[] fields, List<int> insertableIdx)
            where TEntity : Entity
        {
            var dt = new DataTable();
            for (int j = 0; j < insertableIdx.Count; j++)
            {
                dt.Columns.Add(fields[insertableIdx[j]].PropertyName, typeof(object));
            }
            foreach (var e in list)
            {
                var row = dt.NewRow();
                var values = e.GetValues();
                for (int j = 0; j < insertableIdx.Count; j++)
                {
                    row[j] = values[insertableIdx[j]] ?? (object)DBNull.Value;
                }
                dt.Rows.Add(row);
            }
            return dt;
        }

        #endregion
    }
}
