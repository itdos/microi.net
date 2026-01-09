using System;
using SqlSugar;

namespace Microi.net
{
    /// <summary>
    /// SqlSugar 会话工厂
    /// 用于创建 SqlSugar 数据库会话
    /// </summary>
    public class SqlSugarSessionFactory : IMicroiDbSessionFactory
    {
        /// <summary>
        /// 工厂类型
        /// </summary>
        public string FactoryType => "SqlSugar";
        /// <summary>
        /// 创建数据库会话
        /// </summary>
        public IMicroiDbSession CreateSession(string connectionString, DatabaseType dbType)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new ArgumentException("Connection string cannot be null or empty.", nameof(connectionString));

            var sugarDbType = ConvertToSugarDbType(dbType);
            
            var config = new ConnectionConfig
            {
                ConnectionString = connectionString,
                DbType = sugarDbType,
                IsAutoCloseConnection = true,
                InitKeyType = InitKeyType.Attribute
            };

            var client = new SqlSugarClient(config);
            return new SqlSugarSessionAdapter(client);
        }

        /// <summary>
        /// 转换数据库类型
        /// </summary>
        private SqlSugar.DbType ConvertToSugarDbType(DatabaseType dbType)
        {
            return dbType switch
            {
                DatabaseType.MySql => SqlSugar.DbType.MySql,
                DatabaseType.SqlServer => SqlSugar.DbType.SqlServer,
                DatabaseType.Oracle => SqlSugar.DbType.Oracle,
                _ => SqlSugar.DbType.MySql
            };
        }
    }
}
