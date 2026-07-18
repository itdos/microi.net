using System;
using System.IO;
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
