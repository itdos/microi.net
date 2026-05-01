/****************************************************
 * 文 件 名：CodeFirst.cs
 * 创建日期：2026-05-01
 * 文件描述：CodeFirst 建表扩展。
 *
 *   设计：
 *     - 基于 Entity.GetFields() 的元数据（Field.PropertyName / ParameterDbType / ParameterSize）生成 DDL
 *     - 支持 SqlServer/MySql/PostgreSql/Oracle/达梦/金仓/SQLite 各方言的列类型映射
 *     - 自动识别 Identity 列、主键
 *     - 可选 [Index] 特性声明索引
 *
 *   用法：
 *     dbSession.CreateTable<SysUser>();           // 不存在则建表
 *     dbSession.CreateTable<SysUser>(dropIfExists: true);   // 重建
 *     dbSession.SyncSchema(typeof(SysUser), typeof(Order)); // 批量
 *
 *   注意：仅做基础建表，复杂迁移请配合 DDL/Services 下的完整服务。
 ******************************************************/

using Dos.ORM.Common;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Reflection;
using System.Text;

namespace Dos.ORM
{
    /// <summary>
    /// 索引声明特性（标在实体类上或属性上）
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Property, AllowMultiple = true)]
    public sealed class IndexAttribute : Attribute
    {
        /// <summary>索引名</summary>
        public string Name { get; }
        /// <summary>列名（标在类上时必填）</summary>
        public string[] Columns { get; }
        /// <summary>是否唯一</summary>
        public bool IsUnique { get; set; }
        /// <summary>构造</summary>
        public IndexAttribute(string name, params string[] columns)
        {
            Name = name; Columns = columns;
        }
    }

    /// <summary>
    /// CodeFirst 扩展
    /// </summary>
    public static class CodeFirstExtensions
    {
        /// <summary>
        /// 不存在则建表（默认）
        /// </summary>
        public static void CreateTable<TEntity>(this DbSession dbSession, bool dropIfExists = false)
            where TEntity : Entity, new()
        {
            CreateTable(dbSession, typeof(TEntity), dropIfExists);
        }

        /// <summary>
        /// 不存在则建表
        /// </summary>
        public static void CreateTable(this DbSession dbSession, Type entityType, bool dropIfExists = false)
        {
            if (dbSession == null) throw new ArgumentNullException(nameof(dbSession));
            if (entityType == null) throw new ArgumentNullException(nameof(entityType));
            if (!typeof(Entity).IsAssignableFrom(entityType))
                throw new ArgumentException("必须是 Entity 子类", nameof(entityType));

            var sample = (Entity)Activator.CreateInstance(entityType);
            var tableName = sample.GetTableName();
            var fields = sample.GetFields();
            var identity = sample.GetIdentityField();
            var primary = sample.GetPrimaryKeyFields();
            var dbType = dbSession.Db.DbProvider.DatabaseType;

            if (dropIfExists)
            {
                ExecuteSilent(dbSession, BuildDropTableSql(dbType, tableName));
            }

            string createSql = BuildCreateTableSql(dbType, tableName, fields, identity, primary, entityType);
            ExecuteSilent(dbSession, createSql);

            // 索引
            var indexes = entityType.GetCustomAttributes<IndexAttribute>().ToList();
            foreach (var prop in entityType.GetProperties())
            {
                foreach (var ia in prop.GetCustomAttributes<IndexAttribute>())
                {
                    indexes.Add(ia.Columns?.Length > 0 ? ia : new IndexAttribute(ia.Name, prop.Name) { IsUnique = ia.IsUnique });
                }
            }
            foreach (var idx in indexes)
            {
                if (idx.Columns == null || idx.Columns.Length == 0) continue;
                var sql = BuildCreateIndexSql(dbType, tableName, idx);
                ExecuteSilent(dbSession, sql);
            }
        }

        /// <summary>
        /// 同步多个实体（不存在则建表）
        /// </summary>
        public static void SyncSchema(this DbSession dbSession, params Type[] entityTypes)
        {
            foreach (var t in entityTypes)
                CreateTable(dbSession, t, dropIfExists: false);
        }

        /// <summary>
        /// 检查表是否存在
        /// </summary>
        public static bool TableExists(this DbSession dbSession, string tableName)
        {
            var dbType = dbSession.Db.DbProvider.DatabaseType;
            string sql;
            switch (dbType)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                    sql = $"SELECT COUNT(1) FROM sys.tables WHERE name='{tableName.Replace("'", "''")}'";
                    break;
                case DatabaseType.MySql:
                    sql = $"SELECT COUNT(1) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='{tableName.Replace("'", "''")}'";
                    break;
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase:
                    sql = $"SELECT COUNT(1) FROM information_schema.tables WHERE table_name='{tableName.Replace("'", "''").ToLower()}'";
                    break;
                case DatabaseType.Sqlite3:
                    sql = $"SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='{tableName.Replace("'", "''")}'";
                    break;
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng:
                    sql = $"SELECT COUNT(1) FROM user_tables WHERE table_name=UPPER('{tableName.Replace("'", "''")}')";
                    break;
                default:
                    return false;
            }
            try
            {
                var v = Convert.ToInt32(dbSession.Db.ExecuteScalar(CommandType.Text, sql));
                return v > 0;
            }
            catch { return false; }
        }

        private static void ExecuteSilent(DbSession dbSession, string sql)
        {
            if (string.IsNullOrEmpty(sql)) return;
            using (var cmd = dbSession.Db.DbProvider.DbProviderFactory.CreateCommand())
            {
                cmd.CommandText = sql;
                cmd.CommandType = CommandType.Text;
                try { dbSession.Db.ExecuteNonQuery(cmd); } catch { /* CREATE 已存在等忽略 */ }
            }
        }

        private static string BuildDropTableSql(DatabaseType dbType, string tableName)
        {
            switch (dbType)
            {
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng:
                    return $"DROP TABLE \"{tableName}\"";
                default:
                    return $"DROP TABLE IF EXISTS \"{tableName}\"";
            }
        }

        private static string BuildCreateTableSql(DatabaseType dbType, string tableName, Field[] fields,
            Field identity, Field[] primary, Type entityType)
        {
            var (L, R) = QuoteChars(dbType);
            var sb = new StringBuilder();
            // SQLServer 使用 IF NOT EXISTS pattern via OBJECT_ID
            switch (dbType)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                    sb.Append($"IF OBJECT_ID(N'{tableName}','U') IS NULL ");
                    break;
            }
            sb.Append("CREATE TABLE ");
            if (dbType == DatabaseType.MySql || dbType == DatabaseType.PostgreSql ||
                dbType == DatabaseType.KingBase || dbType == DatabaseType.Sqlite3)
                sb.Append("IF NOT EXISTS ");
            sb.Append(L).Append(tableName).Append(R).Append(" (");

            var props = entityType.GetProperties().ToDictionary(p => p.Name, p => p, StringComparer.OrdinalIgnoreCase);
            bool hasIdentity = !object.ReferenceEquals(identity, null);

            for (int i = 0; i < fields.Length; i++)
            {
                if (i > 0) sb.Append(',');
                var f = fields[i];
                sb.Append(L).Append(f.PropertyName).Append(R).Append(' ');
                sb.Append(MapColumnType(dbType, f, props.TryGetValue(f.PropertyName, out var pi) ? pi.PropertyType : typeof(string)));
                if (hasIdentity && string.Equals(f.PropertyName, identity.PropertyName, StringComparison.OrdinalIgnoreCase))
                {
                    sb.Append(IdentityClause(dbType));
                }
            }
            // 主键
            var pkFields = (primary != null && primary.Length > 0) ? primary
                : (hasIdentity ? new[] { identity } : null);
            if (pkFields != null && pkFields.Length > 0)
            {
                sb.Append(", PRIMARY KEY (");
                for (int i = 0; i < pkFields.Length; i++)
                {
                    if (i > 0) sb.Append(',');
                    sb.Append(L).Append(pkFields[i].PropertyName).Append(R);
                }
                sb.Append(')');
            }
            sb.Append(')');
            if (dbType == DatabaseType.MySql) sb.Append(" ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            return sb.ToString();
        }

        private static string BuildCreateIndexSql(DatabaseType dbType, string tableName, IndexAttribute idx)
        {
            var (L, R) = QuoteChars(dbType);
            var sb = new StringBuilder();
            sb.Append("CREATE ");
            if (idx.IsUnique) sb.Append("UNIQUE ");
            sb.Append("INDEX ");
            if (dbType == DatabaseType.MySql || dbType == DatabaseType.PostgreSql ||
                dbType == DatabaseType.KingBase || dbType == DatabaseType.Sqlite3)
                sb.Append("IF NOT EXISTS ");
            sb.Append(L).Append(idx.Name).Append(R).Append(" ON ")
              .Append(L).Append(tableName).Append(R).Append(" (");
            for (int i = 0; i < idx.Columns.Length; i++)
            {
                if (i > 0) sb.Append(',');
                sb.Append(L).Append(idx.Columns[i]).Append(R);
            }
            sb.Append(')');
            return sb.ToString();
        }

        private static (char L, char R) QuoteChars(DatabaseType dbType)
        {
            switch (dbType)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                case DatabaseType.Sqlite3:
                case DatabaseType.MsAccess: return ('[', ']');
                case DatabaseType.MySql:    return ('`', '`');
                default:                    return ('"', '"');
            }
        }

        private static string IdentityClause(DatabaseType dbType)
        {
            switch (dbType)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9: return " IDENTITY(1,1)";
                case DatabaseType.MySql:      return " AUTO_INCREMENT";
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase:   return " GENERATED BY DEFAULT AS IDENTITY";
                case DatabaseType.Sqlite3:    return " AUTOINCREMENT";
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng:     return " GENERATED BY DEFAULT AS IDENTITY";
                default: return "";
            }
        }

        private static string MapColumnType(DatabaseType dbType, Field f, Type clrType)
        {
            var t = Nullable.GetUnderlyingType(clrType) ?? clrType;
            // 优先使用 Field.ParameterDbType
            if (f.ParameterDbType.HasValue)
                return MapDbType(dbType, f.ParameterDbType.Value, f.ParameterSize);
            // 否则按 CLR 类型推断
            return MapClrType(dbType, t, f.ParameterSize);
        }

        private static string MapDbType(DatabaseType db, DbType dbt, int? size)
        {
            switch (dbt)
            {
                case DbType.String:
                case DbType.AnsiString:
                    return StringType(db, size ?? 255);
                case DbType.Int16: return Int16Type(db);
                case DbType.Int32: return Int32Type(db);
                case DbType.Int64: return Int64Type(db);
                case DbType.Boolean: return BooleanType(db);
                case DbType.DateTime:
                case DbType.DateTime2:
                    return DateTimeType(db);
                case DbType.Date: return "DATE";
                case DbType.Time: return "TIME";
                case DbType.Decimal: return DecimalType(db);
                case DbType.Double: return DoubleType(db);
                case DbType.Single: return FloatType(db);
                case DbType.Guid: return GuidType(db);
                case DbType.Binary: return BinaryType(db, size);
                default: return StringType(db, size ?? 255);
            }
        }

        private static string MapClrType(DatabaseType db, Type t, int? size)
        {
            if (t == typeof(string)) return StringType(db, size ?? 255);
            if (t == typeof(short) || t == typeof(ushort)) return Int16Type(db);
            if (t == typeof(int) || t == typeof(uint)) return Int32Type(db);
            if (t == typeof(long) || t == typeof(ulong)) return Int64Type(db);
            if (t == typeof(bool)) return BooleanType(db);
            if (t == typeof(DateTime) || t == typeof(DateTimeOffset)) return DateTimeType(db);
            if (t == typeof(decimal)) return DecimalType(db);
            if (t == typeof(double)) return DoubleType(db);
            if (t == typeof(float)) return FloatType(db);
            if (t == typeof(Guid)) return GuidType(db);
            if (t == typeof(byte[])) return BinaryType(db, size);
            if (t.IsEnum) return Int32Type(db);
            return StringType(db, size ?? 255);
        }

        private static string StringType(DatabaseType db, int size)
        {
            if (size > 4000 || size <= 0)
            {
                switch (db)
                {
                    case DatabaseType.SqlServer:
                    case DatabaseType.SqlServer9: return "NVARCHAR(MAX)";
                    case DatabaseType.Oracle:
                    case DatabaseType.DaMeng: return "CLOB";
                    case DatabaseType.MySql: return "LONGTEXT";
                    default: return "TEXT";
                }
            }
            switch (db)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9: return $"NVARCHAR({size})";
                case DatabaseType.MySql: return $"VARCHAR({size})";
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng: return $"VARCHAR2({size})";
                default: return $"VARCHAR({size})";
            }
        }
        private static string Int16Type(DatabaseType db) => db == DatabaseType.Oracle || db == DatabaseType.DaMeng ? "NUMBER(5)" : "SMALLINT";
        private static string Int32Type(DatabaseType db) => db == DatabaseType.Oracle || db == DatabaseType.DaMeng ? "NUMBER(10)" : (db == DatabaseType.PostgreSql || db == DatabaseType.KingBase ? "INTEGER" : "INT");
        private static string Int64Type(DatabaseType db) => db == DatabaseType.Oracle || db == DatabaseType.DaMeng ? "NUMBER(19)" : "BIGINT";
        private static string BooleanType(DatabaseType db)
        {
            switch (db)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9: return "BIT";
                case DatabaseType.MySql: return "TINYINT(1)";
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng: return "NUMBER(1)";
                default: return "BOOLEAN";
            }
        }
        private static string DateTimeType(DatabaseType db)
        {
            switch (db)
            {
                case DatabaseType.SqlServer: return "DATETIME";
                case DatabaseType.SqlServer9: return "DATETIME2";
                case DatabaseType.MySql: return "DATETIME";
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng: return "TIMESTAMP";
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase: return "TIMESTAMP";
                default: return "DATETIME";
            }
        }
        private static string DecimalType(DatabaseType db) => db == DatabaseType.Oracle || db == DatabaseType.DaMeng ? "NUMBER(18,4)" : "DECIMAL(18,4)";
        private static string DoubleType(DatabaseType db) => db == DatabaseType.Oracle || db == DatabaseType.DaMeng ? "BINARY_DOUBLE" : "DOUBLE PRECISION";
        private static string FloatType(DatabaseType db) => db == DatabaseType.Oracle || db == DatabaseType.DaMeng ? "BINARY_FLOAT" : (db == DatabaseType.MySql ? "FLOAT" : "REAL");
        private static string GuidType(DatabaseType db)
        {
            switch (db)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9: return "UNIQUEIDENTIFIER";
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase: return "UUID";
                default: return "VARCHAR(36)";
            }
        }
        private static string BinaryType(DatabaseType db, int? size)
        {
            switch (db)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9: return "VARBINARY(MAX)";
                case DatabaseType.MySql: return "LONGBLOB";
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng: return "BLOB";
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase: return "BYTEA";
                default: return "BLOB";
            }
        }
    }
}
